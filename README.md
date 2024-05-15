# Resonant.js

Resonant.js is an open-source lightweight JavaScript framework that enables reactive data-binding for building dynamic and responsive web applications. It simplifies creating interactive UIs by automatically updating the DOM when your data changes.

## Features

- **Reactive Data Binding**: Automatically synchronize your data with the UI.
- **Dynamic List Rendering**: Easily render lists that react to data changes.
- **Bidirectional Input Binding**: Bind HTML input fields directly to your data model.
- **Efficient Conditional Updates**: Only evaluate conditional expressions tied to specific variable changes.
- **Lightweight and Easy to Integrate**: Minimal setup required to get started.
- **Compatible with Modern Browsers**: Works seamlessly across all modern web browsers.
## Installation
## NPM
To install via NPM, use the following command:

```bash 
npm i resonantjs
```

## CDN
To use via CDN, include the following URLs in your HTML file:

```html 
<script src="https://unpkg.com/resonantjs@latest/resonant.js"></script>
```

## Demo
![](https://github.com/amurgola/ResonantJs/blob/main/Demo.gif)

## Usage
Include resonant.js in your HTML file, and use the following example to understand how to integrate it into your web application.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Resonant.js Basic Example</title>
  <script src="https://unpkg.com/resonantjs@latest/resonant.js"></script>
</head>
<body>
<h1>Resonant.js Basic Example</h1>
<div>
  <h2>Counter</h2>
  <p>Current count: <span res="counter"></span></p>
  <button onclick="counter++">Increment Counter</button>
</div>

<script>
  const resonantJs = new Resonant();
  resonantJs.add("counter", 0);
</script>
</body>
</html>
```

## Features Overview

### Core Concepts
- **`res` and `res-prop` Attributes**: Bind HTML elements to your data model seamlessly.
    - `res` is used to identify an overarching data model.
    - `res-prop` links individual properties within that model to corresponding UI elements.
- **`res-conditional` Attribute**: Conditionally display elements based on the data model's properties.
- **`res-onclick` Attribute**: Triggers a function when an element is clicked, allowing for custom event handling.
- **`res-onclick-remove` Attribute**: Removes an item from an array when the associated element is clicked.
- **Automatic UI Updates**: Changes to your JavaScript objects instantly reflect in the associated UI components, reducing manual DOM manipulation.

### Advanced Features
- **Dynamic Arrays and Objects**: Easily handle collections and nested objects to dynamically add or remove elements based on your data structures.
- **Event Callbacks**: Register custom functions to execute whenever your data model changes.
- **Bidirectional Input Binding**: Bind form input fields directly to your data, making two-way synchronization simple.

### New Features in Version 1.0.2

#### Pending Updates Mechanism
- Introduced to prevent redundant updates and ensure callbacks are only triggered once per update cycle, improving performance and user experience.

#### Callback Parameter Enhancement
- Callbacks now receive detailed parameters including the specific action taken (`added`, `modified`, `removed`), the item affected, and the previous value. This provides better context for handling updates.

#### Batched Updates for Object Properties
- Improved handling of object property updates to ensure changes are batched together, preventing multiple redundant callback triggers.

#### Refined Data Binding
- Enhanced data binding between model and view to ensure consistent synchronization without unnecessary updates.

### Task Manager Example

Here is an example of a task manager application using Resonant.js:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Resonant.js Task Manager Demo</title>
    <script src="https://cdn.jsdelivr.net/npm/resonantjs@latest/dist/resonant.min.js"></script>
</head>
<body>
<h1>Resonant.js Task Manager Demo</h1>

<!-- Task Input -->
<div>
    <h2>Add New Task</h2>
    <input type="text" placeholder="Task Name" res="taskName" />
    <button onclick="addTask()">Add Task</button>
</div>

<!-- Task List -->
<div>
    <h2>Task List</h2>
    <ul res="tasks">
        <li>
            <input type="checkbox" res-prop="done" />
            <span res-prop="name"></span>
            <button res-onclick-remove="name">Remove</button>
        </li>
    </ul>
</div>

<script>
    const resonantJs = new Resonant();

    // Initialize variables using a configuration object
    resonantJs.addAll({
        tasks: [
            { name: "Task 1", done: false },
            { name: "Task 2", done: true }
        ],
        taskName: ""
    });

    // Add a callback to log actions taken on tasks
    resonantJs.addCallback("tasks", (tasks, task, action) => {
        console.log(`Action taken: ${action} for ${task.name}`);
    });

    // Add a function to add a new task
    function addTask() {
        const newTask = { name: taskName, done: false };
        tasks.push(newTask);
        taskName = '';
    }
</script>
</body>
</html>
```

## Other Information
- The demo HTML file uses the Pico CSS framework for styling. You can find more information about Pico CSS [here](https://picocss.com/).

## License

Resonant.js is released under the MIT License. You can find a copy of the MIT License in the LICENSE file included with the package.
