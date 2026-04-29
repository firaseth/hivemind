import axios from 'axios'
import type { OllamaModel, OllamaStatus } from '../types/agent'

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'qwen2.5:1.5b'

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

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ============================================================================
// Non-streaming chat
// ============================================================================

export const ollamaChat = async (
  messages: OllamaChatMessage[],
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const { model = DEFAULT_MODEL, baseUrl = DEFAULT_BASE_URL, temperature = 0.7 } = options
  const startMs = Date.now()

  const response = await axios.post(
    `${baseUrl}/api/chat`,
    { model, messages, stream: false, options: { temperature, num_ctx: 512 } },
    { timeout: 250_000 }
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
// ⚡ STREAMING chat — token by token via fetch ReadableStream
// ============================================================================

export const ollamaChatStream = async (
  messages: OllamaChatMessage[],
  options: OllamaGenerateOptions & {
    onToken: (token: string) => void
    onDone?: (fullContent: string) => void
  }
): Promise<OllamaGenerateResult> => {
  const {
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    temperature = 0.7,
    onToken,
    onDone,
  } = options

  const startMs = Date.now()
  let fullContent = ''

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { temperature, num_ctx: 512 },
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Ollama stream failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as {
          message?: { content: string }
          done: boolean
        }
        if (parsed.message?.content) {
          fullContent += parsed.message.content
          onToken(parsed.message.content)
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  onDone?.(fullContent)

  return { content: fullContent, model, durationMs: Date.now() - startMs }
}

// ============================================================================
// Non-streaming generate
// ============================================================================

export const ollamaGenerate = async (
  prompt: string,
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const { model = DEFAULT_MODEL, baseUrl = DEFAULT_BASE_URL, system, temperature = 0.7 } = options
  const startMs = Date.now()

  const payload: Record<string, unknown> = {
    model, prompt, stream: false, options: { temperature },
  }
  if (system) payload.system = system

  const response = await axios.post(`${baseUrl}/api/generate`, payload, { timeout: 250_000 })
  const data = response.data as {
    response: string; model: string; prompt_eval_count?: number; eval_count?: number
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
// Health & model management
// ============================================================================

export const checkOllamaHealth = async (baseUrl = DEFAULT_BASE_URL): Promise<boolean> => {
  try {
    const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 5_000 })
    return res.status === 200
  } catch { return false }
}

export const listOllamaModels = async (baseUrl = DEFAULT_BASE_URL): Promise<OllamaModel[]> => {
  try {
    const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 5_000 })
    const data = res.data as { models: OllamaModel[] }
    return data.models ?? []
  } catch { return [] }
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
// ⚡ Streaming agent prompt — live token callback
// ============================================================================

export const runAgentPromptStreaming = async (
  systemPrompt: string,
  userPrompt: string,
  onToken: (token: string) => void,
  onDone: (fullContent: string) => void,
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const messages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  return ollamaChatStream(messages, { ...options, contextWindow: 512, onToken, onDone })
}

// Non-streaming fallback
export const runAgentPrompt = async (
  systemPrompt: string,
  userPrompt: string,
  options: OllamaGenerateOptions = {}
): Promise<OllamaGenerateResult> => {
  const messages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  return ollamaChat(messages, { ...options, contextWindow: 512 })
}

export { DEFAULT_MODEL, DEFAULT_BASE_URL }