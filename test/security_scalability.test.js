const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { MockElement, MockDocument } = require('./mockDom');

function wait(ms = 50) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createResonantWithOptions(options = {}, root = null) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
    const doc = root ? new MockDocument(root) : new MockDocument();
    const context = {
        console,
        setTimeout,
        clearTimeout,
        structuredClone: typeof structuredClone === 'function' ? structuredClone : (obj) => JSON.parse(JSON.stringify(obj)),
        document: doc,
        window: null
    };
    context.window = context;
    const store = {};
    context.localStorage = {
        getItem: key => (key in store ? store[key] : null),
        setItem: (k, v) => { store[k] = v; },
        removeItem: key => { delete store[key]; }
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    const Resonant = vm.runInContext('Resonant', context);
    const resonant = new Resonant(options);
    context.resonant = resonant;
    return { context, resonant, document: doc, store };
}

// ============================================
// 1. XSS Mitigation: textContent by default
// ============================================

describe('XSS Mitigation - textContent default', () => {
    it('uses textContent for scalar values by default', () => {
        const el = new MockElement('div');
        el.setAttribute('res', 'msg');
        const root = new MockElement('div');
        root.appendChild(el);

        const { context, resonant } = createResonantWithOptions({}, root);
        resonant.add('msg', '<script>alert("xss")</script>');

        // textContent should be set, not innerHTML - content should be escaped
        assert.strictEqual(el.textContent, '<script>alert("xss")</script>');
    });

    it('uses innerHTML when res-html attribute is present', () => {
        const el = new MockElement('div');
        el.setAttribute('res', 'content');
        el.setAttribute('res-html', '');
        const root = new MockElement('div');
        root.appendChild(el);

        const { resonant } = createResonantWithOptions({}, root);
        resonant.add('content', '<b>bold</b>');

        assert.strictEqual(el.innerHTML, '<b>bold</b>');
    });

    it('uses textContent for object property rendering', () => {
        const container = new MockElement('div');
        container.setAttribute('res', 'user');
        const nameEl = new MockElement('span');
        nameEl.setAttribute('res-prop', 'name');
        container.appendChild(nameEl);
        const root = new MockElement('div');
        root.appendChild(container);

        const { resonant } = createResonantWithOptions({}, root);
        resonant.add('user', { name: '<img onerror=alert(1)>' });

        assert.strictEqual(nameEl.textContent, '<img onerror=alert(1)>');
    });

    it('uses innerHTML for object property with res-html', () => {
        const container = new MockElement('div');
        container.setAttribute('res', 'user');
        const bioEl = new MockElement('span');
        bioEl.setAttribute('res-prop', 'bio');
        bioEl.setAttribute('res-html', '');
        container.appendChild(bioEl);
        const root = new MockElement('div');
        root.appendChild(container);

        const { resonant } = createResonantWithOptions({}, root);
        resonant.add('user', { bio: '<em>hello</em>' });

        assert.strictEqual(bioEl.innerHTML, '<em>hello</em>');
    });

    it('updates with textContent on value change', async () => {
        const el = new MockElement('div');
        el.setAttribute('res', 'safe');
        const root = new MockElement('div');
        root.appendChild(el);

        const { context, resonant } = createResonantWithOptions({}, root);
        resonant.add('safe', 'initial');
        assert.strictEqual(el.textContent, 'initial');

        context.safe = '<div>injected</div>';
        await wait();
        assert.strictEqual(el.textContent, '<div>injected</div>');
    });
});

// ============================================
// 2. Scope Containment: bindToWindow option
// ============================================

describe('Scope Containment - bindToWindow option', () => {
    it('binds to window by default (backward compatible)', () => {
        const { context, resonant } = createResonantWithOptions();
        resonant.add('myGlobal', 42);

        assert.strictEqual(context.myGlobal, 42);
    });

    it('does not bind to window when bindToWindow is false', () => {
        const { context, resonant } = createResonantWithOptions({ bindToWindow: false });
        resonant.add('myScoped', 99);

        assert.strictEqual(context.myScoped, undefined);
        assert.strictEqual(resonant.myScoped, 99);
        assert.strictEqual(resonant.data.myScoped, 99);
    });

    it('setter works on instance when bindToWindow is false', async () => {
        const el = new MockElement('div');
        el.setAttribute('res', 'counter');
        const root = new MockElement('div');
        root.appendChild(el);

        const { resonant } = createResonantWithOptions({ bindToWindow: false }, root);
        resonant.add('counter', 1);
        assert.strictEqual(el.textContent, '1');

        resonant.counter = 5;
        await wait();
        assert.strictEqual(el.textContent, '5');
        assert.strictEqual(resonant.data.counter, 5);
    });

    it('does not pollute window with bindToWindow false', () => {
        const { context, resonant } = createResonantWithOptions({ bindToWindow: false });
        resonant.add('isolated', 'secret');

        // Should not be on window/context
        assert.strictEqual(context.isolated, undefined);
        // Should be accessible on instance
        assert.strictEqual(resonant.isolated, 'secret');
    });

    it('callbacks work with bindToWindow false', async () => {
        const { resonant } = createResonantWithOptions({ bindToWindow: false });
        resonant.add('cbTest', 'a');

        let received = null;
        resonant.addCallback('cbTest', (val) => { received = val; });

        resonant.cbTest = 'b';
        await wait();
        assert.strictEqual(received, 'b');
    });
});

// ============================================
// 3. DOM Query Optimization: rootElement option
// ============================================

describe('DOM Query Optimization - rootElement option', () => {
    it('defaults rootElement to document', () => {
        const { resonant, document } = createResonantWithOptions();
        assert.strictEqual(resonant.config.rootElement, document);
    });

    it('scopes queries to provided rootElement', () => {
        const appDiv = new MockElement('div');
        const el = new MockElement('span');
        el.setAttribute('res', 'scoped');
        appDiv.appendChild(el);

        // Also add an element outside the root that should NOT be found
        const outsideEl = new MockElement('span');
        outsideEl.setAttribute('res', 'scoped');
        const fullRoot = new MockElement('div');
        fullRoot.appendChild(appDiv);
        fullRoot.appendChild(outsideEl);

        const { resonant } = createResonantWithOptions({ rootElement: appDiv }, fullRoot);
        resonant.add('scoped', 'inside');

        // Element inside rootElement should be updated
        assert.strictEqual(el.textContent, 'inside');
        // Element outside rootElement should NOT be updated
        assert.strictEqual(outsideEl.textContent, '');
    });

    it('config stores the provided rootElement', () => {
        const appDiv = new MockElement('div');
        const { resonant } = createResonantWithOptions({ rootElement: appDiv });
        assert.strictEqual(resonant.config.rootElement, appDiv);
    });

    it('display conditionals are scoped to rootElement', async () => {
        const appDiv = new MockElement('div');
        const el = new MockElement('span');
        el.setAttribute('res-display', 'show === true');
        appDiv.appendChild(el);

        const { context, resonant } = createResonantWithOptions({ rootElement: appDiv }, appDiv);
        resonant.add('show', true);

        await wait();
        assert.strictEqual(el.style.display, 'inherit');

        context.show = false;
        await wait();
        assert.strictEqual(el.style.display, 'none');
    });
});
