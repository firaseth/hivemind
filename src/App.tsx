import { useEffect } from 'react'
import HiveChat from './components/screens/HiveChat'
import { useSwarmStore } from './store/swarmStore'
import { getOllamaStatus } from './lib/ollama'
import { listen } from '@tauri-apps/api/event'
import './App.css'

const NAV_ITEMS = [
  { id: 'swarm',    icon: '🛰️', label: 'Swarm Control' },
  { id: 'memory',   icon: '🧠', label: 'Memory'        },
  { id: 'settings', icon: '⚙️', label: 'Settings'      },
] as const

type Tab = typeof NAV_ITEMS[number]['id']

function App() {
  const {
    activeTab,
    setActiveTab,
    ollamaStatus,
    setOllamaStatus,
    selectedModel,
    setSelectedModel,
    memoryEntries,
    clearMemory,
    sessionHistory,
  } = useSwarmStore()

  useEffect(() => {
    const probe = async () => {
      const status = await getOllamaStatus(ollamaStatus.baseUrl, selectedModel)
      setOllamaStatus(status)
    }
    probe()
    const interval = setInterval(probe, 15_000)
    return () => clearInterval(interval)
  }, [ollamaStatus.baseUrl, selectedModel, setOllamaStatus])

  useEffect(() => {
    let unlisteners: Array<() => void> = [];
    const setup = async () => {
      try {
        unlisteners.push(await listen('agent_message', (e: any) => useSwarmStore.getState().addMessage(e.payload)));
        unlisteners.push(await listen('agent_status', (e: any) => {
          const { role, status } = e.payload;
          useSwarmStore.getState().setAgentStatus(role, status);
          if (status === 'working') useSwarmStore.getState().setActiveAgent(role);
          else if (useSwarmStore.getState().activeAgent === role) useSwarmStore.getState().setActiveAgent(null);
        }));
        unlisteners.push(await listen('consensus_reached', () => {
          useSwarmStore.getState().setConsensusReached(true);
          useSwarmStore.getState().setIsRunning(false);
        }));
        unlisteners.push(await listen('agent_token', (e: any) => {
          const { msgId, fullContent } = e.payload;
          useSwarmStore.getState().updateMessage(msgId, { content: fullContent });
        }));
        unlisteners.push(await listen('agent_message_done', (e: any) => {
          const { msgId, fullContent, confidence } = e.payload;
          useSwarmStore.getState().updateMessage(msgId, { content: fullContent, confidence });
        }));
      } catch (err) { console.error(err); }
    };
    setup();
    return () => unlisteners.forEach(u => u());
  }, []);

  return (
    <main className="app-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="logo"><span className="logo-bee">🐝</span><span className="logo-text">HiveMind</span></div>
          <div className="version">v0.1.0 · local</div>
        </div>
        <div className="nav-items">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id as Tab)}>
              <span className="icon">{icon}</span>
              <span className="label">{label}</span>
              {id === 'memory' && memoryEntries.length > 0 && <span className="nav-badge">{memoryEntries.length}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-footer" style={{ borderTop: 'none', paddingBottom: '5px' }}>
          <div className="status-badge">
            <span className={`dot ${ollamaStatus.running ? 'online' : 'offline'}`} />
            {ollamaStatus.running ? `${ollamaStatus.models.length} models ready` : 'Ollama offline'}
          </div>
        </div>
        <div className="creator-credit">
          <span>Created by Engineer Firas</span>
        </div>
      </nav>

      <section className="main-content">
        {activeTab === 'swarm' && <HiveChat />}
        {activeTab === 'memory' && (
          <div className="page" style={{ animation: 'message-in 0.4s var(--ease-out)' }}>
            <div className="page-header">
              <h1>Memory Store</h1>
              <p className="page-subtitle">{memoryEntries.length} entries preserved in the collective consciousness.</p>
            </div>
            <div className="memory-list" style={{ marginTop: '20px' }}>
              {memoryEntries.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '100px' }}>
                  <p>🧠</p>
                  <p>The hive's memory is currently empty.</p>
                </div>
              ) : (
                memoryEntries.map(entry => (
                  <div key={entry.id} className="memory-card" style={{ marginBottom: '12px' }}>
                    <div className="memory-card-header">
                      <span className="memory-role-badge" data-role={entry.agentRole}>{entry.agentRole}</span>
                      <span className="memory-ts">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="memory-content">{entry.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="page" style={{ animation: 'message-in 0.4s var(--ease-out)' }}>
            <div className="page-header">
              <h1>System Settings</h1>
              <p className="page-subtitle">Configure the hive's intelligence and connectivity.</p>
            </div>
            <div className="settings-group" style={{ marginTop: '24px' }}>
              <h3>Model Configuration</h3>
              <div className="setting-row">
                <label>Active Intelligence</label>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  {ollamaStatus.models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div className="setting-row">
                <label>Connection Endpoint</label>
                <code>{ollamaStatus.baseUrl}</code>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
