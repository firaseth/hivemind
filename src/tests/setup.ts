import { vi } from 'vitest';

// Global mocks for external services
vi.mock('../lib/ollama', () => ({
  runAgentPrompt: vi.fn(),
  runAgentPromptStreaming: vi.fn(),
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(),
}));

console.log('Vitest setup with mocks initialized');
