// Secret Keys — find links you can't see: hidden menus, links that appear after a click, widgets, frames, page code
(() => {
  'use strict';
  const SK = globalThis.SK;
  const h = SK.h;

  const okUrl = u => !!u && !/^(javascript|data|blob):/i.test(u);
  const resolve = u => {
    try {
      return new URL(u, location.href).href;
    } catch {
      return '';
    }
  };
  const short = t => (t || '').replace(/\s+/g, ' ').trim().slice(0, 40);

  // Every document we can read: the page, open shadow roots (widgets), same-site iframes
  SK.allRoots = () => {
    const roots = [];
    const walk = (root, kind) => {
      roots.push({ root, kind });
      let n = 0;
      for (const el of root.querySelectorAll('*')) {
        if (++n > 20000) break;
        if (el.shadowRoot && el.id !== 'secret-keys-host') walk(el.shadowRoot, 'widget');
      }
    };
    walk(document, 'page');
    for (const f of document.querySelectorAll('iframe')) {
      try {
        if (f.contentDocument && f.contentDocument.documentElement) walk(f.contentDocument, 'frame');
      } catch {}
    }
    return roots;
  };

  // ---------- Link catcher: remembers every link that shows up while you browse ----------
  SK.catcher = {
    map: new Map(), // url -> { url, label, source, trigger, triggerSel, time }
    lastClick: null,

    add(a, extra = {}) {
      const url = a.href && String(a.href);
      if (!okUrl(url) || this.map.size > 3000) return;
      const prev = this.map.get(url);
      if (prev) {
        if (!prev.trigger && extra.trigger) Object.assign(prev, extra);
        return;
      }
      this.map.set(url, { url, label: SK.labelOf(a), time: Date.now(), source: 'appeared', ...extra });
    },

    start() {
      // remember what you clicked, so we can say "appeared after clicking X"
      document.addEventListener(
        'click',
        e => {
          const p = e.composedPath();
          if (p.includes(SK.ui.host)) return;
          const t = SK.pickable(p[0]);
          if (t) this.lastClick = { el: t, label: short(SK.labelOf(t)), sel: SK.selectorFor(t), time: Date.now() };
        },
        true
      );
      let pending = [];
      let timer = null;
      const flush = () => {
        timer = null;
        const nodes = pending;
        pending = [];
        const lc = this.lastClick && Date.now() - this.lastClick.time < 2500 ? this.lastClick : null;
        const extra = SK.explore.current || (lc ? { trigger: lc.label, triggerSel: lc.sel } : {});
        for (const n of nodes) {
          if (!n.isConnected || n.closest('#secret-keys-host')) continue;
          if (n.matches('a[href]')) this.add(n, extra);
          for (const a of n.querySelectorAll('a[href]')) this.add(a, extra);
        }
      };
      new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) pending.push(n);
        if (pending.length && !timer) timer = setTimeout(flush, 250);
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  };

  // ---------- Links you can't see right now ----------
  SK.hiddenLinks = visibleUrls => {
    const out = new Map();
    const add = (url, entry) => {
      if (!okUrl(url) || visibleUrls.has(url) || out.has(url)) return;
      out.set(url, { kind: 'link', hidden: true, url, ...entry });
    };

    for (const { root, kind } of SK.allRoots()) {
      for (const a of root.querySelectorAll('a[href]')) {
        if (a.closest && a.closest('#secret-keys-host')) continue;
        const caught = SK.catcher.map.get(a.href);
        const vis = SK.visible(a);
        if (kind === 'page' && vis) continue;
        add(a.href, {
          el: a,
          label: SK.labelOf(a),
          source: kind === 'page' ? (caught && caught.trigger ? 'menu' : 'hidden') : kind,
          trigger: caught && caught.trigger,
          triggerSel: caught && caught.triggerSel
        });
      }
    }

    // links that only live in code: data-href, data-url, onclick="location=…"
    for (const el of document.querySelectorAll('[data-href],[data-url],[data-link],[onclick*="location"],[onclick*="open("],[onclick*="href"]')) {
      if (el.closest('#secret-keys-host')) continue;
      let raw = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
      if (!raw) {
        const m = (el.getAttribute('onclick') || '').match(/['"`]((?:https?:\/\/|\/)[^'"`\s]+)['"`]/);
        raw = m && m[1];
      }
      if (raw) add(resolve(raw), { el, label: SK.labelOf(el), source: 'code' });
    }

    // links that appeared earlier and are gone now
    for (const c of SK.catcher.map.values()) {
      if (!out.has(c.url) && !visibleUrls.has(c.url)) add(c.url, { label: c.label, source: c.trigger ? 'menu' : 'gone', trigger: c.trigger, triggerSel: c.triggerSel });
    }
    return [...out.values()];
  };

  SK.SOURCE_TEXT = {
    hidden: () => 'Hidden on the page',
    menu: e => `Inside “${e.trigger}”`,
    gone: () => 'Appeared earlier',
    widget: () => 'Inside a widget',
    frame: () => 'Inside a frame',
    code: () => 'In page code'
  };

  // Every link URL we know about: visible, hidden, caught, in code
  SK.allLinks = () => {
    const urls = new Set();
    for (const { root } of SK.allRoots()) for (const a of root.querySelectorAll('a[href]')) if (okUrl(a.href) && !(a.closest && a.closest('#secret-keys-host'))) urls.add(a.href);
    for (const e of SK.hiddenLinks(new Set())) urls.add(e.url);
    return [...urls];
  };

  // ---------- Reveal: open the menu a hidden link lives in, then flash it ----------
  const findLink = url => {
    for (const a of document.querySelectorAll('a[href]')) if (a.href === url && SK.visible(a)) return a;
    return null;
  };
  const triggerFor = el => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.tagName === 'DETAILS') return n.querySelector(':scope > summary');
      if (n.id) {
        const t = document.querySelector(`[aria-controls~="${CSS.escape(n.id)}"], [data-target="#${CSS.escape(n.id)}"], [data-bs-target="#${CSS.escape(n.id)}"], [href="#${CSS.escape(n.id)}"]`);
        if (t) return t;
      }
      const prev = n.previousElementSibling;
      if (prev && prev.matches('[aria-haspopup]:not([aria-haspopup="false"]), [aria-expanded], .dropdown-toggle')) return prev;
    }
    return null;
  };

  SK.reveal = async entry => {
    const ui = SK.ui;
    const show = el => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        ui.flash(el);
        ui.highlight(el, entry.label);
        setTimeout(() => ui.highlight(null), 1500);
      }, 350);
    };
    let el = findLink(entry.url);
    if (el) return show(el);
    let trig = null;
    if (entry.el && entry.el.isConnected) trig = triggerFor(entry.el);
    if (!trig && entry.triggerSel) try { trig = document.querySelector(entry.triggerSel); } catch {}
    if (trig) {
      if (trig.tagName === 'SUMMARY') trig.parentElement.open = true;
      else trig.click();
      await SK.sleep(400);
      el = findLink(entry.url);
      if (el) return show(el);
    }
    ui.toast("Can't show it on the page — but you can open or copy it", { type: 'error', duration: 3500 });
  };

  // ---------- Explorer: open each menu / dropdown / tab / section and record the links inside ----------
  const TRIGGERS = [
    'summary',
    '[aria-haspopup]:not([aria-haspopup="false"])',
    '[aria-expanded="false"]',
    '[data-toggle="dropdown"]', '[data-bs-toggle="dropdown"]', '[data-toggle="collapse"]', '[data-bs-toggle="collapse"]',
    '.dropdown-toggle', '.menu-toggle', '.navbar-toggler',
    '[role="tab"]:not([aria-selected="true"])'
  ].join(',');
  const DANGER = /delete|remove|logout|log out|sign out|unsubscribe|cancel|pay|buy|purchase|checkout|order|submit|send|post|publish|confirm|block|report|close account/i;

  SK.explore = {
    current: null,
    running: false,

    findTriggers() {
      const out = [];
      for (const el of document.querySelectorAll(TRIGGERS)) {
        if (out.length >= 60) break;
        if (el.closest('#secret-keys-host') || !SK.visible(el)) continue;
        if (el.matches('a[href]') && !/^#|^javascript:/i.test(el.getAttribute('href') || '')) continue; // would navigate away
        if (el.matches('[type=submit], input[type=image]') || el.closest('form') && el.matches('button:not([type=button])')) continue;
        if (DANGER.test(SK.labelOf(el))) continue;
        out.push(el);
      }
      return out;
    },

    async run() {
      if (this.running) return;
      const ui = SK.ui;
      const triggers = this.findTriggers();
      if (!triggers.length) return ui.toast('No menus or dropdowns found on this page');
      this.running = true;
      const startY = scrollY;
      const before = SK.catcher.map.size;
      const selectedTabs = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')];
      const tip = ui.toast(`Opening menus… 0 / ${triggers.length}`, { duration: 120000, accent: 'macro' });
      let i = 0;
      for (const t of triggers) {
        i++;
        tip.set(`Opening menus… ${i} / ${triggers.length}`);
        if (!t.isConnected || !SK.visible(t)) continue;
        const name = short(SK.labelOf(t));
        this.current = { trigger: name, triggerSel: SK.selectorFor(t) };
        const wasExpanded = t.getAttribute('aria-expanded');
        try {
          if (t.tagName === 'SUMMARY') {
            const d = t.parentElement;
            const was = d.open;
            d.open = true;
            await SK.sleep(200);
            for (const a of d.querySelectorAll('a[href]')) SK.catcher.add(a, this.current);
            d.open = was;
          } else {
            const visBefore = new Set([...document.querySelectorAll('a[href]')].filter(SK.visible));
            for (const type of ['pointerover', 'mouseover', 'pointerenter', 'mouseenter']) t.dispatchEvent(new MouseEvent(type, { bubbles: type.endsWith('over') }));
            t.click();
            await SK.sleep(450);
            for (const a of document.querySelectorAll('a[href]')) if (!visBefore.has(a) && SK.visible(a) && !a.closest('#secret-keys-host')) SK.catcher.add(a, this.current);
            // close it again
            if (t.isConnected && t.getAttribute('aria-expanded') === 'true' && wasExpanded !== 'true') t.click();
            else if (!t.matches('[role="tab"]')) document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
            for (const type of ['pointerout', 'mouseout', 'pointerleave', 'mouseleave']) t.dispatchEvent(new MouseEvent(type, { bubbles: type.endsWith('out') }));
            await SK.sleep(150);
          }
        } catch {}
      }
      for (const tab of selectedTabs) if (tab.isConnected) try { tab.click(); } catch {}
      await SK.sleep(300); // let the catcher finish
      this.current = null;
      this.running = false;
      scrollTo({ top: startY });
      tip.dismiss();
      const found = SK.catcher.map.size - before;
      ui.pageFilter = 'hidden';
      ui.open('page');
      ui.renderView();
      ui.toast(found ? `Found ${found} new link${found === 1 ? '' : 's'} inside menus` : 'Checked every menu — no new links', { accent: 'macro', duration: 3500 });
    },

    confirmAndRun() {
      const ui = SK.ui;
      const n = this.findTriggers().length;
      if (!n) return ui.toast('No menus or dropdowns found on this page');
      let m;
      m = ui.modal([
        h('h3', null, '🔍 Find hidden links', h('small', null, location.hostname)),
        h('div', { class: 'sk-hint', style: { fontSize: '.92em', lineHeight: '1.5' } },
          `Secret Keys will open ${n} menu${n === 1 ? '' : 's'}, dropdown${n === 1 ? '' : 's'} and tab${n === 1 ? '' : 's'} on this page one by one, write down the links inside, and close them again. It takes a few seconds.`),
        h('div', { class: 'sk-card' },
          h('div', { class: 'sk-row' }, h('span', null, '✅'), h('div', { class: 'grow meta', style: { whiteSpace: 'normal' } }, 'Only presses menu-style buttons')),
          h('div', { class: 'sk-row' }, h('span', null, '🚫'), h('div', { class: 'grow meta', style: { whiteSpace: 'normal' } }, 'Never clicks real links, submits forms, or presses buttons like Delete, Buy, Send or Log out'))),
        h('div', { class: 'sk-btns' },
          h('button', { class: 'sk-btn', onclick: () => m.close() }, 'Cancel'),
          h('button', { class: 'sk-btn macro', onclick: () => (m.close(), ui.close(), setTimeout(() => this.run(), 200)) }, 'Start'))
      ]);
    }
  };
})();
