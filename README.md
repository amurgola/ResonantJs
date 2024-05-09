# Resonant.js

Resonant.js is an open-source lightweight JavaScript framework that enables reactive data-binding for building dynamic and responsive web applications. It simplifies creating interactive UIs by automatically updating the DOM when your data changes.

## Features

- **Reactive Data Binding**: Automatically synchronize your data with the UI.
- **Dynamic List Rendering**: Easily render lists that react to data changes.
- **Bidirectional Input Binding**: Bind HTML input fields directly to your data model.
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

```javascript
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Resonant.js Quick Demo</title>
    <script src="https://unpkg.com/resonantjs@latest/resonant.js"></script>
</head>
<body>
    <h1>Resonant.js Quick Demo</h1>

    <!-- Display and update a single item -->
    <div>
        <h2>Counter</h2>
        <p>Current count: <span res="counter"></span></p>
        <button onclick="incrementCounter()">Increment Counter</button>
    </div>

    <!-- Demonstrate object property binding -->
    <div>
        <h2>Person Information</h2>
        <div res="person">
            <span res-prop="firstname"></span>
            <span res-prop="lastname"></span>
            <br/><br/>
            First Name: <input type="text" res-prop="firstname">
            Last Name: <input type="text" res-prop="lastname">
        </div>
    </div>

    <!-- Demonstrate dynamic list rendering -->
    <div>
        <h2>Team Members</h2>
        <ul res="team">
            <li>
                <span res-prop="name"></span> - <span res-prop="role"></span>
            </li>
        </ul>
        <button onclick="addTeamMember()">Add Team Member</button>
    </div>

    <script>
        const resonantJs = new Resonant();

        // Initialize a counter
        resonantJs.add("counter", 0);

        // Initialize a single person object
        resonantJs.add("person", {
          firstname: "Andy",
          lastname: "Murgola"
        });

        // Example of a callback
        resonantJs.addCallback("person", exampleCallbackOutput);

        // Initialize a list of people with dynamic properties
        resonantJs.add("team", [
          { name: "Alice", role: "Developer" },
          { name: "Bob", role: "Designer" }
        ]);

        function incrementCounter() {
          counter++;
        }

        function addTeamMember() {
          const newMember = { name: "Charlie", role: "Product Manager" };
          team.push(newMember);
        }

        function exampleCallbackOutput(result) {
          console.log(result.firstname + " " + result.lastname);
        }

    </script>
</body>
</html>

```
## Features Overview

### Core Concepts
- **`res` and `res-prop` Attributes**: Bind HTML elements to your data model seamlessly.
    - `res` is used to identify an overarching data model.
    - `res-prop` links individual properties within that model to corresponding UI elements.

- **Automatic UI Updates**: Changes to your JavaScript objects instantly reflect in the associated UI components, reducing manual DOM manipulation.

### Advanced Features
- **Dynamic Arrays and Objects**: Easily handle collections and nested objects to dynamically add or remove elements based on your data structures.
- **Event Callbacks**: Register custom functions to execute whenever your data model changes.
- **Bidirectional Input Binding**: Bind form input fields directly to your data, making two-way synchronization simple.

### Example Applications
- **Single-Page Applications**: Build dynamic and responsive single-page applications quickly.
- **Admin Dashboards**: Create data-rich dashboards that reflect real-time changes in your database.
- **Form-Based Applications**: Automate forms, surveys, and user profiles for seamless data entry.

## Future Enhancements

- [ ] Support for nested data structures with deep linking.
- [ ] Advanced filtering and sorting methods for arrays.
- [ ] Compatibility with popular JavaScript frameworks.

## License

Resonant.js is released under the MIT License. You can find a copy of the MIT License in the LICENSE file included with the package.
