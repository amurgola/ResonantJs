# ResonantJs

[![npm version](https://badge.fury.io/js/resonantjs.svg)](https://badge.fury.io/js/resonantjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Reactive data-binding for vanilla JavaScript. No build step. No virtual DOM. Just HTML attributes and plain objects.**

```html
<span res="count"></span>
<button onclick="count++">+1</button>

<script src="https://unpkg.com/resonantjs@latest/resonant.min.js"></script>
<script>
  const res = new Resonant();
  res.add('count', 0);
</script>
```

Change `count` anywhere in your code and the DOM updates automatically.

---

## Install

```bash
npm install resonantjs
```

Or drop in a script tag:

```html
<script src="https://unpkg.com/resonantjs@latest/resonant.min.js"></script>
```

~18 KB minified. Zero dependencies.

---

## Why ResonantJs?

| | |
|---|---|
| **No build tools** | Works with a single `<script>` tag. Ship today. |
| **Familiar mental model** | Plain objects, plain arrays, plain HTML. No JSX, no templates, no compilation. |
| **Automatic DOM updates** | Change a value, the page updates. Arrays, nested objects, computed properties -- all reactive. |
| **Selective re-rendering** | Only the changed array item re-renders. Siblings stay untouched. |
| **Built-in persistence** | One flag to sync any variable to `localStorage`. |
| **Tiny footprint** | ~18 KB minified, zero dependencies. |

---

## Quick Tour

### Bind a variable

```html
<h1>Hello, <span res="name"></span></h1>
```

```js
const res = new Resonant();
res.add('name', 'World');

name = 'ResonantJs'; // DOM updates instantly
```

### Bind an object

```html
<div res="user">
  <span res-prop="name"></span>
  <span res-prop="email"></span>
</div>
```

```js
res.add('user', { name: 'Alice', email: 'alice@example.com' });

user.name = 'Bob'; // only the name span updates
```

### Render an array

Place `res` on a template element inside a list container. ResonantJs clones it once per item.

```html
<ul>
  <li res="tasks">
    <span res-prop="title"></span>
    <button res-onclick-remove="id">x</button>
  </li>
</ul>
```

```js
res.add('tasks', [
  { id: 1, title: 'Learn ResonantJs' },
  { id: 2, title: 'Ship a feature' }
]);

tasks.push({ id: 3, title: 'Profit' }); // new <li> appears
tasks[0].title = 'Done!';                // only that <li> re-renders
```

### Conditional display

```html
<div res-display="user.isAdmin">Admin Panel</div>
<div res-display="tasks.length === 0">No tasks yet.</div>
```

### Dynamic classes

```html
<span res-prop="title" res-style="done ? 'completed' : ''"></span>
```

### Computed properties

Derived values that recalculate automatically when dependencies change. Chains work too.

```js
res.add('price', 100);
res.add('taxRate', 0.08);

res.computed('tax',   () => price * taxRate);
res.computed('total', () => price + tax);    // chains: updates when tax updates
```

```html
Total: $<span res="total"></span>
```

### Two-way input binding

```html
<input type="text" res="name" />
<input type="checkbox" res="settings.darkMode" />
<select res="country">...</select>
```

### Persistence

```js
res.add('theme', 'light', true); // third arg = persist to localStorage
theme = 'dark';                  // saved automatically
```

### Bind existing variables

Already have a variable on `window`? Register it without passing a value.

```js
window.username = 'Alice';
res.add('username');       // picks up 'Alice', makes it reactive
res.add('username', true); // same, but also persists to localStorage
res.bind('username');      // explicit alias for the same thing
res.bind('username', true);
```

### Event handling

```html
<button res-onclick="editTask">Edit</button>      <!-- receives (item, event) -->
<input res-oninput="onType">                      <!-- any res-on<event>: input, change, keydown, ... -->
<button res-onclick-remove="id">Delete</button>    <!-- removes item by matching property -->
```

Handlers resolve to a global function by default. Register one on the instance instead with `res.handler('open', fn)` and reference it as `res-onclick="res.open"`; a mount can override it with `res-on:open="otherFn"`. Call `res.bindEvents(rootEl)` to wire `res-on*` attributes on static markup outside an array template.

### Reusable templates

```html
<template id="row"><div><span res-prop="title" res-onclick="res.open"></span></div></template>

<div res="inbox" res-use="row" res-on:open="openMail" res-empty="noMail"></div>
<div res="archive" res-use="row" res-on:open="openArchived"></div>
<div res-include="footer"></div>
```

```js
res.registerTemplate('row', document.getElementById('row').content.firstElementChild);
res.registerTemplate('noMail', '<p class="empty">Nothing here</p>');
res.registerTemplate('footer', '<footer>...</footer>');
```

`res-use` clones a registered template per array item, `res-empty` shows one while the array is empty, and `res-include` expands one in place (automatically after each `add`, or on demand with `res.processIncludes(rootEl)`).

### Formatting and streaming

```html
<div res="answer"></div>
<span res-prop="price" res-format="money"></span>
```

```js
res.format('answer', (text, { done }) => markdown(text));   // how a variable renders
res.transform('money', (v, item) => '$' + v.toFixed(2));     // named res-format transform

const sink = res.stream('answer', { throttle: 16 });        // feed a scalar incrementally
sink.write('Hello'); sink.write(' world'); sink.rewind(1); sink.end();
```

`stream()` writes straight to the variable and repaints at most once per throttle window, so a token flood does not re-run the formatter per token. `end()` does the final render and fires callbacks once.

### Callbacks

```js
res.addCallback('tasks', (value, item, action) => {
  console.log(action, item); // 'added', 'removed', 'modified', etc.
});
```

### Bind by CSS Selector

Push reactive values into arbitrary DOM elements without adding `res` attributes. Useful when you can't modify the target HTML — third-party widgets, CMS-rendered markup, or elements loaded later via AJAX.

```js
res.add('score', 0);

// Any element matching the selector will be updated when `score` changes
score.bindByCssSelector('.score-display');

// Works from the instance too (required for scalar values like strings/numbers)
res.bindByCssSelector('score', '.score-display');
```

```html
<!-- These elements don't need res="score" -->
<span class="score-display"></span>
<div class="score-display"></div>
```

**Key behaviour:**

- **One-way binding** — data flows from the variable to the matched elements. User input on those elements does not flow back.
- **Full DOM re-query every update** — the selector is evaluated against the entire DOM (or `rootElement` if configured) on every change, so elements added dynamically after the binding is registered will be picked up automatically.
- **Silent when no match** — if no elements match the selector, the update is silently skipped. No errors, no warnings.
- **Multiple selectors** — call `bindByCssSelector` more than once to push the same value to different selectors.
- **INPUT / TEXTAREA** — matched input elements have their `.value` set instead of their text content.
- Objects and arrays are serialised as JSON. Scalars are converted to strings.

```js
// Bind an object — multiple selectors
res.add('user', { name: 'Alice', role: 'admin' });
user.bindByCssSelector('.user-json');
user.bindByCssSelector('#sidebar-user');

// Bind an array
res.add('items', [1, 2, 3]);
items.bindByCssSelector('.item-list'); // renders "[1,2,3]"

// Scalar — use the instance method since primitives can't have methods
res.add('greeting', 'Hello');
res.bindByCssSelector('greeting', '.welcome-banner');
```

> **Performance note:** Because `bindByCssSelector` re-queries the DOM on every update, it is inherently less performant than `res` attribute bindings. Use it for convenience when the target markup is outside your control; prefer `res` attributes for performance-critical paths.

---

## Build a Todo App

Copy this into an `.html` file and open it in your browser.

```html
<!doctype html>
<html>
<head>
  <style>.done { text-decoration: line-through; color: #999; }</style>
  <script src="https://unpkg.com/resonantjs@latest/resonant.min.js"></script>
</head>
<body>
  <h1>Todos (<span res="tasks.length"></span>)</h1>

  <input placeholder="Add a task..." res="newTask" />
  <button onclick="addTask()">Add</button>

  <ul>
    <li res="tasks">
      <input type="checkbox" res-prop="done" />
      <span res-prop="name" res-style="done ? 'done' : ''"></span>
      <button res-onclick="removeTask">x</button>
    </li>
  </ul>

  <script>
    const res = new Resonant();
    res.addAll({
      newTask: '',
      tasks: [
        { name: 'Learn ResonantJs', done: false },
        { name: 'Ship a feature', done: true }
      ]
    });

    function addTask() {
      const title = newTask.trim();
      if (!title) return;
      tasks.unshift({ name: title, done: false });
      newTask = '';
    }

    function removeTask(item) {
      const idx = tasks.indexOf(item);
      if (idx !== -1) tasks.delete(idx);
    }
  </script>
</body>
</html>
```

---

## API Reference

### JavaScript

| Method | Description |
|---|---|
| `new Resonant()` | Create an instance |
| `.add(name, value?, persist?)` | Add a reactive variable. Omit `value` to bind an existing `window` variable. Pass `true` as second or third arg to persist to `localStorage`. |
| `.addAll({ name: value, ... })` | Add multiple variables at once |
| `.bind(name, persist?)` | Make an existing `window` variable reactive. Same as `add(name)` with no value, but states the intent explicitly. |
| `.addCallback(name, fn)` | Listen for changes. `fn(currentValue, item, action)` |
| `.computed(name, fn)` | Define a read-only derived value |
| `.bindByCssSelector(name, selector)` | One-way bind a variable to all elements matching a CSS selector. Also available as `myVar.bindByCssSelector(selector)` on objects and arrays. |
| `.format(name, fn)` | Register how a top-level scalar renders. `fn(value, { done })` returns HTML. |
| `.transform(name, fn)` | Register a named transform for `res-format="name"`. `fn(value, item)` returns HTML. |
| `.stream(name, { throttle?, preserveSelection? })` | Feed a scalar incrementally. Returns a sink with `write(chunk)`, `rewind(n)`, `end()`, `fail(err)`. |
| `.registerTemplate(name, htmlOrElement)` | Register a reusable markup fragment for `res-use`, `res-empty` and `res-include`. |
| `.handler(name, fn)` | Register an injectable event handler referenced as `res-onclick="res.name"`. `fn(item, event)` |
| `.bindEvents(rootEl?, item?)` | Wire `res-on<event>` attributes on static markup. |
| `.processIncludes(rootEl?)` | Expand `res-include` placeholders under `rootEl` (runs automatically after `add`). |

### HTML Attributes

| Attribute | Description |
|---|---|
| `res="varName"` | Bind element to a variable (scalar, object, or array template) |
| `res-prop="key"` | Bind to an object property within a `res` context |
| `res-display="expr"` | Show/hide element based on a JS expression |
| `res-style="expr"` | Apply CSS classes from a JS expression |
| `res-html` | Write the bound value as HTML instead of text |
| `res-format="name"` | Run the bound value through a named transform (`transform()` or a global function) before writing |
| `res-onclick="fnName"` | Call a function on click as `fn(item, event)`. `fnName` is a global, or `res.name` for a handler registered with `handler()` |
| `res-on<event>="fnName"` | Same as `res-onclick` for `dblclick`, `input`, `change`, `keydown`, `keyup`, `keypress`, `submit`, `blur`, `focus`, `mousedown`, `mouseup` |
| `res-on:name="fnName"` | On a `res-use` or `res-include` mount, override the `res.name` handler for that mount only |
| `res-onclick-remove="prop"` | Remove the current item from its parent array by matching property |
| `res-use="tpl"` | Render each array item from a registered template instead of the element's own markup |
| `res-empty="tpl"` | Show a registered template while the array is empty |
| `res-include="tpl"` | Replace the element with a registered template |

### Array Methods

Reactive arrays support all standard methods plus:

| Method | Description |
|---|---|
| `.set(index, value)` | Update item at index |
| `.delete(index)` | Remove item at index |
| `.update(newArray)` | Replace entire array contents |
| `.sort(fn)` / `.reverse()` | Standard in-place sort and reverse; the list re-renders with its rows reordered |
| `.filterInPlace(fn)` | Mutating filter |
| `.forceUpdate()` | Force re-render without changing data |

### Callback Actions

`added` `removed` `modified` `updated` `filtered`

---

## Performance

- **Selective array re-rendering** -- when a property on one array item changes, only that item's row is re-created. Sibling rows are neither re-rendered nor moved, including their `res-display` and `res-style` evaluations: editing one item in a 1,000-item list costs one DOM insertion.
- **Keyed reordering** -- `sort()`, `reverse()` and splices reuse the existing rows and move only the ones whose position changed.
- **Batched updates** -- rapid changes within the same tick are coalesced into a single DOM update, for scalars as well as arrays and objects. Read the DOM after the next tick, not synchronously after a write.
- **Compiled expressions** -- `res-display` and `res-style` expressions are compiled once per distinct expression and reused for every item.
- **Computed property chains** -- cascading computed properties resolve in dependency order within a single pass.
- **Stable keys** -- array items are tracked by stable keys for efficient reuse during re-renders.

### Benchmarks

`bench/` holds a browser benchmark suite that measures what a user actually waits for: wall and CPU time, layout and style-recalc counts, DOM mutations (nodes added or removed, attribute and text changes), rendered element count and retained heap for each scenario, from a 1,000-item render to a streamed token feed. It runs in headless Chromium through Playwright.

```bash
npx playwright install chromium   # once
npm run bench                     # benchmark resonant.js
npm run bench:compare             # A/B this checkout against origin/main
node bench/run.js --against v1.20 --iterations 9
```

An A/B run flags any scenario whose DOM mutation or element counts grew as a regression, and reports timing or heap changes beyond 20%. The same comparison runs on every pull request through the Benchmark workflow. Open `bench/benchmark.html` in a browser for a quick in-page run without DevTools metrics. See [bench/README.md](./bench/README.md) for the scenario list and how to add one.

---

## Browser Support

Chrome 60+ / Firefox 55+ / Safari 12+ / Edge 79+ / Mobile browsers

---

## Examples

- [Basic Counter](./examples/example-basic.html)
- [Task Manager](./examples/example-taskmanager.html)
- [Nested Data (Houses)](./examples/example-houses.html)
- [Tests Showcase](./examples/tests.html)

---

## Development

```bash
git clone https://github.com/amurgola/ResonantJs.git
cd ResonantJs
npm install
npm test          # run all tests
npm run build     # run tests + minify
npm run bench     # browser benchmarks (needs: npx playwright install chromium)
```

### Releasing

One-time setup: the workflow authenticates to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no token is stored. On npmjs.com open the `resonantjs` package → **Settings → Trusted Publisher → GitHub Actions** and enter user `amurgola`, repository `ResonantJs` (spelled exactly as on GitHub), workflow filename `release.yml`, no environment, and allow `npm publish`. The workflow also needs `id-token: write`, which it declares; if a run's job summary reports that no OIDC token was available, allow it under the repository's **Settings → Actions → General → Workflow permissions**. Each run writes the OIDC claims it presented to npm into the job summary so they can be compared with the trusted publisher. Classic npm tokens were revoked in 2025 and make `npm publish` fail with a 404. If you would rather use a token, create a granular access token with publish rights, store it as the `npm_token` secret, and run the workflow with *auth* set to `token`.

1. Bump `version` in `package.json` and `package-lock.json`, run `npm run build`, and commit the rebuilt `resonant.min.js`.
2. In GitHub, open **Actions → Release → Run workflow**. Tick *dry run* first to see what would happen without publishing.
3. The workflow runs the test suite, checks the committed minified bundle is current, publishes `resonantjs@<version>` to npm with provenance, and creates a GitHub release tagged `v<version>` with generated notes.

Re-running it is safe: a version already on npm is skipped, an existing tag is skipped, and if both exist it stops and asks for a version bump. Creating a release by hand in the GitHub UI also publishes to npm. `node scripts/release-check.js` shows the same preflight locally. The published package contains only the library files and `aiagent.md`; tests, benchmarks and examples stay in the repository.

---

## License

MIT -- see [LICENSE](LICENSE).

---

<div align="center">

**[GitHub](https://github.com/amurgola/ResonantJs)** · **[npm](https://www.npmjs.com/package/resonantjs)** · **[Issues](https://github.com/amurgola/ResonantJs/issues)**

*Built by [Andrew Paul Murgola](https://github.com/amurgola)*

</div>
