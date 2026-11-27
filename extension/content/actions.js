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
