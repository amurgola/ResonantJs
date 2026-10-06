// Locks in the rendering-cost fixes the browser benchmark surfaced:
//   - sort() and reverse() re-render (they used to leave the DOM stale)
//   - editing one array item touches only that row; siblings are neither
//     re-rendered nor moved
//   - scalar writes in one tick coalesce into a single DOM update
//   - display and style expressions are compiled once and reused
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
const tick = () => new Promise((r) => setTimeout(r, 5));
const el = (tag, attrs) => { const e = new MockElement(tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };

function listFixture() {
  const root = el('div');
  const ul = el('ul');
  const li = el('li', { res: 'items' });
  li.appendChild(el('span', { 'res-prop': 'name' }));
  ul.appendChild(li);
  root.appendChild(ul);
  return { root, ul };
}
const renderedNames = (root) => root.querySelectorAll('[res-rendered="true"] [res-prop="name"]').map((e) => e.innerHTML);

test('sort() re-renders the list in sorted order', async () => {
  const { root } = listFixture();
  const { context, resonant } = makeResonant(root);
  resonant.add('items', [{ name: 'b' }, { name: 'c' }, { name: 'a' }]);
  const rowsBefore = root.querySelectorAll('[res-rendered="true"]');

  context.items.sort((x, y) => x.name.localeCompare(y.name));
  await tick();

  assert.deepStrictEqual(renderedNames(root), ['a', 'b', 'c']);
  const rowsAfter = root.querySelectorAll('[res-rendered="true"]');
  assert.ok(rowsAfter.every((row) => rowsBefore.includes(row)), 'rows are reordered, not re-created');
  assert.deepStrictEqual(rowsAfter.map((row) => row.getAttribute('res-index')), ['0', '1', '2']);
});

test('reverse() re-renders the list in reversed order and fires an updated callback', async () => {
  const { root } = listFixture();
  const { context, resonant } = makeResonant(root);
  resonant.add('items', [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  const actions = [];
  resonant.addCallback('items', (value, item, action) => actions.push(action));

  context.items.reverse();
  await tick();

  assert.deepStrictEqual(renderedNames(root), ['c', 'b', 'a']);
  assert.deepStrictEqual(actions, ['updated']);
});

test('editing one item replaces only that row and leaves siblings in place', async () => {
  const { root, ul } = listFixture();
  const { context, resonant } = makeResonant(root);
  resonant.add('items', Array.from({ length: 5 }, (_, i) => ({ name: 'n' + i })));
  const before = root.querySelectorAll('[res-rendered="true"]');
  before.forEach((row) => row.querySelector('[res-prop="name"]').resetRenderTracking());

  let moves = 0;
  const originalInsert = ul.insertBefore.bind(ul);
  ul.insertBefore = (node, ref) => { moves++; return originalInsert(node, ref); };
  const originalAppend = ul.appendChild.bind(ul);
  ul.appendChild = (node) => { moves++; return originalAppend(node); };

  context.items[2].name = 'edited';
  await tick();

  const after = root.querySelectorAll('[res-rendered="true"]');
  assert.deepStrictEqual(renderedNames(root), ['n0', 'n1', 'edited', 'n3', 'n4']);
  assert.strictEqual(moves, 1, 'exactly one DOM insertion: the replaced row');
  [0, 1, 3, 4].forEach((i) => {
    assert.strictEqual(after[i], before[i], `row ${i} is the same element`);
    assert.strictEqual(after[i].querySelector('[res-prop="name"]').getRenderCount(), 0, `row ${i} was not re-rendered`);
  });
});

test('an unchanged re-render performs no DOM moves', async () => {
  const { root, ul } = listFixture();
  const { context, resonant } = makeResonant(root);
  resonant.add('items', [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  let moves = 0;
  ul.insertBefore = () => { moves++; throw new Error('unexpected move'); };
  ul.appendChild = () => { moves++; throw new Error('unexpected move'); };

  context.items.forceUpdate();
  await tick();

  assert.strictEqual(moves, 0);
  assert.deepStrictEqual(renderedNames(root), ['a', 'b', 'c']);
});

test('scalar writes in one tick coalesce into a single DOM update', async () => {
  const root = el('div');
  const p = el('p', { res: 'counter' });
  root.appendChild(p);
  const { context, resonant } = makeResonant(root);
  resonant.add('counter', 0);
  await tick();
  p.resetRenderTracking();
  let callbacks = 0;
  resonant.addCallback('counter', () => callbacks++);

  for (let i = 1; i <= 100; i++) context.counter = i;
  assert.strictEqual(context.counter, 100, 'the getter reflects the latest write immediately');
  await tick();

  assert.strictEqual(p.innerHTML, '100');
  assert.strictEqual(p.getRenderCount(), 1, '100 writes produced one DOM write');
  assert.strictEqual(callbacks, 1, 'and one callback');
});

test('scalar display and style conditions update on the batched flush', async () => {
  const root = el('div');
  root.appendChild(el('p', { res: 'counter' }));
  const flag = el('span', { 'res-display': 'counter > 5' });
  const styled = el('i', { 'res-style': "counter > 5 ? 'hi' : 'lo'" });
  root.appendChild(flag); root.appendChild(styled);
  const { context, resonant } = makeResonant(root);
  resonant.add('counter', 0);
  await tick();
  assert.strictEqual(flag.style.display, 'none');
  assert.ok(styled.classList.contains('lo'));

  context.counter = 9;
  await tick();

  assert.strictEqual(flag.style.display, 'inherit');
  assert.ok(styled.classList.contains('hi'));
  assert.ok(!styled.classList.contains('lo'));
});

test('display and style expressions are compiled once per expression, not per item', async () => {
  const root = el('div');
  const ul = el('ul');
  const li = el('li', { res: 'items' });
  li.appendChild(el('span', { 'res-prop': 'name', 'res-display': 'done', 'res-style': "done ? 'd' : ''" }));
  ul.appendChild(li); root.appendChild(ul);
  const { context, resonant } = makeResonant(root);

  const RealFunction = vm.runInContext('Function', context);
  let compiles = 0;
  context.__spyFunction = function (...args) { compiles++; return RealFunction(...args); };
  vm.runInContext('Function = window.__spyFunction', context);

  resonant.add('items', Array.from({ length: 50 }, (_, i) => ({ name: 'n' + i, done: i % 2 === 0 })));
  const compilesForFirstRender = compiles;
  context.items.push({ name: 'more', done: true });
  await tick();

  assert.ok(compilesForFirstRender <= 4, `50 items compiled ${compilesForFirstRender} functions, expected a handful`);
  assert.strictEqual(compiles, compilesForFirstRender, 'a later render reuses the compiled expressions');
  const spans = root.querySelectorAll('[res-rendered="true"] [res-display]');
  assert.strictEqual(spans[0].style.display, 'inherit');
  assert.strictEqual(spans[1].style.display, 'none');
  assert.ok(spans[0].classList.contains('d'));
});

test('array templates are cached per element, not globally by variable name', async () => {
  // Two instances binding the same variable name to different markup must each
  // render with their own template. Before, the first mount's template was
  // cached on window as items_template and reused by every later mount.
  const rootA = el('div');
  const ulA = el('ul'); const liA = el('li', { res: 'items' }); liA.appendChild(el('span', { 'res-prop': 'name', class: 'from-a' })); ulA.appendChild(liA); rootA.appendChild(ulA);
  const rootB = el('div');
  const ulB = el('ul'); const liB = el('li', { res: 'items' }); liB.appendChild(el('em', { 'res-prop': 'title', class: 'from-b' })); ulB.appendChild(liB); rootB.appendChild(ulB);

  const { context, resonant: a } = makeResonant(rootA);
  const Resonant = vm.runInContext('Resonant', context);
  const b = new Resonant({ rootElement: rootB, bindToWindow: false });
  context.document = new MockDocument(rootA);

  a.add('items', [{ name: 'alpha' }]);
  b.add('items', [{ title: 'beta' }]);

  assert.deepStrictEqual(rootA.querySelectorAll('[res-rendered="true"] [res-prop="name"]').map((e) => e.innerHTML), ['alpha']);
  assert.strictEqual(rootB.querySelectorAll('[res-rendered="true"] .from-a').length, 0, 'second mount does not use the first template');
  assert.deepStrictEqual(rootB.querySelectorAll('[res-rendered="true"] [res-prop="title"]').map((e) => e.innerHTML), ['beta']);
  assert.strictEqual(Object.keys(context).some((k) => k.endsWith('_template')), false, 'nothing cached on window');
});
