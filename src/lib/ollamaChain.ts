import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "@langchain/classic/chains";
import type { MemoryEntry } from "../types/agent";

const DEFAULT_MODEL = "llama2";
const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

export const makeOllamaChain = (
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  memoryContext?: MemoryEntry[]
) => {
  const llm = new Ollama({ model, baseUrl });

  const memorySection = memoryContext && memoryContext.length > 0
    ? `\n\nRelevant Memory Context:\n${memoryContext
        .map(entry => `[${entry.agentRole}] ${entry.content}`)
        .join('\n')}\n`
    : '';

  const prompt = new PromptTemplate({
    template:
      `You are HiveMind, an autonomous agent orchestration assistant. Respond clearly and concisely.${memorySection}\n\nInput:\n{input}\n`,
    inputVariables: ["input"],
  });
  return new LLMChain({ llm, prompt });
};

export const runOllamaPrompt = async (
  input: string,
  model?: string,
  memoryContext?: MemoryEntry[]
) => {
  const chain = makeOllamaChain(model || DEFAULT_MODEL, DEFAULT_BASE_URL, memoryContext);
  const output = await chain.call({ input });
  return (output as { text?: string }).text ?? "";
};
