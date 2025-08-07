# Using ResonantJs with AI Agents

ResonantJs is a lightweight framework that adds reactive data-binding to vanilla JavaScript applications. The library can be leveraged by AI agents when generating or manipulating front-end code. Below is a high-level overview of its features and how an agent might use them.

## Core Concepts

- **Data Binding (`res`)** – Attach a JavaScript variable to an element so that UI updates whenever the value changes.
- **Object Properties (`res-prop`)** – Bind specific properties of an object to nested elements.
- **Array Rendering** – Automatically generate a list from an array of data using a template element.
- **Conditional Display (`res-display`)** – Show or hide elements based on expressions.
- **Dynamic Styling (`res-style`)** – Conditionally apply CSS classes or inline styles.
- **Event Handling (`res-onclick`)** – Link element events to functions with access to bound data.
- **Input Binding** – Two-way binding for input elements such as text fields, checkboxes, or select menus.

## Key Features

- **Reactive Data Management** – Initialize variables with `add` or `addAll`. Any update to these values immediately reflects in the DOM.
- **Event Callbacks** – Register callbacks via `addCallback` to react to data changes and chain side effects.
- **Persistence** – Optionally persist values to `localStorage` so state survives page reloads.
- **Advanced Array Operations** – Observable arrays expose methods like `update`, `set`, and `delete` to trigger UI refreshes when items change.
- **Child Object Support** – Nested objects (e.g. `user.profile.email`) remain reactive through automatic proxy wrapping.
- **Computed Properties** – Define reactive derived values using `computed()` that automatically update when their dependencies change.
- **Component Patterns** – Encapsulate related variables and callbacks in functions for reuse across the page.

## Example Workflow for an AI Agent

1. **Initialize** a new `Resonant` instance when generating the page.
2. **Add Variables** using `add` or `addAll` for any data that needs to be reactive. Enable persistence if needed.
3. **Define Computed Properties** using `computed()` for derived values that should automatically update when dependencies change.
4. **Bind Elements** in generated HTML using `res`, `res-prop`, and related attributes so DOM updates automatically.
5. **Attach Callbacks** with `addCallback` when additional logic is required after data changes. This can be used to interact with other services.
6. **Manipulate Data** directly in generated scripts. Changes propagate to the interface with no manual DOM manipulation.

## When to Use

- Building dynamic UI components without importing a heavy framework.
- Keeping local state in sync with DOM elements in generated pages.
- Rapidly prototyping interactive features that persist across sessions using localStorage.

For more detailed examples, see the `examples` folder and the full README documentation in this repository.

## Examples

### Simple Counter

```html
<h1>Counter: <span res="counter"></span></h1>
<button onclick="counter++">Increment</button>

<script>
const r = new Resonant();
r.add('counter', 0, true); // persisted value
</script>
```

### Todo List

```html
<input res="newTodo" placeholder="Add task" />
<button onclick="addTodo()">Add</button>

<ul>
  <li res="todos">
    <input type="checkbox" res-prop="done" />
    <span res-prop="title"></span>
  </li>
</ul>

<script>
const r = new Resonant();
r.addAll({
  todos: [{ title: 'Try Resonant', done: false }],
  newTodo: ''
});

function addTodo() {
  if (newTodo.trim()) {
    todos.push({ title: newTodo, done: false });
    newTodo = '';
  }
}
</script>
```

### Callbacks

```html
<ul>
  <li res="tasks">
    <span res-prop="name"></span>
    <button onclick="remove(item)">Remove</button>
  </li>
</ul>

<script>
const r = new Resonant();
r.addAll({ tasks: [] });
r.addCallback('tasks', (tasks, task, action) => {
  console.log(`Action: ${action}`, task);
});

function remove(task) {
  const idx = tasks.indexOf(task);
  tasks.delete(idx);
}
</script>
```

### Nested Child Objects

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

<script>
const r = new Resonant();
r.add('company', {
  departments: [
    {
      name: 'Engineering',
      teams: [
        { name: 'Frontend', members: [{ name: 'Alice' }] }
      ]
    }
  ]
});
</script>
```

### Computed Properties

```html
<div>
  <input res="firstName" placeholder="First name" />
  <input res="lastName" placeholder="Last name" />
  <h2>Welcome, <span res="fullName"></span>!</h2>
</div>

<script>
const r = new Resonant();
r.addAll({
  firstName: 'John',
  lastName: 'Doe'
});

// Computed property automatically updates when firstName or lastName changes
r.computed('fullName', () => {
  return firstName + ' ' + lastName;
});
</script>
```

### Shopping Cart with Computed Totals

```html
<div res="items">
  <div>
    <span res-prop="name"></span> - 
    $<span res-prop="price"></span> x 
    <span res-prop="quantity"></span>
  </div>
</div>
<div>
  <strong>Subtotal: $<span res="subtotal"></span></strong><br>
  <strong>Tax: $<span res="tax"></span></strong><br>
  <strong>Total: $<span res="total"></span></strong>
</div>

<script>
const r = new Resonant();
r.addAll({
  items: [
    { name: 'Widget', price: 10, quantity: 2 },
    { name: 'Gadget', price: 15, quantity: 1 }
  ],
  taxRate: 0.08
});

// Computed properties automatically recalculate when items change
r.computed('subtotal', () => {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

r.computed('tax', () => {
  return subtotal * taxRate;
});

r.computed('total', () => {
  return subtotal + tax;
});
</script>
```

### User Profile with Computed Display

```html
<div>
  <input res="user.age" type="number" placeholder="Age" />
  <input res="user.memberSince" type="number" placeholder="Member since year" />
  <div>Status: <span res="membershipStatus"></span></div>
  <div>Category: <span res="ageCategory"></span></div>
</div>

<script>
const r = new Resonant();
r.add('user', {
  age: 25,
  memberSince: 2020
});

r.computed('membershipStatus', () => {
  const yearsAsMember = new Date().getFullYear() - user.memberSince;
  if (yearsAsMember >= 5) return 'Gold Member';
  if (yearsAsMember >= 2) return 'Silver Member';
  return 'Bronze Member';
});

r.computed('ageCategory', () => {
  if (user.age < 18) return 'Minor';
  if (user.age < 65) return 'Adult';
  return 'Senior';
});
</script>
```
