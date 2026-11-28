# ⌘ Secret Keys v10 — by Vedant

Custom hotkeys, macros and a command palette for every website, in a liquid glass UI.

## Install (one time, about 1 minute)
1. Unzip this folder somewhere permanent (don't delete it later, because Chrome loads it from there).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `secret-keys` folder.
4. Optional, for "Run JavaScript" macros on strict sites (GitHub, Gmail…): click **Details** on Secret Keys and turn on **Allow user scripts**.
5. Optional: pin the ⌘ icon to your toolbar.

Your v9 shortcuts and macros move over automatically the first time you open each site.

## Use it
| Do this | Press |
|---|---|
| Command palette (search everything) | **Alt+K** (or Ctrl/Cmd+K on the page) |
| Show / hide panel | **Alt+Shift+K**, the toolbar icon, or the floating "Keys" pill |
| Show every button & link (letter tags) | **Alt+J** (Alt+Shift+J = open in new tab) |
| Find hidden links in menus | Page tab → 🔍 Find hidden links |
| Palette filters | `>` commands · `!` macros · `@` tabs · `*` bookmarks |

You can change the browser-wide keys at `chrome://extensions/shortcuts`.

## Macro variables
`{{date}} {{time}} {{datetime}} {{url}} {{domain}} {{title}} {{selection}} {{clipboard}} {{newline}} {{input:Any label}}`

## Files
- `background.js`: tabs, bookmarks, running JS
- `content/dom.js`: element and key helpers, smart selectors
- `content/store.js`: storage, presets, settings list (add a row to `THEME_SCHEMA` to get a new slider)
- `content/actions.js`: macro actions (add a new one to `SK.ACTIONS` and it shows up in the editor)
- `content/styles.js`: all the glass CSS
- `content/ui.js`: panel, dialogs, toasts
- `content/palette.js`: command palette
- `content/main.js`: hotkey engine and startup
