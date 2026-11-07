// Static scan of language_server.exe for embedded web assets.
let fs; try { fs = require('original-fs'); } catch { fs = require('fs'); }
const zlib = require('zlib');
const exe = process.argv[2];
const buf = fs.readFileSync(exe);
const needles = ['<!doctype html', '<!DOCTYPE html', 'React', 'createElement', 'New conversation', 'Agent Manager', 'Settings', 'Playground', 'Start a new conversation'];
for (const n of needles) {
  let idx = -1, c = 0; const pos = [];
  while ((idx = buf.indexOf(n, idx + 1)) >= 0 && c < 2000) { c++; if (pos.length < 5) pos.push(idx); }
  console.log(JSON.stringify(n), c, pos.join(','));
}
// count gzip / brotli / zstd magic
let gz = 0; for (let i = buf.indexOf(Buffer.from([0x1f, 0x8b, 8])); i >= 0 && gz < 100000; i = buf.indexOf(Buffer.from([0x1f, 0x8b, 8]), i + 1)) gz++;
let zs = 0; for (let i = buf.indexOf(Buffer.from([0x28, 0xb5, 0x2f, 0xfd])); i >= 0 && zs < 100000; i = buf.indexOf(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]), i + 1)) zs++;
console.log('gzip magic', gz, 'zstd magic', zs);
