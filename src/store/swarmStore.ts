// ============================================================
// HiveMind — Swarm Store (Zustand)
// Global state for agents, messages, and swarm runs
// ============================================================

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Agent,
  AgentRole,
  AgentStatus,
  SwarmMessage,
  SwarmRun,
  MemoryEntry,
  ReplayEntry,
} from '../types/agent'
import { DEFAULT_AGENTS } from '../types/agent'
import {
  runAgent,
  runConsensus,
  checkOllamaHealth,
  routeTask,
} from '../lib/ollama'

// ─── Store shape ─────────────────────────────────────────────
interface SwarmStore {
  // Agents
  agents: Agent[]
  setAgentStatus: (role: AgentRole, status: AgentStatus) => void
  setAgentConfidence: (role: AgentRole, confidence: number) => void

  // Current swarm run
  currentRun: SwarmRun | null
  isRunning: boolean

  // Messages
  messages: SwarmMessage[]
  addMessage: (msg: Omit<SwarmMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void

  // Memory
  memories: MemoryEntry[]
  addMemory: (entry: Omit<MemoryEntry, 'id' | 'createdAt'>) => void

  // Decision replay log
  replayLog: ReplayEntry[]
  addReplayEntry: (entry: Omit<ReplayEntry, 'id' | 'timestamp'>) => void

  // Ollama health
  ollamaOnline: boolean
  availableModels: string[]
  checkOllama: () => Promise<void>

  // Goal input
  currentGoal: string
  setGoal: (goal: string) => void

  // Main swarm launcher
  launchSwarm: (goal: string) => Promise<void>
  approveAction: () => Promise<void>
  cancelRun: () => void
}

// ─── Helper: build agent from defaults ───────────────────────
function buildAgents(): Agent[] {
  return DEFAULT_AGENTS.map((a) => ({ ...a, id: uuidv4() }))
}

// ─── Store ───────────────────────────────────────────────────
export const useSwarmStore = create<SwarmStore>((set, get) => ({
  agents: buildAgents(),
  messages: [],
  memories: [],
  replayLog: [],
  currentRun: null,
  isRunning: false,
  ollamaOnline: false,
  availableModels: [],
  currentGoal: '',

  // ── Agent helpers ──────────────────────────────────────────
  setAgentStatus: (role, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.role === role ? { ...a, status } : a)),
    })),

  setAgentConfidence: (role, confidence) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.role === role ? { ...a, confidence } : a)),
    })),

  // ── Messages ───────────────────────────────────────────────
  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: uuidv4(), timestamp: Date.now() },
      ],
    })),

  clearMessages: () => set({ messages: [] }),

  // ── Memory ─────────────────────────────────────────────────
  addMemory: (entry) =>
    set((s) => ({
      memories: [
        ...s.memories,
        { ...entry, id: uuidv4(), createdAt: Date.now() },
      ],
    })),

  // ── Replay log ─────────────────────────────────────────────
  addReplayEntry: (entry) =>
    set((s) => ({
      replayLog: [
        ...s.replayLog,
        { ...entry, id: uuidv4(), timestamp: Date.now() },
      ],
    })),

  // ── Ollama health check ────────────────────────────────────
  checkOllama: async () => {
    const { online, models } = await checkOllamaHealth()
    set({ ollamaOnline: online, availableModels: models })
  },

  setGoal: (goal) => set({ currentGoal: goal }),

  cancelRun: () => {
    const { agents } = get()
    set({
      isRunning: false,
      currentRun: null,
      agents: agents.map((a) => ({ ...a, status: 'idle', confidence: 0 })),
    })
    get().addMessage({
      agentRole: 'system',
      agentName: 'System',
      content: '⚠️ Swarm run cancelled.',
    })
  },

  // ── Main swarm launcher ────────────────────────────────────
  launchSwarm: async (goal: string) => {
    const store = get()
    if (store.isRunning) return

    const runId = uuidv4()
    const route = routeTask(goal)

    // Reset state
    store.clearMessages()
    set({
      isRunning: true,
      currentGoal: goal,
      currentRun: {
        id: runId,
        goal,
        startedAt: Date.now(),
        messages: [],
        consensusRounds: [],
        status: 'running',
      },
    })

    // System kickoff message
    store.addMessage({
      agentRole: 'system',
      agentName: 'HiveMind',
      content: `🐝 Swarm launched — Goal: "${goal}"\nRouting: ${route.taskType} • Model: ${route.selectedModel}`,
    })

    const agentOutputs: Partial<Record<AgentRole, string>> = {}

    // ── Step 1: Memory agent checks context ─────────────────
    try {
      store.setAgentStatus('memory', 'working')
      store.addMessage({
        agentRole: 'memory',
        agentName: 'Memory',
        content: '🔍 Searching memory for relevant context...',
      })

      const recentMemories = store.memories
        .slice(-5)
        .map((m) => m.content)
        .join('\n')

      const memResult = await runAgent({
        role: 'memory',
        goal,
        context: recentMemories || 'No previous memory found.',
      })

      agentOutputs.memory = memResult.content
      store.setAgentStatus('memory', 'done')
      store.setAgentConfidence('memory', memResult.confidence)
      store.addMessage({
        agentRole: 'memory',
        agentName: 'Memory',
        content: memResult.content,
        confidence: memResult.confidence,
        modelUsed: memResult.modelUsed,
        reasoning: 'Retrieved and indexed relevant context from past sessions.',
      })
      store.addReplayEntry({
        action: 'Memory context retrieval',
        agentRole: 'memory',
        modelUsed: memResult.modelUsed,
        confidence: memResult.confidence,
        reasoning: 'Memory agent searched past sessions for relevant context.',
        memoryRefs: [],
      })
    } catch (e) {
      store.setAgentStatus('memory', 'error')
      agentOutputs.memory = 'No memory context available.'
    }

    // ── Step 2: Planner breaks down the goal ─────────────────
    try {
      store.setAgentStatus('planner', 'thinking')
      store.addMessage({
        agentRole: 'planner',
        agentName: 'Planner',
        content: '📋 Analysing goal and creating subtask plan...',
      })

      const planResult = await runAgent({
        role: 'planner',
        goal,
        context: agentOutputs.memory,
      })

      agentOutputs.planner = planResult.content
      store.setAgentStatus('planner', 'done')
      store.setAgentConfidence('planner', planResult.confidence)
      store.addMessage({
        agentRole: 'planner',
        agentName: 'Planner',
        content: planResult.content,
        confidence: planResult.confidence,
        modelUsed: planResult.modelUsed,
        reasoning: 'Decomposed the user goal into structured subtasks.',
      })
      store.addReplayEntry({
        action: 'Goal decomposition into subtasks',
        agentRole: 'planner',
        modelUsed: planResult.modelUsed,
        confidence: planResult.confidence,
        reasoning: 'Planner classified the goal and built a structured execution plan.',
        memoryRefs: [],
      })
    } catch (e) {
      store.setAgentStatus('planner', 'error')
    }

    // ── Step 3: Researcher gathers context ───────────────────
    try {
      store.setAgentStatus('researcher', 'working')
      store.addMessage({
        agentRole: 'researcher',
        agentName: 'Researcher',
        content: '🔬 Gathering relevant data and context...',
      })

      const researchResult = await runAgent({
        role: 'researcher',
        goal,
        context: agentOutputs.planner,
      })

      agentOutputs.researcher = researchResult.content
      store.setAgentStatus('researcher', 'done')
      store.setAgentConfidence('researcher', researchResult.confidence)
      store.addMessage({
        agentRole: 'researcher',
        agentName: 'Researcher',
        content: researchResult.content,
        confidence: researchResult.confidence,
        modelUsed: researchResult.modelUsed,
        reasoning: 'Gathered factual context to support plan execution.',
      })
    } catch (e) {
      store.setAgentStatus('researcher', 'error')
    }

    // ── Step 4: Critic reviews the plan ─────────────────────
    try {
      store.setAgentStatus('critic', 'thinking')
      store.addMessage({
        agentRole: 'critic',
        agentName: 'Critic',
        content: '🧐 Reviewing plan for flaws and risks...',
      })

      const combined = `PLAN:\n${agentOutputs.planner}\n\nRESEARCH:\n${agentOutputs.researcher}`
      const criticResult = await runAgent({
        role: 'critic',
        goal,
        context: combined,
      })

      agentOutputs.critic = criticResult.content
      store.setAgentStatus('critic', 'done')
      store.setAgentConfidence('critic', criticResult.confidence)
      store.addMessage({
        agentRole: 'critic',
        agentName: 'Critic',
        content: criticResult.content,
        confidence: criticResult.confidence,
        modelUsed: criticResult.modelUsed,
        reasoning: 'Evaluated plan quality and flagged potential issues.',
      })
    } catch (e) {
      store.setAgentStatus('critic', 'error')
    }

    // ── Step 5: Consensus check ──────────────────────────────
    store.addMessage({
      agentRole: 'system',
      agentName: 'HiveMind',
      content: '⚖️ Running swarm consensus vote...',
    })

    const consensus = await runConsensus({
      goal,
      agentOutputs: agentOutputs as Record<string, string>,
    })

    store.addMessage({
      agentRole: 'consensus',
      agentName: 'Consensus',
      content: `${consensus.approved ? '✅' : '⚠️'} Consensus score: ${consensus.score}/100\n${consensus.reasoning}`,
      confidence: consensus.score,
      isApprovalGate: true,
    })

    // ── Step 6: Creator generates final output ───────────────
    if (consensus.approved) {
      try {
        store.setAgentStatus('creator', 'working')
        store.addMessage({
          agentRole: 'creator',
          agentName: 'Creator',
          content: '✨ Generating final output...',
        })

        const allContext = Object.entries(agentOutputs)
          .map(([r, o]) => `[${r.toUpperCase()}]: ${o}`)
          .join('\n\n')

        const creatorResult = await runAgent({
          role: 'creator',
          goal,
          context: allContext,
        })

        agentOutputs.creator = creatorResult.content
        store.setAgentStatus('creator', 'done')
        store.setAgentConfidence('creator', creatorResult.confidence)
        store.addMessage({
          agentRole: 'creator',
          agentName: 'Creator',
          content: creatorResult.content,
          confidence: creatorResult.confidence,
          modelUsed: creatorResult.modelUsed,
          reasoning: 'Synthesised all agent outputs into final deliverable.',
        })

        // Save to memory
        store.addMemory({
          type: 'decision',
          content: `Goal: ${goal}\nResult: ${creatorResult.content.slice(0, 300)}`,
          agentRole: 'creator',
          tags: [route.taskType, 'swarm-result'],
        })
      } catch (e) {
        store.setAgentStatus('creator', 'error')
      }
    }

    // ── Done ─────────────────────────────────────────────────
    set({
      isRunning: false,
      currentRun: {
        ...get().currentRun!,
        completedAt: Date.now(),
        status: 'completed',
      },
      agents: get().agents.map((a) =>
        a.status === 'working' || a.status === 'thinking'
          ? { ...a, status: 'idle' }
          : a
      ),
    })

    store.addMessage({
      agentRole: 'system',
      agentName: 'HiveMind',
      content: '🐝 Swarm run complete.',
    })
  },

  approveAction: async () => {
    get().addMessage({
      agentRole: 'system',
      agentName: 'HiveMind',
      content: '✅ Action approved by user. Executor proceeding...',
    })
  },
}))