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
