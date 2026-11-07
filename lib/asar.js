// Minimal dependency-free ASAR reader/writer (Electron asar format).
// Uses 'original-fs' when available so Electron's asar shim does not interfere.
'use strict';
let fs;
try { fs = require('original-fs'); } catch { fs = require('fs'); }
const path = require('path');
const crypto = require('crypto');

function alignInt(i, alignment) {
  return i + ((alignment - (i % alignment)) % alignment);
}

function readHeader(archive) {
  const fd = fs.openSync(archive, 'r');
  try {
    const sizeBuf = Buffer.alloc(8);
    fs.readSync(fd, sizeBuf, 0, 8, 0);
    // Pickle: [payloadSize uint32][headerSize uint32]
    const headerPickleSize = sizeBuf.readUInt32LE(4);
    const headerBuf = Buffer.alloc(headerPickleSize);
    fs.readSync(fd, headerBuf, 0, headerPickleSize, 8);
    // Inner pickle: [payloadSize uint32][strLen int32][string...]
    const strLen = headerBuf.readInt32LE(4);
    const json = headerBuf.toString('utf8', 8, 8 + strLen);
    return { header: JSON.parse(json), headerSize: headerPickleSize, dataOffset: 8 + headerPickleSize };
  } finally {
    fs.closeSync(fd);
  }
}

// Walk header and yield {relPath, node}
function* walk(node, prefix = '') {
  if (!node.files) return;
  for (const [name, child] of Object.entries(node.files)) {
    const rel = prefix ? prefix + '/' + name : name;
    yield { rel, node: child };
    if (child.files) yield* walk(child, rel);
  }
}

function extract(archive, dest) {
  const { header, dataOffset } = readHeader(archive);
  const fd = fs.openSync(archive, 'r');
  const unpackedDir = archive + '.unpacked';
  try {
    fs.mkdirSync(dest, { recursive: true });
    for (const { rel, node } of walk(header)) {
      const out = path.join(dest, rel);
      if (node.files) { fs.mkdirSync(out, { recursive: true }); continue; }
      if (node.link) { continue; } // symlinks: skip (rare in app.asar)
      fs.mkdirSync(path.dirname(out), { recursive: true });
      if (node.unpacked) {
        // Leave unpacked files in place; record marker
        continue;
      }
      const size = Number(node.size);
      const buf = Buffer.alloc(size);
      if (size > 0) fs.readSync(fd, buf, 0, size, dataOffset + Number(node.offset));
      fs.writeFileSync(out, buf);
      if (node.executable) { try { fs.chmodSync(out, 0o755); } catch {} }
    }
  } finally {
    fs.closeSync(fd);
  }
  return header;
}

function readFile(archive, relPath) {
  const { header, dataOffset } = readHeader(archive);
  let node = header;
  for (const part of relPath.split('/')) {
    if (!node.files || !node.files[part]) throw new Error('Not found in asar: ' + relPath);
    node = node.files[part];
  }
  const fd = fs.openSync(archive, 'r');
  try {
    const buf = Buffer.alloc(Number(node.size));
    fs.readSync(fd, buf, 0, buf.length, dataOffset + Number(node.offset));
    return buf;
  } finally { fs.closeSync(fd); }
}

function listFiles(archive) {
  const { header } = readHeader(archive);
  const out = [];
  for (const { rel, node } of walk(header)) if (!node.files) out.push({ rel, size: Number(node.size || 0), unpacked: !!node.unpacked });
  return out;
}

function integrityOf(buf) {
  const blockSize = 4 * 1024 * 1024;
  const blocks = [];
  for (let i = 0; i < buf.length; i += blockSize) {
    blocks.push(crypto.createHash('sha256').update(buf.subarray(i, i + blockSize)).digest('hex'));
  }
  if (blocks.length === 0) blocks.push(crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex'));
  return {
    algorithm: 'SHA256',
    hash: crypto.createHash('sha256').update(buf).digest('hex'),
    blockSize,
    blocks,
  };
}

// Rebuild an archive from an original archive, replacing or adding files.
// replacements: Map<relPath, Buffer>
function repack(srcArchive, destArchive, replacements) {
  const { header, dataOffset } = readHeader(srcArchive);
  const fd = fs.openSync(srcArchive, 'r');
  const chunks = [];
  const seen = new Set();
  let offset = 0;
  try {
    for (const { rel, node } of walk(header)) {
      if (node.files || node.link || node.unpacked) continue;
      seen.add(rel);
      let buf;
      if (replacements.has(rel)) {
        buf = replacements.get(rel);
        if (node.integrity) node.integrity = integrityOf(buf);
      } else {
        buf = Buffer.alloc(Number(node.size));
        if (buf.length) fs.readSync(fd, buf, 0, buf.length, dataOffset + Number(node.offset));
      }
      node.size = buf.length;
      node.offset = String(offset);
      offset += buf.length;
      chunks.push(buf);
    }
    // Insert any new files not previously present in header
    for (const [rel, buf] of replacements.entries()) {
      if (seen.has(rel)) continue;
      const parts = rel.split('/');
      let cur = header;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!cur.files) cur.files = {};
        if (!cur.files[p]) cur.files[p] = { files: {} };
        cur = cur.files[p];
      }
      if (!cur.files) cur.files = {};
      const leaf = parts[parts.length - 1];
      cur.files[leaf] = {
        size: buf.length,
        offset: String(offset),
        integrity: integrityOf(buf),
      };
      offset += buf.length;
      chunks.push(buf);
    }
  } finally { fs.closeSync(fd); }

  const json = Buffer.from(JSON.stringify(header), 'utf8');
  // Inner pickle: payloadSize, strLen, string (aligned to 4)
  const innerPayload = alignInt(4 + json.length, 4);
  const inner = Buffer.alloc(4 + innerPayload);
  inner.writeUInt32LE(innerPayload, 0);
  inner.writeInt32LE(json.length, 4);
  json.copy(inner, 8);
  // Outer pickle: payloadSize=4, headerSize
  const outer = Buffer.alloc(8);
  outer.writeUInt32LE(4, 0);
  outer.writeUInt32LE(inner.length, 4);

  const tmp = destArchive + '.tmp';
  const out = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(out, outer);
    fs.writeSync(out, inner);
    for (const c of chunks) fs.writeSync(out, c);
  } finally { fs.closeSync(out); }
  fs.renameSync(tmp, destArchive);
  return { headerHash: crypto.createHash('sha256').update(json).digest('hex') };
}

module.exports = { readHeader, extract, readFile, listFiles, repack, integrityOf };
