# HiveMind Dynamic Orchestration Upgrade

This plan executes the four‑phase evolution described in the architectural review.  
Each section lists **files to create** and **files to modify** with the necessary code and configuration.  
Target tech: TypeScript, React, Vite, Tauri 2.0, Rust, vitest, Zustand, LangChain.js, Ollama, MCP, Promptfoo, OpenTelemetry, libp2p (future).

---

## Phase 1 – Foundation (Tests, Multi‑Model, Error Recovery, CI/CD)

### ✅ 1.1 Testing Infrastructure
(Completed: Vitest setup, setup.ts, chains.test.ts, orchestrator.test.ts)

### ✅ 1.2 Multi-Model Support
(Completed: Refactored chains.ts and swarmStore.ts for per-agent models)

### ✅ 1.3 Robust Error Handling & Retry Logic
(Completed: Implement withRetry and Circuit Breaker)

---

## Phase 2 – Advanced Orchestration & Tooling

### ✅ 2.1 LLM Provider Abstraction
**Create:** `src/llm/provider.ts` (Completed)
**Create:** `src/llm/ollama.ts`
```ts
import { ChatOllama } from '@langchain/ollama';
import { LLMProvider } from './provider';

export class OllamaProvider implements LLMProvider {
  private model: ChatOllama;
  constructor(config: { model: string; baseUrl?: string }) {
    this.model = new ChatOllama({ model: config.model, baseUrl: config.baseUrl });
  }
  async generate(prompt: string) {
    const res = await this.model.invoke(prompt);
    return res.content as string;
  }
  async *generateStreaming(prompt: string) {
    const stream = await this.model.stream(prompt);
    for await (const chunk of stream) {
      yield chunk.content as string;
    }
  }
}
```
**Modify:** `src/lib/chains.ts` to accept any `LLMProvider` instead of hardcoding `ChatOllama`.

### ✅ 2.2 External Tool Integration via MCP
**Create:** `src/tools/mcpClient.ts` – a minimal MCP client.
**Implement:** `ToolRegistry`.
```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function loadMCPTools(): Promise<any[]> {
  const transport = new StdioClientTransport({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-web-search'] });
  const client = new Client({ name: 'hivemind', version: '1.0' }, { capabilities: {} });
  await client.connect(transport);
  return client.listTools();
}
```
**Modify:** Agent chains to receive available tools.

### ✅ 2.3 Documentation Upgrade
**Create:** `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/CUSTOM_AGENTS.md`.

---

## Phase 3 – Production Readiness (Evals, Observability, Benchmarks)

### ✅ 3.1 Evaluation Framework (Promptfoo)
**Create:** `eval/promptfooconfig.yaml`
**Add npm script:** `"evals": "promptfoo eval"`.

### ✅ 3.2 Observability (OpenTelemetry)
**Create:** `src/observability/tracing.ts`.
**Modify:** Orchestrator to create spans for each agent execution.

### ✅ 3.3 Performance Benchmarks
**Create:** `benchmarks/swarm-bench.ts`.

---

## Phase 4 – Scaling & Ecosystem (libp2p, Multi‑User, Plugins)

### ✅ 4.1 Distributed Swarm Execution (libp2p)
**Create:** `src/p2p/node.ts`, `src/p2p/swarmProtocol.ts`.

### ✅ 4.2 Multi‑User Support
**Create:** `src/auth/userService.ts`.

### ✅ 4.3 Plugin Ecosystem
**Create:** `src/plugins/registry.ts`.

---

## Final Integration Steps
1. Update all imports to use new abstractions.
2. Update Tauri Rust backend if needed.
3. Add new npm dependencies.
