# 🐝 HiveMind: Distributed Agent Orchestration

![HiveMind Banner](https://img.shields.io/badge/HiveMind-Agent%20Swarm-orange?style=for-the-badge&logo=hive)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blueviolet?style=for-the-badge&logo=tauri)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-white?style=for-the-badge&logo=ollama)

HiveMind is a high-performance, local-first agentic swarm orchestrator built on **Tauri 2.0** and **React**. It enables complex problem solving by deploying a "swarm" of specialized AI agents that collaborate, critique, and reach consensus on difficult tasks—all running on your local machine via Ollama.

## ✨ Key Features

- **🛡️ Distributed Swarm Intelligence**: Deploy multiple specialized agents (Planner, Researcher, Executor, Critic, Creator) to solve a single goal.
- **🤝 Consensus Engine**: Automated voting system where agents review and critique each other's outputs until an optimal solution is reached.
- **🧠 Hybrid Memory System**: Integrated SQLite for structured long-term memory and ChromaDB for high-dimensional vector similarity search.
- **⚡ Local-First Performance**: Built with Rust (Tauri) for minimal footprint and maximum security. No data leaves your machine.
- **🔍 Decision Replay**: Full transparency into the "thought process" of every agent in the swarm.
- **🚀 Proactive Background Swarm**: Agents can run in the background to surface insights and identify project risks before they become problems.

## 🏗️ Architecture

HiveMind uses a multi-layered architecture:
1.  **UI Layer (React)**: A modern, responsive dashboard for managing swarms and viewing agent debates.
2.  **Orchestration Layer (TypeScript/LangChain)**: Manages the lifecycle of agent chains, consensus logic, and memory retrieval.
3.  **Kernel Layer (Rust/Tauri)**: Handles low-level system operations, Ollama service management, and database persistence.
4.  **Inference Layer (Ollama)**: Local LLM execution (supports Gemma 2, Llama 3, Mistral, etc.).

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
