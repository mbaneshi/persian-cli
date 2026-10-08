# fa-console
- **Repo:** https://github.com/Padandish/fa-console (PyPI `fa-console` 2.2.0) · **Commit read:** 007d75a (2026-09-09) · **License:** MIT · **Language:** Python ≥3.8, single file `fa_console.py` (1,331 lines) · **Platform:** Windows (classic conhost + VS Code terminal); a no-op elsewhere unless forced
- **Category:** output transform (in-process `sys.stdout` wrapper) + library

## What it is
An import-time fixer for Python programs on Windows. It does two things:
- **Encoding:** sets the console code page to UTF-8, reconfigures the std streams, pins `PYTHONUTF8`/`PYTHONIOENCODING`, and sets a TrueType console font.
- **Display:** installs a `VisualStream` on `sys.stdout`/`sys.stderr` that converts every write to *visual order* with presentation-form shaping.

It also ships a live-echo line editor (`fa_input`) and a Persian/Arabic lookalike normalizer (`fa_normalize`).

## How it works (verified in code)
- **Auto-setup on import:** `setup_console()` runs at module import (`fa_console.py:1305-1308`). It writes `os.environ["PYTHONIOENCODING"]="utf-8"` and `PYTHONUTF8="1"` (`:1087-1088`). On Windows it calls `SetConsoleOutputCP/SetConsoleCP(65001)` (`:432-459`) and `SetCurrentConsoleFontEx("Courier New")` (`:462-527`, `_DEFAULT_FONT` at `:235`). Then it calls `stream.reconfigure(encoding="utf-8", errors="replace")` on all three streams (`:549-583`).
- **When the visual transform is on (`:1110-1127`):** `FA_CONSOLE_NO_VISUAL` / `FA_CONSOLE_FORCE_VISUAL` override. Otherwise it's on only on Windows, when `stdout.isatty()`, and not a "modern terminal". `_modern_terminal()` = `WT_SESSION` set, or any `TERM_PROGRAM` other than `vscode` (`:586-602`). Pipes and files stay logical (`:101-104` contract, `:1121`).
- **Two backends (`_VisualTransformer`, `:633-851`):**
  - **Optional:** `arabic_reshaper.ArabicReshaper({"language":"Farsi"})` + `bidi.algorithm.get_display` (`:658-679`, extras in `pyproject.toml`). This is real UAX #9 via python-bidi, but it still emits *visual* order and *presentation forms*.
  - **Built-in (no deps):** `shape()` (`:710-776`) maps letters via `_DUAL_FORMS` / `_RIGHT_FORMS` / `_LAM_ALEF` to **U+FB50–FDFF / U+FE70–FEFF presentation forms** (`:258-322`). It covers Persian پ چ ژ ک گ ی ۀ, both ي/ی and ك/ک, and some Urdu. **ZWNJ breaks joining and is deleted from the output** (`:728-730`). Transparent marks are only U+064B–065F and U+0670 (`:334`). Lam-alef bug: the lookahead skips diacritics (`:750-751`), but the code then does `i += 2` (`:764`), so «لَا» would drop the alef and the fatha incorrectly.
  - **Built-in reorder (`reorder_line`, `:780-821`):** **not UAX #9.** If a line contains any RTL letter, the *whole line* is reversed. Only maximal runs of `isalnum` non-RTL chars, Persian/Arabic digits, ٫/٬ and `.`/`,` between digits are kept upright. Six ASCII brackets get mirrored. There's no paragraph-direction detection: an English sentence with one Persian word is fully reversed. Multi-word Latin phrases flip their word order, because space isn't an LTR token.
- **Granularity:** `VisualStream.write` transforms *each `write()` call* (`:901-903`) and splits on `\n` (`:844-851`). `print(a, b)` issues separate writes for values, separators and end, so one visual line can be reordered as several fragments.
- **ANSI/CSI:** not handled at all (no `\x1b` anywhere in the module). In the built-in reorder, `ESC` (<0x20) is a boundary, but `[`, digits and the final letter are ordinary characters. So `\x1b[31m` on an RTL line comes out as `31m]` followed by `ESC`: corrupted, and `[` gets mirrored. python-bidi's `get_display` is equally ANSI-unaware. The docs tell users to import `colorama` *after* this module (`:123-125`, `README.md:204`).
- **Input:** `_ConhostLineEditor` (`:965-1052`) reads keys with `msvcrt.getwch()`, keeps a **logical** buffer, and repaints `\r + visual(prompt+buffer)` on every keystroke. Arrows, F-keys and Tab are swallowed (no cursor movement); padding uses `len()` as the width (`:1012`). It returns logical text, optionally `fa_normalize`d (`:1154-1196`).
- **Normalization:** `fa_normalize` folds ي→ی and ك→ک, and can unify ASCII/Arabic-Indic/Persian digits; it's length-preserving `str.translate` (`:362-401`, `:1199-1245`).
- **Tests:** `tests/test_fa_console.py` covers ligatures, ZWNJ, digit separators, mirroring, env gating and normalization. Nothing tests escape sequences or mixed-direction paragraphs.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ✅ | UTF-8 code page + stream reconfigure + env pinning (`:432-459, 549-583, 1087`); ي/ك→ی/ک and digit folding (`:362-401, 1199-1245`). No NFC/NFKC, no ZWNJ normalization |
| 2 Input (layouts, ZWNJ, IME) | ◐ | Logical-buffer line editor with live visual echo (`:965-1052`); layout-variant folding; no cursor movement, no IME awareness |
| 3 Width | ❌ | `len()` used as the column count (`:1012-1016`); ZWNJ deleted from display changes cell count |
| 4 Shaping | ◐ | Presentation-form substitution (built-in tables or arabic-reshaper) |
| 5 Bidi | ◐ | python-bidi backend = UAX #9; built-in = whole-line-reversal heuristic (`:780-821`) |
| 6 Cursor/selection/copy | ◐ | Program data stays logical (good), but the console screen holds visual-order presentation forms, so copying from the console window is broken |
| 7 Fonts | ◐ | Forces conhost font to Courier New for Arabic glyph coverage (`:462-527`) |
| 8 Multiplexers | ❌ | Not considered |
| 9 Apps & TUI | ❌ | Line-mode `print()` only; corrupts ANSI; no alternate-screen/cursor-addressing awareness |

## Claimed but not verified
- "Windows Terminal shapes and reorders Arabic natively" (`fa_console.py:111-113`, `README.md:185, 196`). That's an external claim, and the code just steps aside on `WT_SESSION`. Our own testing should confirm WT's bidi behaviour rather than take it as given.
- Treating every non-vscode `TERM_PROGRAM` (mintty, etc.) as able to "shape and reorder Arabic natively and reliably" (`:586-602`) is an assumption, not something it detects.
- "Bidirectional reordering" for the built-in engine (`README.md:22, 46`) is a reversal heuristic, not the bidi algorithm. Only the optional backend is "full UAX #9" (`README.md:48-49`).
- The docstring header says version 2.1.0 (`:10`); `__version__` is 2.2.0 (`:158`).

## What we can learn / reuse
- **Layer 1 on Windows is solved cleanly here:** `SetConsoleCP/OutputCP(65001)`, `reconfigure(encoding="utf-8")`, `PYTHONUTF8`, and a fail-open contract with a structured `ConsoleSetupReport` and `get_console_info()` diagnostics. This is good reference material for a Windows section of our guidance.
- **Normalization policy is principled:** fold only true lookalikes (ي/ی, ك/ک) and never ة/ه; offer digit unification as opt-in; keep length constant. Worth copying into our Layer-1 recommendations.
- **The "logical data invariant" (`:99-104`) is the right contract:** program values stay logical, transforms happen only at display time, and output is untouched when it isn't a TTY. It's the right line even though the display half uses techniques we reject.
- The env-var escape hatches (`FA_CONSOLE_FORCE_VISUAL` / `FA_CONSOLE_NO_VISUAL`) are a simple, effective pattern for "who owns bidi" negotiation until terminals advertise capability.

## Limitations & anti-patterns
- **Presentation-form substitution** and **visual-order text sent to the terminal.** Both are rejected by our principles; console copy/search returns reversed, pre-shaped text.
- The built-in "bidi" is line reversal with LTR-token islands. Paragraph direction is wrong for LTR-dominant lines, and Latin phrases flip word order.
- It corrupts ANSI escape sequences on RTL lines, so it's incompatible with coloured CLI output and TUIs.
- Per-`write()` transformation means reorder boundaries depend on how the caller chunks output.
- Import-time global side effects: it mutates `sys.stdout`/`sys.stderr` and `os.environ`, and changes the user's console font.
- Capability detection by env-var sniffing (`WT_SESSION`, `TERM_PROGRAM`) instead of querying the terminal.
