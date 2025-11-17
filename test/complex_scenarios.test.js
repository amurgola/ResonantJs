const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { MockElement, MockDocument } = require('./mockDom');

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

// ============================================
// Complex Scenario Tests
// ============================================

test('updating same variable multiple times rapidly', async () => {
  const { context, resonant } = createResonant();

  let callbackCount = 0;
  resonant.add('rapidUpdate', 0);
  resonant.addCallback('rapidUpdate', () => callbackCount++);

  // Rapidly update 100 times
  for (let i = 1; i <= 100; i++) {
    context.rapidUpdate = i;
  }

  await new Promise(r => setTimeout(r, 50));

  // Should have final value
  assert.strictEqual(context.rapidUpdate, 100);

  // Callbacks should have fired (may be debounced)
  assert(callbackCount > 0);
});

test('many callbacks on single variable all fire', async () => {
  const { context, resonant } = createResonant();

  const callbackResults = [];

  resonant.add('manyCallbacks', 'initial');

  // Add 15 callbacks
  for (let i = 0; i < 15; i++) {
    resonant.addCallback('manyCallbacks', () => {
      callbackResults.push(i);
    });
  }

  context.manyCallbacks = 'updated';
  await new Promise(r => setTimeout(r, 10));

  // All 15 callbacks should have fired
  assert.strictEqual(callbackResults.length, 15);
  assert(callbackResults.includes(0));
  assert(callbackResults.includes(14));
});

test('large array performance (100+ items)', async () => {
  const { context, resonant } = createResonant();

  // Create large array
  const largeArray = [];
  for (let i = 0; i < 150; i++) {
    largeArray.push({ id: i, name: `Item ${i}`, value: i * 10 });
  }

  const startTime = Date.now();
  resonant.add('largeArray', largeArray);
  const addTime = Date.now() - startTime;

  // Should complete reasonably fast (< 500ms)
  assert(addTime < 500, `Add took ${addTime}ms`);

  assert.strictEqual(context.largeArray.length, 150);

  // Modify an item
  const modifyStart = Date.now();
  context.largeArray[75].value = 999;
  await new Promise(r => setTimeout(r, 10));
  const modifyTime = Date.now() - modifyStart;

  assert.strictEqual(context.largeArray[75].value, 999);
  assert(modifyTime < 200, `Modify took ${modifyTime}ms`);
});

test('deeply nested res-display expressions', () => {
  const div1 = new MockElement('div');
  div1.setAttribute('res-display', 'user && user.profile && user.profile.settings && user.profile.settings.visible');

  const div2 = new MockElement('div');
  div2.setAttribute('res-display', "(items.length > 0 && items[0].active) || fallback === true");

  const root = new MockElement('div');
  root.appendChild(div1);
  root.appendChild(div2);

  const { context, resonant } = createResonantDom(root);

  resonant.add('user', {
    profile: {
      settings: {
        visible: true
      }
    }
  });

  resonant.add('items', [{ active: true }]);
  resonant.add('fallback', false);

  // Complex expressions should evaluate correctly
  assert.strictEqual(div1.style.display, 'inherit');
  assert.strictEqual(div2.style.display, 'inherit');
});

test('multiple reactive variables in computed property', async () => {
  const { context, resonant } = createResonant();

  resonant.add('firstName', 'John');
  resonant.add('lastName', 'Doe');
  resonant.add('age', 30);

  vm.runInContext(`
    resonant.computed('summary', () => {
      return firstName + ' ' + lastName + ' (' + age + ')';
    });
  `, context);

  assert.strictEqual(context.summary, 'John Doe (30)');

  // Update each variable
  context.firstName = 'Jane';
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(context.summary, 'Jane Doe (30)');

  context.lastName = 'Smith';
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(context.summary, 'Jane Smith (30)');

  context.age = 25;
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(context.summary, 'Jane Smith (25)');
});

test('computed property chain (3 levels)', async () => {
  const { context, resonant } = createResonant();

  resonant.add('base', 10);

  vm.runInContext(`
    resonant.computed('level1', () => base * 2);
    resonant.computed('level2', () => level1 + 5);
    resonant.computed('level3', () => level2 * 3);
  `, context);

  assert.strictEqual(context.level1, 20);
  assert.strictEqual(context.level2, 25);
  assert.strictEqual(context.level3, 75);

  context.base = 20;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.level1, 40);
  assert.strictEqual(context.level2, 45);
  assert.strictEqual(context.level3, 135);
});

test('mixed primitive and object array items', async () => {
  const { context, resonant } = createResonant();

  resonant.add('mixedArray', [
    1,
    'string',
    { id: 3, type: 'object' },
    true,
    null,
    { id: 6, type: 'another' }
  ]);

  assert.strictEqual(context.mixedArray[0], 1);
  assert.strictEqual(context.mixedArray[1], 'string');
  assert.strictEqual(context.mixedArray[2].type, 'object');
  assert.strictEqual(context.mixedArray[3], true);
  assert.strictEqual(context.mixedArray[4], null);

  // Modify object in mixed array
  context.mixedArray[2].type = 'modified';
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.mixedArray[2].type, 'modified');

  // Modify primitive in mixed array
  context.mixedArray[0] = 100;
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.mixedArray[0], 100);
});

test('object with 100+ properties', () => {
  const { context, resonant } = createResonant();

  const largeObj = {};
  for (let i = 0; i < 120; i++) {
    largeObj[`prop${i}`] = `value${i}`;
  }

  const startTime = Date.now();
  resonant.add('largeObj', largeObj);
  const duration = Date.now() - startTime;

  // Should complete reasonably fast
  assert(duration < 500, `Large object took ${duration}ms`);

  // Verify properties
  assert.strictEqual(context.largeObj.prop0, 'value0');
  assert.strictEqual(context.largeObj.prop119, 'value119');
});

test('100+ reactive variables', async () => {
  const { context, resonant } = createResonant();

  // Create 120 variables
  for (let i = 0; i < 120; i++) {
    resonant.add(`var${i}`, i);
  }

  // Verify all exist
  assert.strictEqual(context.var0, 0);
  assert.strictEqual(context.var50, 50);
  assert.strictEqual(context.var119, 119);

  // Update several
  context.var10 = 1000;
  context.var50 = 5000;
  context.var100 = 10000;

  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.var10, 1000);
  assert.strictEqual(context.var50, 5000);
  assert.strictEqual(context.var100, 10000);
});

test('complex nested structure update performance', async () => {
  const { context, resonant } = createResonant();

  resonant.add('complex', {
    users: [
      {
        id: 1,
        profile: {
          name: 'User 1',
          settings: {
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        posts: [
          { id: 1, title: 'Post 1', comments: [{ text: 'Comment 1' }] },
          { id: 2, title: 'Post 2', comments: [{ text: 'Comment 2' }] }
        ]
      },
      {
        id: 2,
        profile: {
          name: 'User 2',
          settings: {
            preferences: {
              theme: 'light',
              notifications: false
            }
          }
        },
        posts: []
      }
    ]
  });

  let callbackFired = false;
  resonant.addCallback('complex', () => { callbackFired = true; });

  // Deep update
  const startTime = Date.now();
  context.complex.users[0].posts[1].comments.push({ text: 'New Comment' });
  await new Promise(r => setTimeout(r, 20));
  const duration = Date.now() - startTime;

  assert(callbackFired);
  assert.strictEqual(context.complex.users[0].posts[1].comments.length, 2);
  assert(duration < 100, `Deep update took ${duration}ms`);
});

test('res-style with multiple space-separated classes', async () => {
  const span = new MockElement('span');
  span.setAttribute('res', 'item');
  span.setAttribute('res-style', "item.active ? 'active highlight important' : 'inactive'");

  const root = new MockElement('div');
  root.appendChild(span);

  const { context, resonant } = createResonantDom(root);
  resonant.add('item', { active: true });

  // Wait for res-style to be applied
  await new Promise(r => setTimeout(r, 10));

  // Should have all three classes
  assert(span.classList.contains('active'));
  assert(span.classList.contains('highlight'));
  assert(span.classList.contains('important'));

  // Toggle to inactive
  context.item.active = false;
  await new Promise(r => setTimeout(r, 10));

  assert(!span.classList.contains('active'));
  assert(!span.classList.contains('highlight'));
  assert(!span.classList.contains('important'));
  assert(span.classList.contains('inactive'));
});

test('res-display with ternary operator', async () => {
  const div = new MockElement('div');
  div.setAttribute('res-display', "status === 'active' ? true : false");

  const root = new MockElement('div');
  root.appendChild(div);

  const { context, resonant } = createResonantDom(root);
  resonant.add('status', 'active');

  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(div.style.display, 'inherit');

  context.status = 'inactive';
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(div.style.display, 'none');
});

test('addAll with many variables initializes correctly', () => {
  const { context, resonant } = createResonant();

  resonant.addAll({
    var1: 'value1',
    var2: 42,
    var3: [1, 2, 3],
    var4: { nested: 'object' },
    var5: true,
    var6: null,
    var7: { a: 1, b: 2 },
    var8: ['a', 'b', 'c']
  });

  assert.strictEqual(context.var1, 'value1');
  assert.strictEqual(context.var2, 42);
  assert.strictEqual(context.var3.length, 3);
  assert.strictEqual(context.var4.nested, 'object');
  assert.strictEqual(context.var5, true);
  assert.strictEqual(context.var6, null);
  assert.strictEqual(context.var7.b, 2);
  assert.strictEqual(context.var8[1], 'b');
});

test('persistence with multiple variables', () => {
  const { resonant, store } = createResonant();

  resonant.add('persist1', 'value1', true);
  resonant.add('persist2', { key: 'value2' }, true);
  resonant.add('persist3', [1, 2, 3], true);

  // Verify stored in localStorage
  assert(store.persist1 !== null);
  assert(store.persist2 !== null);
  assert(store.persist3 !== null);
});
