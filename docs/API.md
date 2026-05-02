# 📖 HiveMind API Documentation

## Orchestration

### `executeSwarm(config: SwarmExecutionConfig): Promise<SwarmExecutionResult>`
The main entry point for starting a swarm session.
- **Config**: Goal, language, model overrides, etc.
- **Returns**: Session ID, messages, and consensus result.

## LLM Providers

### `LLMProvider` (Interface)
- `generate(prompt: string): Promise<string>`
- `generateStreaming(prompt: string): AsyncGenerator<string>`

### `OllamaProvider`
Implementation for local Ollama models.

## Tools

### `loadMCPTools(): Promise<Tool[]>`
Dynamically loads tools from MCP servers.

## Store (Zustand)

### `useSwarmStore`
The central state management store for the frontend.
- `startSession(id, goal)`
- `addMessage(msg)`
- `setAgentModel(role, model)`
