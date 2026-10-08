# estaterm
- **Repo:** https://github.com/a1-t1/estaterm · **Commit read:** a2c1ce6 (2026-03-17, single shallow commit) · **License:** Apache-2.0 · **Language:** C11 (CMake) · **Platform:** Linux (uses `<pty.h>`/`forkpty` + `-lutil`, `src/pty.c:7`; no macOS/BSD path)
- **Category:** PTY proxy

## What it is
A ~1,000-line C program that `forkpty`s your shell and sits between it and the real terminal. It rewrites the child's output: it reorders RTL text into visual order with FriBidi and replaces Arabic letters with Presentation Forms, so a terminal with no bidi or shaping *looks* right. It also swaps Left/Right arrow keys when the last processed output was RTL. This is BiCon's idea again, minus BiCon's screen model.

## How it works (verified in code)
- **Proxy loop:** `poll()` on stdin and the PTY master (`src/main.c:293-350`). Stdin bytes are pushed into a 512-byte "echo ring" (`main.c:44-82`, `316`). On the way back, output bytes that match the ring prefix pass through *unprocessed*, so typed text isn't reordered while you type (`main.c:133-138`).
- **Escape parsing:** a hand-rolled splitter in `src/vtparse.c:32-159` produces chunks: CSI (`ESC [` then bytes `<0x40`, then a final byte, `:80-98`), OSC (ends on BEL or `ESC \`, `:101-128`), and *any other* `ESC x` as a 2-byte escape (`:130-135`). Other C0 bytes become 1-byte "escapes". CR and LF are separate chunks. All escapes are written through verbatim (`main.c:156-159`).
  - It doesn't recognise DCS (`ESC P`), APC, PM or SOS, so their payloads get classified as *text* and fed through bidi/shaping. A sixel/DCS/tmux-passthrough payload containing RTL would be corrupted.
  - **Buffer bug (static reading):** `vt_parser_feed` appends at `buf_len` and resets `pos=0` (`vtparse.c:10-19`). `buf_len` is only rewound on the incomplete-escape paths (`:70-73, 86-89, 117-120`), never after a full drain. Read literally, every later read re-scans and re-emits earlier bytes until the 8 KiB buffer fills, and after that new data gets truncated (`:14-15`). Either way, the streaming layer isn't robust.
  - A text chunk can end mid-UTF-8 sequence at a `read()` boundary, and nothing reassembles it before `fribidi_charset_to_unicode` (`bidi.c:13`).
- **Unit of bidi = chunk, not line:** `bidi_reorder_ex` runs on each TEXT chunk (`main.c:144`). Chunks are split by *every* escape, including SGR colour changes (`vtparse.c:148-151`). So a coloured word cuts the paragraph into independently reordered pieces. The README's "per-line" description (`README.md:172`) is optimistic.
- **Bidi:** real FriBidi UAX #9 with bracket pairs: `fribidi_get_bidi_types`, `fribidi_get_bracket_types`, `fribidi_get_par_embedding_levels_ex` (base `FRIBIDI_PAR_ON` unless `--rtl`/`--ltr`), then `fribidi_reorder_line` (`src/bidi.c:103-154`). Lines with no RTL character take a fast path and are returned as-is (`bidi.c:79-88`).
- **Shaping:** `fribidi_join_arabic` + `fribidi_shape(FRIBIDI_FLAGS_DEFAULT | FRIBIDI_FLAGS_ARABIC)` run *before* reorder (`bidi.c:131-141`). This rewrites code points into **U+FB50–FDFF / U+FE70–FEFF presentation forms**, as the comment in `src/shaper.c:7-16` says. `FRIBIDI_FLAGS_ARABIC` includes ligature shaping; FriBidi marks the consumed lam-alef slot with U+FEFF (FriBidi behaviour, not in this repo), and estaterm never strips it, which risks column drift. Mirroring only happens through `fribidi_shape`'s default flags, so `--no-shape` also turns off bracket mirroring.
- **HarfBuzz:** linked in `CMakeLists.txt:9,22,28`, but `grep hb_` finds **zero** uses in `src/`. It's dead weight.
- **Full-screen apps:** `passthrough.c:22-49` watches for an exact `CSI ? 47|1047|1049 h/l` and bypasses all processing while the alt screen is up (`main.c:129`). Combined private modes (`CSI ?1049;1h`) won't match. Cursor-addressed output on the main screen (zle/readline redraws, progress bars, `\r` rewrites) still gets rewritten blindly.
- **Arrow keys:** if the last processed chunk resolved RTL, `ESC[C`↔`ESC[D` and `ESC[1;N C/D` get swapped (`src/input.c:20-73`, `main.c:319-323`). It ignores SS3 (`ESC O C`) application-cursor mode.
- **Tests:** `src/test_bidi.c` prints outputs and always ends "All tests passed." (`:122`). There are no assertions.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | UTF-8 assumed; no normalization; split UTF-8 across reads unhandled (`vtparse.c:148-157`) |
| 2 Input (layouts, ZWNJ, IME) | ◐ | Only L/R arrow swapping (`input.c`); no layout/ZWNJ/IME logic |
| 3 Width | ❌ | No width logic; ligature FILL char (U+FEFF) left in output may desync cells |
| 4 Shaping | ◐ | FriBidi Arabic joining → **presentation forms** (`bidi.c:132-141`); no HarfBuzz use despite linking |
| 5 Bidi | ◐ | Real UAX #9 via FriBidi (`bidi.c:103-154`), but applied per escape-delimited chunk in the proxy (visual order in the stream) |
| 6 Cursor/selection/copy | ❌ | Terminal buffer holds visual-order presentation forms → copy/search broken; arrow swap is a heuristic |
| 7 Fonts | ❌ | Relies on the terminal font having FExx glyphs |
| 8 Multiplexers | ❌ | Not considered; DCS passthrough would be mangled |
| 9 Apps & TUI | ◐ | Alt-screen bypass only (`passthrough.c`); TUIs get no RTL help at all |

## Claimed but not verified
- "Text shaping engine" HarfBuzz (`README.md:39`): linked, never called.
- "Escape sequences pass through untouched" (`README.md:32`): true for CSI/OSC/2-byte. Not true for DCS/APC/PM payloads, and the buffer-handling bug above makes this doubtful in practice.
- "Each run gets correct direction per UAX #9" for mixed lines (`README.md:139`): only within one escape-free chunk.
- "Works with **any** Unicode-capable terminal" (`README.md:5`): Linux-only `pty.h`. A terminal that already does bidi (VTE, Konsole, mlterm) would double-reorder.
- "Run tests: ctest" proving correctness: the test has no assertions.

## What we can learn / reuse
- The FriBidi call sequence in `bidi.c:103-154` is a compact, correct reference for driving FriBidi *levels* (types → brackets → `get_par_embedding_levels_ex`). We'd stop before `reorder_line`/`shape` and hand levels to a renderer instead.
- Alt-screen detection as a mode switch is a useful *signal* for "the app owns layout", e.g. turning implicit bidi off. We'd parse it with a real VT state machine, though.
- The echo-ring idea shows exactly why a stream rewriter can't tell the user's input from program output. It's a good argument for owning bidi in the terminal, not a proxy.
- Its README "Related Projects" list (mlterm, BiCon, terminal-wg BiDi spec) matches our own prior-art set.

## Limitations & anti-patterns
- **Presentation-form substitution** (U+FB50–FEFF) in the byte stream. This is exactly what our principles reject.
- **Visual-order text in the terminal buffer.** Copy/paste, search, `grep` of scrollback, screen readers and logging (`script`, tmux capture) all see reversed, pre-shaped text.
- Bidi run boundaries are set by SGR escapes and `read()` sizes, not by paragraph semantics.
- No screen model. Cursor-addressed main-screen output and line editors get rewritten with no idea where text actually lands.
- Arrow-key swapping based on "last output line was RTL" is a global, stateful heuristic that will misfire.
- No tests with assertions; streaming bug as read; HarfBuzz dependency that's never used.
