// Extract gzip streams embedded in a binary; write those that look like web assets.
let fs; try { fs = require('original-fs'); } catch { fs = require('fs'); }
const zlib = require('zlib');
const path = require('path');
const [exe, outDir] = process.argv.slice(2);
const buf = fs.readFileSync(exe);
fs.mkdirSync(outDir, { recursive: true });
const magic = Buffer.from([0x1f, 0x8b, 8]);
let i = buf.indexOf(magic), n = 0;
while (i >= 0) {
  try {
    // gunzipSync stops at end of first member; give it a generous slice
    const out = zlib.gunzipSync(buf.subarray(i, Math.min(buf.length, i + 64 * 1024 * 1024)), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    const head = out.subarray(0, 200).toString('utf8');
    let ext = '.bin';
    if (/^\s*<!doctype|<html/i.test(head)) ext = '.html';
    else if (/^[\s\S]{0,50}(import|export|var |const |let |function|\(function|"use strict"|!function)/.test(head)) ext = '.js';
    else if (/^\s*[{\[]/.test(head)) ext = '.json';
    else if (/^[\s\S]{0,40}[:{;]/.test(head) && /[{}]/.test(head)) ext = '.css';
    const name = `${String(n).padStart(3, '0')}_${i}${ext}`;
    fs.writeFileSync(path.join(outDir, name), out);
    console.log(name, out.length, JSON.stringify(head.slice(0, 80)));
    n++;
  } catch (e) { /* not a real gzip stream */ }
  i = buf.indexOf(magic, i + 1);
}
