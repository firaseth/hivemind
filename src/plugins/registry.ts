import { LLMProvider } from "../llm/provider";

/**
 * 4.3 Plugin Ecosystem
 * Allows external contributors to add new agent personas and tools.
 */

export interface AgentPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  // factory to create a custom logic for the agent
  execute?: (goal: string, provider: LLMProvider) => Promise<any>;
  tools?: any[];
}

export class PluginRegistry {
  private plugins: Map<string, AgentPlugin> = new Map();

  register(plugin: AgentPlugin) {
    console.log(`[Plugins] Registering plugin: ${plugin.name} v${plugin.version}`);
    this.plugins.set(plugin.id, plugin);
  }

  getPlugin(id: string) {
    return this.plugins.get(id);
  }

  getAllPlugins() {
    return Array.from(this.plugins.values());
  }
}

export const globalPluginRegistry = new PluginRegistry();
