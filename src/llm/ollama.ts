import { ChatOllama } from '@langchain/ollama';
import { LLMProvider } from './provider';

export class OllamaProvider implements LLMProvider {
  private model: ChatOllama;

  constructor(config: { model: string; baseUrl?: string }) {
    this.model = new ChatOllama({
      model: config.model,
      baseUrl: config.baseUrl || 'http://127.0.0.1:11434',
    });
  }

  async generate(prompt: string) {
    const res = await this.model.invoke(prompt);
    return res.content as string;
  }

  async *generateStreaming(prompt: string) {
    const stream = await this.model.stream(prompt);
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as string;
      }
    }
  }
}
