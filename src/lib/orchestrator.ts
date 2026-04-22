import { createAgentChain, runConsensusVote, brainRouter, logDecision, AGENT_PERSONAS } from "./chains";
import type { AgentMessage, MemoryEntry } from "../types/agent";
import { emit } from "@tauri-apps/api/event";

// ============================================================================
// SWARM ORCHESTRATOR - Manages parallel agent execution and consensus
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

/**
 * Execute a full swarm session:
 * 1. Planner breaks down the goal
 * 2. Researcher gathers information
 * 3. Creator generates solutions
 * 4. Executor prepares implementation
 * 5. Critic reviews all outputs
 * 6. Consensus vote aggregates findings
 */
export const executeSwarm = async (
  config: SwarmExecutionConfig
): Promise<SwarmExecutionResult> => {
  const sessionId = `swarm-\${Date.now()}-\${Math.random().toString(36).substring(7)}`;
  const messages: AgentMessage[] = [];
  const decisionLog: any[] = [];

  console.log(`[HiveMind] Starting swarm session: ${sessionId}`);
  console.log(`[HiveMind] Goal: ${config.goal}`);

  // Step 1: Router decides which model to use
  const routerDecision = await brainRouter(config.goal, "high");
  console.log(`[HiveMind] Brain Router: ${routerDecision.selectedModel} (confidence: ${routerDecision.confidence}%)`);

  const updateStatus = async (role: string, status: string) => {
    await emit("agent_status", { role, status, sessionId });
  };

  // Step 2: Run all agents in parallel
  await updateStatus("planner", "working");
  const plannerPromise = runAgentChain("planner", config.goal, config.memoryContext, sessionId);
  
  await updateStatus("researcher", "working");
  const researcherPromise = runAgentChain("researcher", config.goal, config.memoryContext, sessionId);
  
  await updateStatus("creator", "working");
  const creatorPromise = runAgentChain("creator", config.goal, config.memoryContext, sessionId);
  
  await updateStatus("executor", "working");
  const executorPromise = runAgentChain("executor", config.goal, config.memoryContext, sessionId);
  
  await updateStatus("memory", "working");
  const memoryPromise = runAgentChain("memory", config.goal, config.memoryContext, sessionId);

  const [plannerResult, researcherResult, creatorResult, executorResult, memoryResult] = 
    await Promise.all([
      plannerPromise,
      researcherPromise,
      creatorPromise,
      executorPromise,
      memoryPromise,
    ]);

  await updateStatus("planner", "idle");
  await updateStatus("researcher", "idle");
  await updateStatus("creator", "idle");
  await updateStatus("executor", "idle");
  await updateStatus("memory", "idle");

  // Add all agent messages
  messages.push(...plannerResult.messages);
  messages.push(...researcherResult.messages);
  messages.push(...creatorResult.messages);
  messages.push(...executorResult.messages);
  messages.push(...memoryResult.messages);

  // Step 3: Critic reviews all outputs
  const criticResult = await runCriticReview(
    config.goal,
    [plannerResult.output, researcherResult.output, creatorResult.output, executorResult.output],
    config.memoryContext
  );
  messages.push(...criticResult.messages);

  // Step 4: Run consensus vote
  const consensus = await runConsensusVote(
    plannerResult.output,
    researcherResult.output,
    creatorResult.output,
    executorResult.output,
    criticResult.output
  );

  console.log(`[HiveMind] Consensus: \${consensus.consensus} (agreement: \${consensus.agreementScore}%)`);

  // Step 5: Add consensus decision to messages
  messages.push({
    id: `msg-\${Date.now()}-consensus`,
    agentRole: "system" as any,
    content: consensus.recommendedAction,
    timestamp: Date.now(),
    type: "output",
    confidence: consensus.agreementScore,
  });

  // Step 6: Log all decisions
  decisionLog.push(
    logDecision(
      `Planned: \${plannerResult.output.substring(0, 50)}...`,
      "gemma2:9b",
      plannerResult.confidence,
      plannerResult.reasoning,
      config.memoryContext?.map(m => m.id) || [],
      "planner"
    ),
    logDecision(
      `Researched: \${researcherResult.output.substring(0, 50)}...`,
      "gemma2:9b",
      researcherResult.confidence,
      researcherResult.reasoning,
      config.memoryContext?.map(m => m.id) || [],
      "researcher"
    ),
    logDecision(
      `Reviewed: \${criticResult.output.substring(0, 50)}...`,
      "gemma2:9b",
      criticResult.confidence,
      criticResult.reasoning,
      config.memoryContext?.map(m => m.id) || [],
      "critic"
    )
  );

  const result: SwarmExecutionResult = {
    sessionId,
    messages,
    consensusReached: consensus.consensus,
    approvalRequired: config.userApprovalRequired !== false,
    recommendedAction: consensus.recommendedAction,
    decisionLog,
  };

  console.log(`[HiveMind] Swarm session completed: \${sessionId}`);
  return result;
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
  const chain = createAgentChain(agentRole);
  const persona = AGENT_PERSONAS[agentRole];

  try {
    const output = await chain.invoke({
      goal,
      memoryContext: memoryContext || [],
    });

    // Parse confidence from output
    const confidenceMatch = output.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    const message: AgentMessage = {
      id: `msg-${Date.now()}-${agentRole}`,
      agentRole: agentRole as any,
      content: output,
      timestamp: Date.now(),
      type: "thought",
      confidence,
    };

    // Emit real-time message event via Tauri
    if (sessionId) {
      await emit("agent_message", message);
    }

    return {
      output,
      confidence,
      reasoning: `\${persona.name} analyzed the goal and provided structured output`,
      messages: [message],
    };
  } catch (error) {
    console.error(`[HiveMind] Error running \${agentRole} agent:`, error);
    const message: AgentMessage = {
      id: `msg-\${Date.now()}-\${agentRole}-error`,
      agentRole: agentRole as any,
      content: `Error: \${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: Date.now(),
      type: "thought",
      confidence: 0,
    };
    return {
      output: message.content,
      confidence: 0,
      reasoning: "Agent encountered an error",
      messages: [message],
    };
  }
};

// ============================================================================
// HELPER: Run critic review
// ============================================================================

export const runCriticReview = async (
  goal: string,
  outputs: string[],
  memoryContext?: MemoryEntry[]
): Promise<AgentChainResult> => {
  const criticPrompt = `You are the Critic agent reviewing a swarm's work.

Goal: \${goal}

Outputs to review:
\${outputs.map((output, i) => \`\${i + 1}. \${output}\`).join("\n\n")}

Please provide:
1. Overall quality score (0-100)
2. Key strengths
3. Critical gaps or risks
4. Specific recommendations for improvement

Include your confidence score at the end: [CONFIDENCE: X]`;

  const chain = createAgentChain("critic");
  try {
    const output = await chain.invoke({
      goal: criticPrompt,
      memoryContext: memoryContext || [],
    });

    const confidenceMatch = output.match(/\[CONFIDENCE:\s*(\d+)\]/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    const message: AgentMessage = {
      id: `msg-\${Date.now()}-critic-review`,
      agentRole: "critic",
      content: output,
      timestamp: Date.now(),
      type: "critique",
      confidence,
    };

    return {
      output,
      confidence,
      reasoning: "Critic reviewed all agent outputs for quality and coherence",
      messages: [message],
    };
  } catch (error) {
    console.error("[HiveMind] Error running critic review:", error);
    return {
      output: `Error during review: \${error instanceof Error ? error.message : "Unknown error"}`,
      confidence: 0,
      reasoning: "Critic review failed",
      messages: [],
    };
  }
};

// ============================================================================
// BACKGROUND SWARM - Proactive insights
// ============================================================================

export interface BackgroundSwarmConfig {
  projectId: string;
  memoryContext: MemoryEntry[];
  checkIntervalMs?: number;
}

let backgroundSwarmRunning = false;

/**
 * Run a light swarm in the background to surface proactive insights
 * Useful for: pending deadlines, conflicting requirements, pattern detection
 */
export const startBackgroundSwarm = async (config: BackgroundSwarmConfig): Promise<void> => {
  if (backgroundSwarmRunning) {
    console.log("[HiveMind] Background swarm already running");
    return;
  }

  backgroundSwarmRunning = true;
  const checkInterval = config.checkIntervalMs || 300000; // 5 minutes

  console.log(`[HiveMind] Starting background swarm for project: \${config.projectId}`);

  const backgroundCheck = async () => {
    if (!backgroundSwarmRunning) return;

    try {
      const insightGoal = `Analyze project "\${config.projectId}" for:
      1. Upcoming deadlines or time conflicts
      2. Resource constraints
      3. Dependency issues
      4. Pattern anomalies
      Provide proactive recommendations.`;

      const result = await executeSwarm({
        goal: insightGoal,
        projectId: config.projectId,
        memoryContext: config.memoryContext,
        userApprovalRequired: false,
      });

      // Emit insights event to UI
      if (result.consensusReached) {
        console.log(`[HiveMind] Background swarm found insights for \${config.projectId}`);
        // Event would be emitted here to React via Tauri
      }
    } catch (error) {
      console.error("[HiveMind] Background swarm error:", error);
    }

    // Schedule next check
    if (backgroundSwarmRunning) {
      setTimeout(backgroundCheck, checkInterval);
    }
  };

  // Start first check
  backgroundCheck();
};

export const stopBackgroundSwarm = (): void => {
  backgroundSwarmRunning = false;
  console.log("[HiveMind] Background swarm stopped");
};
