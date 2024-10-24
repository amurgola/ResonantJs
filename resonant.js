class ObservableArray extends Array {
    constructor(variableName, resonantInstance, ...args) {
        if(resonantInstance === undefined) {
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

    //temp fix for issues
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

    add(variableName, value, persist) {
        value = this.persist(variableName, value, persist);
        if (Array.isArray(value)) {
            this.data[variableName] = new ObservableArray(variableName, this, ...value);
            this.arrayDataChangeDetection[variableName] = this.data[variableName].slice();
        } else if (typeof value === 'object') {
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
        if (found !== null && found !== undefined){
            return JSON.parse(localStorage.getItem('res_' + variableName));
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

    _defineProperty(variableName) {
        Object.defineProperty(window, variableName, {
            get: () => this.data[variableName],
            set: (newValue) => {
                if (Array.isArray(newValue)) {
                    this.data[variableName] = new ObservableArray(variableName, this, ...newValue);
                    this.arrayDataChangeDetection[variableName] = this.data[variableName].slice(); // Create a copy for change detection

                } else if (typeof newValue === 'object') {
                    this.data[variableName] = this._createObject(variableName, newValue);
                } else {
                    this.data[variableName] = newValue;
                }
                this.updateElement(variableName);
                this.updateDisplayConditionalsFor(variableName);
                this.updateStylesFor(variableName);
                if (!Array.isArray(newValue) && typeof newValue !== 'object') {
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

                updates = updates.filter((v, i, a) => a.findIndex(t => (t.property === v.property && t.action === v.action)) === i);
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
            if (Array.isArray(value)) {
                element.querySelectorAll(`[res="${variableName}"][res-rendered=true]`).forEach(el => el.remove());
                this._renderArray(variableName, element);
            }
            else if (typeof value === 'object') {
                const subElements = element.querySelectorAll(`[res-prop]`);
                subElements.forEach(subEl => {
                    const key = subEl.getAttribute('res-prop');
                    if (key && key in value) {
                        this.renderElement(subEl, value, key, variableName);
                    }
                });
            } else {
                this.renderElement(element, value, "", variableName);
            }
        });

        this.updateDisplayConditionalsFor(variableName);
        this.updateStylesFor(variableName);
    }

    renderElement(element, value, key, variableName, overrideElementValue, isFromArray = false) {
        let elementValue = value;

        if (key) {
            elementValue = value[key];
        }

        if (overrideElementValue) {
            elementValue = overrideElementValue;
        }

        let updateReference = (newValue) => {
            if (isFromArray) {
                if (key) {
                    value[key] = newValue;
                } else {
                    value = newValue;
                }
            } else {
                if (key && variableName) {
                    this.data[variableName][key] = newValue;
                } else if (variableName) {
                    this.data[variableName] = newValue;
                } else {
                    this.data[key] = newValue;
                }
            }
        };

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.type === 'checkbox') {
                element.checked = elementValue;
                element.onchange = () => {
                    updateReference(element.checked);
                };
            } else {
                element.value = elementValue;
                element.oninput = () => {
                    updateReference(element.value);
                };
            }
        } else if (element.tagName === 'IMG') {
            element.src = elementValue;
        } else {
            element.innerHTML = elementValue;
        }
    }

    updateDisplayConditionalsFor(variableName) {
        const conditionalElements = document.querySelectorAll(`[res-display*="${variableName}"]`);
        conditionalElements.forEach(conditionalElement => {
            const condition = conditionalElement.getAttribute('res-display');
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
                        var elementHasStyle = styleElement.classList.contains(styleClass);
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
                let overrideInstanceValue = null;
                let subEl = clonedEl.querySelector(`[res-prop="${key}"]`);
                if(!subEl) {
                    subEl = clonedEl.querySelector(`[res-prop=""]`);
                    overrideInstanceValue = instance;
                }
                if (subEl) {
                    this.renderElement(subEl, instance, key, variableName, overrideInstanceValue, true);
                }
            }

            const onclickElements = clonedEl.querySelectorAll('[res-onclick], [res-onclick-remove]');
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