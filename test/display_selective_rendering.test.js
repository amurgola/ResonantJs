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

test('res-display on array items: updating one item does not re-evaluate display on other items', async () => {
  // Build DOM: a list of items, each with a res-display element
  const root = new MockElement('div');

  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'tasks');

  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  li.appendChild(nameSpan);

  // Each item has a display conditional based on item's "active" property
  const statusSpan = new MockElement('span');
  statusSpan.setAttribute('res-display', 'active');
  li.appendChild(statusSpan);

  ul.appendChild(li);
  root.appendChild(ul);

  const { context, resonant } = createResonantDom(root);

  resonant.add('tasks', [
    { name: 'Task A', active: true },
    { name: 'Task B', active: true },
    { name: 'Task C', active: false }
  ]);

  // Get rendered items
  const renderedItems = ul.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedItems.length, 3, 'Should have 3 rendered items');

  // Verify initial display state
  const itemADisplay = renderedItems[0].querySelector('[res-display]');
  const itemBDisplay = renderedItems[1].querySelector('[res-display]');
  const itemCDisplay = renderedItems[2].querySelector('[res-display]');

  assert.strictEqual(itemADisplay.style.display, 'inherit', 'Task A display should be visible');
  assert.strictEqual(itemBDisplay.style.display, 'inherit', 'Task B display should be visible');
  assert.strictEqual(itemCDisplay.style.display, 'none', 'Task C display should be hidden');

  // Track style.display changes via a proxy-like approach
  const displayChanges = { A: 0, B: 0, C: 0 };
  const origADisplay = itemADisplay.style.display;
  const origBDisplay = itemBDisplay.style.display;
  const origCDisplay = itemCDisplay.style.display;

  // Patch style objects to track writes
  function trackDisplayWrites(element, label) {
    let currentDisplay = element.style.display;
    const styleProxy = new Proxy(element.style, {
      set(target, prop, value) {
        if (prop === 'display') {
          displayChanges[label]++;
        }
        target[prop] = value;
        return true;
      }
    });
    element.style = styleProxy;
  }

  trackDisplayWrites(itemADisplay, 'A');
  trackDisplayWrites(itemBDisplay, 'B');
  trackDisplayWrites(itemCDisplay, 'C');

  // Update only Task A's name (not the active property)
  context.tasks[0].name = 'Task A Updated';
  await new Promise(r => setTimeout(r, 10));

  // Task A's display may get re-evaluated since its item changed
  // But Task B and Task C should NOT have their display re-evaluated
  console.log('Display changes after updating Task A name:', displayChanges);

  assert.strictEqual(displayChanges.B, 0,
    'Task B display should NOT be re-evaluated when Task A changes');
  assert.strictEqual(displayChanges.C, 0,
    'Task C display should NOT be re-evaluated when Task A changes');

  // Verify display states are still correct
  assert.strictEqual(itemADisplay.style.display, 'inherit', 'Task A should still be visible');
  assert.strictEqual(itemBDisplay.style.display, 'inherit', 'Task B should still be visible');
  assert.strictEqual(itemCDisplay.style.display, 'none', 'Task C should still be hidden');
});

test('res-display on array items: toggling active on one item does not affect others', async () => {
  const root = new MockElement('div');

  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'items');

  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  li.appendChild(nameSpan);

  const visibleSpan = new MockElement('span');
  visibleSpan.setAttribute('res-display', 'visible');
  li.appendChild(visibleSpan);

  ul.appendChild(li);
  root.appendChild(ul);

  const { context, resonant } = createResonantDom(root);

  resonant.add('items', [
    { name: 'Item 1', visible: true },
    { name: 'Item 2', visible: true },
    { name: 'Item 3', visible: true }
  ]);

  const renderedItems = ul.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedItems.length, 3);

  // Get display elements fresh (they were cloned during render)
  const item1Display = renderedItems[0].querySelector('[res-display]');
  const item2Display = renderedItems[1].querySelector('[res-display]');
  const item3Display = renderedItems[2].querySelector('[res-display]');

  // All should be visible initially
  assert.strictEqual(item1Display.style.display, 'inherit');
  assert.strictEqual(item2Display.style.display, 'inherit');
  assert.strictEqual(item3Display.style.display, 'inherit');

  // Record display values before update
  const item1DisplayBefore = item1Display.style.display;
  const item3DisplayBefore = item3Display.style.display;

  // Toggle item 2's visibility off
  context.items[1].visible = false;
  await new Promise(r => setTimeout(r, 10));

  // Item 2's display should change - get the element again since _renderArray may clone
  const updatedItems = ul.querySelectorAll('[res-rendered="true"]');
  const updatedItem1Display = updatedItems[0].querySelector('[res-display]');
  const updatedItem2Display = updatedItems[1].querySelector('[res-display]');
  const updatedItem3Display = updatedItems[2].querySelector('[res-display]');

  assert.strictEqual(updatedItem2Display.style.display, 'none', 'Item 2 should be hidden');

  // Verify correct final state - items 1 and 3 should still be visible
  assert.strictEqual(updatedItem1Display.style.display, 'inherit', 'Item 1 should still be visible');
  assert.strictEqual(updatedItem3Display.style.display, 'inherit', 'Item 3 should still be visible');

  // Verify items 1 and 3 are the same DOM elements (not re-created)
  assert.strictEqual(updatedItem1Display, item1Display, 'Item 1 display element should be reused, not re-created');
  assert.strictEqual(updatedItem3Display, item3Display, 'Item 3 display element should be reused, not re-created');
});
