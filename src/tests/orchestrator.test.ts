import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSwarm } from '../lib/orchestrator';
import { OllamaProvider } from '../llm/ollama';

// Mocking the chains module
vi.mock('../lib/chains', async () => {
  const actual = await vi.importActual('../lib/chains');
  return {
    ...actual as any,
    brainRouter: vi.fn().mockResolvedValue({ selectedModel: 'qwen2.5:1.5b' }),
    runConsensusVote: vi.fn().mockResolvedValue({ 
      consensus: true, 
      agreementScore: 85, 
      recommendedAction: 'Proceed', 
      reasoning: 'Test' 
    }),
  };
});

// Mocking MCP Tools
vi.mock('../tools/mcpClient', () => ({
  loadMCPTools: vi.fn().mockResolvedValue([{ name: 'web-search', description: 'test', inputSchema: {} }]),
  globalToolRegistry: {
    register: vi.fn(),
    getAllTools: vi.fn().mockReturnValue([]),
  }
}));

// Mocking OllamaProvider
vi.mock('../llm/ollama', () => {
  return {
    OllamaProvider: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue('Test content [CONFIDENCE: 90]'),
      generateStreaming: async function* () {
        yield 'Test ';
        yield 'token ';
        yield '[CONFIDENCE: 90]';
      }
    }))
  };
});

describe('Swarm orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute swarm successfully with mocked provider', async () => {
    const result = await executeSwarm({
      goal: 'test goal',
      model: 'tiny-model',
    });

    expect(result.sessionId).toBeDefined();
    expect(result.consensusReached).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
  });
});
