# RtlTerminal
- **Repo:** https://github.com/mirbehnam/RtlTerminal · **Commit read:** `a5be441` (2026-09-27, shallow) · **License:** MIT (`LICENSE`, "PersianTerminal contributors"; the Arabic README section still says no license file exists) · **Language:** C# (.NET 8, WPF) · **Platform:** Windows 10 1809+ / 11 (ConPTY)
- **Category:** terminal emulator

## What it is
A standalone Windows terminal emulator (WPF + ConPTY) built by a Persian developer specifically so Persian/Arabic output from shells and AI CLIs (Codex, Claude, OpenCode) renders joined and in readable order. It owns its own VT parser, cell buffer and a custom row renderer. About 5.4k lines of app C# plus ~800 lines of tests; version 1.0.7 (`RtlTerminal.csproj:25`).

## How it works (verified in code)
- **Pipeline:** ConPTY (`ConPtySession.cs:65`, UTF-8 in/out at `:179`) → hand-written VT parser + logical cell grid (`TerminalBuffer.cs`) → immutable `TerminalSnapshot` of `TerminalLine`s made of styled runs → `TerminalView` lays out and draws only visible rows (`TerminalView.cs:283-350`, `:376-417`).
- **The buffer stays logical.** Cells are written in arrival order (`TerminalBuffer.cs:695-776`); no reordering happens in the buffer. All direction work is a render-time view transform.
- **Bidi = hand-rolled heuristic** (`SmartRtl.cs`):
  - Strong RTL = any letter category in U+0590–08FF, FB1D–FDFF, FE70–FEFF, 10800–10FFF, 1E800–1EEFF (`SmartRtl.cs:240-260`). Every other letter **and every digit** (including Arabic-Indic/Persian digits) is strong LTR (`:98-118`).
  - Paired brackets `()[]{}<>` take the direction of their contents if uniform (`:120-192`) — a simplified N0.
  - Neutral runs: same direction on both sides → that direction; else LTR if no whitespace and touching LTR; else paragraph base (`:194-238`) — a simplified N1/N2.
  - Output is a flat list of LTR/RTL spans — no embedding levels, no explicit formatting chars (LRI/RLI/FSI/PDI, LRE/RLE…), no W1–W7 number handling, no L1 whitespace reset.
- **Paragraph direction / alignment:** per line. Smart RTL (default on) makes a line RTL-based if it contains any strong RTL letter, and right-aligns it (`SmartRtl.cs:18-26`, `TerminalView.cs:292-295`). "Row RTL" forces RTL base + right alignment for every row. With base RTL the span list is reversed (`TerminalView.cs:311`); inside an RTL span cells are placed right-to-left (`:320`).
- **Width / cells:** grapheme clusters via `StringInfo.GetTextElementEnumerator`; width = max `GetCellWidth` of the runes (`TerminalView.cs:302-308`). `GetCellWidth` (`TerminalBuffer.cs:797-816`): Mn/Mc/Me = 0, ZWSP/ZWNJ/ZWJ/WJ/BOM and all Cf = 0, a hard-coded East-Asian/emoji range table = 2 (`:821-835`), else 1. Arabic letters = 1 cell; harakat attach to the previous cell (`AppendCombiningCharacter`, `:778-790`).
- **Shaping:** each RTL span is split into whitespace / non-whitespace segments; every word is drawn as one WPF `FormattedText` with `FlowDirection.RightToLeft` (`TerminalView.cs:325-345`, `:453-458`), so WPF's text stack does joining, ligatures and font fallback. Styles are applied per sub-range so ANSI color changes inside a word do not break joining (`:459-472`). Spaces keep exact cell width.
- **Width reconciliation hack:** the shaped word's natural advance is **horizontally scaled** with a `ScaleTransform` to exactly fill its cell budget (`TerminalView.cs:493`, `:510`). Per-character hit boxes are then re-derived from `BuildHighlightGeometry` on the shaped text (`:495-508`).
- **Latin/box-drawing** glyphs are drawn per cell at exact boundaries (`:323-324`); box and block characters are drawn geometrically (`DrawBlock`/`DrawBox`).
- **Selection & copy:** selection anchors are `(row, logical UTF-16 offset)` (`TerminalView.cs:19`, `:271-281`); highlight paints each cell whose logical range is selected wherever it lands visually (`:401-407`); `GetSelectedText` slices the **logical** row string (`:191-205`). Copy is logical order. Test asserts it (`tests/RtlTerminal.RenderTests/Program.cs:167-168`).
- **Cursor:** maps the logical `CursorColumn` to the visual cell covering it (`TerminalView.cs:408-415`).
- **Mouse reporting to TUIs:** visual X is mapped back to a **logical column** through the same layout before being sent to the app (`TerminalView.cs:148-174`, comment "TUI applications receive logical terminal columns").
- **Alternate screen (vim, htop, OpenCode):** right-alignment is disabled, but span reordering still happens within the grid (`SmartRtl.ShouldRightAlign`; render test `Program.cs:231-236` asserts alternate-screen ordering equals main-screen ordering).
- **Input:** text from WPF `PreviewTextInput` (OS layout/IME output) is sent verbatim as UTF-8 (`MainWindow.xaml.cs:365-373`); IME-processed keys are unwrapped (`:1279`). One Persian-layout fix: Shift+/ under an `fa` input language sends U+061F `؟` (`:1247-1256`). No ZWNJ shortcut.
- **VT coverage:** DEC private modes 1, 6, 7, 25, 47, 1000/1002/1003/1004/1006, 1047–1049, 2004, 2026 (`TerminalBuffer.cs:651-652`); bracketed paste, SGR mouse, focus reporting, sync output.
- **Fonts:** any installed Windows font; emoji forced to Segoe UI Emoji (`TerminalView.cs:455`); otherwise WPF font fallback (`docs/renderer.md`).

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ◐ | UTF-8 decode/encode at PTY boundary (`ConPtySession.cs:179`, `MainWindow.xaml.cs:1532`); no Unicode normalization anywhere |
| 2 Input | ◐ | OS IME text passed through (`MainWindow.xaml.cs:365`); Persian `؟` fix (`:1247`); no ZWNJ binding, no logical cursor-movement aid |
| 3 Width | ◐ | Grapheme-aware, marks/ZWNJ = 0 (`TerminalBuffer.cs:797`); hard-coded wide table, no EAW/Unicode version sync with apps; shaped width forced to cell count by scaling |
| 4 Shaping | ✅ | WPF `FormattedText` RTL per word, style-split without breaking joins (`TerminalView.cs:325-345`, `:453-472`); no presentation-form substitution |
| 5 Bidi | ◐ | Hand-rolled heuristic, not UAX #9 (`SmartRtl.cs`); terminal owns it unconditionally — also on the alternate screen; no opt-out escape (mode 2500 etc.) |
| 6 Cursor/selection/copy | ✅ | Logical offsets for selection and copy, tested (`TerminalView.cs:191-205`; `RenderTests/Program.cs:163-168`); cursor + mouse reports mapped visual→logical (`:148-174`, `:408-415`) |
| 7 Fonts | ◐ | User font + WPF fallback + Segoe UI Emoji; no Persian-specific fallback chain |
| 8 Multiplexers | ❌ | Nothing tmux/zellij-aware; a multiplexer's whole screen would be treated as alternate-screen rows and reordered per row (breaking pane borders across panes) |
| 9 Apps & TUI frameworks | ◐ | ConPTY TUIs run; mouse coordinates translated; but bidi reorder inside the app's grid means TUI column assumptions break for RTL rows |

## Claimed but not verified
- "Keeping English fragments, numbers and punctuation in their correct direction" — only under the simplified rules above; Persian digits are treated as LTR letters, and numeric separators (`1,234`, `۱۲/۳۴`) have no W-rules.
- Real-world correctness with OpenCode/Claude/Codex: `docs/renderer.md` itself says the smoke tests "do not replace interactive checks … IME input, clipboard operations, multiple DPI settings, and different fonts".
- Render tests produce PNGs offscreen; no pixel-diff baselines were inspected (cannot run here — Windows/WPF).

## What we can learn / reuse
- **Logical buffer, visual render, logical copy** — the correct split, and cleanly implemented: selection anchors in logical offsets, highlight painted per visual cell. Good model for layer 6.
- **Visual→logical mouse translation** before reporting to the app (`TerminalView.cs:148`) — a detail most RTL terminal attempts miss.
- **Shape per word, style per sub-range** so an SGR change mid-word does not break Arabic joining — directly relevant to our shaping layer.
- **Keep spaces at exact cell width** while shaping words — avoids proportional fallback fonts stretching gaps.
- **Test fixtures:** "real Codex Persian output with ZWNJ", "mixed-text selection round-trips logically", "alternate screen does not change ordering" (`tests/RtlTerminal.RenderTests/Program.cs:111-170`, `:216-240`) — worth copying as cases into our conformance corpus.
- Persian-layout `?`→`؟` remap is a tiny but real layer-2 papercut to catalogue.

## Limitations & anti-patterns
- **Heuristic bidi instead of UAX #9** (no levels, no isolates, no number rules) — exactly what our principles reject; should be ICU/FriBidi/`unicode-bidi`.
- **Terminal-side bidi forced onto full-screen apps** with no BiDi-mode negotiation (no ECMA-48 SCP/BDSM, no DEC mode 2500/2501). An app that does its own bidi (or draws a table with RTL cells) gets double-reordered; vim cursor positions and cell columns diverge visually.
- **"Any RTL letter ⇒ RTL paragraph + right-align"** per physical row: a wrapped logical line can flip alignment between rows; one Arabic word in an English log line flips the whole line.
- **Horizontal glyph scaling** to make shaped text fit `n × cellWidth` — distorts letterforms (compressed/stretched words); a sign that width (layer 3) is not agreed with the app, only papered over.
- Hard-coded wide-char ranges, no Unicode-version alignment with `wcwidth` in the app side.
- Windows/WPF only; zero reusable library surface (everything is internal to the app).
