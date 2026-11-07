// Usage: node tools/extract.js <app.asar> <destDir>
const asar = require('../lib/asar');
const [src, dest] = process.argv.slice(2);
asar.extract(src, dest);
console.log('extracted to', dest);
