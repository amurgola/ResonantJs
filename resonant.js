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
                this._setKeyForObjectAndChildObjects(item, index);
                this[index] = this._createProxy(item, index);
            }
        });

        if(!isCreating) {
            this.forceUpdate();
        }
    }

    _setKeyForObjectAndChildObjects(obj, index) {
        if (typeof obj === 'object') {
            obj.key = index + '-' + this._generateKeyByContentCheckSum(obj);
            Object.keys(obj).forEach(key => {
                this._setKeyForObjectAndChildObjects(obj[key], index);
            });
        }
    }

    _generateKeyByContentCheckSum(obj) {
        const removeKeysRecursively = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;

            if (Array.isArray(obj)) {
                return obj.map(item => removeKeysRecursively(item));
            }

            const newObj = {...obj};
            delete newObj.key;

            Object.keys(newObj).forEach(key => {
                if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                    newObj[key] = removeKeysRecursively(newObj[key]);
                }
            });

            return newObj;
        };

        const objForHash = removeKeysRecursively(obj);
        const str = JSON.stringify(objForHash);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    _wrapNestedObjects(obj, index) {
        if (obj && typeof obj === 'object' && !obj.__resonantProxy) {
            Object.keys(obj).forEach(k => {
                obj[k] = this._wrapNestedObjects(obj[k], index);
            });
            obj.__resonantProxy = true;
            return new Proxy(obj, {
                set: (target, prop, value) => {
                    if (target[prop] !== value) {
                        const oldValue = target[prop];
                        target[prop] = this._wrapNestedObjects(value, index);
                        this._setKeyForObjectAndChildObjects(obj, index);
                        this.resonantInstance._queueUpdate(this.variableName, 'modified', target, prop, oldValue, index);
                    }
                    return true;
                }
            });
        }
        return obj;
    }

    _createProxy(item, index) {
        return this._wrapNestedObjects(item, index);
    }

    forceUpdate() {
        this.forEach((item, index) => {
            this._setKeyForObjectAndChildObjects(item, index);
        });
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
                this._setKeyForObjectAndChildObjects(item, this.length + index);
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
        const wrap = (o) => {
            if (o && typeof o === 'object' && !o.__resonantProxy) {
                Object.keys(o).forEach(k => {
                    o[k] = wrap(o[k]);
                });
                o.__resonantProxy = true;
                return new Proxy(o, {
                    set: (target, property, value) => {
                        if (target[property] !== value) {
                            const oldValue = target[property];
                            target[property] = wrap(value);
                            this._queueUpdate(variableName, 'modified', target, property, oldValue);
                        }
                        return true;
                    }
                });
            }
            return o;
        };
        return wrap(obj);
    }

    _evaluateDisplayCondition(element, instance, condition) {
        try {
            let parent = element.parentElement;
            let parentResName = null;
            let arrayIndex = null;

            while (parent && !parentResName) {
                parentResName = parent.getAttribute('res');
                if (!arrayIndex) {
                    arrayIndex = parent.getAttribute('res-index');
                }
                parent = parent.parentElement;
            }

            // For array items, use the specific array element as instance
            if (parentResName && arrayIndex !== null && Array.isArray(this.data[parentResName])) {
                instance = this.data[parentResName][arrayIndex];
            }

            // For object properties without parent reference
            if (parentResName && !condition.includes(parentResName + '.')) {
                const propNames = condition.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
                propNames.forEach(prop => {
                    if (prop === '==' || prop === '!=' || !(prop in instance)) return;

                    const regex = new RegExp(`\\b${prop}\\b`, 'g');
                    const propValue = instance[prop];

                    if (propValue === undefined) {
                        // Keep as is - property doesn't exist
                        return;
                    }

                    // Determine correct property access path
                    if (instance['item.' + prop] !== undefined) {
                        condition = condition.replace(regex, `item.${prop}`);
                    } else if (typeof propValue === 'object') {
                        condition = condition.replace(regex, `${parentResName}.${prop}`);
                    }
                });
            }

            let show = false;
            try{
                show = new Function('item', `return ${condition}`)(instance);
            } catch(e) {

                const firstPeriodIndex = condition.indexOf('.');
                const conditionAfterFirstPeriod = condition.substring(firstPeriodIndex + 1);
                show = new Function('item', `return item.${conditionAfterFirstPeriod}`)(instance);

            }

            element.style.display = show ? 'inherit' : 'none';
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
                if (element.getAttribute('res-rendered') === 'true') return;
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
            let parentKey = null;
            if (parentVarName && this.data[parentVarName]) {
                parentKey = this.data[parentVarName].key;
            } else {
                const childAttr = subEl.getAttribute('res-child');
                if (childAttr && childAttr.includes('--')) {
                    parentKey = childAttr.split('--')[1];
                }
            }
            this._renderNestedArray(subEl, propValue, parentKey);
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
        const container = el.hasAttribute('res') && el.parentElement ? el.parentElement : el;

        let template;
        if (!window[variableName + "_template"]) {
            template = el.cloneNode(true);
            window[variableName + "_template"] = template;
            el.style.display = 'none';
            el.setAttribute('res-template', 'true');
        } else {
            template = window[variableName + "_template"];
        }

        const existingElements = new Map();
        container.querySelectorAll(`[res="${variableName}"][res-rendered="true"]`).forEach(element => {
            const key = element.getAttribute('res-key');
            if (key) {
                existingElements.set(key, element);
            }
        });

        container.querySelectorAll(`[res="${variableName}"][res-rendered="true"]`).forEach(el => el.remove());

        this.data[variableName].forEach((instance, index) => {
            const elementKey = instance.key;
            let elementToUse;

            if (existingElements.has(elementKey)) {
                elementToUse = existingElements.get(elementKey);
                existingElements.delete(elementKey);
                elementToUse.setAttribute("res-index", index);
            } else {
                elementToUse = template.cloneNode(true);
                elementToUse.removeAttribute('res-template');
                elementToUse.style.display = '';
                elementToUse.setAttribute("res-rendered", "true");
                elementToUse.setAttribute("res-key", elementKey);
            }
            elementToUse.setAttribute("res-index", index);

            for (let key in instance) {
                let overrideInstanceValue = null;
                let subEl = elementToUse.querySelector(`[res-prop="${key}"]`);
                if (!subEl) {
                    subEl = elementToUse.querySelector('[res-prop=""]');
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
                        let parentKey = this.data[variableName][index].key;
                        this._renderNestedArray(subEl, value, parentKey);
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

            this._handleDisplayElements(elementToUse, instance);
            this._bindClickEvents(elementToUse, instance, this.data[variableName]);

            container.appendChild(elementToUse);
        });
    }
    _renderNestedArray(subEl, arrayValue, parentKey) {
        if (!subEl.__res_template) {
            subEl.__res_template = subEl.cloneNode(true);
        }

        const template = subEl.__res_template;
        subEl.innerHTML = '';
        while (subEl.children && subEl.children.length) {
            subEl.children[0].remove();
        }

        arrayValue.forEach((item, idx) => {
            const cloned = template.cloneNode(true);
            cloned.setAttribute('res-rendered', 'true');

            if (item !== null && typeof item !== 'object') {
                cloned.innerHTML = item;
            } else {
                const nestedEls = cloned.querySelectorAll('[res-prop]');
                nestedEls.forEach(nestedEl => {
                    const nestedKey = nestedEl.getAttribute('res-prop');
                    if (nestedKey && nestedKey in item) {
                        nestedEl.setAttribute('res-child', item.key + '-' + nestedKey + '--' + parentKey);
                        this._renderObjectProperty(nestedEl, item[nestedKey], null, nestedKey);
                    }
                });

                this._handleDisplayElements(cloned, item);
                this._bindClickEvents(cloned, item, arrayValue);

                const displayCondition = cloned.getAttribute('res-display');
                if (displayCondition) {
                    this._evaluateDisplayCondition(cloned, item, displayCondition);
                }
            }
            subEl.appendChild(cloned);
        });
    }

    updateDisplayConditionalsFor(variableName) {
        const conditionalElements = document.querySelectorAll(`[res-display*="${variableName}"]`);
        conditionalElements.forEach(conditionalElement => {
            const condition = conditionalElement.getAttribute('res-display');
            this._evaluateDisplayCondition(conditionalElement, this.data[variableName], condition);
        });

        const contextElements = document.querySelectorAll(`[res="${variableName}"] [res-display]`);
        contextElements.forEach(conditionalElement => {
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