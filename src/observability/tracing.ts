import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

/**
 * 3.2 Observability (OpenTelemetry)
 * Setup tracing for agent execution and consensus phases.
 */

const provider = new NodeTracerProvider();

// Export to OTLP (e.g., Jaeger, Honeycomb, or local collector)
try {
  provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  })));

  // Also export to console for local debugging
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
} catch (e) {
  console.warn('[Observability] Failed to initialize spans processor:', e);
}

provider.register();

// Register instrumentations
registerInstrumentations({
  instrumentations: [],
});

export const tracer = provider.getTracer('hivemind-orchestrator');
