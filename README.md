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
```

### Event handling

```html
<button res-onclick="editTask">Edit</button>      <!-- receives the current item -->
<button res-onclick-remove="id">Delete</button>    <!-- removes item by matching property -->
```

### Callbacks

```js
res.addCallback('tasks', (value, item, action) => {
  console.log(action, item); // 'added', 'removed', 'modified', etc.
});
```

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
| `.addCallback(name, fn)` | Listen for changes. `fn(currentValue, item, action)` |
| `.computed(name, fn)` | Define a read-only derived value |

### HTML Attributes

| Attribute | Description |
|---|---|
| `res="varName"` | Bind element to a variable (scalar, object, or array template) |
| `res-prop="key"` | Bind to an object property within a `res` context |
| `res-display="expr"` | Show/hide element based on a JS expression |
| `res-style="expr"` | Apply CSS classes from a JS expression |
| `res-onclick="fnName"` | Call a global function on click; receives current item if in an array |
| `res-onclick-remove="prop"` | Remove the current item from its parent array by matching property |

### Array Methods

Reactive arrays support all standard methods plus:

| Method | Description |
|---|---|
| `.set(index, value)` | Update item at index |
| `.delete(index)` | Remove item at index |
| `.update(newArray)` | Replace entire array contents |
| `.filterInPlace(fn)` | Mutating filter |
| `.forceUpdate()` | Force re-render without changing data |

### Callback Actions

`added` `removed` `modified` `updated` `filtered`

---

## Performance

- **Selective array re-rendering** -- when a property on one array item changes, only that item's DOM subtree is updated. Siblings are untouched, including their `res-display` and `res-style` evaluations.
- **Batched updates** -- rapid changes within the same tick are coalesced into a single DOM update.
- **Computed property chains** -- cascading computed properties resolve in dependency order within a single pass.
- **Stable keys** -- array items are tracked by stable keys for efficient reuse during re-renders.

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
```

---

## License

MIT -- see [LICENSE](LICENSE).

---

<div align="center">

**[GitHub](https://github.com/amurgola/ResonantJs)** · **[npm](https://www.npmjs.com/package/resonantjs)** · **[Issues](https://github.com/amurgola/ResonantJs/issues)**

*Built by [Andrew Paul Murgola](https://github.com/amurgola)*

</div>
