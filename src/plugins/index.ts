import { globalPluginRegistry } from "./registry";
import { WebResearcherPlugin } from "./webResearcher";

/**
 * Plugin Initialization
 */
export function initializePlugins() {
  console.log('[Plugins] Initializing all plugins...');
  globalPluginRegistry.register(WebResearcherPlugin);
}
