'use strict';
/**
 * Antigravity Korean Localization Hook (Electron Main Process)
 * - Translates Tray menu, Application menu, and native dialogs (Quit confirm, Open workspace, Updater).
 * - Adds a "한국어 UI (Ctrl+Alt+K)" toggle item to the Tray menu.
 * - Fallback injection via web-contents-created if any Hub WebContents misses preload.
 */

const electron = require('electron');
const { loadDictionaryFromDisk, createTranslator, installRendererLocalization } = require('./ko-i18n');

let installed = false;

function installMainLocalization() {
  if (installed) return;
  installed = true;

  const rawDict = loadDictionaryFromDisk();
  const { translateString } = createTranslator(rawDict);
  let koEnabled = true;

  function tr(str) {
    if (!koEnabled || typeof str !== 'string') return str;
    return translateString(str) || str;
  }

  function broadcastLanguageToggle() {
    try {
      const allContents = electron.webContents?.getAllWebContents?.() || [];
      for (const wc of allContents) {
        if (!wc.isDestroyed?.()) {
          wc.send('ko:set-enabled', koEnabled);
        }
      }
    } catch (_) {}
  }

  try {
    electron.ipcMain?.on?.('ko:set-enabled', (_event, val) => {
      koEnabled = Boolean(val);
    });
    electron.ipcMain?.on?.('ko:renderer-ready', (_event, info) => {
      console.log(`[AGY-KO] Renderer localization active (dict=${info?.version}, enabled=${info?.enabled})`);
    });
  } catch (_) {}

  // Fallback: if any top-level Hub webContents finishes loading without data-agy-ko-ready, inject into main world
  const fallbackBundle = `(() => {
    if (document.documentElement && document.documentElement.hasAttribute('data-agy-ko-ready')) return 'already-ready';
    const createTranslator = ${createTranslator.toString()};
    const installRendererLocalization = ${installRendererLocalization.toString()};
    const dict = ${JSON.stringify(rawDict)};
    installRendererLocalization(null, null, dict);
    return 'injected-fallback';
  })();`;

  function attachToWebContents(contents) {
    if (!contents || contents.__agyKoAttached) return;
    contents.__agyKoAttached = true;
    contents.on('did-finish-load', () => {
      try {
        const url = contents.getURL?.() || '';
        if (!url.startsWith('https://127.0.0.1:') && !url.startsWith('http://127.0.0.1:') && !url.startsWith('http://localhost:')) {
          return;
        }
        if (contents.getType?.() === 'webview') return;
        contents.executeJavaScript(fallbackBundle).then((res) => {
          if (res === 'injected-fallback') {
            console.log('[AGY-KO] Fallback renderer injection triggered for', url);
          }
        }).catch(() => {});
      } catch (_) {}
    });
  }

  try {
    electron.app?.on?.('web-contents-created', (_event, contents) => {
      attachToWebContents(contents);
    });
    const existing = electron.webContents?.getAllWebContents?.() || [];
    for (const wc of existing) {
      attachToWebContents(wc);
    }
  } catch (_) {}

  // 1. Wrap Menu.buildFromTemplate so Tray menus & Context menus are translated
  if (electron.Menu && typeof electron.Menu.buildFromTemplate === 'function') {
    const origBuild = electron.Menu.buildFromTemplate.bind(electron.Menu);
    electron.Menu.buildFromTemplate = function (template) {
      if (!Array.isArray(template)) return origBuild(template);
      const mapped = template.map((item) => translateTemplateItem(item));
      if (mapped.some((it) => it && it.id === 'running-agents') && !mapped.some((it) => it && it.id === 'ko-toggle')) {
        const quitIdx = mapped.findIndex((it) => it && (it.label === 'Quit' || it.label === '종료'));
        const toggleItem = {
          id: 'ko-toggle',
          label: '한국어 UI (Ctrl+Alt+K)',
          type: 'checkbox',
          checked: koEnabled,
          click: (menuItem) => {
            koEnabled = menuItem.checked;
            broadcastLanguageToggle();
          },
        };
        if (quitIdx >= 0) {
          mapped.splice(quitIdx, 0, toggleItem, { type: 'separator' });
        } else {
          mapped.push({ type: 'separator' }, toggleItem);
        }
      }
      return origBuild(mapped);
    };
  }

  function translateTemplateItem(item) {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    if (typeof copy.label === 'string') {
      copy.label = tr(copy.label);
    }
    if (Array.isArray(copy.submenu)) {
      copy.submenu = copy.submenu.map((sub) => translateTemplateItem(sub));
    }
    return copy;
  }

  // 2. Wrap Tray.prototype.setContextMenu to also translate dynamic updates (e.g. "2 agents running")
  if (electron.Tray && electron.Tray.prototype) {
    const origSetContextMenu = electron.Tray.prototype.setContextMenu;
    if (typeof origSetContextMenu === 'function') {
      electron.Tray.prototype.setContextMenu = function (menu) {
        try {
          if (menu && Array.isArray(menu.items)) {
            for (const item of menu.items) {
              if (item && typeof item.label === 'string') {
                const translated = tr(item.label);
                if (translated && translated !== item.label) {
                  item.label = translated;
                }
              }
            }
          }
        } catch (_) {}
        return origSetContextMenu.call(this, menu);
      };
    }
  }

  // 3. Wrap dialog.showMessageBox & dialog.showOpenDialog & dialog.showErrorBox
  if (electron.dialog) {
    const origShowMessageBox = electron.dialog.showMessageBox?.bind(electron.dialog);
    if (origShowMessageBox) {
      electron.dialog.showMessageBox = function (winOrOpts, maybeOpts) {
        const hasWin = maybeOpts !== undefined;
        const opts = hasWin ? { ...maybeOpts } : { ...winOrOpts };
        if (opts && typeof opts === 'object') {
          if (typeof opts.title === 'string') opts.title = tr(opts.title);
          if (typeof opts.message === 'string') opts.message = tr(opts.message);
          if (typeof opts.detail === 'string') opts.detail = tr(opts.detail);
          if (Array.isArray(opts.buttons)) {
            opts.buttons = opts.buttons.map((b) => tr(b));
          }
        }
        return hasWin ? origShowMessageBox(winOrOpts, opts) : origShowMessageBox(opts);
      };
    }

    const origShowOpenDialog = electron.dialog.showOpenDialog?.bind(electron.dialog);
    if (origShowOpenDialog) {
      electron.dialog.showOpenDialog = function (winOrOpts, maybeOpts) {
        const hasWin = maybeOpts !== undefined;
        const opts = hasWin ? { ...maybeOpts } : { ...winOrOpts };
        if (opts && typeof opts === 'object') {
          if (typeof opts.title === 'string') opts.title = tr(opts.title);
          if (typeof opts.buttonLabel === 'string') opts.buttonLabel = tr(opts.buttonLabel);
        }
        return hasWin ? origShowOpenDialog(winOrOpts, opts) : origShowOpenDialog(opts);
      };
    }

    const origShowErrorBox = electron.dialog.showErrorBox?.bind(electron.dialog);
    if (origShowErrorBox) {
      electron.dialog.showErrorBox = function (title, content) {
        return origShowErrorBox(tr(title), tr(content));
      };
    }
  }

  console.log(`[AGY-KO] Main localization hook installed (dict=${rawDict.version})`);
}

module.exports = { installMainLocalization };
