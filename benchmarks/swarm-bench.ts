import { executeSwarm } from '../src/lib/orchestrator';
import { performance } from 'perf_hooks';

/**
 * 3.3 Performance Benchmarks
 * Measures swarm latency, memory, and success rates.
 */

async function runBenchmark() {
  const tasks = [
    'Write a haiku about coding',
    'Plan a 3-step strategy for a new SaaS launch',
    'Explain quantum computing to a 5-year old'
  ];

  console.log('🚀 Starting Swarm Benchmark...');

  for (const task of tasks) {
    const t1 = performance.now();
    try {
      const result = await executeSwarm({
        goal: task,
        model: 'qwen2.5:1.5b'
      });
      const t2 = performance.now();
      console.log(`\n------------------------------------------------`);
      console.log(`Task: "${task}"`);
      console.log(`Status: ${result.consensusReached ? '✅ Consensus' : '❌ Failed'}`);
      console.log(`Latency: ${((t2 - t1) / 1000).toFixed(2)}s`);
      console.log(`Messages: ${result.messages.length}`);
      console.log(`------------------------------------------------\n`);
    } catch (error) {
      console.error(`Error during task "${task}":`, error);
    }
  }

  console.log('🏁 Benchmark Completed.');
}

runBenchmark().catch(console.error);
