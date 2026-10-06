// Tests for registerTemplate + res-use + res-include + injectable (item,event)
// handlers. Runs on the repo's harness (node --test). Templates are passed to
// registerTemplate as pre-built elements (the mock DOM does not parse innerHTML
// strings into a tree — registerTemplate accepts either form).
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

const el = (tag, attrs, classes) => {
  const e = new MockElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  (classes || []).forEach((c) => e.classList.add(c));
  return e;
};
// <div><span res-prop="title" res-onclick="res.open"></span></div>
function rowTemplate() {
  const root = el('div');
  root.appendChild(el('span', { 'res-prop': 'title', 'res-onclick': 'res.open' }));
  return root;
}

test('res-use renders array items from a registered template', () => {
  const root = el('div');
  const { resonant } = makeResonant(root);
  resonant.registerTemplate('row', rowTemplate());
  const mount = el('div', { res: 'items', 'res-use': 'row' });
  root.appendChild(mount);

  resonant.add('items', [{ title: 'A' }, { title: 'B' }]);

  const titles = root.querySelectorAll('[res-rendered="true"] [res-prop="title"]').map((e) => e.innerHTML);
  assert.deepStrictEqual(titles, ['A', 'B']);
});

test('injected res.X handler fires with (item, event) via a res-on: override', () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  resonant.registerTemplate('row', rowTemplate());
  const mount = el('div', { res: 'items', 'res-use': 'row', 'res-on:open': 'rowOpen' });
  root.appendChild(mount);

  let gotItem = null, gotEvent = null;
  context.rowOpen = (item, e) => { gotItem = item; gotEvent = e; };
  resonant.add('items', [{ title: 'A' }, { title: 'B' }]);

  const clickables = root.querySelectorAll('[res-rendered="true"] [res-onclick]');
  const ev = { type: 'click' };
  clickables[1].onclick(ev);

  assert.strictEqual(gotItem.title, 'B', 'handler receives the clicked item');
  assert.strictEqual(gotEvent, ev, 'handler receives the event');
});

test('two mounts of the same template wire different handlers (per-mount override)', () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  resonant.registerTemplate('row', rowTemplate());
  const a = el('div', { res: 'listA', 'res-use': 'row', 'res-on:open': 'openA' });
  const b = el('div', { res: 'listB', 'res-use': 'row', 'res-on:open': 'openB' });
  root.appendChild(a); root.appendChild(b);

  const hits = [];
  context.openA = (item) => hits.push('A:' + item.title);
  context.openB = (item) => hits.push('B:' + item.title);
  resonant.add('listA', [{ title: 'x' }]);
  resonant.add('listB', [{ title: 'y' }]);

  root.querySelectorAll('[res="listA"][res-rendered="true"] [res-onclick]').forEach((e) => e.onclick({}));
  root.querySelectorAll('[res="listB"][res-rendered="true"] [res-onclick]').forEach((e) => e.onclick({}));
  assert.deepStrictEqual(hits, ['A:x', 'B:y']);
});

test('res-include expands a template in place and binds an injected handler', () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  const card = el('div', null, ['card']);
  card.appendChild(el('button', { 'res-onclick': 'res.close' }, ['x']));
  resonant.registerTemplate('card', card);

  const placeholder = el('div', { 'res-include': 'card', 'res-on:close': 'onClose' });
  root.appendChild(placeholder);
  let closed = false;
  context.onClose = () => { closed = true; };

  resonant.processIncludes(root);

  assert.strictEqual(root.querySelectorAll('[res-include]').length, 0, 'placeholder replaced');
  const expanded = root.querySelector('.card');
  assert.ok(expanded, 'template content present');
  expanded.querySelector('[res-onclick]').onclick({ type: 'click' });
  assert.strictEqual(closed, true, 'injected res.close handler fired');
});

test('res-style applies a class from a bare item-property expression on array items', () => {
  const root = el('div');
  const { resonant } = makeResonant(root);
  const tpl = el('div');
  tpl.appendChild(el('span', { 'res-prop': 'title', 'res-style': "done ? 'completed' : ''" }));
  resonant.registerTemplate('task', tpl);
  const mount = el('div', { res: 'tasks', 'res-use': 'task' });
  root.appendChild(mount);

  resonant.add('tasks', [{ title: 'A', done: true }, { title: 'B', done: false }]);
  const spans = root.querySelectorAll('[res-rendered="true"] [res-style]');
  assert.ok(spans[0].classList.contains('completed'), 'done item gets the class');
  assert.ok(!spans[1].classList.contains('completed'), 'string literal not corrupted; not-done item has no class');
});

test('res-format runs a res-prop value through a named transform', () => {
  const root = el('div');
  const { resonant } = makeResonant(root);
  resonant.transform('shout', (v, item) => '<b>' + String(v).toUpperCase() + '!' + (item.n || '') + '</b>');
  const tpl = el('div');
  tpl.appendChild(el('span', { 'res-prop': 'title', 'res-format': 'shout' }));
  resonant.registerTemplate('row', tpl);
  const mount = el('div', { res: 'items', 'res-use': 'row' });
  root.appendChild(mount);

  resonant.add('items', [{ title: 'hi', n: 2 }]);
  const span = root.querySelector('[res-rendered="true"] [res-prop="title"]');
  assert.strictEqual(span.innerHTML, '<b>HI!2</b>');
});

test('res-on<event> binds non-click events (input) with (item, event)', () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  const tpl = el('div');
  tpl.appendChild(el('input', { 'res-oninput': 'onType' }));
  resonant.registerTemplate('row', tpl);
  const mount = el('div', { res: 'items', 'res-use': 'row' });
  root.appendChild(mount);

  let seen = null;
  context.onType = (item, e) => { seen = { id: item.id, type: e.type }; };
  resonant.add('items', [{ id: 'a' }]);
  const input = root.querySelector('[res-rendered="true"] [res-oninput]');
  assert.strictEqual(typeof input.oninput, 'function', 'oninput bound');
  input.oninput({ type: 'input' });
  assert.deepStrictEqual(seen, { id: 'a', type: 'input' });
});

test('bindEvents() wires res-on handlers on static (non-template) markup', () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  const btn = el('button', { 'res-onclick': 'go' });
  root.appendChild(btn);
  let hit = false;
  context.go = () => { hit = true; };
  resonant.bindEvents(root);
  btn.onclick({});
  assert.strictEqual(hit, true);
});

test('res-empty shows a template when the array is empty, removes it when filled', async () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  resonant.registerTemplate('noneTpl', el('div', null, ['empty-msg']));
  resonant.registerTemplate('row', rowTemplate());
  const mount = el('div', { res: 'items', 'res-use': 'row', 'res-empty': 'noneTpl' });
  root.appendChild(mount);

  resonant.add('items', []);
  assert.strictEqual(root.querySelectorAll('.empty-msg').length, 1, 'empty template shown');

  context.items.update([{ title: 'A' }]);
  await new Promise((r) => setTimeout(r, 5));   // update() renders on the batched tick
  assert.strictEqual(root.querySelectorAll('.empty-msg').length, 0, 'removed once populated');
  assert.strictEqual(root.querySelectorAll('[res-rendered="true"]').length, 1);
});

test('legacy res-onclick="globalFn" still works and now receives the event', () => {
  const root = el('div');
  const { context, resonant } = makeResonant(root);
  const tpl = el('div');
  tpl.appendChild(el('span', { 'res-prop': 'title', 'res-onclick': 'plainHandler' }));
  resonant.registerTemplate('row', tpl);
  const mount = el('div', { res: 'items', 'res-use': 'row' });
  root.appendChild(mount);

  let received;
  context.plainHandler = (item, e) => { received = { item, e }; };
  resonant.add('items', [{ title: 'Z' }]);
  const ev = {};
  root.querySelector('[res-rendered="true"] [res-onclick]').onclick(ev);
  assert.strictEqual(received.item.title, 'Z');
  assert.strictEqual(received.e, ev);
});
