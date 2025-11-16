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

  // Expose resonant in context for computed property tests
  context.resonant = resonant;

  return { context, resonant, store };
}

// ============================================
// Promise/Response Handling Tests
// ============================================

test('add with resolved Promise adds data correctly', async () => {
  const { context, resonant } = createResonant();

  const promise = Promise.resolve({ name: 'John', age: 30 });
  resonant.add('userData', promise);

  // Wait for promise to resolve and be processed
  await new Promise(r => setTimeout(r, 100));

  // Data should be added after resolution
  assert.strictEqual(context.userData.name, 'John');
  assert.strictEqual(context.userData.age, 30);
});

test('add with rejected Promise handles error gracefully', async () => {
  const { context, resonant } = createResonant();

  const errorLogs = [];
  const originalError = context.console.error;
  context.console.error = (...args) => {
    errorLogs.push(args);
    // Still call original for debugging
    originalError(...args);
  };

  const promise = Promise.reject(new Error('Test rejection'));
  resonant.add('failData', promise);

  // Wait for promise to reject
  await promise.catch(() => {});
  await new Promise(r => setTimeout(r, 100));

  // Should log error
  assert(errorLogs.length > 0, 'Expected error to be logged');
  assert(errorLogs.some(log => log.some(arg =>
    typeof arg === 'string' && arg.includes('failData')
  )), 'Expected error message to mention variable name');

  // Data should remain undefined
  assert.strictEqual(context.failData, undefined);

  context.console.error = originalError;
});

test('add with Promise resolving to array', async () => {
  const { context, resonant } = createResonant();

  const promise = Promise.resolve([1, 2, 3, 4]);
  resonant.add('promiseArray', promise);

  await new Promise(r => setTimeout(r, 100));

  // Should become observable array
  assert.strictEqual(context.promiseArray.length, 4);
  assert.deepStrictEqual(Array.from(context.promiseArray), [1, 2, 3, 4]);

  // Should be reactive
  let callbackFired = false;
  resonant.addCallback('promiseArray', () => { callbackFired = true; });

  context.promiseArray.push(5);
  await new Promise(r => setTimeout(r, 20));

  assert.strictEqual(callbackFired, true);
  assert.strictEqual(context.promiseArray.length, 5);
});

test('add with fetch Response resolves JSON correctly', async () => {
  const { context, resonant } = createResonant();

  // Mock Response object
  const mockResponse = {
    constructor: { name: 'Response' },
    json: async () => ({ id: 123, name: 'Test User' })
  };

  resonant.add('fetchData', mockResponse);

  // Wait for json() to be called and resolved
  await new Promise(r => setTimeout(r, 10));

  // Data should be added after JSON parsing
  assert.strictEqual(context.fetchData.id, 123);
  assert.strictEqual(context.fetchData.name, 'Test User');
});

test('add with fetch Response json() rejection handles error', async () => {
  const { context, resonant } = createResonant();

  const errorLogs = [];
  const originalError = console.error;
  console.error = (...args) => errorLogs.push(args);

  // Mock Response with failing json()
  const mockResponse = {
    constructor: { name: 'Response' },
    json: async () => {
      throw new Error('Invalid JSON');
    }
  };

  resonant.add('badFetchData', mockResponse);

  // Wait for json() rejection
  await new Promise(r => setTimeout(r, 10));

  // Should log error
  assert(errorLogs.length > 0);

  // Data should remain undefined
  assert.strictEqual(context.badFetchData, undefined);

  console.error = originalError;
});

test('add with nested Promise (Promise that resolves to object with data)', async () => {
  const { context, resonant } = createResonant();

  const nestedPromise = Promise.resolve({
    user: { id: 1, name: 'Alice' },
    posts: [{ title: 'First' }, { title: 'Second' }]
  });

  resonant.add('nestedData', nestedPromise);

  await new Promise(r => setTimeout(r, 100));

  // Nested object should be reactive
  assert.strictEqual(context.nestedData.user.name, 'Alice');
  assert.strictEqual(context.nestedData.posts.length, 2);

  // Test reactivity
  let callbackFired = false;
  resonant.addCallback('nestedData', () => { callbackFired = true; });

  context.nestedData.user.name = 'Bob';
  await new Promise(r => setTimeout(r, 20));

  assert.strictEqual(callbackFired, true);
});

// ============================================
// Array Edge Cases - Length & Indices
// ============================================

test('setting array length to expand array', async () => {
  const { context, resonant } = createResonant();

  resonant.add('expandArray', [1, 2, 3]);
  assert.strictEqual(context.expandArray.length, 3);

  // Expand array by setting length
  context.expandArray.length = 6;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.expandArray.length, 6);
  assert.strictEqual(context.expandArray[3], undefined);
  assert.strictEqual(context.expandArray[5], undefined);
});

test('setting array length to shrink array triggers callbacks', async () => {
  const { context, resonant } = createResonant();

  let callbackResult;
  resonant.add('shrinkArray', ['a', 'b', 'c', 'd', 'e']);
  resonant.addCallback('shrinkArray', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  // Shrink array
  context.shrinkArray.length = 2;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.shrinkArray.length, 2);
  assert.deepStrictEqual(Array.from(context.shrinkArray), ['a', 'b']);
  assert.strictEqual(callbackResult.action, 'removed');
});

test('setting array length to negative returns false', () => {
  const { context, resonant } = createResonant();

  resonant.add('negArray', [1, 2, 3]);
  const originalLength = context.negArray.length;

  // Try to set negative length
  context.negArray.length = -1;

  // Length should remain unchanged
  assert.strictEqual(context.negArray.length, originalLength);
});

test('setting array length to non-integer returns false', () => {
  const { context, resonant } = createResonant();

  resonant.add('floatArray', [1, 2, 3]);
  const originalLength = context.floatArray.length;

  // Try to set decimal length
  context.floatArray.length = 2.5;

  // Length should remain unchanged
  assert.strictEqual(context.floatArray.length, originalLength);
});

test('array assignment beyond current length creates sparse array', async () => {
  const { context, resonant } = createResonant();

  resonant.add('sparseArray', [1, 2]);
  assert.strictEqual(context.sparseArray.length, 2);

  // Assign beyond current length
  context.sparseArray[5] = 'six';
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.sparseArray.length, 6);
  assert.strictEqual(context.sparseArray[5], 'six');
  assert.strictEqual(context.sparseArray[3], undefined);
  assert.strictEqual(context.sparseArray[4], undefined);
});

test('negative array indices do not trigger array operations', async () => {
  const { context, resonant } = createResonant();

  let callbackCount = 0;
  resonant.add('negIndexArray', [1, 2, 3]);
  resonant.addCallback('negIndexArray', () => { callbackCount++; });

  // Try to use negative index (should be treated as object property, not array index)
  context.negIndexArray[-1] = 'negative';
  await new Promise(r => setTimeout(r, 10));

  // Array length should be unchanged
  assert.strictEqual(context.negIndexArray.length, 3);

  // Property should exist as object property
  assert.strictEqual(context.negIndexArray[-1], 'negative');

  // Should not trigger array-specific callbacks
  // (might trigger modified callback for object property)
});

test('numeric string indices work like numeric indices', async () => {
  const { context, resonant } = createResonant();

  let callbackResult;
  resonant.add('stringIndexArray', ['a', 'b', 'c']);
  resonant.addCallback('stringIndexArray', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  // Use string index
  context.stringIndexArray['1'] = 'modified';
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.stringIndexArray[1], 'modified');
  assert.strictEqual(callbackResult.action, 'modified');
});

test('delete operator on array index creates hole', async () => {
  const { context, resonant } = createResonant();

  let callbackResult;
  resonant.add('deleteArray', ['a', 'b', 'c', 'd']);
  resonant.addCallback('deleteArray', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  // Delete element
  delete context.deleteArray[1];
  await new Promise(r => setTimeout(r, 10));

  // Length unchanged, but element removed
  assert.strictEqual(context.deleteArray.length, 4);
  assert.strictEqual(context.deleteArray[1], undefined);
  assert.strictEqual(callbackResult.action, 'removed');
});

test('pop on empty array returns undefined', () => {
  const { context, resonant } = createResonant();

  resonant.add('emptyArray', []);
  const result = context.emptyArray.pop();

  assert.strictEqual(result, undefined);
  assert.strictEqual(context.emptyArray.length, 0);
});

test('shift on empty array returns undefined', () => {
  const { context, resonant } = createResonant();

  resonant.add('emptyArray2', []);
  const result = context.emptyArray2.shift();

  assert.strictEqual(result, undefined);
  assert.strictEqual(context.emptyArray2.length, 0);
});

// ============================================
// Null/Undefined Handling Tests
// ============================================

// Note: Framework has a bug where adding null directly fails (tries to access null.constructor)
// Testing workarounds and edge cases instead

test('setting primitive value to null after initialization', async () => {
  const { context, resonant } = createResonant();

  resonant.add('nullableValue', 'initial');
  assert.strictEqual(context.nullableValue, 'initial');

  let callbackResult;
  resonant.addCallback('nullableValue', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  context.nullableValue = null;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.nullableValue, null);
  assert.strictEqual(callbackResult.action, 'modified');
});

test('setting primitive value to undefined after initialization', async () => {
  const { context, resonant } = createResonant();

  resonant.add('undefinableValue', 'initial');
  assert.strictEqual(context.undefinableValue, 'initial');

  context.undefinableValue = undefined;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.undefinableValue, undefined);
});

test('setting object property to null triggers callback', async () => {
  const { context, resonant } = createResonant();

  let callbackResult;
  resonant.add('objWithNull', { name: 'John', age: 30 });
  resonant.addCallback('objWithNull', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  context.objWithNull.age = null;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.objWithNull.age, null);
  assert.strictEqual(callbackResult.action, 'modified');
});

test('setting object property to undefined triggers callback', async () => {
  const { context, resonant } = createResonant();

  let callbackResult;
  resonant.add('objWithUndefined', { name: 'John', age: 30 });
  resonant.addCallback('objWithUndefined', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  context.objWithUndefined.age = undefined;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.objWithUndefined.age, undefined);
  assert.strictEqual(callbackResult.action, 'modified');
});

test('array with null elements', async () => {
  const { context, resonant } = createResonant();

  resonant.add('arrayWithNulls', [1, null, 3, null, 5]);

  assert.strictEqual(context.arrayWithNulls.length, 5);
  assert.strictEqual(context.arrayWithNulls[0], 1);
  assert.strictEqual(context.arrayWithNulls[1], null);
  assert.strictEqual(context.arrayWithNulls[3], null);

  // Modify null element
  context.arrayWithNulls[1] = 2;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.arrayWithNulls[1], 2);
});

test('array with undefined elements', async () => {
  const { context, resonant } = createResonant();

  resonant.add('arrayWithUndefined', [1, undefined, 3, undefined, 5]);

  assert.strictEqual(context.arrayWithUndefined.length, 5);
  assert.strictEqual(context.arrayWithUndefined[1], undefined);
  assert.strictEqual(context.arrayWithUndefined[3], undefined);

  // Push undefined
  context.arrayWithUndefined.push(undefined);
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.arrayWithUndefined.length, 6);
  assert.strictEqual(context.arrayWithUndefined[5], undefined);
});

test('deleting object property triggers removed callback', async () => {
  const { context, resonant } = createResonant();

  let callbackResult;
  resonant.add('objDelete', { name: 'John', age: 30, city: 'NYC' });
  resonant.addCallback('objDelete', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  delete context.objDelete.age;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.objDelete.age, undefined);
  assert.strictEqual(callbackResult.action, 'removed');
  assert.strictEqual('age' in context.objDelete, false);
});

test('deleting non-existent property does not error', async () => {
  const { context, resonant } = createResonant();

  resonant.add('objNoProp', { name: 'John' });

  // Should not throw
  delete context.objNoProp.nonExistent;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.objNoProp.nonExistent, undefined);
});

test('accessing undefined nested properties', () => {
  const { context, resonant } = createResonant();

  resonant.add('deepObj', { level1: { level2: { level3: 'value' } } });

  // Access non-existent path
  assert.strictEqual(context.deepObj.nonExistent, undefined);
  assert.strictEqual(context.deepObj.level1.nonExistent, undefined);
});

test('null in nested structures', async () => {
  const { context, resonant } = createResonant();

  resonant.add('nestedNull', {
    user: null,
    data: { value: null }
  });

  assert.strictEqual(context.nestedNull.user, null);
  assert.strictEqual(context.nestedNull.data.value, null);

  // Set null to object
  context.nestedNull.user = { name: 'John' };
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.nestedNull.user.name, 'John');
});

// ============================================
// Computed Properties - Advanced Tests
// ============================================

test('computed property with nested path dependency', async () => {
  const { context, resonant } = createResonant();

  resonant.add('user', { profile: { name: 'John', age: 30 } });

  vm.runInContext(`
    resonant.computed('greeting', () => {
      return 'Hello, ' + user.profile.name + '!';
    });
  `, context);

  assert.strictEqual(context.greeting, 'Hello, John!');

  // Update nested property
  context.user.profile.name = 'Jane';
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.greeting, 'Hello, Jane!');
});

test('computed property depends on array length', async () => {
  const { context, resonant } = createResonant();

  resonant.add('items', [1, 2, 3]);

  vm.runInContext(`
    resonant.computed('itemCount', () => {
      return items.length;
    });
  `, context);

  assert.strictEqual(context.itemCount, 3);

  // Add item
  context.items.push(4);
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.itemCount, 4);

  // Remove item
  context.items.pop();
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.itemCount, 3);
});

test('computed property depends on array contents', async () => {
  const { context, resonant } = createResonant();

  resonant.add('numbers', [1, 2, 3, 4]);

  vm.runInContext(`
    resonant.computed('sum', () => {
      let total = 0;
      for (let i = 0; i < numbers.length; i++) {
        total += numbers[i];
      }
      return total;
    });
  `, context);

  assert.strictEqual(context.sum, 10);

  // Add number
  context.numbers.push(5);
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.sum, 15);

  // Modify element
  context.numbers[0] = 10;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.sum, 24);
});

test('computed property depends on deeply nested array property', async () => {
  const { context, resonant } = createResonant();

  resonant.add('data', {
    users: [
      { name: 'Alice', scores: [10, 20, 30] },
      { name: 'Bob', scores: [15, 25, 35] }
    ]
  });

  
  vm.runInContext(`
    resonant.computed('firstUserTotal', () => {
      if (!data.users || data.users.length === 0) return 0;
      const scores = data.users[0].scores;
      let total = 0;
      for (let i = 0; i < scores.length; i++) {
        total += scores[i];
      }
      return total;
    });
  `, context);

  assert.strictEqual(context.firstUserTotal, 60);

  // Update nested array
  context.data.users[0].scores.push(40);
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.firstUserTotal, 100);

  // Modify element in nested array
  context.data.users[0].scores[0] = 20;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.firstUserTotal, 110);
});

test('multiple computed properties update in correct order', async () => {
  const { context, resonant } = createResonant();

  resonant.add('x', 5);

  
  vm.runInContext(`
    resonant.computed('doubled', () => {
      return x * 2;
    });

    resonant.computed('quadrupled', () => {
      return doubled * 2;
    });
  `, context);

  assert.strictEqual(context.doubled, 10);
  assert.strictEqual(context.quadrupled, 20);

  // Update x
  context.x = 10;
  await new Promise(r => setTimeout(r, 10));

  // Both should update
  assert.strictEqual(context.doubled, 20);
  assert.strictEqual(context.quadrupled, 40);
});

test('computed property with array filter/map operations', async () => {
  const { context, resonant } = createResonant();

  resonant.add('todos', [
    { text: 'Task 1', done: false },
    { text: 'Task 2', done: true },
    { text: 'Task 3', done: false }
  ]);

  
  vm.runInContext(`
    resonant.computed('activeTodos', () => {
      return todos.filter(todo => !todo.done).length;
    });
  `, context);

  assert.strictEqual(context.activeTodos, 2);

  // Mark one as done
  context.todos[0].done = true;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.activeTodos, 1);

  // Add new todo
  context.todos.push({ text: 'Task 4', done: false });
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.activeTodos, 2);
});

test('computed property depending on multiple nested paths', async () => {
  const { context, resonant } = createResonant();

  resonant.add('order', {
    items: [
      { name: 'Item 1', price: 10, quantity: 2 },
      { name: 'Item 2', price: 20, quantity: 1 }
    ],
    discount: 0.1
  });

  
  vm.runInContext(`
    resonant.computed('total', () => {
      let subtotal = 0;
      for (let i = 0; i < order.items.length; i++) {
        subtotal += order.items[i].price * order.items[i].quantity;
      }
      return subtotal * (1 - order.discount);
    });
  `, context);

  assert.strictEqual(context.total, 36); // (10*2 + 20*1) * 0.9 = 36

  // Update discount
  context.order.discount = 0.2;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.total, 32); // 40 * 0.8 = 32

  // Update item quantity
  context.order.items[0].quantity = 3;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.total, 40); // (10*3 + 20*1) * 0.8 = 40
});
