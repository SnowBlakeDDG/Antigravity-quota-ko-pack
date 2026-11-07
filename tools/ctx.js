// Print context around occurrences of needles in a text file.
// Usage: node tools/ctx.js <file> <before> <after> <max> needle...
const fs = require('fs');
const [file, b, a, max, ...needles] = process.argv.slice(2);
const s = fs.readFileSync(file, 'utf8');
for (const n of needles) {
  let i = -1, c = 0; const total = s.split(n).length - 1;
  console.log(`== ${n} (${total})`);
  while ((i = s.indexOf(n, i + 1)) >= 0 && c < Number(max)) {
    c++;
    console.log(s.slice(Math.max(0, i - Number(b)), i + n.length + Number(a)).replace(/\n/g, '⏎'));
    console.log('--');
  }
}
