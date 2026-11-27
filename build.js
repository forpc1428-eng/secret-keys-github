// Builds docs/secret-keys.js (the file your bookmark loads) from the extension's code.
// Run after editing anything in extension/:   node build.js
const fs = require('fs');
const path = require('path');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
const files = manifest.content_scripts[0].js;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let out = `/*! ⌘ Secret Keys v${manifest.version} — bookmarklet build — made by VEDANT */\n`;
out += `(function () {\n'use strict';\n`;
out += `if (window.__SK_BM__) { window.__SK_BM__(); return; }\n`;
out += read('src/bookmarklet-shim.js') + '\n';
for (const f of files) {
  out += `\n// ===== ${f} =====\n` + read('extension/' + f) + '\n';
  if (f.endsWith('dom.js')) out += `globalThis.SK.MODE = 'bookmarklet';\n`;
}
out += `\nwindow.__SK_BM__ = () => globalThis.SK.ui && globalThis.SK.ui.toggle();\n})();\n`;

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/secret-keys.js'), out);
console.log(`Built docs/secret-keys.js (${(out.length / 1024).toFixed(1)} KB) from ${files.length} files`);
