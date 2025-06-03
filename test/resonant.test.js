const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function createResonant() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  context.document = { querySelectorAll: () => [] };
  context.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  return { context, resonant: new Resonant() };
}

test('single variable updates global and data', () => {
  const { context, resonant } = createResonant();
  resonant.add('name', 'ted');
  assert.strictEqual(context.name, 'ted');
  context.name = 'ed';
  assert.strictEqual(resonant.data.name, 'ed');
  assert.strictEqual(context.name, 'ed');
});

test('callback fires for single variable', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  resonant.add('name', 'ted');
  resonant.addCallback('name', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.name = 'ed';
  await new Promise(r => setTimeout(r, 5));
  assert.deepStrictEqual(callbackResult, { newVal: 'ed', item: 'ed', action: 'modified' });
});

test('object property updates', async () => {
  const { context, resonant } = createResonant();
  resonant.add('person', { first: 'ted', last: 'smith' });
  context.person.first = 'ed';
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(resonant.data.person.first, 'ed');
  assert.strictEqual(context.person.first, 'ed');
});

test('array push updates data and triggers callback', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  resonant.add('items', [1, 2]);
  resonant.addCallback('items', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.items.push(3);
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(resonant.data.items.length, 3);
  assert.strictEqual(context.items.length, 3);
  assert.deepStrictEqual(callbackResult, { newVal: context.items, item: 3, action: 'added' });
});
