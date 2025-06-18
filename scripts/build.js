const fs = require('fs');
let data = fs.readFileSync('resonant.js', 'utf8');
// Remove single line comments
data = data.replace(/\/\/.*$/gm, '');
// Remove block comments
data = data.replace(/\/\*[\s\S]*?\*\//g, '');
// Collapse whitespace
data = data.replace(/\s+/g, ' ');
// Remove space around certain punctuation
data = data.replace(/\s*([{}();,:])\s*/g, '$1');
fs.writeFileSync('resonant.min.js', data.trim());
console.log('resonant.min.js created');
