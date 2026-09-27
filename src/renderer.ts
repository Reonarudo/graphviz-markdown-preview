import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const capacity = 4_000_000;
const maxSource = 64_000;
const maxEntries = 96;

export interface Message {
  level: 'error' | 'warning';
  message: string;
}

/** What rendering one DOT source produced, as decoded from the worker. */
export type RenderResult =
  | { status: 'success'; output: string; errors: Message[] }
  | { status: 'failure'; errors: Message[] }
  | { status: 'timeout' }
  | { status: 'unavailable'; reason: string };

export interface Runtime {
  render(source: string): RenderResult;
  dispose(): void;
}

export interface RuntimeOptions {
  /** Per-render layout budget in milliseconds. */
  timeout?: number;
  /** Extra budget for a render that has to wait for a fresh worker to initialise. */
  startup?: number;
}

/**
 * Run Graphviz in a worker thread that the synchronous markdown-it fence rule can block on.
 *
 * A render that overruns its budget terminates the worker — the only way to stop a WASM layout
 * mid-flight — and the next render spawns a fresh one, so one pathological graph costs only its
 * own fence. `directory` is the extension's `dist/`, which holds `worker.js`.
 */
export async function createRuntime(directory: string, options: RuntimeOptions = {}): Promise<Runtime> {
  const { timeout = 3000, startup = 10000 } = options;
  let worker: Worker | undefined;
  let state: Int32Array;
  let bytes: Uint8Array;

  const spawn = (): Worker => {
    // Each worker gets its own buffer: a terminated worker still finishing a WASM layout must not
    // be able to write its late answer where its replacement's answer is expected.
    const buffer = new SharedArrayBuffer(capacity + 12);
    state = new Int32Array(buffer, 0, 3);
    bytes = new Uint8Array(buffer, 12);
    worker = new Worker(join(directory, 'worker.js'), {
      workerData: { buffer },
      env: {},
      resourceLimits: { maxOldGenerationSizeMb: 128 }
    });
    // A crash surfaces to the waiting render as a timeout; this only keeps it from being fatal.
    worker.on('error', () => {});
    return worker;
  };
  const stop = (): void => {
    void worker?.terminate();
    worker = undefined;
  };

  // Warm the first worker so the first fence does not pay for initialisation. A failure here is
  // not fatal: the next render tries again with a fresh worker.
  const first = spawn();
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, startup);
    function done(): void {
      clearTimeout(timer);
      first.off('message', done);
      resolve();
    }
    first.on('message', done);
  });

  return {
    render(source) {
      if (source.length > maxSource) {
        return { status: 'failure', errors: [{ level: 'error', message: 'DOT source exceeds the 64 KB limit.' }] };
      }
      const current = worker ?? spawn();
      const budget = Atomics.load(state, 2) === 1 ? timeout : startup + timeout;
      Atomics.store(state, 0, 0);
      current.postMessage(source);
      if (Atomics.wait(state, 0, 0, budget) === 'timed-out') {
        stop();
        return { status: 'timeout' };
      }
      const result = JSON.parse(new TextDecoder().decode(bytes.slice(0, Atomics.load(state, 1)))) as RenderResult;
      if (result.status === 'unavailable') stop();
      return result;
    },
    dispose: stop
  };
}

/**
 * Put a cache in front of the runtime, so re-rendering an unchanged fence on every keystroke costs
 * a lookup rather than a layout.
 *
 * Outcomes are cached, timeouts included: a graph too dense to lay out is not retried until its
 * source changes. `clean` runs once per fresh diagram and its output is what gets cached; if it
 * throws, the refusal is cached as a failure. `onFresh` hears every real render — never a cache
 * hit — so warnings can be logged once rather than on every keystroke.
 */
export function createRenderer(
  runtime: Pick<Runtime, 'render'>,
  clean: (svg: string) => string = (svg) => svg,
  onFresh: (source: string, result: RenderResult) => void = () => {}
): (source: string) => RenderResult {
  const cache = new Map<string, RenderResult>();
  return (source) => {
    const key = createHash('sha256').update(source).digest('hex');
    let result = cache.get(key);
    if (result) {
      // Re-insert so Map order tracks recency and the first key is the least recently used.
      cache.delete(key);
    } else {
      result = runtime.render(source);
      if (result.status === 'success') {
        try {
          result = { ...result, output: clean(result.output) };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Graphviz output was refused.';
          result = { status: 'failure', errors: [{ level: 'error', message }] };
        }
      }
      onFresh(source, result);
      // An unavailable renderer says nothing about this source; the next render retries.
      if (result.status === 'unavailable') return result;
    }
    cache.set(key, result);
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
    return result;
  };
}
