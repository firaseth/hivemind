import { runConsensusVote, brainRouter, logDecision, AGENT_PERSONAS } from "./chains";
import { OllamaProvider } from "../llm/ollama";
import { withRetry } from "./retry";
import { getBreaker } from "./circuitBreaker";
import { tracer } from "../observability/tracing";
import { globalPluginRegistry } from "../plugins/registry";
import type { AgentMessage, MemoryEntry } from "../types/agent";
import { emit as tauriEmit } from "@tauri-apps/api/event";

// Safe emit for non-Tauri environments (like Node benchmarks or evals)
const emit = async (event: string, payload: any) => {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try { await tauriEmit(event, payload); } catch (e) {}
  } else {
    // console.log(`[Bus] ${event}`, payload);
  }
};

export interface SwarmExecutionConfig {
  goal: string;
  language?: string;
  model?: string;
  agentModels?: Record<string, string>;
  projectId?: string;
  memoryContext?: MemoryEntry[];
  userApprovalRequired?: boolean;
}

export interface SwarmExecutionResult {
  sessionId: string;
  messages: AgentMessage[];
  consensusReached: boolean;
  approvalRequired: boolean;
  recommendedAction?: string;
  decisionLog: any[];
}

export const executeSwarm = async (
  config: SwarmExecutionConfig
): Promise<SwarmExecutionResult> => {
  return tracer.startActiveSpan('executeSwarm', async (span) => {
    try {
      span.setAttribute('goal', config.goal);
      const sessionId = `swarm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const messages: AgentMessage[] = [];
  const decisionLog: any[] = [];

  console.log(`[HiveMind] Starting swarm: ${sessionId} — Goal: ${config.goal}`);

  const routerDecision = await brainRouter(config.goal, "high");
  console.log(`[HiveMind] Router: ${routerDecision.selectedModel}`);

  const getModel = (role: string) => config.agentModels?.[role] || config.model || "qwen2.5:1.5b";

  const updateStatus = async (role: string, status: string) => {
    try { await emit("agent_status", { role, status, sessionId }); } catch {}
  };

  await Promise.all([
    updateStatus("planner",    "working"),
    updateStatus("researcher", "working"),
    updateStatus("creator",    "working"),
    updateStatus("executor",   "working"),
    updateStatus("memory",     "working"),
  ]);

  const [plannerResult, researcherResult, creatorResult, executorResult, memoryResult] =
    await Promise.all([
      runAgentChain("planner",    config.goal, config.language, getModel("planner"),    config.memoryContext, sessionId),
      runAgentChain("researcher", config.goal, config.language, getModel("researcher"), config.memoryContext, sessionId),
      runAgentChain("creator",    config.goal, config.language, getModel("creator"),    config.memoryContext, sessionId),
      runAgentChain("executor",   config.goal, config.language, getModel("executor"),   config.memoryContext, sessionId),
      runAgentChain("memory",     config.goal, config.language, getModel("memory"),     config.memoryContext, sessionId),
    ]);
      

  await Promise.all([
    updateStatus("planner",    "idle"),
    updateStatus("researcher", "idle"),
    updateStatus("creator",    "idle"),
    updateStatus("executor",   "idle"),
    updateStatus("memory",     "idle"),
  ]);

  messages.push(
    ...plannerResult.messages,
    ...researcherResult.messages,
    ...creatorResult.messages,
    ...executorResult.messages,
    ...memoryResult.messages,
  );

  await updateStatus("critic", "working");
  const criticResult = await runCriticReview(
    config.goal,
    [plannerResult.output, researcherResult.output, creatorResult.output, executorResult.output],
    config.language,
    getModel("critic"),
    config.memoryContext
  );
  await updateStatus("critic", "idle");
  messages.push(...criticResult.messages);

  const consensus = await runConsensusVote(
    plannerResult.output,
    researcherResult.output,
    creatorResult.output,
    executorResult.output,
    criticResult.output,
    new OllamaProvider({ model: getModel("critic") })
  );

  console.log(`[HiveMind] Consensus: ${consensus.consensus} (${consensus.agreementScore}%)`);

  const consensusMsg: AgentMessage = {
    id: `msg-${Date.now()}-consensus`,
    agentRole: "system" as any,
    content: `🐝 Consensus ${consensus.consensus ? "reached" : "pending"} (${consensus.agreementScore}% agreement)\n\n${consensus.recommendedAction}`,
    timestamp: Date.now(),
    type: "output",
    confidence: consensus.agreementScore,
  };
  messages.push(consensusMsg);
  try { await emit("agent_message", consensusMsg); } catch {}
  try {
    await emit("consensus_reached", {
      sessionId,
      consensus: consensus.consensus,
      agreementScore: consensus.agreementScore,
      recommendedAction: consensus.recommendedAction,
    });
  } catch {}

  decisionLog.push(
    logDecision(`Planned: ${plannerResult.output.substring(0, 50)}...`, getModel("planner"), plannerResult.confidence, plannerResult.reasoning, [], "planner"),
    logDecision(`Researched: ${researcherResult.output.substring(0, 50)}...`, getModel("researcher"), researcherResult.confidence, researcherResult.reasoning, [], "researcher"),
    logDecision(`Reviewed: ${criticResult.output.substring(0, 50)}...`, getModel("critic"), criticResult.confidence, criticResult.reasoning, [], "critic"),
  );

    return {
      sessionId,
      messages,
      consensusReached: consensus.consensus,
      approvalRequired: config.userApprovalRequired !== false,
      recommendedAction: consensus.recommendedAction,
      decisionLog,
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
  });
};

interface AgentChainResult {
  output: string;
  confidence: number;
  reasoning: string;
  messages: AgentMessage[];
}

export const runAgentChain = async (
  agentRole: "planner" | "researcher" | "executor" | "creator" | "memory",
  goal: string,
  language: string = "English",
  model?: string,
  memoryContext?: MemoryEntry[],
  sessionId?: string
): Promise<AgentChainResult> => {
  const persona = AGENT_PERSONAS[agentRole];

  const memoryString = memoryContext && memoryContext.length > 0
    ? memoryContext.map(m => `- [${m.agentRole}] ${m.content}`).join("\n")
    : "No previous memory.";

 
  const userPrompt = `Goal: ${goal}\nLanguage: ${language}\n\nIMPORTANT: You MUST respond in ${language}. Be concise, max 3 sentences. End with [CONFIDENCE: X].`
  
  const message: AgentMessage = {
    id:        `msg-${Date.now()}-${agentRole}`,
    agentRole: agentRole as any,
    content:   "Thinking...",
    timestamp: Date.now(),
    type:      "output",
    confidence: 0,
  };

  try { if (sessionId) await emit("agent_message", message); } catch {}

  try {
    let accumulatedContent = "";
    const breaker = getBreaker(agentRole);
    const provider = new OllamaProvider({ model: model || "qwen2.5:1.5b" });

    // --- Plugin Delegation ---
    const plugin = globalPluginRegistry.getAllPlugins().find(p => p.id.includes(agentRole));
    if (plugin && plugin.execute) {
      const pluginResult = await breaker.execute(() => plugin.execute!(goal, provider));
      message.content = pluginResult.content;
      const confidenceMatch = pluginResult.content.match(/\[CONFIDENCE:\s*(\d+)\]/);
      message.confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 80;
      if (sessionId) await emit("agent_message_done", { msgId: message.id, fullContent: message.content, confidence: message.confidence });
      
      return {
        output:    message.content,
        confidence: message.confidence,
        reasoning: `Executed via plugin: ${plugin.name}`,
        messages:  [message],
      };
    }
    // -------------------------

    const result = await breaker.execute(() => 
      withRetry(async () => {
        accumulatedContent = ""; // Reset for retries
        let fullContent = "";
        
        // Formulate the full prompt with system instructions
        const fullPrompt = `${persona.systemPrompt}\n\n${userPrompt}`;
        
        const stream = provider.generateStreaming(fullPrompt);
        for await (const token of stream) {
          accumulatedContent += token;
          fullContent = accumulatedContent;
          try { if (sessionId) await emit("agent_token", { msgId: message.id, fullContent: accumulatedContent }); } catch {}
        }
        
        const confidenceMatch = fullContent.match(/\[CONFIDENCE:\s*(\d+)\]/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;
        try { if (sessionId) await emit("agent_message_done", { msgId: message.id, fullContent, confidence }); } catch {}
        
        return { content: fullContent };
      }, { 
        maxRetries: 2, 
        backoffMs: 800,
        onRetry: (attempt, err) => console.warn(`[Retry] Attempt ${attempt} for ${agentRole}: ${err.message}`)
      })
    );

    const confidenceMatch = result.content.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    // Update the message object with final content for the return value
    message.content = result.content;
    message.confidence = confidence;

    return {
      output:    result.content,
      confidence,
      reasoning: `${persona.name} analyzed the goal directly via Ollama`,
      messages:  [message],
    };

  } catch (error) {
    console.error(`[HiveMind] ${agentRole} error:`, error);

    const message: AgentMessage = {
      id:        `msg-${Date.now()}-${agentRole}-error`,
      agentRole: agentRole as any,
      content:   `${persona.name} encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: Date.now(),
      type:      "thought",
      confidence: 0,
    };

    try { if (sessionId) await emit("agent_message", message); } catch {}

    return { output: message.content, confidence: 0, reasoning: "Agent error", messages: [message] };
  }
};

export const runCriticReview = async (
  goal: string,
  outputs: string[],
  language: string = "English",
  model?: string,
  memoryContext?: MemoryEntry[]
): Promise<AgentChainResult> => {
  const persona = AGENT_PERSONAS["critic"];

  const criticGoal = `Review these agent outputs for the goal: "${goal}"\nLanguage: ${language}\n\nIMPORTANT: You MUST respond in ${language}.\n\n${outputs.map((o, i) => `Agent ${i + 1}:\n${o}`).join("\n\n")}\n\nScore quality (0-100) and provide recommendations. End with [CONFIDENCE: X].`;

  const message: AgentMessage = {
    id:        `msg-${Date.now()}-critic`,
    agentRole: "critic",
    content:   "Reviewing outputs...",
    timestamp: Date.now(),
    type:      "output",
    confidence: 0,
  };

  try { await emit("agent_message", message); } catch {}

  try {
    let accumulatedContent = "";
    const breaker = getBreaker("critic");
    const provider = new OllamaProvider({ model: model || "qwen2.5:1.5b" });

    const result = await breaker.execute(() => 
      withRetry(async () => {
        accumulatedContent = ""; // Reset for retries
        let fullContent = "";

        const fullPrompt = `${persona.systemPrompt}\n\n${criticGoal}`;

        const stream = provider.generateStreaming(fullPrompt);
        for await (const token of stream) {
          accumulatedContent += token;
          fullContent = accumulatedContent;
          try { await emit("agent_token", { msgId: message.id, fullContent: accumulatedContent }); } catch {}
        }

        const confidenceMatch = fullContent.match(/\[CONFIDENCE:\s*(\d+)\]/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;
        try { await emit("agent_message_done", { msgId: message.id, fullContent, confidence }); } catch {}

        return { content: fullContent };
      }, { 
        maxRetries: 2, 
        backoffMs: 800,
        onRetry: (attempt, err) => console.warn(`[Retry] Attempt ${attempt} for critic: ${err.message}`)
      })
    );

    const confidenceMatch = result.content.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    // Update message object
    message.content = result.content;
    message.confidence = confidence;

    return { output: result.content, confidence, reasoning: "Critic reviewed all outputs", messages: [message] };

  } catch (error) {
    console.error("[HiveMind] Critic error:", error);
    return {
      output:    `Critic error: ${error instanceof Error ? error.message : "Unknown"}`,
      confidence: 0,
      reasoning: "Critic failed",
      messages:  [],
    };
  }
};

let backgroundSwarmRunning = false;

export const startBackgroundSwarm = async (config: {
  projectId: string;
  memoryContext: MemoryEntry[];
  checkIntervalMs?: number;
}): Promise<void> => {
  if (backgroundSwarmRunning) return;
  backgroundSwarmRunning = true;
  const interval = config.checkIntervalMs ||300_000;

  const check = async () => {
    if (!backgroundSwarmRunning) return;
    try {
      await executeSwarm({
        goal: `Analyze project "${config.projectId}" for issues and provide proactive recommendations.`,
        projectId: config.projectId,
        memoryContext: config.memoryContext,
        userApprovalRequired: false,
      });
    } catch (e) {
      console.error("[HiveMind] Background swarm error:", e);
    }
    if (backgroundSwarmRunning) setTimeout(check, interval);
  };

  check();
};

export const stopBackgroundSwarm = (): void => {
  backgroundSwarmRunning = false;
};