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

// ============================================
// Advanced Input Binding Tests
// ============================================

test('number input handles empty string', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'numberValue');
  input.type = 'number';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('numberValue', 42);

  assert.strictEqual(input.value, '42');

  // User clears the input
  input.value = '';
  input.oninput();
  await new Promise(r => setTimeout(r, 10));

  // Should be null or 0, not NaN or undefined
  assert(context.numberValue === null || context.numberValue === 0 || context.numberValue === '');
});

test('number input handles invalid number', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'numField');
  input.type = 'number';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('numField', 10);

  // User types invalid text
  input.value = 'abc';
  input.oninput();
  await new Promise(r => setTimeout(r, 10));

  // Should handle gracefully (null, 0, or keep previous value)
  assert(context.numField === null || context.numField === 0 || context.numField === 10);
});

test('number input with decimal values', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'decimal');
  input.type = 'number';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('decimal', 3.14);

  assert.strictEqual(input.value, '3.14');

  // User changes to different decimal
  input.value = '2.718';
  input.oninput();
  await new Promise(r => setTimeout(r, 10));

  // Should parse as number, not string
  assert.strictEqual(typeof context.decimal, 'number');
  assert(Math.abs(context.decimal - 2.718) < 0.001);
});

test('range input updates correctly', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'rangeValue');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('rangeValue', 50);

  assert.strictEqual(input.value, '50');

  // User drags slider
  input.value = '75';
  input.oninput();
  await new Promise(r => setTimeout(r, 10));

  // Should parse as number
  assert.strictEqual(typeof context.rangeValue, 'number');
  assert.strictEqual(context.rangeValue, 75);
});

test('textarea bidirectional binding', async () => {
  const textarea = new MockElement('textarea');
  textarea.setAttribute('res', 'textContent');
  const root = new MockElement('div');
  root.appendChild(textarea);

  const { context, resonant } = createResonantDom(root);
  resonant.add('textContent', 'Line 1\nLine 2\nLine 3');

  assert.strictEqual(textarea.value, 'Line 1\nLine 2\nLine 3');

  // User types multiline content
  textarea.value = 'New line 1\nNew line 2';
  textarea.oninput();
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.textContent, 'New line 1\nNew line 2');
});

test('radio button binding', async () => {
  const radio1 = new MockElement('input');
  radio1.setAttribute('res', 'selectedOption');
  radio1.type = 'radio';
  radio1.value = 'option1';

  const radio2 = new MockElement('input');
  radio2.setAttribute('res', 'selectedOption');
  radio2.type = 'radio';
  radio2.value = 'option2';

  const root = new MockElement('div');
  root.appendChild(radio1);
  root.appendChild(radio2);

  const { context, resonant } = createResonantDom(root);
  resonant.add('selectedOption', 'option1');

  // First radio should be checked
  assert.strictEqual(radio1.checked, true);
  assert.strictEqual(radio2.checked, false);

  // User selects second option
  radio2.checked = true;
  radio2.onchange();
  await new Promise(r => setTimeout(r, 10));

  // Should update to option2
  assert.strictEqual(context.selectedOption, 'option2');
});

test('select dropdown binding', async () => {
  const select = new MockElement('select');
  select.setAttribute('res', 'selectedValue');

  const option1 = new MockElement('option');
  option1.value = 'val1';
  const option2 = new MockElement('option');
  option2.value = 'val2';
  const option3 = new MockElement('option');
  option3.value = 'val3';

  select.appendChild(option1);
  select.appendChild(option2);
  select.appendChild(option3);

  const root = new MockElement('div');
  root.appendChild(select);

  const { context, resonant } = createResonantDom(root);
  resonant.add('selectedValue', 'val2');

  assert.strictEqual(select.value, 'val2');

  // User selects different option
  select.value = 'val3';
  select.onchange();
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.selectedValue, 'val3');
});

test('multiple input types in same object', async () => {
  const container = new MockElement('div');
  container.setAttribute('res', 'formData');

  const textInput = new MockElement('input');
  textInput.setAttribute('res-prop', 'name');
  textInput.type = 'text';

  const numberInput = new MockElement('input');
  numberInput.setAttribute('res-prop', 'age');
  numberInput.type = 'number';

  const checkbox = new MockElement('input');
  checkbox.setAttribute('res-prop', 'active');
  checkbox.type = 'checkbox';

  container.appendChild(textInput);
  container.appendChild(numberInput);
  container.appendChild(checkbox);

  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  resonant.add('formData', { name: 'John', age: 30, active: true });

  assert.strictEqual(textInput.value, 'John');
  assert.strictEqual(numberInput.value, '30');
  assert.strictEqual(checkbox.checked, true);

  // User updates all fields
  textInput.value = 'Jane';
  textInput.oninput();
  numberInput.value = '25';
  numberInput.oninput();
  checkbox.checked = false;
  checkbox.onchange();

  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(context.formData.name, 'Jane');
  assert.strictEqual(context.formData.age, 25);
  assert.strictEqual(context.formData.active, false);
});

test('input binding updates when model changes externally', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'externalUpdate');
  input.type = 'text';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('externalUpdate', 'initial');

  assert.strictEqual(input.value, 'initial');

  // Update from code (not user input)
  context.externalUpdate = 'programmatic';
  await new Promise(r => setTimeout(r, 10));

  // Input should reflect the change
  assert.strictEqual(input.value, 'programmatic');
});

test('input binding with special characters', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'specialChars');
  input.type = 'text';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('specialChars', '');

  // User types special characters
  input.value = '<script>alert("xss")</script>';
  input.oninput();
  await new Promise(r => setTimeout(r, 10));

  // Should store as-is (escaping is view layer responsibility)
  assert.strictEqual(context.specialChars, '<script>alert("xss")</script>');
});

test('checkbox with truthy/falsy non-boolean values', async () => {
  const checkbox = new MockElement('input');
  checkbox.setAttribute('res', 'truthyValue');
  checkbox.type = 'checkbox';
  const root = new MockElement('div');
  root.appendChild(checkbox);

  const { context, resonant } = createResonantDom(root);
  resonant.add('truthyValue', 1); // Truthy but not boolean

  // Should be checked for truthy value
  assert.strictEqual(checkbox.checked, true);

  // User unchecks
  checkbox.checked = false;
  checkbox.onchange();
  await new Promise(r => setTimeout(r, 10));

  // Should update to false (boolean)
  assert.strictEqual(context.truthyValue, false);
});

test('input binding performance with rapid changes', async () => {
  const input = new MockElement('input');
  input.setAttribute('res', 'rapidChanges');
  input.type = 'text';
  const root = new MockElement('div');
  root.appendChild(input);

  const { context, resonant } = createResonantDom(root);
  resonant.add('rapidChanges', '');

  // Simulate rapid typing
  for (let i = 0; i < 50; i++) {
    input.value += 'a';
    input.oninput();
  }

  await new Promise(r => setTimeout(r, 50));

  // Should have final value
  assert.strictEqual(context.rapidChanges.length, 50);
  assert.strictEqual(context.rapidChanges, 'a'.repeat(50));
});
