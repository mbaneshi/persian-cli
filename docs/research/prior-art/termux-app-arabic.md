# termux-app-arabic
- **Repo:** https://github.com/kimo0076/termux-app-arabic · **Commit read:** `9b324e9` (single squashed commit, 2026-06-21, "Termux with Arabic BiDi rendering + UI features") · **License:** GPLv3-only inherited from upstream `LICENSE.md` (unchanged); upstream lists `terminal-view`/`terminal-emulator` as Apache-2.0 exceptions, `termux-shared` as mostly MIT. GitHub shows NOASSERTION only because the licence file is prose Markdown. · **Language:** Java · **Platform:** Android
- **Category:** terminal emulator (fork)

## What it is
A fork of termux/termux-app that adds a bidi-aware row renderer to `terminal-view`. Arabic glyph shaping is left to Android's own text stack (`Canvas.drawTextRun`, i.e. Minikin + HarfBuzz). The README is the upstream Termux README and never mentions the feature. The marketing claims ("UAX #9 + HarfBuzz", "prompt protection", "cursor isolation", "cached layout") appear only in the app UI: `app/src/main/res/values/strings.xml:240-246` (What's New) and `SettingsActivity.java:128-139` (About, with a developer credit). The repo has no native code, no HarfBuzz/ICU/FriBidi bindings and no CMake changes. The only JNI code is upstream's (`termux.c`, `termux-bootstrap.c`, `local-socket.cpp`).

The fork adds three code files and makes one large edit:
- `terminal-view/.../view/textrender/BiDiTextHelper.java` (58 lines): Arabic codepoint-range detection.
- `terminal-view/.../view/textrender/ArabicTextShaper.java` (305 lines): a Presentation-Forms-B reshaper. **It is never called anywhere** (dead code).
- `terminal-view/.../view/TerminalRenderer.java`: a new layout and render path for rows that contain Arabic.
- UI-only additions: `WhatsNewActivity.java` and strings.

## How it works (verified in code)
1. **Trigger (heuristic gate).** `TerminalRenderer.render` sends a row to `renderRowBidi` only if `BiDiTextHelper.containsRtlCharacters` finds a char in U+0600–06FF, 0750–077F, 08A0–08FF, FB50–FDFF or FE70–FEFF (`TerminalRenderer.java:134`, `BiDiTextHelper.java:44-50`). Hebrew, Syriac, Thaana and N'Ko rows skip bidi entirely, even though the comments say "RTL". Every other row uses the unchanged upstream path.
2. **Paragraph = one physical screen row, base forced to LTR.** The code calls `new Bidi(text, Bidi.DIRECTION_LEFT_TO_RIGHT)` over the row's logical chars (`:336-337`). The comment block at `:311-335` gives the reasoning: the terminal is an LTR interface, prompt and shell neutrals stay at level 0, and no prompt/output classification is attempted. This is real UAX #9 (`java.text.Bidi`, which is ICU-backed on Android), but only with a fixed base level. There is no P2/P3 auto-detection, no per-application control, and no handling of soft-wrapped lines as one paragraph.
3. **Logical → cell → visual mapping.** `computeLayout` (`:267-420`) works in four steps:
   - It builds `colAt[charIdx]` and `colToCharStart/End[col]` from `WcWidth`, folding zero-width marks into the base cell (`:280-309`).
   - It takes the bidi **runs**, measures each run's width in columns, and calls `Bidi.reorderVisually` on the runs, not on cells (`:341-362`).
   - It packs the runs left to right into visual columns.
   - It splits each run into style segments. For RTL segments it mirrors the segment's position inside the run's box (`segVisCol = V + (le - segLe)`, `:395`) and fills `logicalToVisualCol[]` (`:404-408`).
   Each Arabic letter stays one cell wide (WcWidth is unchanged).
4. **Shaping.** Each visual run is drawn with one `canvas.drawTextRun(text, start, count, 0, contextCount=charsUsed, x, y, isRtl, paint)` (`:601-603`). Because the shaping context is the full logical line, joining survives style splits. `isRtl` is recomputed with the codepoint-range heuristic, not taken from the bidi level parity (`frunIsRtl` is computed but never passed on). The bidi path passes `mes = widthCols * mFontWidth` (`:471-473`), so the scale-to-fit branch at `:551-557` never runs. Shaped Arabic is drawn at HarfBuzz's natural advance and can overflow or under-fill its cell box.
5. **"Cursor isolation".** In both paths the cursor is no longer drawn inside the text run. It is drawn afterwards as an overlay: `drawCursorOverlay` (`:624-689`) paints a rectangle and, for block cursors, redraws that one cell's text with full-line context. The purpose is to stop a run being split at the cursor, which would change a glyph's joining form ("flicker"). In the bidi path the overlay's column is `logicalToVisualCol[cursorX]` (`:478-482`), so the cursor follows the visual position of the logical cell.
6. **"Cached layout".** A `WeakHashMap<TerminalRow, RowLayout>` is checked against a char snapshot and the column count (`:52`, `:268-272`). Bidi re-runs only when the row's text changes.
7. **"Prompt protection"** is not a separate mechanism. It is simply the forced-LTR base level from step 2.
8. **Selection and copy.** Highlighting is run-granular: a whole visual run is inverted if it overlaps the visual extent of the logical selection (`:447-458`, `:470`). Touch and mouse hit-testing are unchanged (`TerminalView.java:546-553`). Pixel → column is never inverse-mapped through the bidi layout, so on reordered rows a tap or drag addresses the wrong logical cell. Mouse reports sent to applications carry those same unmapped visual columns. Copy uses upstream `TerminalBuffer.getSelectedText`, which reads the logical buffer: **copied text stays in logical order**, but the selected range can be wrong.
9. **Tests:** none added. All 19 test files in `terminal-emulator/src/test` are upstream, and `terminal-view` has no test directory.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | No changes; the buffer is stored as received |
| 2 Input (layouts, ZWNJ, IME) | ❌ | No IME, keyboard or extra-keys changes for RTL |
| 3 Width | ◐ | Upstream `WcWidth` is unchanged (letters are 1 cell, harakat 0). Shaped advance is not fitted to cells in the bidi path (`:471-473`), so app and terminal agree on cell count but glyphs drift visually |
| 4 Shaping | ✅ | Android HarfBuzz via `drawTextRun` with full-line context (`:589-603`); no presentation forms on the live path |
| 5 Bidi | ◐ | Real UAX #9 (`java.text.Bidi`) per physical row, base forced LTR. The terminal always owns bidi: no mode switch, no opt-out for apps that reorder their own output, no Hebrew |
| 6 Cursor/selection/copy | ◐ | Cursor is mapped logical → visual. Hit-testing and mouse reports are not inverse-mapped. Selection highlight is per run. Copy is logical |
| 7 Fonts | ❌ | Relies on Android system fallback; no Arabic monospace font handling |
| 8 Multiplexers | ❌ | Not considered. A tmux/zellij split is one row to the terminal, so RTL runs can merge across pane borders |
| 9 Apps & TUIs | ❌ | Applied unconditionally, including on the alternate screen; no DECSET/BDSM-style control |

## Claimed but not verified
- **"HarfBuzz" (strings/About):** true only indirectly, through Android's platform text stack. Nothing is bundled or called directly.
- **"Full BiDi (UAX #9) stability":** the algorithm is UAX #9, but the paragraph model is a fixed-LTR, per-row approximation (see Limitations).
- **"Correct handling of RTL/LTR mixed commands":** holds for simple cases. Hit-testing and selection are incorrect on reordered rows.
- **"Cached layout … deterministic":** the cache key ignores styles (see Limitations), so the output can be stale.
- **"Production-grade" (GitHub description):** no tests, a single squashed commit, dead code left in, and the README was never updated.

## What we can learn / reuse
- **Answer to "paragraph = what?"** Here a paragraph is one physical row with base level 0 (LTR). Its useful consequence is **containment**: under an LTR base, reordering only happens *inside* the columns that an RTL run spans. LTR prompts, shell syntax and box borders next to LTR context keep their cells, and the cell grid and app cursor addressing stay intact. That is a cheap, TUI-tolerant default worth benchmarking against the Freedesktop/BDSM "implicit mode, LTR base" proposal.
- **Reorder whole runs, not individual cells.** Shape each run with full-line logical context, draw it at the run's visual box, and keep the buffer logical. This is the right split between the layout layer and the shaping layer.
- **Draw the cursor as an overlay, after the text.** This stops the cursor from splitting runs, which would otherwise change a glyph's joining form on every cursor move. Worth copying.
- **Build a `logicalToVisualCol` map per row**, used for the cursor and selection. The same map, inverted, is what hit-testing needs.

## Limitations & anti-patterns
- **Neutrals between RTL text get absorbed into the RTL run (UAX #9 rule N1).** A border such as `│`, `|` or spaces lying between two Arabic cells becomes part of the RTL run and is reversed with it. Examples: tables with Arabic in adjacent columns, side-by-side panes, Arabic on both sides of a separator.
- **Hidden visual-order assumptions.** Pixel → cell mapping (`getColumnAndRow`) and mouse reports ignore the layout, so the app sees visual columns as if they were logical.
- **The cache ignores styles.** The key is text plus columns only (`:269-270`), so a colour or attribute change on unchanged text renders with stale styles.
- **Hard-coded Arabic ranges** stand in for the Bidi_Class property in two places, and `isRtl` comes from those ranges rather than the bidi level.
- **Dead presentation-form reshaper** (`ArabicTextShaper.java`). If it were ever wired in, it would be wrong:
  - `SHAPED_FORMS` is indexed with `c - 0x0621` (`:284`), but the table skips U+063B–063F. From TATWEEL onward every letter maps to the wrong row (FEH gets NOON's forms, MEEM gets YEH's), and U+0646 and above go unshaped.
  - The Persian letters پ چ ژ ک گ ی are unmapped.
  - Lam-alef is missing.
  - The joining logic is wrong (alef is marked "joins left", and the next character's right-joinability is ignored).
  It is a clear example of the presentation-form substitution anti-pattern.
- **No terminal/application negotiation.** Applications that reorder their own output (fribidi-processed output, Emacs, some TUIs) get reordered a second time, and full-screen apps cannot opt out.
- **Soft-wrapped logical lines are reordered row by row**, with no shared bidi context.
