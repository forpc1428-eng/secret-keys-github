// Secret Keys v10 — liquid glass styles (lives inside a Shadow DOM so no website can break it)
(() => {
  'use strict';
  const SK = globalThis.SK;

  // A real spring curve (overshoot + settle) like iOS
  const SPRING =
    'linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)';
  const EASE = 'cubic-bezier(.2,.9,.25,1.15)';

  SK.CSS = `
:host { all: initial; }
.sk-root {
  --sk-spring-fallback: ${EASE};
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, "Inter", sans-serif;
  font-size: var(--sk-fs); line-height: 1.4; color: var(--sk-text);
  -webkit-font-smoothing: antialiased; text-shadow: var(--sk-glow);
}
.sk-root *, .sk-root *::before, .sk-root *::after { box-sizing: border-box; margin: 0; }
.sk-root button, .sk-root input, .sk-root select, .sk-root textarea { font: inherit; color: inherit; text-shadow: inherit; }
.sk-root [hidden] { display: none !important; }

/* ---------- The glass ---------- */
.glass {
  position: relative; isolation: isolate;
  background: var(--sk-bg);
  backdrop-filter: blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));
  -webkit-backdrop-filter: blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));
  border-radius: var(--sk-radius);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255, calc(var(--sk-border) * 1.7)),
    inset 0 -1px 0 rgba(0,0,0, .16),
    inset 0 0 0 .5px rgba(255,255,255, var(--sk-border)),
    0 calc(34px * var(--sk-depth)) calc(90px * var(--sk-depth)) rgba(0,0,0, calc(.55 * var(--sk-depth))),
    0 calc(4px * var(--sk-depth)) calc(14px * var(--sk-depth)) rgba(0,0,0, calc(.22 * var(--sk-depth)));
}
.liquid .glass.sk-panel, .liquid .glass.sk-sheet {
  backdrop-filter: url(#sk-liquid) blur(var(--sk-blur)) saturate(var(--sk-sat)) brightness(var(--sk-bright));
}
/* Gradient rim — light catching the edge */
.glass::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none; z-index: 3;
  background: linear-gradient(140deg,
    rgba(255,255,255, calc(var(--sk-border) * 2.6)) 0%,
    rgba(255,255,255, 0) 38%, rgba(255,255,255, 0) 62%,
    rgba(255,255,255, calc(var(--sk-border) * 1.5)) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
/* Specular sheen that follows the cursor */
.sk-sheen {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 0;
  background:
    radial-gradient(380px circle at var(--mx, 25%) var(--my, -10%), rgba(255,255,255,.16), transparent 55%),
    linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,0) 28%);
}
.no-specular .sk-sheen { background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,0) 28%); }
[data-tint=light] .sk-sheen { mix-blend-mode: soft-light; }

/* ---------- Panel ---------- */
.sk-panel {
  position: fixed; z-index: 2147483646; display: flex; flex-direction: column;
  min-width: 300px; min-height: 340px; overflow: hidden; touch-action: none;
  opacity: 0; visibility: hidden; transform: scale(.9) translateY(-10px); transform-origin: top right;
  transition: opacity calc(var(--sk-dur) * .7) ease, transform var(--sk-dur) ${EASE}, visibility 0s linear var(--sk-dur);
  transition: opacity calc(var(--sk-dur) * .7) ease, transform calc(var(--sk-dur) * 1.6) ${SPRING}, visibility 0s linear var(--sk-dur);
}
.sk-panel.open { opacity: 1; visibility: visible; transform: none; transition-delay: 0s; }
.sk-panel.picking { opacity: .12 !important; pointer-events: none; }
.sk-panel > *:not(.sk-sheen) { position: relative; z-index: 1; }
.sk-panel.dock-right, .sk-panel.dock-left { top: 12px !important; bottom: 12px; height: auto !important; }
.sk-panel.dock-right { right: 12px !important; left: auto !important; }
.sk-panel.dock-left { left: 12px !important; right: auto !important; transform-origin: top left; }

.sk-head { display: flex; align-items: center; gap: 10px; padding: 16px 16px 10px; cursor: grab; user-select: none; }
.sk-head:active { cursor: grabbing; }
.sk-logo { width: 26px; height: 26px; border-radius: 9px; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #fff; text-shadow: none;
  background: linear-gradient(145deg, var(--sk-accent), var(--sk-macro)); box-shadow: 0 4px 14px color-mix(in srgb, var(--sk-accent) 50%, transparent), inset 0 1px 0 rgba(255,255,255,.5); }
.sk-title { flex: 1; font-weight: 700; font-size: 1.08em; letter-spacing: -.01em; }
.sk-title small { display: block; font-weight: 500; font-size: .74em; color: var(--sk-sub); letter-spacing: 0; }
.sk-icon-btn { width: 28px; height: 28px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--sk-fill); color: var(--sk-sub); font-size: 15px; line-height: 1; transition: transform .2s ${EASE}, background .15s; }
.sk-icon-btn:hover { background: var(--sk-fill2); color: var(--sk-text); }
.sk-icon-btn:active { transform: scale(.88); }

/* Segmented control with sliding pill */
.sk-seg { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin: 0 14px 10px; padding: 3px; border-radius: 12px; background: var(--sk-fill); }
.sk-seg-pill { position: absolute; top: 3px; bottom: 3px; left: 3px; border-radius: 9px; background: var(--sk-pill);
  box-shadow: 0 3px 10px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.25);
  transition: transform calc(var(--sk-dur) * 1.4) ${EASE}, width .2s;
  transition: transform calc(var(--sk-dur) * 1.6) ${SPRING}, width .2s; }
.sk-seg button { position: relative; z-index: 1; border: 0; background: none; padding: 7px 4px; font-size: .9em; font-weight: 600; cursor: pointer; color: var(--sk-sub); border-radius: 9px; transition: color .2s; }
.sk-seg button.active { color: var(--sk-text); }

.sk-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 2px 14px 14px; display: flex; flex-direction: column; gap: 10px; overscroll-behavior: contain; }
.sk-body::-webkit-scrollbar, .sk-pal-list::-webkit-scrollbar, .sk-sheet::-webkit-scrollbar { width: 6px; }
.sk-body::-webkit-scrollbar-thumb, .sk-pal-list::-webkit-scrollbar-thumb, .sk-sheet::-webkit-scrollbar-thumb { background: var(--sk-fill2); border-radius: 6px; }
.sk-view { display: flex; flex-direction: column; gap: 10px; }
.sk-view.anim { animation: sk-in calc(var(--sk-dur) * 1.2) ${EASE}; }
@keyframes sk-in { from { opacity: 0; transform: translateY(6px) scale(.99); } }

.sk-section { display: flex; align-items: center; justify-content: space-between; font-size: .76em; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--sk-sub); margin-top: 6px; padding: 0 4px; }
.sk-link { cursor: pointer; color: var(--sk-accent); text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 1.15em; background: none; border: 0; padding: 0; }
.sk-card { background: var(--sk-fill); border-radius: calc(var(--sk-radius) * .55); padding: 4px; display: flex; flex-direction: column; }
.sk-card > .sk-row + .sk-row { border-top: .5px solid var(--sk-line); }

.sk-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: calc(var(--sk-radius) * .4); min-height: 40px; transition: background .15s; }
.sk-row.click { cursor: pointer; }
.sk-row.click:hover { background: var(--sk-fill); }
.sk-row.off { opacity: .5; }
.sk-row .grow { flex: 1; min-width: 0; }
.sk-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.sk-row .meta { font-size: .8em; color: var(--sk-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.sk-x { border: 0; background: none; cursor: pointer; color: var(--sk-sub); font-size: 18px; line-height: 1; width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; opacity: .6; }
.sk-x:hover { opacity: 1; color: #ff453a; background: rgba(255,69,58,.12); }

.sk-kbd { display: inline-flex; gap: 3px; flex-shrink: 0; }
.sk-kbd span { font: 600 .82em ui-monospace, "SF Mono", Menlo, Consolas, monospace; padding: 2px 6px; min-width: 20px; text-align: center; border-radius: 6px; text-shadow: none;
  color: var(--kc, var(--sk-accent)); background: color-mix(in srgb, var(--kc, var(--sk-accent)) 16%, transparent); box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--kc, var(--sk-accent)) 40%, transparent); }
.sk-kbd.macro { --kc: var(--sk-macro); }
.sk-kbd.none span { --kc: var(--sk-sub); }
.sk-chip { font-size: .74em; font-weight: 600; padding: 2px 7px; border-radius: 20px; background: var(--sk-fill2); color: var(--sk-sub); white-space: nowrap; }
.sk-chip.green { color: #30d158; background: rgba(48,209,88,.14); }

.sk-empty { text-align: center; color: var(--sk-sub); font-size: .9em; padding: 18px 10px; }
.sk-empty b { display: block; font-size: 1.8em; margin-bottom: 4px; }

/* ---------- Controls ---------- */
.sk-btn { border: 0; cursor: pointer; padding: 10px 14px; border-radius: calc(var(--sk-radius) * .5); font-weight: 600; background: var(--sk-fill2); display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: transform .25s ${EASE}, filter .15s, background .15s; box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
.sk-btn:hover { filter: brightness(1.15); }
.sk-btn:active { transform: scale(.96); }
.sk-btn.primary, .sk-btn.macro { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.sk-btn.primary { background: linear-gradient(180deg, color-mix(in srgb, var(--sk-accent) 85%, white), var(--sk-accent)); box-shadow: 0 6px 20px color-mix(in srgb, var(--sk-accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.35); }
.sk-btn.macro { background: linear-gradient(180deg, color-mix(in srgb, var(--sk-macro) 85%, white), var(--sk-macro)); box-shadow: 0 6px 20px color-mix(in srgb, var(--sk-macro) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.35); }
.sk-btn.danger { color: #ff453a; background: rgba(255,69,58,.12); }
.sk-btn.small { padding: 6px 10px; font-size: .88em; }
.sk-btn.block { width: 100%; }
.sk-btns { display: flex; gap: 8px; }
.sk-btns > * { flex: 1; }

.sk-input, .sk-select, .sk-textarea { width: 100%; border: 0; outline: 0; padding: 9px 12px; border-radius: calc(var(--sk-radius) * .42); background: var(--sk-field); box-shadow: inset 0 0 0 .5px var(--sk-line); transition: box-shadow .15s; text-shadow: none; }
.sk-input:focus, .sk-select:focus, .sk-textarea:focus { box-shadow: inset 0 0 0 1.5px var(--sk-accent), 0 0 0 4px color-mix(in srgb, var(--sk-accent) 20%, transparent); }
.sk-input::placeholder, .sk-textarea::placeholder { color: var(--sk-sub); opacity: .8; }
.sk-textarea { min-height: 84px; resize: vertical; line-height: 1.45; }
.sk-textarea.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: .9em; }
.sk-select { appearance: none; cursor: pointer; padding-right: 30px;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 16px) 55%, calc(100% - 11px) 55%; background-size: 5px 5px; background-repeat: no-repeat; }
.sk-select option { color: #000; }
.sk-field { display: flex; flex-direction: column; gap: 6px; }
.sk-field > label { font-size: .8em; font-weight: 600; color: var(--sk-sub); padding-left: 2px; }
.sk-hint { font-size: .76em; color: var(--sk-sub); padding-left: 2px; }
.sk-warn { font-size: .82em; color: #ffd60a; padding: 6px 10px; border-radius: 10px; background: rgba(255,214,10,.12); }
.sk-inline { display: flex; gap: 6px; }
.sk-inline > .sk-input { flex: 1; }

.sk-switch { position: relative; width: 42px; height: 25px; flex-shrink: 0; cursor: pointer; }
.sk-switch input { position: absolute; opacity: 0; inset: 0; cursor: pointer; z-index: 1; margin: 0; }
.sk-switch i { position: absolute; inset: 0; border-radius: 20px; background: var(--sk-fill2); transition: background .25s; box-shadow: inset 0 0 0 .5px var(--sk-line); }
.sk-switch i::before { content: ""; position: absolute; top: 2px; left: 2px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.3);
  transition: transform .35s ${EASE}, width .2s; }
.sk-switch input:checked + i { background: #30d158; }
.sk-switch input:checked + i::before { transform: translateX(17px); }
.sk-switch input:active + i::before { width: 26px; }
.sk-switch input:checked:active + i::before { transform: translateX(12px); }

.sk-range { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; padding: 8px 10px; }
.sk-range label { font-weight: 500; }
.sk-range output { font-size: .82em; color: var(--sk-sub); font-variant-numeric: tabular-nums; }
.sk-range input[type=range] { grid-column: 1 / -1; width: 100%; -webkit-appearance: none; appearance: none; height: 6px; border-radius: 6px; outline: none; cursor: pointer;
  background: linear-gradient(90deg, var(--sk-accent) var(--p, 50%), var(--sk-fill2) var(--p, 50%)); }
.sk-range input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35), 0 0 0 .5px rgba(0,0,0,.1); transition: transform .2s ${EASE}; }
.sk-range input[type=range]:active::-webkit-slider-thumb { transform: scale(1.18); }
.sk-color { width: 34px; height: 26px; border: 0; padding: 0; border-radius: 8px; overflow: hidden; cursor: pointer; background: none; }
.sk-color::-webkit-color-swatch-wrapper { padding: 0; }
.sk-color::-webkit-color-swatch { border: 0; border-radius: 8px; }

.sk-presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.sk-preset { border: 0; cursor: pointer; padding: 10px 8px 8px; border-radius: calc(var(--sk-radius) * .5); background: var(--sk-fill); display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: .82em; font-weight: 600; transition: transform .25s ${EASE}; }
.sk-preset:active { transform: scale(.94); }
.sk-preset.active { box-shadow: inset 0 0 0 2px var(--sk-accent); }
.sk-preset i { width: 100%; height: 34px; border-radius: 10px; display: block; box-shadow: inset 0 1px 0 rgba(255,255,255,.4), inset 0 0 0 .5px rgba(255,255,255,.3); }

.sk-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px 14px; font-size: .78em; color: var(--sk-sub); border-top: .5px solid var(--sk-line); }
.sk-foot b { color: var(--sk-accent); }
.sk-foot .sk-link { font-size: 1em; }
.sk-resize { position: absolute !important; right: 4px; bottom: 4px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 5 !important; opacity: .45;
  background: radial-gradient(circle at 70% 70%, var(--sk-text) 1.2px, transparent 1.6px), radial-gradient(circle at 30% 70%, var(--sk-text) 1.2px, transparent 1.6px), radial-gradient(circle at 70% 30%, var(--sk-text) 1.2px, transparent 1.6px); }
.dock-left .sk-resize, .dock-right .sk-resize { display: none; }

/* ---------- Page tab ---------- */
.sk-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.sk-filter { border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; font-weight: 600; font-size: .88em; background: var(--sk-fill); color: var(--sk-sub); transition: transform .2s ${EASE}, background .15s; }
.sk-filter span { font-size: .85em; padding: 0 6px; border-radius: 10px; background: var(--sk-fill2); }
.sk-filter.active { background: var(--sk-accent); color: #fff; text-shadow: none; }
.sk-filter.active span { background: rgba(255,255,255,.25); }
.sk-filter:active { transform: scale(.94); }
.sk-kind { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; flex-shrink: 0; text-shadow: none; background: var(--sk-fill); }
.sk-kind.link { background: color-mix(in srgb, var(--sk-accent) 22%, transparent); }
.sk-kind.button { background: color-mix(in srgb, var(--sk-macro) 22%, transparent); }
.sk-kind.input { background: rgba(48,209,88,.2); }
.sk-kind.ghost { background: transparent; outline: 1.5px dashed color-mix(in srgb, var(--sk-accent) 60%, transparent); outline-offset: -1.5px; }
.sk-filter.ghost:not(.active) { outline: 1px dashed var(--sk-line); outline-offset: -1px; }
.sk-src { display: inline-block; margin-right: 6px; padding: 0 6px; border-radius: 6px; font-weight: 600; color: var(--sk-macro); background: color-mix(in srgb, var(--sk-macro) 16%, transparent); }

/* ---------- Hint tags (show all buttons & links) ---------- */
.sk-hints { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
.sk-hints.out { transition: opacity .15s; opacity: 0; }
.sk-tag { position: fixed; pointer-events: auto; cursor: pointer; transform: translate(-6px, -8px);
  font: 800 11.5px/1.25 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: .05em; padding: 3px 7px; border-radius: 8px;
  color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,.35);
  background: var(--hc); backdrop-filter: blur(8px) saturate(180%); -webkit-backdrop-filter: blur(8px) saturate(180%);
  box-shadow: 0 4px 14px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.5), 0 0 0 .5px rgba(255,255,255,.45);
  animation: sk-hint-in .32s ${EASE} both; }
.sk-tag:hover { filter: brightness(1.15); z-index: 1; }
.sk-tag b { opacity: .4; font-weight: 800; }
.sk-tag.link { --hc: color-mix(in srgb, var(--sk-accent) 88%, transparent); }
.sk-tag.button { --hc: color-mix(in srgb, var(--sk-macro) 90%, transparent); }
.sk-tag.input { --hc: rgba(40,190,80,.9); }
@keyframes sk-hint-in { from { opacity: 0; transform: translate(-6px, -8px) scale(.4); } }

/* ---------- Floating pill ---------- */
.sk-badge { position: fixed; z-index: 2147483645; display: flex; align-items: center; gap: 8px; padding: 9px 14px 9px 10px; border-radius: 999px !important; cursor: pointer; user-select: none; touch-action: none; font-weight: 700; font-size: .92em;
  transition: transform .35s ${EASE}, opacity .3s; }
.sk-badge:hover { transform: scale(1.05); }
.sk-badge:active { transform: scale(.94); }
.sk-badge .dot { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; color: #fff; text-shadow: none; background: linear-gradient(145deg, var(--sk-accent), var(--sk-macro)); }
.sk-badge.off .dot { filter: grayscale(1); }
.sk-badge > span { position: relative; z-index: 1; }

/* ---------- Highlight / flash ---------- */
.sk-hl { position: fixed; z-index: 2147483644; pointer-events: none; border-radius: 10px; display: none;
  box-shadow: 0 0 0 2px var(--sk-accent), 0 0 0 6px color-mix(in srgb, var(--sk-accent) 25%, transparent), 0 0 30px color-mix(in srgb, var(--sk-accent) 40%, transparent);
  background: color-mix(in srgb, var(--sk-accent) 10%, transparent); transition: all .12s ease-out; }
.sk-hl b { position: absolute; left: 0; top: -26px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 7px; background: var(--sk-accent); color: #fff; text-shadow: none; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.sk-flash { position: fixed; z-index: 2147483644; pointer-events: none; border-radius: 10px; background: var(--sk-accent); }

/* ---------- Toasts ---------- */
.sk-toasts { position: fixed; z-index: 2147483647; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; pointer-events: none; }
.sk-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 11px 18px; border-radius: 999px !important; font-weight: 600; max-width: min(560px, 90vw);
  animation: sk-toast-in calc(var(--sk-dur) * 1.6) ${EASE}; animation: sk-toast-in calc(var(--sk-dur) * 1.8) ${SPRING}; }
.sk-toast > span { position: relative; z-index: 1; }
.sk-toast .bolt { color: var(--tc, var(--sk-accent)); }
.sk-toast.error { --tc: #ff453a; }
.sk-toast.macro { --tc: var(--sk-macro); }
.sk-toast.out { transition: opacity .25s, transform .25s; opacity: 0; transform: translateY(10px) scale(.95); }
.sk-toast button { position: relative; z-index: 1; border: 0; background: var(--sk-fill2); border-radius: 20px; padding: 4px 10px; cursor: pointer; font-weight: 700; color: var(--sk-accent); }
@keyframes sk-toast-in { from { opacity: 0; transform: translateY(24px) scale(.85); } }

/* ---------- Modals & palette ---------- */
.sk-overlay { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(0,0,0,.22); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: sk-fade .2s ease; }
.sk-overlay.top { align-items: flex-start; padding-top: 14vh; }
.sk-overlay.closing { transition: opacity .18s; opacity: 0; }
@keyframes sk-fade { from { opacity: 0; } }
.sk-sheet { width: min(440px, 100%); max-height: 86vh; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 14px;
  animation: sk-pop calc(var(--sk-dur) * 1.4) ${EASE}; animation: sk-pop calc(var(--sk-dur) * 1.8) ${SPRING}; }
.sk-sheet > *:not(.sk-sheen) { position: relative; z-index: 1; }
.closing .sk-sheet { transition: transform .18s, opacity .18s; transform: scale(.95); opacity: 0; }
@keyframes sk-pop { from { opacity: 0; transform: scale(.88) translateY(12px); } }
.sk-sheet h3 { font-size: 1.25em; font-weight: 700; letter-spacing: -.01em; }
.sk-sheet h3 small { display: block; font-size: .62em; font-weight: 500; color: var(--sk-sub); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sk-capture { display: grid; place-items: center; min-height: 64px; border-radius: calc(var(--sk-radius) * .5); cursor: pointer; font-weight: 700; font-size: 1.05em; color: var(--sk-sub);
  background: var(--sk-field); outline: 1.5px dashed var(--sk-line); outline-offset: -1.5px; transition: outline-color .2s, transform .2s ${EASE}; }
.sk-capture .sk-kbd span { font-size: 1.25em; padding: 4px 10px; }
.sk-capture.listening { outline-color: var(--sk-accent); color: var(--sk-accent); animation: sk-breathe 1.2s ease-in-out infinite; }
.sk-capture.macro.listening { outline-color: var(--sk-macro); color: var(--sk-macro); }
@keyframes sk-breathe { 50% { transform: scale(1.015); } }

.sk-pal { width: min(640px, 100%); padding: 0; gap: 0; max-height: 70vh; overflow: hidden; }
.sk-pal-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: .5px solid var(--sk-line); }
.sk-pal-head .glyph { font-size: 18px; opacity: .7; }
.sk-pal-input { flex: 1; border: 0; outline: 0; background: none; font-size: 1.35em; font-weight: 500; text-shadow: none; }
.sk-pal-input::placeholder { color: var(--sk-sub); }
.sk-pal-list { overflow-y: auto; padding: 6px; max-height: calc(70vh - 110px); }
.sk-pal-group { font-size: .72em; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--sk-sub); padding: 10px 12px 4px; }
.sk-pal-item { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: calc(var(--sk-radius) * .45); cursor: pointer; }
.sk-pal-item.active { background: color-mix(in srgb, var(--sk-accent) 22%, transparent); box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--sk-accent) 45%, transparent); }
.sk-pal-icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--sk-fill); font-size: 15px; flex-shrink: 0; text-shadow: none; }
.sk-pal-text { flex: 1; min-width: 0; }
.sk-pal-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-pal-sub { font-size: .8em; color: var(--sk-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-pal-foot { display: flex; gap: 14px; padding: 10px 16px; font-size: .76em; color: var(--sk-sub); border-top: .5px solid var(--sk-line); flex-wrap: wrap; }
.sk-pal-foot b { font-family: ui-monospace, Menlo, monospace; color: var(--sk-text); }

@media (prefers-reduced-motion: reduce) {
  .sk-root *, .sk-root *::before { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--sk-solid) !important; }
}
`;

  // Theme → CSS variables on the host (instant, no re-render)
  SK.themeVars = t => {
    const light = t.tint === 'light';
    const rgb = light ? '255,255,255' : '16,18,26';
    return {
      '--sk-bg': `rgba(${rgb},${t.opacity})`,
      '--sk-solid': light ? 'rgba(246,247,250,.97)' : 'rgba(22,24,32,.97)',
      '--sk-blur': `${t.blur}px`,
      '--sk-sat': `${t.saturate}%`,
      '--sk-bright': String(1 - t.dim / 100),
      '--sk-border': String(t.border),
      '--sk-depth': String(t.shadow),
      '--sk-radius': `${t.radius}px`,
      '--sk-accent': t.accent,
      '--sk-macro': t.macroAccent,
      '--sk-fs': `${t.fontSize}px`,
      '--sk-dur': `${(0.34 / Math.max(0.1, t.speed)).toFixed(3)}s`,
      '--sk-text': light ? '#0b0d12' : '#f6f8fc',
      '--sk-sub': light ? 'rgba(12,14,20,.58)' : 'rgba(240,244,255,.62)',
      '--sk-fill': light ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)',
      '--sk-fill2': light ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.13)',
      '--sk-field': light ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.22)',
      '--sk-pill': light ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.18)',
      '--sk-line': light ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.12)',
      '--sk-glow': t.textGlow ? (light ? '0 1px 1px rgba(255,255,255,.7)' : '0 1px 3px rgba(0,0,0,.6)') : 'none'
    };
  };
})();
