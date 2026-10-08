# Prior art: Persian / RTL in the terminal

> Part of [#2](https://github.com/mbaneshi/persian-cli/issues/2) (Phase 1 root-cause map) · tracked in [#8](https://github.com/mbaneshi/persian-cli/issues/8) · read on 2026-10-08

## Method

The starting list came from an LLM conversation, so **nothing in it was taken on trust**. For each project we:

1. confirmed the repository exists and recorded its metadata;
2. took a shallow, read-only clone (nothing was built, installed or run);
3. read the implementation itself, cited file paths and line numbers, and kept **verified in code** separate from **claimed in the README**;
4. scored it against our [nine layers](../../README.md#the-problem-map) and our [principles](../../README.md#principles).

The deep notes, one file per project, live in [`prior-art/`](prior-art/), with Persian translations in [`prior-art/fa/`](prior-art/fa/). Each one records the commit that was read. The website renders these files directly: [Prior work](https://mbaneshi.github.io/persian-cli/prior-work/) ([فارسی](https://mbaneshi.github.io/persian-cli/fa/prior-work/)).

## Catalog

| Project | Category | Platform | Shaping | Bidi | License | Verdict |
|---|---|---|---|---|---|---|
| [RtlTerminal](prior-art/rtlterminal.md) | terminal emulator | Windows (WPF + ConPTY) | WPF `FormattedText`, per word | heuristic (hand-rolled) | MIT | **Most serious prior art.** Logical buffer, logical copy, visual→logical mouse mapping. But its bidi isn't UAX #9, it reorders even on the alternate screen, and it squashes words to fit cells |
| [termenal-web](prior-art/termenal-web.md) | terminal emulator (browser prototype) | Browser + Node PTY | HarfBuzz (harfbuzzjs), per bidi run | UAX #9 levels (bidi-js); paragraph direction by majority heuristic | MIT | **Best reference design:** logical buffer + per-row `colToVisual`/`visualToCol` map, logical copy. The WASM core and WebGPU renderer it claims are absent |
| [termux-app-arabic](prior-art/termux-app-arabic.md) | terminal emulator (Android fork) | Android | Platform HarfBuzz (`drawTextRun`, full-line context) | UAX #9 (`java.text.Bidi`), row = paragraph, base forced LTR | GPLv3 | ~300 useful lines of renderer proof of concept. Input/selection not mapped back; no tests; applied unconditionally |
| [Tarminal](prior-art/tarminal.md) | terminal emulator (SwiftUI shell over SwiftTerm) | macOS | none in repo (claims Core Text via SwiftTerm) | none | MIT | A wrapper with no Arabic, bidi or width code of its own. The thing to study is SwiftTerm |
| [Terminal-ar](prior-art/terminal-ar.md) | overlay renderer (DOM over xterm.js, Electron) | Windows/Linux | Chromium (via DOM spans) | heuristic, per span | **none** (claims MIT, no LICENSE) | Not reusable. Cursor mirror disagrees with the text; no tests |
| [ar-terminal](prior-art/ar-terminal.md) | overlay renderer + PTY transform (VS Code) | VS Code | Path A: Chromium · Path B: presentation forms | Path A: Blink per row · Path B: bidi-js, baked into the stream | **none** (claims MIT, no LICENSE) | Not reusable. Path A keeps copy logical but cursor/selection misalign; Path B is the anti-pattern |
| [estaterm](prior-art/estaterm.md) | PTY proxy | Linux | FriBidi → **presentation forms** | UAX #9 (FriBidi), per escape-delimited chunk | Apache-2.0 | Textbook visual-order hack; skips the alternate screen. Only the FriBidi call sequence is worth reusing |
| [bidiscope](prior-art/bidiscope.md) | library + xterm.js overlay | JS / browser | hand-rolled table → **presentation forms** | hand-rolled UAX #9 subset (no BD13) | MIT | Right instinct (an overlay keeps the buffer logical), wrong execution; its "99.91 % conformance" claim is unverified |
| [fa-console](prior-art/fa-console.md) | in-process stdout transform (Python) | Windows console | arabic-reshaper / table → **presentation forms** | python-bidi (UAX #9) or whole-line reversal | MIT | Reusable for **Layer 1** (UTF-8 setup, ي/ك → ی/ک, digit folding). The display path is a visual-order hack that corrupts ANSI |
| [rtl-terminal](prior-art/rtl-terminal.md) | Claude Code plugin (prompt only) | Claude Code | none | asks the model to emit UAX #9 controls | MIT | Markdown only: no hook, no detection. Mutates content and can't be enforced. Its LRI-around-paths guidance and test corpus are worth taking |


## Layer coverage

✅ solid · ◐ partial · ❌ absent · ? not determinable from the repo

| Project | 1 Enc | 2 Input | 3 Width | 4 Shape | 5 Bidi | 6 Cursor/copy | 7 Fonts | 8 Mux | 9 Apps/TUI |
|---|---|---|---|---|---|---|---|---|---|
| RtlTerminal | ◐ | ◐ | ◐ | ✅ | ◐ | ✅ | ◐ | ❌ | ◐ |
| termenal-web | ❌ | ◐ | ◐ | ✅ | ◐ | ✅ | ◐ | ❌ | ◐ |
| termux-app-arabic | ❌ | ❌ | ◐ | ✅ | ◐ | ◐ | ❌ | ❌ | ❌ |
| Tarminal | ? | ? | ? | ? | ❌ | ? | ◐ | ❌ | ? |
| Terminal-ar | ❌ | ❌ | ❌ | ◐ | ◐ | ◐ | ◐ | ❌ | ◐ |
| ar-terminal | ❌ | ◐ | ❌ | ◐ | ◐ | ◐ | ◐ | ❌ | ◐ |
| estaterm | ❌ | ◐ | ❌ | ◐ | ◐ | ❌ | ❌ | ❌ | ◐ |
| bidiscope | ❌ | ❌ | ❌ | ◐ | ◐ | ◐ | ❌ | ❌ | ◐ |
| fa-console | ✅ | ◐ | ❌ | ◐ | ◐ | ◐ | ◐ | ❌ | ❌ |
| rtl-terminal | ❌ | ❌ | ❌ | ❌ | ◐ | ❌ | ❌ | ❌ | ◐ |

## What the field tells us

1. **Two families, and the evidence agrees with Principle 1.** *Logical-buffer renderers* (RtlTerminal, termenal-web, termux-app-arabic, ar-terminal path A, the bidiscope and Terminal-ar overlays) keep the stored text logical and copy correctly. *Stream transformers* (estaterm, fa-console, ar-terminal path B, the bidiscope shaper) write presentation forms and visual order into the terminal, which breaks copy, search and ANSI sequences, and they all give up on full-screen apps. Every project that rewrote the text paid for it.
2. **Layer 3 (width) is unsolved everywhere.** No project reconciles the shaped advance width with the cell grid. They squash glyphs (RtlTerminal), clip them (Terminal-ar), or let them overflow (termenal-web, termux). This is the core research question for Phase 1.
3. **Layer 8 (multiplexers) is untouched: 0 of 10.** Every terminal-side implementation treats a physical row as the bidi paragraph, so a tmux/Zellij split would merge RTL runs across pane borders. Nobody has looked at this.
4. **Bidi ownership is never negotiated.** Every terminal-side implementation applies bidi unconditionally (or by heuristic), including on the alternate screen. None implements the explicit-mode switching of the [BiDi in Terminal Emulators](https://terminal-wg.pages.freedesktop.org/bidi/) draft. Paragraph direction is guessed by majority vote. This is the "two owners" failure the README describes.
5. **Input (Layer 2) is almost entirely ignored.** No project handles IME composition, ZWNJ entry or logical cursor movement on input.
6. **READMEs overstate.** Tarminal (no shaping code), termenal-web (no WASM/WebGPU), bidiscope (unverified 99.91 %), termux-app-arabic ("production-grade"), and Terminal-ar / ar-terminal (claim MIT, ship no license). Our scorecard (Phase 1) has to **measure**, never trust claims, including our own.

## Worth reusing or learning from

| From | What | Layer |
|---|---|---|
| termenal-web | Per-row `colToVisual` / `visualToCol` permutation; shaping per bidi run with explicit direction | 5, 6 |
| RtlTerminal | Logical selection offsets and visual→logical mouse mapping, with tests; marks/ZWNJ = 0 width | 3, 6 |
| termux-app-arabic | Shape whole runs with full-line context; draw the cursor as an overlay; force an LTR base so reordering stays local | 4, 5 |
| fa-console | UTF-8 code page/stream setup; ي/ك → ی/ک and digit folding; the rule "program data stays logical" | 1 |
| estaterm | The FriBidi call sequence (not its output path) | 5 |
| rtl-terminal | LRI…PDI isolation around paths and code; a before/after test corpus | 5, test corpus |

Licenses matter for reuse: Terminal-ar and ar-terminal have no license and can only be cited; termux-app-arabic is GPLv3.

## Foundations and history (not cloned)

- **Neovim [#553](https://github.com/neovim/neovim/issues/553), "Bidi language support"**: open since 2014-04-17, with 47 comments. Verified on GitHub on 2026-10-08.
- **[BiDi in Terminal Emulators](https://terminal-wg.pages.freedesktop.org/bidi/)** (Egmont Koblinger, 2019): the draft standard for terminal vs. app bidi ownership. It's implemented in VTE; none of the projects above use it.
- **Engines:** [HarfBuzz](https://harfbuzz.github.io/) (shaping), [FriBidi](https://github.com/fribidi/fribidi) and [ICU](https://icu.unicode.org/) (UAX #9), plus platform shapers (Core Text, DirectWrite, Android's HarfBuzz). Every serious project above delegates to one of these. None of them hand-rolls shaping successfully.
