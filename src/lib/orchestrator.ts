import { runConsensusVote, brainRouter, logDecision, AGENT_PERSONAS } from "./chains";
import { runAgentPrompt } from "./ollama";
import type { AgentMessage, MemoryEntry } from "../types/agent";
import { emit } from "@tauri-apps/api/event";

export interface SwarmExecutionConfig {
  goal: string;
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
  const sessionId = `swarm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const messages: AgentMessage[] = [];
  const decisionLog: any[] = [];

  console.log(`[HiveMind] Starting swarm: ${sessionId} — Goal: ${config.goal}`);

  const routerDecision = await brainRouter(config.goal, "high");
  console.log(`[HiveMind] Router: ${routerDecision.selectedModel}`);

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
      runAgentChain("planner",    config.goal, config.memoryContext, sessionId),
      runAgentChain("researcher", config.goal, config.memoryContext, sessionId),
      runAgentChain("creator",    config.goal, config.memoryContext, sessionId),
      runAgentChain("executor",   config.goal, config.memoryContext, sessionId),
      runAgentChain("memory",     config.goal, config.memoryContext, sessionId),
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
    config.memoryContext
  );
  await updateStatus("critic", "idle");
  messages.push(...criticResult.messages);

  const consensus = await runConsensusVote(
    plannerResult.output,
    researcherResult.output,
    creatorResult.output,
    executorResult.output,
    criticResult.output
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
    logDecision(`Planned: ${plannerResult.output.substring(0, 50)}...`, "gemma2:2b", plannerResult.confidence, plannerResult.reasoning, [], "planner"),
    logDecision(`Researched: ${researcherResult.output.substring(0, 50)}...`, "gemma2:2b", researcherResult.confidence, researcherResult.reasoning, [], "researcher"),
    logDecision(`Reviewed: ${criticResult.output.substring(0, 50)}...`, "gemma2:2b", criticResult.confidence, criticResult.reasoning, [], "critic"),
  );

  return {
    sessionId,
    messages,
    consensusReached: consensus.consensus,
    approvalRequired: config.userApprovalRequired !== false,
    recommendedAction: consensus.recommendedAction,
    decisionLog,
  };
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
  memoryContext?: MemoryEntry[],
  sessionId?: string
): Promise<AgentChainResult> => {
  const persona = AGENT_PERSONAS[agentRole];

  const memoryString = memoryContext && memoryContext.length > 0
    ? memoryContext.map(m => `- [${m.agentRole}] ${m.content}`).join("\n")
    : "No previous memory.";

  const userPrompt = `Goal: ${goal}\n\nMemory context:\n${memoryString}\n\nProvide your analysis and end with [CONFIDENCE: X] where X is 0-100.`;

  try {
    const result = await runAgentPrompt(
      persona.systemPrompt,
      userPrompt,
      { model: "gemma2:2b", temperature: 0.7 }
    );

    const confidenceMatch = result.content.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    const message: AgentMessage = {
      id:        `msg-${Date.now()}-${agentRole}`,
      agentRole: agentRole as any,
      content:   result.content || `${persona.name} completed analysis.`,
      timestamp: Date.now(),
      type:      "thought",
      confidence,
    };

    try { if (sessionId) await emit("agent_message", message); } catch {}
    console.log(`[HiveMind] ${persona.name} responded (${result.durationMs}ms)`);

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
  memoryContext?: MemoryEntry[]
): Promise<AgentChainResult> => {
  const persona = AGENT_PERSONAS["critic"];

  const criticGoal = `Review these agent outputs for the goal: "${goal}"\n\n${outputs.map((o, i) => `Agent ${i + 1}:\n${o}`).join("\n\n")}\n\nScore quality (0-100) and provide recommendations. End with [CONFIDENCE: X].`;

  try {
    const result = await runAgentPrompt(
      persona.systemPrompt,
      criticGoal,
      { model: "gemma2:2b", temperature: 0.5 }
    );

    const confidenceMatch = result.content.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    const message: AgentMessage = {
      id:        `msg-${Date.now()}-critic`,
      agentRole: "critic",
      content:   result.content || "Critic completed review.",
      timestamp: Date.now(),
      type:      "critique",
      confidence,
    };

    try { await emit("agent_message", message); } catch {}

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
  const interval = config.checkIntervalMs || 300_000;

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