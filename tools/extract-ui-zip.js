// Extract an embedded ZIP (containing index.html) from language_server binary.
// Usage: node tools/extract-ui-zip.js <language_server.exe> <outDir>
let fs; try { fs = require('original-fs'); } catch { fs = require('fs'); }
const zlib = require('zlib');
const path = require('path');

function findEmbeddedZip(buf) {
  // Find EOCD records and pick the one whose central directory contains index.html
  const EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const results = [];
  for (let i = buf.indexOf(EOCD); i >= 0; i = buf.indexOf(EOCD, i + 1)) {
    const total = buf.readUInt16LE(i + 10);
    const cdSize = buf.readUInt32LE(i + 12);
    const cdOffset = buf.readUInt32LE(i + 16);
    const cdStart = i - cdSize;
    if (cdStart < 0 || buf.readUInt32LE(cdStart) !== 0x02014b50) continue;
    const zipStart = cdStart - cdOffset;
    const entries = [];
    let p = cdStart;
    for (let k = 0; k < total; k++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10);
      const csize = buf.readUInt32LE(p + 20);
      const usize = buf.readUInt32LE(p + 24);
      const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
      const lho = buf.readUInt32LE(p + 42);
      const name = buf.toString('utf8', p + 46, p + 46 + nlen);
      entries.push({ name, method, csize, usize, lho: zipStart + lho });
      p += 46 + nlen + xlen + clen;
    }
    results.push({ eocd: i, zipStart, entries });
  }
  return results.find((r) => r.entries.some((e) => e.name === 'index.html'));
}

function readEntry(buf, e) {
  const p = e.lho;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('bad local header for ' + e.name);
  const nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
  const data = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + e.csize);
  if (e.method === 0) return Buffer.from(data);
  if (e.method === 8) return zlib.inflateRawSync(data);
  throw new Error('unsupported method ' + e.method);
}

function extractUi(exe, outDir) {
  const buf = fs.readFileSync(exe);
  const zip = findEmbeddedZip(buf);
  if (!zip) throw new Error('embedded UI zip not found');
  for (const e of zip.entries) {
    if (e.name.endsWith('/')) continue;
    const out = path.join(outDir, e.name);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, readEntry(buf, e));
  }
  return zip;
}

module.exports = { findEmbeddedZip, readEntry, extractUi };
if (require.main === module) {
  const z = extractUi(process.argv[2], process.argv[3]);
  console.log('zipStart', z.zipStart, 'entries', z.entries.length);
  for (const e of z.entries) console.log(e.usize.toString().padStart(10), e.name);
}
