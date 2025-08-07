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

// Dynamic styling test
test('res-style updates class based on data changes', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'tasks');
  const status = new MockElement('span');
  status.setAttribute('res-style', "tasks.completed ? 'done' : ''");
  li.appendChild(status);
  ul.appendChild(li);
  const root = new MockElement('div');
  root.appendChild(ul);

  const { context, resonant } = createResonantDom(root);
  resonant.add('tasks', [{ completed: false }]);

  let rendered = ul.querySelector('[res-rendered="true"]');
  let statusEl = rendered.querySelector('[res-style]');
  assert.strictEqual(statusEl.classList.contains('done'), false);

  context.tasks[0].completed = true;
  await new Promise(r => setTimeout(r, 20));
  rendered = ul.querySelector('[res-rendered="true"]');
  statusEl = rendered.querySelector('[res-style]');
  assert.strictEqual(statusEl.classList.contains('done'), true);

  context.tasks[0].completed = false;
  await new Promise(r => setTimeout(r, 20));
  rendered = ul.querySelector('[res-rendered="true"]');
  statusEl = rendered.querySelector('[res-style]');
  assert.strictEqual(statusEl.classList.contains('done'), false);
});

// Click handling test
test('res-onclick and res-onclick-remove trigger correctly', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'items');
  const span = new MockElement('span');
  span.setAttribute('res-prop', 'name');
  const selectBtn = new MockElement('button');
  selectBtn.setAttribute('res-onclick', 'selectItem');
  const removeBtn = new MockElement('button');
  removeBtn.setAttribute('res-onclick-remove', 'id');
  li.appendChild(span);
  li.appendChild(selectBtn);
  li.appendChild(removeBtn);
  ul.appendChild(li);
  const root = new MockElement('div');
  root.appendChild(ul);

  const { context, resonant } = createResonantDom(root);
  context.selectItem = item => { context.selected = item.id; };
  resonant.add('items', [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);

  let rendered = ul.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(rendered.length, 2);

  rendered[1].querySelector('[res-onclick]').onclick();
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.selected, 2);

  rendered[0].querySelector('[res-onclick-remove]').onclick();
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(context.items.length, 1);
  assert.strictEqual(context.items[0].id, 2);
  rendered = ul.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(rendered.length, 1);
});
