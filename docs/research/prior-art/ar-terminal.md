# ar-terminal (RTL Terminal)
- **Repo:** https://github.com/alzahrani-khalid/ar-terminal · **Commit read:** fa0690f (v0.3.4, 2026-03-29) · **License:** None. There is no LICENSE file. `package.json:6` and `README.md:154` say "MIT", but without a license text we treat the code as **not reusable**. · **Language:** TypeScript · **Platform:** VS Code extension (macOS/Linux/Windows), node-pty + xterm.js 6 in a webview
- **Category:** overlay renderer (primary path) + PTY proxy / output transform (secondary path)

## What it is
A VS Code extension that opens its own terminal as an editor-tab webview: node-pty runs the shell and a bundled xterm.js emulates the terminal. Rows that contain RTL code points (or Nerd Font icons) get covered by an absolutely positioned HTML `<div>`, so Chromium's text engine shapes and reorders those rows. A second code path, a `vscode.Pseudoterminal` profile, rewrites the PTY stream into presentation forms in visual order.

## How it works (verified in code)
**Path A, the webview overlay** (`rtlTerminal.newTerminal`, `src/extension.ts:55-65`, `src/webview-terminal.ts`):
- PTY bytes go **raw** to xterm.js (`webview-terminal.ts:133-136`). Only OSC title sequences are stripped (`:119-131`). xterm.js keeps logical text in its buffer and draws it on its own canvas.
- **Hooking xterm.js:** this is not a fork, a custom renderer, the decoration API or a character joiner. It is a sibling DOM layer, `#arabic-overlay`, with `pointer-events:none` and `z-index:10` (`:222-243`). On `onWriteParsed`, `onScroll`, `onResize` and `onSelectionChange` (`:627-630`), it rebuilds the overlay after a 16 ms debounce (`:620-625`).
- `updateArabicOverlay` (`:463-535`) walks the visible rows of `term.buffer.active`. A row is overlaid if any cell is RTL or a Nerd Font PUA glyph (`:474-482`, ranges at `:363-378`). For each overlaid row it concatenates `cell.getChars()` in **logical cell order**, grouped into `<span>`s by fg colour/bold/dim/italic (`:495-520`). Background colour, underline and inverse are dropped. The row `div` is opaque (`background` at `:242`), so it hides the canvas row beneath it.
- **Shaping and bidi are done by Chromium**, not by app code. The div has `direction:ltr; unicode-bidi:normal; white-space:pre` (`:233-243`), so Blink runs UAX #9 with an LTR paragraph level and shapes with HarfBuzz using whatever font falls back. The `ArabicReshaper` and `BidiEngine` fields in this class (`:22-24`) are unused. `reshapeArabicInStream` (`:159-176`) is dead code with no callers.
- **Cells to glyphs:** there is no mapping. The overlay uses proportional browser layout starting at x=0 of the row (`left:0`). Only row `top`/`height` come from xterm's private `term._core._renderService.dimensions` (`:420-432`). Shaped Arabic text is narrower or wider than its N cells, so everything after it on the row drifts away from xterm's grid.
- **Cursor:** a fake blinking bar placed at `buf.cursorX * cellW` (`:522-529`). That is the *logical* cell column, which does not match the reordered and reflowed glyphs on the overlay.
- **Selection:** still xterm.js's own selection on the hidden canvas grid (logical columns). The overlay only repaints a highlight by splitting spans at logical character offsets equal to the selection columns (`:538-618`). The mouse drag therefore selects by invisible logical cells, not by what the user sees.
- **Copy:** a `copy` listener (`:756-806`) builds text from the overlay spans, which hold logical-order buffer characters, and takes `substring(startX, endX)` by column. The result is **logical order with original code points** (no presentation forms). Index drift is possible because empty or wide cells are skipped (`:499`).
- No alternate-screen check exists in this path, so vim/htop rows containing Arabic still get overlaid. No Unicode 11 width addon is loaded. The `rtlTerminal.mode` and `reshapeInput` settings are never read here.

**Path B, the Pseudoterminal profile** ("RTL Terminal" terminal profile, `extension.ts:30-46, 90-150`):
- `RtlPipeline.process` (`src/rtl-pipeline.ts:18-83`) strips ANSI, then for each line containing RTL: (1) `ArabicReshaper` replaces letters with **Presentation Forms-B** (`arabic-reshaper.ts:27-139`, table `arabic-data.ts`), (2) `BidiEngine` uses **bidi-js 1.0.3** (UAX #9 levels + mirroring) to **physically reverse** runs into visual order (`bidi-engine.ts:15-68`), then (3) puts the ANSI codes back at their *pre-reorder* positions (`rtl-pipeline.ts:82`). The index maps are computed but discarded.
- The shaping table covers only U+0621–U+064A plus lam-alef (`arabic-data.ts`). **Persian پ چ ژ گ ک ی are missing**, so they stay as unjoined base letters and also break joining for their neighbours. ZWNJ is not handled.
- Echoed typed input is caught one Arabic character at a time and redrawn with `\b`×N and the reshaped buffer (`rtl-pipeline.ts:95-139`), with no bidi.
- Alternate screen (`?1049h`/`?47h`) switches to pass-through (`:20-29`).

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | No normalization. Path B converts the text to presentation forms (compatibility characters). |
| 2 Input (layouts, ZWNJ, IME) | ◐ | Path B reshapes the echo hack (`rtl-pipeline.ts:110-139`). There is no IME or ZWNJ logic. Mac Cmd/Alt keybindings map to readline sequences (`package.json` keybindings). |
| 3 Width | ❌ | Overlay glyphs don't line up with cells (proportional layout). Path B assumes 1 cell per presentation form. |
| 4 Shaping | ◐ | Path A: real HarfBuzz shaping through Chromium. Path B: lookup-table presentation forms, Arabic-only. |
| 5 Bidi | ◐ | Path A: Blink UAX #9 per row, LTR base forced, row-local. Path B: bidi-js UAX #9 but bakes visual order into the stream. |
| 6 Cursor/selection/copy | ◐ | Copy is logical in Path A (`:756-806`), but selection hit-testing and the cursor use logical columns over a visual rendering. Path B copies reversed presentation forms. |
| 7 Fonts | ◐ | Bundles a Nerd Font symbols subset (`:203-210`). Arabic uses browser fallback with no monospace Arabic font. |
| 8 Multiplexers | ❌ | Not addressed. A tmux/Zellij redraw is just more rows to overlay. |
| 9 Apps & TUI frameworks | ◐ | Targets Claude Code in marketing. The overlay is not suppressed for full-screen apps (Path A). |

## Claimed but not verified
- "vim / htop / less — TUI apps work normally (overlay auto-disables)" (`README.md:76`). There is no alt-screen check in the webview overlay. Only Path B has one.
- "Auto-detection / mode auto/on/off" (`README.md:44, 105-108`). The mode is only consulted by Path B. The default command (Path A) ignores it.
- "Full support for 16, 256, and RGB colors" (`README.md:46`). The overlay keeps the foreground only and drops background, inverse and underline (`:501-518`).
- "Persian, Urdu" support (`README.md:43`). In Path B, the Persian and Urdu letters outside 0621–064A don't shape. Path A depends on the browser.
- README *admits* "Text selection on Arabic lines copies from xterm.js underneath" (`README.md:146`). The code actually overrides copy with overlay text, so the README is stale.
- The design spec (`docs/superpowers/specs/2026-03-25-…md:28`) describes the Pseudoterminal-with-reorder approach. The shipped default moved to the overlay.

## What we can learn / reuse
- **Nothing reusable as code** (no license file). Ideas only:
- The overlay finding is useful: leaving the buffer logical and letting a real text engine (HarfBuzz + UAX #9) paint the row gives shaped, correctly ordered RTL **and** a logical copy. That is the right *data* model. What's missing is a cell-anchored layout and a visual↔logical map for hit-testing.
- It confirms the gap in xterm.js: no shaping, no bidi, and no public API to substitute row rendering. The overlay depends on private `_core._renderService` (`:421-423`).
- bidi-js (MIT, lojjic) works as an embeddable UAX #9 implementation that provides levels, reorder segments and mirroring. It is a candidate for our test oracles.
- Test files (`*.test.ts`) list concrete cases: lam-alef with diacritics, mixed-direction lines, ANSI round-trips.

## Limitations & anti-patterns
- **Path B is exactly what our principles reject:** presentation-form substitution, a pre-reversed visual-order stream, and ANSI codes re-inserted at stale logical offsets (colours land on the wrong characters). The output is then corrupted for copy, search and logs, and any app cursor addressing breaks.
- **Two renderings of one row.** The canvas grid and DOM text disagree on geometry, so cursor, mouse selection and link hit-testing go by invisible cells.
- **Overlay over full-screen TUIs** with no alt-screen guard and per-write full DOM rebuilds, plus a self-acknowledged flash of unshaped text.
- **Forced LTR paragraph** (`direction:ltr`). A pure-RTL row is never right-aligned and has no base-direction detection (P2/P3).
- Arabic-only shaping data (no Persian letters, no ZWNJ/ZWJ handling) in the code path that does its own shaping.
