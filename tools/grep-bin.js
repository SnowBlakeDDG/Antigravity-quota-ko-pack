let fs; try { fs = require('original-fs'); } catch { fs = require('fs'); }
const buf = fs.readFileSync(process.argv[2]);
const re = process.argv.slice(3);
for (const n of re) {
  let idx = -1, c = 0;
  while ((idx = buf.indexOf(n, idx + 1)) >= 0 && c < 8) {
    c++;
    const ctx = buf.subarray(Math.max(0, idx - 80), idx + 120).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
    console.log(n, '@', idx, '|', ctx);
  }
}
