import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AgentMessage, SwarmSession, MemoryEntry } from '../types/agent';
import { executeSwarm } from '../lib/orchestrator';

interface UseSwarmOrchestrationOptions {
  autoStartOllama?: boolean;
  memoryContext?: MemoryEntry[];
  projectId?: string;
}

export const useSwarmOrchestration = (options?: UseSwarmOrchestrationOptions) => {
  const [session, setSession] = useState<SwarmSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [consensusReached, setConsensusReached] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SwarmSession[]>([]);

  // Initialize Ollama on mount if requested
  useEffect(() => {
    if (options?.autoStartOllama) {
      startOllama();
    }
  }, [options?.autoStartOllama]);

  // Listen for swarm events from Tauri
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    (async () => {
      try {
        // Listen for swarm started event
        unlisteners.push(
          await listen<any>('swarm_started', (event) => {
            console.log('[HiveChat] Swarm started:', event.payload);
            setSession({
              id: event.payload.sessionId,
              goal: {
                id: event.payload.sessionId,
                text: event.payload.goal,
                createdAt: event.payload.timestamp,
                status: 'running',
              },
              messages: [],
              startedAt: event.payload.timestamp,
              consensusReached: false,
              approved: false,
            });
            setMessages([]);
            setIsRunning(true);
            setConsensusReached(false);
          })
        );

        // Listen for agent message event
        unlisteners.push(
          await listen<AgentMessage>('agent_message', (event) => {
            console.log('[HiveChat] Agent message:', event.payload);
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === event.payload.id)) return prev;
              return [...prev, event.payload];
            });
          })
        );

        // Listen for agent status event
        unlisteners.push(
          await listen<any>('agent_status', (event) => {
            console.log('[HiveChat] Agent status:', event.payload);
            if (event.payload.status === 'working') {
              setActiveAgent(event.payload.role);
            } else {
              setActiveAgent(undefined);
            }
          })
        );

        // Listen for consensus reached event
        unlisteners.push(
          await listen<any>('consensus_reached', (event) => {
            console.log('[HiveChat] Consensus reached:', event.payload);
            setIsRunning(false);
            setConsensusReached(true);
            setSession(prev =>
              prev ? {
                ...prev,
                consensusReached: true,
              } : null
            );
          })
        );

        // Listen for swarm error event
        unlisteners.push(
          await listen<any>('swarm_error', (event) => {
            console.error('[HiveChat] Swarm error:', event.payload);
            setError(event.payload.message);
            setIsRunning(false);
          })
        );
      } catch (err) {
        console.error('[HiveChat] Failed to set up event listeners:', err);
      }
    })();

    return () => {
      unlisteners.forEach(unlisten => unlisten());
    };
  }, []);

  // Start Ollama service
  const startOllama = useCallback(async () => {
    try {
      const result = await invoke<string>('start_ollama', { port: 11434 });
      console.log('[HiveChat] Ollama:', result);
    } catch (err) {
      console.error('[HiveChat] Failed to start Ollama:', err);
      setError(`Failed to start Ollama: \${err}`);
    }
  }, []);

  // Check Ollama status
  const checkOllamaStatus = useCallback(async () => {
    try {
      const status = await invoke<string>('ollama_status');
      return status === 'running';
    } catch (err) {
      console.error('[HiveChat] Failed to check Ollama status:', err);
      return false;
    }
  }, []);

  // Execute swarm orchestration
  const executeSwarmSession = useCallback(
    async (goal: string) => {
      try {
        setError(null);
        setIsRunning(true);
        setConsensusReached(false);

        // Check if Ollama is running
        const ollamaRunning = await checkOllamaStatus();
        if (!ollamaRunning) {
          await startOllama();
          // Wait for Ollama to start
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Call Tauri command to start swarm
        const sessionId = await invoke<string>('execute_agent_swarm', {
          goal,
          projectId: options?.projectId,
        });

        console.log('[HiveChat] Swarm session started:', sessionId);

        // The actual orchestration happens in TypeScript/Node
        // Call the orchestrator directly
        const result = await executeSwarm({
          goal,
          projectId: options?.projectId,
          memoryContext: options?.memoryContext,
          userApprovalRequired: true,
        });

        // Update state with results
        setMessages(result.messages);
        setConsensusReached(result.consensusReached);
        setIsRunning(false);

        // Create session object
        const newSession: SwarmSession = {
          id: result.sessionId,
          goal: {
            id: result.sessionId,
            text: goal,
            createdAt: Date.now(),
            status: result.consensusReached ? 'approved' : 'running',
          },
          messages: result.messages,
          startedAt: Date.now(),
          consensusReached: result.consensusReached,
          approved: false,
        };

        setSession(newSession);
        setSessionHistory(prev => [newSession, ...prev]);

        // Save session to memory
        if (options?.projectId) {
          await saveSessionToMemory(newSession);
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[HiveChat] Swarm execution failed:', err);
        setError(errorMsg);
        setIsRunning(false);
        throw err;
      }
    },
    [options?.projectId, options?.memoryContext, checkOllamaStatus, startOllama]
  );

  // Save session to memory
  const saveSessionToMemory = useCallback(async (sess: SwarmSession) => {
    try {
      const entry = {
        id: `session-\${sess.id}`,
        content: `Session: \${sess.goal.text}`,
        agentRole: 'system' as const,
        tags: ['session', 'project'],
        projectId: options?.projectId,
        timestamp: Date.now(),
      };
      await invoke('save_memory_entry', { entry });
    } catch (err) {
      console.error('[HiveChat] Failed to save session to memory:', err);
    }
  }, [options?.projectId]);

  // Approve swarm action
  const approveAction = useCallback(async (actionId: string) => {
    try {
      if (!session) return;
      await invoke('approve_swarm_action', {
        sessionId: session.id,
        actionId,
      });
      setSession(prev =>
        prev ? { ...prev, approved: true } : null
      );
    } catch (err) {
      console.error('[HiveChat] Failed to approve action:', err);
      setError(`Failed to approve action: \${err}`);
    }
  }, [session]);

  // Reject swarm action
  const rejectAction = useCallback(async (actionId: string, reason: string) => {
    try {
      if (!session) return;
      await invoke('reject_swarm_action', {
        sessionId: session.id,
        actionId,
        reason,
      });
      setSession(prev =>
        prev ? { ...prev, approved: false } : null
      );
    } catch (err) {
      console.error('[HiveChat] Failed to reject action:', err);
      setError(`Failed to reject action: \${err}`);
    }
  }, [session]);

  // Get decision log for transparency
  const getDecisionLog = useCallback(async (limit?: number) => {
    try {
      if (!session) return [];
      const log = await invoke<any[]>('get_decision_log', {
        sessionId: session.id,
        limit: limit || 10,
      });
      return log;
    } catch (err) {
      console.error('[HiveChat] Failed to get decision log:', err);
      return [];
    }
  }, [session]);

  return {
    // State
    session,
    messages,
    isRunning,
    consensusReached,
    activeAgent,
    error,
    sessionHistory,

    // Actions
    executeSwarm: executeSwarmSession,
    approveAction,
    rejectAction,
    getDecisionLog,
    startOllama,
    checkOllamaStatus,
  };
};

export default useSwarmOrchestration;
