// Secret Keys — "show everything": letter tags on every button / link / field you can see
(() => {
  'use strict';
  const SK = globalThis.SK;
  const h = SK.h;
  const ALPHA = 'asdfghjklqwertyuiopzxcvbnm';

  SK.kindOf = el => (el.matches('a[href]') ? 'link' : SK.isEditable(el) ? 'input' : 'button');
  SK.KIND_ICON = { link: '🔗', button: '🔘', input: '✏️' };

  // All clickable things on the page (outermost only, so a button inside a link isn't counted twice)
  SK.pageItems = ({ viewportOnly = false, limit = 1500 } = {}) => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(SK.INTERACTIVE)) {
      if (out.length >= limit) break;
      if (el.closest('#secret-keys-host')) continue;
      const parent = el.parentElement && el.parentElement.closest(SK.INTERACTIVE);
      if (parent && seen.has(parent)) continue;
      if (!SK.visible(el)) continue;
      if (viewportOnly) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      }
      seen.add(el);
      out.push(el);
    }
    return out;
  };

  SK.hints = {
    active: false,
    _stop: null,

    toggle(opts) {
      this.active ? this.stop() : this.start(opts);
    },

    start({ newTab = false } = {}) {
      if (this.active) return;
      const ui = SK.ui;
      const els = SK.pageItems({ viewportOnly: true, limit: 676 });
      if (!els.length) return ui.toast('No buttons or links on screen', { type: 'error' });

      const two = els.length > ALPHA.length;
      const items = [];
      const layer = h('div', { class: 'sk-hints' });
      els.forEach((el, i) => {
        const label = two ? ALPHA[Math.floor(i / 26)] + ALPHA[i % 26] : ALPHA[i];
        const r = el.getBoundingClientRect();
        const kind = SK.kindOf(el);
        const chip = h('span', {
          class: 'sk-tag ' + kind,
          title: SK.labelOf(el),
          style: { left: Math.max(2, r.left) + 'px', top: Math.max(2, r.top) + 'px', animationDelay: Math.min(i * 4, 200) + 'ms' },
          onpointerdown: e => {
            e.preventDefault();
            e.stopPropagation();
            finish(items[i], e.shiftKey);
          }
        }, label.toUpperCase());
        layer.append(chip);
        items.push({ el, label, chip, kind });
      });

      const ui_wasOpen = ui.isOpen;
      if (ui_wasOpen) ui.panel.classList.add('picking');
      ui.root.append(layer);
      ui.modals++;
      this.active = true;
      const tip = ui.toast(`${els.length} on screen · type the letters${newTab ? ' · links open in a new tab' : ' · Shift = new tab'} · Esc to close`, { duration: 10 * 60 * 1000 });
      let typed = '';

      const paint = () => {
        for (const it of items) {
          const ok = it.label.startsWith(typed);
          it.chip.hidden = !ok;
          it.chip.replaceChildren(h('b', null, it.label.slice(0, typed.length).toUpperCase()), it.label.slice(typed.length).toUpperCase());
        }
      };

      const finish = (it, shift) => {
        this.stop();
        const el = it.el;
        SK.ui.flash(el);
        if ((newTab || shift) && el.href) {
          SK.bg({ type: 'openUrl', url: el.href, newTab: true }).catch(() => window.open(el.href, '_blank', 'noopener'));
        } else if (it.kind === 'input') {
          el.focus();
        } else {
          el.click();
        }
      };

      const onKey = e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (SK.MOD_KEYS.includes(e.key)) return;
        if (e.key === 'Escape') return this.stop();
        if (e.key === 'Backspace') {
          typed = typed.slice(0, -1);
          return paint();
        }
        const k = SK.combo.keyOf(e);
        if (k.length !== 1 || !ALPHA.includes(k)) return;
        const next = typed + k;
        const matches = items.filter(it => it.label.startsWith(next));
        if (!matches.length) return;
        typed = next;
        if (matches.length === 1 && matches[0].label === typed) return finish(matches[0], e.shiftKey);
        paint();
      };
      const cancel = () => this.stop();
      const onPointer = e => {
        if (!e.composedPath().includes(ui.host)) this.stop();
      };

      addEventListener('keydown', onKey, true);
      addEventListener('scroll', cancel, true);
      addEventListener('resize', cancel);
      addEventListener('pointerdown', onPointer, true);

      this._stop = () => {
        removeEventListener('keydown', onKey, true);
        removeEventListener('scroll', cancel, true);
        removeEventListener('resize', cancel);
        removeEventListener('pointerdown', onPointer, true);
        layer.classList.add('out');
        setTimeout(() => layer.remove(), 160);
        tip.dismiss();
        ui.panel.classList.remove('picking');
        ui.modals--;
        this.active = false;
      };
    },

    stop() {
      const s = this._stop;
      this._stop = null;
      if (s) s();
    }
  };
})();
