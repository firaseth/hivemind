export type AgentRole =
  | 'planner'
  | 'researcher'
  | 'executor'
  | 'critic'
  | 'creator'
  | 'memory'
  | 'user'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'done' | 'error'

export interface AgentMessage {
  id: string
  agentRole: AgentRole
  content: string
  timestamp: number
  type: 'thought' | 'output' | 'critique' | 'vote'
  confidence?: number
}

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

export interface SwarmGoal {
  id: string
  text: string
  createdAt: number
  status: 'pending' | 'running' | 'approved' | 'done' | 'failed'
}

export interface SwarmSession {
  id: string
  goal: SwarmGoal
  messages: AgentMessage[]
  startedAt: number
  consensusReached: boolean
  approved: boolean
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

export interface DecisionRecord {
  id: string
  action: string
  model: string
  confidence: number
  reasoning: string
  timestamp: number
}

export interface AgentGraphNode {
  id: string
  agentId: string
  role: AgentRole
  nextIds: string[]
}
