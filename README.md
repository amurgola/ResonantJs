# ResonantJs 🚀

[![npm version](https://badge.fury.io/js/resonantjs.svg)](https://badge.fury.io/js/resonantjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ResonantJs** is a lightweight, powerful JavaScript framework that brings **reactive data-binding** to vanilla JavaScript applications. Build dynamic, responsive UIs with minimal code and zero dependencies.

> **Zero dependencies • ~11.5KB minified • Lightning fast • Easy to learn**

## ✨ Why Choose ResonantJs?

- 🔄 **True Reactivity**: Data changes automatically update the DOM - no manual manipulation needed
- 🎯 **Attribute-Based**: Use simple HTML attributes to create powerful data bindings
- 🏗️ **Deep Object Support**: Handles nested objects and arrays with full reactivity
- 💾 **Built-in Persistence**: Automatic localStorage integration for data persistence
- 🎨 **Dynamic Styling**: Conditional CSS classes and styles based on your data
- ⚡ **Performance**: Efficient updates with minimal overhead
- 📦 **Tiny Footprint**: Under 11.5KB minified - perfect for any project size

---

## 🚀 Quick Start

### Installation

#### NPM
```bash
npm install resonantjs
```

#### CDN
```html
<script src="https://unpkg.com/resonantjs@latest/resonant.js"></script>
```

### Hello World Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>ResonantJs Demo</title>
  <script src="https://unpkg.com/resonantjs@latest/resonant.js"></script>
</head>
<body>
  <h1>Counter: <span res="counter"></span></h1>
  <button onclick="counter++">Increment</button>
  <button onclick="counter--">Decrement</button>
  
  <script>
    const resonant = new Resonant();
    resonant.add("counter", 0, true); // value, localStorage persistence
  </script>
</body>
</html>
```

That's it! Your counter will automatically update the DOM and persist to localStorage.

---

## ⏱️ Build a Todo in 5 minutes

Copy‑paste the snippet below into an `.html` file and open it in your browser.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ResonantJs • 5‑min Todo</title>
    <style>
      .completed { text-decoration: line-through; color: #888; }
    </style>
    <script src="https://unpkg.com/resonantjs@latest/resonant.js"></script>
  </head>
  <body>
    <h1>Todos (<span res="tasks.length"></span>)</h1>

    <input placeholder="Add a task..." res="newTask" />
    <button onclick="addTask()">Add</button>

    <ul>
      <li res="tasks" res-display="newTask === '' || name.toLowerCase().includes(newTask.toLowerCase())">
        <input type="checkbox" res-prop="completed" />
        <span res-prop="name" res-style="completed ? 'completed' : ''"></span>
        <button res-onclick="removeTask">Remove</button>
      </li>
    </ul>

    <script>
      const resonant = new Resonant();
      resonant.addAll({
        newTask: '',
        tasks: [
          { name: 'Learn ResonantJs', completed: false },
          { name: 'Ship a feature', completed: true }
        ]
      });

      function addTask() {
        const title = newTask.trim();
        if (!title) return;
        tasks.unshift({ name: title, completed: false });
        newTask = '';
      }

      function removeTask(item) {
        const idx = tasks.indexOf(item);
        if (idx !== -1) tasks.delete(idx);
      }

      // Optional: observe changes
      resonant.addCallback('tasks', (list, item, action) => {
        console.log('[tasks]', action, item);
      });
    </script>
  </body>
  </html>
```

Key takeaways:
- Use `res="tasks"` on a template element inside a list container to auto‑render each item.
- Use `res-prop` inside that template to bind fields of the current item.
- Use `res-display` for inline filtering/conditional rendering; inside lists, bare props like `completed` refer to the current item.
- `res-style` returns a space‑separated class string.
- Event handlers referenced by `res-onclick` are global functions and receive `item` when declared with a parameter.

---

## 📖 Core Concepts

### 1. **Data Binding** (`res`)
Bind HTML elements directly to your JavaScript variables:

```html
<span res="username"></span>        <!-- Simple variable -->
<div res="user.profile.name"></div> <!-- Nested object property -->
```

### 2. **Object Properties** (`res-prop`)
Bind to specific properties within objects:

```html
<div res="user">
  <span res-prop="name"></span>
  <span res-prop="email"></span>
</div>
```

### 3. **Array Rendering**
Automatically render arrays with template-based elements:

```html
<ul>
  <li res="todoItems">
    <span res-prop="title"></span>
    <button res-onclick="removeItem(item)">Delete</button>
  </li>
</ul>
```

### 4. **Conditional Display** (`res-display`)
Show/hide elements based on conditions:

```html
<div res-display="user.isActive">Welcome back!</div>
<div res-display="tasks.length > 0">You have tasks</div>
<div res-display="user.role === 'admin'">Admin Panel</div>
```

### 5. **Dynamic Styling** (`res-style`)
Apply conditional CSS classes and styles:

```html
<div res-style="task.completed ? 'completed' : 'pending'">Task</div>
<span res-style="'priority-' + task.priority">High Priority</span>
```

### 6. **Event Handling** (`res-onclick`)
Bind click events with context:

```html
<button res-onclick="editTask(item)">Edit</button>
<button res-onclick-remove="true">Delete Item</button>
```

### 7. **Computed Properties**
Create reactive derived values that automatically update:

```javascript
const resonant = new Resonant();
resonant.add('firstName', 'John');
resonant.add('lastName', 'Doe');

// Computed property automatically updates when dependencies change
resonant.computed('fullName', () => {
  return firstName + ' ' + lastName;
});
```

```html
<span res="fullName"></span> <!-- Automatically shows "John Doe" -->
```

### 8. **Input Binding**
Two-way data binding for form elements:

```html
<input type="text" res="user.name" />
<input type="checkbox" res="settings.darkMode" />
<select res="user.country">
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
</select>
```

---

## 🧭 Best Practices and Tips

- Name your state clearly: variables you `add` become globals on `window` (e.g., `tasks`, `user`). Avoid collisions with existing globals.
- In list templates (`res="items"`), you can reference current item fields directly (`completed`, `name`) or as `item.completed` — both work.
- Prefer `items.set(i, value)` over direct index assignment for clarity; both are reactive.
- When replacing a whole list, use `items.update(newArray)` to emit a single coherent update.
- Use `res-prop=""` to bind an entire object to a single element when you just want to print it.
- `res-onclick` handlers are looked up on `window`. If your handler accepts an argument, Resonant passes the current `item`.
- For quick removal buttons, use `res-onclick-remove="idProp"` to delete by a unique key on each item.
- Computed properties track dependencies automatically. Use plain variable names inside the function (e.g., `firstName`, `lastName`). They are read‑only.
- Conditional display and styles evaluate JavaScript expressions. Keep them simple and fast.

Pro performance notes:
- Resonant selectively re-renders only changed array items by tracking indices and stable object keys.
- Deeply nested objects and arrays are proxied; nested edits still update only affected DOM segments.

---

## 📌 API & Attribute Cheat Sheet

HTML attributes:
- `res` — bind a variable or array/template root
- `res-prop` — bind an object property within a `res` context; empty value binds the whole item
- `res-display` — boolean expression to show/hide element
- `res-style` — expression returning a space‑separated class string
- `res-onclick` — call a global function; if it declares a parameter, it receives the current item
- `res-onclick-remove` — remove from the parent array by matching the given property (e.g., `id`)

JS API:
- `const resonant = new Resonant()`
- `resonant.add(name, value, persist?)`
- `resonant.addAll(objectMap)`
- `resonant.addCallback(name, (newValue, item, action) => void)`
- `resonant.computed(name, () => value)`

Array helpers on reactive arrays:
- `.push`, `.pop`, `.shift`, `.unshift`, `.splice`, `.sort`, `.reverse`
- `.set(index, value)`, `.delete(index)`, `.update(array)`, `.filter(fn)`, `.filterInPlace(fn)`, `.forceUpdate()`

Callback `action` values:
- Scalars: `modified`
- Arrays: `added`, `removed`, `modified`, `updated`, `filtered`

---

## 🎯 Key Features

### **Reactive Data Management**
```javascript
const resonant = new Resonant();

// Add single variables
resonant.add('counter', 0);
resonant.add('user', { name: 'John', age: 30 });

// Batch initialization
resonant.addAll({
  tasks: [],
  settings: { theme: 'light' },
  currentUser: { name: 'Alice', role: 'admin' }
});

// Changes automatically update the UI
user.name = 'Jane';           // DOM updates instantly
tasks.push({ title: 'New task' }); // Array renders new item
```

### **Event Callbacks**
React to data changes with custom logic:

```javascript
resonant.addCallback('tasks', (newValue, item, action) => {
  console.log(`Tasks ${action}:`, item);
  updateTaskCounter();
  saveToAPI();
});

resonant.addCallback('user', (newValue, item, action) => {
  if (action === 'modified') {
    showNotification('Profile updated');
  }
});
```

### **Persistence**
Automatic localStorage integration:

```javascript
// Data persists across browser sessions
resonant.add('userPreferences', { theme: 'dark' }, true);
resonant.add('appState', { currentView: 'dashboard' }, true);

// Changes are automatically saved
userPreferences.theme = 'light'; // Saved to localStorage
```

### **Computed Properties**
Reactive derived values that automatically recalculate:

```javascript
resonant.add('firstName', 'John');
resonant.add('lastName', 'Doe');

// Automatically updates when firstName or lastName changes
resonant.computed('fullName', () => {
  return firstName + ' ' + lastName;
});

// Cannot be set directly - read-only
// fullName = 'Something'; // Will log warning and be ignored

// Chain computed properties
resonant.computed('greeting', () => {
  return 'Hello, ' + fullName + '!';
});
```

### **Advanced Array Operations**
Full array reactivity with custom methods:

```javascript
// All operations trigger UI updates
items.push(newItem);           // Add item
items.splice(index, 1);        // Remove item  
items.update([...newItems]);   // Replace entire array
items.set(index, newValue);    // Update specific index
items.delete(index);           // Delete by index
items.filter(v => v > 0);      // Non-mutating; still triggers a 'filtered' callback
items.filterInPlace(fn);       // Mutating filter + rerender
items.forceUpdate();           // Force a rerender without changing contents
```

---

## 🏗️ Real-World Examples

### Todo List with Filtering
```html
<div>
  <input res="newTask" placeholder="Add task..." />
  <button onclick="addTask()">Add</button>
  
  <select res="filter">
    <option value="all">All Tasks</option>
    <option value="active">Active</option>
    <option value="completed">Completed</option>
  </select>
  
  <ul>
    <li res="filteredTasks" 
        res-display="filter === 'all' || (filter === 'active' && !completed) || (filter === 'completed' && completed)">
      <input type="checkbox" res-prop="completed" />
      <span res-prop="title" res-style="completed ? 'completed-task' : ''"></span>
      <button res-onclick="deleteTask(item)">Delete</button>
    </li>
  </ul>
</div>

<script>
const resonant = new Resonant();
resonant.addAll({
  tasks: [
    { title: 'Learn ResonantJs', completed: false },
    { title: 'Build awesome app', completed: false }
  ],
  newTask: '',
  filter: 'all',
  filteredTasks: []
});

function addTask() {
  if (newTask.trim()) {
    tasks.push({ title: newTask, completed: false });
    newTask = '';
    updateFilter();
  }
}

function deleteTask(task) {
  const index = tasks.indexOf(task);
  tasks.splice(index, 1);
  updateFilter();
}

function updateFilter() {
  filteredTasks.splice(0);
  tasks.forEach(task => filteredTasks.push(task));
}

resonant.addCallback('filter', updateFilter);
resonant.addCallback('tasks', updateFilter);
updateFilter();
</script>
```

### Dashboard with Statistics
```html
<div class="dashboard">
  <div class="stats">
    <div class="stat-card">
      <h3 res="stats.totalTasks"></h3>
      <p>Total Tasks</p>
    </div>
    <div class="stat-card">
      <h3 res="stats.completedTasks"></h3>
      <p>Completed</p>
    </div>
    <div class="stat-card">
      <h3 res="stats.completionRate"></h3>
      <p>% Complete</p>
    </div>
  </div>
  
  <div class="projects">
    <div res="projects">
      <div res-prop="" class="project-card">
        <h3 res-prop="name"></h3>
        <div class="progress-bar">
          <div class="progress" res-style="'width: ' + progress + '%'"></div>
        </div>
        <div res-prop="tasks">
          <div res-prop="" res-style="'task priority-' + priority">
            <span res-prop="title"></span>
            <span res-prop="assignee"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 📚 Advanced Patterns

### **Nested Data Structures**
Handle complex, deeply nested data:

```javascript
resonant.add('company', {
  departments: [
    {
      name: 'Engineering',
      teams: [
        {
          name: 'Frontend',
          members: [
            { name: 'Alice', role: 'Senior Dev', skills: ['React', 'Vue'] },
            { name: 'Bob', role: 'Junior Dev', skills: ['HTML', 'CSS'] }
          ]
        }
      ]
    }
  ]
});

// All levels are reactive
company.departments[0].teams[0].members[0].name = 'Alice Johnson';
company.departments[0].teams[0].members.push(newMember);
```

### **Computed Properties**
Create reactive calculated values that automatically update when dependencies change:

```javascript
const resonant = new Resonant();
resonant.add('tasks', [
  { title: 'Task 1', completed: true },
  { title: 'Task 2', completed: false },
  { title: 'Task 3', completed: true }
]);

// Computed properties automatically recalculate when 'tasks' changes
resonant.computed('totalTasks', () => {
  return tasks.length;
});

resonant.computed('completedTasks', () => {
  return tasks.filter(t => t.completed).length;
});

resonant.computed('completionRate', () => {
  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
});

// Shopping cart example
resonant.add('items', [
  { name: 'Widget', price: 10, quantity: 2 },
  { name: 'Gadget', price: 15, quantity: 1 }
]);
resonant.add('taxRate', 0.08);

resonant.computed('subtotal', () => {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

resonant.computed('tax', () => {
  return subtotal * taxRate;
});

resonant.computed('total', () => {
  return subtotal + tax;
});
```

```html
<!-- These automatically update when items change -->
<div>Subtotal: $<span res="subtotal"></span></div>
<div>Tax: $<span res="tax"></span></div>
<div>Total: $<span res="total"></span></div>
```

### **Component-Like Patterns**
Organize code into reusable patterns:

```javascript
function createTaskManager(containerId) {
  const resonant = new Resonant();
  
  resonant.addAll({
    tasks: [],
    filter: 'all',
    newTask: ''
  });
  
  resonant.addCallback('tasks', updateStats);
  
  return {
    addTask: () => { /* implementation */ },
    removeTask: (task) => { /* implementation */ },
    setFilter: (filter) => { /* implementation */ }
  };
}
```

---

## 🎨 Examples & Demos

Explore our comprehensive examples:

- **[Basic Counter](./examples/example-basic.html)** - Simple reactive counter
- **[Task Manager](./examples/example-taskmanager.html)** - Complete task management app
- **[Houses Demo](./examples/example-houses.html)** - Complex nested data structures
- **[Tests Showcase](./examples/tests.html)** - Interactive testbed used in CI

Each example demonstrates different aspects of ResonantJs and can serve as starting points for your projects.

---

## 🚀 Performance & Browser Support

### **Performance**
- **Minimal overhead**: Only updates affected DOM elements
- **Efficient diffing**: Smart change detection for nested objects
- **Lazy evaluation**: Conditional expressions only run when dependencies change
- **Memory efficient**: Automatic cleanup of unused observers

### **Browser Support**
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/amurgola/ResonantJs.git
cd ResonantJs
npm install
npm test
```

### Running Tests
```bash
npm test                    # Run all tests
npm test -- test/specific.test.js  # Run specific test file
```

---

## 📄 License

ResonantJs is released under the **MIT License**. See [LICENSE](LICENSE) file for details.

---

## 🙋‍♂️ Support & Community

- **Issues**: [GitHub Issues](https://github.com/amurgola/ResonantJs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/amurgola/ResonantJs/discussions)
- **Documentation**: [Full API Documentation](https://github.com/amurgola/ResonantJs/wiki)

---

<div align="center">

**[⭐ Star us on GitHub](https://github.com/amurgola/ResonantJs)** • **[🚀 Try the Demo](./examples/example-taskmanager-simple-demo.html)** • **[📖 Read the Docs](https://github.com/amurgola/ResonantJs/wiki)**

*Built with ❤️ by [Andrew Paul Murgola](https://github.com/amurgola)*

</div>
