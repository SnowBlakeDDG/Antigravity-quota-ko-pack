#!/usr/bin/env node
'use strict';
/**
 * Antigravity Korean Patch Installer / Uninstaller / Status Checker
 * Usage:
 *   node tools/patch.js install   [--app-dir <path>]
 *   node tools/patch.js uninstall [--app-dir <path>]
 *   node tools/patch.js status    [--app-dir <path>]
 */

let fs;
try { fs = require('original-fs'); } catch { fs = require('fs'); }
const path = require('path');
const asar = require('../lib/asar');

const PATCH_MARKER = '/* AGY_KO_PATCH_START */';

function resolveAppDir(customDir) {
  const candidates = [];
  if (customDir) candidates.push(customDir);
  if (process.env.ANTIGRAVITY_APP_DIR) candidates.push(process.env.ANTIGRAVITY_APP_DIR);

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    candidates.push(
      path.join(local, 'Programs', 'antigravity'),
      path.join(local, 'Programs', 'Antigravity'),
      'C:\\Program Files\\Antigravity'
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Antigravity.app/Contents',
      path.join(process.env.HOME || '', 'Applications', 'Antigravity.app', 'Contents')
    );
  } else {
    candidates.push(
      '/opt/Antigravity',
      '/opt/antigravity',
      '/usr/lib/antigravity',
      path.join(process.env.HOME || '', '.local', 'share', 'antigravity')
    );
  }

  for (const dir of candidates) {
    if (!dir) continue;
    // Allow passing either the root app dir, the resources dir, or the .asar path directly
    if (dir.endsWith('app.asar') && fs.existsSync(dir)) {
      return path.dirname(path.dirname(dir));
    }
    const asarPath = path.join(dir, 'resources', 'app.asar');
    if (fs.existsSync(asarPath)) return dir;
    const macAsar = path.join(dir, 'Resources', 'app.asar');
    if (fs.existsSync(macAsar)) return dir;
  }
  return null;
}

function getAsarPaths(appDir) {
  let resDir = path.join(appDir, 'resources');
  if (!fs.existsSync(resDir) && fs.existsSync(path.join(appDir, 'Resources'))) {
    resDir = path.join(appDir, 'Resources');
  }
  const asarPath = path.join(resDir, 'app.asar');
  const backupPath = path.join(resDir, 'app.asar.bak');
  return { resDir, asarPath, backupPath };
}

function checkStatus(asarPath, backupPath) {
  if (!fs.existsSync(asarPath)) {
    return { installed: false, error: `app.asar not found at ${asarPath}` };
  }
  try {
    const pkg = JSON.parse(asar.readFile(asarPath, 'package.json').toString('utf8'));
    const mainJs = asar.readFile(asarPath, 'dist/main.js').toString('utf8');
    const isPatched = mainJs.includes(PATCH_MARKER);
    let dictInfo = null;
    if (isPatched) {
      try {
        const dict = JSON.parse(asar.readFile(asarPath, 'dist/ko-dict.json').toString('utf8'));
        dictInfo = {
          dictVersion: dict.version,
          stringCount: Object.keys(dict.strings || {}).length,
          patternCount: (dict.patterns || []).length,
        };
      } catch (_) {}
    }
    return {
      installed: isPatched,
      appVersion: pkg.version,
      hasBackup: fs.existsSync(backupPath),
      ...dictInfo,
    };
  } catch (err) {
    return { installed: false, error: err.message };
  }
}

function patchMainJs(src) {
  if (src.includes(PATCH_MARKER)) {
    src = src.replace(/\/\* AGY_KO_PATCH_START \*\/[\s\S]*?\/\* AGY_KO_PATCH_END \*\/\r?\n?/g, '');
  }
  const snippet = [
    '/* AGY_KO_PATCH_START */',
    'try { require("./ko-main").installMainLocalization(); } catch (e) { console.error("[AGY-KO]", e); }',
    '/* AGY_KO_PATCH_END */',
  ].join('\n');

  const anchor = 'Object.assign(console, main_1.default.functions);';
  const idx = src.indexOf(anchor);
  if (idx >= 0) {
    const lineEnd = src.indexOf('\n', idx);
    return src.slice(0, lineEnd + 1) + snippet + '\n' + src.slice(lineEnd + 1);
  }
  const electronRe = /(?:const|var|let)\s+\w+\s*=\s*(?:__importStar\s*\(\s*)?require\(["']electron["']\)\s*\)?\s*;/;
  const em = src.match(electronRe);
  if (em) {
    const lineEnd = src.indexOf('\n', em.index + em[0].length);
    const pos = lineEnd >= 0 ? lineEnd + 1 : em.index + em[0].length;
    return src.slice(0, pos) + '\n' + snippet + '\n' + src.slice(pos);
  }
  const strictMatch = src.match(/^(['"])use strict\1;\r?\n?/);
  if (strictMatch) {
    const pos = strictMatch[0].length;
    return src.slice(0, pos) + snippet + '\n' + src.slice(pos);
  }
  return snippet + '\n' + src;
}

function patchPreloadJs(src, dictJsonStr) {
  if (src.includes(PATCH_MARKER)) {
    src = src.replace(/\/\* AGY_KO_PATCH_START \*\/[\s\S]*?\/\* AGY_KO_PATCH_END \*\/\r?\n?/g, '');
  }
  const electronVarMatch = src.match(/(?:const|var|let)\s+(\w+)\s*=\s*(?:__importStar\s*\(\s*)?require\(["']electron["']\)\s*\)?/);
  const electronRef = electronVarMatch ? electronVarMatch[1] : 'require("electron")';
  const { createTranslator, installRendererLocalization } = require('../src/ko-i18n');
  const snippet = [
    '',
    '/* AGY_KO_PATCH_START */',
    'try {',
    '  const __agyCreateTranslator = ' + createTranslator.toString() + ';',
    '  const createTranslator = __agyCreateTranslator;',
    '  const __agyInstallRenderer = ' + installRendererLocalization.toString() + ';',
    '  const __agyKoDict = ' + dictJsonStr + ';',
    `  const __agyElectron = ${electronRef};`,
    '  __agyInstallRenderer(__agyElectron.ipcRenderer, __agyElectron.contextBridge, __agyKoDict);',
    '} catch (e) { console.error("[AGY-KO]", e); }',
    '/* AGY_KO_PATCH_END */',
    '',
  ].join('\n');
  return src + snippet;
}

function install(appDir) {
  const { asarPath, backupPath } = getAsarPaths(appDir);
  if (!fs.existsSync(asarPath)) {
    throw new Error(`app.asar 파일을 찾을 수 없습니다: ${asarPath}`);
  }

  const curStatus = checkStatus(asarPath, backupPath);
  // Create or refresh backup if unpatched
  if (!curStatus.installed || !fs.existsSync(backupPath)) {
    // Only overwrite backup if current app.asar is clean (unpatched)
    if (!curStatus.installed) {
      fs.copyFileSync(asarPath, backupPath);
      console.log(`[백업 완료] 원본 app.asar -> ${backupPath}`);
    }
  }

  const baseArchive = fs.existsSync(backupPath) ? backupPath : asarPath;
  const origMain = asar.readFile(baseArchive, 'dist/main.js').toString('utf8');
  const origPreload = asar.readFile(baseArchive, 'dist/preload.js').toString('utf8');

  const rootDir = path.join(__dirname, '..');
  const koI18nBuf = fs.readFileSync(path.join(rootDir, 'src', 'ko-i18n.js'));
  const koMainBuf = fs.readFileSync(path.join(rootDir, 'src', 'ko-main.js'));
  const koDictObj = JSON.parse(fs.readFileSync(path.join(rootDir, 'locales', 'ko.json'), 'utf8'));
  const customPath = path.join(rootDir, 'locales', 'ko-custom.json');
  if (fs.existsSync(customPath)) {
    try {
      const custom = JSON.parse(fs.readFileSync(customPath, 'utf8'));
      Object.assign(koDictObj.strings, custom.strings || custom);
    } catch (_) {}
  }
  const compactDictJson = JSON.stringify(koDictObj);
  const koDictBuf = Buffer.from(compactDictJson, 'utf8');

  const metaBuf = Buffer.from(JSON.stringify({ packRoot: rootDir, appDir }), 'utf8');

  const replacements = new Map([
    ['dist/main.js', Buffer.from(patchMainJs(origMain), 'utf8')],
    ['dist/preload.js', Buffer.from(patchPreloadJs(origPreload, compactDictJson), 'utf8')],
    ['dist/ko-i18n.js', koI18nBuf],
    ['dist/ko-main.js', koMainBuf],
    ['dist/ko-dict.json', koDictBuf],
    ['dist/ko-meta.json', metaBuf],
  ]);

  const stagedPath = asarPath + '.ko-staged';
  asar.repack(baseArchive, stagedPath, replacements);

  try {
    fs.copyFileSync(stagedPath, asarPath);
    fs.unlinkSync(stagedPath);
  } catch (err) {
    try { fs.unlinkSync(stagedPath); } catch (_) {}
    if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
      throw new Error(
        `app.asar 파일이 사용 중이거나 권한이 부족합니다 (${err.code}).\n` +
        `Antigravity 앱을 완전히 종료한 뒤 다시 실행하거나, build-only 모드로 생성된 app.asar.patched 파일을 덮어쓰세요.`
      );
    }
    throw err;
  }

  const after = checkStatus(asarPath, backupPath);
  console.log('========================================================');
  console.log(`[설치 완료] Antigravity v${after.appVersion} 한국어 패치가 적용되었습니다!`);
  console.log(`  - 번역 문자열: ${after.stringCount}개 / 동적 패턴: ${after.patternCount}개`);
  console.log(`  - 한/영 전환 단축키: Ctrl+Alt+K (macOS: Cmd+Alt+K)`);
  console.log(`  - 설정(Settings) 메뉴 및 트레이 아이콘 우클릭 메뉴에서도 전환 가능합니다.`);
  console.log('--------------------------------------------------------');
  console.log('[안내] 패치를 반영하려면 Antigravity 창을 새로고침하거나 앱을 재시작하세요.');
  console.log('========================================================');
}

function buildStaged(appDir, outFile) {
  const { asarPath, backupPath } = getAsarPaths(appDir);
  const baseArchive = fs.existsSync(backupPath) ? backupPath : asarPath;
  const origMain = asar.readFile(baseArchive, 'dist/main.js').toString('utf8');
  const origPreload = asar.readFile(baseArchive, 'dist/preload.js').toString('utf8');

  const rootDir = path.join(__dirname, '..');
  const koDictObj = JSON.parse(fs.readFileSync(path.join(rootDir, 'locales', 'ko.json'), 'utf8'));
  const compactDictJson = JSON.stringify(koDictObj);
  const metaBuf = Buffer.from(JSON.stringify({ packRoot: rootDir, appDir }), 'utf8');
  const replacements = new Map([
    ['dist/main.js', Buffer.from(patchMainJs(origMain), 'utf8')],
    ['dist/preload.js', Buffer.from(patchPreloadJs(origPreload, compactDictJson), 'utf8')],
    ['dist/ko-i18n.js', fs.readFileSync(path.join(rootDir, 'src', 'ko-i18n.js'))],
    ['dist/ko-main.js', fs.readFileSync(path.join(rootDir, 'src', 'ko-main.js'))],
    ['dist/ko-dict.json', Buffer.from(compactDictJson, 'utf8')],
    ['dist/ko-meta.json', metaBuf],
  ]);
  asar.repack(baseArchive, outFile, replacements);
  console.log(`[빌드 완료] 패치된 아카이브 생성됨: ${outFile}`);
}

function uninstall(appDir) {
  const { asarPath, backupPath } = getAsarPaths(appDir);
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, asarPath);
    console.log(`[복원 완료] 백업 파일(${backupPath})로부터 원본 app.asar를 복원했습니다.`);
    return;
  }
  const curStatus = checkStatus(asarPath, backupPath);
  if (!curStatus.installed) {
    console.log(`[안내] 현재 한국어 패치가 적용되어 있지 않습니다.`);
    return;
  }
  const origMain = asar.readFile(asarPath, 'dist/main.js').toString('utf8')
    .replace(/\/\* AGY_KO_PATCH_START \*\/[\s\S]*?\/\* AGY_KO_PATCH_END \*\/\r?\n?/g, '');
  const origPreload = asar.readFile(asarPath, 'dist/preload.js').toString('utf8')
    .replace(/\/\* AGY_KO_PATCH_START \*\/[\s\S]*?\/\* AGY_KO_PATCH_END \*\/\r?\n?/g, '');

  const stagedPath = asarPath + '.ko-unstaged';
  asar.repack(asarPath, stagedPath, new Map([
    ['dist/main.js', Buffer.from(origMain, 'utf8')],
    ['dist/preload.js', Buffer.from(origPreload, 'utf8')],
  ]));
  fs.copyFileSync(stagedPath, asarPath);
  fs.unlinkSync(stagedPath);
  console.log(`[제거 완료] 한국어 패치를 제거하고 원본 코드로 복원했습니다.`);
}

function ensure(appDir, { quiet = false } = {}) {
  const { asarPath, backupPath } = getAsarPaths(appDir);
  const st = checkStatus(asarPath, backupPath);
  if (st.installed) {
    if (!quiet) {
      console.log(`[유지 중] Antigravity v${st.appVersion} 한국어 & 쿼타 UI 패치가 이미 적용되어 있습니다.`);
    }
    return false;
  }
  if (!quiet) {
    console.log(`[자동 복구] Antigravity v${st.appVersion}에서 패치가 해제되어 재적용을 시작합니다...`);
  }
  try {
    const updater = require('./update-strings');
    if (typeof updater === 'function') updater();
  } catch (_) {}
  install(appDir);
  return true;
}

function setupAutoPatchWindows(enable, appDir) {
  if (process.platform !== 'win32') {
    console.log('[안내] 자동 복구 작업 등록은 현재 Windows만 지원합니다.');
    return;
  }
  const { execFileSync } = require('child_process');
  const taskName = 'AgyQuotaKoAutoPatch';
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const startupVbs = path.join(startupDir, 'AgyQuotaKoAutoPatch.vbs');
  if (!enable) {
    try {
      execFileSync('schtasks', ['/Delete', '/TN', taskName, '/F'], { stdio: 'pipe' });
      console.log(`[해제 완료] 주기적 자동 복구 작업(${taskName})을 제거했습니다.`);
    } catch (_) {}
    if (fs.existsSync(startupVbs)) {
      fs.unlinkSync(startupVbs);
      console.log(`[해제 완료] 시작프로그램 자동 복구 스크립트를 제거했습니다: ${startupVbs}`);
    }
    return;
  }
  const rootDir = path.join(__dirname, '..');
  const agyExe = path.join(appDir, 'Antigravity.exe');
  const runner = fs.existsSync(agyExe) ? agyExe : process.execPath;
  const patchScript = path.join(rootDir, 'tools', 'patch.js');
  const vbsContent = [
    'Set sh = CreateObject("WScript.Shell")',
    'Set env = sh.Environment("PROCESS")',
    'env("ELECTRON_RUN_AS_NODE") = "1"',
    `sh.Run """${runner}"" ""${patchScript}"" ensure --quiet", 0, False`,
    '',
  ].join('\r\n');
  fs.mkdirSync(startupDir, { recursive: true });
  fs.writeFileSync(startupVbs, vbsContent, 'utf8');
  console.log(`[등록 완료] Windows 로그인 시 패치 자동 복구 스크립트 등록됨: ${startupVbs}`);
  try {
    execFileSync('schtasks', [
      '/Create',
      '/TN', taskName,
      '/TR', `wscript.exe //B "${startupVbs}"`,
      '/SC', 'MINUTE',
      '/MO', '5',
      '/F',
    ], { stdio: 'inherit' });
    console.log(`[등록 완료] 5분 주기 자동 복구 작업(${taskName})이 등록되었습니다.`);
  } catch (e) {
    console.warn(`[경고] 주기적 작업 등록 실패(시작프로그램은 정상 등록됨): ${e.message}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'status';
  let customDir = null;
  let outFile = null;
  let quiet = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--app-dir' && args[i + 1]) {
      customDir = args[++i];
    } else if (args[i] === '--out' && args[i + 1]) {
      outFile = args[++i];
    } else if (args[i] === '--quiet' || args[i] === '-q') {
      quiet = true;
    }
  }

  const appDir = resolveAppDir(customDir);
  if (!appDir) {
    console.error('[오류] Antigravity 설치 경로를 찾을 수 없습니다. --app-dir <경로> 옵션을 지정하세요.');
    process.exit(1);
  }

  const { asarPath, backupPath } = getAsarPaths(appDir);
  if (cmd === 'status') {
    const st = checkStatus(asarPath, backupPath);
    console.log('Antigravity 경로:', appDir);
    console.log('상태:', JSON.stringify(st, null, 2));
  } else if (cmd === 'install') {
    install(appDir);
  } else if (cmd === 'ensure') {
    ensure(appDir, { quiet });
  } else if (cmd === 'enable-autopatch') {
    setupAutoPatchWindows(true, appDir);
  } else if (cmd === 'disable-autopatch') {
    setupAutoPatchWindows(false, appDir);
  } else if (cmd === 'uninstall' || cmd === 'restore') {
    uninstall(appDir);
  } else if (cmd === 'build') {
    const target = outFile || path.join(__dirname, '..', 'dist', 'app.asar');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    buildStaged(appDir, target);
  } else {
    console.error(`알 수 없는 명령: ${cmd} (사용 가능: status | install | ensure | enable-autopatch | disable-autopatch | uninstall | build)`);
    process.exit(1);
  }
}

module.exports = { resolveAppDir, getAsarPaths, checkStatus, install, ensure, uninstall, buildStaged };

if (require.main === module) {
  main();
}
