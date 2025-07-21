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
- **Computed Properties** – Compute derived values in callbacks to maintain aggregate state such as statistics.
- **Component Patterns** – Encapsulate related variables and callbacks in functions for reuse across the page.

## Example Workflow for an AI Agent

1. **Initialize** a new `Resonant` instance when generating the page.
2. **Add Variables** using `add` or `addAll` for any data that needs to be reactive. Enable persistence if needed.
3. **Bind Elements** in generated HTML using `res`, `res-prop`, and related attributes so DOM updates automatically.
4. **Attach Callbacks** with `addCallback` when additional logic is required after data changes. This can be used to compute derived values or interact with other services.
5. **Manipulate Data** directly in generated scripts. Changes propagate to the interface with no manual DOM manipulation.

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
