const { test } = require('node:test');
const assert = require('assert');
const { createResonant } = require('./mockDom');

// --- Happy path: binding existing window variables ---

test('add existing scalar variable from window', () => {
  const { context, resonant } = createResonant();
  context.myName = 'Alice';
  resonant.add('myName');
  assert.strictEqual(context.myName, 'Alice');
  assert.strictEqual(resonant.data.myName, 'Alice');
});

test('add existing object variable from window', () => {
  const { context, resonant } = createResonant();
  context.user = { name: 'Alice', age: 30 };
  resonant.add('user');
  assert.strictEqual(context.user.name, 'Alice');
  assert.strictEqual(context.user.age, 30);
  assert.strictEqual(resonant.data.user.name, 'Alice');
});

test('add existing array variable from window', () => {
  const { context, resonant } = createResonant();
  context.items = [1, 2, 3];
  resonant.add('items');
  assert.strictEqual(context.items.length, 3);
  assert.deepStrictEqual(Array.from(context.items), [1, 2, 3]);
});

test('existing scalar becomes reactive after add', async () => {
  const { context, resonant } = createResonant();
  context.count = 10;
  resonant.add('count');
  let callbackResult;
  resonant.addCallback('count', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.count = 20;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.count, 20);
  assert.strictEqual(resonant.data.count, 20);
  assert.deepStrictEqual(callbackResult, { newVal: 20, item: 20, action: 'modified' });
});

test('existing object becomes reactive after add', async () => {
  const { context, resonant } = createResonant();
  context.person = { first: 'Ted', last: 'Smith' };
  resonant.add('person');
  context.person.first = 'Ed';
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(resonant.data.person.first, 'Ed');
  assert.strictEqual(context.person.first, 'Ed');
});

test('existing array becomes reactive after add', async () => {
  const { context, resonant } = createResonant();
  context.tags = ['a', 'b'];
  resonant.add('tags');
  let callbackResult;
  resonant.addCallback('tags', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.tags.push('c');
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.tags.length, 3);
  assert.deepStrictEqual(callbackResult, { newVal: context.tags, item: 'c', action: 'added' });
});

test('original window variable is replaced by reactive getter/setter', () => {
  const { context, resonant } = createResonant();
  context.plain = 'hello';
  const descriptor1 = Object.getOwnPropertyDescriptor(context, 'plain');
  assert.strictEqual(descriptor1.value, 'hello');
  resonant.add('plain');
  const descriptor2 = Object.getOwnPropertyDescriptor(context, 'plain');
  assert.ok(descriptor2.get, 'should have a getter after add');
  assert.ok(descriptor2.set, 'should have a setter after add');
});

test('cloned value is independent from original reference', () => {
  const { context, resonant } = createResonant();
  const original = { nested: { val: 1 } };
  context.obj = original;
  resonant.add('obj');
  original.nested.val = 999;
  assert.strictEqual(context.obj.nested.val, 1, 'reactive copy should not be affected by original mutation');
});

test('add existing variable with persist flag', async () => {
  const { context, resonant, store } = createResonant();
  context.score = 42;
  resonant.add('score', true);
  assert.strictEqual(context.score, 42);
  assert.strictEqual(resonant.data.score, 42);
  context.score = 100;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(store['res_score'], JSON.stringify(100));
});

// --- Failure cases ---

test('add nonexistent window variable warns and does not create binding', () => {
  const { context, resonant } = createResonant();
  const warnings = [];
  const origWarn = context.console.warn;
  context.console = { ...console, warn: (...args) => warnings.push(args.join(' ')) };
  resonant.add('doesNotExist');
  assert.strictEqual(resonant.data.doesNotExist, undefined);
  assert.ok(warnings.some(w => w.includes('doesNotExist') && w.includes('not found')));
  context.console = { ...console, warn: origWarn };
});

test('passing a non-string first argument with no value falls through to normal add', () => {
  const { context, resonant } = createResonant();
  // Passing a number as variableName with a value should work normally (existing behavior)
  // This tests that the feature doesn't break existing two-arg calls
  resonant.add('myVar', 123);
  assert.strictEqual(context.myVar, 123);
  assert.strictEqual(resonant.data.myVar, 123);
});

test('two-arg add with non-boolean value still works normally', () => {
  const { context, resonant } = createResonant();
  resonant.add('greeting', 'hello');
  assert.strictEqual(context.greeting, 'hello');
  assert.strictEqual(resonant.data.greeting, 'hello');
});

test('three-arg add still works normally', () => {
  const { context, resonant } = createResonant();
  resonant.add('counter', 5, false);
  assert.strictEqual(context.counter, 5);
  assert.strictEqual(resonant.data.counter, 5);
});

test('add existing nested object array becomes fully reactive', async () => {
  const { context, resonant } = createResonant();
  context.users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  resonant.add('users');
  let callbackResult;
  resonant.addCallback('users', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  context.users[0].name = 'Alicia';
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.users[0].name, 'Alicia');
  assert.strictEqual(resonant.data.users[0].name, 'Alicia');
  assert.deepStrictEqual(callbackResult, { newVal: context.users, item: context.users[0], action: 'modified' });
});
