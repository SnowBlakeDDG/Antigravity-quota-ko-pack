// Dump long printable-text runs (UTF-8) from a binary region, to find embedded JS/HTML assets.
let fs; try { fs = require('original-fs'); } catch { fs = require('fs'); }
const path = require('path');
const [exe, outDir, minLenArg] = process.argv.slice(2);
const minLen = Number(minLenArg || 20000);
const buf = fs.readFileSync(exe);
fs.mkdirSync(outDir, { recursive: true });
// printable ASCII + tab/newline/CR + UTF-8 multibyte bytes
function ok(b) { return (b >= 0x20 && b < 0x7f) || b === 9 || b === 10 || b === 13 || b >= 0x80; }
let start = -1, n = 0;
for (let i = 0; i <= buf.length; i++) {
  const good = i < buf.length && ok(buf[i]);
  if (good && start < 0) start = i;
  else if (!good && start >= 0) {
    if (i - start >= minLen) {
      const s = buf.subarray(start, i);
      const head = s.subarray(0, 120).toString('utf8').replace(/\s+/g, ' ');
      const name = `${String(n).padStart(3, '0')}_${start}.txt`;
      fs.writeFileSync(path.join(outDir, name), s);
      console.log(name, i - start, JSON.stringify(head.slice(0, 100)));
      n++;
    }
    start = -1;
  }
}
