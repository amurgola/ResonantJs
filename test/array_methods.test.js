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
  const resonant = new Resonant();
  context.resonant = resonant;

  return { context, resonant, store };
}

// ============================================
// Array Method Tests
// ============================================

test('array sort maintains data integrity', () => {
  const { context, resonant } = createResonant();

  resonant.add('sortTest', [3, 1, 4, 1, 5, 9, 2, 6]);

  // Sort the array
  context.sortTest.sort((a, b) => a - b);

  // Array should be sorted
  assert.deepStrictEqual(
    Array.from(context.sortTest),
    [1, 1, 2, 3, 4, 5, 6, 9]
  );

  // Should still be reactive
  assert.strictEqual(context.sortTest.length, 8);
});

test('array sort with objects maintains reactivity', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('objSort', [
    { name: 'Charlie', age: 30 },
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 35 }
  ]);

  resonant.addCallback('objSort', () => { callbackFired = true; });

  // Sort by name
  context.objSort.sort((a, b) => a.name.localeCompare(b.name));

  assert.strictEqual(context.objSort[0].name, 'Alice');
  assert.strictEqual(context.objSort[1].name, 'Bob');
  assert.strictEqual(context.objSort[2].name, 'Charlie');

  // Modify sorted array
  context.objSort[0].age = 26;
  await new Promise(r => setTimeout(r, 10));

  assert(callbackFired);
});

test('array reverse maintains data integrity', () => {
  const { context, resonant } = createResonant();

  resonant.add('reverseTest', [1, 2, 3, 4, 5]);

  // Reverse the array
  context.reverseTest.reverse();

  // Array should be reversed
  assert.deepStrictEqual(
    Array.from(context.reverseTest),
    [5, 4, 3, 2, 1]
  );

  // Should still be reactive
  assert.strictEqual(context.reverseTest.length, 5);
});

test('array reverse maintains reactivity', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('revReactive', ['a', 'b', 'c']);
  resonant.addCallback('revReactive', () => { callbackFired = true; });

  context.revReactive.reverse();

  // Modify reversed array
  context.revReactive.push('d');
  await new Promise(r => setTimeout(r, 10));

  assert(callbackFired);
  assert.deepStrictEqual(
    Array.from(context.revReactive),
    ['c', 'b', 'a', 'd']
  );
});

test('array forceUpdate triggers callbacks without changes', async () => {
  const { context, resonant } = createResonant();

  let callbackCount = 0;
  resonant.add('forceArr', [1, 2, 3]);
  resonant.addCallback('forceArr', () => callbackCount++);

  // Force update without actually changing data
  context.forceArr.forceUpdate();
  await new Promise(r => setTimeout(r, 10));

  // Callback should have fired
  assert(callbackCount > 0);

  // Data should remain unchanged
  assert.deepStrictEqual(Array.from(context.forceArr), [1, 2, 3]);
});

test('array forceUpdate can trigger DOM re-render', async () => {
  const { context, resonant } = createResonant();

  let renderCount = 0;
  resonant.add('forceRender', [{ id: 1, name: 'test' }]);
  resonant.addCallback('forceRender', () => renderCount++);

  const initialCount = renderCount;

  // Force update
  context.forceRender.forceUpdate();
  await new Promise(r => setTimeout(r, 10));

  // Should have triggered callback
  assert(renderCount > initialCount);
});

test('array filterInPlace modifies array and triggers callbacks', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('filterArr', [1, 2, 3, 4, 5, 6]);
  resonant.addCallback('filterArr', () => { callbackFired = true; });

  // Filter in place (keep only even numbers)
  context.filterArr.filterInPlace(x => x % 2 === 0);
  await new Promise(r => setTimeout(r, 10));

  // Array should be modified
  assert.deepStrictEqual(Array.from(context.filterArr), [2, 4, 6]);

  // Callback should have fired
  assert(callbackFired);
});

test('array filterInPlace with no matches empties array', async () => {
  const { context, resonant } = createResonant();

  resonant.add('emptyFilter', [1, 3, 5, 7]);

  // Filter for even numbers (none exist)
  context.emptyFilter.filterInPlace(x => x % 2 === 0);
  await new Promise(r => setTimeout(r, 10));

  // Array should be empty
  assert.strictEqual(context.emptyFilter.length, 0);
  assert.deepStrictEqual(Array.from(context.emptyFilter), []);
});

test('array filterInPlace with all matches keeps all', async () => {
  const { context, resonant } = createResonant();

  resonant.add('allFilter', [2, 4, 6, 8]);

  const original = Array.from(context.allFilter);

  // Filter for even numbers (all match)
  context.allFilter.filterInPlace(x => x % 2 === 0);
  await new Promise(r => setTimeout(r, 10));

  // Array should be unchanged
  assert.deepStrictEqual(Array.from(context.allFilter), original);
});

test('array update method replaces entire array', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('updateArr', [1, 2, 3]);
  resonant.addCallback('updateArr', () => { callbackFired = true; });

  // Update with new array
  context.updateArr.update([4, 5, 6, 7]);
  await new Promise(r => setTimeout(r, 10));

  // Array should be replaced
  assert.deepStrictEqual(Array.from(context.updateArr), [4, 5, 6, 7]);
  assert(callbackFired);
});

test('array filter method (non-mutating) returns new filtered array', () => {
  const { context, resonant } = createResonant();

  resonant.add('filterNonMut', [1, 2, 3, 4, 5]);

  // Use filter (should not modify original)
  const filtered = context.filterNonMut.filter(x => x > 3);

  // Original should be unchanged
  assert.deepStrictEqual(Array.from(context.filterNonMut), [1, 2, 3, 4, 5]);

  // Filtered should have correct values
  assert(Array.isArray(filtered));
  assert.deepStrictEqual(filtered, [4, 5]);
});

test('array concat maintains reactivity of original', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('concatArr', [1, 2, 3]);
  resonant.addCallback('concatArr', () => { callbackFired = true; });

  // Concat creates new array
  const combined = context.concatArr.concat([4, 5]);

  // Original should be unchanged
  assert.deepStrictEqual(Array.from(context.concatArr), [1, 2, 3]);

  // Combined should have all elements
  assert.deepStrictEqual(combined, [1, 2, 3, 4, 5]);

  // Original should still be reactive
  context.concatArr.push(6);
  await new Promise(r => setTimeout(r, 10));

  assert(callbackFired);
  assert.strictEqual(context.concatArr.length, 4);
});

test('array slice maintains reactivity of original', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('sliceArr', [1, 2, 3, 4, 5]);
  resonant.addCallback('sliceArr', () => { callbackFired = true; });

  // Slice creates new array
  const sliced = context.sliceArr.slice(1, 3);

  // Original should be unchanged
  assert.deepStrictEqual(Array.from(context.sliceArr), [1, 2, 3, 4, 5]);

  // Sliced should have correct elements
  assert.deepStrictEqual(sliced, [2, 3]);

  // Original should still be reactive
  context.sliceArr[0] = 10;
  await new Promise(r => setTimeout(r, 10));

  assert(callbackFired);
  assert.strictEqual(context.sliceArr[0], 10);
});

test('array map maintains reactivity of original', async () => {
  const { context, resonant } = createResonant();

  let callbackFired = false;
  resonant.add('mapArr', [1, 2, 3]);
  resonant.addCallback('mapArr', () => { callbackFired = true; });

  // Map creates new array
  const mapped = context.mapArr.map(x => x * 2);

  // Original should be unchanged
  assert.deepStrictEqual(Array.from(context.mapArr), [1, 2, 3]);

  // Mapped should have transformed values
  assert.deepStrictEqual(mapped, [2, 4, 6]);

  // Original should still be reactive
  context.mapArr.push(4);
  await new Promise(r => setTimeout(r, 10));

  assert(callbackFired);
  assert.strictEqual(context.mapArr.length, 4);
});

test('array find works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('findArr', [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' }
  ]);

  // Find by id
  const found = context.findArr.find(item => item.id === 2);

  assert.strictEqual(found.name, 'Bob');
});

test('array findIndex works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('findIdxArr', [10, 20, 30, 40]);

  // Find index
  const idx = context.findIdxArr.findIndex(x => x === 30);

  assert.strictEqual(idx, 2);
});

test('array includes works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('includesArr', ['a', 'b', 'c']);

  assert.strictEqual(context.includesArr.includes('b'), true);
  assert.strictEqual(context.includesArr.includes('d'), false);
});

test('array indexOf works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('indexArr', [5, 10, 15, 20, 10]);

  assert.strictEqual(context.indexArr.indexOf(10), 1);
  assert.strictEqual(context.indexArr.indexOf(99), -1);
});

test('array lastIndexOf works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('lastIdxArr', [5, 10, 15, 20, 10]);

  assert.strictEqual(context.lastIdxArr.lastIndexOf(10), 4);
  assert.strictEqual(context.lastIdxArr.lastIndexOf(99), -1);
});

test('array forEach iteration works', () => {
  const { context, resonant } = createResonant();

  resonant.add('forEachArr', [1, 2, 3, 4]);

  let sum = 0;
  context.forEachArr.forEach(x => { sum += x; });

  assert.strictEqual(sum, 10);
});

test('array every works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('everyArr', [2, 4, 6, 8]);

  assert.strictEqual(context.everyArr.every(x => x % 2 === 0), true);
  assert.strictEqual(context.everyArr.every(x => x > 5), false);
});

test('array some works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('someArr', [1, 3, 5, 8]);

  assert.strictEqual(context.someArr.some(x => x % 2 === 0), true);
  assert.strictEqual(context.someArr.some(x => x > 10), false);
});

test('array reduce works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('reduceArr', [1, 2, 3, 4, 5]);

  const sum = context.reduceArr.reduce((acc, x) => acc + x, 0);

  assert.strictEqual(sum, 15);
});

test('array reduceRight works correctly', () => {
  const { context, resonant } = createResonant();

  resonant.add('reduceRightArr', ['a', 'b', 'c']);

  const reversed = context.reduceRightArr.reduceRight((acc, x) => acc + x, '');

  assert.strictEqual(reversed, 'cba');
});
