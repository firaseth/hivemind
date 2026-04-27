import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { AgentPersona, MemoryEntry } from "../types/agent";

const DEFAULT_MODEL = "qwen2.5:1.5b";
const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

// ============================================================================
// AGENT PERSONAS
// ============================================================================

export const AGENT_PERSONAS: Record<string, AgentPersona> = {
  planner: {
    role: "planner",
    name: "Planner",
    description: "Breaks down goals into structured steps and timelines",
    model: DEFAULT_MODEL,
    systemPrompt: `You are the Planner agent. Your role is to break down complex goals into actionable, structured steps. You think strategically about task decomposition, dependencies, and timelines. Respond with clear, numbered steps and consider resource allocation.`,
    color: "#E6F1FB",
    accent: "#185FA5",
  },
  researcher: {
    role: "researcher",
    name: "Researcher",
    description: "Gathers and synthesizes information from all available sources",
    model: DEFAULT_MODEL,
    systemPrompt: `You are the Researcher agent. Your role is to gather, verify, and synthesize information. You ask clarifying questions, reference past knowledge, and identify information gaps. Be thorough and cite your reasoning. Flag assumptions clearly.`,
    color: "#E1F5EE",
    accent: "#0F6E56",
  },
  executor: {
    role: "executor",
    name: "Executor",
    description: "Executes approved tasks and handles implementation details",
    model: DEFAULT_MODEL,
    systemPrompt: `You are the Executor agent. Your role is to execute approved plans with precision. Focus on implementation details, code quality, and error handling. Ask for clarification on ambiguous requirements before proceeding.`,
    color: "#EAF3DE",
    accent: "#3B6D11",
  },
  critic: {
    role: "critic",
    name: "Critic",
    description: "Reviews and scores outputs, identifies risks and improvements",
    model: DEFAULT_MODEL,
    systemPrompt: `You are the Critic agent. Your role is to review proposals and outputs with a critical eye. Score quality on a scale of 0-100. Identify gaps, risks, and areas for improvement. Be constructive: suggest specific fixes, not just problems.`,
    color: "#FAEEDA",
    accent: "#BA7517",
  },
  creator: {
    role: "creator",
    name: "Creator",
    description: "Generates original content, designs, and creative solutions",
    model: DEFAULT_MODEL,
    systemPrompt: `You are the Creator agent. Your role is to generate original, thoughtful solutions. Think outside the box while respecting constraints. Consider aesthetics, clarity, and impact. Be imaginative but grounded in the actual requirements.`,
    color: "#FAECE7",
    accent: "#993C1D",
  },
  memory: {
    role: "memory",
    name: "Memory Keeper",
    description: "Maintains context and recalls relevant past decisions",
    model: DEFAULT_MODEL,
    systemPrompt: `You are the Memory Keeper agent. Your role is to maintain context and surface relevant past decisions. You connect current work to previous projects, identify patterns, and suggest what to remember. Be precise about what changed and why it matters.`,
    color: "#FBEAF0",
    accent: "#993556",
  },
};

// ============================================================================
// AGENT CHAINS
// ============================================================================

export interface AgentChainInput {
  goal: string;
  context?: string;
  previousMessages?: string[];
  memoryContext?: MemoryEntry[];
}

export interface AgentChainOutput {
  role: string;
  content: string;
  confidence: number;
  reasoning: string;
}

export const createAgentChain = (
  role: "planner" | "researcher" | "executor" | "critic" | "creator" | "memory"
) => {
  const persona = AGENT_PERSONAS[role];

  const llm = new Ollama({
  model: DEFAULT_MODEL,
  baseUrl: DEFAULT_BASE_URL,
  keepAlive: "10m",
  numCtx: 1024,
});

  const promptTemplate = new PromptTemplate({
    template: `{systemPrompt}

## Relevant Past Decisions:
{memoryContext}

## Previous Agent Responses:
{previousMessages}

## Current Goal:
{goal}

## Additional Context:
{context}

Respond with:
1. Your analysis and reasoning
2. A confidence score (0-100) at the end in the format: [CONFIDENCE: X]
3. Your final recommendation or output`,
    inputVariables: [
      "systemPrompt",
      "goal",
      "context",
      "previousMessages",
      "memoryContext",
    ],
  });

  const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
  return chain;
};

// ============================================================================
// SWARM CONSENSUS ENGINE
// ============================================================================

export interface ConsensusRequest {
  goal: string;
  plannerOutput: string;
  researcherOutput: string;
  creatorOutput: string;
  criticOutput: string;
}

export const runConsensusVote = async (
  plannerOutput: string,
  researcherOutput: string,
  creatorOutput: string,
  executorOutput: string,
  criticOutput: string
): Promise<{
  consensus: boolean;
  agreementScore: number;
  recommendedAction: string;
  reasoning: string;
}> => {
  const llm = new Ollama({
  model: DEFAULT_MODEL,
  baseUrl: DEFAULT_BASE_URL,
  keepAlive: "10m",
  numCtx: 1024,
});

  const consensusPrompt = new PromptTemplate({
    template: `You are a consensus facilitator reviewing swarm agent outputs.

Planner said: {plannerOutput}
Researcher said: {researcherOutput}
Creator said: {creatorOutput}
Executor said: {executorOutput}
Critic said: {criticOutput}

Analyze:
1. Are these outputs aligned? (yes/no)
2. What is the overall agreement score (0-100)?
3. What is the recommended next action?
4. Any critical gaps or conflicts?

Format your response as JSON:
{{"consensus": true, "agreementScore": 80, "recommendedAction": "proceed", "reasoning": "explanation"}}`,
    inputVariables: [
      "plannerOutput",
      "researcherOutput",
      "creatorOutput",
      "executorOutput",
      "criticOutput",
    ],
  });

  const chain = consensusPrompt.pipe(llm).pipe(new StringOutputParser());

  const result = await chain.invoke({
    plannerOutput,
    researcherOutput,
    creatorOutput,
    executorOutput,
    criticOutput,
  });

  try {
    const parsed = JSON.parse(result);
    return parsed;
  } catch {
    return {
      consensus: false,
      agreementScore: 0,
      recommendedAction: "Unable to reach consensus",
      reasoning: result,
    };
  }
};

// ============================================================================
// BRAIN ROUTER
// ============================================================================

export interface BrainRouterDecision {
  selectedModel: string;
  confidence: number;
  reasoning: string;
  shouldEscalateToCloud: boolean;
}

export const brainRouter = async (
  taskDescription: string,
  complexity: "low" | "medium" | "high"
): Promise<BrainRouterDecision> => {
  const hasWebRequired =
    taskDescription.includes("web") || taskDescription.includes("search");
  const hasCode =
    taskDescription.includes("code") || taskDescription.includes("python");
  const isHighComplexity =
    complexity === "high" || taskDescription.length > 500;

  return {
    selectedModel: DEFAULT_MODEL,
    confidence: isHighComplexity ? 70 : 90,
    reasoning: `Selected ${DEFAULT_MODEL} for ${complexity} complexity task`,
    shouldEscalateToCloud: isHighComplexity && (hasWebRequired || hasCode),
  };
};

// ============================================================================
// DECISION REPLAY
// ============================================================================

export interface DecisionLog {
  id: string;
  timestamp: number;
  action: string;
  modelUsed: string;
  confidence: number;
  reasoning: string;
  memoryUsed: string[];
  agentRole: string;
}

export const logDecision = (
  action: string,
  modelUsed: string,
  confidence: number,
  reasoning: string,
  memoryUsed: string[],
  agentRole: string
): DecisionLog => {
  return {
    id: `decision-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    timestamp: Date.now(),
    action,
    modelUsed,
    confidence,
    reasoning,
    memoryUsed,
    agentRole,
  };
};