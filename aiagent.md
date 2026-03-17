# ResonantJs -- AI Agent Reference

ResonantJs adds reactive data-binding to vanilla HTML/JS pages. One `<script>` tag, no build step. This document gives an AI agent everything it needs to generate working ResonantJs code.

## TL;DR

```html
<script src="https://unpkg.com/resonantjs@latest/resonant.min.js"></script>
<script>
  const res = new Resonant();
  res.add('count', 0);      // reactive variable
  count++;                   // DOM updates automatically
</script>
<span res="count"></span>    <!-- bound to the variable -->
```

---

## JavaScript API

| Method | Signature | Description |
|---|---|---|
| Constructor | `new Resonant()` | Create an instance. One per page is typical. |
| `add` | `add(name, value?, persist?)` | Register a reactive variable. Omit `value` to bind an existing `window` variable. If only two args and the second is a `boolean`, it is treated as the persist flag. |
| `addAll` | `addAll({ name: value, ... })` | Register multiple variables at once. |
| `addCallback` | `addCallback(name, fn)` | `fn(currentValue, changedItem, action)` fires on every change. Actions: `added`, `removed`, `modified`, `updated`, `filtered`. |
| `computed` | `computed(name, fn)` | Define a read-only derived value. Dependencies are tracked automatically. Chains are supported (computed A depending on computed B). |

### Binding existing window variables

```js
window.username = 'Alice';
res.add('username');        // picks up 'Alice', makes it reactive
res.add('username', true);  // same, plus persists to localStorage
```

If the variable doesn't exist on `window`, a warning is logged and no binding is created.

### Persistence

Pass `true` as the persist flag to sync a variable to `localStorage` under the key `res_<name>`. On page load, the stored value is restored automatically.

```js
res.add('theme', 'light', true);
```

---

## HTML Attributes

| Attribute | Purpose | Scope |
|---|---|---|
| `res="varName"` | Bind element to variable. For scalars/objects, sets `innerHTML`. For arrays, the element becomes a **template** that is cloned per item. | Any element |
| `res-prop="key"` | Bind to a property of the parent `res` object or array item. Use `res-prop=""` (empty) to bind the whole item. | Inside a `res` element |
| `res-display="expr"` | JS expression. Element is shown (`display: inherit`) when truthy, hidden (`display: none`) when falsy. Inside arrays, bare property names resolve to the current item. | Any element |
| `res-style="expr"` | JS expression returning a space-separated class string. Previous classes from the expression are removed before new ones are applied. | Any element |
| `res-onclick="fnName"` | Call a global function on click. If the function declares a parameter, the current item is passed. | Inside a `res` element |
| `res-onclick-remove="prop"` | Remove the current item from its parent array by matching the given property (e.g., `id`). | Inside an array template |

---

## Patterns

### Scalar binding

```html
<span res="message"></span>
```

```js
res.add('message', 'Hello');
message = 'World'; // DOM updates
```

### Object binding

```html
<div res="user">
  <span res-prop="name"></span>
  <span res-prop="email"></span>
</div>
```

```js
res.add('user', { name: 'Alice', email: 'a@b.com' });
user.name = 'Bob'; // only the name span updates
```

### Array rendering

Place `res` on a template element inside a list container. ResonantJs hides the template and clones it per item.

```html
<ul>
  <li res="items">
    <span res-prop="title"></span>
    <button res-onclick-remove="id">x</button>
  </li>
</ul>
```

```js
res.add('items', [
  { id: 1, title: 'First' },
  { id: 2, title: 'Second' }
]);

items.push({ id: 3, title: 'Third' });  // new <li> appears
items[0].title = 'Updated';             // only that <li> re-renders
items.splice(1, 1);                      // second <li> removed
```

### Array methods

Reactive arrays support all standard `Array` methods plus:

| Method | Description |
|---|---|
| `.set(index, value)` | Replace item at index |
| `.delete(index)` | Remove item at index |
| `.update(newArray)` | Replace entire array |
| `.filterInPlace(fn)` | Mutating filter |
| `.forceUpdate()` | Force re-render without data change |

### Conditional display inside arrays

```html
<ul>
  <li res="people">
    <span res-prop="name"></span>
    <span res-display="active" class="badge">Active</span>
  </li>
</ul>
```

Inside array templates, bare property names like `active` resolve to the current item's property. When one item's `active` changes, only that item's display condition is re-evaluated -- other items are untouched.

### Computed properties

```js
res.add('price', 100);
res.add('taxRate', 0.08);

res.computed('tax',   () => price * taxRate);
res.computed('total', () => price + tax);     // chains work
```

```html
<span res="total"></span>  <!-- updates when price or taxRate changes -->
```

Computed properties are read-only. Attempting to set one logs a warning.

### Two-way input binding

```html
<input type="text" res="name" />
<input type="checkbox" res="user.active" />
<textarea res="notes"></textarea>
<select res="country">
  <option value="us">US</option>
  <option value="uk">UK</option>
</select>
```

### Nested data

Objects and arrays can be nested to arbitrary depth. All levels are reactive.

```html
<div res="company.departments">
  <h3 res-prop="name"></h3>
  <div res-prop="teams">
    <span res-prop="name"></span>
    <ul res-prop="members">
      <li res-prop="name"></li>
    </ul>
  </div>
</div>
```

```js
res.add('company', {
  departments: [{
    name: 'Engineering',
    teams: [{
      name: 'Frontend',
      members: [{ name: 'Alice' }, { name: 'Bob' }]
    }]
  }]
});

company.departments[0].teams[0].members.push({ name: 'Charlie' });
```

### Callbacks

```js
res.addCallback('tasks', (value, item, action) => {
  // action: 'added' | 'removed' | 'modified' | 'updated' | 'filtered'
  console.log(action, item);
});
```

---

## Agent Workflow

When generating a page with ResonantJs:

1. Include the script tag: `<script src="https://unpkg.com/resonantjs@latest/resonant.min.js"></script>`
2. Create one `Resonant` instance.
3. Register variables with `add` or `addAll`. Use `true` for persistence when appropriate.
4. Define `computed` properties for derived values.
5. Add HTML attributes (`res`, `res-prop`, `res-display`, `res-style`, `res-onclick`, `res-onclick-remove`) to bind the DOM.
6. Manipulate data directly -- the DOM updates automatically.
7. Use `addCallback` for side effects (API calls, logging, etc.).

### Common mistakes to avoid

- **Forgetting the template element**: `res` on an array must be placed on a single element inside a container (e.g., `<li>` inside `<ul>`). The element becomes the template.
- **Setting computed properties**: They are read-only. Assign through their dependencies instead.
- **Naming collisions**: Variables registered with `add` are exposed as globals on `window`. Avoid names that collide with built-in globals.
- **Boolean values in `addAll`**: All values are passed through correctly, including `true`/`false`/`null`.

---

## Full Example: Shopping Cart

```html
<!doctype html>
<html>
<head>
  <script src="https://unpkg.com/resonantjs@latest/resonant.min.js"></script>
</head>
<body>
  <h1>Cart</h1>

  <table>
    <tr res="items">
      <td res-prop="name"></td>
      <td>$<span res-prop="price"></span></td>
      <td><input type="number" res-prop="qty" style="width:50px" /></td>
      <td>$<span res-prop="lineTotal"></span></td>
      <td><button res-onclick-remove="name">Remove</button></td>
    </tr>
  </table>

  <p>Subtotal: $<span res="subtotal"></span></p>
  <p>Tax: $<span res="tax"></span></p>
  <p><strong>Total: $<span res="total"></span></strong></p>

  <script>
    const res = new Resonant();
    res.addAll({
      items: [
        { name: 'Widget', price: 10, qty: 2 },
        { name: 'Gadget', price: 25, qty: 1 }
      ],
      taxRate: 0.08
    });

    res.computed('subtotal', () =>
      items.reduce((sum, i) => sum + i.price * i.qty, 0)
    );
    res.computed('tax',   () => +(subtotal * taxRate).toFixed(2));
    res.computed('total', () => +(subtotal + tax).toFixed(2));
  </script>
</body>
</html>
```

For more examples, see the `examples/` folder and the full [README](./README.md).
