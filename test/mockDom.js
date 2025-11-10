class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.classList = {
      _set: new Set(),
      add: cls => { this.classList._set.add(cls); },
      remove: cls => { this.classList._set.delete(cls); },
      contains: cls => this.classList._set.has(cls)
    };
    this.parentElement = null;
    this._innerHTML = '';
    this._renderCount = 0;
    this._lastRenderTime = 0;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    const stringValue = value == null ? '' : String(value);
    if (this._innerHTML !== stringValue) {
      this._innerHTML = stringValue;
      this._renderCount++;
      this._lastRenderTime = Date.now();
    }
  }

  resetRenderTracking() {
    this._renderCount = 0;
    this._lastRenderTime = 0;
  }

  getRenderCount() {
    return this._renderCount;
  }

  getLastRenderTime() {
    return this._lastRenderTime;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(child) {
    // Remove child from its current parent (even if it's this element)
    if (child.parentElement) {
      const idx = child.parentElement.children.indexOf(child);
      if (idx >= 0) {
        child.parentElement.children.splice(idx, 1);
      }
    }
    child.parentElement = this;
    this.children.push(child);
  }
  remove() { if (this.parentElement) { const idx = this.parentElement.children.indexOf(this); if (idx >= 0) this.parentElement.children.splice(idx,1); this.parentElement = null; } }
  cloneNode(deep=true) {
    const clone = new MockElement(this.tagName);
    clone.innerHTML = this.innerHTML;
    for (const [k,v] of Object.entries(this.attributes)) clone.attributes[k] = v;
    for (const [k,v] of Object.entries(this.style)) clone.style[k] = v;
    for (const cls of this.classList._set) clone.classList.add(cls);
    if (deep) this.children.forEach(ch => clone.appendChild(ch.cloneNode(true)));
    clone.resetRenderTracking(); // Reset tracking for cloned elements
    return clone;
  }
  querySelectorAll(selector) { return querySelectorAllInternal(this, selector); }
  querySelector(selector) { const res = this.querySelectorAll(selector); return res[0] || null; }
}

class MockDocument {
  constructor(root) { 
    this.body = new MockElement('body');
    this.root = root || this.body;
  }
  querySelectorAll(selector) { 
    if (!this.root) return [];
    return querySelectorAllInternal(this.root, selector); 
  }
  createElement(tagName) {
    return new MockElement(tagName);
  }
}

function querySelectorAllInternal(root, selector) {
  selector = selector.trim();
  if (selector.includes(',')) {
    let results = [];
    selector.split(',').forEach(part => {
      results = results.concat(querySelectorAllInternal(root, part.trim()));
    });
    return results;
  }
  if (selector.includes(' ')) {
    const [first, rest] = selector.split(/\s+/, 2);
    let res = [];
    querySelectorAllInternal(root, first).forEach(el => {
      res = res.concat(querySelectorAllInternal(el, rest));
    });
    return res;
  }
  const conds = [];
  const regex = /\[([^\]]+)\]/g;
  let m;
  while ((m = regex.exec(selector)) !== null) {
    const expr = m[1].trim();
    const match = expr.match(/^([^*~=]+)(\*=|=)?"?([^"]*)"?$/);
    if (match) {
      const name = match[1];
      const op = match[2] || null;
      const value = match[3] !== undefined ? match[3] : null;
      conds.push({ name, value, op });
    }
  }
  const out = [];
  (function traverse(node){
    if (node instanceof MockElement) {
      let ok = true;
      for (const c of conds) {
        const val = node.getAttribute(c.name);
        if (c.op === null) {
          if (val === undefined) { ok = false; break; }
        } else if (c.op === '=') {
          if (val !== c.value) { ok = false; break; }
        } else if (c.op === '*=') {
          if (!val || !val.includes(c.value)) { ok = false; break; }
        }
      }
      if (ok) out.push(node);
    }
    if (node && node.children) {
      node.children.forEach(ch => traverse(ch));
    }
  })(root);
  return out;
}

function createResonant() {
  const fs = require('fs');
  const vm = require('vm');
  const path = require('path');
  
  const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
  const document = new MockDocument();
  const context = { 
    console, 
    setTimeout, 
    clearTimeout, 
    document,
    window: null
  };
  context.window = context;

  const store = {};
  context.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = val; },
    removeItem: key => { delete store[key]; }
  };

  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  const resonant = new Resonant();
  
  // Add resonant to context so it can be accessed in computed functions
  context.resonant = resonant;
  
  return { 
    context, 
    resonant, 
    store,
    document,
    cleanup: () => {
      // Clear all global variables
      Object.keys(context).forEach(key => {
        if (key !== 'console' && key !== 'setTimeout' && key !== 'clearTimeout' && 
            key !== 'document' && key !== 'window' && key !== 'localStorage' && 
            key !== 'resonant') {
          delete context[key];
        }
      });
    }
  };
}

module.exports = { MockElement, MockDocument, createResonant };
