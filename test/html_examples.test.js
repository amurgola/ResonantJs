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

// Basic Variable Test

test('html basicVariable updates and display', async () => {
  const span = new MockElement('span');
  span.setAttribute('res', 'basicVariable');
  const before = new MockElement('div');
  before.setAttribute('res-display', "basicVariable == 'Initial'");
  const after = new MockElement('div');
  after.setAttribute('res-display', "basicVariable != 'Initial'");
  const root = new MockElement('div');
  root.appendChild(span);
  root.appendChild(before);
  root.appendChild(after);

  const { context, resonant } = createResonantDom(root);
  resonant.add('basicVariable', 'Initial');

  assert.strictEqual(span.innerHTML, 'Initial');
  assert.strictEqual(before.style.display, 'inherit');
  assert.strictEqual(after.style.display, 'none');

  context.basicVariable = 'Updated';
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(span.innerHTML, 'Updated');
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');
});

// Simple Object Test

test('html simpleObject updates and display', async () => {
  const holder = new MockElement('div');
  holder.setAttribute('res', 'simpleObject');
  const first = new MockElement('span');
  first.setAttribute('res-prop', 'firstName');
  const last = new MockElement('span');
  last.setAttribute('res-prop', 'lastName');
  holder.appendChild(first);
  holder.appendChild(last);
  const before = new MockElement('div');
  before.setAttribute('res-display', "firstName == 'John'");
  const after = new MockElement('div');
  after.setAttribute('res-display', "firstName != 'John'");
  holder.appendChild(before);
  holder.appendChild(after);
  const root = new MockElement('div');
  root.appendChild(holder);

  const { context, resonant } = createResonantDom(root);
  resonant.add('simpleObject', { firstName: 'John', lastName: 'Doe' });

  assert.strictEqual(first.innerHTML, 'John');
  assert.strictEqual(last.innerHTML, 'Doe');
  assert.strictEqual(before.style.display, 'inherit');
  assert.strictEqual(after.style.display, 'none');

  context.simpleObject.firstName = 'Jane';
  await new Promise(r => setTimeout(r, 5));

  assert.strictEqual(first.innerHTML, 'Jane');
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');
});

// Simple Array Update Test

test('html simpleArrayUpdate modifies existing items', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'simpleArrayUpdate');
  const first = new MockElement('span');
  first.setAttribute('res-prop', 'firstName');
  const last = new MockElement('span');
  last.setAttribute('res-prop', 'lastName');
  li.appendChild(first);
  li.appendChild(last);
  ul.appendChild(li);
  const before = new MockElement('div');
  before.setAttribute('res-display', "simpleArrayUpdate[0].firstName == 'John'");
  const after = new MockElement('div');
  after.setAttribute('res-display', "simpleArrayUpdate[0].firstName != 'John'");
  const container = new MockElement('div');
  container.appendChild(ul);
  container.appendChild(before);
  container.appendChild(after);
  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  resonant.add('simpleArrayUpdate', [
    { firstName: 'John', lastName: 'Doe' },
    { firstName: 'Jane', lastName: 'Doe' }
  ]);

  const getNames = () => Array.from(
    ul.querySelectorAll('li[res-rendered="true"]')
  ).map(li => {
    const f = li.querySelector('[res-prop="firstName"]').innerHTML;
    const l = li.querySelector('[res-prop="lastName"]').innerHTML;
    return `${f} ${l}`;
  });

  assert.deepStrictEqual(getNames(), ['John Doe', 'Jane Doe']);
  assert.strictEqual(before.style.display, 'inherit');
  assert.strictEqual(after.style.display, 'none');

  context.simpleArrayUpdate[0].firstName = 'Josh';
  context.simpleArrayUpdate[0].lastName = 'Forger';
  context.simpleArrayUpdate[1].firstName = 'Matilda';
  context.simpleArrayUpdate[1].lastName = 'Swinson';
  await new Promise(r => setTimeout(r, 5));

  assert.deepStrictEqual(getNames(), ['Josh Forger', 'Matilda Swinson']);
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');

  assert.strictEqual(ul.querySelectorAll('li[res-rendered="true"]').length, 2);
});

// Simple Array Add Test

test('html simpleArrayAdd adds item', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'simpleArrayAdd');
  const first = new MockElement('span');
  first.setAttribute('res-prop', 'firstName');
  const last = new MockElement('span');
  last.setAttribute('res-prop', 'lastName');
  li.appendChild(first);
  li.appendChild(last);
  ul.appendChild(li);
  const before = new MockElement('div');
  before.setAttribute('res-display', "simpleArrayAdd[2] === undefined");
  const after = new MockElement('div');
  after.setAttribute('res-display', "simpleArrayAdd[2] !== undefined");
  const container = new MockElement('div');
  container.appendChild(ul);
  container.appendChild(before);
  container.appendChild(after);
  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  resonant.add('simpleArrayAdd', [
    { firstName: 'John', lastName: 'Doe' },
    { firstName: 'Jane', lastName: 'Doe' }
  ]);

  const getNames = () => Array.from(
    ul.querySelectorAll('li[res-rendered="true"]')
  ).map(li => {
    const f = li.querySelector('[res-prop="firstName"]').innerHTML;
    const l = li.querySelector('[res-prop="lastName"]').innerHTML;
    return `${f} ${l}`;
  });

  assert.deepStrictEqual(getNames(), ['John Doe', 'Jane Doe']);
  assert.strictEqual(before.style.display, 'inherit');
  assert.strictEqual(after.style.display, 'none');

  context.simpleArrayAdd.push({ firstName: 'Josh', lastName: 'Forger' });
  await new Promise(r => setTimeout(r, 5));

  assert.deepStrictEqual(getNames(), ['John Doe', 'Jane Doe', 'Josh Forger']);
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');
});

// Simple Array Remove Test

test('html simpleArrayRemove removes item', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'simpleArrayRemove');
  const first = new MockElement('span');
  first.setAttribute('res-prop', 'firstName');
  const last = new MockElement('span');
  last.setAttribute('res-prop', 'lastName');
  li.appendChild(first);
  li.appendChild(last);
  ul.appendChild(li);
  const before = new MockElement('div');
  before.setAttribute('res-display', "simpleArrayRemove[0].firstName == 'John'");
  const after = new MockElement('div');
  after.setAttribute('res-display', "simpleArrayRemove[0].firstName != 'John'");
  const container = new MockElement('div');
  container.appendChild(ul);
  container.appendChild(before);
  container.appendChild(after);
  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  resonant.add('simpleArrayRemove', [
    { firstName: 'John', lastName: 'Doe' },
    { firstName: 'Jane', lastName: 'Doe' }
  ]);

  const getNames = () => Array.from(
    ul.querySelectorAll('li[res-rendered="true"]')
  ).map(li => {
    const f = li.querySelector('[res-prop="firstName"]').innerHTML;
    const l = li.querySelector('[res-prop="lastName"]').innerHTML;
    return `${f} ${l}`;
  });

  assert.deepStrictEqual(getNames(), ['John Doe', 'Jane Doe']);
  assert.strictEqual(before.style.display, 'inherit');
  assert.strictEqual(after.style.display, 'none');

  context.simpleArrayRemove.splice(0, 1);
  await new Promise(r => setTimeout(r, 5));

  assert.deepStrictEqual(getNames(), ['Jane Doe']);
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');
});

// Complex Array With Children Update

test('html complexArrayWithChildrenUpdate updates nested data', async () => {
  const tmpl = new MockElement('div');
  tmpl.setAttribute('res', 'complexArrayWithChildrenUpdate');
  const h3 = new MockElement('h3');
  const fSpan = new MockElement('span');
  fSpan.setAttribute('res-prop', 'firstName');
  const lSpan = new MockElement('span');
  lSpan.setAttribute('res-prop', 'lastName');
  h3.appendChild(fSpan);
  h3.appendChild(lSpan);
  const phoneUl = new MockElement('ul');
  const phoneLi = new MockElement('li');
  phoneLi.setAttribute('res-prop', 'phoneNumbers');
  phoneUl.appendChild(phoneLi);
  const addrUl = new MockElement('ul');
  const addrLi = new MockElement('li');
  addrLi.setAttribute('res-prop', 'addresses');
  const citySpan = new MockElement('span');
  citySpan.setAttribute('res-prop', 'city');
  const stateSpan = new MockElement('span');
  stateSpan.setAttribute('res-prop', 'state');
  addrLi.appendChild(citySpan);
  addrLi.appendChild(stateSpan);
  addrUl.appendChild(addrLi);
  tmpl.appendChild(h3);
  tmpl.appendChild(phoneUl);
  tmpl.appendChild(addrUl);

  const before = new MockElement('div');
  before.setAttribute('res-display', "complexArrayWithChildrenUpdate[0].firstName == 'John'");
  const after = new MockElement('div');
  after.setAttribute('res-display', "complexArrayWithChildrenUpdate[0].firstName != 'John'");

  const container = new MockElement('div');
  container.appendChild(tmpl);
  container.appendChild(before);
  container.appendChild(after);
  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  resonant.add('complexArrayWithChildrenUpdate', [
    {
      firstName: 'Michael',
      lastName: 'Smith',
      phoneNumbers: ['555-123-4567', '555-987-6543'],
      addresses: [
        { city: 'Chicago', state: 'IL' },
        { city: 'Seattle', state: 'WA' },
        { city: 'New York', state: 'NY' }
      ]
    },
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      phoneNumbers: ['555-234-5678', '555-876-5432', '555-345-6789'],
      addresses: [
        { city: 'Boston', state: 'MA' },
        { city: 'Austin', state: 'TX' }
      ]
    }
  ]);

  const getFirstItem = () => root.querySelectorAll('div[res="complexArrayWithChildrenUpdate"][res-rendered="true"]')[0];

  let firstItem = getFirstItem();
  assert.strictEqual(firstItem.querySelector('[res-prop="firstName"]').innerHTML, 'Michael');
  // initial display conditions
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');

  context.complexArrayWithChildrenUpdate[0].firstName = 'Josh';
  context.complexArrayWithChildrenUpdate[0].lastName = 'Forger';
  context.complexArrayWithChildrenUpdate[0].phoneNumbers[0] = '123-123-1234';
  context.complexArrayWithChildrenUpdate[0].addresses[1].city = 'Hudson';
  context.complexArrayWithChildrenUpdate[0].addresses[1].state = 'OH';
  await new Promise(r => setTimeout(r, 5));

  firstItem = getFirstItem();
  assert.strictEqual(firstItem.querySelector('[res-prop="firstName"]').innerHTML, 'Josh');
  const phones = Array.from(firstItem.querySelectorAll('li[res-prop="phoneNumbers"][res-rendered="true"]')).map(li => li.innerHTML);
  assert.deepStrictEqual(phones, ['123-123-1234', '555-987-6543']);
  const addresses = Array.from(firstItem.querySelectorAll('li[res-prop="addresses"][res-rendered="true"]'));
  assert.strictEqual(addresses[1].querySelector('[res-prop="city"]').innerHTML, 'Hudson');
  assert.strictEqual(addresses[1].querySelector('[res-prop="state"]').innerHTML, 'OH');
  assert.strictEqual(before.style.display, 'none');
  assert.strictEqual(after.style.display, 'inherit');

  // Add a new address to an array
    context.complexArrayWithChildrenUpdate[0].addresses.push({ city: 'Los Angeles', state: 'CA' });
    await new Promise(r => setTimeout(r, 5));
    //Check that total count of addresses is now six
    const updatedAddresses = Array.from(root.querySelectorAll('li[res-prop="addresses"][res-rendered="true"]'));
    assert.strictEqual(updatedAddresses.length, 6);

    //Check same number of people
    const people = root.querySelectorAll('div[res="complexArrayWithChildrenUpdate"][res-rendered="true"]');
    assert.strictEqual(people.length, 2);

    // Add a new phone number to an array
    context.complexArrayWithChildrenUpdate[0].phoneNumbers.push('555-111-2222');
    await new Promise(r => setTimeout(r, 5));


    // Make sure both phone numbers are equal to three
    assert.strictEqual(context.complexArrayWithChildrenUpdate[0].phoneNumbers.length, 3);
    assert.strictEqual(context.complexArrayWithChildrenUpdate[1].phoneNumbers.length, 3);

    // Check that total count of phone numbers is now six
    const updatedPhones = Array.from(root.querySelectorAll('li[res-prop="phoneNumbers"][res-rendered="true"]'));
    assert.strictEqual(updatedPhones.length, 6);

    // Check same number of people
    assert.strictEqual(people.length, 2);
});

// Complex Array With Children Display Update

test('html complexArrayWithChildrenDisplayUpdate toggles display', async () => {
  const tmpl = new MockElement('div');
  tmpl.setAttribute('res', 'complexArrayWithChildrenDisplayUpdate');
  const h3 = new MockElement('h3');
  const fSpan = new MockElement('span');
  fSpan.setAttribute('res-prop', 'firstName');
  const lSpan = new MockElement('span');
  lSpan.setAttribute('res-prop', 'lastName');
  h3.appendChild(fSpan);
  h3.appendChild(lSpan);
  const showDiv = new MockElement('div');
  showDiv.setAttribute('res-display', 'attributes.showOnPage');
  tmpl.appendChild(h3);
  tmpl.appendChild(showDiv);

  const root = new MockElement('div');
  root.appendChild(tmpl);

  const { context, resonant } = createResonantDom(root);
  resonant.add('complexArrayWithChildrenDisplayUpdate', [
    { firstName: 'Michael', lastName: 'Smith', attributes: { showOnPage: true } },
    { firstName: 'Sarah', lastName: 'Johnson', attributes: { showOnPage: true } }
  ]);

  const getItems = () => root.querySelectorAll('div[res="complexArrayWithChildrenDisplayUpdate"][res-rendered="true"]');

  let items = getItems();
  assert.strictEqual(items.length, 2);
  items.forEach(it => {
    assert.strictEqual(it.querySelector('div[res-display]').style.display, 'inherit');
  });

  context.complexArrayWithChildrenDisplayUpdate[0].attributes.showOnPage = false;
  context.complexArrayWithChildrenDisplayUpdate.forceUpdate();
  await new Promise(r => setTimeout(r, 5));

  items = getItems();
  assert.strictEqual(items[0].querySelector('div[res-display]').style.display, 'none');
  assert.strictEqual(items[1].querySelector('div[res-display]').style.display, 'inherit');
});

// Houses Example
test('html houses example renders nested contact information', async () => {
  const housesDiv = new MockElement('div');
  housesDiv.setAttribute('res', 'houses');

  const h3 = new MockElement('h3');
  h3.setAttribute('res-prop', 'name');

  const peopleDisplay = new MockElement('div');
  peopleDisplay.setAttribute('res-display', 'people.length > 0');

  const peopleDiv = new MockElement('div');
  peopleDiv.setAttribute('res-prop', 'people');

  const personName = new MockElement('span');
  personName.setAttribute('res-prop', 'name');

  const contactDiv = new MockElement('div');
  contactDiv.setAttribute('res-prop', 'contact');

  const emailSpan = new MockElement('span');
  emailSpan.setAttribute('res-prop', 'email');
  const phoneSpan = new MockElement('span');
  phoneSpan.setAttribute('res-prop', 'phone');

  contactDiv.appendChild(emailSpan);
  contactDiv.appendChild(phoneSpan);

  peopleDiv.appendChild(personName);
  peopleDiv.appendChild(contactDiv);
  peopleDisplay.appendChild(peopleDiv);

  const peopleEmpty = new MockElement('div');
  peopleEmpty.setAttribute('res-display', 'people.length == 0');

  housesDiv.appendChild(h3);
  housesDiv.appendChild(peopleDisplay);
  housesDiv.appendChild(peopleEmpty);

  const root = new MockElement('div');
  root.appendChild(housesDiv);

  const { context, resonant } = createResonantDom(root);
  resonant.add('houses', [
    {
      name: 'Blue House',
      people: [
        {
          name: 'John Doe',
          contact: [
            { email: 'john@example.com', phone: '123-456-7890' },
            { email: 'john@asdasdas.com', phone: '123-sss456-7890' }
          ]
        },
        {
          name: 'Jane Doe',
          contact: [ { email: 'jane@example.com', phone: '222-555-1234' } ]
        }
      ],
      newPerson: { name: '', contact: { email: '', phone: '' } }
    }
  ]);

  const houses = root.querySelectorAll('div[res="houses"][res-rendered="true"]');
  assert.strictEqual(houses.length, 1);

  const house = houses[0];
  assert.strictEqual(house.querySelector('[res-prop="name"]').innerHTML, 'Blue House');

  const peopleElems = house.querySelectorAll('div[res-prop="people"][res-rendered="true"]');
  assert.strictEqual(peopleElems.length, 2);
  const peopleNames = Array.from(peopleElems).map(p => p.querySelector('span[res-prop="name"]').innerHTML);
  assert.deepStrictEqual(peopleNames, ['John Doe', 'Jane Doe']);

  const contactElems = house.querySelectorAll('div[res-prop="contact"][res-rendered="true"]');
  const contacts = Array.from(contactElems).map(c => {
    const email = c.querySelector('span[res-prop="email"]').innerHTML;
    const phone = c.querySelector('span[res-prop="phone"]').innerHTML;
    return `${email} ${phone}`;
  });
  assert.deepStrictEqual(contacts, [
    'john@example.com 123-456-7890',
    'john@asdasdas.com 123-sss456-7890',
    'jane@example.com 222-555-1234'
  ]);

  const displayEls = house.querySelectorAll('[res-display]');
  assert.strictEqual(displayEls[0].style.display, 'inherit');
  assert.strictEqual(displayEls[1].style.display, 'none');
});

