# Terminal-ar
- **Repo:** https://github.com/yuossef21/Terminal-ar · **Commit read:** `4d24a47` (2026-08-04, shallow) · **License:** **none in repo.** `package.json` and the README say "MIT", but there is no `LICENSE` file, so it is **not safely reusable** · **Language:** JavaScript (Electron) · **Platform:** Windows primary, Linux AppImage/.deb (Electron 37 + node-pty)
- **Category:** overlay renderer (a DOM layer over xterm.js inside an Electron terminal emulator)

## What it is
An Electron terminal (xterm.js 5.5 + node-pty/ConPTY) with tabs, themes, plugins, history autosuggest and an Arabic UI. Its "Arabic support"
is a **DOM overlay** (`renderer/js/bidi/bidi-renderer.js`, 287 lines). The overlay reads xterm's buffer and paints each styled run as an
absolutely positioned `<span>`. Chromium's text engine then does shaping and any bidi *within* each span. xterm's own canvas
text, cursor and selection layers are hidden with `opacity: 0` (`renderer/css/app.css:229-234`). About 3.3k lines of first-party JS/CSS/HTML.
The README targets "AI CLIs" (Claude Code, Codex, OpenCode).

## How it works (verified in code)
- **Data path:** `pty:data` IPC → `term.write`. xterm.js owns the VT state and buffer. The overlay re-renders the whole viewport on every
  `onLineFeed/onScroll/onResize/onData` through rAF (`bidi-renderer.js:28-33, 98-126`).
- **Run building** (`bidi-renderer.js:129-161`): consecutive cells with an identical style key form one run. With `mergeRuns`, adjacent
  RTL code points are merged across colour changes so that Arabic words stay in one text node. That is a precondition for browser joining.
- **Placement** (`:200-223`): each run becomes a `<span>` at `left = startCol * cellW` (its **logical** column), `width = cells * cellW`,
  `overflow: hidden`. The span gets `dir = rtl|ltr|auto` from `BidiUtil.dirOfText` (majority count, `bidi-util.js:52-62`).
  So bidi reordering only happens **inside a span**. Runs on a row are never reordered relative to each other, and no row-level paragraph
  direction is applied to text.
- **Shaping:** delegated entirely to Chromium (HarfBuzz inside Blink) because the span holds real logical text. No shaping code or library
  is in the repo. Glyph widths are the font's natural advances, clipped by `overflow: hidden` to the cell box.
- **Bidi classification** (`renderer/js/bidi/bidi-util.js`): hand-rolled ranges. `LTR_RANGES` includes **all of U+0020–007E**
  (`:25`), so spaces, digits and punctuation count as *strong LTR*, which is wrong per UAX #9. `firstStrongDir` (`:65-72`) is named after
  P2 but inherits that error. `isJoinableArabic` / `NON_JOINERS` (`:78-85`) is defined but unused in rendering. It is also Arabic-only (it
  omits Persian non-joiners such as U+0698 ژ).
- **Cursor** (`:236-262`): if the cursor line's first-strong direction is RTL, `visualX = cols - 1 - cursorX` (it mirrors across the
  **whole row**). The text, however, is *not* mirrored across the row (spans stay at logical columns), so the cursor and the glyphs disagree.
  `:246` also reads `buf.getLine(buf.cursorY)` without adding `baseY`, so it inspects the wrong line once scrollback exists.
- **Selection/copy:** the overlay is `pointer-events: none` (`app.css:241`), so mouse selection is xterm's native logical-cell selection,
  but its highlight layer is hidden while RTL is on. `copy()` uses `term.getSelection()` (`renderer/js/app.js:375-380`), so the
  **copied text is logical order**. The (invisible) selection geometry does not correspond to what the RTL spans display.
- **Input** (`renderer/js/bidi/input-engine.js`): keys go straight to the PTY through `term.onData`. The module only tracks a typed buffer for
  history autosuggest (a ghost text overlay). It does no IME, ZWNJ or normalization work, and it relies on xterm.js's hidden textarea.
- **Width:** xterm.js default (Unicode 6 wcwidth). Nothing custom.
- **PTY env** (`main/pty-manager.js:39-42`): `TERM=xterm-256color`, `LANG` defaults to `en-US.UTF-8` (a malformed locale name).
- **Toggle:** Ctrl+Shift+B hides the overlay and returns to plain xterm.js.
- **Tests:** none. No test files or test script.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | Nothing beyond xterm.js UTF-8. Bad `LANG` default |
| 2 Input (layouts, ZWNJ, IME) | ❌ | Pass-through to xterm.js. `input-engine.js` only does history/autosuggest |
| 3 Width | ❌ | xterm.js wcwidth. Overlay glyphs are clipped/stretched into cell boxes, not reconciled |
| 4 Shaping | ◐ | Chromium/HarfBuzz via DOM text: real joining, but only within a same-style (or merged-RTL) span, clipped to logical cell widths |
| 5 Bidi | ◐ | Chromium UAX #9 inside each span only, with a heuristic span `dir` (majority count, ASCII punctuation treated as strong LTR). No row-level reordering |
| 6 Cursor/selection/copy | ◐ | Copy is logical (xterm `getSelection`). The cursor mirror is inconsistent with the rendered text. The selection highlight is hidden |
| 7 Fonts | ◐ | CSS font stack fallback (`"Noto Sans Arabic","Segoe UI"`), browser-managed |
| 8 Multiplexers | ❌ | Not addressed (it has its own tabs/splits) |
| 9 Apps & TUI | ◐ | Spans stay at app-chosen columns, so box layouts mostly survive. But the cursor mirroring on RTL-first lines and the clipping break TUIs |

## Claimed but not verified
- **"Full Arabic Bidi & Shaping" / "Chromium implements full UAX #9"** (`docs/ARCHITECTURE.md:40`): only within individual spans. The row
  is never treated as a bidi paragraph, and mixed-direction rows keep logical run order.
- **"Absolute alignment for TUI tools (Claude Code, OpenCode, Vim, htop) without distortion":** there is no TUI-specific code. Alignment
  holds only because runs are pinned to logical columns, and the row-mirrored cursor contradicts it.
- **ARCHITECTURE.md describes a smart textarea input line with prompt detection and IME** (`:47-55`). The code says the opposite: "no
  intermediate field" (`input-engine.js:5-8`, `setOverlayMode` forced to `'off'`). The doc has drifted from the code.
- **MIT license:** stated in the README and package.json, but no `LICENSE` file exists, and `package.json` `homepage` points at a different org.
- **Release binaries** (`Terminal-AR-Setup-1.0.0.exe`, AppImage): not verifiable from source.

## What we can learn / reuse
- **Nothing reusable as code** (no license file). Ideas only.
- The **"overlay over an unmodified emulator" pattern** is the cheapest route to joined Arabic in an Electron/xterm.js host. Its key trick
  is to merge adjacent RTL cells across style boundaries so that the browser shapes whole words. This is useful as a quick xterm.js plugin
  baseline and as a cautionary example.
- The idea of a toggleable per-session RTL layer (Ctrl+Shift+B) is a sensible UX escape hatch.
- Keeping copy on the emulator's logical buffer gives correct logical copy for free.

## Limitations & anti-patterns
- **Two sources of truth for layout.** xterm's hidden grid drives hit-testing and selection, while the DOM overlay draws something else. The
  cursor, selection and glyphs can disagree.
- **Heuristic bidi with wrong classes:** ASCII space, digits and punctuation are treated as strong LTR, and the span direction is a majority vote.
- **No row-level bidi:** a mixed Persian/English line keeps logical run order (e.g. an LTR command followed by an RTL argument reads in the
  wrong order for an RTL paragraph). The cursor is still mirrored row-wide on RTL-first lines.
- **Clipping natural-width glyphs into cell boxes** (`overflow:hidden`) silently truncates wide Arabic/Persian words.
- The full DOM viewport is rebuilt on every PTY chunk, which costs performance on heavy output.
- On the positive side, it uses **no presentation-form substitution** and does not rewrite the buffer into visual order.
- Maturity: one shallow commit. No tests, no TODOs, and docs that contradict the code. It looks like a feature-rich app shell with a thin,
  heuristic RTL layer.
