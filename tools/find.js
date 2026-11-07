// Usage: node tools/find.js <file> <regex> [max] [ctxBefore] [ctxAfter]
const fs = require('fs');
const [file, re, max = 20, b = 0, a = 0] = process.argv.slice(2);
const s = fs.readFileSync(file, 'utf8');
let c = 0;
for (const m of s.matchAll(new RegExp(re, 'g'))) {
  if (c++ >= Number(max)) break;
  console.log(s.slice(Math.max(0, m.index - Number(b)), m.index + m[0].length + Number(a)).replace(/\n/g, '⏎'));
  if (Number(b) || Number(a)) console.log('--');
}
