import React, { useEffect, useState, useRef } from 'react';
import { useSwarmStore } from '../../store/swarmStore';
import SwarmGraph from '../ui/SwarmGraph';
import '../../styles/HiveChat.css';

export const HiveChat: React.FC = () => {
  const {
    currentSession,
    messages,
    isRunning,
    consensusReached,
    activeAgent,
    executeSwarmAction,
    approveAction,
    rejectAction,
    viewMode,
    setViewMode,
    showDecisionLog,
    setShowDecisionLog,
    error
  } = useSwarmStore();

  const [goalInput, setGoalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLaunchSwarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim() || isRunning) return;
    await executeSwarmAction(goalInput);
    setGoalInput('');
  };

  const getAgentColor = (role: string) => {
    const colors: Record<string, string> = {
      planner: '#3b82f6',
      researcher: '#10b981',
      executor: '#84cc16',
      critic: '#f59e0b',
      creator: '#f97316',
      memory: '#a855f7',
      system: '#6b7280',
      user: '#94a3b8',
    };
    return colors[role] || 'var(--text-tertiary)';
  };

  return (
    <div className="hivechat-container">
      {/* Header */}
      <div className="hivechat-header">
        <div className="hivechat-header-left">
          <h2>HiveMind Swarm</h2>
          <div className="status-indicator">
            <span className={`status-dot ${isRunning ? 'active' : ''}`}></span>
            <span className="status-text" style={{ color: isRunning ? '#10b981' : 'var(--text-secondary)' }}>
              {isRunning ? 'Swarm Active' : consensusReached ? 'Consensus Reached' : 'Ready'}
            </span>
          </div>
        </div>
        <div className="hivechat-header-right">
          <div className="view-toggle" style={{ display: 'flex', gap: '8px' }}>
            <button className={`toggle-btn ${viewMode === 'chat' ? 'active' : ''}`} onClick={() => setViewMode('chat')}>Chat</button>
            <button className={`toggle-btn ${viewMode === 'graph' ? 'active' : ''}`} onClick={() => setViewMode('graph')}>Graph</button>
          </div>
          <button className={`replay-btn ${showDecisionLog ? 'active' : ''}`} onClick={() => setShowDecisionLog(!showDecisionLog)}>📋</button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: '#ef444422', color: '#ef4444', padding: '10px 24px', fontSize: '13px', borderBottom: '1px solid #ef444444' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main View */}
      <div className="hivechat-messages">
        {viewMode === 'graph' ? (
          <div className="swarm-graph-overlay" style={{ height: '100%', flex: 1 }}>
            <SwarmGraph activeAgent={activeAgent || undefined} />
          </div>
        ) : (
          <>
            {messages.length === 0 && !isRunning && (
              <div className="empty-state">
                <p>🛰️</p>
                <p>Initialize your swarm with a goal</p>
                <p style={{ fontSize: '13px', opacity: 0.6 }}>The collective intelligence is waiting for instructions.</p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className="message" style={{ borderLeftColor: getAgentColor(msg.agentRole) }}>
                <div className="message-header">
                  <div className="agent-badge" style={{ color: getAgentColor(msg.agentRole), border: `1px solid ${getAgentColor(msg.agentRole)}22` }}>
                    {msg.agentRole}
                  </div>
                  <div className="message-meta">
                    <span className="message-type">{msg.type}</span>
                    {msg.confidence !== undefined && (
                      <span className="confidence-badge">{msg.confidence}%</span>
                    )}
                  </div>
                  <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="message-content">{msg.content || <span style={{ opacity: 0.3 }}>Thinking...</span>}</div>
              </div>
            ))}

            {isRunning && (
              <div className="message thinking">
                <div className="thinking-dots"><span></span><span></span><span></span></div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Approval Gate */}
      {consensusReached && !isRunning && (
        <div className="approval-gate">
          <div className="approval-content">
            <h3>Consensus Reached</h3>
            <p>The hive has analyzed the goal and proposed a plan. Approve to execute or request revision.</p>
            <div className="approval-buttons">
              <button className="btn-approve" onClick={() => approveAction('auto-1')}>Approve & Execute</button>
              <button className="btn-reject" onClick={() => rejectAction('auto-1', 'Revision requested')}>Request Revision</button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form className="hivechat-input-form" onSubmit={handleLaunchSwarm}>
        <div className="input-wrapper">
          <input 
            type="text" 
            placeholder="What is the objective for the hive?" 
            value={goalInput} 
            onChange={e => setGoalInput(e.target.value)} 
            disabled={isRunning} 
            className="goal-input" 
          />
          <button type="submit" disabled={isRunning || !goalInput.trim()} className="launch-btn">
            {isRunning ? 'Analyzing...' : 'Launch Swarm →'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HiveChat;
