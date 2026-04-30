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
  // ── Active session ──────────────────────────────────────────────────
  currentSession: SwarmSession | null
  messages: AgentMessage[]
  isRunning: boolean
  consensusReached: boolean
  activeAgent: AgentRole | null
  error: string | null

  // ── Agent status grid ───────────────────────────────────────────────
  agents: Record<AgentRole, AgentState>

  // ── History ─────────────────────────────────────────────────────────
  sessionHistory: SwarmSession[]
  sessionLogs: SessionLog[]

  // ── Memory ──────────────────────────────────────────────────────────
  memoryEntries: MemoryEntry[]

  // ── Ollama ──────────────────────────────────────────────────────────
  ollamaStatus: OllamaStatus
  selectedModel: string

  // ── UI preferences ──────────────────────────────────────────────────
  activeTab: 'swarm' | 'memory' | 'settings'
  viewMode: 'chat' | 'graph'
  showDecisionLog: boolean
  language: string
  recipientEmail: string
}

// ============================================================================
// ACTIONS
// ============================================================================

export interface SwarmStoreActions {
  // Session
  startSession: (sessionId: string, goal: string) => void
  endSession: (consensusReached: boolean) => void
  setCurrentSession: (session: SwarmSession | null) => void

  // Messages
  addMessage: (msg: AgentMessage) => void
  updateMessage: (id: string, updates: Partial<AgentMessage>) => void
  clearMessages: () => void

  // Running state
  setIsRunning: (running: boolean) => void
  setConsensusReached: (reached: boolean) => void
  setError: (error: string | null) => void

  // Agent status
  setAgentStatus: (role: AgentRole, status: AgentStatus, lastMessage?: string) => void
  setActiveAgent: (role: AgentRole | null) => void

  // History & logs
  pushSessionToHistory: (session: SwarmSession) => void
  pushSessionLog: (log: SessionLog) => void

  // Memory
  addMemoryEntry: (entry: MemoryEntry) => void
  setMemoryEntries: (entries: MemoryEntry[]) => void
  clearMemory: () => void

  // Ollama
  setOllamaStatus: (status: OllamaStatus) => void
  setSelectedModel: (model: string) => void

  // UI
  setActiveTab: (tab: 'swarm' | 'memory' | 'settings') => void
  setViewMode: (mode: 'chat' | 'graph') => void
  setShowDecisionLog: (show: boolean) => void
  setLanguage: (lang: string) => void
  setRecipientEmail: (email: string) => void

  // Orchestration
  executeSwarmAction: (goal: string) => Promise<void>
  approveAction: (actionId: string) => Promise<void>
  rejectAction: (actionId: string, reason: string) => Promise<void>

  // Reset
  resetSession: () => void
}

// ============================================================================
// DEFAULT AGENT STATES
// ============================================================================

const AGENT_ROLES: AgentRole[] = [
  'planner', 'researcher', 'executor', 'critic', 'creator', 'memory',
]

const defaultAgents = (): Record<AgentRole, AgentState> =>
  Object.fromEntries(
    AGENT_ROLES.map((role) => [role, { role, status: 'idle' }])
  ) as Record<AgentRole, AgentState>

// ============================================================================
// INITIAL STATE
// ============================================================================

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
  language: 'English',
  recipientEmail: '',
}

// ============================================================================
// STORE
// ============================================================================

export const useSwarmStore = create<SwarmStoreState & SwarmStoreActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ── Session ─────────────────────────────────────────────────
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
            goal: {
              ...currentSession.goal,
              status: consensusReached ? 'done' : 'failed',
            },
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

        // ── Messages ─────────────────────────────────────────────────
        addMessage: (msg) =>
          set((s) => {
            if (s.messages.some((m) => m.id === msg.id)) return s
            return { messages: [...s.messages, msg] }
          }),

        updateMessage: (id, updates) =>
          set((s) => ({
            messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          })),

        clearMessages: () => set({ messages: [] }),

        // ── Running state ─────────────────────────────────────────────
        setIsRunning: (running) => set({ isRunning: running }),
        setConsensusReached: (reached) => set({ consensusReached: reached }),
        setError: (error) => set({ error }),

        // ── Agent status ──────────────────────────────────────────────
        setAgentStatus: (role, status, lastMessage) =>
          set((s) => ({
            agents: {
              ...s.agents,
              [role]: { role, status, lastMessage },
            },
          })),

        setActiveAgent: (role) => set({ activeAgent: role }),

        // ── History & logs ────────────────────────────────────────────
        pushSessionToHistory: (session) =>
          set((s) => ({ sessionHistory: [session, ...s.sessionHistory] })),

        pushSessionLog: (log) =>
          set((s) => ({ sessionLogs: [log, ...s.sessionLogs] })),

        // ── Memory ────────────────────────────────────────────────────
        addMemoryEntry: (entry) =>
          set((s) => ({ memoryEntries: [entry, ...s.memoryEntries] })),

        setMemoryEntries: (entries) => set({ memoryEntries: entries }),

        clearMemory: () => set({ memoryEntries: [] }),

        // ── Ollama ────────────────────────────────────────────────────
        setOllamaStatus: (status) => set({ ollamaStatus: status }),
        setSelectedModel: (model) =>
          set((s) => ({
            selectedModel: model,
            ollamaStatus: { ...s.ollamaStatus, selectedModel: model },
          })),

        // ── UI ────────────────────────────────────────────────────────
        setActiveTab: (tab) => set({ activeTab: tab }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setShowDecisionLog: (show) => set({ showDecisionLog: show }),
        setLanguage: (lang) => set({ language: lang }),
        setRecipientEmail: (email) => set({ recipientEmail: email }),

        // ── Orchestration ───────────────────────────────────────────
        executeSwarmAction: async (goal) => {
          const sessionId = `swarm-${Date.now()}`;
          get().startSession(sessionId, goal);
          
          try {
            // Signal Tauri backend if needed
            try { await invoke('execute_agent_swarm', { goal }); } catch {}

            // Load orchestrator dynamically to keep boot-time lean
            const { executeSwarm: runSwarmLogic } = await import('../lib/orchestrator');

            const result = await runSwarmLogic({
              goal,
              language: get().language,
              model: get().selectedModel,
              userApprovalRequired: true,
            });

            set({
              messages: result.messages,
              consensusReached: result.consensusReached,
              isRunning: false,
            });
          } catch (err) {
            set({ 
              error: err instanceof Error ? err.message : String(err),
              isRunning: false 
            });
          }
        },

        approveAction: async (actionId) => {
          const session = get().currentSession;
          if (!session) return;
          try {
            await invoke('approve_swarm_action', { sessionId: session.id, actionId });
            
            // Add a concluding system message
            get().addMessage({
              id: `system-${Date.now()}`,
              agentRole: 'system',
              content: '✅ Mission approved and executed. The hive has completed its task.',
              timestamp: Date.now(),
              type: 'output',
              confidence: 100
            });

            // Mark session as done
            get().endSession(true);
            set({ consensusReached: false }); // Hide the gate
          } catch (err) {
            set({ error: String(err) });
          }
        },

        rejectAction: async (actionId, reason) => {
          const session = get().currentSession;
          if (!session) return;
          try {
            await invoke('reject_swarm_action', { sessionId: session.id, actionId, reason });
            
            get().addMessage({
              id: `system-${Date.now()}`,
              agentRole: 'system',
              content: `❌ Plan rejected. Reason: ${reason}`,
              timestamp: Date.now(),
              type: 'error',
            });

            get().endSession(false);
            set({ consensusReached: false }); // Hide the gate
          } catch (err) {
            set({ error: String(err) });
          }
        },

        // ── Reset ─────────────────────────────────────────────────────
        resetSession: () =>
          set({
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
        // Only persist history, memory, and user prefs — not running session state
        partialize: (s) => ({
          sessionHistory: s.sessionHistory,
          sessionLogs: s.sessionLogs,
          memoryEntries: s.memoryEntries,
          selectedModel: s.selectedModel,
          ollamaStatus: s.ollamaStatus,
          activeTab: s.activeTab,
          viewMode: s.viewMode,
          language: s.language,
          recipientEmail: s.recipientEmail,
        }),
      }
    ),
    { name: 'HiveMindSwarmStore' }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const selectIsRunning = (s: SwarmStoreState) => s.isRunning
export const selectMessages = (s: SwarmStoreState) => s.messages
export const selectAgents = (s: SwarmStoreState) => s.agents
export const selectCurrentSession = (s: SwarmStoreState) => s.currentSession
export const selectMemoryEntries = (s: SwarmStoreState) => s.memoryEntries
export const selectOllamaStatus = (s: SwarmStoreState) => s.ollamaStatus
export const selectSessionHistory = (s: SwarmStoreState) => s.sessionHistory
