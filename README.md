# ⌘ Secret Keys — by Vedant

Custom hotkeys, macros and a command palette for any website, in a liquid glass UI.
**No install and no extensions.** Drag one button to your bookmarks bar, then click it on any site.

👉 **Get it:** `https://YOUR-USERNAME.github.io/secret-keys/`

---

## Put it online with GitHub (5 minutes, free)

1. Go to **github.com → New repository**. Name it `secret-keys`, set it to **Public**, and click **Create repository**.
2. On the new repo page, click **uploading an existing file**. Drag in **everything inside this folder** (`docs`, `extension`, `src`, `build.js`, `README.md`) and click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then branch **main**, folder **/docs**, and click **Save**.
4. Wait about 1 minute. Your link is `https://YOUR-USERNAME.github.io/secret-keys/`.
5. Open the link, drag the blue **⌘ Secret Keys** button to your bookmarks bar, and you're done. Share the link with anyone.

## Using it
- Click the **⌘ Secret Keys** bookmark on any website to show or hide the panel.
- **Ctrl+K** (Mac: ⌘K) opens the command palette.
- Your shortcuts and macros are saved in the browser and come back each time you click the bookmark.
- Each website keeps its own saved data. Use **Export / Import** in the panel footer to copy between sites.

## Updating
Change files in `extension/`, run `node build.js` (this rebuilds `docs/secret-keys.js`), and upload the changed files to GitHub. Everyone gets the new version next time they click their bookmark, with no reinstall.

## What's in here
| Path | What it is |
|---|---|
| `docs/` | The website GitHub Pages serves: landing page + `secret-keys.js` (what the bookmark loads) |
| `docs/secret-keys-extension.zip` | Full Chrome extension (runs automatically on every site, for advanced users) |
| `extension/` | Source code, shared by the bookmark version and the extension |
| `src/bookmarklet-shim.js` | Small adapter that lets the extension code run as a bookmark |
| `build.js` | Builds `docs/secret-keys.js` from `extension/` |

## Limits of the bookmark version
- You click it once per page, because bookmarks can't run by themselves.
- A few strict sites (GitHub, Gmail, X…) block outside scripts. Use the extension there.
- Tab and bookmark controls need the extension.
