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
