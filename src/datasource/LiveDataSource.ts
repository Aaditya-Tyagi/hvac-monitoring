// Stub for a server-driven data source. Not used by the demo, but present so
// the engine, store, and screens are transport-agnostic — promoting from
// CSV replay to a real WebSocket / SSE stream is a one-class swap, not a
// rewrite of the surrounding system.

import type { DataSource, DataSourceState, Reading } from './types';

export type LiveDataSourceOptions = {
  url?: string;
  // Caller may supply a custom transport for unit tests; default would be WS.
  transport?: {
    connect: (onMessage: (r: Reading) => void) => Promise<void>;
    disconnect: () => void;
  };
};

export class LiveDataSource implements DataSource {
  readonly id = 'live';
  state: DataSourceState = 'idle';
  private listeners = new Set<(r: Reading) => void>();
  private readonly opts: LiveDataSourceOptions;

  constructor(opts: LiveDataSourceOptions = {}) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    // Intentional no-op for the demo. In production:
    //   - open WS to this.opts.url
    //   - on message, parse to Reading, forward to listeners
    //   - reconnect with backoff on close
    //   - heartbeat / staleness detection
    this.state = 'running';
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'running';
  }

  stop(): void {
    if (this.opts.transport) this.opts.transport.disconnect();
    this.state = 'idle';
  }

  subscribe(listener: (r: Reading) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
