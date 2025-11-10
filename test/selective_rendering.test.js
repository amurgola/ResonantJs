const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { MockElement, MockDocument } = require('./mockDom');

function createResonantDom(root){
  const code = fs.readFileSync(path.join(__dirname,'..','resonant.js'),'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  context.document = new MockDocument(root);
  const store = {};
  context.localStorage = {
    getItem:key => (key in store? store[key]:null),
    setItem:(k,v)=>{store[k]=v;},
    removeItem:k=>{delete store[k];}
  };
  vm.createContext(context);
  vm.runInContext(code,context);
  const Resonant = vm.runInContext('Resonant',context);
  return { context, resonant: new Resonant(), root };
}

function resetAllRenderTracking(root) {
  function traverse(node) {
    if (node && typeof node.resetRenderTracking === 'function') {
      node.resetRenderTracking();
    }
    if (node && node.children) {
      node.children.forEach(child => traverse(child));
    }
  }
  traverse(root);
}

function collectRenderCounts(root) {
  const counts = [];
  function traverse(node) {
    if (node && typeof node.getRenderCount === 'function') {
      counts.push({
        element: node,
        tagName: node.tagName,
        attributes: { ...node.attributes },
        renderCount: node.getRenderCount()
      });
    }
    if (node && node.children) {
      node.children.forEach(child => traverse(child));
    }
  }
  traverse(root);
  return counts;
}

test('multiple independent variables - updating one should not affect others', async () => {
  // Create DOM structure with multiple independent variables
  const root = new MockElement('div');
  
  const span1 = new MockElement('span');
  span1.setAttribute('res', 'var1');
  root.appendChild(span1);
  
  const span2 = new MockElement('span');
  span2.setAttribute('res', 'var2');
  root.appendChild(span2);
  
  const span3 = new MockElement('span');
  span3.setAttribute('res', 'var3');
  root.appendChild(span3);

  const { context, resonant } = createResonantDom(root);
  
  // Initialize variables
  resonant.add('var1', 'initial1');
  resonant.add('var2', 'initial2');
  resonant.add('var3', 'initial3');
  
  // Verify initial state
  assert.strictEqual(span1.innerHTML, 'initial1');
  assert.strictEqual(span2.innerHTML, 'initial2');
  assert.strictEqual(span3.innerHTML, 'initial3');
  
  // Reset render tracking
  resetAllRenderTracking(root);
  
  // Update only var2
  context.var2 = 'updated2';
  await new Promise(r => setTimeout(r, 5));
  
  // Collect render counts
  const counts = collectRenderCounts(root);
  
  // Only span2 should have been re-rendered
  const span1Count = counts.find(c => c.attributes.res === 'var1')?.renderCount || 0;
  const span2Count = counts.find(c => c.attributes.res === 'var2')?.renderCount || 0;
  const span3Count = counts.find(c => c.attributes.res === 'var3')?.renderCount || 0;
  
  assert.strictEqual(span1Count, 0, 'var1 element should not have been re-rendered');
  assert.strictEqual(span2Count, 1, 'var2 element should have been re-rendered once');
  assert.strictEqual(span3Count, 0, 'var3 element should not have been re-rendered');
  
  // Verify values are correct
  assert.strictEqual(span1.innerHTML, 'initial1');
  assert.strictEqual(span2.innerHTML, 'updated2');
  assert.strictEqual(span3.innerHTML, 'initial3');
});

test('object properties - updating one property should not re-render other property elements', async () => {
  // Create DOM structure with object properties
  const root = new MockElement('div');
  
  const objContainer = new MockElement('div');
  objContainer.setAttribute('res', 'person');
  
  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  objContainer.appendChild(nameSpan);
  
  const ageSpan = new MockElement('span');
  ageSpan.setAttribute('res-prop', 'age');
  objContainer.appendChild(ageSpan);
  
  const emailSpan = new MockElement('span');
  emailSpan.setAttribute('res-prop', 'email');
  objContainer.appendChild(emailSpan);
  
  root.appendChild(objContainer);

  const { context, resonant } = createResonantDom(root);
  
  // Initialize object
  resonant.add('person', { name: 'John', age: 30, email: 'john@example.com' });
  
  // Verify initial state
  assert.strictEqual(nameSpan.innerHTML, 'John');
  assert.strictEqual(ageSpan.innerHTML, '30');
  assert.strictEqual(emailSpan.innerHTML, 'john@example.com');
  
  // Reset render tracking
  resetAllRenderTracking(root);
  
  // Update only the name property
  context.person.name = 'Jane';
  await new Promise(r => setTimeout(r, 5));
  
  // Collect render counts
  const counts = collectRenderCounts(root);
  
  // Only nameSpan should have been re-rendered
  const nameCount = nameSpan.getRenderCount();
  const ageCount = ageSpan.getRenderCount();
  const emailCount = emailSpan.getRenderCount();
  
  assert.strictEqual(nameCount, 1, 'name element should have been re-rendered once');
  assert.strictEqual(ageCount, 0, 'age element should not have been re-rendered');
  assert.strictEqual(emailCount, 0, 'email element should not have been re-rendered');
  
  // Verify values are correct
  assert.strictEqual(nameSpan.innerHTML, 'Jane');
  assert.strictEqual(ageSpan.innerHTML, '30');
  assert.strictEqual(emailSpan.innerHTML, 'john@example.com');
});

test('array items - updating one item should not re-render other items', async () => {
  // Create DOM structure with array items
  const root = new MockElement('ul');
  
  const li = new MockElement('li');
  li.setAttribute('res', 'people');
  
  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  li.appendChild(nameSpan);
  
  const ageSpan = new MockElement('span');
  ageSpan.setAttribute('res-prop', 'age');
  li.appendChild(ageSpan);
  
  root.appendChild(li);

  const { context, resonant } = createResonantDom(root);
  
  // Initialize array with multiple items
  resonant.add('people', [
    { name: 'John', age: 30 },
    { name: 'Jane', age: 25 },
    { name: 'Bob', age: 35 }
  ]);
  
  // Get rendered elements
  const renderedItems = root.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedItems.length, 3, 'Should have 3 rendered items');
  
  // Reset render tracking for all elements
  resetAllRenderTracking(root);
  
  // Update only the first item's name
  context.people[0].name = 'Johnny';
  await new Promise(r => setTimeout(r, 5));
  
  // Get rendered elements again
  const updatedItems = root.querySelectorAll('[res-rendered="true"]');
  
  // Check that only the first item's name element was re-rendered
  const firstItemNameSpan = updatedItems[0].querySelector('[res-prop="name"]');
  const firstItemAgeSpan = updatedItems[0].querySelector('[res-prop="age"]');
  const secondItemNameSpan = updatedItems[1].querySelector('[res-prop="name"]');
  const secondItemAgeSpan = updatedItems[1].querySelector('[res-prop="age"]');
  const thirdItemNameSpan = updatedItems[2].querySelector('[res-prop="name"]');
  const thirdItemAgeSpan = updatedItems[2].querySelector('[res-prop="age"]');
  
  // The first item should have been re-rendered (both name and age), but other items should not
  assert.strictEqual(firstItemNameSpan.getRenderCount(), 1, 'First item name should be re-rendered');
  assert.strictEqual(firstItemAgeSpan.getRenderCount(), 1, 'First item age should be re-rendered (whole item re-renders)');
  assert.strictEqual(secondItemNameSpan.getRenderCount(), 0, 'Second item name should not be re-rendered');
  assert.strictEqual(secondItemAgeSpan.getRenderCount(), 0, 'Second item age should not be re-rendered');
  assert.strictEqual(thirdItemNameSpan.getRenderCount(), 0, 'Third item name should not be re-rendered');
  assert.strictEqual(thirdItemAgeSpan.getRenderCount(), 0, 'Third item age should not be re-rendered');
  
  // Verify values are correct
  assert.strictEqual(firstItemNameSpan.innerHTML, 'Johnny');
  assert.strictEqual(firstItemAgeSpan.innerHTML, '30');
  assert.strictEqual(secondItemNameSpan.innerHTML, 'Jane');
  assert.strictEqual(secondItemAgeSpan.innerHTML, '25');
  assert.strictEqual(thirdItemNameSpan.innerHTML, 'Bob');
  assert.strictEqual(thirdItemAgeSpan.innerHTML, '35');
});

test('mixed scenarios - variables, objects, and arrays should not affect each other', async () => {
  // Create complex DOM structure with variables, objects, and arrays
  const root = new MockElement('div');
  
  // Simple variable
  const titleSpan = new MockElement('span');
  titleSpan.setAttribute('res', 'title');
  root.appendChild(titleSpan);
  
  // Object
  const userDiv = new MockElement('div');
  userDiv.setAttribute('res', 'user');
  const userNameSpan = new MockElement('span');
  userNameSpan.setAttribute('res-prop', 'name');
  const userEmailSpan = new MockElement('span');
  userEmailSpan.setAttribute('res-prop', 'email');
  userDiv.appendChild(userNameSpan);
  userDiv.appendChild(userEmailSpan);
  root.appendChild(userDiv);
  
  // Array
  const itemsUl = new MockElement('ul');
  const itemLi = new MockElement('li');
  itemLi.setAttribute('res', 'items');
  const itemValueSpan = new MockElement('span');
  itemValueSpan.setAttribute('res-prop', 'value');
  itemLi.appendChild(itemValueSpan);
  itemsUl.appendChild(itemLi);
  root.appendChild(itemsUl);

  const { context, resonant } = createResonantDom(root);
  
  // Initialize all data
  resonant.add('title', 'My App');
  resonant.add('user', { name: 'Alice', email: 'alice@example.com' });
  resonant.add('items', [{ value: 'Item 1' }, { value: 'Item 2' }]);
  
  // Verify initial state
  assert.strictEqual(titleSpan.innerHTML, 'My App');
  assert.strictEqual(userNameSpan.innerHTML, 'Alice');
  assert.strictEqual(userEmailSpan.innerHTML, 'alice@example.com');
  
  const renderedItems = itemsUl.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedItems.length, 2);
  assert.strictEqual(renderedItems[0].querySelector('[res-prop="value"]').innerHTML, 'Item 1');
  assert.strictEqual(renderedItems[1].querySelector('[res-prop="value"]').innerHTML, 'Item 2');
  
  // Reset render tracking
  resetAllRenderTracking(root);
  
  // Update only the user's email
  context.user.email = 'alice.new@example.com';
  await new Promise(r => setTimeout(r, 5));
  
  // Check that only user email was re-rendered
  assert.strictEqual(titleSpan.getRenderCount(), 0, 'Title should not be re-rendered');
  assert.strictEqual(userNameSpan.getRenderCount(), 0, 'User name should not be re-rendered');
  assert.strictEqual(userEmailSpan.getRenderCount(), 1, 'User email should be re-rendered');
  
  // Check array items were not re-rendered
  const currentItems = itemsUl.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(currentItems[0].querySelector('[res-prop="value"]').getRenderCount(), 0, 'First array item should not be re-rendered');
  assert.strictEqual(currentItems[1].querySelector('[res-prop="value"]').getRenderCount(), 0, 'Second array item should not be re-rendered');
  
  // Verify values are correct
  assert.strictEqual(titleSpan.innerHTML, 'My App');
  assert.strictEqual(userNameSpan.innerHTML, 'Alice');
  assert.strictEqual(userEmailSpan.innerHTML, 'alice.new@example.com');
  assert.strictEqual(currentItems[0].querySelector('[res-prop="value"]').innerHTML, 'Item 1');
  assert.strictEqual(currentItems[1].querySelector('[res-prop="value"]').innerHTML, 'Item 2');
});

test('array item property update should not affect other array items', async () => {
  // Create DOM structure with array of objects
  const root = new MockElement('ul');
  
  const li = new MockElement('li');
  li.setAttribute('res', 'products');
  
  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  li.appendChild(nameSpan);
  
  const priceSpan = new MockElement('span');
  priceSpan.setAttribute('res-prop', 'price');
  li.appendChild(priceSpan);
  
  const categorySpan = new MockElement('span');
  categorySpan.setAttribute('res-prop', 'category');
  li.appendChild(categorySpan);
  
  root.appendChild(li);

  const { context, resonant } = createResonantDom(root);
  
  // Initialize array with multiple products
  resonant.add('products', [
    { name: 'Laptop', price: 999, category: 'Electronics' },
    { name: 'Book', price: 20, category: 'Education' },
    { name: 'Shirt', price: 30, category: 'Clothing' }
  ]);
  
  // Get rendered elements
  const renderedItems = root.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedItems.length, 3);
  
  // Reset render tracking
  resetAllRenderTracking(root);
  
  // Update only the price of the second item
  context.products[1].price = 25;
  await new Promise(r => setTimeout(r, 5));
  
  // Check that only the second item's price was re-rendered
  const updatedItems = root.querySelectorAll('[res-rendered="true"]');
  const firstItemElements = updatedItems[0].querySelectorAll('[res-prop]');
  const secondItemElements = updatedItems[1].querySelectorAll('[res-prop]');
  const thirdItemElements = updatedItems[2].querySelectorAll('[res-prop]');
  
  // First item should not be re-rendered
  firstItemElements.forEach(el => {
    assert.strictEqual(el.getRenderCount(), 0, `First item ${el.getAttribute('res-prop')} should not be re-rendered`);
  });
  
  // Second item: entire item should be re-rendered when any property changes
  const secondItemName = Array.from(secondItemElements).find(el => el.getAttribute('res-prop') === 'name');
  const secondItemPrice = Array.from(secondItemElements).find(el => el.getAttribute('res-prop') === 'price');
  const secondItemCategory = Array.from(secondItemElements).find(el => el.getAttribute('res-prop') === 'category');
  
  assert.strictEqual(secondItemName.getRenderCount(), 1, 'Second item name should be re-rendered (whole item re-renders)');
  assert.strictEqual(secondItemPrice.getRenderCount(), 1, 'Second item price should be re-rendered');
  assert.strictEqual(secondItemCategory.getRenderCount(), 1, 'Second item category should be re-rendered (whole item re-renders)');
  
  // Third item should not be re-rendered
  thirdItemElements.forEach(el => {
    assert.strictEqual(el.getRenderCount(), 0, `Third item ${el.getAttribute('res-prop')} should not be re-rendered`);
  });
  
  // Verify values are correct
  assert.strictEqual(secondItemPrice.innerHTML, '25');
});

test('manual DOM changes should be preserved when updating unrelated array items', async () => {
  // Create DOM structure with array of objects
  const root = new MockElement('ul');

  const li = new MockElement('li');
  li.setAttribute('res', 'people');

  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  li.appendChild(nameSpan);

  const ageSpan = new MockElement('span');
  ageSpan.setAttribute('res-prop', 'age');
  li.appendChild(ageSpan);

  root.appendChild(li);

  const { context, resonant } = createResonantDom(root);

  // Initialize array with multiple people
  resonant.add('people', [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
    { name: 'Charlie', age: 35 }
  ]);

  // Get rendered elements
  const renderedItems = root.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedItems.length, 3, 'Should have 3 rendered items');

  // Verify initial values
  const firstItemNameSpan = renderedItems[0].querySelector('[res-prop="name"]');
  const secondItemNameSpan = renderedItems[1].querySelector('[res-prop="name"]');
  const thirdItemNameSpan = renderedItems[2].querySelector('[res-prop="name"]');

  assert.strictEqual(firstItemNameSpan.innerHTML, 'Alice');
  assert.strictEqual(secondItemNameSpan.innerHTML, 'Bob');
  assert.strictEqual(thirdItemNameSpan.innerHTML, 'Charlie');

  // Manually modify the first item's name directly in the DOM
  firstItemNameSpan.innerHTML = 'Manually Changed Alice';

  // Update the second item's name through the reactive system
  context.people[1].name = 'Robert';
  await new Promise(r => setTimeout(r, 5));

  // Get updated rendered elements
  const updatedItems = root.querySelectorAll('[res-rendered="true"]');

  // Verify the manually changed first item was NOT overwritten
  const updatedFirstItemNameSpan = updatedItems[0].querySelector('[res-prop="name"]');
  assert.strictEqual(updatedFirstItemNameSpan.innerHTML, 'Manually Changed Alice',
    'First item manual change should be preserved');

  // Verify the second item was updated correctly
  const updatedSecondItemNameSpan = updatedItems[1].querySelector('[res-prop="name"]');
  assert.strictEqual(updatedSecondItemNameSpan.innerHTML, 'Robert',
    'Second item should be updated to Robert');

  // Verify the third item remains unchanged
  const updatedThirdItemNameSpan = updatedItems[2].querySelector('[res-prop="name"]');
  assert.strictEqual(updatedThirdItemNameSpan.innerHTML, 'Charlie',
    'Third item should remain unchanged');
});

test('manual DOM changes in one array should be preserved when updating a different array', async () => {
  // Create DOM structure with two separate arrays
  const root = new MockElement('div');

  // First array container
  const firstArrayContainer = new MockElement('ul');
  const firstArrayTemplate = new MockElement('li');
  firstArrayTemplate.setAttribute('res', 'teamA');
  const firstArrayNameSpan = new MockElement('span');
  firstArrayNameSpan.setAttribute('res-prop', 'name');
  firstArrayTemplate.appendChild(firstArrayNameSpan);
  firstArrayContainer.appendChild(firstArrayTemplate);
  root.appendChild(firstArrayContainer);

  // Second array container
  const secondArrayContainer = new MockElement('ul');
  const secondArrayTemplate = new MockElement('li');
  secondArrayTemplate.setAttribute('res', 'teamB');
  const secondArrayNameSpan = new MockElement('span');
  secondArrayNameSpan.setAttribute('res-prop', 'name');
  secondArrayTemplate.appendChild(secondArrayNameSpan);
  secondArrayContainer.appendChild(secondArrayTemplate);
  root.appendChild(secondArrayContainer);

  const { context, resonant } = createResonantDom(root);

  // Initialize both arrays
  resonant.add('teamA', [
    { name: 'Alice' },
    { name: 'Bob' }
  ]);
  resonant.add('teamB', [
    { name: 'Charlie' },
    { name: 'Diana' }
  ]);

  // Get rendered elements for both arrays
  const teamAItems = firstArrayContainer.querySelectorAll('[res="teamA"][res-rendered="true"]');
  const teamBItems = secondArrayContainer.querySelectorAll('[res="teamB"][res-rendered="true"]');

  assert.strictEqual(teamAItems.length, 2, 'Should have 2 teamA items');
  assert.strictEqual(teamBItems.length, 2, 'Should have 2 teamB items');

  // Verify initial values
  assert.strictEqual(teamAItems[0].querySelector('[res-prop="name"]').innerHTML, 'Alice');
  assert.strictEqual(teamAItems[1].querySelector('[res-prop="name"]').innerHTML, 'Bob');
  assert.strictEqual(teamBItems[0].querySelector('[res-prop="name"]').innerHTML, 'Charlie');
  assert.strictEqual(teamBItems[1].querySelector('[res-prop="name"]').innerHTML, 'Diana');

  // Manually modify the second array's first item
  const teamBFirstItemNameSpan = teamBItems[0].querySelector('[res-prop="name"]');
  teamBFirstItemNameSpan.innerHTML = 'Manually Changed Charlie';

  // Update the FIRST array (teamA) through the reactive system
  context.teamA[0].name = 'Alicia';
  await new Promise(r => setTimeout(r, 5));

  // Get updated rendered elements
  const updatedTeamAItems = firstArrayContainer.querySelectorAll('[res="teamA"][res-rendered="true"]');
  const updatedTeamBItems = secondArrayContainer.querySelectorAll('[res="teamB"][res-rendered="true"]');

  // Verify the first array was updated correctly
  assert.strictEqual(updatedTeamAItems[0].querySelector('[res-prop="name"]').innerHTML, 'Alicia',
    'TeamA first item should be updated to Alicia');
  assert.strictEqual(updatedTeamAItems[1].querySelector('[res-prop="name"]').innerHTML, 'Bob',
    'TeamA second item should remain Bob');

  // Verify the second array's manual change was preserved (CRITICAL TEST)
  const updatedTeamBFirstItemNameSpan = updatedTeamBItems[0].querySelector('[res-prop="name"]');
  assert.strictEqual(updatedTeamBFirstItemNameSpan.innerHTML, 'Manually Changed Charlie',
    'TeamB manual change should be preserved when teamA is updated');
  assert.strictEqual(updatedTeamBItems[1].querySelector('[res-prop="name"]').innerHTML, 'Diana',
    'TeamB second item should remain Diana');
});