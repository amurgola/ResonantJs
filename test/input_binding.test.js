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

test('text input bidirectional binding', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'username');
  input.type = 'text';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('username', 'initial');
  
  assert.strictEqual(input.value, 'initial');
  assert.strictEqual(context.username, 'initial');
  
  // Simulate user typing
  input.value = 'user_typed';
  input.oninput();
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.username, 'user_typed');
  assert.strictEqual(resonant.data.username, 'user_typed');
});

test('checkbox bidirectional binding', async () => {
  const checkbox = new MockElement('input');
  checkbox.setAttribute('res', 'isActive');
  checkbox.type = 'checkbox';
  const root = new MockElement('div');
  root.appendChild(checkbox);

  const { context, resonant } = createResonantDom(root);
  resonant.add('isActive', false);
  
  assert.strictEqual(checkbox.checked, false);
  assert.strictEqual(context.isActive, false);
  
  // Simulate user checking
  checkbox.checked = true;
  checkbox.onchange();
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.isActive, true);
  assert.strictEqual(resonant.data.isActive, true);
});

test('object property input binding', async () => {
  const container = new MockElement('div');
  container.setAttribute('res', 'user');
  const nameInput = new MockElement('input');
  nameInput.setAttribute('res-prop', 'name');
  nameInput.type = 'text';
  const emailInput = new MockElement('input');
  emailInput.setAttribute('res-prop', 'email');
  emailInput.type = 'text';
  container.appendChild(nameInput);
  container.appendChild(emailInput);
  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  resonant.add('user', { name: 'John', email: 'john@example.com' });
  
  assert.strictEqual(nameInput.value, 'John');
  assert.strictEqual(emailInput.value, 'john@example.com');
  
  // Simulate user editing name
  nameInput.value = 'Jane';
  nameInput.oninput();
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.user.name, 'Jane');
  assert.strictEqual(resonant.data.user.name, 'Jane');
  assert.strictEqual(emailInput.value, 'john@example.com'); // should remain unchanged
});

test('input binding prevents duplicate event handlers', () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'value');
  input.type = 'text';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('value', 'test');
  
  const firstHandler = input.oninput;
  assert.strictEqual(input.getAttribute('data-resonant-bound'), 'true');
  
  // Update the value again to trigger re-binding
  context.value = 'test2';
  
  // Handler should remain the same (no duplicate binding)
  assert.strictEqual(input.oninput, firstHandler);
});