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

test('template updates single value', async () => {
  const span = new MockElement('span');
  span.setAttribute('res','item');
  const root = new MockElement('div');
  root.appendChild(span);

  const { context, resonant } = createResonantDom(root);
  resonant.add('item','first');
  assert.strictEqual(span.innerHTML,'first');
  context.item = 'second';
  await new Promise(r=>setTimeout(r,5));
  assert.strictEqual(span.innerHTML,'second');
});

test('template updates object property', async () => {
  const holder = new MockElement('div');
  holder.setAttribute('res','person');
  const span = new MockElement('span');
  span.setAttribute('res-prop','name');
  holder.appendChild(span);
  const root = new MockElement('div');
  root.appendChild(holder);

  const { context, resonant } = createResonantDom(root);
  resonant.add('person',{name:'John'});
  assert.strictEqual(span.innerHTML,'John');
  context.person.name = 'Jane';
  await new Promise(r=>setTimeout(r,5));
  assert.strictEqual(span.innerHTML,'Jane');
});

test('template handles array of values', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res','items');
  const span = new MockElement('span');
  span.setAttribute('res-prop','');
  li.appendChild(span);
  ul.appendChild(li);
  const root = ul;

  const { context, resonant } = createResonantDom(root);
  resonant.add('items',['a']);
  let rendered = ul.querySelector('[res-rendered="true"]');
  assert.strictEqual(rendered.querySelector('[res-prop=""]').innerHTML,'a');
  context.items.set(0, 'b');
  await new Promise(r=>setTimeout(r,5));
  rendered = ul.querySelector('[res-rendered="true"]');
  assert.strictEqual(rendered.querySelector('[res-prop=""]').innerHTML,'b');
});

test('template handles array of objects', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res','people');
  const span = new MockElement('span');
  span.setAttribute('res-prop','name');
  li.appendChild(span);
  ul.appendChild(li);
  const root = ul;

  const { context, resonant } = createResonantDom(root);
  resonant.add('people',[{name:'John'}]);
  const getSpan = () => ul.querySelector('[res-rendered="true"] [res-prop="name"]');
  assert.strictEqual(getSpan().innerHTML,'John');
  context.people[0].name = 'Jack';
  await new Promise(r=>setTimeout(r,5));
  assert.strictEqual(getSpan().innerHTML,'Jack');
});

test('template updates array item when child property changes', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res','people');
  const span = new MockElement('span');
  span.setAttribute('res-prop','name');
  li.appendChild(span);
  ul.appendChild(li);
  const root = ul;

  const { context, resonant } = createResonantDom(root);
  resonant.add('people',[{name:'John'},{name:'Jane'}]);
  const getNames = () => Array.from(
    ul.querySelectorAll('[res-rendered="true"] [res-prop="name"]')
  ).map(el => el.innerHTML);

  assert.deepStrictEqual(getNames(), ['John','Jane']);
  context.people[0].name = 'Jack';
  await new Promise(r=>setTimeout(r,5));
  assert.deepStrictEqual(getNames(), ['Jack','Jane']);
});

test('template updates nested object property within array item', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res','people');
  const addressDiv = new MockElement('div');
  addressDiv.setAttribute('res-prop','address');
  const lineSpan = new MockElement('span');
  lineSpan.setAttribute('res-prop','line1');
  addressDiv.appendChild(lineSpan);
  li.appendChild(addressDiv);
  ul.appendChild(li);
  const root = ul;

  const { context, resonant } = createResonantDom(root);
  resonant.add('people',[{address:{line1:'a1'}}]);
  const getLine = () => ul.querySelector('[res-rendered="true"] [res-prop="line1"]');
  assert.strictEqual(getLine().innerHTML,'a1');
  context.people[0].address.line1 = 'b2';
  await new Promise(r=>setTimeout(r,5));
  assert.strictEqual(getLine().innerHTML,'b2');
});
