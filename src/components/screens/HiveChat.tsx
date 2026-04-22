import React, { useEffect, useState, useRef } from 'react';
import { AgentMessage } from '../../types/agent';
import { useSwarmOrchestration } from '../../hooks/useSwarmOrchestration';
import '../../styles/HiveChat.css';

interface HiveChatProps {
  sessionId?: string;
  onApproval?: (actionId: string) => void;
  onRejection?: (actionId: string, reason: string) => void;
}

export const HiveChat: React.FC<HiveChatProps> = ({ sessionId, onApproval, onRejection }) => {
  const {
    session,
    messages,
    isRunning,
    consensusReached,
    executeSwarm,
    approveAction,
    rejectAction,
  } = useSwarmOrchestration();

  const [goalInput, setGoalInput] = useState('');
  const [showReplayLog, setShowReplayLog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLaunchSwarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;

    await executeSwarm(goalInput);
    setGoalInput('');
  };

  const getAgentColor = (role: string) => {
    const colors: Record<string, string> = {
      planner: '#185FA5',
      researcher: '#0F6E56',
      executor: '#3B6D11',
      critic: '#BA7517',
      creator: '#993C1D',
      memory: '#993556',
      system: '#5F5E5A',
      user: '#444441',
    };
    return colors[role] || '#5F5E5A';
  };

  const getAgentBgColor = (role: string) => {
    const bgColors: Record<string, string> = {
      planner: '#E6F1FB',
      researcher: '#E1F5EE',
      executor: '#EAF3DE',
      critic: '#FAEEDA',
      creator: '#FAECE7',
      memory: '#FBEAF0',
      system: '#F1EFE8',
      user: '#F1EFE8',
    };
    return bgColors[role] || '#F1EFE8';
  };

  return (
    <div className="hivechat-container">
      {/* Header */}
      <div className="hivechat-header">
        <div className="hivechat-header-left">
          <h2>HiveMind Swarm</h2>
          <div className="status-indicator">
            <span className={`status-dot \${isRunning ? 'active' : 'idle'}`}></span>
            <span className="status-text">
              {isRunning ? 'Thinking...' : consensusReached ? 'Consensus Reached' : 'Ready'}
            </span>
          </div>
        </div>
        <div className="hivechat-header-right">
          <button 
            className="replay-btn"
            onClick={() => setShowReplayLog(!showReplayLog)}
            title="View decision transparency log"
          >
            📋 Decision Replay
          </button>
        </div>
      </div>

      {/* Decision Replay Log */}
      {showReplayLog && (
        <div className="decision-replay-panel">
          <h3>Decision Transparency Log</h3>
          {session?.messages
            .filter(m => m.type === 'output')
            .map(msg => (
              <div key={msg.id} className="decision-item">
                <div className="decision-header">
                  <span className="decision-action">
                    {msg.agentRole}: {msg.content.substring(0, 60)}...
                  </span>
                  <span className="decision-confidence">
                    {msg.confidence}% confident
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="hivechat-messages">
        {messages.length === 0 && !isRunning && (
          <div className="empty-state">
            <p>🐝 HiveMind is ready</p>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Give your hive a goal and watch the agents debate, critique, and reach consensus.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className="message"
            style={{
              backgroundColor: getAgentBgColor(msg.agentRole),
              borderLeftColor: getAgentColor(msg.agentRole),
            }}
          >
            <div className="message-header">
              <div className="agent-badge" style={{ color: getAgentColor(msg.agentRole) }}>
                {msg.agentRole.charAt(0).toUpperCase() + msg.agentRole.slice(1)}
              </div>
              <div className="message-meta">
                <span className="message-type">{msg.type}</span>
                {msg.confidence && (
                  <span className="confidence-badge">{msg.confidence}%</span>
                )}
              </div>
              <span className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {msg.content}
            </div>
          </div>
        ))}

        {isRunning && (
          <div className="message thinking">
            <div className="agent-badge">🤖</div>
            <div className="thinking-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Approval Gate */}
      {consensusReached && !isRunning && (
        <div className="approval-gate">
          <div className="approval-content">
            <h3>✓ Consensus Reached</h3>
            <p>The swarm has evaluated the goal and reached agreement. Review above and approve to proceed.</p>
            <div className="approval-buttons">
              <button
                className="btn-approve"
                onClick={() => onApproval?.('auto-action-1')}
              >
                ✓ Approve & Execute
              </button>
              <button
                className="btn-reject"
                onClick={() => onRejection?.('auto-action-1', 'User requested revision')}
              >
                ✗ Revise Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <form className="hivechat-input-form" onSubmit={handleLaunchSwarm}>
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Give your hive a goal…"
            value={goalInput}
            onChange={e => setGoalInput(e.target.value)}
            disabled={isRunning}
            className="goal-input"
          />
          <button
            type="submit"
            disabled={isRunning || !goalInput.trim()}
            className="launch-btn"
          >
            {isRunning ? '⟳ Thinking' : '▶ Launch →'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HiveChat;
