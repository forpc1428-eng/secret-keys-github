/*! ⌘ Secret Keys v10.0.0 — bookmarklet build — made by VEDANT */
(function () {
'use strict';
if (window.__SK_BM__) { window.__SK_BM__(); return; }
// Secret Keys — bookmarklet adapter.
// Gives the extension code a fake `chrome` object so the exact same files run from a plain <script>.
// Data lives in this site's localStorage (each site keeps its own; use Export/Import to move it).
const chrome = (() => {
  const KEY = '_SK_V10_DATA_';
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  };
  const changeListeners = [];
  const fire = changes => changeListeners.forEach(fn => {
    try { fn(changes, 'local'); } catch (e) { console.warn('[Secret Keys]', e); }
  });

  // other tabs on the same site
  addEventListener('storage', e => {
    if (e.key !== KEY) return;
    const oldV = JSON.parse(e.oldValue || '{}');
    const newV = JSON.parse(e.newValue || '{}');
    const changes = {};
    for (const k of new Set([...Object.keys(oldV), ...Object.keys(newV)])) {
      if (JSON.stringify(oldV[k]) !== JSON.stringify(newV[k])) changes[k] = { oldValue: oldV[k], newValue: newV[k] };
    }
    if (Object.keys(changes).length) fire(changes);
  });

  const local = {
    async get(keys) {
      const all = read();
      if (keys == null) return all;
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in all) out[k] = all[k];
      return out;
    },
    async set(obj) {
      const all = read();
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: all[k], newValue: v };
        all[k] = v;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (e) {
        console.warn('[Secret Keys] could not save', e);
      }
      setTimeout(() => fire(changes), 0);
    }
  };

  const needsExtension = () => {
    throw new Error('This needs the extension version of Secret Keys');
  };

  async function handle(msg) {
    switch (msg.type) {
      case 'openUrl':
        if (msg.newTab) window.open(msg.url, '_blank', 'noopener');
        else location.href = msg.url;
        return true;
      case 'runJS':
        try {
          (0, eval)(msg.code);
        } catch (e) {
          throw new Error(/Content Security Policy|unsafe-eval|Trusted/i.test(e.message) ? 'This site blocks custom JavaScript' : e.message);
        }
        return 'JS executed';
      case 'tab':
        if (msg.action === 'new') return window.open('about:blank', '_blank'), 'New tab';
        if (msg.action === 'duplicate') return window.open(location.href, '_blank'), 'Duplicated';
        if (msg.action === 'reload') return location.reload(), 'Reloaded';
        if (msg.action === 'close') return window.close(), 'Closed';
        return needsExtension();
      case 'listTabs':
      case 'searchBookmarks':
        return [];
      case 'userScriptsStatus':
        return false;
      default:
        return needsExtension();
    }
  }

  return {
    storage: { local, onChanged: { addListener: fn => changeListeners.push(fn) } },
    runtime: {
      id: 'secret-keys-bookmarklet',
      lastError: undefined,
      onMessage: { addListener() {} },
      sendMessage(msg, cb) {
        handle(msg).then(
          result => cb && cb({ ok: true, result }),
          err => cb && cb({ ok: false, error: String((err && err.message) || err) })
        );
      }
    }
  };
})();


// ===== content/dom.js =====
// Secret Keys v10 — DOM + key helpers
// Every content file is wrapped in an IIFE and shares one namespace: globalThis.SK
(() => {
  'use strict';
  const SK = (globalThis.SK = {});

  SK.isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  SK.MOD_KEYS = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'Fn'];

  // Tiny element builder — no innerHTML anywhere (safe on Trusted-Types sites, no injection bugs)
  const PROPS = new Set(['value', 'checked', 'textContent', 'title', 'placeholder', 'type', 'disabled', 'min', 'max', 'step', 'htmlFor', 'tabIndex', 'spellcheck', 'rows']);
  SK.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (PROPS.has(k)) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  };

  SK.uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  SK.sleep = ms => new Promise(r => setTimeout(r, ms));
  SK.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  // After the extension is reloaded/updated, old copies of this script lose access to chrome.*
  SK.alive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  };

  SK.bg = msg =>
    new Promise((resolve, reject) => {
      if (!SK.alive()) return reject(new Error('Extension was updated — reload this page'));
      chrome.runtime.sendMessage(msg, res => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        if (!res) return reject(new Error('No response'));
        res.ok ? resolve(res.result) : reject(new Error(res.error));
      });
    });

  // ---------- Keys ----------
  const NAMES = { ' ': 'Space', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', escape: 'Esc', backspace: '⌫', delete: 'Del', enter: '↵', tab: 'Tab', pageup: 'PgUp', pagedown: 'PgDn' };

  // Use the physical key for letters/digits so Alt/Option combos work on Mac (Option+K gives "˚")
  const keyOf = e => {
    const c = e.code || '';
    if (c.startsWith('Key')) return c.slice(3).toLowerCase();
    if (c.startsWith('Digit')) return c.slice(5);
    return (e.key || '').toLowerCase();
  };

  SK.combo = {
    keyOf,
    fromEvent: e => ({ key: keyOf(e), ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey }),
    matches(c, e) {
      if (!c || !c.key) return false;
      const k = keyOf(e);
      // second check keeps v9 bindings (stored with e.key) working
      if (c.key !== k && c.key !== (e.key || '').toLowerCase()) return false;
      return !!c.ctrl === e.ctrlKey && !!c.alt === e.altKey && !!c.shift === e.shiftKey && !!c.meta === e.metaKey;
    },
    same: (a, b) => !!a && !!b && a.key === b.key && !!a.ctrl === !!b.ctrl && !!a.alt === !!b.alt && !!a.shift === !!b.shift && !!a.meta === !!b.meta,
    parts(c) {
      if (!c || !c.key) return [];
      const p = [];
      if (c.ctrl) p.push(SK.isMac ? '⌃' : 'Ctrl');
      if (c.alt) p.push(SK.isMac ? '⌥' : 'Alt');
      if (c.shift) p.push(SK.isMac ? '⇧' : 'Shift');
      if (c.meta) p.push(SK.isMac ? '⌘' : 'Win');
      const k = c.key;
      p.push(NAMES[k] || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)));
      return p;
    },
    format(c) {
      return this.parts(c).join(SK.isMac ? '' : ' + ');
    }
  };

  // ---------- Elements ----------
  const NON_TEXT_INPUTS = ['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'];
  SK.isEditable = el =>
    !!el &&
    (el.isContentEditable ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !NON_TEXT_INPUTS.includes((el.type || '').toLowerCase())));

  SK.isTextField = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !NON_TEXT_INPUTS.includes((el.type || '').toLowerCase())));

  SK.deepActive = () => {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  };

  SK.visible = el => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (el.checkVisibility) return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    return true;
  };

  SK.labelOf = el => {
    const raw = el.getAttribute('aria-label') || el.innerText || el.title || el.value || el.getAttribute('alt') || el.placeholder || el.getAttribute('name') || '';
    const t = String(raw).replace(/\s+/g, ' ').trim();
    return (t || `<${el.tagName.toLowerCase()}>`).slice(0, 48);
  };

  SK.INTERACTIVE =
    'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=switch],[onclick],[contenteditable=""],[contenteditable=true],[tabindex]:not([tabindex="-1"])';

  SK.pickable = t => {
    if (!t || t.nodeType !== 1) return null;
    const hit = t.closest(SK.INTERACTIVE);
    if (hit) return hit;
    try {
      return getComputedStyle(t).cursor === 'pointer' ? t : null;
    } catch {
      return null;
    }
  };

  SK.scan = () => {
    const seen = new Set();
    const out = [];
    for (const el of document.querySelectorAll(SK.INTERACTIVE)) {
      if (out.length >= 300) break;
      if (el.closest('#secret-keys-host') || !SK.visible(el)) continue;
      out.push(el);
      seen.add(el);
    }
    return out;
  };

  // Smart selector: stable attributes first, position path last
  const unique = sel => {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };
  const looksGenerated = id => /\d{4,}|^[:_]|^(ember|react|radix|mui|headlessui|rc-|uid)|[a-f0-9]{8,}/i.test(id);

  SK.selectorFor = el => {
    const esc = CSS.escape;
    const tag = el.tagName.toLowerCase();
    if (el.id && !looksGenerated(el.id) && unique('#' + esc(el.id))) return '#' + esc(el.id);
    for (const attr of ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy', 'aria-label', 'name', 'title', 'alt', 'placeholder', 'href']) {
      const v = el.getAttribute(attr);
      if (!v || v.length > 120) continue;
      const s = `${tag}[${attr}="${esc(v)}"]`;
      if (unique(s)) return s;
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node !== el && node.id && !looksGenerated(node.id) && unique('#' + esc(node.id))) {
        parts.unshift('#' + esc(node.id));
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter(c => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  };

  // Find a bound element: selector first, then fall back to matching its text (survives site redesigns)
  SK.findTarget = b => {
    let el = null;
    try {
      el = document.querySelector(b.selector);
    } catch {}
    if (el && !el.closest('#secret-keys-host')) return el;
    if (b.text && b.tag) {
      for (const c of document.querySelectorAll(b.tag)) {
        if (SK.labelOf(c) === b.text && SK.visible(c)) return c;
      }
    }
    return null;
  };

  SK.waitFor = (selector, timeout = 5000) =>
    new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        let el = null;
        try {
          el = document.querySelector(selector);
        } catch (e) {
          return reject(new Error('Bad selector: ' + selector));
        }
        if (el) return resolve(el);
        if (Date.now() - t0 > timeout) return reject(new Error('Not found: ' + selector));
        setTimeout(tick, 100);
      };
      tick();
    });
})();

globalThis.SK.MODE = 'bookmarklet';

// ===== content/store.js =====
// Secret Keys v10 — storage (chrome.storage = survives reloads, shared across every site, live-syncs between tabs)
(() => {
  'use strict';
  const SK = globalThis.SK;

  SK.PRESETS = {
    ios: { label: 'iOS Glass', tint: 'dark', opacity: 0.08, blur: 30, saturate: 190, dim: 12, border: 0.22, shadow: 0.5, radius: 26, accent: '#0A84FF', macroAccent: '#FF9F0A' },
    clear: { label: 'Crystal 98%', tint: 'dark', opacity: 0.02, blur: 16, saturate: 200, dim: 18, border: 0.32, shadow: 0.35, radius: 28, accent: '#64D2FF', macroAccent: '#FFD60A' },
    frost: { label: 'Frost', tint: 'light', opacity: 0.38, blur: 40, saturate: 170, dim: -8, border: 0.4, shadow: 0.3, radius: 22, accent: '#007AFF', macroAccent: '#FF6B00' },
    midnight: { label: 'Midnight', tint: 'dark', opacity: 0.55, blur: 24, saturate: 140, dim: 20, border: 0.12, shadow: 0.7, radius: 20, accent: '#8B5CF6', macroAccent: '#F59E0B' },
    neon: { label: 'Neon', tint: 'dark', opacity: 0.14, blur: 26, saturate: 260, dim: 15, border: 0.28, shadow: 0.6, radius: 18, accent: '#22D3EE', macroAccent: '#F472B6' }
  };

  SK.DEFAULT_SETTINGS = {
    enabled: true,
    ignoreInInputs: true,
    paletteKey: { key: 'k', ctrl: !SK.isMac, meta: SK.isMac, alt: false, shift: false },
    theme: {
      preset: 'ios',
      ...SK.PRESETS.ios,
      fontSize: 13,
      speed: 1,
      specular: true,
      textGlow: true,
      liquid: false
    },
    panel: { dock: 'float', width: 360, height: 600, x: null, y: null },
    badge: { show: true, x: null, y: null }
  };
  delete SK.DEFAULT_SETTINGS.theme.label;

  // Settings UI is generated from this list — add a row here and a control appears.
  SK.THEME_SCHEMA = [
    { group: 'Glass' },
    { key: 'opacity', label: 'Tint strength', type: 'range', min: 0, max: 0.7, step: 0.01, fmt: v => Math.round((1 - v) * 100) + '% clear' },
    { key: 'blur', label: 'Blur', type: 'range', min: 0, max: 60, step: 1, fmt: v => v + 'px' },
    { key: 'saturate', label: 'Vibrancy', type: 'range', min: 100, max: 300, step: 5, fmt: v => v + '%' },
    { key: 'dim', label: 'Backdrop dim', type: 'range', min: -40, max: 40, step: 1, fmt: v => (v > 0 ? '−' : '+') + Math.abs(v) + '%' },
    { key: 'border', label: 'Edge light', type: 'range', min: 0, max: 0.6, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
    { key: 'shadow', label: 'Depth', type: 'range', min: 0, max: 1, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
    { key: 'radius', label: 'Corner radius', type: 'range', min: 0, max: 40, step: 1, fmt: v => v + 'px' },
    { key: 'tint', label: 'Tint', type: 'select', options: [['dark', 'Dark'], ['light', 'Light']] },
    { group: 'Color & text' },
    { key: 'accent', label: 'Accent', type: 'color' },
    { key: 'macroAccent', label: 'Macro accent', type: 'color' },
    { key: 'fontSize', label: 'Text size', type: 'range', min: 11, max: 17, step: 1, fmt: v => v + 'px' },
    { key: 'textGlow', label: 'Text shadow (readability)', type: 'toggle' },
    { group: 'Motion & effects' },
    { key: 'speed', label: 'Animation speed', type: 'range', min: 0.25, max: 2.5, step: 0.05, fmt: v => (+v).toFixed(2) + '×' },
    { key: 'specular', label: 'Light follows cursor', type: 'toggle' },
    { key: 'liquid', label: 'Liquid refraction (experimental)', type: 'toggle' }
  ];

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (base, over) => {
    for (const [k, v] of Object.entries(over || {})) {
      if (isObj(v) && isObj(base[k])) merge(base[k], v);
      else if (v !== undefined) base[k] = v;
    }
    return base;
  };
  SK.freshSettings = (over = {}) => merge(structuredClone(SK.DEFAULT_SETTINGS), over);

  const comboKeys = o => ({ key: o.key || '', ctrl: !!o.ctrl, alt: !!o.alt, shift: !!o.shift, meta: !!o.meta });

  SK.store = {
    data: { settings: SK.freshSettings(), bindings: [], macros: [] },
    listeners: new Set(),

    async load() {
      const r = await chrome.storage.local.get(['settings', 'bindings', 'macros']);
      this.data.settings = SK.freshSettings(r.settings);
      this.data.bindings = (r.bindings || []).map(b => this.normBinding(b));
      this.data.macros = (r.macros || []).map(m => this.normMacro(m));
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local') return;
        const changed = [];
        if (ch.settings) (this.data.settings = SK.freshSettings(ch.settings.newValue)), changed.push('settings');
        if (ch.bindings) (this.data.bindings = (ch.bindings.newValue || []).map(b => this.normBinding(b))), changed.push('bindings');
        if (ch.macros) (this.data.macros = (ch.macros.newValue || []).map(m => this.normMacro(m))), changed.push('macros');
        if (changed.length) this.emit(changed);
      });
    },

    save(key) {
      if (!SK.alive()) return Promise.resolve();
      return chrome.storage.local.set({ [key]: this.data[key] }).catch(() => {});
    },
    saveSettingsSoon: SK.debounce(() => SK.store.save('settings'), 250),

    on(fn) {
      this.listeners.add(fn);
    },
    emit(changed) {
      for (const fn of this.listeners) {
        try {
          fn(changed);
        } catch (e) {
          console.warn('[Secret Keys]', e);
        }
      }
    },

    normBinding(b) {
      return {
        id: b.id || SK.uid(),
        domain: b.domain || location.hostname,
        name: b.name || 'Element',
        selector: b.selector || '',
        text: b.text || '',
        tag: b.tag || '',
        enabled: b.enabled !== false,
        ...comboKeys(b)
      };
    },
    normMacro(m) {
      return {
        id: m.id || SK.uid(),
        name: m.name || 'Macro',
        domain: m.domain || location.hostname,
        global: !!m.global,
        actionType: m.actionType || 'notify',
        params: m.params || {},
        enabled: m.enabled !== false,
        ...comboKeys(m)
      };
    },

    mergeBindings(list) {
      let n = 0;
      for (const raw of list || []) {
        const b = this.normBinding(raw);
        if (this.data.bindings.some(x => x.id === b.id || (x.domain === b.domain && x.selector === b.selector && SK.combo.same(x, b)))) continue;
        this.data.bindings.push(b);
        n++;
      }
      return n;
    },
    mergeMacros(list) {
      let n = 0;
      for (const raw of list || []) {
        const m = this.normMacro(raw);
        if (this.data.macros.some(x => x.id === m.id || (x.name === m.name && x.actionType === m.actionType && SK.combo.same(x, m)))) continue;
        this.data.macros.push(m);
        n++;
      }
      return n;
    },

    // v9 kept everything in this site's localStorage. Pull it in once per site.
    async migrateV9() {
      let n = 0;
      try {
        if (localStorage.getItem('_SK_V10_MIGRATED_')) return 0;
        const old = JSON.parse(localStorage.getItem('_UIE_PRO_V9_') || 'null');
        if (old && old.bindings) n += this.mergeBindings(old.bindings);
        const oldMacros = JSON.parse(localStorage.getItem('_UIE_MACROS_V9_') || 'null');
        if (Array.isArray(oldMacros)) n += this.mergeMacros(oldMacros);
        localStorage.setItem('_SK_V10_MIGRATED_', '1');
      } catch {
        return 0;
      }
      if (n) await Promise.all([this.save('bindings'), this.save('macros')]);
      return n;
    },

    exportJSON() {
      return JSON.stringify({ app: 'secret-keys', version: 10, settings: this.data.settings, bindings: this.data.bindings, macros: this.data.macros }, null, 2);
    },

    async importJSON(text) {
      const data = JSON.parse(text);
      const n = this.mergeBindings(data.bindings) + this.mergeMacros(data.macros);
      if (data.version === 10 && data.settings) this.data.settings = SK.freshSettings(data.settings);
      else if (typeof data.enabled === 'boolean') this.data.settings.enabled = data.enabled; // v9 file
      await Promise.all([this.save('bindings'), this.save('macros'), this.save('settings')]);
      this.emit(['bindings', 'macros', 'settings']);
      return n;
    }
  };
})();


// ===== content/actions.js =====
// Secret Keys v10 — macro actions
(() => {
  'use strict';
  const SK = globalThis.SK;

  // ---------- Variables: {{date}} {{time}} {{url}} {{title}} {{selection}} {{clipboard}} {{input:Your name}} ----------
  SK.VARIABLES = ['date', 'time', 'datetime', 'iso', 'url', 'domain', 'title', 'selection', 'clipboard', 'newline', 'input:Label'];

  SK.expand = async (text = '', { encode = false } = {}) => {
    const enc = v => (encode ? encodeURIComponent(v) : v);
    const now = new Date();
    const map = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      datetime: now.toLocaleString(),
      iso: now.toISOString(),
      url: location.href,
      domain: location.hostname,
      title: document.title,
      selection: SK.ui.lastSelection || String(getSelection() || ''),
      newline: '\n'
    };
    let out = String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in map ? enc(map[k]) : m));
    if (/\{\{\s*clipboard\s*\}\}/.test(out)) {
      let clip = '';
      try {
        clip = await navigator.clipboard.readText();
      } catch {}
      out = out.replace(/\{\{\s*clipboard\s*\}\}/g, () => enc(clip));
    }
    for (const m of [...out.matchAll(/\{\{\s*input:([^}]+)\}\}/g)]) {
      const v = await SK.ui.prompt(m[1].trim());
      if (v === null) throw new Error('Cancelled');
      out = out.replace(m[0], () => enc(v));
    }
    return out;
  };

  // Works with plain inputs, React/Vue inputs and rich editors (Gmail, Notion, Slack…) and keeps Ctrl+Z
  SK.insertText = (el, text, mode = 'cursor') => {
    if (!el || !SK.isTextField(el)) return false;
    el.focus();
    if (el.isContentEditable) {
      if (mode === 'replace') document.execCommand('selectAll', false);
      if (!document.execCommand('insertText', false, text)) {
        const sel = getSelection();
        if (sel.rangeCount) {
          const r = sel.getRangeAt(0);
          r.deleteContents();
          r.insertNode(document.createTextNode(text));
          r.collapse(false);
        }
      }
      return true;
    }
    if (mode === 'replace') el.select();
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch {}
    if (!ok) {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      let s = 0,
        e = el.value.length;
      if (mode !== 'replace') {
        try {
          s = el.selectionStart ?? el.value.length;
          e = el.selectionEnd ?? el.value.length;
        } catch {
          s = e = el.value.length;
        }
      }
      setter.call(el, el.value.slice(0, s) + text + el.value.slice(e));
      try {
        el.setSelectionRange(s + text.length, s + text.length);
      } catch {}
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  };

  SK.copy = async text => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.documentElement.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  };

  const VAR_HINT = 'Variables: {{date}} {{time}} {{url}} {{title}} {{selection}} {{clipboard}} {{input:Name}}';

  SK.ACTIONS = {
    insert_text: {
      label: 'Insert text',
      icon: '📝',
      desc: 'Type saved text into the box you are in',
      fields: [
        { key: 'text', label: 'Text', type: 'textarea', placeholder: 'Hi {{input:Name}},\n\nThanks for reaching out!', hint: VAR_HINT },
        { key: 'mode', label: 'Where', type: 'select', options: [['cursor', 'At the cursor'], ['replace', 'Replace everything']] }
      ],
      async run(p, ctx) {
        const mode = p.mode || (p.append === false ? 'replace' : 'cursor'); // v9 used "append"
        const text = await SK.expand(p.text);
        const el = ctx.target;
        if (!SK.insertText(el, text, mode)) throw new Error('Click into a text box first');
        return 'Inserted';
      }
    },

    open_url: {
      label: 'Open URL',
      icon: '🌐',
      desc: 'Open a link — use {{selection}} to search what you highlighted',
      fields: [
        { key: 'url', label: 'URL', type: 'text', placeholder: 'https://www.google.com/search?q={{selection}}' },
        { key: 'newTab', label: 'Open in new tab', type: 'checkbox', default: true }
      ],
      async run(p) {
        let url = (await SK.expand(p.url, { encode: true })).trim();
        if (!url) throw new Error('No URL set');
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
        await SK.bg({ type: 'openUrl', url, newTab: p.newTab !== false });
        return 'Opened';
      }
    },

    click_element: {
      label: 'Click element',
      icon: '🖱️',
      desc: 'Click something on the page by CSS selector (waits for it to appear)',
      fields: [
        { key: 'selector', label: 'CSS selector', type: 'text', placeholder: '#submit, button[aria-label="Send"]', pick: true },
        { key: 'timeout', label: 'Wait up to (ms)', type: 'number', placeholder: '3000' }
      ],
      async run(p) {
        const el = await SK.waitFor(p.selector, +p.timeout || 3000);
        SK.ui.flash(el);
        el.click();
        return 'Clicked';
      }
    },

    focus_element: {
      label: 'Focus element',
      icon: '🎯',
      desc: 'Jump the cursor into a search box or field',
      fields: [{ key: 'selector', label: 'CSS selector', type: 'text', placeholder: 'input[type=search]', pick: true }],
      async run(p) {
        const el = await SK.waitFor(p.selector, 3000);
        el.focus();
        if (el.select) try { el.select(); } catch {}
        SK.ui.flash(el);
        return '';
      }
    },

    copy_text: {
      label: 'Copy to clipboard',
      icon: '📋',
      desc: 'Copy saved text (variables work here too)',
      fields: [{ key: 'text', label: 'Text', type: 'textarea', placeholder: '[{{title}}]({{url}})', hint: VAR_HINT }],
      async run(p) {
        await SK.copy(await SK.expand(p.text));
        return 'Copied';
      }
    },

    scroll_page: {
      label: 'Scroll page',
      icon: '📜',
      desc: 'Scroll to top, bottom, a position or by one screen',
      fields: [
        { key: 'position', label: 'Scroll to', type: 'select', options: ['Top', 'Bottom', 'Up one screen', 'Down one screen', 'Custom'] },
        { key: 'customY', label: 'Custom Y (px)', type: 'number', placeholder: '500' }
      ],
      async run(p) {
        const pos = p.position || 'Top';
        const top = { Top: 0, Bottom: document.documentElement.scrollHeight, Custom: +p.customY || 0 }[pos];
        if (top !== undefined) scrollTo({ top, behavior: 'smooth' });
        else scrollBy({ top: (pos.startsWith('Up') ? -1 : 1) * innerHeight * 0.85, behavior: 'smooth' });
        return '';
      }
    },

    tab_action: {
      label: 'Tab action',
      icon: '🗂️',
      desc: 'Control browser tabs and bookmarks',
      fields: [
        {
          key: 'action',
          label: 'Action',
          type: 'select',
          options: [
            ['new', 'New tab'], ['close', 'Close tab'], ['duplicate', 'Duplicate tab'], ['pin', 'Pin / unpin'],
            ['mute', 'Mute / unmute'], ['reload', 'Reload'], ['next', 'Next tab'], ['prev', 'Previous tab'],
            ['dedupe', 'Close duplicate tabs'], ['bookmark', 'Bookmark this page']
          ]
        }
      ],
      async run(p) {
        return SK.bg({ type: 'tab', action: p.action || 'new' });
      }
    },

    run_js: {
      label: 'Run JavaScript',
      icon: '⚙️',
      desc: 'Run your own code on the page',
      fields: [{ key: 'code', label: 'JavaScript', type: 'textarea', mono: true, placeholder: 'document.querySelectorAll("video").forEach(v => v.playbackRate = 2)' }],
      async run(p) {
        return SK.bg({ type: 'runJS', code: p.code || '' });
      }
    },

    notify: {
      label: 'Show notification',
      icon: '🔔',
      desc: 'Show a glass toast message',
      fields: [
        { key: 'message', label: 'Message', type: 'text', placeholder: 'Stand up and stretch 🧘' },
        { key: 'duration', label: 'Duration (ms)', type: 'number', placeholder: '3000' }
      ],
      async run(p) {
        SK.ui.toast(await SK.expand(p.message || 'Notification'), { duration: +p.duration || 3000 });
        return '';
      }
    },

    multi_action: {
      label: 'Multi-step chain',
      icon: '🔗',
      desc: 'Run steps in order. Extra steps: {"type":"wait","ms":500} and {"type":"wait_for","selector":"#x"}',
      fields: [
        {
          key: 'actions',
          label: 'Steps (JSON)',
          type: 'textarea',
          mono: true,
          placeholder: '[\n  {"type":"focus_element","selector":"textarea"},\n  {"type":"insert_text","text":"Hello!"},\n  {"type":"wait","ms":300},\n  {"type":"click_element","selector":"button[type=submit]"}\n]'
        }
      ],
      async run(p, ctx) {
        let steps;
        try {
          steps = JSON.parse(p.actions || '[]');
        } catch (e) {
          throw new Error('Steps JSON: ' + e.message);
        }
        if (!Array.isArray(steps)) throw new Error('Steps must be a JSON array');
        let i = 0;
        for (const step of steps) {
          i++;
          if (step.type === 'wait') {
            await SK.sleep(+step.ms || 200);
            continue;
          }
          if (step.type === 'wait_for') {
            await SK.waitFor(step.selector, +step.timeout || 5000);
            continue;
          }
          const def = SK.ACTIONS[step.type];
          if (!def || step.type === 'multi_action') throw new Error(`Step ${i}: unknown type "${step.type}"`);
          try {
            await def.run(step.params || step, { ...ctx, target: SK.isTextField(SK.deepActive()) ? SK.deepActive() : ctx.target });
          } catch (e) {
            throw new Error(`Step ${i}: ${e.message}`);
          }
          await SK.sleep(60);
        }
        return `${steps.length} steps done`;
      }
    }
  };

  SK.runMacro = async (m, ctx = {}) => {
    const def = SK.ACTIONS[m.actionType];
    if (!def) return SK.ui.toast(`Unknown action "${m.actionType}"`, { type: 'error' });
    try {
      const res = await def.run(m.params || {}, ctx);
      if (res) SK.ui.toast(`${m.name} · ${res}`, { accent: 'macro', duration: 1800 });
    } catch (e) {
      if (e.message !== 'Cancelled') SK.ui.toast(`${m.name}: ${e.message}`, { type: 'error', duration: 4500 });
    }
  };
})();


// ===== content/styles.js =====
// Secret Keys v10 — liquid glass styles (lives inside a Shadow DOM so no website can break it)
(() => {
  'use strict';
  const SK = globalThis.SK;

  // A real spring curve (overshoot + settle) like iOS
  const SPRING =
    'linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)';
  const EASE = 'cubic-bezier(.2,.9,.25,1.15)';

  SK.CSS = `
:host { all: initial; }
.sk-root {
  --sk-spring-fallback: ${EASE};
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, "Inter", sans-serif;
  font-size: var(--sk-fs); line-height: 1.4; color: var(--sk-text);
  -webkit-font-smoothing: antialiased; text-shadow: var(--sk-glow);
}
.sk-root *, .sk-root *::before, .sk-root *::after { box-sizing: border-box; margin: 0; }
.sk-root button, .sk-root input, .sk-root select, .sk-root textarea { font: inherit; color: inherit; text-shadow: inherit; }
.sk-root [hidden] { display: none !important; }

/* ---------- The glass ---------- */
.glass {
  position: relative; isolation: isolate;
  background: var(--sk-bg);
  backdrop-filter: blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));
  -webkit-backdrop-filter: blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));
  border-radius: var(--sk-radius);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255, calc(var(--sk-border) * 1.7)),
    inset 0 -1px 0 rgba(0,0,0, .16),
    inset 0 0 0 .5px rgba(255,255,255, var(--sk-border)),
    0 calc(34px * var(--sk-depth)) calc(90px * var(--sk-depth)) rgba(0,0,0, calc(.55 * var(--sk-depth))),
    0 calc(4px * var(--sk-depth)) calc(14px * var(--sk-depth)) rgba(0,0,0, calc(.22 * var(--sk-depth)));
}
.liquid .glass.sk-panel, .liquid .glass.sk-sheet {
  backdrop-filter: url(#sk-liquid) blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));
}
/* Gradient rim — light catching the edge */
.glass::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none; z-index: 3;
  background: linear-gradient(140deg,
    rgba(255,255,255, calc(var(--sk-border) * 2.6)) 0%,
    rgba(255,255,255, 0) 38%, rgba(255,255,255, 0) 62%,
    rgba(255,255,255, calc(var(--sk-border) * 1.5)) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
/* Specular sheen that follows the cursor */
.sk-sheen {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 0;
  background:
    radial-gradient(380px circle at var(--mx, 25%) var(--my, -10%), rgba(255,255,255,.16), transparent 55%),
    linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,0) 28%);
}
.no-specular .sk-sheen { background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,0) 28%); }
[data-tint=light] .sk-sheen { mix-blend-mode: soft-light; }

/* ---------- Panel ---------- */
.sk-panel {
  position: fixed; z-index: 2147483646; display: flex; flex-direction: column;
  min-width: 300px; min-height: 340px; overflow: hidden; touch-action: none;
  opacity: 0; visibility: hidden; transform: scale(.9) translateY(-10px); transform-origin: top right;
  transition: opacity calc(var(--sk-dur) * .7) ease, transform var(--sk-dur) ${EASE}, visibility 0s linear var(--sk-dur);
  transition: opacity calc(var(--sk-dur) * .7) ease, transform calc(var(--sk-dur) * 1.6) ${SPRING}, visibility 0s linear var(--sk-dur);
}
.sk-panel.open { opacity: 1; visibility: visible; transform: none; transition-delay: 0s; }
.sk-panel.picking { opacity: .12 !important; pointer-events: none; }
.sk-panel > *:not(.sk-sheen) { position: relative; z-index: 1; }
.sk-panel.dock-right, .sk-panel.dock-left { top: 12px !important; bottom: 12px; height: auto !important; }
.sk-panel.dock-right { right: 12px !important; left: auto !important; }
.sk-panel.dock-left { left: 12px !important; right: auto !important; transform-origin: top left; }

.sk-head { display: flex; align-items: center; gap: 10px; padding: 16px 16px 10px; cursor: grab; user-select: none; }
.sk-head:active { cursor: grabbing; }
.sk-logo { width: 26px; height: 26px; border-radius: 9px; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #fff; text-shadow: none;
  background: linear-gradient(145deg, var(--sk-accent), var(--sk-macro)); box-shadow: 0 4px 14px color-mix(in srgb, var(--sk-accent) 50%, transparent), inset 0 1px 0 rgba(255,255,255,.5); }
.sk-title { flex: 1; font-weight: 700; font-size: 1.08em; letter-spacing: -.01em; }
.sk-title small { display: block; font-weight: 500; font-size: .74em; color: var(--sk-sub); letter-spacing: 0; }
.sk-icon-btn { width: 28px; height: 28px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--sk-fill); color: var(--sk-sub); font-size: 15px; line-height: 1; transition: transform .2s ${EASE}, background .15s; }
.sk-icon-btn:hover { background: var(--sk-fill2); color: var(--sk-text); }
.sk-icon-btn:active { transform: scale(.88); }

/* Segmented control with sliding pill */
.sk-seg { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin: 0 14px 10px; padding: 3px; border-radius: 12px; background: var(--sk-fill); }
.sk-seg-pill { position: absolute; top: 3px; bottom: 3px; left: 3px; border-radius: 9px; background: var(--sk-pill);
  box-shadow: 0 3px 10px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.25);
  transition: transform calc(var(--sk-dur) * 1.4) ${EASE}, width .2s;
  transition: transform calc(var(--sk-dur) * 1.6) ${SPRING}, width .2s; }
.sk-seg button { position: relative; z-index: 1; border: 0; background: none; padding: 7px 4px; font-size: .9em; font-weight: 600; cursor: pointer; color: var(--sk-sub); border-radius: 9px; transition: color .2s; }
.sk-seg button.active { color: var(--sk-text); }

.sk-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 2px 14px 14px; display: flex; flex-direction: column; gap: 10px; overscroll-behavior: contain; }
.sk-body::-webkit-scrollbar, .sk-pal-list::-webkit-scrollbar, .sk-sheet::-webkit-scrollbar { width: 6px; }
.sk-body::-webkit-scrollbar-thumb, .sk-pal-list::-webkit-scrollbar-thumb, .sk-sheet::-webkit-scrollbar-thumb { background: var(--sk-fill2); border-radius: 6px; }
.sk-view { display: flex; flex-direction: column; gap: 10px; }
.sk-view.anim { animation: sk-in calc(var(--sk-dur) * 1.2) ${EASE}; }
@keyframes sk-in { from { opacity: 0; transform: translateY(6px) scale(.99); } }

.sk-section { display: flex; align-items: center; justify-content: space-between; font-size: .76em; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--sk-sub); margin-top: 6px; padding: 0 4px; }
.sk-link { cursor: pointer; color: var(--sk-accent); text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 1.15em; background: none; border: 0; padding: 0; }
.sk-card { background: var(--sk-fill); border-radius: calc(var(--sk-radius) * .55); padding: 4px; display: flex; flex-direction: column; }
.sk-card > .sk-row + .sk-row { border-top: .5px solid var(--sk-line); }

.sk-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: calc(var(--sk-radius) * .4); min-height: 40px; transition: background .15s; }
.sk-row.click { cursor: pointer; }
.sk-row.click:hover { background: var(--sk-fill); }
.sk-row.off { opacity: .5; }
.sk-row .grow { flex: 1; min-width: 0; }
.sk-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.sk-row .meta { font-size: .8em; color: var(--sk-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.sk-x { border: 0; background: none; cursor: pointer; color: var(--sk-sub); font-size: 18px; line-height: 1; width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; opacity: .6; }
.sk-x:hover { opacity: 1; color: #ff453a; background: rgba(255,69,58,.12); }

.sk-kbd { display: inline-flex; gap: 3px; flex-shrink: 0; }
.sk-kbd span { font: 600 .82em ui-monospace, "SF Mono", Menlo, Consolas, monospace; padding: 2px 6px; min-width: 20px; text-align: center; border-radius: 6px; text-shadow: none;
  color: var(--kc, var(--sk-accent)); background: color-mix(in srgb, var(--kc, var(--sk-accent)) 16%, transparent); box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--kc, var(--sk-accent)) 40%, transparent); }
.sk-kbd.macro { --kc: var(--sk-macro); }
.sk-kbd.none span { --kc: var(--sk-sub); }
.sk-chip { font-size: .74em; font-weight: 600; padding: 2px 7px; border-radius: 20px; background: var(--sk-fill2); color: var(--sk-sub); white-space: nowrap; }
.sk-chip.green { color: #30d158; background: rgba(48,209,88,.14); }

.sk-empty { text-align: center; color: var(--sk-sub); font-size: .9em; padding: 18px 10px; }
.sk-empty b { display: block; font-size: 1.8em; margin-bottom: 4px; }

/* ---------- Controls ---------- */
.sk-btn { border: 0; cursor: pointer; padding: 10px 14px; border-radius: calc(var(--sk-radius) * .5); font-weight: 600; background: var(--sk-fill2); display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: transform .25s ${EASE}, filter .15s, background .15s; box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
.sk-btn:hover { filter: brightness(1.15); }
.sk-btn:active { transform: scale(.96); }
.sk-btn.primary, .sk-btn.macro { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.sk-btn.primary { background: linear-gradient(180deg, color-mix(in srgb, var(--sk-accent) 85%, white), var(--sk-accent)); box-shadow: 0 6px 20px color-mix(in srgb, var(--sk-accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.35); }
.sk-btn.macro { background: linear-gradient(180deg, color-mix(in srgb, var(--sk-macro) 85%, white), var(--sk-macro)); box-shadow: 0 6px 20px color-mix(in srgb, var(--sk-macro) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.35); }
.sk-btn.danger { color: #ff453a; background: rgba(255,69,58,.12); }
.sk-btn.small { padding: 6px 10px; font-size: .88em; }
.sk-btn.block { width: 100%; }
.sk-btns { display: flex; gap: 8px; }
.sk-btns > * { flex: 1; }

.sk-input, .sk-select, .sk-textarea { width: 100%; border: 0; outline: 0; padding: 9px 12px; border-radius: calc(var(--sk-radius) * .42); background: var(--sk-field); box-shadow: inset 0 0 0 .5px var(--sk-line); transition: box-shadow .15s; text-shadow: none; }
.sk-input:focus, .sk-select:focus, .sk-textarea:focus { box-shadow: inset 0 0 0 1.5px var(--sk-accent), 0 0 0 4px color-mix(in srgb, var(--sk-accent) 20%, transparent); }
.sk-input::placeholder, .sk-textarea::placeholder { color: var(--sk-sub); opacity: .8; }
.sk-textarea { min-height: 84px; resize: vertical; line-height: 1.45; }
.sk-textarea.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: .9em; }
.sk-select { appearance: none; cursor: pointer; padding-right: 30px;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 16px) 55%, calc(100% - 11px) 55%; background-size: 5px 5px; background-repeat: no-repeat; }
.sk-select option { color: #000; }
.sk-field { display: flex; flex-direction: column; gap: 6px; }
.sk-field > label { font-size: .8em; font-weight: 600; color: var(--sk-sub); padding-left: 2px; }
.sk-hint { font-size: .76em; color: var(--sk-sub); padding-left: 2px; }
.sk-warn { font-size: .82em; color: #ffd60a; padding: 6px 10px; border-radius: 10px; background: rgba(255,214,10,.12); }
.sk-inline { display: flex; gap: 6px; }
.sk-inline > .sk-input { flex: 1; }

.sk-switch { position: relative; width: 42px; height: 25px; flex-shrink: 0; cursor: pointer; }
.sk-switch input { position: absolute; opacity: 0; inset: 0; cursor: pointer; z-index: 1; margin: 0; }
.sk-switch i { position: absolute; inset: 0; border-radius: 20px; background: var(--sk-fill2); transition: background .25s; box-shadow: inset 0 0 0 .5px var(--sk-line); }
.sk-switch i::before { content: ""; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.3);
  transition: transform .35s ${EASE}, width .2s; }
.sk-switch input:checked + i { background: #30d158; }
.sk-switch input:checked + i::before { transform: translateX(17px); }
.sk-switch input:active + i::before { width: 26px; }
.sk-switch input:checked:active + i::before { transform: translateX(12px); }

.sk-range { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; padding: 8px 10px; }
.sk-range label { font-weight: 500; }
.sk-range output { font-size: .82em; color: var(--sk-sub); font-variant-numeric: tabular-nums; }
.sk-range input[type=range] { grid-column: 1 / -1; width: 100%; -webkit-appearance: none; appearance: none; height: 6px; border-radius: 6px; outline: none; cursor: pointer;
  background: linear-gradient(90deg, var(--sk-accent) var(--p, 50%), var(--sk-fill2) var(--p, 50%)); }
.sk-range input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35), 0 0 0 .5px rgba(0,0,0,.1); transition: transform .2s ${EASE}; }
.sk-range input[type=range]:active::-webkit-slider-thumb { transform: scale(1.18); }
.sk-color { width: 34px; height: 26px; border: 0; padding: 0; border-radius: 8px; overflow: hidden; cursor: pointer; background: none; }
.sk-color::-webkit-color-swatch-wrapper { padding: 0; }
.sk-color::-webkit-color-swatch { border: 0; border-radius: 8px; }

.sk-presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.sk-preset { border: 0; cursor: pointer; padding: 10px 8px 8px; border-radius: calc(var(--sk-radius) * .5); background: var(--sk-fill); display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: .82em; font-weight: 600; transition: transform .25s ${EASE}; }
.sk-preset:active { transform: scale(.94); }
.sk-preset.active { box-shadow: inset 0 0 0 2px var(--sk-accent); }
.sk-preset i { width: 100%; height: 34px; border-radius: 10px; display: block; box-shadow: inset 0 1px 0 rgba(255,255,255,.4), inset 0 0 0 .5px rgba(255,255,255,.3); }

.sk-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px 14px; font-size: .78em; color: var(--sk-sub); border-top: .5px solid var(--sk-line); }
.sk-foot b { color: var(--sk-accent); }
.sk-foot .sk-link { font-size: 1em; }
.sk-resize { position: absolute !important; right: 4px; bottom: 4px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 5 !important; opacity: .45;
  background: radial-gradient(circle at 70% 70%, var(--sk-text) 1.2px, transparent 1.6px), radial-gradient(circle at 30% 70%, var(--sk-text) 1.2px, transparent 1.6px), radial-gradient(circle at 70% 30%, var(--sk-text) 1.2px, transparent 1.6px); }
.dock-left .sk-resize, .dock-right .sk-resize { display: none; }

/* ---------- Floating pill ---------- */
.sk-badge { position: fixed; z-index: 2147483645; display: flex; align-items: center; gap: 8px; padding: 9px 14px 9px 10px; border-radius: 999px !important; cursor: pointer; user-select: none; touch-action: none; font-weight: 700; font-size: .92em;
  transition: transform .35s ${EASE}, opacity .3s; }
.sk-badge:hover { transform: scale(1.05); }
.sk-badge:active { transform: scale(.94); }
.sk-badge .dot { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; color: #fff; text-shadow: none; background: linear-gradient(145deg, var(--sk-accent), var(--sk-macro)); }
.sk-badge.off .dot { filter: grayscale(1); }
.sk-badge > span { position: relative; z-index: 1; }

/* ---------- Highlight / flash ---------- */
.sk-hl { position: fixed; z-index: 2147483644; pointer-events: none; border-radius: 10px; display: none;
  box-shadow: 0 0 0 2px var(--sk-accent), 0 0 0 6px color-mix(in srgb, var(--sk-accent) 25%, transparent), 0 0 30px color-mix(in srgb, var(--sk-accent) 40%, transparent);
  background: color-mix(in srgb, var(--sk-accent) 10%, transparent); transition: all .12s ease-out; }
.sk-hl b { position: absolute; left: 0; top: -26px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 7px; background: var(--sk-accent); color: #fff; text-shadow: none; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.sk-flash { position: fixed; z-index: 2147483644; pointer-events: none; border-radius: 10px; background: var(--sk-accent); }

/* ---------- Toasts ---------- */
.sk-toasts { position: fixed; z-index: 2147483647; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; pointer-events: none; }
.sk-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 11px 18px; border-radius: 999px !important; font-weight: 600; max-width: min(560px, 90vw);
  animation: sk-toast-in calc(var(--sk-dur) * 1.6) ${EASE}; animation: sk-toast-in calc(var(--sk-dur) * 1.8) ${SPRING}; }
.sk-toast > span { position: relative; z-index: 1; }
.sk-toast .bolt { color: var(--tc, var(--sk-accent)); }
.sk-toast.error { --tc: #ff453a; }
.sk-toast.macro { --tc: var(--sk-macro); }
.sk-toast.out { transition: opacity .25s, transform .25s; opacity: 0; transform: translateY(10px) scale(.95); }
.sk-toast button { position: relative; z-index: 1; border: 0; background: var(--sk-fill2); border-radius: 20px; padding: 4px 10px; cursor: pointer; font-weight: 700; color: var(--sk-accent); }
@keyframes sk-toast-in { from { opacity: 0; transform: translateY(24px) scale(.85); } }

/* ---------- Modals & palette ---------- */
.sk-overlay { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(0,0,0,.22); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: sk-fade .2s ease; }
.sk-overlay.top { align-items: flex-start; padding-top: 14vh; }
.sk-overlay.closing { transition: opacity .18s; opacity: 0; }
@keyframes sk-fade { from { opacity: 0; } }
.sk-sheet { width: min(440px, 100%); max-height: 86vh; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 14px;
  animation: sk-pop calc(var(--sk-dur) * 1.4) ${EASE}; animation: sk-pop calc(var(--sk-dur) * 1.8) ${SPRING}; }
.sk-sheet > *:not(.sk-sheen) { position: relative; z-index: 1; }
.closing .sk-sheet { transition: transform .18s, opacity .18s; transform: scale(.95); opacity: 0; }
@keyframes sk-pop { from { opacity: 0; transform: scale(.88) translateY(12px); } }
.sk-sheet h3 { font-size: 1.25em; font-weight: 700; letter-spacing: -.01em; }
.sk-sheet h3 small { display: block; font-size: .62em; font-weight: 500; color: var(--sk-sub); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sk-capture { display: grid; place-items: center; min-height: 64px; border-radius: calc(var(--sk-radius) * .5); cursor: pointer; font-weight: 700; font-size: 1.05em; color: var(--sk-sub);
  background: var(--sk-field); outline: 1.5px dashed var(--sk-line); outline-offset: -1.5px; transition: outline-color .2s, transform .2s ${EASE}; }
.sk-capture .sk-kbd span { font-size: 1.25em; padding: 4px 10px; }
.sk-capture.listening { outline-color: var(--sk-accent); color: var(--sk-accent); animation: sk-breathe 1.2s ease-in-out infinite; }
.sk-capture.macro.listening { outline-color: var(--sk-macro); color: var(--sk-macro); }
@keyframes sk-breathe { 50% { transform: scale(1.015); } }

.sk-pal { width: min(640px, 100%); padding: 0; gap: 0; max-height: 70vh; overflow: hidden; }
.sk-pal-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: .5px solid var(--sk-line); }
.sk-pal-head .glyph { font-size: 18px; opacity: .7; }
.sk-pal-input { flex: 1; border: 0; outline: 0; background: none; font-size: 1.35em; font-weight: 500; text-shadow: none; }
.sk-pal-input::placeholder { color: var(--sk-sub); }
.sk-pal-list { overflow-y: auto; padding: 6px; max-height: calc(70vh - 110px); }
.sk-pal-group { font-size: .72em; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--sk-sub); padding: 10px 12px 4px; }
.sk-pal-item { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: calc(var(--sk-radius) * .45); cursor: pointer; }
.sk-pal-item.active { background: color-mix(in srgb, var(--sk-accent) 22%, transparent); box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--sk-accent) 45%, transparent); }
.sk-pal-icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--sk-fill); font-size: 15px; flex-shrink: 0; text-shadow: none; }
.sk-pal-text { flex: 1; min-width: 0; }
.sk-pal-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-pal-sub { font-size: .8em; color: var(--sk-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-pal-foot { display: flex; gap: 14px; padding: 10px 16px; font-size: .76em; color: var(--sk-sub); border-top: .5px solid var(--sk-line); flex-wrap: wrap; }
.sk-pal-foot b { font-family: ui-monospace, Menlo, monospace; color: var(--sk-text); }

@media (prefers-reduced-motion: reduce) {
  .sk-root *, .sk-root *::before { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--sk-solid) !important; }
}
`;

  // Theme → CSS variables on the host (instant, no re-render)
  SK.themeVars = t => {
    const light = t.tint === 'light';
    const rgb = light ? '255,255,255' : '16,18,26';
    return {
      '--sk-bg': `rgba(${rgb},${t.opacity})`,
      '--sk-solid': light ? 'rgba(246,247,250,.97)' : 'rgba(22,24,32,.97)',
      '--sk-blur': `${t.blur}px`,
      '--sk-sat': `${t.saturate}%`,
      '--sk-bright': String(1 - t.dim / 100),
      '--sk-border': String(t.border),
      '--sk-depth': String(t.shadow),
      '--sk-radius': `${t.radius}px`,
      '--sk-accent': t.accent,
      '--sk-macro': t.macroAccent,
      '--sk-fs': `${t.fontSize}px`,
      '--sk-dur': `${(0.34 / Math.max(0.1, t.speed)).toFixed(3)}s`,
      '--sk-text': light ? '#0b0d12' : '#f6f8fc',
      '--sk-sub': light ? 'rgba(12,14,20,.58)' : 'rgba(240,244,255,.62)',
      '--sk-fill': light ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)',
      '--sk-fill2': light ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.13)',
      '--sk-field': light ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.22)',
      '--sk-pill': light ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.18)',
      '--sk-line': light ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.12)',
      '--sk-glow': t.textGlow ? (light ? '0 1px 1px rgba(255,255,255,.7)' : '0 1px 3px rgba(0,0,0,.6)') : 'none'
    };
  };
})();


// ===== content/ui.js =====
// Secret Keys v10 — the glass interface
(() => {
  'use strict';
  const SK = globalThis.SK;
  const h = SK.h;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const ui = (SK.ui = {
    host: null,
    root: null,
    panel: null,
    badge: null,
    view: 'shortcuts',
    isOpen: false,
    picking: false,
    modals: 0,
    lastEditable: null,
    lastSelection: '',
    search: '',
    scanned: []
  });
  Object.defineProperty(ui, 'busy', { get: () => ui.modals > 0 });

  // ---------- small building blocks ----------
  ui.kbd = (c, macro) => {
    const parts = SK.combo.parts(c);
    return h('span', { class: 'sk-kbd' + (macro ? ' macro' : '') + (parts.length ? '' : ' none') }, (parts.length ? parts : ['—']).map(p => h('span', null, p)));
  };
  const toggle = (checked, onChange) =>
    h('label', { class: 'sk-switch' }, h('input', { type: 'checkbox', checked: !!checked, onchange: e => onChange(e.target.checked) }), h('i'));
  const field = (label, control, hint) => h('div', { class: 'sk-field' }, h('label', null, label), control, hint && h('div', { class: 'sk-hint' }, hint));
  const empty = (icon, text) => h('div', { class: 'sk-empty' }, h('b', null, icon), text);
  const section = (title, right) => h('div', { class: 'sk-section' }, h('span', null, title), right || null);
  const settingRow = (label, control, meta) =>
    h('div', { class: 'sk-row' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, label), meta && h('div', { class: 'meta' }, meta)), control);

  ui.sheen = el =>
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    });

  function liquidFilter() {
    const ns = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };
    const svg = mk('svg', { width: '0', height: '0', 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;pointer-events:none' });
    const f = mk('filter', { id: 'sk-liquid', x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' });
    f.append(
      mk('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.007 0.011', numOctaves: '2', seed: '8', result: 'noise' }),
      mk('feGaussianBlur', { in: 'noise', stdDeviation: '2', result: 'soft' }),
      mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'soft', scale: '42', xChannelSelector: 'R', yChannelSelector: 'G' })
    );
    svg.append(f);
    return svg;
  }

  // ---------- mount ----------
  ui.mount = function () {
    const host = (this.host = h('div', { id: 'secret-keys-host' }));
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet(); // adopted sheets aren't blocked by site CSP
    sheet.replaceSync(SK.CSS);
    shadow.adoptedStyleSheets = [sheet];
    shadow.append(liquidFilter());
    this.root = h('div', { class: 'sk-root' });
    shadow.append(this.root);

    this.buildPanel();
    this.buildBadge();
    this.hl = h('div', { class: 'sk-hl' }, h('b'));
    this.toasts = h('div', { class: 'sk-toasts' });
    this.root.append(this.hl, this.toasts);

    // Keys typed inside our UI must not trigger the website's own shortcuts
    for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, e => e.stopPropagation());

    document.documentElement.append(host, liquidFilter());
    setInterval(() => {
      if (!host.isConnected && SK.alive()) document.documentElement.append(host);
    }, 2000);

    document.addEventListener(
      'focusin',
      e => {
        const path = e.composedPath();
        if (path.includes(host)) return;
        if (SK.isTextField(path[0])) this.lastEditable = path[0];
      },
      true
    );
    document.addEventListener('selectionchange', () => {
      if (this.busy) return;
      this.lastSelection = String(getSelection() || '');
    });
    addEventListener('resize', SK.debounce(() => (this.placePanel(), this.placeBadge()), 100));

    this.applySettings();
  };

  ui.applySettings = function () {
    const s = SK.store.data.settings;
    const t = s.theme;
    for (const [k, v] of Object.entries(SK.themeVars(t))) this.host.style.setProperty(k, v);
    this.root.dataset.tint = t.tint;
    this.root.classList.toggle('no-specular', !t.specular);
    this.root.classList.toggle('liquid', !!t.liquid);
    this.badge.classList.toggle('off', !s.enabled);
    this.placePanel();
    this.placeBadge();
  };

  // ---------- panel ----------
  ui.buildPanel = function () {
    const tabs = [
      ['shortcuts', 'Shortcuts'],
      ['macros', 'Macros'],
      ['style', 'Style']
    ];
    this.segBtns = tabs.map(([id, label]) => h('button', { dataset: { v: id }, onclick: () => this.setView(id) }, label));
    this.segPill = h('div', { class: 'sk-seg-pill' });
    this.body = h('div', { class: 'sk-body' });
    this.head = h(
      'div',
      { class: 'sk-head' },
      h('div', { class: 'sk-logo' }, '⌘'),
      h('div', { class: 'sk-title' }, 'Secret Keys', h('small', null, location.hostname || 'this page')),
      h('button', { class: 'sk-icon-btn', title: 'Command palette', onclick: () => SK.palette.open() }, '⌕'),
      h('button', { class: 'sk-icon-btn', title: 'Hide (Alt+Shift+K)', onclick: () => this.close() }, '×')
    );
    this.resizer = h('div', { class: 'sk-resize', title: 'Resize' });
    this.panel = h(
      'div',
      { class: 'sk-panel glass' },
      h('div', { class: 'sk-sheen' }),
      this.head,
      h('div', { class: 'sk-seg' }, this.segPill, this.segBtns),
      this.body,
      h(
        'div',
        { class: 'sk-foot' },
        h('button', { class: 'sk-link', onclick: () => this.exportData() }, 'Export'),
        h('span', null, 'Made by ', h('b', null, 'VEDANT')),
        h('button', { class: 'sk-link', onclick: () => this.importData() }, 'Import')
      ),
      this.resizer
    );
    this.root.append(this.panel);
    this.sheen(this.panel);

    this.makeDraggable(this.panel, this.head, {
      can: () => SK.store.data.settings.panel.dock === 'float',
      end: (x, y) => {
        Object.assign(SK.store.data.settings.panel, { x, y });
        SK.store.saveSettingsSoon();
      }
    });

    this.resizer.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      this.resizer.setPointerCapture(e.pointerId);
      const r = this.panel.getBoundingClientRect();
      const move = ev => {
        this.panel.style.width = clamp(ev.clientX - r.left, 300, innerWidth - r.left - 8) + 'px';
        this.panel.style.height = clamp(ev.clientY - r.top, 340, innerHeight - r.top - 8) + 'px';
      };
      const up = () => {
        this.resizer.removeEventListener('pointermove', move);
        this.resizer.removeEventListener('pointerup', up);
        const p = SK.store.data.settings.panel;
        p.width = parseFloat(this.panel.style.width);
        p.height = parseFloat(this.panel.style.height);
        SK.store.saveSettingsSoon();
      };
      this.resizer.addEventListener('pointermove', move);
      this.resizer.addEventListener('pointerup', up);
    });

    this.setView('shortcuts');
  };

  ui.makeDraggable = function (el, handle, { can = () => true, end, click } = {}) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, select, textarea, .sk-resize')) return;
      const dragOk = can();
      if (!dragOk && !click) return;
      const r = el.getBoundingClientRect();
      const ox = e.clientX - r.left,
        oy = e.clientY - r.top,
        sx = e.clientX,
        sy = e.clientY;
      let moved = false;
      handle.setPointerCapture(e.pointerId);
      const move = ev => {
        if (!dragOk) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true;
        el.style.left = clamp(ev.clientX - ox, 0, innerWidth - r.width) + 'px';
        el.style.top = clamp(ev.clientY - oy, 0, innerHeight - r.height) + 'px';
        el.style.right = el.style.bottom = 'auto';
      };
      const up = ev => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        if (moved) end && end(parseFloat(el.style.left), parseFloat(el.style.top));
        else if (click && ev.type === 'pointerup') click(ev);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  };

  ui.placePanel = function () {
    const p = SK.store.data.settings.panel;
    const el = this.panel;
    el.classList.toggle('dock-right', p.dock === 'right');
    el.classList.toggle('dock-left', p.dock === 'left');
    el.style.transformOrigin = p.dock === 'left' ? 'top left' : 'top right';
    const w = Math.min(p.width, innerWidth - 24);
    const ht = Math.min(p.height, innerHeight - 24);
    el.style.width = w + 'px';
    el.style.height = ht + 'px';
    el.style.right = el.style.bottom = 'auto';
    if (p.dock !== 'float') return;
    el.style.left = clamp(p.x ?? innerWidth - w - 20, 0, Math.max(0, innerWidth - w)) + 'px';
    el.style.top = clamp(p.y ?? 20, 0, Math.max(0, innerHeight - ht)) + 'px';
  };

  ui.open = function (view) {
    this.isOpen = true;
    this.placePanel();
    this.panel.classList.add('open');
    this.placeBadge();
    if (view && view !== this.view) this.setView(view);
    else this.renderView();
  };
  ui.close = function () {
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.highlight(null);
    this.placeBadge();
  };
  ui.toggle = function () {
    this.isOpen ? this.close() : this.open();
  };

  ui.setView = function (id) {
    this.view = id;
    const i = this.segBtns.findIndex(b => b.dataset.v === id);
    this.segBtns.forEach((b, j) => b.classList.toggle('active', j === i));
    this.segPill.style.width = `calc((100% - 6px) / ${this.segBtns.length})`;
    this.segPill.style.transform = `translateX(${i * 100}%)`;
    this.body.scrollTop = 0;
    this.renderView(true);
  };

  ui.renderView = function (animate) {
    if (!this.body) return;
    const st = this.body.scrollTop;
    const build = { shortcuts: this.viewShortcuts, macros: this.viewMacros, style: this.viewStyle }[this.view];
    this.body.replaceChildren(h('div', { class: 'sk-view' + (animate ? ' anim' : '') }, build.call(this)));
    if (!animate) this.body.scrollTop = st;
  };

  ui.onData = function (changed) {
    if (changed.includes('settings')) this.applySettings();
    // don't rebuild the Style tab while a slider is being dragged
    if (this.isOpen && !(this.view === 'style' && changed.length === 1 && changed[0] === 'settings')) this.renderView();
  };

  ui.removeItem = function (kind, item) {
    const list = SK.store.data[kind];
    const i = list.findIndex(x => x.id === item.id);
    if (i < 0) return;
    list.splice(i, 1);
    SK.store.save(kind);
    this.renderView();
    this.toast(`Deleted "${item.name}"`, {
      duration: 5000,
      action: {
        label: 'Undo',
        fn: () => {
          SK.store.data[kind].splice(i, 0, item);
          SK.store.save(kind);
          this.renderView();
        }
      }
    });
  };

  // ---------- Shortcuts tab ----------
  ui.viewShortcuts = function () {
    const s = SK.store.data.settings;
    const host = location.hostname;
    const list = SK.store.data.bindings.filter(b => b.domain === host);

    const disc = h('div', { class: 'sk-card' });
    const renderDisc = () => {
      if (!this.scanned.length) this.scanned = SK.scan();
      const q = this.search.toLowerCase().trim();
      const rows = this.scanned
        .filter(el => el.isConnected)
        .map(el => ({ el, label: SK.labelOf(el) }))
        .filter(x => !q || x.label.toLowerCase().includes(q) || x.el.tagName.toLowerCase() === q)
        .slice(0, 120);
      disc.replaceChildren(
        ...(rows.length
          ? rows.map(x =>
              h(
                'div',
                {
                  class: 'sk-row click',
                  onmouseenter: () => this.highlight(x.el, x.label),
                  onmouseleave: () => this.highlight(null),
                  onclick: () => this.openBindDialog(x.el)
                },
                h('div', { class: 'grow' }, h('div', { class: 'name' }, x.label)),
                h('span', { class: 'sk-chip' }, x.el.tagName.toLowerCase())
              )
            )
          : [empty('🔍', 'Nothing found on this page')])
      );
    };
    renderDisc();

    return [
      h(
        'div',
        { class: 'sk-card' },
        settingRow(
          'Shortcuts active',
          toggle(s.enabled, v => {
            s.enabled = v;
            SK.store.save('settings');
            this.applySettings();
          }),
          s.enabled ? 'Hotkeys and macros are on' : 'Everything is paused'
        )
      ),
      h('button', { class: 'sk-btn primary block', onclick: () => this.startPicking() }, '🎯  Pick element from page'),
      section(`On ${host || 'this page'}`, h('span', null, String(list.length))),
      list.length ? h('div', { class: 'sk-card' }, list.map(b => this.bindingRow(b))) : empty('⌨️', 'No shortcuts here yet. Pick an element, then press a key.'),
      section(
        'Discover',
        h(
          'button',
          {
            class: 'sk-link',
            onclick: () => {
              this.scanned = SK.scan();
              renderDisc();
              this.toast(`Found ${this.scanned.length} clickable things`);
            }
          },
          'Re-scan'
        )
      ),
      h('input', {
        class: 'sk-input',
        placeholder: 'Search buttons & links on this page…',
        value: this.search,
        oninput: e => {
          this.search = e.target.value;
          renderDisc();
        }
      }),
      disc
    ];
  };

  ui.bindingRow = function (b) {
    const found = SK.findTarget(b);
    return h(
      'div',
      {
        class: 'sk-row click' + (b.enabled ? '' : ' off'),
        onmouseenter: () => this.highlight(SK.findTarget(b), b.name),
        onmouseleave: () => this.highlight(null),
        onclick: e => {
          if (!e.target.closest('.sk-switch, .sk-x')) this.openBindDialog(null, b);
        }
      },
      toggle(b.enabled, v => {
        b.enabled = v;
        SK.store.save('bindings');
      }),
      h('div', { class: 'grow' }, h('div', { class: 'name' }, b.name), h('div', { class: 'meta' }, found ? b.selector : '⚠ Not on this page right now')),
      this.kbd(b),
      h('button', { class: 'sk-x', title: 'Delete', onclick: () => this.removeItem('bindings', b) }, '×')
    );
  };

  // ---------- Macros tab ----------
  const TEMPLATES = [
    { name: 'Search Google for selection', actionType: 'open_url', params: { url: 'https://www.google.com/search?q={{selection}}', newTab: true }, global: true },
    { name: 'Copy page as Markdown link', actionType: 'copy_text', params: { text: '[{{title}}]({{url}})' }, global: true },
    { name: "Insert today's date", actionType: 'insert_text', params: { text: '{{date}}', mode: 'cursor' }, global: true },
    { name: 'Email signature', actionType: 'insert_text', params: { text: 'Best regards,\nVedant', mode: 'cursor' }, global: true },
    { name: 'Video speed 1× / 2×', actionType: 'run_js', params: { code: 'document.querySelectorAll("video").forEach(v => v.playbackRate = v.playbackRate >= 2 ? 1 : 2)' }, global: true },
    { name: 'Close duplicate tabs', actionType: 'tab_action', params: { action: 'dedupe' }, global: true },
    { name: 'Translate this page', actionType: 'open_url', params: { url: 'https://translate.google.com/translate?sl=auto&tl=en&u={{url}}', newTab: true }, global: true },
    { name: 'Scroll to top', actionType: 'scroll_page', params: { position: 'Top' }, global: true }
  ];

  ui.viewMacros = function () {
    const host = location.hostname;
    const all = SK.store.data.macros;
    const list = all.filter(m => m.global || m.domain === host);
    const elsewhere = all.length - list.length;
    return [
      h('button', { class: 'sk-btn macro block', onclick: () => this.openMacroEditor() }, '＋  New macro'),
      section('My macros', h('span', null, String(list.length))),
      list.length ? h('div', { class: 'sk-card' }, list.map(m => this.macroRow(m))) : empty('⚡', 'No macros yet. Make one, or start from a template below.'),
      elsewhere ? h('div', { class: 'sk-hint', style: { textAlign: 'center' } }, `+ ${elsewhere} more macro${elsewhere > 1 ? 's' : ''} that only run on other sites`) : null,
      section('Start from a template'),
      h(
        'div',
        { class: 'sk-card' },
        TEMPLATES.map(t => {
          const def = SK.ACTIONS[t.actionType];
          return h(
            'div',
            { class: 'sk-row click', onclick: () => this.openMacroEditor(null, structuredClone(t)) },
            h('span', { class: 'sk-pal-icon' }, def.icon),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, t.name), h('div', { class: 'meta' }, def.label)),
            h('span', { class: 'sk-chip' }, 'Use')
          );
        })
      )
    ];
  };

  ui.macroRow = function (m) {
    const def = SK.ACTIONS[m.actionType];
    return h(
      'div',
      {
        class: 'sk-row click' + (m.enabled ? '' : ' off'),
        onclick: e => {
          if (!e.target.closest('.sk-switch, .sk-x, .sk-run')) this.openMacroEditor(m);
        }
      },
      toggle(m.enabled, v => {
        m.enabled = v;
        SK.store.save('macros');
      }),
      h(
        'div',
        { class: 'grow' },
        h('div', { class: 'name' }, m.name),
        h('div', { class: 'meta' }, `${def ? def.icon + ' ' + def.label : m.actionType} · ${m.global ? '🌍 All sites' : m.domain}`)
      ),
      m.key ? this.kbd(m, true) : h('span', { class: 'sk-chip' }, 'Palette'),
      h('button', { class: 'sk-x sk-run', title: 'Run now', style: { fontSize: '12px' }, onclick: () => SK.runMacro(m, { target: this.lastEditable }) }, '▶'),
      h('button', { class: 'sk-x', title: 'Delete', onclick: () => this.removeItem('macros', m) }, '×')
    );
  };

  // ---------- Style tab ----------
  ui.viewStyle = function () {
    const s = SK.store.data.settings;
    const t = s.theme;
    const out = [];
    const changed = () => {
      t.preset = 'custom';
      this.applySettings();
      SK.store.saveSettingsSoon();
    };

    out.push(section('Presets'));
    out.push(
      h(
        'div',
        { class: 'sk-presets' },
        Object.entries(SK.PRESETS).map(([id, p]) =>
          h(
            'button',
            {
              class: 'sk-preset' + (t.preset === id ? ' active' : ''),
              onclick: () => {
                const { label, ...vals } = p;
                Object.assign(t, vals, { preset: id });
                this.applySettings();
                SK.store.save('settings');
                this.renderView();
              }
            },
            h('i', {
              style: {
                background: `${p.tint === 'light' ? 'linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)),' : `linear-gradient(rgba(0,0,0,${p.opacity}),rgba(0,0,0,${p.opacity})),`} linear-gradient(135deg, ${p.accent}, ${p.macroAccent})`
              }
            }),
            p.label
          )
        )
      )
    );

    let card = null;
    for (const f of SK.THEME_SCHEMA) {
      if (f.group) {
        out.push(section(f.group));
        card = h('div', { class: 'sk-card' });
        out.push(card);
        continue;
      }
      if (f.type === 'range') {
        const o = h('output', null, f.fmt ? f.fmt(t[f.key]) : String(t[f.key]));
        const inp = h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: t[f.key] });
        const fill = () => inp.style.setProperty('--p', ((inp.value - f.min) / (f.max - f.min)) * 100 + '%');
        fill();
        inp.addEventListener('input', () => {
          t[f.key] = +inp.value;
          o.textContent = f.fmt ? f.fmt(+inp.value) : inp.value;
          fill();
          changed();
        });
        card.append(h('div', { class: 'sk-range' }, h('label', null, f.label), o, inp));
      } else if (f.type === 'toggle') {
        card.append(settingRow(f.label, toggle(t[f.key], v => ((t[f.key] = v), changed()))));
      } else if (f.type === 'select') {
        const sel = h('select', { class: 'sk-select', style: { width: '130px' } }, f.options.map(([v, l]) => h('option', { value: v }, l)));
        sel.value = t[f.key];
        sel.addEventListener('change', () => ((t[f.key] = sel.value), changed()));
        card.append(settingRow(f.label, sel));
      } else if (f.type === 'color') {
        const c = h('input', { type: 'color', class: 'sk-color', value: t[f.key] });
        c.addEventListener('input', () => ((t[f.key] = c.value), changed()));
        card.append(settingRow(f.label, c));
      }
    }

    // Layout & behavior
    out.push(section('Layout & behavior'));
    const dock = h('select', { class: 'sk-select', style: { width: '130px' } }, [['float', 'Floating'], ['right', 'Right sidebar'], ['left', 'Left sidebar']].map(([v, l]) => h('option', { value: v }, l)));
    dock.value = s.panel.dock;
    dock.addEventListener('change', () => {
      s.panel.dock = dock.value;
      this.placePanel();
      SK.store.save('settings');
    });
    const cap = this.keyCapture(s.paletteKey, c => {
      if (!c) return;
      s.paletteKey = c;
      SK.store.save('settings');
    });
    cap.style.minHeight = '44px';
    const jsStatus = h('div', { class: 'meta' }, 'Checking…');
    SK.bg({ type: 'userScriptsStatus' })
      .then(ok => (jsStatus.textContent = ok ? '✓ Works on every site' : SK.MODE === 'bookmarklet' ? 'Works on sites that allow it (install the extension for every site)' : 'Limited on strict sites — turn on “Allow user scripts” in chrome://extensions → Secret Keys → Details'))
      .catch(() => (jsStatus.textContent = 'Unknown'));

    out.push(
      h(
        'div',
        { class: 'sk-card' },
        settingRow('Panel position', dock),
        settingRow(
          'Floating pill',
          toggle(s.badge.show, v => {
            s.badge.show = v;
            this.placeBadge();
            SK.store.save('settings');
          }),
          'Shows when the panel is hidden'
        ),
        settingRow(
          'Ignore plain keys while typing',
          toggle(s.ignoreInInputs, v => {
            s.ignoreInInputs = v;
            SK.store.save('settings');
          }),
          'Hotkeys with Ctrl/Alt/Cmd still work in text boxes'
        ),
        h('div', { class: 'sk-row', style: { flexDirection: 'column', alignItems: 'stretch' } }, h('div', { class: 'name' }, 'Command palette hotkey (in page)'), cap),
        h(
          'div',
          { class: 'sk-row' },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, 'Browser-wide hotkeys'), h('div', { class: 'meta' }, SK.MODE === 'bookmarklet' ? 'Click your Secret Keys bookmark to show / hide the panel' : 'Alt+K palette · Alt+Shift+K panel — change at chrome://extensions/shortcuts'))
        ),
        h('div', { class: 'sk-row' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, 'Run JavaScript'), jsStatus))
      )
    );
    out.push(
      h(
        'button',
        {
          class: 'sk-btn block',
          onclick: () => {
            s.theme = structuredClone(SK.DEFAULT_SETTINGS.theme);
            this.applySettings();
            SK.store.save('settings');
            this.renderView();
            this.toast('Style reset');
          }
        },
        'Reset style to default'
      )
    );
    return out;
  };

  // ---------- modals ----------
  ui.modal = function (content, opts = {}) {
    this.modals++;
    const sheet = h('div', { class: 'sk-sheet glass ' + (opts.cls || '') }, h('div', { class: 'sk-sheen' }), content);
    const ov = h('div', { class: 'sk-overlay' + (opts.top ? ' top' : '') }, sheet);
    this.sheen(sheet);
    let closed = false;
    const onKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    const close = () => {
      if (closed) return;
      closed = true;
      this.modals--;
      document.removeEventListener('keydown', onKey, true);
      ov.classList.add('closing');
      setTimeout(() => ov.remove(), 180);
      opts.onClose && opts.onClose();
    };
    ov.addEventListener('pointerdown', e => {
      if (e.target === ov) close();
    });
    document.addEventListener('keydown', onKey, true);
    this.root.append(ov);
    return { close, sheet, ov };
  };

  ui.prompt = function (label) {
    return new Promise(resolve => {
      let done = false;
      const inp = h('input', { class: 'sk-input', placeholder: label });
      const ok = () => {
        done = true;
        m.close();
        resolve(inp.value);
      };
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ok();
        }
      });
      const m = this.modal(
        [
          h('h3', null, label),
          inp,
          h('div', { class: 'sk-btns' }, h('button', { class: 'sk-btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'sk-btn primary', onclick: ok }, 'OK'))
        ],
        { onClose: () => !done && resolve(null) }
      );
      setTimeout(() => inp.focus(), 40);
    });
  };

  ui.keyCapture = function (initial, onChange, opts = {}) {
    let combo = initial && initial.key ? { ...initial } : null;
    let listening = false;
    const el = h('div', { class: 'sk-capture' + (opts.macro ? ' macro' : ''), tabIndex: 0 });
    const show = () => el.replaceChildren(combo ? this.kbd(combo, opts.macro) : h('span', null, opts.empty || 'Click, then press your keys'));
    const stop = () => {
      listening = false;
      el.classList.remove('listening');
      removeEventListener('keydown', handler, true);
      show();
    };
    const handler = e => {
      if (!el.isConnected) return removeEventListener('keydown', handler, true);
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') return stop();
      if (opts.clearable && (e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        combo = null;
        onChange(null);
        return stop();
      }
      if (SK.MOD_KEYS.includes(e.key)) return;
      combo = SK.combo.fromEvent(e);
      onChange(combo);
      stop();
    };
    el.addEventListener('click', () => {
      if (listening) return;
      listening = true;
      el.classList.add('listening');
      el.replaceChildren(h('span', null, opts.clearable ? 'Press keys… (Esc cancel · ⌫ remove)' : 'Press keys… (Esc to cancel)'));
      addEventListener('keydown', handler, true);
    });
    show();
    return el;
  };

  ui.conflicts = function (c, exceptId) {
    if (!c || !c.key) return [];
    const host = location.hostname;
    const out = [];
    for (const b of SK.store.data.bindings) if (b.id !== exceptId && b.domain === host && SK.combo.same(b, c)) out.push(`shortcut “${b.name}”`);
    for (const m of SK.store.data.macros) if (m.id !== exceptId && (m.global || m.domain === host) && SK.combo.same(m, c)) out.push(`macro “${m.name}”`);
    if (SK.combo.same(SK.store.data.settings.paletteKey, c)) out.push('the command palette');
    return out;
  };

  const warnBox = () => h('div', { class: 'sk-warn', hidden: true });
  const updateWarn = (box, c, exceptId) => {
    const list = ui.conflicts(c, exceptId);
    box.hidden = !list.length;
    box.textContent = list.length ? `Already used by ${list.join(', ')}` : '';
  };

  ui.openBindDialog = function (el, existing) {
    const b = existing
      ? { ...existing }
      : { name: SK.labelOf(el), selector: SK.selectorFor(el), text: SK.labelOf(el), tag: el.tagName.toLowerCase(), domain: location.hostname };
    let combo = existing && existing.key ? { key: b.key, ctrl: b.ctrl, alt: b.alt, shift: b.shift, meta: b.meta } : null;
    this.highlight(el || SK.findTarget(b), b.name);

    const name = h('input', { class: 'sk-input', value: b.name });
    const sel = h('input', { class: 'sk-input', value: b.selector, spellcheck: false, style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.88em' } });
    const warn = warnBox();
    const cap = this.keyCapture(combo, c => {
      combo = c;
      updateWarn(warn, c, b.id);
    });
    updateWarn(warn, combo, b.id);

    const save = () => {
      if (!combo) return this.toast('Press a key combo first', { type: 'error' });
      const data = SK.store.normBinding({ ...b, ...combo, name: name.value.trim() || b.name, selector: sel.value.trim() || b.selector });
      const list = SK.store.data.bindings;
      const i = list.findIndex(x => x.id === data.id);
      i >= 0 ? (list[i] = data) : list.push(data);
      SK.store.save('bindings');
      m.close();
      this.renderView();
      this.toast(`${SK.combo.format(combo)} → ${data.name}`);
    };

    const m = this.modal(
      [
        h('h3', null, existing ? 'Edit shortcut' : 'New shortcut', h('small', null, location.hostname)),
        field('Name', name),
        field('Hotkey', cap, 'Add Ctrl / Alt / Cmd if you want it to work while typing too'),
        warn,
        field('Element (CSS selector)', sel),
        h('div', { class: 'sk-btns' }, h('button', { class: 'sk-btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'sk-btn primary', onclick: save }, 'Save'))
      ],
      { onClose: () => this.highlight(null) }
    );
    if (!existing) setTimeout(() => cap.click(), 60);
  };

  ui.openMacroEditor = function (existing, template) {
    const base = existing || template || {};
    let combo = base.key ? { key: base.key, ctrl: !!base.ctrl, alt: !!base.alt, shift: !!base.shift, meta: !!base.meta } : null;
    const name = h('input', { class: 'sk-input', value: base.name || '', placeholder: 'e.g. Quick reply, Open dashboard…' });
    const warn = warnBox();
    const cap = this.keyCapture(
      combo,
      c => {
        combo = c;
        updateWarn(warn, c, base.id);
      },
      { macro: true, clearable: true, empty: 'Click to set a hotkey (optional)' }
    );
    updateWarn(warn, combo, base.id);

    const typeSel = h('select', { class: 'sk-select' }, Object.entries(SK.ACTIONS).map(([k, a]) => h('option', { value: k }, `${a.icon}  ${a.label}`)));
    typeSel.value = base.actionType || 'insert_text';
    const desc = h('div', { class: 'sk-hint' });
    const fieldsBox = h('div', { class: 'sk-field', style: { gap: '14px' } });
    let getters = {};
    let m;

    const buildFields = () => {
      const def = SK.ACTIONS[typeSel.value];
      desc.textContent = def.desc;
      getters = {};
      const params = (typeSel.value === base.actionType && base.params) || {};
      fieldsBox.replaceChildren(
        ...def.fields.map(f => {
          let v = params[f.key];
          if (f.key === 'mode' && v === undefined && params.append !== undefined) v = params.append ? 'cursor' : 'replace';
          if (f.type === 'checkbox') {
            const sw = toggle(v === undefined ? !!f.default : !!v, () => {});
            const inp = sw.querySelector('input');
            getters[f.key] = () => inp.checked;
            return h('div', { class: 'sk-row', style: { padding: '2px' } }, h('div', { class: 'grow name' }, f.label), sw);
          }
          let ctl;
          if (f.type === 'select') {
            ctl = h('select', { class: 'sk-select' }, f.options.map(o => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));
            if (v !== undefined) ctl.value = v;
          } else if (f.type === 'textarea') {
            ctl = h('textarea', { class: 'sk-textarea' + (f.mono ? ' mono' : ''), placeholder: f.placeholder || '', spellcheck: !f.mono, value: v ?? '' });
          } else {
            ctl = h('input', { class: 'sk-input', type: f.type === 'number' ? 'number' : 'text', placeholder: f.placeholder || '', value: v ?? '' });
          }
          const input = ctl;
          getters[f.key] = () => input.value;
          if (f.pick) {
            const pickBtn = h(
              'button',
              {
                class: 'sk-btn small',
                title: 'Pick from page',
                onclick: () => {
                  m.ov.style.display = 'none';
                  this.startPicking(
                    el => {
                      input.value = SK.selectorFor(el);
                      m.ov.style.display = '';
                    },
                    () => (m.ov.style.display = '')
                  );
                }
              },
              '🎯 Pick'
            );
            ctl = h('div', { class: 'sk-inline' }, input, pickBtn);
          }
          return field(f.label, ctl, f.hint);
        })
      );
    };
    typeSel.addEventListener('change', buildFields);
    buildFields();

    const scope = toggle(base.global ?? false, () => {});
    const scopeInput = scope.querySelector('input');

    const collect = () => {
      const params = {};
      for (const [k, g] of Object.entries(getters)) params[k] = g();
      return SK.store.normMacro({
        id: existing && existing.id,
        name: name.value.trim() || 'Untitled macro',
        domain: (existing && existing.domain) || location.hostname,
        global: scopeInput.checked,
        actionType: typeSel.value,
        params,
        enabled: existing ? existing.enabled : true,
        ...(combo || { key: '' })
      });
    };
    const save = () => {
      if (!name.value.trim()) {
        name.focus();
        return this.toast('Give your macro a name', { type: 'error' });
      }
      const mac = collect();
      const list = SK.store.data.macros;
      const i = list.findIndex(x => x.id === mac.id);
      i >= 0 ? (list[i] = mac) : list.push(mac);
      SK.store.save('macros');
      m.close();
      this.renderView();
      this.toast(combo ? `Saved — press ${SK.combo.format(combo)}` : `Saved — run it from the palette (${SK.combo.format(SK.store.data.settings.paletteKey)})`, { accent: 'macro' });
    };

    m = this.modal([
      h('h3', null, existing ? 'Edit macro' : 'New macro', h('small', null, 'Automate anything with one key')),
      field('Name', name),
      field('Hotkey', cap),
      warn,
      field('Action', typeSel, null),
      desc,
      fieldsBox,
      h('div', { class: 'sk-card' }, settingRow('Works on all sites', scope, `Off = only on ${(existing && existing.domain) || location.hostname}`)),
      h(
        'div',
        { class: 'sk-btns' },
        h('button', { class: 'sk-btn', onclick: () => m.close() }, 'Cancel'),
        h('button', { class: 'sk-btn', title: 'Try it without saving', onclick: () => SK.runMacro(collect(), { target: this.lastEditable }) }, '▶ Test'),
        h('button', { class: 'sk-btn macro', onclick: save }, 'Save')
      )
    ]);
    if (!existing) setTimeout(() => name.focus(), 40);
  };

  // ---------- picking ----------
  ui.startPicking = function (onPick, onCancel) {
    if (this.picking) return;
    this.picking = true;
    this.panel.classList.add('picking');
    const tip = this.toast('Click any element to select it · Esc to cancel', { duration: 10 * 60 * 1000 });
    const realTarget = e => {
      const p = e.composedPath();
      return p.includes(this.host) ? null : SK.pickable(p[0]);
    };
    const move = e => {
      const el = realTarget(e);
      this.highlight(el, el ? SK.labelOf(el) : '');
    };
    const block = e => {
      if (e.composedPath().includes(this.host)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const click = e => {
      if (e.composedPath().includes(this.host)) return;
      block(e);
      const el = realTarget(e);
      if (!el) return;
      stop();
      (onPick || (x => this.openBindDialog(x)))(el);
    };
    const key = e => {
      if (e.key !== 'Escape') return;
      block(e);
      stop();
      onCancel && onCancel();
    };
    const evs = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick', 'dblclick'];
    const stop = () => {
      this.picking = false;
      this.panel.classList.remove('picking');
      tip.dismiss();
      this.highlight(null);
      removeEventListener('pointermove', move, true);
      evs.forEach(ev => removeEventListener(ev, block, true));
      removeEventListener('click', click, true);
      removeEventListener('keydown', key, true);
    };
    addEventListener('pointermove', move, true);
    evs.forEach(ev => addEventListener(ev, block, true));
    addEventListener('click', click, true);
    addEventListener('keydown', key, true);
  };

  // ---------- floating pill ----------
  ui.buildBadge = function () {
    this.badge = h(
      'div',
      { class: 'sk-badge glass', title: 'Secret Keys — click to open, drag to move' },
      h('div', { class: 'sk-sheen' }),
      h('span', { class: 'dot' }, '⌘'),
      h('span', null, 'Keys')
    );
    this.root.append(this.badge);
    this.sheen(this.badge);
    this.makeDraggable(this.badge, this.badge, {
      end: (x, y) => {
        Object.assign(SK.store.data.settings.badge, { x, y });
        SK.store.saveSettingsSoon();
      },
      click: () => this.open()
    });
  };

  ui.placeBadge = function () {
    const b = SK.store.data.settings.badge;
    const el = this.badge;
    el.hidden = this.isOpen || !b.show;
    if (b.x != null) {
      el.style.left = clamp(b.x, 0, innerWidth - (el.offsetWidth || 90)) + 'px';
      el.style.top = clamp(b.y, 0, innerHeight - (el.offsetHeight || 40)) + 'px';
      el.style.right = el.style.bottom = 'auto';
    } else {
      el.style.left = el.style.top = 'auto';
      el.style.right = el.style.bottom = '22px';
    }
  };

  // ---------- feedback ----------
  ui.highlight = function (el, label) {
    const hl = this.hl;
    if (!hl) return;
    if (!el || !el.getBoundingClientRect) {
      hl.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, { display: 'block', left: r.left - 3 + 'px', top: r.top - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
    const tag = hl.firstChild;
    tag.textContent = label || '';
    tag.hidden = !label;
    tag.style.top = r.top < 34 ? r.height + 12 + 'px' : '-26px';
  };

  ui.flash = function (el) {
    if (!el || !el.getBoundingClientRect || !this.root) return;
    const r = el.getBoundingClientRect();
    const f = h('div', { class: 'sk-flash', style: { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' } });
    this.root.append(f);
    const a = f.animate([{ opacity: 0.55, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.15)' }], { duration: 450, easing: 'ease-out' });
    a.onfinish = () => f.remove();
  };

  ui.toast = function (msg, o = {}) {
    if (!this.toasts) return { dismiss() {} };
    const el = h(
      'div',
      { class: `sk-toast glass ${o.type || ''} ${o.accent || ''}` },
      h('div', { class: 'sk-sheen' }),
      h('span', { class: 'bolt' }, o.type === 'error' ? '⚠' : '⚡'),
      h('span', null, msg)
    );
    let timer;
    const dismiss = () => {
      clearTimeout(timer);
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    };
    if (o.action)
      el.append(
        h(
          'button',
          {
            onclick: () => {
              o.action.fn();
              dismiss();
            }
          },
          o.action.label
        )
      );
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    timer = setTimeout(dismiss, o.duration || 2200);
    return { dismiss };
  };

  // ---------- backup ----------
  ui.exportData = function () {
    const blob = new Blob([SK.store.exportJSON()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `secret-keys-backup-${new Date().toISOString().slice(0, 10)}.json`, style: { display: 'none' } });
    document.documentElement.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.toast('Backup downloaded');
  };

  ui.importData = function () {
    const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.remove();
      if (!file) return;
      try {
        const n = await SK.store.importJSON(await file.text());
        this.applySettings();
        this.renderView();
        this.toast(`Imported ${n} item${n === 1 ? '' : 's'}`);
      } catch (e) {
        this.toast('Import failed: ' + e.message, { type: 'error' });
      }
    });
    document.documentElement.append(input);
    input.click();
  };
})();


// ===== content/palette.js =====
// Secret Keys v10 — command palette (Alt+K anywhere, or Ctrl/Cmd+K in the page)
(() => {
  'use strict';
  const SK = globalThis.SK;
  const h = SK.h;

  // Substring match wins; otherwise letters in order (fuzzy)
  const score = (q, text) => {
    if (!q) return 1;
    text = text.toLowerCase();
    const i = text.indexOf(q);
    if (i >= 0) return 200 - i + (i === 0 || text[i - 1] === ' ' ? 60 : 0);
    let ti = 0,
      s = 0;
    for (const ch of q) {
      const f = text.indexOf(ch, ti);
      if (f < 0) return 0;
      s += f === ti ? 3 : 1;
      ti = f + 1;
    }
    return s;
  };

  const host = u => {
    try {
      return new URL(u).hostname;
    } catch {
      return u;
    }
  };

  const TAB_CMDS = [
    ['new', '🆕', 'New tab'],
    ['duplicate', '📑', 'Duplicate tab'],
    ['pin', '📌', 'Pin / unpin tab'],
    ['mute', '🔇', 'Mute / unmute tab'],
    ['dedupe', '🧹', 'Close duplicate tabs'],
    ['bookmark', '⭐', 'Bookmark this page'],
    ['reload', '🔄', 'Reload page'],
    ['close', '✖️', 'Close tab']
  ];

  const P = (SK.palette = { m: null });

  P.toggle = () => (P.m ? P.m.close() : P.open());

  P.open = function () {
    if (this.m) return;
    const ui = SK.ui;
    const s = SK.store.data.settings;
    const active = SK.deepActive();
    const ctx = { target: SK.isTextField(active) && active.getRootNode() !== ui.host.shadowRoot ? active : ui.lastEditable };
    const here = location.hostname;

    const commands = () => [
      { icon: '🎛️', title: ui.isOpen ? 'Hide panel' : 'Show panel', sub: 'Secret Keys', run: () => ui.toggle() },
      { icon: '🎯', title: 'Pick element & bind a key', sub: 'Secret Keys', run: () => ui.startPicking() },
      { icon: '⚡', title: 'New macro', sub: 'Secret Keys', run: () => ui.openMacroEditor() },
      { icon: '🎨', title: 'Customize look & feel', sub: 'Secret Keys', run: () => ui.open('style') },
      {
        icon: s.enabled ? '⏸️' : '▶️',
        title: s.enabled ? 'Pause all hotkeys' : 'Resume all hotkeys',
        sub: 'Secret Keys',
        run: () => {
          s.enabled = !s.enabled;
          SK.store.save('settings');
          ui.applySettings();
          ui.toast(s.enabled ? 'Hotkeys on' : 'Hotkeys paused');
        }
      },
      { icon: '🔗', title: 'Copy page as Markdown link', sub: 'Page', run: async () => (await SK.copy(`[${document.title}](${location.href})`), ui.toast('Copied')) },
      { icon: '📋', title: 'Copy page URL', sub: 'Page', run: async () => (await SK.copy(location.href), ui.toast('Copied')) },
      { icon: '⬆️', title: 'Scroll to top', sub: 'Page', run: () => scrollTo({ top: 0, behavior: 'smooth' }) },
      { icon: '⬇️', title: 'Scroll to bottom', sub: 'Page', run: () => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }) },
      ...TAB_CMDS.filter(([a]) => SK.MODE !== 'bookmarklet' || ['new', 'duplicate', 'reload'].includes(a)).map(([action, icon, title]) => ({
        icon,
        title,
        sub: 'Tabs',
        run: async () => {
          try {
            const r = await SK.bg({ type: 'tab', action });
            if (action !== 'close' && action !== 'reload') ui.toast(r);
          } catch (e) {
            ui.toast(e.message, { type: 'error' });
          }
        }
      })),
      { icon: '💾', title: 'Export backup', sub: 'Data', run: () => ui.exportData() },
      { icon: '📥', title: 'Import backup', sub: 'Data', run: () => ui.importData() }
    ];

    const macroItems = SK.store.data.macros
      .filter(m => m.enabled && (m.global || m.domain === here))
      .map(m => {
        const def = SK.ACTIONS[m.actionType] || {};
        return { icon: def.icon || '⚡', title: m.name, sub: def.label, kbd: m.key ? m : null, macro: true, run: () => SK.runMacro(m, ctx) };
      });

    const bindingItems = SK.store.data.bindings
      .filter(b => b.enabled && b.domain === here)
      .map(b => ({
        icon: '⌨️',
        title: b.name,
        sub: 'Click on page',
        kbd: b,
        run: () => {
          const el = SK.findTarget(b);
          el ? SK.engine.fire(b, el) : ui.toast('That element is not on this page', { type: 'error' });
        }
      }));

    let tabItems = [];
    let bookmarkItems = [];
    let items = [];
    let activeIdx = 0;
    let rows = [];

    const input = h('input', { class: 'sk-pal-input', placeholder: 'Search macros, shortcuts, tabs, bookmarks…', spellcheck: false });
    const list = h('div', { class: 'sk-pal-list' });
    const tip = (k, t) => h('span', null, h('b', null, k), ' ', t);
    const foot = h('div', { class: 'sk-pal-foot' }, tip('↑↓', 'move'), tip('↵', 'run'), tip('>', 'commands'), tip('!', 'macros'), tip('@', 'tabs'), tip('*', 'bookmarks'), tip('Esc', 'close'));

    const paint = () => {
      rows.forEach((r, i) => r.classList.toggle('active', i === activeIdx));
      const r = rows[activeIdx];
      if (r) r.scrollIntoView({ block: 'nearest' });
    };

    const runItem = it => {
      this.m.close();
      setTimeout(() => {
        try {
          const p = it.run();
          if (p && p.catch) p.catch(e => ui.toast(e.message, { type: 'error' }));
        } catch (e) {
          ui.toast(e.message, { type: 'error' });
        }
      }, 40);
    };

    const parse = () => {
      let q = input.value;
      let mode = null;
      if (/^[>@*!]/.test(q)) {
        mode = q[0];
        q = q.slice(1);
      }
      return { q: q.trim().toLowerCase(), raw: q.trim(), mode };
    };

    const render = (keepActive = false) => {
      const { q, raw, mode } = parse();
      const groups = [];
      const add = (name, arr, limit) => {
        let scored = arr.map(it => ({ it, s: score(q, it.title + ' ' + (it.sub || '')) })).filter(x => x.s > 0);
        if (q) scored.sort((a, b) => b.s - a.s);
        scored = scored.slice(0, limit);
        if (scored.length) groups.push([name, scored.map(x => x.it)]);
      };
      if (!mode || mode === '!') add('Macros', macroItems, q ? 8 : 30);
      if (!mode) add('Shortcuts on this site', bindingItems, q ? 6 : 30);
      if (!mode || mode === '>') add('Commands', commands(), q || mode ? 12 : 30);
      if (mode === '@' || (!mode && q)) add('Open tabs', tabItems, mode ? 50 : 6);
      if (mode === '*' || (!mode && q.length >= 2)) add('Bookmarks', bookmarkItems, mode ? 30 : 6);
      if (!mode && raw) {
        const looksUrl = /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(raw) || /^https?:\/\//i.test(raw);
        groups.push([
          'Web',
          [
            looksUrl
              ? { icon: '🌐', title: `Open ${raw}`, sub: 'New tab', run: () => SK.bg({ type: 'openUrl', url: /^https?:/i.test(raw) ? raw : 'https://' + raw, newTab: true }) }
              : { icon: '🔎', title: `Search the web for “${raw}”`, sub: 'Google', run: () => SK.bg({ type: 'openUrl', url: 'https://www.google.com/search?q=' + encodeURIComponent(raw), newTab: true }) }
          ]
        ]);
      }

      items = groups.flatMap(g => g[1]);
      if (!keepActive) activeIdx = 0;
      activeIdx = Math.min(activeIdx, Math.max(0, items.length - 1));
      rows = [];
      let i = 0;
      const nodes = [];
      for (const [name, arr] of groups) {
        nodes.push(h('div', { class: 'sk-pal-group' }, name));
        for (const it of arr) {
          const idx = i++;
          const row = h(
            'div',
            {
              class: 'sk-pal-item',
              onmousemove: () => {
                if (activeIdx !== idx) {
                  activeIdx = idx;
                  paint();
                }
              },
              onclick: () => runItem(it)
            },
            h('div', { class: 'sk-pal-icon' }, it.icon),
            h('div', { class: 'sk-pal-text' }, h('div', { class: 'sk-pal-title' }, it.title), it.sub ? h('div', { class: 'sk-pal-sub' }, it.sub) : null),
            it.kbd ? ui.kbd(it.kbd, it.macro) : null
          );
          rows.push(row);
          nodes.push(row);
        }
      }
      list.replaceChildren(...(nodes.length ? nodes : [h('div', { class: 'sk-empty' }, h('b', null, '🤷'), 'Nothing matches')]));
      paint();
    };

    const fetchBookmarks = SK.debounce(() => {
      const { raw, mode } = parse();
      if (!(mode === '*' || raw.length >= 2) || (mode && mode !== '*')) return;
      SK.bg({ type: 'searchBookmarks', query: raw })
        .then(bs => {
          bookmarkItems = bs.map(b => ({ icon: '⭐', title: b.title || b.url, sub: host(b.url), run: () => SK.bg({ type: 'openUrl', url: b.url, newTab: true }) }));
          if (this.m) render(true);
        })
        .catch(() => {});
    }, 140);

    input.addEventListener('input', () => {
      render();
      fetchBookmarks();
    });
    input.addEventListener('keydown', e => {
      if (SK.combo.matches(s.paletteKey, e)) {
        e.preventDefault();
        return this.m.close();
      }
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % Math.max(1, items.length);
        paint();
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        activeIdx = (activeIdx - 1 + items.length) % Math.max(1, items.length);
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[activeIdx]) runItem(items[activeIdx]);
      }
    });

    this.m = ui.modal([h('div', { class: 'sk-pal-head' }, h('span', { class: 'glyph' }, '⌘'), input), list, foot], {
      top: true,
      cls: 'sk-pal',
      onClose: () => (this.m = null)
    });
    render();
    setTimeout(() => input.focus(), 20);

    SK.bg({ type: 'listTabs' })
      .then(tabs => {
        tabItems = tabs
          .filter(t => !t.active)
          .map(t => ({ icon: '🗂️', title: t.title || t.url, sub: host(t.url), run: () => SK.bg({ type: 'switchTab', id: t.id, windowId: t.windowId }) }));
        if (this.m) render(true);
      })
      .catch(() => {});
  };
})();


// ===== content/main.js =====
// Secret Keys v10 — hotkey engine + startup
(() => {
  'use strict';
  const SK = globalThis.SK;

  SK.engine = {
    start() {
      this.onKey = this.onKey.bind(this);
      addEventListener('keydown', this.onKey, true);
    },
    stop() {
      removeEventListener('keydown', this.onKey, true);
    },

    onKey(e) {
      if (!SK.alive()) return this.stop(); // extension was reloaded; this old copy retires
      if (e.isComposing || SK.ui.busy || SK.ui.picking || SK.MOD_KEYS.includes(e.key)) return;
      const s = SK.store.data.settings;

      if (SK.combo.matches(s.paletteKey, e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        SK.palette.open();
        return;
      }
      if (!s.enabled) return;
      if (e.composedPath().includes(SK.ui.host)) return; // typing inside our own UI

      const active = SK.deepActive();
      const hasMod = e.ctrlKey || e.altKey || e.metaKey;
      if (s.ignoreInInputs && SK.isEditable(active) && !hasMod) return; // let people type normally

      const here = location.hostname;
      const b = SK.store.data.bindings.find(x => x.enabled && x.domain === here && SK.combo.matches(x, e));
      const el = b && SK.findTarget(b);
      const ms = b && el ? [] : SK.store.data.macros.filter(x => x.enabled && x.key && SK.combo.matches(x, e));
      const m = ms.find(x => !x.global && x.domain === here) || ms.find(x => x.global);
      if (!el && !m) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return; // holding a key down shouldn't fire 30 times

      if (el) this.fire(b, el);
      else SK.runMacro(m, { target: SK.isTextField(active) ? active : SK.ui.lastEditable });
    },

    fire(b, el) {
      SK.ui.flash(el);
      if (SK.isTextField(el)) el.focus();
      else el.click();
    }
  };

  (async () => {
    if (window.top !== window) return;
    document.querySelectorAll('#secret-keys-host').forEach(n => n.remove()); // old copy after an update
    try {
      await SK.store.load();
    } catch (e) {
      console.warn('[Secret Keys] could not load storage', e);
      return;
    }
    const migrated = await SK.store.migrateV9();
    SK.ui.mount();
    SK.engine.start();
    SK.store.on(changed => SK.ui.onData(changed));
    chrome.runtime.onMessage.addListener(msg => {
      if (msg.type === 'togglePanel') SK.ui.toggle();
      else if (msg.type === 'openPalette') SK.palette.toggle();
    });

    if (migrated) SK.ui.toast(`Moved ${migrated} item${migrated > 1 ? 's' : ''} over from v9 ✨`, { duration: 4500 });
    const { welcomed } = await chrome.storage.local.get('welcomed');
    if (!welcomed) {
      chrome.storage.local.set({ welcomed: true });
      SK.ui.toast(`Secret Keys is ready — press ${SK.MODE === 'bookmarklet' ? SK.combo.format(SK.store.data.settings.paletteKey) : 'Alt+K'} for the command palette`, { duration: 6000 });
    }
    if (SK.MODE === 'bookmarklet') SK.ui.open(); // you clicked the bookmark — show it
    console.log('%c⌘ Secret Keys v10', 'color:#0A84FF;font-weight:800', '— made by VEDANT');
  })();
})();


window.__SK_BM__ = () => globalThis.SK.ui && globalThis.SK.ui.toggle();
})();
