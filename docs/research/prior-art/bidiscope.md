# bidiscope
- **Repo:** https://github.com/fmoed/bidiscope (package.json points at `DADiS0/bidiscope`) · **Commit read:** 70ff6c5 (2026-04-25) · **License:** MIT · **Language:** TypeScript (zero runtime deps) · **Platform:** JS/Node ≥18 library + browser xterm.js addon
- **Category:** library + overlay renderer (`@bidiscope/core` is a string transform; `@bidiscope/xterm` is a DOM overlay over xterm.js)

## What it is
Two packages: `packages/core` (a hand-written UAX #9 subset, an Arabic presentation-form shaper, ANSI strip/re-inject, and "code-context" heuristics) and `packages/xterm` (an xterm.js addon that paints visually reordered text in DOM `<div>`s over RTL rows). The README markets four packages. Only these two exist (`ls packages` → `core xterm`).

## How it works (verified in code)
- **Pipeline (`core/src/index.ts:57-175`):** strip ANSI → code points → classify → optional code-context type overrides → paragraph level → embedding levels → **shape to presentation forms** → reorder → re-inject ANSI. Output is a `visual` string plus levels and runs.
- **Bidi classes (`core/src/types.ts`):** no UCD data. There's a hand-filled `Uint8Array` for U+0000–07FF (`:20-173`) and about 50 hand-picked ranges above that (`:194-267`); everything else defaults to `L`. Defects we found on reading:
  - Thaana, NKo and U+0300–036F combining marks appear in the slow-path list, but the fast path catches every `cp < 0x800` first (`:279-281`). That makes Thaana (U+0780–07BF) and U+0300–036F `L`.
  - Hebrew presentation forms U+FB1D–FB4F are missing, so they fall to `L`.
  - U+08A0–08FF is all `AL`, including its NSMs (`:196`).
  - U+FEFF is `AL` (`:218`).
  - Arabic Extended-B, Samaritan, Syriac Supplement, Adlam and others are absent.
- **Algorithm (`core/src/bidi.ts`):** X1–X8 use a proper directional status stack with overflow counters (`:96-256`). The W1–W7, N0, N1/N2 and I rules run over the **whole paragraph as one sequence**. There are no isolating run sequences (BD13), so isolates and embeddings leak into weak/neutral resolution:
  - W5 only extends ET by one neighbour (`:312-329`).
  - N1 ignores EN/AN acting as R (`:451-466`).
  - N0 bracket pairing (`:355-443`) uses a 10-entry `BRACKETS` table that **adds `<`/`>`** (`constants.ts:81-82`). Those aren't UCD paired brackets; it's a deliberate non-conformance for code.
  - L4 mirroring uses a 14-entry table (`bidi.ts:19-34`), not `BidiMirroring.txt`.
  - L1 and L2 are implemented (`:489-596`).
  - Verdict: **UAX #9-shaped but partial**, best described as a careful heuristic.
- **Conformance test (`core/tests/conformance.test.ts`):** runs `BidiCharacterTest.txt` (vendored) but asserts only **>85 % level / >80 % reorder** pass (`:173, :180`). `BidiTest.txt` is vendored too, and nothing references it.
- **Shaping (`core/src/shaper.ts`):** a hand table of about 50 letters (Arabic plus Persian پ چ ژ ک گ ی and some Urdu) mapped to **U+FB50–FDFF / U+FE70–FEFF presentation forms** (`:78-132`), with lam-alef ligatures (`:137-143`). It's on by default (`index.ts:61-67`; `'auto'` = presentation forms, `constants.ts:111-116`).
  - **Bug:** a right-joining letter with joining neighbours on both sides gets the "Medial" slot. Its medial slot is `0`, so the code falls back to *Isolated* (`shaper.ts:166-174, 246-247`). So ا/د/ر/و inside a word (e.g. «باب») render isolated, not final.
  - ZWJ (U+200D) is non-joining. Transparent marks are only partly covered (`:149-160`).
- **ANSI handling (`core/src/ansi.ts`):** one regex, `\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)|\([A-Za-z])` (`:26`).
  - It misses CSI with `<`, `=`, `>`, `:` (SGR colon sub-params such as `38:2::r:g:b`), or intermediates (`CSI 2 SP q`). It also misses DCS, APC and other 2-byte escapes.
  - Unmatched bytes leak into the text and get reordered.
  - Re-injection puts each sequence at `positionMap[origPos]` (`:75-108`). SGR start/end pairs that bracket an RTL run land in visual positions that no longer enclose the run, so colour spans get scrambled.
  - Index spaces are mixed. Strip positions count UTF-16 units, `positionMap` counts post-shaping code points, and inject walks UTF-16 units. Astral characters or lam-alef ligatures (which shift indices; `index.ts:149-153, 202-227`) misplace escapes.
- **Code context (`core/src/code-context.ts`):** regex-like scanning for quotes, comments, paths and URLs. It forces bidi types to `L` (`:145-184`). `isCodeLine` forces an LTR paragraph if the line starts with an ASCII letter, `_`, `$`, `#` or `//` (`:193-215`). That means *any* line starting with an English word becomes LTR.
- **xterm addon (`packages/xterm/src`):**
  - On `onRender`/`onWriteParsed`/`onScroll` (debounced 16 ms), it reads each visible row via `line.translateToString(true)` (`processor.ts:57`). It calls `resolveBidi` with `codeContext:true, shaping:true, shapingMode:'presentation-forms', preserveAnsi:false` (`:65-72`). The comment above it says "HarfBuzz handles joining", which contradicts the code.
  - It draws `visual` into an absolutely positioned DOM div per row with an opaque background, `direction:ltr; unicode-bidi:bidi-override` (`overlay.ts:99-123`).
  - **The xterm buffer is never modified** (`overlay.ts:8-11`), so copy reads logical text.
  - The overlay is proportional text flow, not cell-snapped. `cellWidth` is measured (`index.ts:134-139`) but never used for layout, and the overlay has one fg colour (`overlay.ts:110-111`), so all SGR colour is lost.
  - Selection highlight and cursor are still drawn by xterm at *logical* cell positions underneath.
  - It processes per buffer row (wrapped lines get separate paragraphs), including the alternate screen (`buffer.active`).
  - `BidiAddonOptions.codeContext/shaping` are stored (`index.ts:51-57`) but never passed to the processor.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | No normalization; JS strings in; `toCodepoints` only (`shaper.ts:286-294`) |
| 2 Input (layouts, ZWNJ, IME) | ❌ | No input handling in either package |
| 3 Width | ❌ | README claims "Terminal cell-width calculation ✅", UAX #11 "Full", UAX #29 "Grapheme clusters" (`README.md:308, 461-462`). No width/grapheme code exists; the overlay ignores `cellWidth` |
| 4 Shaping | ◐ | Hand table → presentation forms (`shaper.ts`), with the R-joining medial→isolated bug; `'logical'` mode can turn it off (`index.ts:67`) |
| 5 Bidi | ◐ | Hand-rolled UAX #9 subset, no BD13 run sequences, partial UCD (`bidi.ts`, `types.ts`); test gate 85 % |
| 6 Cursor/selection/copy | ◐ | Overlay keeps the buffer logical, so copy is correct (`overlay.ts:8-11`); selection/cursor visuals misalign with the overlay; core's `visual` string is visual-order and unsafe to copy |
| 7 Fonts | ❌ | Uses xterm's `fontFamily`; no fallback logic |
| 8 Multiplexers | ❌ | Not considered |
| 9 Apps & TUI | ◐ | xterm.js addon only; alt-screen rows are overlaid per row too (TUI borders can scramble); no CLI/agent wrapper exists |

## Claimed but not verified
- "99.91 % (91,620/91,707) Unicode BiDi conformance" (`README.md:22, 400, 460`). Not reproducible from the repo; the test gates at 85 %/80 %, and the architecture (no isolating run sequences, partial class table) makes 99.9 % implausible. **Treat as unverified.**
- UAX #11 "Full", UAX #29 "Grapheme clusters", "Terminal cell-width calculation" (`README.md:308, 461-462`): no such code.
- `@bidiscope/cli` (`bidiscope -- claude …`, stdin pipe) and `@bidiscope/ai-agent` (`README.md:236-239, 338-348`): don't exist; the roadmap marks them "Coming in Phase 3/4".
- The README addon options `autoDetect`/`codeAware` (`README.md:325-331`) don't match the real `BidiAddonOptions`.
- "ANSI Escape Preservation ✅" vs FriBidi/ICU: partial regex; colour spans get misplaced after reorder.

## What we can learn / reuse
- **The overlay idea is the right instinct.** It leaves the terminal buffer logical and fixes only the *paint*, so copy/paste stays correct. For xterm.js (VS Code, Cursor, web terminals) a renderer-level addon is the plausible path. It needs to be done per cell with HarfBuzz/browser shaping and real UAX #9 (e.g. ICU4X or `unicode-bidi` via WASM), not presentation forms.
- Vendored `BidiTest.txt` + `BidiCharacterTest.txt` and a conformance harness that reports the pass rate are a good pattern. We'd gate at 100 % with a real engine.
- The "code-context" problem statement (paths, URLs and quoted strings in mixed RTL prose from AI agents) is a real Layer-9 use case. The *right* answer is isolates (FSI/PDI) emitted by the producer, not classifier overrides.
- The `shapingMode: 'logical'` switch acknowledges that renderers with real shaping shouldn't get presentation forms.

## Limitations & anti-patterns
- **Presentation-form substitution by default**, even when the target is a browser DOM that shapes natively.
- `resolveBidi().visual` is **visual-order text** meant to be printed. Any CLI/agent use of core (as the README pitches) puts reversed, pre-shaped text into scrollback, logs and the clipboard.
- A hand-maintained Unicode table with gaps (Thaana, combining marks, Hebrew presentation forms) instead of generated UCD data.
- Code-context heuristics deliberately break UAX #9 (`<`/`>` as brackets, ASCII-first lines forced LTR).
- ANSI re-injection by index mapping can't keep SGR spans correct across reordering.
- The marketing (conformance %, width, CLI, agent middleware) runs well ahead of the code.
