# 🐝 Guide to Custom Agents

Adding a new persona to the HiveMind swarm is straightforward.

## 1. Define the Persona
Edit `src/lib/chains.ts` and add a new entry to the `AGENT_PERSONAS` object.

```ts
export const AGENT_PERSONAS = {
  // ...
  coder: {
    role: "coder",
    name: "Software Engineer",
    description: "Expert in writing clean, performant code",
    model: "qwen2.5-coder:7b",
    systemPrompt: "You are an expert coder...",
    color: "#D1E9FF",
    accent: "#0078D4",
  }
}
```

## 2. Update Types
If you add a new role, ensure it's reflected in `src/types/agent.ts`.

```ts
export type AgentRole = 'planner' | 'researcher' | 'coder' | ...;
```

## 3. Register in Store
Ensure the new role has a default model in `src/store/swarmStore.ts`.

## 4. Update Orchestrator
Add the new agent to the parallel execution block in `executeSwarm`.
