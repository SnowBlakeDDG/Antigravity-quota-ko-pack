// Audit locales/ko.json for potentially dangerous or undesirable translations.
'use strict';
const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '..', 'locales', 'ko.json');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
const strings = dict.strings;

// Terms that should NEVER be translated when appearing alone as a label/value
const DO_NOT_TRANSLATE_EXACT = new Set([
  'Antigravity', 'Gemini', 'Google', 'Claude', 'GPT', 'OpenAI', 'Anthropic',
  'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Linear', 'Slack', 'Discord', 'Figma', 'Canva', 'Dropbox', 'Netlify', 'Railway', 'Databricks', 'Looker', 'Auth0', 'Base44', 'Bigin', 'Mobbin',
  'Chrome', 'Firefox', 'Safari', 'Edge', 'Electron', 'Chromium',
  'Windows', 'macOS', 'Linux', 'Ubuntu', 'Debian', 'Fedora', 'Arch', 'Alpine', 'WSL', 'WSL2',
  'VS Code', 'Visual Studio Code', 'Windsurf', 'Cursor', 'JetBrains', 'IntelliJ', 'PyCharm', 'WebStorm', 'GoLand', 'Android Studio', 'Xcode', 'Vim', 'Neovim', 'Emacs',
  'JavaScript', 'TypeScript', 'Python', 'Go', 'Golang', 'Rust', 'Java', 'Kotlin', 'Swift', 'C', 'C++', 'C#', 'PHP', 'Ruby', 'Scala', 'Dart', 'Elixir', 'Erlang', 'Haskell', 'Clojure', 'Lua', 'Perl', 'R', 'Julia', 'MATLAB', 'Objective-C', 'Shell', 'Bash', 'PowerShell', 'Zsh', 'Fish', 'SQL', 'GraphQL', 'HTML', 'CSS', 'SCSS', 'Sass', 'Less', 'JSON', 'YAML', 'TOML', 'XML', 'Markdown', 'LaTeX', 'KaTeX', 'Mermaid', 'Dockerfile', 'Docker', 'Kubernetes', 'Terraform',
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Node.js', 'Deno', 'Bun', 'Tailwind', 'Prisma', 'Vite', 'Webpack',
  'MCP', 'LSP', 'SSH', 'HTTPS', 'HTTP', 'URL', 'URI', 'API', 'SDK', 'CLI', 'GUI', 'IDE', 'PR', 'CI', 'CD', 'VCS', 'Git', 'OAuth', 'JWT', 'SSO', 'MFA', 'RBAC', 'CORS', 'CSP', 'CSRF', 'DNS', 'IP', 'TCP', 'UDP', 'TLS', 'SSL', 'PDF', 'SVG', 'PNG', 'JPG', 'JPEG', 'GIF', 'WebP', 'MP3', 'MP4', 'WAV', 'WebM', 'ZIP', 'TAR',
  'Pro', 'Flash', 'Ultra', 'Nano', 'Max', 'Mini', 'Lite', 'Plus', 'Beta', 'Alpha',
  'Ctrl', 'Alt', 'Shift', 'Cmd', 'Command', 'Option', 'Meta', 'Enter', 'Return', 'Esc', 'Escape', 'Tab', 'Space', 'Backspace', 'Fn',
  'main', 'master', 'HEAD', 'origin', 'upstream', 'localhost', 'true', 'false', 'null', 'undefined',
]);

let removed = 0;
const samples = [];

for (const [k, v] of Object.entries(strings)) {
  const kt = k.trim();
  if (DO_NOT_TRANSLATE_EXACT.has(kt)) {
    delete strings[k];
    removed++;
    continue;
  }
  // Remove CSS / code / path-like keys
  if (/^(?:https?:|file:|data:|antigravity:|vscode:|\/|\.\.?\/|--[a-z])/.test(kt)) {
    delete strings[k];
    removed++;
    continue;
  }
  // Remove keys that look like file extensions or MIME types
  if (/^\.[a-z0-9]+$/i.test(kt) || /^[a-z]+\/[a-z0-9.+-]+$/i.test(kt)) {
    delete strings[k];
    removed++;
    continue;
  }
  // Remove keys with replacement character or garbled encoding
  if (k.includes('\ufffd') || v.includes('\ufffd')) {
    delete strings[k];
    removed++;
    continue;
  }
  // Check placeholder count mismatch ({0}, %s, etc.)
  const kPh = (k.match(/\{\d+\}|%[sd]/g) || []).sort().join(',');
  const vPh = (v.match(/\{\d+\}|%[sd]/g) || []).sort().join(',');
  if (kPh !== vPh) {
    samples.push(['PH_MISMATCH', k, v]);
    delete strings[k];
    removed++;
    continue;
  }
}

fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2));
console.log('Audit complete. Removed:', removed, 'Remaining strings:', Object.keys(strings).length);
if (samples.length) console.log('Samples:', samples.slice(0, 10));
