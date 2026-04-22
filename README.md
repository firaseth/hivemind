# 🐝 HiveMind: Distributed Agent Orchestration

![HiveMind Banner](banner.png)

![HiveMind Badge](https://img.shields.io/badge/HiveMind-Agent%20Swarm-orange?style=for-the-badge&logo=hive)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blueviolet?style=for-the-badge&logo=tauri)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-white?style=for-the-badge&logo=ollama)

HiveMind is a high-performance, local-first agentic swarm orchestrator built on **Tauri 2.0** and **React**. It enables complex problem solving by deploying a "swarm" of specialized AI agents that collaborate, critique, and reach consensus on difficult tasks—all running on your local machine via Ollama.

## ✨ Top-Tier Features

- **🕸️ Real-time Swarm Visualization**: Watch your agent hive think in real-time with an integrated execution graph built on @xyflow.
- **🛡️ Consensus-Driven Orchestration**: Automated voting system where agents debate, critique, and reach consensus on difficult tasks.
- **🧠 Advanced Tiered Memory**: Hybrid SQLite long-term memory and ChromaDB vector similarity for deep context recall.
- **⚡ High-Performance Rust Kernel**: Built with Tauri 2.0 for a lightweight, secure, and blazing-fast local experience.
- **🔍 Decision Replay & Transparency**: Full audit logs of every agent's thought process, confidence levels, and reasoning.
- **🧩 Developer-First Extensibility**: Easily add custom agent personas and toolsets via a structured orchestration API.

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────┐
│          React Frontend                 │
│  ┌─────────────────────────────────┐   │
│  │  HiveChat Component             │   │
│  │  - Real-time messages           │   │
│  │  - Agent colors & confidence    │   │
│  │  - Approval gates               │   │
│  │  - Decision Replay              │   │
│  └─────────────────────────────────┘   │
└──────────────────┬──────────────────────┘
                   │
           Tauri IPC Bridge
                   │
┌──────────────────▼──────────────────────┐
│        Tauri Backend (Rust)             │
│  - Ollama process management            │
│  - Swarm command routing                │
│  - SQLite memory persistence            │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   Swarm Orchestration (TypeScript)      │
│  ┌─────────────────────────────────┐   │
│  │ Agent Chains (LangChain)        │   │
│  │ - Planner      - Researcher     │   │
│  │ - Executor     - Critic         │   │
│  │ - Creator      - Memory Keeper  │   │
│  └─────────────────────────────────┘   │
│           ↓↓↓ Parallel ↓↓↓             │
│  ┌─────────────────────────────────┐   │
│  │ Consensus Engine                │   │
│  │ - Debate protocol               │   │
│  │ - Agreement scoring             │   │
│  │ - Decision logging              │   │
│  └─────────────────────────────────┘   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │  Ollama (9B LLM) │
        │  gemma2:9b       │
        └──────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deep-dive technical breakdown.

## 🚀 Getting Started

### Prerequisites
- [Ollama](https://ollama.com/) installed and running.
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri compilation).
- [Node.js](https://nodejs.org/) (v18+).

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/firaseth/hivemind.git
    cd hivemind
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Pull the default model**:
    ```bash
    ollama pull gemma2:9b
    ```

4.  **Run in development mode**:
    ```bash
    npm run tauri dev
    ```

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Rust, Tauri 2.0
- **AI Framework**: LangChain.js
- **Persistence**: SQLite (via `rusqlite`), ChromaDB
- **Styling**: Vanilla CSS (Premium Design System)
- **State Management**: Zustand

## 🗺️ Roadmap
- [ ] Multi-model support (mix and match Llama/Mistral/Gemma)
- [ ] External Tool Integration (Web Search, File System access)
- [ ] Exportable Swarm Reports (PDF/Markdown)
- [ ] Cloud Escalation (Optional Claude/GPT integration for complex tasks)

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Created with ❤️ by [firaseth](https://github.com/firaseth)
