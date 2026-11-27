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
