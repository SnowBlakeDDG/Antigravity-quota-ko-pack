// Extract candidate UI strings from the minified UI bundle using a fast scanner.
// Usage: node tools/extract-strings.js <main.js> <out.json>
'use strict';
const fs = require('fs');
const [src, out] = process.argv.slice(2);
const s = fs.readFileSync(src, 'utf8');

const UI_KEYS = new Set(['children', 'placeholder', 'title', 'label', 'tooltip', 'description', 'text', 'header', 'heading', 'subtitle', 'message', 'aria-label', 'ariaLabel', 'buttonText', 'confirmText', 'cancelText', 'emptyText', 'helperText', 'content', 'displayName', 'hint', 'caption', 'detail', 'subtext', 'tooltipText', 'actionLabel', 'confirmLabel', 'cancelLabel', 'primaryText', 'secondaryText', 'emptyMessage', 'errorMessage', 'successMessage', 'submitLabel', 'buttonLabel', 'shortLabel', 'longLabel', 'body', 'name', 'subheading', 'sublabel', 'summary', 'info', 'warning', 'okLabel', 'value']);

const counts = new Map();
function accept(str) {
  str = str.trim();
  if (str.length < 2 || str.length > 400) return null;
  if (!/[A-Za-z]{2,}/.test(str)) return null;
  if (/^[a-z0-9_\-.:\/@#]+$/.test(str)) return null;
  if (/^[A-Z0-9_\-.:]+$/.test(str) && str.length > 4) return null;
  if (/[{}<>=;`]|\$\{|https?:\/\/|\\/.test(str)) return null;
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(str)) return null; // camelCase
  if (/^[\w-]+(\s+[\w-]+:[\w\-\/\[\]%.]+)+$/.test(str)) return null; // tailwind-ish
  if (/^(?:[a-z0-9\-\[\]\/:.%!#]+\s+){1,}[a-z0-9\-\[\]\/:.%!#]+$/.test(str) && /-/.test(str) && !/[A-Z]/.test(str)) return null; // class lists
  return str;
}
function add(str, key) {
  const v = accept(str);
  if (!v) return;
  const e = counts.get(v) || { n: 0, keys: new Set() };
  e.n++; e.keys.add(key); counts.set(v, e);
}

// Scan string literals ("..." and '...'); track the token before each literal.
const len = s.length;
let i = 0;
function decode(raw, q) {
  try { return JSON.parse('"' + raw.replace(q === "'" ? /\\'/g : /(?!)/g, "'").replace(/(^|[^\\])"/g, '$1\\"') + '"'); } catch { return null; }
}
while (i < len) {
  const c = s.charCodeAt(i);
  if (c === 34 || c === 39) { // " or '
    const q = s[i];
    let j = i + 1;
    while (j < len) {
      const d = s.charCodeAt(j);
      if (d === 92) { j += 2; continue; }
      if (s[j] === q) break;
      if (d === 10) break;
      j++;
    }
    const raw = s.slice(i + 1, j);
    // look back for key
    let k = i - 1;
    while (k >= 0 && (s[k] === ' ')) k--;
    let key = null;
    if (s[k] === ':') {
      let e = k - 1;
      while (e >= 0 && s[e] === ' ') e--;
      let b = e;
      if (s[b] === '"' || s[b] === "'") { // quoted key
        const qq = s[b]; b--; const end = b; while (b >= 0 && s[b] !== qq) b--; key = s.slice(b + 1, end + 1);
      } else {
        while (b >= 0 && /[\w$]/.test(s[b])) b--; key = s.slice(b + 1, e + 1);
      }
    }
    // createElement child position: ...},"Text"  or null,"Text"  or ),"Text"
    let isChild = false;
    if (!key && s[k] === ',') {
      let p = k - 1;
      while (p >= 0 && s[p] === ' ') p--;
      if (s[p] === '}' || s[p] === ')' || s.slice(p - 3, p + 1) === 'null') isChild = true;
    }
    // inside a createElement call even as first child after props, also match `createElement(X,null,"..."`
    if (raw.length >= 2 && raw.length <= 400 && /[A-Za-z]/.test(raw)) {
      const val = decode(raw, q);
      if (val != null) {
        if (isChild) add(val, 'child');
        else if (key && UI_KEYS.has(key)) add(val, key);
        else if (/\s/.test(val.trim()) && /^[A-Z]/.test(val.trim()) && /[a-z]/.test(val)) add(val, key ? 'k:' + key : 'lit'); // sentence-like literals
        else if (/^[A-Z][a-z]+$/.test(val.trim())) add(val, key ? 'k:' + key : 'word');
      }
    }
    i = j + 1;
    continue;
  }
  if (c === 96) { // template literal: skip roughly, but capture static text parts
    let j = i + 1, depth = 0, buf = '';
    while (j < len) {
      if (s.charCodeAt(j) === 92) { buf += s[j] + s[j + 1]; j += 2; continue; }
      if (depth === 0 && s[j] === '`') break;
      if (s[j] === '$' && s[j + 1] === '{') { depth++; j += 2; buf += '\u0000'; continue; }
      if (depth > 0 && s[j] === '}') { depth--; j++; continue; }
      if (depth === 0) buf += s[j];
      j++;
    }
    if (buf.length < 400 && /[A-Za-z]{3,}/.test(buf) && /\s/.test(buf) && /^[A-Z\u0000]/.test(buf.trim())) {
      add(buf.replace(/\u0000/g, '{}'), 'tpl');
    }
    i = j + 1;
    continue;
  }
  if (c === 47 && s.charCodeAt(i + 1) === 47) { while (i < len && s.charCodeAt(i) !== 10) i++; continue; }
  if (c === 47 && s.charCodeAt(i + 1) === 42) { const e = s.indexOf('*/', i + 2); i = e < 0 ? len : e + 2; continue; }
  i++;
}

const arr = [...counts.entries()].map(([k, v]) => ({ s: k, n: v.n, keys: [...v.keys] }));
arr.sort((a, b) => a.s.localeCompare(b.s));
fs.writeFileSync(out, JSON.stringify(arr, null, 0).replace(/},{/g, '},\n{'));
const byKey = {};
for (const a of arr) for (const k of a.keys) byKey[k] = (byKey[k] || 0) + 1;
console.log('strings:', arr.length);
console.log(JSON.stringify(Object.entries(byKey).sort((a, b) => b[1] - a[1]).slice(0, 40)));
