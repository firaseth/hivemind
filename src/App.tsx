import { useEffect } from 'react'
import HiveChat from './components/screens/HiveChat'
import { useSwarmStore } from './store/swarmStore'
import { getOllamaStatus } from './lib/ollama'
import './App.css'

// ── Nav item config ─────────────────────────────────────────────────────────
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

  // Poll Ollama health on mount
  useEffect(() => {
    const probe = async () => {
      const status = await getOllamaStatus(ollamaStatus.baseUrl, selectedModel)
      setOllamaStatus(status)
    }
    probe()
    const interval = setInterval(probe, 15_000)
    return () => clearInterval(interval)
  }, [ollamaStatus.baseUrl, selectedModel, setOllamaStatus])

  return (
    <main className="app-container">
      {/* ── Sidebar ── */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-bee">🐝</span>
            <span className="logo-text">HiveMind</span>
          </div>
          <div className="version">v0.1.0 · local</div>
        </div>

        <div className="nav-items">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button
              key={id}
              id={`nav-${id}`}
              className={`nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id as Tab)}
            >
              <span className="icon">{icon}</span>
              <span className="label">{label}</span>
              {id === 'memory' && memoryEntries.length > 0 && (
                <span className="nav-badge">{memoryEntries.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="status-badge">
            <span className={`dot ${ollamaStatus.running ? 'online' : 'offline'}`} />
            {ollamaStatus.running
              ? `${ollamaStatus.models.length} model${ollamaStatus.models.length !== 1 ? 's' : ''} ready`
              : 'Ollama offline'}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <section className="main-content">
        {activeTab === 'swarm' && <HiveChat />}

        {activeTab === 'memory' && (
          <div className="page memory-page">
            <div className="page-header">
              <h1>Memory Store</h1>
              <p className="page-subtitle">
                {memoryEntries.length} entries · persisted across sessions
              </p>
              {memoryEntries.length > 0 && (
                <button className="btn-ghost danger" onClick={clearMemory}>
                  Clear all
                </button>
              )}
            </div>

            {memoryEntries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🧠</span>
                <p>No memory entries yet.</p>
                <p className="empty-sub">Run a swarm session to populate memory.</p>
              </div>
            ) : (
              <div className="memory-list">
                {memoryEntries.map((entry) => (
                  <div key={entry.id} className="memory-card">
                    <div className="memory-card-header">
                      <span
                        className="memory-role-badge"
                        data-role={entry.agentRole}
                      >
                        {entry.agentRole}
                      </span>
                      <span className="memory-ts">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="memory-content">{entry.content}</p>
                    {entry.tags.length > 0 && (
                      <div className="memory-tags">
                        {entry.tags.map((t) => (
                          <span key={t} className="memory-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="page settings-page">
            <div className="page-header">
              <h1>Settings</h1>
              <p className="page-subtitle">Configure models, memory, and connections</p>
            </div>

            {/* Model config */}
            <div className="settings-group">
              <h3>Model Configuration</h3>
              <div className="setting-row">
                <label htmlFor="model-select">Active Model</label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {ollamaStatus.models.length > 0
                    ? ollamaStatus.models.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))
                    : (
                        <>
                          <option value="gemma2:9b">gemma2:9b</option>
                          <option value="llama3:8b">llama3:8b</option>
                          <option value="mistral">mistral</option>
                        </>
                      )}
                </select>
              </div>
              <div className="setting-row">
                <label htmlFor="ollama-url">Ollama Base URL</label>
                <input
                  id="ollama-url"
                  type="text"
                  defaultValue={ollamaStatus.baseUrl}
                  readOnly
                />
              </div>
              <div className="setting-row">
                <label>Connection Status</label>
                <span className={`status-pill ${ollamaStatus.running ? 'success' : 'error'}`}>
                  {ollamaStatus.running ? '● Connected' : '● Disconnected'}
                </span>
              </div>
            </div>

            {/* Memory config */}
            <div className="settings-group">
              <h3>Memory Persistence</h3>
              <div className="setting-row">
                <label>SQLite Database</label>
                <code>hivemind_memory.db</code>
              </div>
              <div className="setting-row">
                <label>Vector Store</label>
                <code>ChromaDB (Local)</code>
              </div>
              <div className="setting-row">
                <label>Cached Entries</label>
                <span className="setting-value">{memoryEntries.length}</span>
              </div>
            </div>

            {/* Session history */}
            <div className="settings-group">
              <h3>Session History</h3>
              <div className="setting-row">
                <label>Total Sessions</label>
                <span className="setting-value">{sessionHistory.length}</span>
              </div>
              <div className="setting-row">
                <label>Consensus Reached</label>
                <span className="setting-value">
                  {sessionHistory.filter((s) => s.consensusReached).length}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
