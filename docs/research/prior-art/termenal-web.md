# termenal-web
- **Repo:** https://github.com/sbay-dev/termenal-web · **Commit read:** `4a9e20c` (2026-07-09, shallow) · **License:** MIT (`LICENSE`, © 2026 sbay-dev) · **Language:** TypeScript · **Platform:** Browser (demo) + Node PTY bridge over WebSocket
- **Category:** terminal emulator (browser; early prototype) + library (`@termenal-web/bidi`, `/shaping`, `/terminal`)

## What it is
A browser terminal that aims to render Arabic (and other RTL scripts) with real OpenType joining and UAX #9. It is the "browser sibling" of
`sbay-dev/termenal-Ar`, a Windows Terminal fork. That sibling is **referenced but not vendored**: the README links it, and
`packages/bidi/src/index.ts:4,17,61` says `RTL_RANGES` and `paragraphReadingDirection` were "ported verbatim" from
`termenal-Ar/src/renderer/atlas/DWriteTextAnalysis.cpp`. About 1.9k lines of first-party TS/JS. The README calls itself
"Early / in design". It ships three small packages with vitest tests and one 1,097-line demo app.

## How it works (verified in code)
- **Pipeline** (`apps/demo/src/terminal.ts:1-12`): shell (node-pty, `apps/terminal-server/src/server.mjs:71`) → WebSocket → **`@xterm/headless`**
  (VT parser + grid; *not* the claimed Rust/WASM core) → per-row logical string → bidi + HarfBuzz → **Canvas2D** glyph outlines
  (`glyphToPath` + `Path2D`, `terminal.ts:404-421`). No WebGPU/WebGL code exists.
- **Bidi** (`packages/bidi/src/index.ts:96-98`): embedding levels come from **`bidi-js`** (a real UAX #9 implementation).
  `getVisualOrder` (`:104-119`) reverses `getReorderSegments` output. The paragraph level, though, comes from a **custom heuristic**
  (`paragraphReadingDirection`, `:66-89`): the majority of strong characters wins, first-strong breaks ties, and only ASCII A–Z/a–z count as
  strong LTR. That is *not* UAX #9 P2/P3. It is then forced into bidi-js as the base level (`packages/terminal/src/index.ts:136-140`).
- **Run itemisation** (`packages/terminal/src/index.ts:91-104`): splits rows into maximal equal-level spans. `reorderRunsVisually`
  (`:149-189`) is a correct rule-L2 reversal at run granularity.
- **Shaping** (`packages/shaping/src/index.ts:144-174`): **`harfbuzzjs`** per run, with direction set explicitly *before*
  `guessSegmentProperties`. Script is guessed. Font fallback goes through a `FontResolver` (`terminal.ts:96-100` picks the Arabic font for
  RTL runs or Arabic-block text).
- **Cell mapping** (`apps/demo/src/terminal.ts:248-283`): each xterm cell's chars are concatenated, and `colOfOffset[]` maps every UTF-16
  offset back to its buffer column. Width comes from xterm.js's wcwidth (Arabic = 1 cell per base code point, so marks merge into the cell).
  `computeRowLayout` (`:330-398`) builds `colToVisual` / `visualToCol` permutations.
- **Two layout modes** (`terminal.ts:311-322`). In **physical** mode (alternate screen, any non-default background, or box-drawing
  U+2500–259F on the row), runs stay at the app's columns and only the cells *inside* an RTL run are mirrored. In **paragraph** mode
  (plain shell output), runs are fully reordered and RTL-base rows are right-aligned to the grid edge.
- **Glyph placement:** glyphs are drawn at `band.startVisualCol * cellW`, but the pen then advances by HarfBuzz `xAdvance`
  (`:408-421`), **not snapped to cells**. A proportional Arabic run can therefore over- or under-fill the n cells the grid gave it.
- **Cursor** (`:481-490`): drawn at `colToVisual[cursorX]`, so it is mirrored consistently with the drawn text.
- **Selection/copy** (`:771-800`): hit-testing maps pixel → visual col → `visualToCol` → logical cell. Selection ranges are kept in
  **logical** cells and `selectionText()` reads the buffer in logical order, so **the copied text is logical**. The highlight is drawn
  per logical cell at its visual position, which makes a mixed-direction selection visually discontiguous, as it should be.
- **Input** (`:636-676`): a plain `keydown` → bytes map. It has no `compositionstart/end` (IME) handling, no NFC, and no ZWNJ-specific logic.
  A Persian Shift+Space ZWNJ only works if the browser reports `e.key` as a single character.
- **Tests:** vitest files `packages/{bidi,shaping,terminal}/test/*.test.ts` (~320 lines) cover range tables, the majority/first-strong
  heuristic, run splitting, L2 reordering, joining (glyph ids differ from isolated forms), and `.notdef` coverage. The demo/renderer has no tests.
- **Spike** (`research/arabic-shaping-spike/`): a Node proof script plus `evidence.json` that loads Windows system fonts.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | No NFC/NFD handling anywhere; it relies on xterm.js UTF-8 decoding |
| 2 Input (layouts, ZWNJ, IME) | ◐ | Raw `keydown` → `e.key` (`terminal.ts:636-676`). No IME composition, no ZWNJ awareness |
| 3 Width | ◐ | Cell count comes from xterm.js wcwidth. Shaped advances are not fitted to cells (`:408-421`), so drawn width can disagree with the grid |
| 4 Shaping | ✅ | harfbuzzjs per bidi run, explicit direction, tested joining (`packages/shaping`) |
| 5 Bidi | ◐ | Real UAX #9 levels via bidi-js, but the paragraph level is a majority heuristic. Terminal-side, per-row. Its handling of TUI rows (physical mode) is a heuristic |
| 6 Cursor/selection/copy | ✅ | `colToVisual`/`visualToCol` permutation. Copy is in logical order (`:771-800`) |
| 7 Fonts | ◐ | Two user-supplied fonts (mono + Arabic), per-run `FontResolver`, `hasFullCoverage`. No system fallback chain |
| 8 Multiplexers | ❌ | Not addressed |
| 9 Apps & TUI | ◐ | The alternate screen or a row with box chars/backgrounds is pinned to the physical grid (`:311-322`). Runs are mirrored inside, not reordered |

## Claimed but not verified
- **WebAssembly VT core (Rust `alacritty_terminal`/`vte`):** not present. The demo uses `@xterm/headless` (`terminal.ts:14`). SPEC-0001 D-8 marks it "planned".
- **WebGPU glyph atlas (WebGL2 fallback):** not present. Rendering is Canvas2D `Path2D` per glyph per frame (no atlas). D-3 marks it "planned".
- **"Stronger and faster than xterm.js":** no benchmarks. Per-glyph path filling is likely slower.
- **"UAX #9":** true for embedding levels only. The paragraph direction deliberately deviates (majority rule).
- **Parity with termenal-Ar:** asserted in comments. The sibling's code is not in this repo, so this cannot be checked here.

## What we can learn / reuse
- The **logical buffer → per-row `colToVisual`/`visualToCol` permutation** is a clean, testable model for the cursor, hit-testing and logical
  copy. It is worth adopting as our reference design (MIT, so reusable with attribution).
- The **"physical vs paragraph" split** is an honest acknowledgement of the TUI problem: never reorder across app-placed columns. Its trigger
  is heuristic (bg colour / box chars), but the idea is sound. Compare it with an explicit opt-in such as BiDi-mode escape sequences
  (ECMA-48 / Terminal-wg BiDi proposal).
- harfbuzzjs gotcha, documented at `packages/shaping/src/index.ts:79-86` and in the spike README: the direction must be the numeric enum
  and must be set before `guessSegmentProperties`, or the buffer stays unshaped.
- An LTR fast path (`hasAnyStrongRtl`, skip bidi when there is no code point ≥ U+0590) is cheap and worth copying.
- The test patterns check "joined glyph ids ≠ isolated glyph ids" and "no `.notdef`". They are a good, font-dependent shaping smoke test.

## Limitations & anti-patterns
- The **majority-strong paragraph direction** is non-standard. It conflicts with UAX #9 P2/P3 and with what apps (and FriBidi) expect.
  A mostly-Persian line that starts with `git` flips to RTL.
- **Terminal-side bidi on all plain output** (paragraph mode) re-orders text that a bidi-aware app may already have ordered, which means
  double reordering. There is no escape sequence to let apps own bidi.
- **Glyphs are not fitted to cells**, so Arabic runs drift past or short of their cell span. Background, cursor and selection rects are
  per cell, so they will visibly misalign with the glyphs.
- The TUI detection heuristic is fragile. A plain Arabic line with a coloured prompt background silently switches modes.
- It has no IME, no normalization, and RTL ranges are hard-coded tables rather than Unicode `Bidi_Class` data (e.g. Persian-relevant
  U+08A0+ is covered, but the classification is coarse).
- On the positive side, it does **not** use presentation-form substitution or visual-order buffer hacks. The buffer stays logical.
- Maturity: one shallow commit, demo-grade, Windows-oriented (spike font paths `C:\Windows\Fonts`, ConPTY default).
