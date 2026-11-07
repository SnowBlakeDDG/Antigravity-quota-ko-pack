// Generate CRLF pure-ASCII .bat files so cmd.exe never suffers from UTF-8 byte-offset shift.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function writeBat(name, bodyLines) {
  const content = bodyLines.join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(root, name), Buffer.from(content, 'ascii'));
}

const commonHeader = [
  '@echo off',
  'setlocal',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  '',
  'set "AGY_EXE=%LOCALAPPDATA%\\Programs\\antigravity\\Antigravity.exe"',
  'if not exist "%AGY_EXE%" set "AGY_EXE=%LOCALAPPDATA%\\Programs\\Antigravity\\Antigravity.exe"',
  'if not exist "%AGY_EXE%" set "AGY_EXE=C:\\Program Files\\Antigravity\\Antigravity.exe"',
  '',
];

writeBat('install-ko.bat', [
  ...commonHeader,
  'if exist "%AGY_EXE%" (',
  '  set "ELECTRON_RUN_AS_NODE=1"',
  '  "%AGY_EXE%" "%~dp0tools\\patch.js" install %*',
  ') else (',
  '  where node >nul 2>nul',
  '  if %ERRORLEVEL% equ 0 (',
  '    node "%~dp0tools\\patch.js" install %*',
  '  ) else (',
  '    echo [ERROR] Antigravity.exe or Node.js not found.',
  '    echo Usage: install-ko.bat --app-dir "C:\\path\\to\\antigravity"',
  '    pause',
  '    exit /b 1',
  '  )',
  ')',
  'echo.',
  'pause',
]);

writeBat('uninstall-ko.bat', [
  ...commonHeader,
  'if exist "%AGY_EXE%" (',
  '  set "ELECTRON_RUN_AS_NODE=1"',
  '  "%AGY_EXE%" "%~dp0tools\\patch.js" uninstall %*',
  ') else (',
  '  where node >nul 2>nul',
  '  if %ERRORLEVEL% equ 0 (',
  '    node "%~dp0tools\\patch.js" uninstall %*',
  '  ) else (',
  '    echo [ERROR] Antigravity.exe or Node.js not found.',
  '    pause',
  '    exit /b 1',
  '  )',
  ')',
  'echo.',
  'pause',
]);

writeBat('update-strings.bat', [
  ...commonHeader,
  'if exist "%AGY_EXE%" (',
  '  set "ELECTRON_RUN_AS_NODE=1"',
  '  "%AGY_EXE%" "%~dp0tools\\update-strings.js" %*',
  '  "%AGY_EXE%" "%~dp0tools\\patch.js" install %*',
  ') else (',
  '  where node >nul 2>nul',
  '  if %ERRORLEVEL% equ 0 (',
  '    node "%~dp0tools\\update-strings.js" %*',
  '    node "%~dp0tools\\patch.js" install %*',
  '  ) else (',
  '    echo [ERROR] Antigravity.exe or Node.js not found.',
  '    pause',
  '    exit /b 1',
  '  )',
  ')',
  'echo.',
  'pause',
]);

console.log('Generated CRLF ASCII .bat files successfully.');
