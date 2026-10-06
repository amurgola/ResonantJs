// Regressions for two bugs found while embedding ResonantJs in a larger app:
//   1. updateStylesFor walked past the NEAREST res ancestor, so a res-style
//      inside a nested binding resolved against the OUTERMOST item.
//   2. res-format was honoured by only two of the seven places a value is
//      written, so inside arrays and on bound object properties it silently
//      did nothing. Every writer now funnels through _writeValue.
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

test('res-style resolves the NEAREST res ancestor, not the outermost', () => {
  // <div res="settings"><div res="items"><span res-prop="name" res-style="items.hot ? 'hot' : 'cold'"></span></div></div>
  const root = el('div');
  const settings = el('div', { res: 'settings' });
  const items = el('div', { res: 'items' });
  items.appendChild(el('span', { 'res-prop': 'name', 'res-style': "items.hot ? 'hot' : 'cold'" }, ['tag']));
  settings.appendChild(items);
  root.appendChild(settings);
  const { resonant } = makeResonant(root);

  resonant.add('settings', { label: 'x' });
  resonant.add('items', [{ name: 'a', hot: true }, { name: 'b', hot: false }]);

  // Before the fix the walk kept climbing to res="settings", `items` was
  // undefined inside the evaluator and the error was swallowed: no class at all.
  const rendered = root.querySelectorAll('[res-rendered="true"] .tag');
  assert.strictEqual(rendered.length, 2);
  assert.ok(rendered[0].classList.contains('hot'), 'first item is hot');
  assert.ok(!rendered[0].classList.contains('cold'));
  assert.ok(rendered[1].classList.contains('cold'), 'second item is cold');
  assert.ok(!rendered[1].classList.contains('hot'));
});

test('res-format is honoured on a bound object property', () => {
  const root = el('div');
  const prof = el('div', { res: 'prof' });
  const name = el('span', { 'res-prop': 'name', 'res-format': 'upper' });
  prof.appendChild(name);
  root.appendChild(prof);
  const { resonant } = makeResonant(root);
  resonant.transform('upper', (v) => '<b>' + String(v).toUpperCase() + '</b>');
  resonant.add('prof', { name: 'ada' });
  assert.strictEqual(name.innerHTML, '<b>ADA</b>');
});

test('res-format is honoured inside a nested array', () => {
  const root = el('div');
  const doc = el('div', { res: 'doc' });
  const tags = el('div', { 'res-prop': 'tags', 'res-format': 'upper' });
  doc.appendChild(tags);
  root.appendChild(doc);
  const { resonant } = makeResonant(root);
  resonant.transform('upper', (v) => '<b>' + String(v).toUpperCase() + '</b>');
  resonant.add('doc', { tags: ['red', 'blue'] });
  const html = tags.children.map((e) => e.innerHTML);
  assert.deepStrictEqual(html, ['<b>RED</b>', '<b>BLUE</b>']);
});

test('res-format is honoured on an array of scalars', () => {
  const root = el('div');
  const list = el('div', { res: 'list' });
  list.appendChild(el('span', { 'res-prop': '', 'res-format': 'upper' }, ['v']));
  root.appendChild(list);
  const { resonant } = makeResonant(root);
  resonant.transform('upper', (v) => '<b>' + String(v).toUpperCase() + '</b>');
  resonant.add('list', ['red', 'blue']);
  const html = root.querySelectorAll('[res-rendered="true"] .v').map((e) => e.innerHTML);
  assert.deepStrictEqual(html, ['<b>RED</b>', '<b>BLUE</b>']);
});

test('res-format falls back to a window function when no transform is registered', () => {
  const root = el('div');
  const prof = el('div', { res: 'prof' });
  const name = el('span', { 'res-prop': 'name', 'res-format': 'shout' });
  prof.appendChild(name);
  root.appendChild(prof);
  const { context, resonant } = makeResonant(root);
  context.shout = (v) => String(v).toUpperCase() + '!';
  resonant.add('prof', { name: 'ada' });
  assert.strictEqual(name.innerHTML, 'ADA!');
});

test('format() formatters and plain writes still work after the _writeValue refactor', () => {
  const root = el('div');
  const a = el('span', { res: 'title' });
  const b = el('span', { res: 'plain' });
  const c = el('span', { res: 'raw', 'res-html': '' });
  root.appendChild(a); root.appendChild(b); root.appendChild(c);
  const { resonant } = makeResonant(root);
  resonant.add('title', 'hi');
  resonant.add('plain', 'just text');
  resonant.add('raw', '<i>markup</i>');
  resonant.format('title', (v) => '<em>' + v + '</em>');
  assert.strictEqual(a.innerHTML, '<em>hi</em>');
  assert.strictEqual(b.innerHTML, 'just text');
  assert.strictEqual(c.innerHTML, '<i>markup</i>');
});

test('a css-selector binding target does not re-apply the top-level formatter', () => {
  const root = el('div');
  const bound = el('span', { res: 'title' });
  const mirror = el('span', { id: 'mirror' }, ['mirror']);
  root.appendChild(bound); root.appendChild(mirror);
  const { resonant } = makeResonant(root);
  resonant.add('title', 'hi');
  resonant.format('title', (v) => '<em>' + v + '</em>');
  resonant.bindByCssSelector('title', '.mirror');
  assert.strictEqual(bound.innerHTML, '<em>hi</em>', 'res element is formatted');
  assert.strictEqual(mirror.innerHTML, 'hi', 'selector target gets the raw value');
});
