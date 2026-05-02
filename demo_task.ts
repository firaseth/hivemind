import { executeSwarm } from './src/lib/orchestrator';
import { initializePlugins } from './src/plugins';
import { OllamaProvider } from './src/llm/ollama';

// MOCK OLLAMA FOR DEMO
// @ts-ignore
OllamaProvider.prototype.generate = async function(prompt: string) {
  if (prompt.includes('Planner')) return "1. Rent a community hall ($150). 2. DIY Decorations ($50). 3. Potluck or simple catering ($200). [CONFIDENCE: 90]";
  if (prompt.includes('Web Researcher')) return "Web search found local community halls and budget catering options. Total estimated: $400. [CONFIDENCE: 95]";
  if (prompt.includes('Creator')) return "Designing 'Neon Glow' theme with budget-friendly LED sticks and blacklight. [CONFIDENCE: 85]";
  if (prompt.includes('Executor')) return "Booking hall for July 15th. Preparing shopping list for decorations. [CONFIDENCE: 90]";
  if (prompt.includes('Critic')) return "Plan is solid. Budget has $100 buffer. Highly recommended. [CONFIDENCE: 98]";
  if (prompt.includes('facilitator')) return '{"consensus": true, "agreementScore": 95, "recommendedAction": "Proceed with Neon Glow theme at Community Hall", "reasoning": "Plan is well-balanced and under budget."}';
  return "Standard response [CONFIDENCE: 70]";
};

// @ts-ignore
OllamaProvider.prototype.generateStreaming = async function* (prompt: string) {
  const content = await this.generate(prompt);
  yield content;
};

async function runDemo() {
  console.log('🐝 HiveMind Swarm: Birthday Party Planning Demo');
  console.log('----------------------------------------------');

  initializePlugins();

  const goal = "Plan a birthday party within $500";
  
  try {
    const result = await executeSwarm({
      goal: goal,
      model: 'qwen2.5:1.5b'
    });

    console.log('\n--- Swarm Execution Result ---');
    console.log(`Status: ${result.consensusReached ? '✅ Consensus Reached' : '❌ Pending'}`);
    console.log(`Recommended Action: ${result.recommendedAction}`);
    
    console.log('\n--- Agent Messages ---');
    result.messages.forEach(msg => {
      if (msg.agentRole !== 'system') {
        console.log(`\n[${msg.agentRole.toUpperCase()}]`);
        console.log(msg.content);
      }
    });

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

runDemo();
