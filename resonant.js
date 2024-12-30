class ObservableArray extends Array {
    constructor(variableName, resonantInstance, ...args) {
        if (resonantInstance === undefined) {
            return super(...args);
        }
        super(...args);

        var isCreating = resonantInstance.data[variableName] === undefined;

        this.variableName = variableName;
        this.resonantInstance = resonantInstance;
        this.isDeleting = false;

        this.forEach((item, index) => {
            if (typeof item === 'object') {
                this[index] = this._createProxy(item, index);
            }
        });

        if(!isCreating) {
            this.forceUpdate();
        }
    }

    _createProxy(item, index) {
        return new Proxy(item, {
            set: (target, property, value) => {
                if (target[property] !== value) {
                    const oldValue = target[property];
                    target[property] = value;
                    this.resonantInstance._queueUpdate(this.variableName, 'modified', target, property, oldValue, index);
                }
                return true;
            }
        });
    }

    forceUpdate() {
        this.resonantInstance.arrayDataChangeDetection[this.variableName] = this.slice();
        this.resonantInstance._queueUpdate(this.variableName, 'modified', this.slice());
    }

    update(array) {
        window[this.variableName] = array;
        this.resonantInstance._queueUpdate(this.variableName, 'updated', array);
    }

    push(...args) {
        args = args.map((item, index) => {
            if (typeof item === 'object') {
                return this._createProxy(item, this.length + index);
            }
            return item;
        });
        const result = super.push(...args);
        this.resonantInstance.arrayDataChangeDetection[this.variableName] = this.slice();
        args.forEach((item, index) => {
            this.resonantInstance._queueUpdate(this.variableName, 'added', item, this.length - 1 - index);
        });
        return result;
    }

    splice(start, deleteCount, ...items) {
        items = items.map((item, index) => {
            if (typeof item === 'object') {
                return this._createProxy(item, start + index);
            }
            return item;
        });
        const removedItems = super.splice(start, deleteCount, ...items);
        this.resonantInstance.arrayDataChangeDetection[this.variableName] = this.slice();

        if (deleteCount > 0) {
            removedItems.forEach((item, index) => {
                this.resonantInstance._queueUpdate(this.variableName, 'removed', item, start + index);
            });
        }

        if (items.length > 0) {
            items.forEach((item, index) => {
                this.resonantInstance._queueUpdate(this.variableName, 'added', item, start + index);
            });
        }

        return removedItems;
    }

    set(index, value) {
        if (this[index] !== value) {
            if (this.isDeleting) {
                return true;
            }

            const originalBeforeChange = this.resonantInstance.arrayDataChangeDetection[this.variableName];
            let action = 'modified';

            if (index >= originalBeforeChange.length) {
                action = 'added';
            } else if (originalBeforeChange[index] === undefined) {
                action = 'added';
            }

            this.resonantInstance.arrayDataChangeDetection[this.variableName] = this.slice();
            const oldValue = this[index];
            this[index] = value;

            this.resonantInstance._queueUpdate(this.variableName, action, this[index], index, oldValue);
        }
        return true;
    }

    delete(index) {
        const oldValue = this[index];
        this.isDeleting = true;
        this.splice(index, 1);
        this.resonantInstance.arrayDataChangeDetection[this.variableName] = this.slice();
        this.resonantInstance._queueUpdate(this.variableName, 'removed', null, index, oldValue);
        this.isDeleting = false;
        return true;
    }

    filter(filter, actuallyFilter = true) {
        if(this.resonantInstance === undefined || actuallyFilter === false) {
            return super.filter(filter);
        }
        const result = super.filter(filter);
        this.resonantInstance.arrayDataChangeDetection[this.variableName] = this.slice();
        this.resonantInstance._queueUpdate(this.variableName, 'filtered');
        return result;
    }
}

class Resonant {
    constructor() {
        this.data = {};
        this.callbacks = {};
        this.pendingUpdates = new Map();
        this.arrayDataChangeDetection = {};
    }

    _handleInputElement(element, value, onChangeCallback) {
        if (element.type === 'checkbox') {
            element.checked = value;
            if (!element.hasAttribute('data-resonant-bound')) {
                element.onchange = () => onChangeCallback(element.checked);
                element.setAttribute('data-resonant-bound', 'true');
            }
        } else {
            element.value = value;
            if (!element.hasAttribute('data-resonant-bound')) {
                element.oninput = () => onChangeCallback(element.value);
                element.setAttribute('data-resonant-bound', 'true');
            }
        }
    }

    add(variableName, value, persist) {
        value = this.persist(variableName, value, persist);
        if (Array.isArray(value)) {
            this.data[variableName] = new ObservableArray(variableName, this, ...value);
            this.arrayDataChangeDetection[variableName] = this.data[variableName].slice();
        } else if (typeof value === 'object' && value !== null) {
            this.data[variableName] = this._createObject(variableName, value);
        } else {
            this.data[variableName] = value;
        }

        this._defineProperty(variableName);
        this.updateElement(variableName);
    }

    persist(variableName, value, persist) {
        if (persist === undefined || !persist) {
            return value;
        }
        var found = localStorage.getItem('res_' + variableName);
        if (found !== null && found !== undefined) {
            return JSON.parse(found);
        } else {
            localStorage.setItem('res_' + variableName, JSON.stringify(value));
            return value;
        }
    }

    updatePersistantData(variableName) {
        if (localStorage.getItem('res_' + variableName)) {
            localStorage.setItem('res_' + variableName, JSON.stringify(this.data[variableName]));
        }
    }

    addAll(config) {
        Object.entries(config).forEach(([variableName, value]) => {
            this.add(variableName, value);
        });
    }

    _resolveValue(instance, key, override = null) {
        return override ?? instance[key];
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

    _evaluateDisplayCondition(element, item, condition) {
        try {
            const show = new Function('item', `return ${condition}`)(item);
            element.style.display = show ? '' : 'none';
        } catch (e) {
            console.error(`Error evaluating display condition: ${condition}`, e);
        }
    }

    _handleDisplayElements(parentElement, instance) {
        const displayElements = parentElement.querySelectorAll('[res-display]');
        displayElements.forEach(displayEl => {
            const condition = displayEl.getAttribute('res-display') || '';
            this._evaluateDisplayCondition(displayEl, instance, condition);
        });
    }

    _bindClickEvents(parentElement, instance, arrayValue) {
        const onclickElements = parentElement.querySelectorAll('[res-onclick], [res-onclick-remove]');
        onclickElements.forEach(onclickEl => {
            const functionName = onclickEl.getAttribute('res-onclick');
            const removeKey = onclickEl.getAttribute('res-onclick-remove');

            if (functionName) {
                onclickEl.onclick = () => {
                    const func = new Function('item', `return ${functionName}(item)`);
                    func(instance);
                };
            }
            if (removeKey) {
                onclickEl.onclick = () => {
                    if (arrayValue) {
                        const removeIdx = arrayValue.findIndex(t => t[removeKey] === instance[removeKey]);
                        if (removeIdx !== -1) {
                            arrayValue.splice(removeIdx, 1);
                        }
                    }
                };
            }
        });
    }

    _defineProperty(variableName) {
        Object.defineProperty(window, variableName, {
            get: () => this.data[variableName],
            set: (newValue) => {
                if (Array.isArray(newValue)) {
                    this.data[variableName] = new ObservableArray(variableName, this, ...newValue);
                    this.arrayDataChangeDetection[variableName] = this.data[variableName].slice();
                } else if (typeof newValue === 'object' && newValue !== null) {
                    this.data[variableName] = this._createObject(variableName, newValue);
                } else {
                    this.data[variableName] = newValue;
                }
                this.updateElement(variableName);
                this.updateDisplayConditionalsFor(variableName);
                this.updateStylesFor(variableName);

                if (!Array.isArray(newValue) && (typeof newValue !== 'object' || newValue === null)) {
                    this._queueUpdate(variableName, 'modified', this.data[variableName]);
                }
            }
        });
    }

    _queueUpdate(variableName, action, item, property, oldValue) {
        if (!this.pendingUpdates.has(variableName)) {
            this.pendingUpdates.set(variableName, []);
        }
        this.pendingUpdates.get(variableName).push({ action, item, property, oldValue });

        if (this.pendingUpdates.get(variableName).length === 1) {
            setTimeout(() => {
                let updates = this.pendingUpdates.get(variableName);
                this.updatePersistantData(variableName);
                this.pendingUpdates.delete(variableName);

                updates = updates.filter((v, i, a) =>
                    a.findIndex(t => (t.property === v.property && t.action === v.action)) === i
                );

                updates.forEach(update => {
                    this._triggerCallbacks(variableName, update);
                });

                this.updateElement(variableName);
                this.updateDisplayConditionalsFor(variableName);
                this.updateStylesFor(variableName);
            }, 0);
        }
    }

    _triggerCallbacks(variableName, callbackData) {
        if (this.callbacks[variableName]) {
            this.callbacks[variableName].forEach(callback => {
                const item = callbackData.item || callbackData.oldValue;
                callback(this.data[variableName], item, callbackData.action);
            });
        }
    }

    updateElement(variableName) {
        const elements = document.querySelectorAll(`[res="${variableName}"]`);
        const value = this.data[variableName];

        elements.forEach(element => {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                this._handleInputElement(element, value, (newValue) => {
                    this.data[variableName] = newValue;
                    this._queueUpdate(variableName, 'modified', this.data[variableName]);
                });
            }
            else if (Array.isArray(value)) {
                element.querySelectorAll(`[res="${variableName}"][res-rendered="true"]`).forEach(el => el.remove());
                this._renderArray(variableName, element);
            }
            else if (typeof value === 'object' && value !== null) {
                const subElements = element.querySelectorAll('[res-prop]');
                subElements.forEach(subEl => {
                    const key = subEl.getAttribute('res-prop');
                    if (key && key in value) {
                        this._renderObjectProperty(subEl, value[key], variableName, key);
                    }
                });
            }
            else {
                element.innerHTML = value ?? '';
            }
        });

        this.updateDisplayConditionalsFor(variableName);
        this.updateStylesFor(variableName);
    }

    _renderObjectProperty(subEl, propValue, parentVarName, key) {
        if ((subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') &&
            !Array.isArray(propValue) &&
            typeof propValue !== 'object') {
            this._handleInputElement(subEl, propValue, (newValue) => {
                window[parentVarName][key] = newValue;
            });
        }
        else if (Array.isArray(propValue)) {
            this._renderNestedArray(subEl, propValue);
        }
        else if (typeof propValue === 'object' && propValue !== null) {
            const nestedElements = subEl.querySelectorAll('[res-prop]');
            nestedElements.forEach(nestedEl => {
                const nestedKey = nestedEl.getAttribute('res-prop');
                if (nestedKey && nestedKey in propValue) {
                    this._renderObjectProperty(nestedEl, propValue[nestedKey], parentVarName, nestedKey);
                }
            });
        }
        else {
            subEl.innerHTML = propValue ?? '';
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

        this.data[variableName].forEach((instance, index) => {
            const clonedEl = template.cloneNode(true);
            clonedEl.setAttribute("res-index", index);

            for (let key in instance) {
                let overrideInstanceValue = null;
                let subEl = clonedEl.querySelector(`[res-prop="${key}"]`);
                if (!subEl) {
                    subEl = clonedEl.querySelector('[res-prop=""]');
                    overrideInstanceValue = instance;
                }
                if (subEl) {
                    const value = this._resolveValue(instance, key, overrideInstanceValue);

                    if ((subEl.tagName === 'INPUT' || subEl.tagName === 'TEXTAREA') &&
                        !Array.isArray(value) &&
                        typeof value !== 'object') {
                        this._handleInputElement(
                            subEl,
                            value,
                            (newValue) => {
                                instance[key] = newValue;
                                this._queueUpdate(variableName, 'modified', instance, key, value);
                            }
                        );
                    }
                    else if (Array.isArray(value)) {
                        this._renderNestedArray(subEl, value);
                    }
                    else if (typeof value === 'object' && value !== null) {
                        const nestedElements = subEl.querySelectorAll('[res-prop]');
                        nestedElements.forEach(nestedEl => {
                            const nestedKey = nestedEl.getAttribute('res-prop');
                            if (nestedKey && nestedKey in value) {
                                this._renderObjectProperty(nestedEl, value[nestedKey], variableName, nestedKey);
                            }
                        });
                    }
                    else {
                        subEl.innerHTML = value ?? '';
                    }
                }
            }

            this._handleDisplayElements(clonedEl, instance);
            this._bindClickEvents(clonedEl, instance, this.data[variableName]);

            clonedEl.setAttribute("res-rendered", "true");
            el.appendChild(clonedEl);
        });
    }

    _renderNestedArray(subEl, arrayValue) {
        const template = subEl.cloneNode(true);
        subEl.innerHTML = '';

        subEl.removeAttribute('res-prop');

        arrayValue.forEach((item, idx) => {
            const cloned = template.cloneNode(true);
            cloned.setAttribute('res-rendered', 'true');

            const nestedEls = cloned.querySelectorAll('[res-prop]');
            nestedEls.forEach(nestedEl => {
                const nestedKey = nestedEl.getAttribute('res-prop');
                if (nestedKey && nestedKey in item) {
                    this._renderObjectProperty(nestedEl, item[nestedKey], null, nestedKey);
                }
            });

            this._handleDisplayElements(cloned, item);
            this._bindClickEvents(cloned, item, arrayValue);

            subEl.appendChild(cloned);
        });
    }

    updateDisplayConditionalsFor(variableName) {
        const conditionalElements = document.querySelectorAll(`[res-display*="${variableName}"]`);
        conditionalElements.forEach(conditionalElement => {
            const condition = conditionalElement.getAttribute('res-display');
            this._evaluateDisplayCondition(conditionalElement, this.data[variableName], condition);
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

                let resStyles = styleElement.getAttribute('res-styles');
                if (resStyles) {
                    let resStylesArray = resStyles.split(' ');
                    resStylesArray.forEach(resStyle => {
                        styleElement.classList.remove(resStyle);
                    });
                }

                if (index !== null) {
                    const item = this.data[variableName][index];
                    styleCondition = styleCondition.replace(new RegExp(`\\b${variableName}\\b`, 'g'), 'item');
                    const styleClass = new Function('item', `return ${styleCondition}`)(item);
                    if (styleClass) {
                        styleElement.classList.add(styleClass);
                    } else {
                        const elementHasStyle = styleElement.classList.contains(styleClass);
                        if (elementHasStyle) {
                            styleElement.classList.remove(styleClass);
                        }
                    }
                } else {
                    const styleClass = eval(styleCondition);
                    if (styleClass) {
                        styleElement.classList.add(styleClass);
                        styleElement.setAttribute('res-styles', styleClass);
                    } else {
                        const elementHasStyle = styleElement.classList.contains(styleClass);
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

    addCallback(variableName, method) {
        if (!this.callbacks[variableName]) {
            this.callbacks[variableName] = [];
        }
        this.callbacks[variableName].push(method);
    }
}