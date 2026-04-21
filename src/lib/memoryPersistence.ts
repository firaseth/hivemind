import { invoke } from "@tauri-apps/api/core";
import type { MemoryEntry } from "../types/agent";

export async function saveMemoryEntry(entry: MemoryEntry): Promise<string> {
  return invoke("save_memory_entry", { entry });
}

export async function queryMemoryEntries(query: string, limit = 20): Promise<MemoryEntry[]> {
  return invoke("query_memory_entries", { query, limit });
}

export async function listMemoryEntries(): Promise<MemoryEntry[]> {
  return invoke("list_memory_entries");
}
