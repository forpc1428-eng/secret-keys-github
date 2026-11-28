// Secret Keys v10 — background service worker
// Handles everything a web page can't do by itself: tabs, bookmarks, running JS past site security rules.

const send = (tabId, msg) => chrome.tabs.sendMessage(tabId, msg).catch(() => {});

const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

chrome.action.onClicked.addListener(tab => send(tab.id, { type: 'togglePanel' }));

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  tab = tab || (await activeTab());
  if (!tab) return;
  send(tab.id, { type: cmd === 'open-palette' ? 'openPalette' : 'togglePanel' });
});

// Inject into tabs that were already open when the extension was installed/updated,
// so it works right away without reloading every page.
chrome.runtime.onInstalled.addListener(async () => {
  const files = chrome.runtime.getManifest().content_scripts[0].js;
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const t of tabs) {
    chrome.scripting.executeScript({ target: { tabId: t.id }, files }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(
    result => sendResponse({ ok: true, result }),
    err => sendResponse({ ok: false, error: String((err && err.message) || err) })
  );
  return true; // async response
});

async function handle(msg, sender) {
  const tab = sender.tab;
  switch (msg.type) {
    case 'openUrl':
      if (msg.newTab) {
        await chrome.tabs.create({ url: msg.url, index: tab ? tab.index + 1 : undefined, active: msg.active !== false, openerTabId: tab && tab.id });
      } else {
        await chrome.tabs.update(tab.id, { url: msg.url });
      }
      return true;

    case 'runJS':
      return runJS(tab.id, sender.frameId, msg.code);

    case 'tab':
      return tabAction(tab, msg.action);

    case 'listTabs': {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({ id: t.id, windowId: t.windowId, title: t.title, url: t.url, active: t.active && t.id === tab.id }));
    }

    case 'switchTab':
      await chrome.tabs.update(msg.id, { active: true });
      await chrome.windows.update(msg.windowId, { focused: true });
      return true;

    case 'searchBookmarks': {
      const list = msg.query ? await chrome.bookmarks.search(msg.query) : await chrome.bookmarks.getRecent(15);
      return list.filter(b => b.url).slice(0, 30).map(b => ({ id: b.id, title: b.title, url: b.url }));
    }

    case 'userScriptsStatus':
      return userScriptsAvailable();

    default:
      throw new Error('Unknown message ' + msg.type);
  }
}

function userScriptsAvailable() {
  try {
    return !!(chrome.userScripts && chrome.userScripts.execute);
  } catch {
    return false;
  }
}

async function runJS(tabId, frameId, code) {
  const target = { tabId, frameIds: [frameId || 0] };

  // Best path: chrome.userScripts runs code even on sites with strict security (CSP) rules.
  // Needs "Allow user scripts" turned on for this extension in chrome://extensions.
  if (userScriptsAvailable()) {
    const res = await chrome.userScripts.execute({ target, js: [{ code }], world: 'MAIN' });
    const r = res && res[0];
    if (r && r.error) throw new Error(r.error);
    return 'JS executed';
  }

  // Fallback: works on most sites, blocked on ones with strict CSP (GitHub, Gmail…)
  const [r] = await chrome.scripting.executeScript({
    target,
    world: 'MAIN',
    func: src => {
      try {
        (0, eval)(src);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e && e.message };
      }
    },
    args: [code]
  });
  if (!r || !r.result || !r.result.ok) {
    const why = (r && r.result && r.result.error) || 'Blocked by this site';
    throw new Error(`${why}. Tip: turn on "Allow user scripts" for Secret Keys in chrome://extensions to run JS everywhere.`);
  }
  return 'JS executed';
}

async function tabAction(tab, action) {
  switch (action) {
    case 'new':
      await chrome.tabs.create({ index: tab.index + 1 });
      return 'New tab';
    case 'close':
      await chrome.tabs.remove(tab.id);
      return 'Closed';
    case 'duplicate':
      await chrome.tabs.duplicate(tab.id);
      return 'Duplicated';
    case 'pin':
      await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
      return tab.pinned ? 'Unpinned' : 'Pinned';
    case 'mute': {
      const muted = !(tab.mutedInfo && tab.mutedInfo.muted);
      await chrome.tabs.update(tab.id, { muted });
      return muted ? 'Muted' : 'Unmuted';
    }
    case 'reload':
      await chrome.tabs.reload(tab.id);
      return 'Reloaded';
    case 'next':
    case 'prev': {
      const tabs = await chrome.tabs.query({ windowId: tab.windowId });
      const i = tabs.findIndex(t => t.id === tab.id);
      const n = tabs[(i + (action === 'next' ? 1 : -1) + tabs.length) % tabs.length];
      await chrome.tabs.update(n.id, { active: true });
      return 'Switched';
    }
    case 'dedupe': {
      const norm = u => (u || '').split('#')[0];
      const seen = new Set([norm(tab.url)]);
      const kill = [];
      for (const t of await chrome.tabs.query({})) {
        if (t.id === tab.id) continue;
        const u = norm(t.url);
        if (seen.has(u)) kill.push(t.id);
        else seen.add(u);
      }
      if (kill.length) await chrome.tabs.remove(kill);
      return `Closed ${kill.length} duplicate tab${kill.length === 1 ? '' : 's'}`;
    }
    case 'bookmark': {
      const existing = await chrome.bookmarks.search({ url: tab.url });
      if (existing.length) return 'Already bookmarked';
      await chrome.bookmarks.create({ title: tab.title, url: tab.url });
      return 'Bookmarked';
    }
    default:
      throw new Error('Unknown tab action ' + action);
  }
}
