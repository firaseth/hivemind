// ============================================================================
// AGENT TYPES — HiveMind
// ============================================================================

export type AgentRole =
  | 'planner'
  | 'researcher'
  | 'executor'
  | 'critic'
  | 'creator'
  | 'memory'
  | 'user'
  | 'system'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'done' | 'error'

export type MessageType = 'thought' | 'output' | 'critique' | 'vote' | 'error'

// ============================================================================
// MESSAGES
// ============================================================================

export interface AgentMessage {
  id: string
  agentRole: AgentRole
  content: string
  timestamp: number
  type: MessageType
  confidence?: number
  sessionId?: string
}

// ============================================================================
// AGENT CONFIG
// ============================================================================

export interface AgentPersona {
  role: AgentRole
  name: string
  description: string
  model: string
  systemPrompt: string
  color: string
  accent: string
}

export interface AgentConfig {
  id: string
  persona: AgentPersona
  status: AgentStatus
  memoryEnabled: boolean
  toolset: string[]
  createdAt: number
}

export interface AgentChainConfig {
  id: string
  label: string
  model: string
  systemPrompt: string
  promptTemplate: string
  memoryConfig?: MemoryPersistenceConfig
  vectorStoreConfig?: VectorStoreConfig
}

// ============================================================================
// MEMORY & VECTOR STORE
// ============================================================================

export interface VectorStoreConfig {
  provider: 'chroma'
  collectionName: string
  embeddingModel: string
}

export interface MemoryPersistenceConfig {
  provider: 'sqlite' | 'local'
  databaseFile: string
  tableName: string
}

export interface VectorStoreEntry {
  id: string
  text: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export interface MemoryEntry {
  id: string
  content: string
  agentRole: AgentRole
  tags: string[]
  projectId?: string
  timestamp: number
  embedding?: number[]
}

// ============================================================================
// SWARM SESSION
// ============================================================================

export type SwarmGoalStatus = 'pending' | 'running' | 'approved' | 'done' | 'failed'

export interface SwarmGoal {
  id: string
  text: string
  createdAt: number
  status: SwarmGoalStatus
}

export interface SwarmSession {
  id: string
  goal: SwarmGoal
  messages: AgentMessage[]
  startedAt: number
  completedAt?: number
  consensusReached: boolean
  approved: boolean
  decisionLog?: DecisionRecord[]
}

// ============================================================================
// DECISIONS & AUDIT
// ============================================================================

export interface DecisionRecord {
  id: string
  action: string
  model: string
  confidence: number
  reasoning: string
  timestamp: number
  agentRole?: AgentRole
  memoryUsed?: string[]
}

export interface SessionLog {
  sessionId: string
  goal: string
  agentOutputs: Record<string, string>
  consensusScore: number
  consensusReached: boolean
  recommendedAction: string
  timestamp: number
  durationMs: number
}

// ============================================================================
// GRAPH TOPOLOGY
// ============================================================================

export interface AgentGraphNode {
  id: string
  agentId: string
  role: AgentRole
  nextIds: string[]
}

// ============================================================================
// OLLAMA MODEL INFO
// ============================================================================

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modifiedAt: string
  details?: {
    format: string
    family: string
    parameterSize: string
    quantizationLevel: string
  }
}

export interface OllamaStatus {
  running: boolean
  baseUrl: string
  models: OllamaModel[]
  selectedModel: string
  error?: string
}
