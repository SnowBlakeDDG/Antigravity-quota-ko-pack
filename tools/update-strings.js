#!/usr/bin/env node
'use strict';
/**
 * Antigravity Korean Localization Updater
 * - Extracts UI bundle from the currently installed language_server binary
 * - Finds any newly added UI strings not yet in locales/ko.json
 * - Merges locales/ko-custom.json if present
 * - Writes locales/untranslated.json for easy review/update
 */

let fs;
try { fs = require('original-fs'); } catch { fs = require('fs'); }
const path = require('path');
const { resolveAppDir } = require('./patch');
const { findEmbeddedZip, readEntry } = require('./extract-ui-zip');

function main() {
  const rootDir = path.join(__dirname, '..');
  const koPath = path.join(rootDir, 'locales', 'ko.json');
  const customPath = path.join(rootDir, 'locales', 'ko-custom.json');
  const untranslatedPath = path.join(rootDir, 'locales', 'untranslated.json');

  const dict = JSON.parse(fs.readFileSync(koPath, 'utf8'));
  const strings = dict.strings || {};

  // 1. Merge locales/ko-custom.json if present
  if (fs.existsSync(customPath)) {
    try {
      const custom = JSON.parse(fs.readFileSync(customPath, 'utf8'));
      const customMap = custom.strings || custom;
      let mergedCount = 0;
      for (const [k, v] of Object.entries(customMap)) {
        if (typeof v === 'string' && v.trim() && k !== v) {
          strings[k] = v;
          mergedCount++;
        }
      }
      if (mergedCount > 0) {
        dict.updatedAt = new Date().toISOString();
        fs.writeFileSync(koPath, JSON.stringify(dict, null, 2));
        console.log(`[병합 완료] ko-custom.json에서 ${mergedCount}개 번역을 병합했습니다.`);
      }
    } catch (err) {
      console.warn(`[경고] ko-custom.json 파싱 실패: ${err.message}`);
    }
  }

  // 2. Locate language_server binary and scan for new strings
  const appDir = resolveAppDir();
  if (!appDir) {
    console.log('[안내] Antigravity 설치 경로를 찾지 못해 신규 문자열 스캔을 건너뜁니다.');
    return;
  }

  const lsCandidates = [
    path.join(appDir, 'resources', 'bin', 'language_server.exe'),
    path.join(appDir, 'resources', 'bin', 'language_server'),
    path.join(appDir, 'Resources', 'bin', 'language_server'),
  ];
  const lsBin = lsCandidates.find((p) => fs.existsSync(p));
  if (!lsBin) {
    console.log('[안내] language_server 바이너리를 찾지 못했습니다.');
    return;
  }

  console.log(`[스캔 중] ${lsBin} 내부 UI 번들 분석 중...`);
  const buf = fs.readFileSync(lsBin);
  const zip = findEmbeddedZip(buf);
  if (!zip) {
    console.log('[안내] 내장 UI ZIP 아카이브를 찾지 못했습니다.');
    return;
  }
  const mainEntry = zip.entries.find((e) => e.name === 'main.js');
  if (!mainEntry) {
    console.log('[안내] UI 번들(main.js)을 찾지 못했습니다.');
    return;
  }

  const js = readEntry(buf, mainEntry).toString('utf8');
  const UI_KEYS = new Set([
    'children', 'placeholder', 'title', 'label', 'tooltip', 'description',
    'text', 'header', 'heading', 'subtitle', 'message', 'aria-label', 'ariaLabel',
    'buttonText', 'confirmText', 'cancelText', 'emptyText', 'helperText',
    'tooltipText', 'actionLabel', 'confirmLabel', 'cancelLabel', 'submitLabel',
  ]);

  const missing = new Set();
  const re = /(?:"(children|placeholder|title|label|tooltip|description|text|header|heading|subtitle|message|aria-label|ariaLabel|tooltipText|submitLabel)"|\b(placeholder|title|label|tooltip|description|text|header|heading|subtitle|message|ariaLabel|tooltipText|submitLabel))\s*:\s*"((?:[^"\\]|\\.){2,200})"/g;
  let m;
  while ((m = re.exec(js))) {
    const key = m[1] || m[2];
    if (!UI_KEYS.has(key)) continue;
    let val;
    try { val = JSON.parse('"' + m[3] + '"').trim(); } catch { continue; }
    if (val.length < 2 || val.length > 200) continue;
    if (!/[A-Za-z]{2,}/.test(val)) continue;
    if (/^[a-z0-9_\-.:\/@#]+$/.test(val)) continue;
    if (/[{}<>=;`]|\$\{|https?:\/\/|\\/.test(val)) continue;
    if (!(val in strings)) {
      missing.add(val);
    }
  }

  const list = [...missing].sort();
  fs.writeFileSync(untranslatedPath, JSON.stringify(list, null, 2));
  console.log(`[완료] 현재 사전: ${Object.keys(strings).length}개 / 미번역 후보 문자열: ${list.length}개`);
  console.log(`  - 미번역 목록 파일: ${untranslatedPath}`);
  console.log(`  - 추가 번역은 locales/ko-custom.json에 {"영어": "한국어"} 형태로 넣은 뒤 이 스크립트를 다시 실행하세요.`);
}

if (require.main === module) {
  main();
}
