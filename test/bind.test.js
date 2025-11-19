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

test('bind existing string variable', async () => {
  const { context, resonant } = createResonant();
  context.test = "yes";

  resonant.bind("test");

  assert.strictEqual(context.test, "yes");
  assert.strictEqual(resonant.data.test, "yes");

  context.test = "updated";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.test, "updated");
  assert.strictEqual(context.test, "updated");
});

test('bind existing number variable', async () => {
  const { context, resonant } = createResonant();
  context.count = 42;

  resonant.bind("count");

  assert.strictEqual(context.count, 42);
  assert.strictEqual(resonant.data.count, 42);

  context.count = 100;
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.count, 100);
  assert.strictEqual(context.count, 100);
});

test('bind existing object variable', async () => {
  const { context, resonant } = createResonant();
  context.user = { name: "John", age: 30 };

  resonant.bind("user");

  assert.strictEqual(context.user.name, "John");
  assert.strictEqual(context.user.age, 30);

  context.user.name = "Jane";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.user.name, "Jane");
  assert.strictEqual(context.user.name, "Jane");
});

test('bind existing array variable', async () => {
  const { context, resonant } = createResonant();
  context.items = ["apple", "banana", "cherry"];

  resonant.bind("items");

  assert.strictEqual(context.items.length, 3);
  assert.strictEqual(context.items[0], "apple");

  context.items.push("date");
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.items.length, 4);
  assert.strictEqual(context.items[3], "date");
});

test('bind triggers callbacks on updates', async () => {
  const { context, resonant } = createResonant();
  context.status = "idle";
  let callbackResult;

  resonant.bind("status");
  resonant.addCallback("status", (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  context.status = "active";
  await new Promise(r => setTimeout(r, 5));

  assert.deepStrictEqual(callbackResult, { newVal: "active", item: "active", action: "modified" });
});

test('bind supports computed properties', async () => {
  const { context, resonant } = createResonant();
  context.firstName = "John";
  context.lastName = "Doe";

  resonant.bind("firstName");
  resonant.bind("lastName");
  resonant.computed("fullName", () => `${context.firstName} ${context.lastName}`);

  assert.strictEqual(context.fullName, "John Doe");

  context.firstName = "Jane";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(context.fullName, "Jane Doe");
});

test('bind with persistence', async () => {
  const { context, resonant, store } = createResonant();
  context.savedValue = "initial";

  resonant.bind("savedValue", true);

  assert.strictEqual(store['res_savedValue'], '"initial"');

  context.savedValue = "persisted";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(store['res_savedValue'], '"persisted"');
});

test('bind warns on non-existent variable', () => {
  const { resonant } = createResonant();
  let warningMessage;

  const originalWarn = console.warn;
  console.warn = (msg) => { warningMessage = msg; };

  resonant.bind("nonExistent");

  console.warn = originalWarn;
  assert.strictEqual(warningMessage, 'Resonant.bind: variable "nonExistent" not found in window scope');
});

test('bind errors on non-string argument', () => {
  const { resonant } = createResonant();
  let errorMessage;

  const originalError = console.error;
  console.error = (msg) => { errorMessage = msg; };

  resonant.bind(42);

  console.error = originalError;
  assert.strictEqual(errorMessage, 'Resonant.bind: variableName must be a string');
});

test('bind boolean variable', async () => {
  const { context, resonant } = createResonant();
  context.isActive = true;

  resonant.bind("isActive");

  assert.strictEqual(context.isActive, true);

  context.isActive = false;
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.isActive, false);
  assert.strictEqual(context.isActive, false);
});

test('bind nested object properties', async () => {
  const { context, resonant } = createResonant();
  context.config = {
    settings: {
      theme: "dark",
      language: "en"
    }
  };

  resonant.bind("config");

  assert.strictEqual(context.config.settings.theme, "dark");

  context.config.settings.theme = "light";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.config.settings.theme, "light");
  assert.strictEqual(context.config.settings.theme, "light");
});

test('bind array of objects', async () => {
  const { context, resonant } = createResonant();
  context.users = [
    { name: "Alice", age: 25 },
    { name: "Bob", age: 30 }
  ];

  resonant.bind("users");

  assert.strictEqual(context.users.length, 2);
  assert.strictEqual(context.users[0].name, "Alice");

  context.users[0].name = "Alicia";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.users[0].name, "Alicia");
  assert.strictEqual(context.users[0].name, "Alicia");
});

test('bind null value', async () => {
  const { context, resonant } = createResonant();
  context.nullValue = null;

  resonant.bind("nullValue");

  assert.strictEqual(context.nullValue, null);

  context.nullValue = "not null";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.nullValue, "not null");
  assert.strictEqual(context.nullValue, "not null");
});

test('bind undefined value', async () => {
  const { context, resonant } = createResonant();
  context.undefinedValue = undefined;

  resonant.bind("undefinedValue");

  assert.strictEqual(context.undefinedValue, undefined);

  context.undefinedValue = "now defined";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.undefinedValue, "now defined");
  assert.strictEqual(context.undefinedValue, "now defined");
});

test('bind multiple variables', async () => {
  const { context, resonant } = createResonant();
  context.var1 = "value1";
  context.var2 = "value2";
  context.var3 = "value3";

  resonant.bind("var1");
  resonant.bind("var2");
  resonant.bind("var3");

  assert.strictEqual(context.var1, "value1");
  assert.strictEqual(context.var2, "value2");
  assert.strictEqual(context.var3, "value3");

  context.var2 = "updated2";
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.var2, "updated2");
  assert.strictEqual(context.var2, "updated2");
});

test('bind and modify array methods', async () => {
  const { context, resonant } = createResonant();
  context.numbers = [1, 2, 3];
  let callbackResult;

  resonant.bind("numbers");
  resonant.addCallback("numbers", (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });

  context.numbers.pop();
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(context.numbers.length, 2);
  assert.deepStrictEqual(callbackResult, { newVal: context.numbers, item: 3, action: 'removed' });
});

test('bind and replace entire array', async () => {
  const { context, resonant } = createResonant();
  context.list = [1, 2, 3];

  resonant.bind("list");

  assert.strictEqual(context.list.length, 3);

  context.list = [4, 5, 6, 7];
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.list.length, 4);
  assert.strictEqual(context.list[0], 4);
  assert.strictEqual(context.list[3], 7);
});

test('bind and replace entire object', async () => {
  const { context, resonant } = createResonant();
  context.obj = { a: 1, b: 2 };

  resonant.bind("obj");

  assert.strictEqual(context.obj.a, 1);

  context.obj = { x: 10, y: 20 };
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(resonant.data.obj.x, 10);
  assert.strictEqual(context.obj.y, 20);
  assert.strictEqual(context.obj.a, undefined);
});
