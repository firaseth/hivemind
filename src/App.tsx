import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { runOllamaPrompt } from "./lib/ollamaChain";
import { saveMemoryEntry, queryMemoryEntries } from "./lib/memoryPersistence";
import { persistVectorDocument, queryVectorStore, findSimilarMemory } from "./lib/chromaAdapter";
import type { MemoryEntry } from "./types/agent";
import "./App.css";

function App() {
  const [serviceStatus, setServiceStatus] = useState("unknown");
  const [prompt, setPrompt] = useState("Describe a distributed agent orchestration architecture.");
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("agent orchestration");
  const [memoryResults, setMemoryResults] = useState<MemoryEntry[]>([]);
  const [vectorQuery, setVectorQuery] = useState("distributed agent memory");
  const [vectorResults, setVectorResults] = useState<string>("");
  const [useMemoryContext, setUseMemoryContext] = useState(true);

  useEffect(() => {
    refreshStatus();
  }, []);

  async function refreshStatus() {
    try {
      const status = await invoke<string>("ollama_status");
      setServiceStatus(status);
    } catch (error) {
      setServiceStatus("error");
      setFeedback("Unable to query Ollama service status.");
    }
  }

  async function startOllama() {
    try {
      const result = await invoke<string>("start_ollama", { port: 11434 });
      setFeedback(result);
      setServiceStatus("running");
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function stopOllama() {
    try {
      const result = await invoke<string>("stop_ollama");
      setFeedback(result);
      setServiceStatus("stopped");
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function runChain() {
    try {
      setResponse("Working...");
      let memoryContext: MemoryEntry[] | undefined;

      if (useMemoryContext) {
        try {
          // First try SQLite memory search
          const relevantMemory = await queryMemoryEntries(prompt, 3);
          memoryContext = relevantMemory;

          // If we don't have enough memory entries, try vector similarity
          if (relevantMemory.length < 3) {
            const vectorResults = await findSimilarMemory(prompt, 3);
            if (vectorResults.length > 0) {
              // Convert vector results to memory-like entries
              const vectorMemory: MemoryEntry[] = vectorResults.map((content, index) => ({
                id: `vector_${Date.now()}_${index}`,
                content,
                agentRole: "memory" as const,
                tags: ["vector", "similarity"],
                projectId: "hive-core",
                timestamp: Date.now(),
              }));
              memoryContext = [...(memoryContext || []), ...vectorMemory];
            }
          }

          if (memoryContext && memoryContext.length > 0) {
            setFeedback(`Using ${memoryContext.length} memory entries for context.`);
          }
        } catch (error) {
          setFeedback(`Memory context unavailable: ${String(error)}`);
        }
      }

      const reply = await runOllamaPrompt(prompt, undefined, memoryContext);
      setResponse(reply);
      setFeedback("Chain completed successfully.");
    } catch (error) {
      setResponse("Failed to run chain: " + String(error));
    }
  }

  async function saveCurrentResponse() {
    if (!response) {
      setFeedback("No response available to save.");
      return;
    }

    const entry: MemoryEntry = {
      id: `response_${Date.now()}`,
      content: response,
      agentRole: "executor",
      tags: ["hivemind", "response", "ollama", ...(useMemoryContext ? ["memory_context"] : [])],
      projectId: "hive-core",
      timestamp: Date.now(),
    };

    try {
      const result = await saveMemoryEntry(entry);
      setFeedback(result);
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function savePromptAsMemory() {
    if (!prompt) {
      setFeedback("No prompt available to save.");
      return;
    }

    const entry: MemoryEntry = {
      id: `prompt_${Date.now()}`,
      content: prompt,
      agentRole: "user",
      tags: ["hivemind", "prompt", "input"],
      projectId: "hive-core",
      timestamp: Date.now(),
    };

    try {
      const result = await saveMemoryEntry(entry);
      setFeedback(result);
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function runMemoryQuery() {
    try {
      const results = await queryMemoryEntries(memoryQuery, 10);
      setMemoryResults(results);
      setFeedback(`Loaded ${results.length} memory entries.`);
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function saveVectorResponse() {
    if (!response) {
      setFeedback("No response available to index.");
      return;
    }

    try {
      await persistVectorDocument(`${Date.now()}`, response, { source: "hivemind" });
      setFeedback("Response persisted into Chroma vector store.");
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function runVectorQuery() {
    try {
      const result = await queryVectorStore(vectorQuery, 3);
      setVectorResults(JSON.stringify(result, null, 2));
      setFeedback("Vector query complete.");
    } catch (error) {
      setFeedback(String(error));
    }
  }

  return (
    <main className="container">
      <h1>HiveMind Ollama Agent Runtime</h1>

      <section className="row">
        <div>
          <strong>Ollama service:</strong> {serviceStatus}
        </div>
        <button onClick={startOllama}>Start Ollama</button>
        <button onClick={stopOllama}>Stop Ollama</button>
        <button onClick={refreshStatus}>Refresh Status</button>
      </section>

      <section className="row">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          rows={4}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label>
            <input
              type="checkbox"
              checked={useMemoryContext}
              onChange={(e) => setUseMemoryContext(e.target.checked)}
            />
            Use Memory Context
          </label>
          <button onClick={runChain}>Run Ollama Chain</button>
          <button onClick={savePromptAsMemory}>Save Prompt as Memory</button>
        </div>
      </section>

      <section className="row">
        <strong>Response</strong>
        <pre>{response}</pre>
        <button onClick={saveCurrentResponse}>Save Response to Memory</button>
        <button onClick={saveVectorResponse}>Persist Response to Vector Store</button>
      </section>

      <section className="row">
        <textarea
          value={memoryQuery}
          onChange={(e) => setMemoryQuery(e.currentTarget.value)}
          rows={2}
          style={{ width: "100%" }}
        />
        <button onClick={runMemoryQuery}>Search Memory</button>
        <div>
          {memoryResults.map((item) => (
            <div key={item.id} style={{ marginBottom: 12 }}>
              <strong>{item.agentRole}</strong> · {new Date(item.timestamp).toLocaleString()}
              <div>{item.content}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="row">
        <textarea
          value={vectorQuery}
          onChange={(e) => setVectorQuery(e.currentTarget.value)}
          rows={2}
          style={{ width: "100%" }}
        />
        <button onClick={runVectorQuery}>Search Vector Store</button>
        <pre>{vectorResults}</pre>
      </section>

      <section className="row">
        <strong>Feedback</strong>
        <p>{feedback}</p>
      </section>
    </main>
  );
}

export default App;
