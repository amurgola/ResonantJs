const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { MockElement, MockDocument } = require('./mockDom');

function createResonantDom(root) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  context.document = new MockDocument(root);
  const store = {};
  context.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; }
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  return { context, resonant: new Resonant(), root };
}

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

// Test array splice operation
test('array splice removes items correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  resonant.add('items', ['a', 'b', 'c', 'd']);
  resonant.addCallback('items', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  context.items.splice(1, 2); // Remove 'b' and 'c'
  await new Promise(r => setTimeout(r, 5));
  
  assert.deepStrictEqual(Array.from(context.items), ['a', 'd']);
  assert.strictEqual(resonant.data.items.length, 2);
  assert.strictEqual(callbackResult.action, 'removed');
});

// Test array length property
test('array length property is reactive', async () => {
  const { context, resonant } = createResonant();
  
  resonant.add('items', ['a', 'b']);
  assert.strictEqual(context.items.length, 2);
  
  context.items.push('c');
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.items.length, 3);
  assert.deepStrictEqual(Array.from(context.items), ['a', 'b', 'c']);
});

// Test array index assignment
test('array index assignment updates correctly', async () => {
  const { context, resonant } = createResonant();
  
  resonant.add('items', ['a', 'b', 'c']);
  
  context.items[1] = 'modified';
  await new Promise(r => setTimeout(r, 5));
  
  assert.deepStrictEqual(Array.from(context.items), ['a', 'modified', 'c']);
  assert.strictEqual(resonant.data.items[1], 'modified');
});

// Test array set method
test('array set method updates item at index', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  resonant.add('items', ['a', 'b', 'c']);
  resonant.addCallback('items', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  context.items.set(0, 'updated');
  await new Promise(r => setTimeout(r, 5));
  
  assert.deepStrictEqual(Array.from(context.items), ['updated', 'b', 'c']);
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test persistence with complex data
test('persistence handles nested object updates', async () => {
  const { context, resonant, store } = createResonant();
  
  const userData = {
    profile: { name: 'John', age: 30 },
    settings: { theme: 'dark', notifications: true }
  };
  
  resonant.add('user', userData, true);
  
  // Verify initial storage
  assert.strictEqual(JSON.parse(store['res_user']).profile.name, 'John');
  
  // Update nested property
  context.user.profile.age = 31;
  await new Promise(r => setTimeout(r, 5));
  
  // Verify persistence
  assert.strictEqual(JSON.parse(store['res_user']).profile.age, 31);
  assert.strictEqual(JSON.parse(store['res_user']).profile.name, 'John'); // unchanged
});

// Test multiple callbacks on same variable
test('multiple callbacks can be added to same variable', async () => {
  const { context, resonant } = createResonant();
  
  let result1, result2;
  resonant.add('counter', 0);
  resonant.addCallback('counter', (newVal) => { result1 = newVal; });
  resonant.addCallback('counter', (newVal) => { result2 = newVal * 2; });
  
  context.counter = 5;
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(result1, 5);
  assert.strictEqual(result2, 10);
});

// Test multiple consecutive operations
test('multiple consecutive array operations work correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackCount = 0;
  
  resonant.add('items', [1, 2, 3]);
  resonant.addCallback('items', () => { callbackCount++; });
  
  // Multiple operations
  context.items.push(4);
  await new Promise(r => setTimeout(r, 5));
  context.items.push(5);
  await new Promise(r => setTimeout(r, 5));
  
  assert.deepStrictEqual(Array.from(context.items), [1, 2, 3, 4, 5]);
  assert.strictEqual(callbackCount, 2); // One for each push
});

// Test multiple variable initialization
test('addAll initializes multiple variables at once', () => {
  const { context, resonant } = createResonant();
  
  resonant.addAll({ 
    name: 'John', 
    age: 30, 
    active: true,
    scores: [1, 2, 3]
  });
  
  assert.strictEqual(context.name, 'John');
  assert.strictEqual(context.age, 30);
  assert.strictEqual(context.active, true);
  assert.deepStrictEqual(Array.from(context.scores), [1, 2, 3]);
});

// Test localStorage retrieval with different data types
test('localStorage retrieval works with primitive data types', () => {
  const { context, resonant, store } = createResonant();
  
  // Pre-populate localStorage with different types
  store['res_string'] = JSON.stringify('hello');
  store['res_number'] = JSON.stringify(42);
  store['res_boolean'] = JSON.stringify(true);
  store['res_array'] = JSON.stringify([1, 2, 3]);
  
  resonant.add('string', 'default', true);
  resonant.add('number', 0, true);
  resonant.add('boolean', false, true);
  resonant.add('array', [], true);
  
  assert.strictEqual(context.string, 'hello');
  assert.strictEqual(context.number, 42);
  assert.strictEqual(context.boolean, true);
  assert.deepStrictEqual(Array.from(context.array), [1, 2, 3]);
});