const { describe, it } = require('node:test');
const assert = require('node:assert');
const { MockElement, createResonant } = require('./mockDom');

function wait(ms = 50) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('bindByCssSelector', () => {
    it('binds a scalar variable to elements matching a CSS class', async () => {
        const { context, resonant, document } = createResonant();

        const el = new MockElement('span');
        el.classList.add('output');
        document.body.appendChild(el);

        resonant.add('greeting', 'hello');
        resonant.bindByCssSelector('greeting', '.output');

        assert.strictEqual(el.innerHTML, 'hello');
    });

    it('updates bound elements when the variable changes', async () => {
        const { context, resonant, document } = createResonant();

        const el = new MockElement('span');
        el.classList.add('score');
        document.body.appendChild(el);

        resonant.add('points', 10);
        resonant.bindByCssSelector('points', '.score');
        assert.strictEqual(el.innerHTML, '10');

        context.points = 20;
        await wait();
        assert.strictEqual(el.innerHTML, '20');
    });

    it('updates multiple elements matching the selector', async () => {
        const { context, resonant, document } = createResonant();

        const el1 = new MockElement('span');
        el1.classList.add('val');
        const el2 = new MockElement('div');
        el2.classList.add('val');
        document.body.appendChild(el1);
        document.body.appendChild(el2);

        resonant.add('msg', 'hi');
        resonant.bindByCssSelector('msg', '.val');

        assert.strictEqual(el1.innerHTML, 'hi');
        assert.strictEqual(el2.innerHTML, 'hi');

        context.msg = 'bye';
        await wait();
        assert.strictEqual(el1.innerHTML, 'bye');
        assert.strictEqual(el2.innerHTML, 'bye');
    });

    it('silently ignores when no elements match the selector', async () => {
        const { resonant } = createResonant();

        resonant.add('ghost', 'boo');
        // Should not throw
        resonant.bindByCssSelector('ghost', '.nonexistent');
    });

    it('picks up elements added to the DOM after binding', async () => {
        const { context, resonant, document } = createResonant();

        resonant.add('late', 'initial');
        resonant.bindByCssSelector('late', '.dynamic');

        // No elements yet - that's fine
        const el = new MockElement('span');
        el.classList.add('dynamic');
        document.body.appendChild(el);

        // Update triggers a re-query of the DOM
        context.late = 'updated';
        await wait();
        assert.strictEqual(el.innerHTML, 'updated');
    });

    it('works with bindByCssSelector called on an object variable', async () => {
        const { context, resonant, document } = createResonant();

        const el = new MockElement('span');
        el.classList.add('obj-out');
        document.body.appendChild(el);

        resonant.add('user', { name: 'Alice', age: 30 });
        context.user.bindByCssSelector('.obj-out');

        const parsed = JSON.parse(el.innerHTML);
        assert.strictEqual(parsed.name, 'Alice');
        assert.strictEqual(parsed.age, 30);
    });

    it('works with bindByCssSelector called on an array variable', async () => {
        const { context, resonant, document } = createResonant();

        const el = new MockElement('span');
        el.classList.add('arr-out');
        document.body.appendChild(el);

        resonant.add('items', [1, 2, 3]);
        context.items.bindByCssSelector('.arr-out');

        assert.strictEqual(el.innerHTML, '[1,2,3]');
    });

    it('updates bound elements when array is mutated', async () => {
        const { context, resonant, document } = createResonant();

        const el = new MockElement('span');
        el.classList.add('arr-mut');
        document.body.appendChild(el);

        resonant.add('list', [1, 2]);
        context.list.bindByCssSelector('.arr-mut');
        assert.strictEqual(el.innerHTML, '[1,2]');

        context.list.push(3);
        await wait();
        assert.strictEqual(el.innerHTML, '[1,2,3]');
    });

    it('supports multiple selectors on the same variable', async () => {
        const { context, resonant, document } = createResonant();

        const el1 = new MockElement('span');
        el1.classList.add('a');
        const el2 = new MockElement('span');
        el2.classList.add('b');
        document.body.appendChild(el1);
        document.body.appendChild(el2);

        resonant.add('multi', { val: 'x' });
        context.multi.bindByCssSelector('.a');
        context.multi.bindByCssSelector('.b');

        assert.strictEqual(el1.innerHTML, JSON.stringify({ val: 'x' }));
        assert.strictEqual(el2.innerHTML, JSON.stringify({ val: 'x' }));

        context.multi.val = 'y';
        await wait();
        assert.strictEqual(el1.innerHTML, JSON.stringify({ val: 'y' }));
        assert.strictEqual(el2.innerHTML, JSON.stringify({ val: 'y' }));
    });

    it('sets value property on INPUT elements', async () => {
        const { context, resonant, document } = createResonant();

        const input = new MockElement('input');
        input.classList.add('my-input');
        input.value = '';
        document.body.appendChild(input);

        resonant.add('field', 'hello');
        resonant.bindByCssSelector('field', '.my-input');

        assert.strictEqual(input.value, 'hello');

        context.field = 'world';
        await wait();
        assert.strictEqual(input.value, 'world');
    });

    it('updates when object property changes', async () => {
        const { context, resonant, document } = createResonant();

        const el = new MockElement('span');
        el.classList.add('obj-watch');
        document.body.appendChild(el);

        resonant.add('config', { theme: 'dark' });
        context.config.bindByCssSelector('.obj-watch');

        const initial = JSON.parse(el.innerHTML);
        assert.strictEqual(initial.theme, 'dark');

        context.config.theme = 'light';
        await wait();

        const updated = JSON.parse(el.innerHTML);
        assert.strictEqual(updated.theme, 'light');
    });

    it('works with resonant instance method for all types', async () => {
        const { context, resonant, document } = createResonant();

        const el1 = new MockElement('span');
        el1.classList.add('str-target');
        const el2 = new MockElement('span');
        el2.classList.add('num-target');
        const el3 = new MockElement('span');
        el3.classList.add('obj-target');
        document.body.appendChild(el1);
        document.body.appendChild(el2);
        document.body.appendChild(el3);

        resonant.add('myStr', 'text');
        resonant.add('myNum', 42);
        resonant.add('myObj', { x: 1 });

        resonant.bindByCssSelector('myStr', '.str-target');
        resonant.bindByCssSelector('myNum', '.num-target');
        resonant.bindByCssSelector('myObj', '.obj-target');

        assert.strictEqual(el1.innerHTML, 'text');
        assert.strictEqual(el2.innerHTML, '42');
        assert.strictEqual(JSON.parse(el3.innerHTML).x, 1);
    });
});
