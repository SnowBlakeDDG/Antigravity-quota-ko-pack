// Reads Electron fuse wire from an Electron executable.
let fs; try { fs = require('original-fs'); } catch { fs = require('fs'); }
const SENTINEL = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
const NAMES = ['RunAsNode', 'EnableCookieEncryption', 'EnableNodeOptionsEnvironmentVariable', 'EnableNodeCliInspectArguments', 'EnableEmbeddedAsarIntegrityValidation', 'OnlyLoadAppFromAsar', 'LoadBrowserProcessSpecificV8Snapshot', 'GrantFileProtocolExtraPrivileges', 'WasmTrapHandlers'];
function readFuses(exe) {
  const buf = fs.readFileSync(exe);
  const idx = buf.indexOf(SENTINEL);
  if (idx < 0) return null;
  const p = idx + SENTINEL.length;
  const version = buf[p], len = buf[p + 1];
  const out = { version };
  for (let i = 0; i < len; i++) {
    const c = String.fromCharCode(buf[p + 2 + i]);
    out[NAMES[i] || 'fuse' + i] = c === '1' ? 'on' : c === '0' ? 'off' : c === 'r' ? 'removed' : c;
  }
  return out;
}
module.exports = { readFuses };
if (require.main === module) console.log(JSON.stringify(readFuses(process.argv[2]), null, 2));
