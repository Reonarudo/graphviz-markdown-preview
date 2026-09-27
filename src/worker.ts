import { parentPort, workerData } from 'node:worker_threads';

interface Viz {
  render(source: string, options: { format: string }): unknown;
}
// Resolves to the vendored module from `dist/` in the packaged extension and during tests.
const { instance } = require('../vendor/viz/viz.cjs') as { instance(): Promise<Viz> };

const { buffer } = workerData as { buffer: SharedArrayBuffer };
/** [0] result ready, [1] result byte length, [2] 1 once viz has initialised. */
const state = new Int32Array(buffer, 0, 3);
const bytes = new Uint8Array(buffer, 12);

function reply(result: unknown): void {
  let encoded = new TextEncoder().encode(JSON.stringify(result));
  if (encoded.length > bytes.length) {
    encoded = new TextEncoder().encode(JSON.stringify({
      status: 'failure',
      errors: [{ level: 'error', message: 'Graphviz output exceeds the 4 MB limit.' }]
    }));
  }
  bytes.set(encoded);
  Atomics.store(state, 1, encoded.length);
  Atomics.store(state, 0, 1);
  Atomics.notify(state, 0);
}

// The host blocks on one request at a time, so at most one can arrive before viz is ready — a
// render that respawned this worker. Hold it and answer it as soon as initialisation settles.
let pending: string | undefined;
let answer: ((source: string) => void) | undefined;
parentPort!.on('message', (source: string) => {
  if (answer) answer(source);
  else pending = source;
});
function settle(respond: (source: string) => void): void {
  answer = respond;
  if (pending !== undefined) respond(pending);
  pending = undefined;
}

instance().then((viz) => {
  Atomics.store(state, 2, 1);
  // `svg_inline` omits the xml-stylesheet processing instruction, and no `images` option is
  // passed, so Graphviz emits no <image> (ADR 0001).
  settle((source) => reply(viz.render(source, { format: 'svg_inline' })));
  parentPort!.postMessage({ ready: true });
}, (error: unknown) => {
  // Keep answering, so a render waiting on this worker learns why instead of timing out.
  const reason = error instanceof Error ? error.message : 'Graphviz initialization failed.';
  settle(() => reply({ status: 'unavailable', reason }));
  parentPort!.postMessage({ error: reason });
});
