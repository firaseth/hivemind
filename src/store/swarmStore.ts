import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {
  AgentMessage,
  AgentStatus,
  AgentRole,
  MemoryEntry,
  OllamaStatus,
  SwarmSession,
  SessionLog,
} from '../types/agent'
import { invoke } from '@tauri-apps/api/core'

// ============================================================================
// STATE SHAPE
// ============================================================================

export interface AgentState {
  role: AgentRole
  status: AgentStatus
  lastMessage?: string
}

export interface SwarmStoreState {
  currentSession: SwarmSession | null
  messages: AgentMessage[]
  isRunning: boolean
  consensusReached: boolean
  activeAgent: AgentRole | null
  error: string | null
  agents: Record<AgentRole, AgentState>
  sessionHistory: SwarmSession[]
  sessionLogs: SessionLog[]
  memoryEntries: MemoryEntry[]
  ollamaStatus: OllamaStatus
  selectedModel: string
  activeTab: 'swarm' | 'memory' | 'settings'
  viewMode: 'chat' | 'graph'
  showDecisionLog: boolean
}

export interface SwarmStoreActions {
  startSession: (sessionId: string, goal: string) => void
  endSession: (consensusReached: boolean) => void
  setCurrentSession: (session: SwarmSession | null) => void
  addMessage: (msg: AgentMessage) => void
  clearMessages: () => void
  setIsRunning: (running: boolean) => void
  setConsensusReached: (reached: boolean) => void
  setError: (error: string | null) => void
  setAgentStatus: (role: AgentRole, status: AgentStatus, lastMessage?: string) => void
  setActiveAgent: (role: AgentRole | null) => void
  pushSessionToHistory: (session: SwarmSession) => void
  pushSessionLog: (log: SessionLog) => void
  addMemoryEntry: (entry: MemoryEntry) => void
  setMemoryEntries: (entries: MemoryEntry[]) => void
  clearMemory: () => void
  setOllamaStatus: (status: OllamaStatus) => void
  setSelectedModel: (model: string) => void
  setActiveTab: (tab: 'swarm' | 'memory' | 'settings') => void
  setViewMode: (mode: 'chat' | 'graph') => void
  setShowDecisionLog: (show: boolean) => void
  executeSwarmAction: (goal: string) => Promise<void>
  approveAction: (actionId: string) => Promise<void>
  rejectAction: (actionId: string, reason: string) => Promise<void>
  updateMessage: (id: string, updates: Partial<AgentMessage>) => void
  resetSession: () => void
}

const AGENT_ROLES: AgentRole[] = ['planner', 'researcher', 'executor', 'critic', 'creator', 'memory']

const defaultAgents = (): Record<AgentRole, AgentState> =>
  Object.fromEntries(AGENT_ROLES.map((role) => [role, { role, status: 'idle' }])) as Record<AgentRole, AgentState>

const initialState: SwarmStoreState = {
  currentSession: null,
  messages: [],
  isRunning: false,
  consensusReached: false,
  activeAgent: null,
  error: null,
  agents: defaultAgents(),
  sessionHistory: [],
  sessionLogs: [],
  memoryEntries: [],
  ollamaStatus: {
    running: false,
    baseUrl: 'http://127.0.0.1:11434',
    models: [],
    selectedModel: 'qwen2.5:1.5b',
  },
  selectedModel: 'qwen2.5:1.5b',
  activeTab: 'swarm',
  viewMode: 'chat',
  showDecisionLog: false,
}

export const useSwarmStore = create<SwarmStoreState & SwarmStoreActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        startSession: (sessionId, goal) => {
          const now = Date.now()
          set({
            currentSession: {
              id: sessionId,
              goal: { id: sessionId, text: goal, createdAt: now, status: 'running' },
              messages: [],
              startedAt: now,
              consensusReached: false,
              approved: false,
            },
            messages: [],
            isRunning: true,
            consensusReached: false,
            error: null,
            agents: defaultAgents(),
          })
        },

        endSession: (consensusReached) => {
          const { currentSession, messages } = get()
          if (!currentSession) return
          const completed: SwarmSession = {
            ...currentSession,
            messages,
            consensusReached,
            completedAt: Date.now(),
            goal: { ...currentSession.goal, status: consensusReached ? 'done' : 'failed' },
          }
          set({
            currentSession: completed,
            isRunning: false,
            consensusReached,
            sessionHistory: [completed, ...get().sessionHistory],
            agents: defaultAgents(),
          })
        },

        setCurrentSession: (session) => set({ currentSession: session }),

        addMessage: (msg) =>
          set((s) => {
            const exists = s.messages.find((m) => m.id === msg.id)
            if (exists) return s
            return { messages: [...s.messages, msg] }
          }),

        updateMessage: (id, updates) =>
          set((s) => ({
            messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          })),

        clearMessages: () => set({ messages: [] }),

        setIsRunning: (running) => set({ isRunning: running }),
        setConsensusReached: (reached) => set({ consensusReached: reached }),
        setError: (error) => set({ error }),

        setAgentStatus: (role, status, lastMessage) =>
          set((s) => ({
            agents: { ...s.agents, [role]: { role, status, lastMessage } },
          })),

        setActiveAgent: (role) => set({ activeAgent: role }),

        pushSessionToHistory: (session) =>
          set((s) => ({ sessionHistory: [session, ...s.sessionHistory] })),

        pushSessionLog: (log) => set((s) => ({ sessionLogs: [log, ...s.sessionLogs] })),

        addMemoryEntry: (entry) => set((s) => ({ memoryEntries: [entry, ...s.memoryEntries] })),
        setMemoryEntries: (entries) => set({ memoryEntries: entries }),
        clearMemory: () => set({ memoryEntries: [] }),

        setOllamaStatus: (status) => set({ ollamaStatus: status }),
        setSelectedModel: (model) =>
          set((s) => ({
            selectedModel: model,
            ollamaStatus: { ...s.ollamaStatus, selectedModel: model },
          })),

        setActiveTab: (tab) => set({ activeTab: tab }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setShowDecisionLog: (show) => set({ showDecisionLog: show }),

        executeSwarmAction: async (goal) => {
          const sessionId = `swarm-${Date.now()}`
          get().startSession(sessionId, goal)
          try {
            try { await invoke('execute_agent_swarm', { goal }) } catch {}
            const { executeSwarm } = await import('../lib/orchestrator')
            const result = await executeSwarm({ goal, userApprovalRequired: true })
            set({ messages: result.messages, consensusReached: result.consensusReached, isRunning: false })
          } catch (err) {
            set({ error: err instanceof Error ? err.message : String(err), isRunning: false })
          }
        },

        approveAction: async (actionId) => {
          const session = get().currentSession
          if (!session) return
          try {
            await invoke('approve_swarm_action', { sessionId: session.id, actionId })
            set({ consensusReached: true })
          } catch (err) {
            set({ error: String(err) })
          }
        },

        rejectAction: async (actionId, reason) => {
          const session = get().currentSession
          if (!session) return
          try {
            await invoke('reject_swarm_action', { sessionId: session.id, actionId, reason })
            set({ consensusReached: false })
          } catch (err) {
            set({ error: String(err) })
          }
        },

        resetSession: () => set({
          currentSession: null,
          messages: [],
          isRunning: false,
          consensusReached: false,
          activeAgent: null,
          error: null,
          agents: defaultAgents(),
        }),
      }),
      {
        name: 'hivemind-swarm-store-v2',
        partialize: (s) => ({
          sessionHistory: s.sessionHistory,
          sessionLogs: s.sessionLogs,
          memoryEntries: s.memoryEntries,
          selectedModel: s.selectedModel,
          ollamaStatus: s.ollamaStatus,
          activeTab: s.activeTab,
          viewMode: s.viewMode,
        }),
      }
    ),
    { name: 'HiveMindSwarmStore' }
  )
)