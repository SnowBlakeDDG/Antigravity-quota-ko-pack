// Filter extracted strings down to likely user-visible UI text and split into chunks for translation.
// Usage: node tools/filter-strings.js <strings.json> <outDir> [chunkSize] [existingKo.json]
'use strict';
const fs = require('fs');
const path = require('path');
const [src, outDir, chunkArg, existing] = process.argv.slice(2);
const chunk = Number(chunkArg || 450);
const arr = JSON.parse(fs.readFileSync(src, 'utf8'));
const have = existing && fs.existsSync(existing) ? JSON.parse(fs.readFileSync(existing, 'utf8')) : {};
const haveMap = have.strings || have;

const BAD = [/%[sdvjo]/, /^\$/, /^\[.*\]$/, /^@/, /\bmust\b.*\b(be|not|have|return)\b/i, /\bundefined\b/, /reducer/i, /lexical/i, /invariant/i,
  /ElementNode|TextNode|RootNode|DecoratorNode|keyToDOMMap/, /Minified/, /proposed API/i, /store\.|getState|dispatch\(/, /\bnull\b/, /\bprops?\b/,
  /^Expected /, /^Unexpected /, /^Cannot /, /^Invalid hook/, /\bhook\b/i, /\bcallback\b/i, /\bargument\b/i, /\bimpl\b/i, /^[a-z][\w.]*\(/, /\(\)/,
  /^Failed to (parse|decode|serialize|deserialize)/, /protobuf|proto\b/i, /\bRPC\b/, /\bUint8Array|ArrayBuffer|Promise\b/, /\binstanceof\b/, /__/, /\bmutation\b/i,
  /\bselector\b/i, /\bmiddleware\b/i, /\bthunk\b/i, /immer/i, /\bdraft\b.*\bstate\b/i, /^Assertion/i, /\bCRDT\b/, /^Warning: /, /webpack/i, /\bpolyfill/i];

function isUi(e) {
  const s = e.s;
  if (BAD.some((r) => r.test(s))) return false;
  if (s.length > 260) return false;
  const keys = e.keys;
  const onlyLit = keys.every((k) => k === 'lit' || k === 'tpl' || k.startsWith('k:'));
  if (onlyLit && s.length > 180) return false;
  if (/^[A-Z][a-z]+$/.test(s) && keys.every((k) => k === 'word')) return true;
  if (/^[\w.\-]+\.(js|ts|tsx|json|md|py|go|css|html)$/.test(s)) return false;
  return true;
}
const ui = arr.filter(isUi).map((e) => e.s).filter((s) => !(s in haveMap));
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^chunk_\d+\.json$/.test(f)) fs.unlinkSync(path.join(outDir, f));
let n = 0;
for (let i = 0; i < ui.length; i += chunk, n++) {
  fs.writeFileSync(path.join(outDir, `chunk_${String(n).padStart(2, '0')}.json`), JSON.stringify(ui.slice(i, i + chunk), null, 1));
}
console.log('total', arr.length, 'ui', ui.length, 'chunks', n);
