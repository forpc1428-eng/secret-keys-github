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
    const raw = el.getAttribute('aria-label') || el.innerText || el.textContent || el.title || el.value || el.getAttribute('alt') || el.placeholder || el.getAttribute('name') || '';
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
