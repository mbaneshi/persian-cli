# PTY proxy / multiplexer layer for RTL (Persian/Arabic) in any terminal, in Rust

Researched 2026-10-11. Scope: a Rust program between the app/shell and the real terminal (bicon/tmux/Zellij style) that parses VT output into a virtual screen, applies UAX #9 and Arabic shaping, and re-emits the screen. Also covers the Zellij plugin and Zellij/tmux core routes. The in-repo catalog [`docs/research/prior-art.md`](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art.md) is cited, not redone. Its relevant rows: **estaterm** (C PTY proxy, FriBidi, presentation forms, alt-screen bypass), and the finding "**Layer 8 (multiplexers) is untouched: 0 of 10**".

Note on sources: GitHub's REST API hit its rate limit partway through, so some GitHub pages were read through the web UI instead.

---

## 1. Prior art: bicon, mlterm, tmux/screen patches, Rust attempts

### Takeaway
bicon (2013+) is the canonical PTY wrapper. It's a **stream transformer with no screen model**: it treats any run between control characters as a "paragraph", shapes it to presentation forms, reorders it with FriBidi, and patches over earlier output with backspaces. Its maintainer says its core bugs (erase/backspace, copy order) are *inherent to the approach*, and he recommends terminals with native bidi instead. No Rust PTY-proxy bidi implementation exists on crates.io. The closest Rust architectural template is **tattoy** (a PTY "text compositor" built on wezterm-term, termwiz and portable-pty), which has no bidi at all.

### Cited Findings
- **bicon repo state:** 203 stars, created 2013-05-04, last push 2024-01-31, not archived. Last commits are build fixes (2024-01 `fribidi_log2vis` arg fix, 2022-05 clang build fix, 2020-06, 2018-08 "option to reshape only", 2015-08 v0.5). — [behdad/bicon](https://github.com/behdad/bicon) (via `gh api`, 2026-10-11)
- **bicon is LGPL code dating back to 2001–2003** (Behdad Esfahbod, Muhammad Alkarouri), built on FriBidi. Its README targets "Linux console, or terminal emulators with basic Unicode rendering support, like gnome-terminal, xterm, or PuTTY". — [bicon README](https://github.com/behdad/bicon/blob/master/README), [bicon/bicon_read.c](https://github.com/behdad/bicon/blob/master/bicon/bicon_read.c)
- **bicon's algorithm, verified in `bicon_read.c`:**
  - A paragraph ends at *any* control character: "the paragraph ends with any control character. We can't do anything else about control characters."
  - Non-ASCII runs are converted with `fribidi_charset_to_unicode`, then `bconsole_log2con` (contextual glyphs = presentation forms, reordered), and written back. "In this stage the number of characters is the same as paragraph's width."
  - A run split across `read()` calls is handled by remembering it and later emitting `\b` × N to "remove the old glyphs from the screen" and rewrite. The code says "We can't handle long paragraphs :-(". — [bicon_read.c](https://github.com/behdad/bicon/blob/master/bicon/bicon_read.c)
- **bicon open-issue profile:** 13 open issues, including #18 "Text erasing is buggy", #16 "Error backspacing", #11 "output copy/paste Caveat", #13 "Line alignment on the right doesn't work", #4 "fails to start new line", #3 "Still doesn't work with screen", #23 "bicon freezes", #28 "NUL char freezes bicon-started shell", #24 "zsh-syntax-highlighting break bicon" (closed). — [bicon issues](https://github.com/behdad/bicon/issues?q=is%3Aissue)
- **Maintainer verdicts:**
  - On copy/paste coming out in the wrong order: "That's inherent to this approach..." — [bicon #11](https://github.com/behdad/bicon/issues/11)
  - On the erase bug: "I don't think this can be easily fixed in bicon. Using terminals that have native support for bidi would be easier." Also: "Honestly I don't even remember what bicon does for backspacing anymore." — [bicon #18](https://github.com/behdad/bicon/issues/18)
  - On "Is this project deprecated?": "No." — [bicon #19](https://github.com/behdad/bicon/issues/19)
- **bicon's own TODO** lists "Fix bug with ZWNJ&ZWJ", broken keymaps, and "Implement fcon as shared library", which is an LD_PRELOAD route via `bicon_so.c`. — [bicon TODO](https://github.com/behdad/bicon/blob/master/TODO)
- **Right alignment:** in bicon, Persian man-page subtitles stay left-aligned, but in mlterm (linked to FriBidi) they're right-aligned. — [bicon #13](https://github.com/behdad/bicon/issues/13)
- **estaterm** (2026, C) is "BiCon's idea again, minus BiCon's screen model". It splits bidi runs at every escape (so SGR colour changes break paragraphs), writes presentation forms, bypasses only on the exact `CSI ?47/1047/1049 h`, swaps arrow keys heuristically, and has a static-reading buffer bug. — [prior-art/estaterm.md](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/estaterm.md)
  - *Correction to that note:* bicon also has no real screen model. Per `bicon_read.c` above, it works on the stream too.
- **mlterm** is an emulator, not a proxy. Bidi is optional (`--disable-fribidi`, separate BiDi README). It has a framebuffer/console GUI backend (`--with-gui=...|fb|console|...`) and a partial **libvterm-compatible library** (`make vterm`), so other programs that embed libvterm could inherit mlterm's emulation. — [mlterm README (Debian)](https://sources.debian.org/src/mlterm/3.9.4-3/README), [mlterm 3.9.4 README](https://raw.github.com/arakiken/mlterm/3.9.4/README)
- **tmux:**
  - Feature request #1936 "BiDirectional text support" (2019-10-12) was closed the same day by nicm: "I am not planning to work on this in the short term but perhaps at some point." — [tmux #1936](https://github.com/tmux/tmux/issues/1936)
  - The Arch wiki compatibility table listed tmux as "won't fix" (2019-10-12). — [ArchWiki Bidi (2022 snapshot)](https://wiki.archlinux.org/title/Bidi)
- **The only tmux bidi code that shipped is a *containment* fix, not bidi.** When the host terminal does bidi (VTE), RTL runs in a left pane leaked across the border. tmux added directional isolates around pane content, gated behind a terminfo capability (`set -as terminal-overrides ',xterm*:Bidi'`) because "there is no way for tmux to detect VTE automatically". nicm: "this is really something that should be the responsibility of applications, not of the terminal." Fixed and closed 2021-02-05. — [tmux #2425](https://github.com/tmux/tmux/issues/2425)
  - A related report: #3262 "hebrew characters display incorrectly with horizontal split window" (closed 2022). — [tmux issues: bidi](https://github.com/tmux/tmux/issues?q=bidi)
- **GNU screen:** bicon #3 says it "doesn't work with screen + virtual terminal". Behdad replied "Works for me both ways". — [bicon #3](https://github.com/behdad/bicon/issues/3)
- **No Rust attempts found.** crates.io searches for "bidi terminal", "rtl terminal", "bidi pty", "persian terminal" and "arabic terminal" returned no bidi proxy or multiplexer crate (2026-10-11). — [crates.io search](https://crates.io/search?q=bidi%20terminal)
- **tattoy** (Rust, MIT, about 573 stars) is the closest architecture:
  - It runs a "shadow" PTY (`portable_pty`) and renders it into a headless emulator ("Shadow Terminal", which depends on `wezterm_term::Terminal`).
  - It composites layers on a `termwiz::surface::Surface`, then sends "A diff between the final composite and the user's current real terminal" to the real terminal.
  - Its e2e tests are flaky (`cargo nextest run --retries 2`).
  - Crates: `tattoy` 0.1.8 (2025-07-28) and `shadow-terminal` 0.2.3 (2025-07-28, "A headless modern terminal emulator").
  - — [tattoy-org/tattoy](https://github.com/tattoy-org/tattoy), [crates.io tattoy](https://crates.io/crates/tattoy), [crates.io shadow-terminal](https://crates.io/crates/shadow-terminal)

### Inferences
- bicon "stalled" for reasons that are architectural, not lack of effort:
  - No virtual screen, so any cursor-addressed redraw (readline erase, zle syntax highlighting, `\r` progress bars) can't be reconciled with output that's already been reordered.
  - Presentation-form output breaks copy, search and logging.
  - Its maintainer moved the recommendation to emulator-native bidi (VTE did gain bidi in 2019, per tmux #1936).
  - So a credible Rust proxy must differ from bicon/estaterm in exactly one way: **a full VT emulator as the source of truth, then render visual frames by diffing**, which is tattoy's architecture plus a bidi pass.
- The tmux #2425 lesson matters for a Zellij setup. If the *host* (WezTerm) does bidi, a multiplexer has to stop runs crossing pane borders (isolates, or each pane as its own paragraph). If the proxy does bidi, the host must *not* do it too, or you get double reordering. This is the "two owners" problem from prior-art.md finding 4.

### Gaps
- No primary-source postmortem of bicon's adoption or abandonment. "Stalled" is inferred from commit history (feature work stopped in 2015/2018) and the maintainer comments above.
- I couldn't check the tattoy release cadence after 2025-07 (crates.io shows 0.1.8 as the latest), or whether it handles CPR/mouse remapping.
- I didn't verify whether mlterm's libvterm-compat layer exports bidi-reordered cells to the embedding host.

---

## 2. Rust building blocks: maturity and fitness

### Takeaway
Every layer has a mature Rust crate except **Arabic shaping into a cell grid**. A proxy can't use HarfBuzz-style glyph shaping, because it emits code points, not glyphs. Its only shaping options are (a) emit logical code points and let the host terminal's font shaper join them, which only works if the host shapes runs that the proxy has already reordered (WezTerm does shape runs), or (b) substitute presentation forms (`ar-reshaper`), which is the anti-pattern bicon and estaterm used. For the virtual screen, **wezterm-term + termwiz** (proven by tattoy) or **alacritty_terminal** are the serious options. `vt100` is the simplest and has a built-in `contents_diff`.

### Cited Findings (crates.io metadata as of 2026-10-11)
| Crate | Latest | Updated | Downloads (all / recent) | Role |
|---|---|---|---|---|
| `vte` | 0.15.0 | 2025-02-02 | 82.4M / 20.4M | Paul Williams-style VT parser state machine only, no screen — [crates.io](https://crates.io/crates/vte) |
| `vt100` | 0.16.2 | 2025-07-12 | 13.8M / 5.5M | Parser + in-memory screen; `contents_formatted()` and `contents_diff(&prev)` produce minimal redraw bytes; depends on `vte` + `unicode-width`; built for "programs like screen or tmux" — [docs.rs vt100](https://docs.rs/vt100/latest/vt100/) |
| `vt100-ctt` | 0.17.1 | 2026-02-07 | 46K | Maintained fork ("up-to-date version") — [crates.io](https://crates.io/crates/vt100-ctt) |
| `alacritty_terminal` | 0.26.0 | 2026-04-06 | 2.0M / 1.2M | Full emulator grid (Alacritty's core); replies to the app go out as `Event::PtyWrite(String)`, with `TextAreaSizeRequest` / `ColorRequest` callbacks — [docs.rs Event](https://docs.rs/alacritty_terminal/latest/alacritty_terminal/event/enum.Event.html) |
| `termwiz` | 0.23.3 | 2025-03-20 | 26.1M / 12.1M | WezTerm's surface/diff/escape library — [crates.io](https://crates.io/crates/termwiz) |
| `wezterm-term` | not on crates.io | — | — | Used as a git dependency (tattoy's shadow-terminal depends on `wezterm_term::Terminal`) — [tattoy README](https://github.com/tattoy-org/tattoy) |
| `avt` | 0.18.0 | 2026-05-05 | 282K | asciinema virtual terminal — [crates.io](https://crates.io/crates/avt) |
| `portable-pty` | 0.9.0 | 2025-02-11 | 20.0M / 11.4M | Cross-platform PTY (WezTerm project) — [crates.io](https://crates.io/crates/portable-pty) |
| `pty-process` | 0.5.3 | 2025-07-12 | 5.5M | Unix PTY spawn (same author as vt100) — [crates.io](https://crates.io/crates/pty-process) |
| `unicode-bidi` | 0.3.18 | 2024-12-16 | 531M / 88M | Servo's UAX #9 — [crates.io](https://crates.io/crates/unicode-bidi) |
| `harfrust` | 0.14.0 | 2026-10-04 | 11.7M / 7.6M | "A complete HarfBuzz shaping algorithm port to Rust" (HarfBuzz org; successor to rustybuzz) — [crates.io](https://crates.io/crates/harfrust) |
| `rustybuzz` | 0.20.1 | 2024-11-12 | 33.9M | Older port, superseded by harfrust — [crates.io](https://crates.io/crates/rustybuzz) |
| `ar-reshaper` | 1.5.0 | 2024-01-20 | 30K | no-std presentation-form reshaper for Arabic/Persian — [crates.io](https://crates.io/crates/ar-reshaper) |
| `arabic_reshaper` | 0.4.2 | 2023-08-16 | 27K | Same idea — [crates.io](https://crates.io/crates/arabic_reshaper) |
| `fribidi` (bindings) | 0.1.2 | 2023-02-13 | 4K | Effectively unmaintained — [crates.io](https://crates.io/crates/fribidi) |
| `unicode-width` | 0.2.2 | 2025-10-06 | 862M | UAX #11 widths — [crates.io](https://crates.io/crates/unicode-width) |
| `unicode-segmentation` | 1.13.3 | 2026-06-01 | 599M | UAX #29 graphemes — [crates.io](https://crates.io/crates/unicode-segmentation) |
| `icu_properties` | 2.3.0 | 2026-08-13 | 634M | ICU4X property data (bidi class, joining type) — [crates.io](https://crates.io/crates/icu_properties) |

- **unicode-bidi 0.3.18** (local source inspection):
  - It ships `UNICODE_VERSION = (16, 0, 0)`.
  - Per-paragraph line APIs: `reordered_levels`, `reordered_levels_per_char`, `reorder_line`, `reorder_visual(levels) -> Vec<usize>` (the visual→logical index map), `visual_runs`, `has_rtl`, `direction`, plus `ParagraphBidiInfo` for single-paragraph use.
  - Its inline tests cite `BidiTest` cases.
  - Docs: "Re-ordering is done after wrapping each paragraph into a sequence of lines."
  - — `~/.cargo/registry/.../unicode-bidi-0.3.18/src/lib.rs` lines 546–863, `src/char_data/tables.rs:8`; [docs.rs unicode-bidi](https://docs.rs/unicode-bidi/latest/unicode_bidi/)
- **vt100's `Callbacks` trait** exposes `unhandled_csi(i1, i2, params, c)`, `unhandled_osc`, `unhandled_escape`, `copy_to_clipboard`, `paste_from_clipboard`, `resize`, `set_window_title`, bells and so on, all with empty defaults. A proxy can intercept the sequences vt100 doesn't model there. — [docs.rs vt100::Callbacks](https://docs.rs/vt100/latest/vt100/trait.Callbacks.html)
- **Prior-art lessons on width and shaping:**
  - Width (Layer 3) is unsolved everywhere.
  - Projects that shape to presentation forms broke copy and search.
  - termenal-web's per-row `colToVisual` / `visualToCol` map is the best reference design.
  - — [prior-art.md](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art.md)

### Inferences
- **Recommended stack for a prototype:**
  - `portable-pty`
  - `alacritty_terminal` *or* the wezterm-term + termwiz pair, which gives a full modern emulator (kitty keyboard protocol, OSC 8 and so on) and termwiz's surface diff. That pair is the most direct path because tattoy already demonstrates it end to end.
  - `unicode-bidi` (`reorder_visual` gives the per-row permutation)
  - `unicode-width` and `unicode-segmentation` for cell and grapheme handling
  - `vt100` is attractive for a minimal MVP because `contents_diff` is built in, but it's less complete.
- **Shaping:**
  - `harfrust` is useless *inside* the proxy. It produces glyph IDs and advances for a font, and the proxy can't send glyphs to the host terminal.
  - The proxy can either rely on the host terminal shaping the code points it emits in visual order, or fall back to presentation forms via `ar-reshaper`.
  - Emitting visual-order code points to WezTerm is risky. WezTerm shapes text runs with HarfBuzz in logical direction assumptions, so an LTR-ordered run of Arabic letters may join wrongly (initial/final swapped).
  - That's why bicon and estaterm shaped *before* reordering and emitted presentation forms, which are join-state-independent.
  - This is a fundamental argument that a proxy can't get both correct joining and logical text in the host buffer.

### Gaps
- I didn't run the unicode-bidi conformance tests (`BidiTest.txt` / `BidiCharacterTest.txt`) locally. The pass rate isn't confirmed.
- I didn't verify the alacritty_terminal source to confirm that DSR/CPR replies go through `PtyWrite`. That's my understanding of the code, but this session didn't confirm it.
- I didn't empirically test how WezTerm's shaper treats Arabic letters emitted in visual (reversed) order. This needs a test.

---

## 3. Hard problems specific to a proxy

### Takeaway
The virtual-screen design solves bicon's redraw problem, but it creates a **logical↔visual coordinate split** that leaks everywhere the host terminal and the app exchange coordinates: the cursor, CPR replies, mouse reports, selection/copy, and IME pre-edit position. The proxy can rewrite the coordinates it controls (cursor display, mouse input). What it can't fix: copy/paste (the host stores visual text), box-drawing TUIs (reordering a row that the app laid out in 2D destroys the layout), and wrapped paragraphs (the app's logical line spans rows the proxy treats separately).

### Cited Findings
- **The cursor is undefined at boundaries:**
  - "The BiDi algorithm shuffles the characters around, but doesn't provide a mapping for the boundaries between them."
  - The spec says the cursor should "follow the character it belongs to". For RTL it recommends the I-beam on the right side of the cell, with shape hints `⎡`/`⎤`.
  - Block/underline cursors "cannot be displayed beyond the last character", which matters for end-of-input in a shell prompt.
  - — [Terminal-WG BiDi: The cursed cursor](https://terminal-wg.pages.freedesktop.org/bidi/recommendation/cursor.html)
- **Emacs and Vim already do their own bidi or shaping:**
  - Emacs "does BiDi on its own, hence with a BiDi-aware terminal emulator RTL strings are reversed back to the incorrect order".
  - Vim/NeoVim "don't do BiDi, however, do Arabic shaping... on the reverse (LTR) order".
  - So a proxy that reorders these apps' output double-processes it.
  - — [Terminal-WG BiDi: Applications](https://terminal-wg.pages.freedesktop.org/bidi/prior-work/applications.html)
- **Input erase and backspace break in stream proxies** (bicon #18, #16), and the maintainer couldn't fix them. — [bicon #18](https://github.com/behdad/bicon/issues/18)
  - estaterm's workaround is an "echo ring" that skips reordering of output matching recently typed bytes, plus global L/R arrow swapping. That "shows exactly why a stream rewriter can't tell the user's input from program output". — [prior-art/estaterm.md](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/estaterm.md)
- **Copy/paste order is "inherent to this approach"** (the host buffer holds visual text). — [bicon #11](https://github.com/behdad/bicon/issues/11)
- **Escape-chunk paragraphing:** estaterm breaks paragraphs at SGR escapes and misses DCS/APC payloads, corrupting tmux passthrough or sixel data that contains RTL. — [prior-art/estaterm.md](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/estaterm.md)
- **zsh-syntax-highlighting broke bicon** (#24), which is exactly the cursor-addressed redraw case. — [bicon issues](https://github.com/behdad/bicon/issues?q=is%3Aissue)
- **Mouse coordinates:** in the tmux bidi work, mouse problems were traced to the bidi terminal "report[ing] erratic mouse coordinates". — [tmux #2425](https://github.com/tmux/tmux/issues/2425)
- **The visual→logical mouse mapping in RtlTerminal and the per-row `visualToCol` map in termenal-web** are the reference implementations for remapping. — [prior-art.md](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art.md)
- **Pane-border leakage:** if bidi is applied per physical row without isolation, RTL runs cross split borders (tmux #2425). — [tmux #2425](https://github.com/tmux/tmux/issues/2425)

### Inferences (design analysis; not sourced facts)

How a virtual-screen proxy would handle each hard problem:

- **Cursor mapping:** keep the emulator's logical cursor `(row, col)`. On render, compute the row's `reorder_visual` permutation and put the host cursor at `visual_of(col)`. At end of line or after the last char (the typical prompt case), choose a side by the paragraph direction or by the run direction of the previous character. Expect visible "jumping" when typing at a run boundary, which is inherent per the Terminal-WG note above.
- **CPR / DSR (`CSI 6n`):** the proxy's emulator answers it with **logical** coordinates and must *swallow* the request so the host terminal doesn't answer with visual ones. Responses from alacritty_terminal (`PtyWrite`) or a `vt100` `unhandled_csi` hook make this possible. Other queries (DA1/DA2, XTVERSION, OSC 10/11 colours, kitty keyboard query, DECRQM) must be answered locally or forwarded deliberately. This is the same work tmux/Zellij already do.
- **Mouse:** decode SGR/X10 mouse reports from the host, map visual x→logical col with the row's inverse permutation, and re-encode. Drag selection inside apps (vim visual mode) becomes non-contiguous on screen, which is inherent.
- **Partial updates and diffs:** solved by design. Re-render whole dirty rows, recomputing bidi per row (or per paragraph), then diff against the last emitted frame (termwiz `Surface` diff or `vt100::contents_diff`). The cost is that one changed logical cell can move every cell in the row visually, so diffs are per row, not per cell.
- **Line wrapping:** UAX #9 says reorder *after* line breaking within a paragraph. A proxy knows soft-wrap flags (alacritty and wezterm track wrapped lines), so it can run bidi over the whole wrapped paragraph and then reorder per row (`reordered_levels(para, line_range)`), as UAX #9 intends. Apps that hard-wrap themselves (`fmt`, TUIs) defeat this.
- **Box-drawing / TUI layouts:** reordering a row containing `│ نام │ ...` moves RTL text across border characters. Fixes:
  - (a) skip bidi on the alternate screen (estaterm/RtlTerminal lesson), which loses RTL in TUIs entirely;
  - (b) treat runs of box-drawing / Neutral separators as paragraph boundaries (a heuristic segmentation into "cells" between `│`, `┃`, `|` and wide gaps of spaces), which is fragile;
  - (c) honour the Terminal-WG explicit mode (`CSI 8 l` / BDSM) so TUIs can opt out.
- **Input direction:** the user types logical characters and the shell echoes them. With a screen model there's no need for an echo ring, because echoed text is just text at the logical cursor. Arrow-key semantics stay logical (Left = previous logical char), which looks reversed inside RTL runs. Swapping keys globally (estaterm) is wrong. Leaving them logical matches readline/zle.
- **Double ownership:** if the host is WezTerm with any bidi enabled (`bidi_enabled`), it must be turned off for proxied panes, or the output gets reordered twice.
- **Latency/perf:** the bidi work per dirty row is O(n) with small n (≤ a few hundred cells). tattoy and Zellij show the "full emulator + diff + re-emit" pipeline is interactive-fast in Rust. The extra cost over a plain multiplexer is roughly one bidi pass per dirty row with RTL (skippable when `has_rtl()` is false, like estaterm's ASCII fast path).

### Gaps
- No measurements exist for added latency of bidi-in-proxy. No benchmark found.
- I found no documented strategy in any project for segmenting box-drawing TUI rows into independent bidi paragraphs.

---

## 4. Zellij and tmux: plugin vs core

### Takeaway
A Zellij WASM plugin **cannot transform another pane's rendered output in place**. It can *read* other panes' rendered text (ANSI-stripped, periodic `PaneRenderReport`), *write* to their stdin, *hide* panes and *intercept keys*. A "mirror pane" hack is possible: hide the real pane, render a bidi copy in the plugin pane, and forward keys. But it would lose colours and attributes, update with lag, and need its own mouse mapping, so it's a demo, not a solution. Bidi belongs in **Zellij core** (`zellij-server` grid → render). But Zellij still **drops combining marks entirely** (open since 2022; fix PR #5500 is unmerged as of 2026-09). Arabic harakat, ZWJ-dependent sequences and other zero-width code points are currently lost before any bidi could even be applied. tmux's maintainer considers bidi the application's job, and has only added border isolation.

### Cited Findings
- **Zellij plugin events:**
  - `PaneRenderReport` "Provides the rendered content of subscribed panes with ANSI escape codes stripped"; it is "fired periodically for panes the plugin has subscribed to observe", and requires the `ReadPaneContents` permission.
  - No event or command intercepts or transforms another pane's output.
  - — [zellij.dev: Plugin API Events](https://zellij.dev/documentation/plugin-api-events)
- **The payload type** is `PaneRenderReport(HashMap<PaneId, PaneContents>)`. `PaneContents` has `viewport: Vec<String>`, `lines_above_viewport`, `lines_below_viewport`, `selected_text: Option<SelectedText>` and `cursor: Option<(usize, usize)>`. There's no ANSI or style field. — [docs.rs zellij-tile Event](https://docs.rs/zellij-tile/latest/zellij_tile/prelude/enum.Event.html), [docs.rs PaneContents](https://docs.rs/zellij-tile/latest/zellij_tile/prelude/struct.PaneContents.html)
- **Zellij plugin commands:**
  - `get_pane_scrollback` (`ReadPaneContents`)
  - `write_to_pane_id` / `write_chars_to_pane_id` (`WriteToStdin`)
  - `hide_pane_with_id` / `show_pane_with_id`, and `replace_pane_with_existing_pane` (`ChangeApplicationState`)
  - `open_terminal_pane_in_place_of_pane_id` (`OpenTerminalsOrPlugins`)
  - `intercept_key_presses` (`InterceptInput`)
  - — [zellij.dev: Plugin API Commands](https://zellij.dev/documentation/plugin-api-commands)
- **zellij-tile** latest is 0.45.1 (2026-08-28). — [crates.io zellij-tile](https://crates.io/crates/zellij-tile)
- **Zellij drops zero-width code points:**
  - Issue #1538 "unicode grapheme segmentation" has been open since 2022-06-22 (34 comments). Maintainer tlinford pointed to the code in `grid.rs` where zero-width characters are skipped.
  - hjoliver (2025-05): "Zellij can't render ANY Unicode 'combining characters'". Simply removing the skip corrupts later formatting through width errors.
  - There's no maintainer statement about bidi.
  - — [zellij #1538](https://github.com/zellij-org/zellij/issues/1538)
- **PR #5500 "fix(grid): attach combining marks instead of dropping them"** is open and unmerged, with no maintainer reviews shown. The author lists Thai, Lao, Khmer, Myanmar, Devanagari, Hebrew points, **Arabic harakat** and decomposed Latin as affected. dump-screen, pane contents, serialization and selection copy also dropped marks. Updated 2026-09-20. — [zellij PR #5500](https://github.com/zellij-org/zellij/pull/5500)
  - Related: #4920 "fix: support Unicode combining characters (Thai, Arabic, Hebrew, etc.)" (open, 2026-03-26). — [zellij #4920](https://github.com/zellij-org/zellij/pull/4920)
- **Same bug, later reports:** on #4447, imsnif called the combining-char problem "long-standing". A 2026-09-20 comment says it's still reproducible on Zellij 0.45.1: "Zellij preserved 0 of 4 nonspacing marks, while tmux preserved all 4". — [zellij #4447](https://github.com/zellij-org/zellij/issues/4447)
- **No Zellij issue or PR about bidi/RTL was found** by searching the repo for "bidi", "RTL", "arabic", "persian", "hebrew" and "right-to-left". Hits were unrelated or about combining marks. — [GitHub search, zellij-org/zellij](https://github.com/zellij-org/zellij/issues?q=bidi) (2026-10-11)
- **tmux:**
  - #1936 bidi request declined ("not planning to work on this in the short term").
  - #2425 added terminfo-gated directional isolates around panes so a bidi-capable host doesn't leak runs across borders.
  - nicm: bidi "should be the responsibility of applications".
  - tmux preserves combining marks (per the #4447 comment).
  - — [tmux #1936](https://github.com/tmux/tmux/issues/1936), [tmux #2425](https://github.com/tmux/tmux/issues/2425), [zellij #4447](https://github.com/zellij-org/zellij/issues/4447)

### Inferences
- **Plugin route (feasibility: low):**
  - A plugin could subscribe to a hidden terminal pane's `PaneRenderReport`, run unicode-bidi on each `viewport` line, render the result in its own pane, forward keys via `intercept_key_presses` + `write_to_pane_id`, and draw the cursor at the mapped position from `PaneContents.cursor`.
  - Blockers:
    - no colours or attributes (ANSI stripped)
    - "periodic" updates, so latency
    - the source grid has already lost combining marks
    - mouse and selection need reimplementing
    - no CPR interception (the app talks to Zellij's real grid, so CPR answers are logical, which is fine)
  - It's good for a read-only "bidi preview" pane (logs, `git log`, chat output), not for interactive work.
- **Core route (feasibility: medium, upstream-dependent):**
  - Prerequisite: land #5500-style combining-mark storage.
  - Then add a per-pane bidi render pass in zellij-server's output stage. Each pane is its own paragraph set, which automatically solves the tmux #2425 border leakage.
  - Plus: cursor mapping on render, mouse remapping on input, logical copy (Zellij owns selection, so copy can stay logical, unlike bicon). This is the one real advantage of a multiplexer over a dumb proxy.
  - Also add a per-pane toggle and alt-screen auto-off.
  - No evidence of maintainer appetite. An RFC/Discussion upstream would be the first step.
- **A standalone Rust proxy is easier to ship than either.** It's wezterm-term or alacritty_terminal + unicode-bidi + diff render. It can be used *inside* a Zellij pane, because Zellij just sees a normal app emitting already-visual cells.
  - Caveat: Zellij's combining-mark drop still applies to what the proxy emits.
  - Caveat: Zellij's copy and scrollback would hold visual-order text.

### Gaps
- Zellij's `PaneRenderReport` update frequency isn't documented. I couldn't confirm whether `PaneContents.cursor` is (row, col) or (col, row), or which release introduced `ReadPaneContents`.
- The truncated Commands page (after character 100,000) may document `set_pane_regex_highlights` details. I didn't confirm whether highlights can restyle other panes.

---

## 5. What fraction of apps would work

### Takeaway
A virtual-screen bidi proxy works well for **line-oriented, logical-order output on the main screen**: cat, ls, grep, git log/diff, man (if paragraph direction is auto-detected), shell prompts, and Claude Code-style streaming chat. It's acceptable-with-quirks for readline/zle input (cursor jumps at run boundaries). It's **broken or should be disabled** for alt-screen TUIs that do their own layout (vim/neovim, htop, lazygit, less in some modes, mc, ratatui apps): reordering per row destroys column layouts, and Vim/Emacs already do their own shaping or bidi. No source provides a measured percentage.

### Cited Findings
- Projects that applied bidi on the alternate screen broke TUIs. estaterm bypasses the alt screen, and RtlTerminal "reorders even on the alternate screen" (listed as a flaw). "Stream transformers ... all give up on full-screen apps." — [prior-art.md](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art.md)
- Emacs does its own bidi and gets double-reversed under a bidi-aware terminal; Vim/NeoVim shape Arabic on reversed order. — [Terminal-WG BiDi: Applications](https://terminal-wg.pages.freedesktop.org/bidi/prior-work/applications.html)
- bicon fails on man-page right alignment (#13), on zsh-syntax-highlighting (#24) and on erase (#18). — [bicon issues](https://github.com/behdad/bicon/issues?q=is%3Aissue)
- `less` with Arabic leaked across tmux panes on a bidi host. — [tmux #2425](https://github.com/tmux/tmux/issues/2425)

### Inferences (qualitative tiering, not measured)
| Tier | Apps | Expected result with a virtual-screen proxy |
|---|---|---|
| Works | cat, echo, ls, grep/rg, git log/show/diff (pager off), curl/jq output, compiler logs, LLM CLI streaming output | Correct visual order; copy in the host is visual (wrong) unless the host is not used for copy |
| Works with quirks | zsh/bash/fish prompt and line editing, `less`/`man` on the main screen, `git log` via pager, progress bars | Cursor jumps at LTR/RTL boundaries; right alignment needs auto paragraph direction; `\r` rewrites are fine (screen model) |
| Degraded | fzf (alt screen or inline), btop/htop (mostly LTR numbers, process names OK), tables with `│` borders | Needs separator-aware paragraph segmentation, or else turn bidi off |
| Should be off | vim/neovim, emacs -nw, lazygit, mc, tmux nested, ratatui/bubbletea TUIs | Apps own layout. Auto-disable on alt screen (catch combined private modes, unlike estaterm), or honour explicit-mode `CSI 8 l` |

- Rough judgment: for a developer's day in WezTerm + Zellij, most *Persian-content* moments happen in the "Works" and "with quirks" tiers (output, chat, logs, commit messages, prompts). Most *time* is spent in the "Should be off" tier (editor, lazygit), where a proxy can't help and app-side support is needed.

### Gaps
- No empirical compatibility matrix exists for any bidi proxy. The tiers above are reasoned from the cited failure modes and need a test corpus (prior-art.md suggests reusing rtl-terminal's before/after corpus).
