class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.parentElement = null;
    this.innerHTML = '';
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(child) { child.parentElement = this; this.children.push(child); }
  remove() { if (this.parentElement) { const idx = this.parentElement.children.indexOf(this); if (idx >= 0) this.parentElement.children.splice(idx,1); this.parentElement = null; } }
  cloneNode(deep=true) {
    const clone = new MockElement(this.tagName);
    clone.innerHTML = this.innerHTML;
    for (const [k,v] of Object.entries(this.attributes)) clone.attributes[k] = v;
    for (const [k,v] of Object.entries(this.style)) clone.style[k] = v;
    if (deep) this.children.forEach(ch => clone.appendChild(ch.cloneNode(true)));
    return clone;
  }
  querySelectorAll(selector) { return querySelectorAllInternal(this, selector); }
  querySelector(selector) { const res = this.querySelectorAll(selector); return res[0] || null; }
}

class MockDocument {
  constructor(root) { this.root = root; }
  querySelectorAll(selector) { return querySelectorAllInternal(this.root, selector); }
}

function querySelectorAllInternal(root, selector) {
  selector = selector.trim();
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
    node.children.forEach(ch => traverse(ch));
  })(root);
  return out;
}

module.exports = { MockElement, MockDocument };
