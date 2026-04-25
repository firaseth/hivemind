import { createAgentChain, runConsensusVote, brainRouter, logDecision, AGENT_PERSONAS } from "./chains";
import type { AgentMessage, MemoryEntry } from "../types/agent";
import { emit } from "@tauri-apps/api/event";

// ============================================================================
// SWARM ORCHESTRATOR
// ============================================================================

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

  console.log(`[HiveMind] Starting swarm session: ${sessionId}`);
  console.log(`[HiveMind] Goal: ${config.goal}`);

  // Route the task
  const routerDecision = await brainRouter(config.goal, "high");
  console.log(`[HiveMind] Brain Router: ${routerDecision.selectedModel} (confidence: ${routerDecision.confidence}%)`);

  const updateStatus = async (role: string, status: string) => {
    await emit("agent_status", { role, status, sessionId });
  };

  // ── Run all agents in parallel ─────────────────────────────────────────────
  await updateStatus("planner",    "working");
  await updateStatus("researcher", "working");
  await updateStatus("creator",    "working");
  await updateStatus("executor",   "working");
  await updateStatus("memory",     "working");

  const [plannerResult, researcherResult, creatorResult, executorResult, memoryResult] =
    await Promise.all([
      runAgentChain("planner",    config.goal, config.memoryContext, sessionId),
      runAgentChain("researcher", config.goal, config.memoryContext, sessionId),
      runAgentChain("creator",    config.goal, config.memoryContext, sessionId),
      runAgentChain("executor",   config.goal, config.memoryContext, sessionId),
      runAgentChain("memory",     config.goal, config.memoryContext, sessionId),
    ]);

  await updateStatus("planner",    "idle");
  await updateStatus("researcher", "idle");
  await updateStatus("creator",    "idle");
  await updateStatus("executor",   "idle");
  await updateStatus("memory",     "idle");

  messages.push(
    ...plannerResult.messages,
    ...researcherResult.messages,
    ...creatorResult.messages,
    ...executorResult.messages,
    ...memoryResult.messages,
  );

  // ── Critic reviews all outputs ─────────────────────────────────────────────
  await updateStatus("critic", "working");
  const criticResult = await runCriticReview(
    config.goal,
    [plannerResult.output, researcherResult.output, creatorResult.output, executorResult.output],
    config.memoryContext
  );
  await updateStatus("critic", "idle");
  messages.push(...criticResult.messages);

  // ── Consensus vote ─────────────────────────────────────────────────────────
  const consensus = await runConsensusVote(
    plannerResult.output,
    researcherResult.output,
    creatorResult.output,
    executorResult.output,
    criticResult.output
  );

  console.log(`[HiveMind] Consensus: ${consensus.consensus} (agreement: ${consensus.agreementScore}%)`);

  messages.push({
    id: `msg-${Date.now()}-consensus`,
    agentRole: "system" as any,
    content: `🐝 Consensus reached (${consensus.agreementScore}% agreement)\n\n${consensus.recommendedAction}`,
    timestamp: Date.now(),
    type: "output",
    confidence: consensus.agreementScore,
  });

  await emit("consensus_reached", {
    sessionId,
    consensus: consensus.consensus,
    agreementScore: consensus.agreementScore,
    recommendedAction: consensus.recommendedAction,
  });

  // ── Decision log ───────────────────────────────────────────────────────────
  decisionLog.push(
    logDecision(
      `Planned: ${plannerResult.output.substring(0, 50)}...`,
      "gemma2:9b",
      plannerResult.confidence,
      plannerResult.reasoning,
      config.memoryContext?.map(m => m.id) || [],
      "planner"
    ),
    logDecision(
      `Researched: ${researcherResult.output.substring(0, 50)}...`,
      "gemma2:9b",
      researcherResult.confidence,
      researcherResult.reasoning,
      config.memoryContext?.map(m => m.id) || [],
      "researcher"
    ),
    logDecision(
      `Reviewed: ${criticResult.output.substring(0, 50)}...`,
      "gemma2:9b",
      criticResult.confidence,
      criticResult.reasoning,
      config.memoryContext?.map(m => m.id) || [],
      "critic"
    )
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

// ============================================================================
// HELPER: Run single agent chain
// ============================================================================

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
  const chain  = createAgentChain(agentRole);
  const persona = AGENT_PERSONAS[agentRole];

  // Format memory context as readable string
  const memoryString = memoryContext && memoryContext.length > 0
    ? memoryContext.map(m => `- [${m.agentRole}] ${m.content}`).join("\n")
    : "No previous memory available.";

  try {
    const output = await chain.invoke({
      systemPrompt:     persona.systemPrompt,
      goal,
      context:          "No additional context.",
      previousMessages: "No previous agent messages.",
      memoryContext:    memoryString,
    });

    const confidenceMatch = output.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    const message: AgentMessage = {
      id:        `msg-${Date.now()}-${agentRole}`,
      agentRole: agentRole as any,
      content:   output,
      timestamp: Date.now(),
      type:      "thought",
      confidence,
    };

    if (sessionId) {
      await emit("agent_message", message);
    }

    return {
      output,
      confidence,
      reasoning: `${persona.name} analyzed the goal and provided structured output`,
      messages:  [message],
    };
  } catch (error) {
    console.error(`[HiveMind] Error running ${agentRole} agent:`, error);

    const message: AgentMessage = {
      id:        `msg-${Date.now()}-${agentRole}-error`,
      agentRole: agentRole as any,
      content:   `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: Date.now(),
      type:      "thought",
      confidence: 0,
    };

    if (sessionId) {
      await emit("agent_message", message);
    }

    return {
      output:    message.content,
      confidence: 0,
      reasoning: "Agent encountered an error",
      messages:  [message],
    };
  }
};

// ============================================================================
// HELPER: Critic review
// ============================================================================

export const runCriticReview = async (
  goal: string,
  outputs: string[],
  memoryContext?: MemoryEntry[]
): Promise<AgentChainResult> => {
  const persona = AGENT_PERSONAS["critic"];
  const chain   = createAgentChain("critic");

  const memoryString = memoryContext && memoryContext.length > 0
    ? memoryContext.map(m => `- [${m.agentRole}] ${m.content}`).join("\n")
    : "No previous memory available.";

  const criticGoal = `Review the following agent outputs for the goal: "${goal}"

${outputs.map((o, i) => `Agent ${i + 1}:\n${o}`).join("\n\n")}

Score quality (0-100), identify strengths, gaps, and risks.`;

  try {
    const output = await chain.invoke({
      systemPrompt:     persona.systemPrompt,
      goal:             criticGoal,
      context:          "Reviewing all agent outputs for quality.",
      previousMessages: outputs.join("\n---\n"),
      memoryContext:    memoryString,
    });

    const confidenceMatch = output.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    const message: AgentMessage = {
      id:        `msg-${Date.now()}-critic-review`,
      agentRole: "critic",
      content:   output,
      timestamp: Date.now(),
      type:      "critique",
      confidence,
    };

    await emit("agent_message", message);

    return {
      output,
      confidence,
      reasoning: "Critic reviewed all agent outputs for quality and coherence",
      messages:  [message],
    };
  } catch (error) {
    console.error("[HiveMind] Error running critic review:", error);
    return {
      output:    `Error during review: ${error instanceof Error ? error.message : "Unknown error"}`,
      confidence: 0,
      reasoning: "Critic review failed",
      messages:  [],
    };
  }
};

// ============================================================================
// BACKGROUND SWARM
// ============================================================================

let backgroundSwarmRunning = false;

export const startBackgroundSwarm = async (config: {
  projectId: string;
  memoryContext: MemoryEntry[];
  checkIntervalMs?: number;
}): Promise<void> => {
  if (backgroundSwarmRunning) return;
  backgroundSwarmRunning = true;

  const checkInterval = config.checkIntervalMs || 300_000;

  const backgroundCheck = async () => {
    if (!backgroundSwarmRunning) return;
    try {
      await executeSwarm({
        goal: `Analyze project "${config.projectId}" for upcoming deadlines, resource constraints, and dependency issues. Provide proactive recommendations.`,
        projectId:    config.projectId,
        memoryContext: config.memoryContext,
        userApprovalRequired: false,
      });
    } catch (error) {
      console.error("[HiveMind] Background swarm error:", error);
    }
    if (backgroundSwarmRunning) {
      setTimeout(backgroundCheck, checkInterval);
    }
  };

  backgroundCheck();
};

export const stopBackgroundSwarm = (): void => {
  backgroundSwarmRunning = false;
};