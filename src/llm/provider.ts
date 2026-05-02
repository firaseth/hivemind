/**
 * 2.1 LLM Provider Abstraction
 * Defines the common interface for different inference backends.
 */

export interface LLMProvider {
  generate(prompt: string, options?: { maxTokens?: number }): Promise<string>;
  generateStreaming(prompt: string, options?: any): AsyncGenerator<string>;
}

export interface LLMProviderConfig {
  type: 'ollama' | 'openai' | 'llamacpp';
  endpoint?: string;
  model: string;
}
