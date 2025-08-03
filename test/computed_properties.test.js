const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { createResonant } = require('./mockDom.js');

function setupComputed(resonant, context, setupCode) {
    const vm = require('vm');
    vm.runInContext(setupCode, context);
}

test('computed property basic functionality', () => {
    const { resonant, context } = createResonant();
    
    resonant.add('firstName', 'John');
    resonant.add('lastName', 'Doe');
    
    setupComputed(resonant, context, `
        resonant.computed('fullName', () => {
            return firstName + ' ' + lastName;
        });
    `);
    
    strictEqual(context.fullName, 'John Doe');
});

test('computed property with multiple dependencies', () => {
    const { resonant, context } = createResonant();
    
    resonant.add('price', 100);
    resonant.add('quantity', 2);
    resonant.add('taxRate', 0.1);
    
    setupComputed(resonant, context, `
        resonant.computed('total', () => {
            return Math.round((price * quantity) * (1 + taxRate) * 100) / 100;
        });
    `);
    
    strictEqual(context.total, 220);
});

test('computed property with conditional logic', () => {
    const { resonant, context } = createResonant();
    
    resonant.add('score', 85);
    
    setupComputed(resonant, context, `
        resonant.computed('grade', () => {
            if (score >= 90) return 'A';
            if (score >= 80) return 'B';
            if (score >= 70) return 'C';
            if (score >= 60) return 'D';
            return 'F';
        });
    `);
    
    strictEqual(context.grade, 'B');
});

test('computed property cannot be set directly', () => {
    const { resonant, context } = createResonant();
    
    resonant.add('firstName', 'John');
    resonant.add('lastName', 'Doe');
    
    setupComputed(resonant, context, `
        resonant.computed('fullName', () => {
            return firstName + ' ' + lastName;
        });
    `);
    
    const originalValue = context.fullName;
    
    // This should log a warning and not change the value
    context.fullName = 'Something Else';
    
    strictEqual(context.fullName, originalValue);
});

test('chained computed properties', () => {
    const { resonant, context } = createResonant();
    
    resonant.add('radius', 5);
    
    setupComputed(resonant, context, `
        resonant.computed('area', () => {
            return Math.PI * radius * radius;
        });
        
        resonant.computed('areaRounded', () => {
            return Math.round(area * 100) / 100;
        });
    `);
    
    const expectedArea = Math.round(Math.PI * 25 * 100) / 100;
    strictEqual(context.areaRounded, expectedArea);
});

test('computed property with no dependencies', () => {
    const { resonant, context } = createResonant();
    
    setupComputed(resonant, context, `
        resonant.computed('timestamp', () => {
            return Date.now();
        });
    `);
    
    const initialValue = context.timestamp;
    
    // Should be a valid timestamp
    strictEqual(typeof initialValue, 'number');
});