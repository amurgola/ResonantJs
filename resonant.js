class Resonant {
    constructor() {
        this.data = {};
        this.callbacks = {};
    }

    add(variableName, ...values) {
        let value;
        if (values.length > 1) {
            value = values;
        } else {
            value = values[0];
        }

        this._assignValueToData(variableName, value);
        this._defineProperty(variableName);
        this.updateElement(variableName);
    }

    _assignValueToData(variableName, value) {
        if (Array.isArray(value)) {
            this.data[variableName] = this._createArray(variableName, value);
        } else if (typeof value === 'object') {
            this.data[variableName] = this._createObject(variableName, value);
        } else {
            this.data[variableName] = value;
        }
    }

    _createObject(parentName, obj) {
        obj[Symbol('isProxy')] = true;
        return new Proxy(obj, {
            set: (target, property, value) => {
                target[property] = value;
                this.updateElement(parentName);
                return true;
            }
        });
    }

    _createArray(variableName, arr) {
        return new Proxy(arr, {
            get: (target, index) => {
                if (typeof target[index] === 'object') {
                    target[index] = this._createObject(`${variableName}[${index}]`, target[index]);
                }
                return target[index];
            },
            set: (target, index, value) => {
                target[index] = value;
                this.updateElement(variableName);
                return true;
            }
        });
    }

    _defineProperty(variableName) {
        Object.defineProperty(window, variableName, {
            get: () => this.data[variableName],
            set: (newValue) => {
                this._assignValueToData(variableName, newValue);
                this.updateElement(variableName);
            }
        });
    }

    updateElement(variableName) {
        const elements = document.querySelectorAll(`[res="${variableName}"]`);
        const value = this.data[variableName];

        elements.forEach(element => {
            if (Array.isArray(value)) {
                element.querySelectorAll(`[res="${variableName}"]` && "[res-rendered=true]").forEach(el => el.remove());
                this._renderArray(variableName, element);
            } else if (typeof value === 'object') {
                const subElements = element.querySelectorAll(`[res-prop]`);

                subElements.forEach(subEl => {
                    const key = subEl.getAttribute('res-prop');
                    if (key && key in value) {
                        if (subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') {
                            subEl.value = value[key];
                            subEl.oninput = () => this.data[variableName][key] = subEl.value;
                        } else {
                            subEl.innerHTML = value[key];
                        }
                    }
                });
            } else {
                element.innerHTML = value;
            }
        });

        if (this.callbacks[variableName]) {
            this.callbacks[variableName](value);
        }
    }


    _renderArray(variableName, el) {
        let template = el.cloneNode(true);
        el.innerHTML = '';

        if (!window[variableName + "_template"]) {
            window[variableName + "_template"] = template;
        } else {
            template = window[variableName + "_template"];
        }

        this.data[variableName].forEach((instance) => {
            const clonedEl = template.cloneNode(true);
            for (let key in instance) {
                const subEl = clonedEl.querySelector(`[res-prop="${key}"]`);
                if (subEl) {
                    if (subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') {
                        subEl.value = instance[key];
                        subEl.oninput = () => instance[key] = subEl.value;
                    } else {
                        subEl.innerHTML = instance[key];
                    }
                }
            }
            clonedEl.setAttribute("res-rendered", true);
            el.appendChild(clonedEl);
        });
    }

    addCallback(variableName, method) {
        this.callbacks[variableName] = method;
    }
}
