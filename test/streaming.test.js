// Tests for the format() + stream() additions. Runs on the repo's harness:
//   node --test
// Drop into ResonantJs test/ alongside mockDom.js (with the closest/replaceWith/
// firstElementChild additions) and the patched resonant.js.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { MockElement, MockDocument } = require('./mockDom');

function makeResonant(root) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
  const context = {
    console, setTimeout, clearTimeout,
    structuredClone: typeof structuredClone === 'function' ? structuredClone : (o) => JSON.parse(JSON.stringify(o)),
  };
  context.window = context;
  context.document = new MockDocument(root);
  const store = {};
  context.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  return { context, resonant: new Resonant() };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function scalarRoot() {
  const span = new MockElement('span');
  span.setAttribute('res', 'answer');
  const root = new MockElement('div');
  root.appendChild(span);
  return { root, span };
}

test('format() renders a scalar through its transform', () => {
  const { root, span } = scalarRoot();
  const { resonant } = makeResonant(root);
  resonant.add('answer', 'hi');
  resonant.format('answer', (v) => '<b>' + v + '</b>');
  assert.strictEqual(span.innerHTML, '<b>hi</b>');
});

test('stream() coalesces rapid writes into one formatted flush', async () => {
  const { root, span } = scalarRoot();
  const { resonant } = makeResonant(root);
  resonant.add('answer', '');
  resonant.format('answer', (v) => '[' + v + ']');
  span.resetRenderTracking();

  const sink = resonant.stream('answer', { throttle: 20 });
  sink.write('a'); sink.write('b'); sink.write('c');
  await sleep(40);

  assert.strictEqual(span.innerHTML, '[abc]');
  assert.strictEqual(span.getRenderCount(), 1, '3 writes inside the throttle window → 1 flush');
});

test('stream() keeps the raw value readable on the reactive variable', async () => {
  const { root } = scalarRoot();
  const { context, resonant } = makeResonant(root);
  resonant.add('answer', '');
  const sink = resonant.stream('answer', { throttle: 10 });
  sink.write('foo'); sink.write('bar');
  await sleep(20);
  assert.strictEqual(context.answer, 'foobar'); // getter returns accumulated raw text
});

test('stream() rewind truncates the tail', async () => {
  const { root, span } = scalarRoot();
  const { resonant } = makeResonant(root);
  resonant.add('answer', '');
  resonant.format('answer', (v) => v);
  const sink = resonant.stream('answer', { throttle: 10 });
  sink.write('abcd'); await sleep(20);
  sink.rewind(2); await sleep(20);
  assert.strictEqual(span.innerHTML, 'ab');
});

test('stream() end does a final flush (ignoring throttle) and clears state', () => {
  const { root, span } = scalarRoot();
  const { resonant } = makeResonant(root);
  resonant.add('answer', '');
  resonant.format('answer', (v) => v);
  const sink = resonant.stream('answer', { throttle: 1000 });
  sink.write('done');
  sink.end();
  assert.strictEqual(span.innerHTML, 'done', 'end() flushes immediately, not after the throttle');
  assert.strictEqual(resonant._streams['answer'], undefined, 'stream record cleared');
});
