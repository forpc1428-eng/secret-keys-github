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
    hintKey: { key: 'j', alt: true, ctrl: false, meta: false, shift: false },
    hintNewTabKey: { key: 'j', alt: true, shift: true, ctrl: false, meta: false },
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
