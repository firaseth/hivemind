import { useState } from "react";
import HiveChat from "./components/screens/HiveChat";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<'swarm' | 'settings'>('swarm');

  return (
    <main className="app-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="logo">🐝 HiveMind</div>
          <div className="version">v0.1.0</div>
        </div>
        
        <div className="nav-items">
          <button 
            className={`nav-item \${activeTab === 'swarm' ? 'active' : ''}`}
            onClick={() => setActiveTab('swarm')}
          >
            <span className="icon">🛰️</span>
            <span className="label">Swarm Control</span>
          </button>
          
          <button 
            className={`nav-item \${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="icon">⚙️</span>
            <span className="label">Settings</span>
          </button>
        </div>
        
        <div className="sidebar-footer">
          <div className="status-badge">
            <span className="dot online"></span>
            Local Node Ready
          </div>
        </div>
      </nav>

      <section className="main-content">
        {activeTab === 'swarm' ? (
          <HiveChat />
        ) : (
          <div className="settings-page">
            <h2>System Settings</h2>
            <div className="settings-group">
              <h3>Model Configuration</h3>
              <div className="setting-row">
                <label>Default Local Model</label>
                <select defaultValue="gemma2:9b">
                  <option value="gemma2:9b">Gemma 2 9B</option>
                  <option value="llama3:8b">Llama 3 8B</option>
                  <option value="mistral">Mistral</option>
                </select>
              </div>
              <div className="setting-row">
                <label>Ollama Base URL</label>
                <input type="text" defaultValue="http://127.0.0.1:11434" />
              </div>
            </div>
            
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
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
