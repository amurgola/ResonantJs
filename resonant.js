class Resonant {
    constructor() {
        this.data = {};
        this.callbacks = {};
        this.pendingUpdates = new Set();
    }

    add(variableName, value) {
        this._assignValueToData(variableName, value);
        this._defineProperty(variableName);
        this.updateElement(variableName);
    }

    addAll(config) {
        Object.entries(config).forEach(([variableName, value]) => {
            this.add(variableName, value);
        });
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

    _createObject(variableName, obj) {
        obj[Symbol('isProxy')] = true;
        return new Proxy(obj, {
            set: (target, property, value) => {
                if (target[property] !== value) {
                    const oldValue = target[property];
                    target[property] = value;
                    this._queueUpdate(variableName, 'modified', target, property, oldValue);
                }
                return true;
            }
        });
    }

    _createArray(variableName, arr) {
        const self = this;
        return new Proxy(arr, {
            get(target, index) {
                if (typeof target[index] === 'object' && !target[index][Symbol('isProxy')]) {
                    target[index] = self._createObject(`${variableName}[${index}]`, target[index]);
                }
                return target[index];
            },
            set(target, index, value) {
                if (target[index] !== value) {
                    const action = target.hasOwnProperty(index) ? 'modified' : 'added';
                    const oldValue = target[index];
                    target[index] = value;
                    self._queueUpdate(variableName, action, target[index], index, oldValue);
                }
                return true;
            },
            deleteProperty(target, index) {
                const oldValue = target[index];
                target.splice(index, 1);
                self._queueUpdate(variableName, 'removed', oldValue, index);
                return true;
            }
        });
    }

    _queueUpdate(variableName, action, item, property, oldValue) {

        if (!this.pendingUpdates.has(variableName)) {
            this.pendingUpdates.add(variableName);
            setTimeout(() => {
                this.pendingUpdates.delete(variableName);
                this._triggerCallbacks(variableName, action, item, property, oldValue);
                this.updateElement(variableName);
                this.updateConditionalsFor(variableName);
                this.updateStylesFor(variableName);
            }, 0);
        }
    }

    _triggerCallbacks(variableName, action, item, property, oldValue) {
        if (this.callbacks[variableName]) {
            this.callbacks[variableName].forEach(callback => callback(this.data[variableName], item, action, property, oldValue));
        }
    }

    _defineProperty(variableName) {
        Object.defineProperty(window, variableName, {
            get: () => this.data[variableName],
            set: (newValue) => {
                this._assignValueToData(variableName, newValue);
                this.updateElement(variableName);
                this.updateConditionalsFor(variableName);
                this.updateStylesFor(variableName);
                if (!Array.isArray(newValue) && typeof newValue !== 'object') {
                    this._queueUpdate(variableName, 'modified', this.data[variableName]);
                }
            }
        });
    }

    updateElement(variableName) {
        const elements = document.querySelectorAll(`[res="${variableName}"]`);
        const value = this.data[variableName];

        elements.forEach(element => {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (!element.hasAttribute('data-resonant-bound')) {
                    element.value = value;
                    element.oninput = () => {
                        this.data[variableName] = element.value;
                        this._queueUpdate(variableName, 'modified', this.data[variableName]);
                    };
                    element.setAttribute('data-resonant-bound', 'true');
                }
            } else if (Array.isArray(value)) {
                element.querySelectorAll(`[res="${variableName}"][res-rendered=true]`).forEach(el => el.remove());
                this._renderArray(variableName, element);
            } else if (typeof value === 'object') {
                const subElements = element.querySelectorAll(`[res-prop]`);
                subElements.forEach(subEl => {
                    const key = subEl.getAttribute('res-prop');
                    if (key && key in value) {
                        if (!subEl.hasAttribute('data-resonant-bound')) {
                            if (subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') {
                                if (subEl.type === 'checkbox') {
                                    subEl.checked = value[key];
                                    subEl.onchange = () => {
                                        this.data[variableName][key] = subEl.checked;
                                    };
                                } else {
                                    subEl.value = value[key];
                                    subEl.oninput = () => {
                                        this.data[variableName][key] = subEl.value;
                                    };
                                }
                            } else {
                                subEl.innerHTML = value[key];
                            }
                            subEl.setAttribute('data-resonant-bound', 'true');
                        } else {
                            if (subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') {
                                if (subEl.type === 'checkbox') {
                                    subEl.checked = value[key];
                                } else {
                                    subEl.value = value[key];
                                }
                            } else {
                                subEl.innerHTML = value[key];
                            }
                        }
                    }
                });
            } else {
                element.innerHTML = value;
            }
        });

        this.updateConditionalsFor(variableName);
        this.updateStylesFor(variableName);
    }

    updateConditionalsFor(variableName) {
        const conditionalElements = document.querySelectorAll(`[res-conditional*="${variableName}"]`);
        conditionalElements.forEach(conditionalElement => {
            const condition = conditionalElement.getAttribute('res-conditional');
            try {
                if (eval(condition)) {
                    conditionalElement.style.display = '';
                } else {
                    conditionalElement.style.display = 'none';
                }
            } catch (e) {
                console.error(`Error evaluating condition for ${variableName}: ${condition}`, e);
            }
        });
    }

    updateStylesFor(variableName) {
        const styleElements = document.querySelectorAll(`[res-style*="${variableName}"]`);

        styleElements.forEach(styleElement => {
            let styleCondition = styleElement.getAttribute('res-style');
            try {
                let parent = styleElement;
                let index = null;
                while (parent && !index) {
                    index = parent.getAttribute('res-index');
                    parent = parent.parentElement;
                }

                if (index !== null) {
                    const item = this.data[variableName][index];
                    styleCondition = styleCondition.replace(new RegExp(`\\b${variableName}\\b`, 'g'), 'item');
                    const styleClass = new Function('item', `return ${styleCondition}`)(item);

                    if (styleClass) {
                        styleElement.classList.add(styleClass);
                    } else {
                        var elementHasStyle = styleElement.classList.contains(styleClass);
                        if (elementHasStyle) {
                            styleElement.classList.remove(styleClass);
                        }
                    }
                } else {
                    const styleClass = eval(styleCondition);
                    if (styleClass) {
                        styleElement.classList.add(styleClass);
                    } else {
                        var elementHasStyle = styleElement.classList.contains(styleClass);
                        if (elementHasStyle) {
                            styleElement.classList.remove(styleClass);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error evaluating style for ${variableName}: ${styleCondition}`, e);
            }
        });
    }

    _renderArray(variableName, el) {
        let template = el.cloneNode(true);
        el.innerHTML = '';

        if (!window[variableName + "_template"]) {
            window[variableName + "_template"] = template;
        } else {
            template = window[variableName + "_template"];
        }

        this.data[variableName].forEach((instance, index) => {
            const clonedEl = template.cloneNode(true);
            clonedEl.setAttribute("res-index", index);
            for (let key in instance) {
                const subEl = clonedEl.querySelector(`[res-prop="${key}"]`);
                if (subEl) {
                    if (!subEl.hasAttribute('data-resonant-bound')) {
                        if (subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') {
                            if (subEl.type === 'checkbox') {
                                subEl.checked = instance[key];
                                subEl.onchange = () => {
                                    instance[key] = subEl.checked;
                                    this._queueUpdate(variableName, 'modified', instance, key, instance[key]);
                                };
                            } else {
                                subEl.value = instance[key];
                                subEl.oninput = () => {
                                    instance[key] = subEl.value;
                                    this._queueUpdate(variableName, 'modified', instance, key, instance[key]);
                                };
                            }
                        } else {
                            subEl.innerHTML = instance[key];
                        }
                        subEl.setAttribute('data-resonant-bound', 'true');
                    } else {
                        if (subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') {
                            if (subEl.type === 'checkbox') {
                                subEl.checked = instance[key];
                            } else {
                                subEl.value = instance[key];
                            }
                        } else {
                            subEl.innerHTML = instance[key];
                        }
                    }
                }
            }

            const onclickElements = clonedEl.querySelectorAll('[res-onclick], [res-onclick-remove]');
            onclickElements.forEach(onclickEl => {
                const functionName = onclickEl.getAttribute('res-onclick');
                const removeKey = onclickEl.getAttribute('res-onclick-remove');

                if (functionName) {
                    onclickEl.onclick = null;

                    onclickEl.onclick = () => {
                        const func = new Function('item', `return ${functionName}(item)`);
                        func(instance);
                    };
                }

                if (removeKey) {
                    onclickEl.onclick = null;

                    onclickEl.onclick = () => {
                        const index = this.data[variableName].findIndex(t => t[removeKey] === instance[removeKey]);
                        if (index !== -1) {
                            this.data[variableName].splice(index, 1);
                        }
                    };
                }
            });

            clonedEl.setAttribute("res-rendered", true);
            el.appendChild(clonedEl);
        });
    }

    addCallback(variableName, method) {
        if (!this.callbacks[variableName]) {
            this.callbacks[variableName] = [];
        }
        this.callbacks[variableName].push(method);
    }
}
