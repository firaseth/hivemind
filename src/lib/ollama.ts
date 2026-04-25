import axios from 'axios'
import type { OllamaModel, OllamaStatus } from '../types/agent'

// ============================================================================
// OLLAMA CLIENT — Direct HTTP interface to local Ollama server
// ============================================================================

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'gemma2:9b'

export interface OllamaGenerateOptions {
  model?: string
  baseUrl?: string
  system?: string
  temperature?: number
  stream?: boolean
  contextWindow?: number
}

export interface OllamaGenerateResult {
  content: string
  model: string
  durationMs: number
  promptTokens?: number
  evalTokens?: number
}

// ============================================================================
// CORE: Generate a completion
// ============================================================================

export const ollamaGenerate = async (
  prompt: string,
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const {
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    system,
    temperature = 0.7,
  } = options

  const startMs = Date.now()

  const payload: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    options: { temperature },
  }

  if (system) {
    payload.system = system
  }

  const response = await axios.post(`${baseUrl}/api/generate`, payload, {
    timeout: 120_000,
  })

  const data = response.data as {
    response: string
    model: string
    prompt_eval_count?: number
    eval_count?: number
  }

  return {
    content: data.response,
    model: data.model,
    durationMs: Date.now() - startMs,
    promptTokens: data.prompt_eval_count,
    evalTokens: data.eval_count,
  }
}

// ============================================================================
// CORE: Chat completion (messages API)
// ============================================================================

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const ollamaChat = async (
  messages: OllamaChatMessage[],
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const {
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    temperature = 0.7,
  } = options

  const startMs = Date.now()

  const response = await axios.post(
    `${baseUrl}/api/chat`,
    { model, messages, stream: false, options: { temperature } },
    { timeout: 120_000 }
  )

  const data = response.data as {
    message: { content: string }
    model: string
    prompt_eval_count?: number
    eval_count?: number
  }

  return {
    content: data.message.content,
    model: data.model,
    durationMs: Date.now() - startMs,
    promptTokens: data.prompt_eval_count,
    evalTokens: data.eval_count,
  }
}

// ============================================================================
// HEALTH & MODEL MANAGEMENT
// ============================================================================

export const checkOllamaHealth = async (
  baseUrl = DEFAULT_BASE_URL
): Promise<boolean> => {
  try {
    const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 5_000 })
    return res.status === 200
  } catch {
    return false
  }
}

export const listOllamaModels = async (
  baseUrl = DEFAULT_BASE_URL
): Promise<OllamaModel[]> => {
  try {
    const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 5_000 })
    const data = res.data as { models: OllamaModel[] }
    return data.models ?? []
  } catch {
    return []
  }
}

export const getOllamaStatus = async (
  baseUrl = DEFAULT_BASE_URL,
  selectedModel = DEFAULT_MODEL
): Promise<OllamaStatus> => {
  const running = await checkOllamaHealth(baseUrl)
  const models = running ? await listOllamaModels(baseUrl) : []
  return { running, baseUrl, models, selectedModel }
}

// ============================================================================
// AGENT HELPER: Run a single agent prompt with system persona
// ============================================================================

export const runAgentPrompt = async (
  systemPrompt: string,
  userPrompt: string,
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const messages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  return ollamaChat(messages, options)
}

export { DEFAULT_MODEL, DEFAULT_BASE_URL }
