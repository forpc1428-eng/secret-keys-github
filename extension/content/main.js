// Secret Keys v10 — hotkey engine + startup
(() => {
  'use strict';
  const SK = globalThis.SK;
  // Only one copy may run per page: the newest one to start wins, older copies retire.
  const OWNER = SK.uid();
  const isOwner = () => document.documentElement.dataset.skOwner === OWNER;
  document.documentElement.dataset.skOwner = OWNER;

  SK.engine = {
    start() {
      this.onKey = this.onKey.bind(this);
      addEventListener('keydown', this.onKey, true);
    },
    stop() {
      removeEventListener('keydown', this.onKey, true);
    },

    onKey(e) {
      if (!SK.alive() || !isOwner()) return this.stop(); // extension was reloaded / a newer copy took over
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

      const hintNew = SK.combo.matches(s.hintNewTabKey, e);
      if (hintNew || SK.combo.matches(s.hintKey, e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) SK.hints.start({ newTab: hintNew });
        return;
      }

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
    try {
      await SK.store.load();
    } catch (e) {
      console.warn('[Secret Keys] could not load storage', e);
      return;
    }
    if (!isOwner()) return; // a newer copy started while we were loading
    document.querySelectorAll('#secret-keys-host').forEach(n => n.remove()); // old copy after an update
    const migrated = await SK.store.migrateV9();
    SK.ui.mount();
    SK.engine.start();
    SK.catcher.start();
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
