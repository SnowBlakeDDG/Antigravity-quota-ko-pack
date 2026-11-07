'use strict';
const fs = require('fs');
const s = fs.readFileSync('work/ui/main.js', 'utf8');
const out = new Set();
const re = /`([^`$]{0,80}\$\{[^}]{1,80}\}[^`]{0,120})`/g;
let m;
while ((m = re.exec(s))) {
  let idx = 0;
  const v = m[1].replace(/\$\{[^}]+\}/g, () => `{${idx++}}`).trim();
  if (
    v.length >= 4 &&
    v.length <= 160 &&
    /^[A-Z{]/.test(v) &&
    /\s/.test(v) &&
    /[a-z]{2,}/.test(v) &&
    !/[\n;=<>\[\]\\]|https?:|function|return|const |var |rgba?\(|calc\(|px\b|rem\b|vh\b|vw\b|--/.test(v)
  ) {
    out.add(v);
  }
}
const list = [...out].sort();
fs.writeFileSync('work/templates.json', JSON.stringify(list, null, 2));
console.log('count:', list.length);
console.log(list.slice(0, 120).join('\n'));
