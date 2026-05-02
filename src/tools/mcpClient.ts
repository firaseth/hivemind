import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }
}

export const globalToolRegistry = new ToolRegistry();

export async function loadMCPTools(): Promise<Tool[]> {
  try {
    const transport = new StdioClientTransport({ 
      command: 'npx', 
      args: ['-y', '@modelcontextprotocol/server-web-search'] 
    });
    
    const client = new Client({ 
      name: 'hivemind', 
      version: '1.0' 
    }, { 
      capabilities: {} 
    });

    await client.connect(transport);
    
    const response = await client.listTools();
    const tools = response.tools as Tool[];
    
    tools.forEach(tool => globalToolRegistry.register(tool));
    
    return tools;
  } catch (error) {
    console.error('[MCP] Failed to load tools:', error);
    return [];
  }
}
