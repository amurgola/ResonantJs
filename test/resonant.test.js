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

  const store = {};
  context.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = val; },
    removeItem: key => { delete store[key]; }
  };

  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  return { context, resonant: new Resonant(), store };
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

test('push object into array and trigger callback', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  resonant.add('items', []);
  resonant.addCallback('items', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  const obj = { id: 1, name: 'test' };
  context.items.push(obj);
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(resonant.data.items.length, 1);
  assert.strictEqual(context.items[0].name, 'test');
  assert.deepStrictEqual(callbackResult, { newVal: context.items, item: obj, action: 'added' });
});

test('edit object property in array', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  const obj = { id: 1, name: 'test' };
  resonant.add('items', [obj]);
  resonant.addCallback('items', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.items[0].name = 'updated';
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(resonant.data.items[0].name, 'updated');
  assert.deepStrictEqual(callbackResult, { newVal: context.items, item: context.items[0], action: 'modified' });
});

test('remove object from array', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  const obj1 = { id: 1 };
  const obj2 = { id: 2 };
  resonant.add('items', [obj1, obj2]);
  resonant.addCallback('items', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.items.delete(0);
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(resonant.data.items.length, 1);
  assert.strictEqual(resonant.data.items[0].id, 2);
  assert.deepStrictEqual(callbackResult, { newVal: context.items, item: obj1, action: 'removed' });
});

test('variable is undefined before add and defined after', () => {
  const { context, resonant } = createResonant();
  assert.strictEqual(context.counter, undefined);
  resonant.add('counter', 1);
  assert.strictEqual(context.counter, 1);
  assert.strictEqual(resonant.data.counter, 1);
});

test('addAll initializes multiple variables', () => {
  const { context, resonant } = createResonant();
  resonant.addAll({ first: 'a', second: 2 });
  assert.strictEqual(context.first, 'a');
  assert.strictEqual(context.second, 2);
  assert.strictEqual(resonant.data.first, 'a');
  assert.strictEqual(resonant.data.second, 2);
});

test('persist retrieves stored value and saves updates', async () => {
  const { context, resonant, store } = createResonant();
  store['res_count'] = JSON.stringify(5);
  resonant.add('count', 0, true);
  assert.strictEqual(context.count, 5);
  context.count = 10;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(store['res_count'], JSON.stringify(10));
});

test('array update replaces array and triggers callback', async () => {
  const { context, resonant } = createResonant();
  let result;
  resonant.add('nums', [1, 2]);
  resonant.addCallback('nums', (newVal, item, action) => {
    result = { newVal, item, action };
  });
  context.nums.update([3, 4]);
  await new Promise(r => setTimeout(r, 5));
  assert.deepStrictEqual(Array.from(context.nums), [3, 4]);
  assert.deepStrictEqual(Array.from(resonant.data.nums), [3, 4]);
  assert.deepStrictEqual(result, { newVal: context.nums, item: [3, 4], action: 'updated' });
});

test('filter does not modify array but triggers callback', async () => {
  const { context, resonant } = createResonant();
  let result;
  resonant.add('vals', [1, 2, 3]);
  resonant.addCallback('vals', (newVal, item, action) => { result = { newVal, item, action }; });
  const filtered = context.vals.filter(v => v > 1);
  await new Promise(r => setTimeout(r, 5));
  assert.deepStrictEqual(Array.from(filtered), [2, 3]);
  assert.deepStrictEqual(result, { newVal: context.vals, item: undefined, action: 'filtered' });
});
