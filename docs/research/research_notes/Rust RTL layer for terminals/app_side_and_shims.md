# App-side, shim and filter approaches to RTL in terminal apps (Rust focus)

> Researcher notes, 2026-10-11. Scope covers TUI-library integration, libc write() interception (LD_PRELOAD / DYLD_INSERT_LIBRARIES), CLI pipe filters, and the Rust crate ecosystem. PTY proxies, multiplexers, emulator-native support and spec theory belong to other researchers.
> These notes don't repeat [prior-art.md](../../prior-art.md). Its findings that matter here: stream transformers (estaterm, fa-console, ar-terminal path B) all write presentation forms in visual order into the terminal, break copy/search/ANSI, and give up on full-screen apps.
> Method: GitHub issue search with `gh`, the crates.io API, shallow read-only clones of `servo/unicode-bidi` (commit 9a8c7b0, 2026-09-15) and `YouKnow-sys/ar-reshaper` (commit 16f540a, 2025-07-09), and **hands-on experiments on this Mac** (macOS Darwin 25.6, Apple Silicon): a DYLD interposer and the `fribidi` 1.0.17 CLI. The experiments are marked "verified locally". Their scripts sit in the session scratchpad and are not committed.

## 1. TUI libraries: ratatui/crossterm (and cursive, Textual/Rich, Bubble Tea/lipgloss, Ink). Current RTL state and how a "ratatui-bidi" layer would work

### Takeaway
No mainstream TUI library has any bidi or shaping support. ratatui has no RTL issue or PR at all beyond a 2024 discussion about making `Alignment` direction-agnostic. Its width/diff machinery, driven by `unicode-width`, was still producing wide-glyph regressions in mid-2026. A "ratatui-bidi" layer is feasible as a per-line pre-render transform, logical `Line` → visual cells (optionally presentation forms), but only works correctly if the terminal is told *not* to reorder (`CSI 8 l`, explicit BDSM) or doesn't do bidi at all. Otherwise you get double reordering.

### Cited Findings
- **ratatui:** searching issues for "RTL", "bidi" and "arabic" returns no bidi/RTL feature issue. The only direction-related one is [#756 "Change `Alignment` enum to be direction agnostic"](https://github.com/ratatui/ratatui/issues/756), open since 2024-01-06. It proposes `Start/Center/End` instead of `Left/Center/Right`. One maintainer comment asks "If hypothetically someone were building a TUI in Arabic or in another RTL language what would we want `Alignment::Start` to do?" and leans towards keeping `HorizontalAlignment` because "we are not dealing with direction agnostic layouts." — [ratatui#756](https://github.com/ratatui/ratatui/issues/756)
- tui-rs (the ratatui predecessor, `fdehau/tui-rs`) has no issues matching "RTL". `rhysd/tui-textarea` and `crossterm-rs/crossterm` have no issues matching "rtl", "bidi" or "arabic". — searches via `gh search issues`, 2026-10-11 ([ratatui issues](https://github.com/ratatui/ratatui/issues), [tui-textarea issues](https://github.com/rhysd/tui-textarea/issues), [crossterm issues](https://github.com/crossterm-rs/crossterm/issues))
- **ratatui's width/diff path is still fragile with multi-column graphemes**, the same machinery a bidi layer would feed. [#2685](https://github.com/ratatui/ratatui/issues/2685) (2026-08-04, closed): "Buffer::diff drops all remaining cells after a cell whose symbol is longer than one column (regression in ratatui-core 0.1.1)". [#2651](https://github.com/ratatui/ratatui/issues/2651) (2026-07-20, closed): "CrosstermBackend skips MoveTo after a double-width grapheme, shifting the rest of the row". [#2652](https://github.com/ratatui/ratatui/issues/2652): the trailing cell of a wide glyph is never updated on style-only changes. [#2730](https://github.com/ratatui/ratatui/issues/2730): "Fill::new(\"\") silently corrupts terminal layout due to zero-width symbol". — linked issues
- **cursive:** [#31 "Support right-to-left languages"](https://github.com/gyscos/cursive/issues/31), opened 2016-06-27, is **still open**. The maintainer wrote "Low priority for now, as I know next to nothing about how RTL languages are usually used on terminals". A 2022 comment notes VTE terminals do bidi when enabled with `printf "\e[?2501h"`, which then mirrors cursive's drop shadows and swaps arrow keys. That's an example of the terminal and the app both "owning" layout. — [cursive#31](https://github.com/gyscos/cursive/issues/31)
- **Rich (Python):** Will McGugan, 2021: "There's no explicit support for RTL text in Rich. I would like to tackle one day." — [rich#1325](https://github.com/Textualize/rich/issues/1325). Textual has no RTL issue (search returned only an unrelated focus-order issue).
- **lipgloss (Go):** [#167 "RTL languages messes the layout!"](https://github.com/charmbracelet/lipgloss/issues/167) (2023). The maintainer said "we really do need better RTL support in Lip Gloss" and suspected `go-runewidth` widths. It was closed in Jan 2025 as not reproducible, with the note "we overhauled the way we're handling non-Latin characters quite a lot ... I believe Arabic should generally render fine now". The reporter was pre-shaping with `goarabic`, i.e. presentation forms. Bubble Tea has no RTL issues. — [lipgloss#167](https://github.com/charmbracelet/lipgloss/issues/167)
- **Ink (JS):** no issues match "rtl" or "arabic". — [ink issues](https://github.com/vadimdemedes/ink/issues)
- **FrankenTUI (`ftui-*` crates, v0.9.0, 2026-10)** is the only Rust TUI stack found that wires in the primitives. `ftui-text` has a `script_segmentation` module described as "Script segmentation and bidi-safe text run partitioning", optional `unicode-bidi ^0.3.18` and `rustybuzz ^0.20` dependencies, a `TextShaper` trait with a `NoopShaper` default, and a `RunDirection` enum. The docs don't claim end-to-end RTL rendering. — [docs.rs/ftui-text](https://docs.rs/ftui-text/latest/ftui_text/)
- crates.io has **no** `ratatui-bidi` / ratatui RTL widget crate (queries "ratatui bidi", "ratatui rtl", "ratatui arabic" return unrelated crates). Adjacent GUI work exists: `gpui-bidi` 0.1.1 (2026-09: "Right-to-left and mixed-direction text for GPUI: correct caret, selection, and click positions") and `cosmic-text-rtl` 0.19.0 (a fork "carrying RTL correctness patches (forced base direction, affinity-aware caret...)"). — [crates.io API search](https://crates.io/search?q=ratatui%20bidi), [gpui-bidi](https://crates.io/crates/gpui-bidi), [cosmic-text-rtl](https://crates.io/crates/cosmic-text-rtl)
- **The double-reordering control exists in the freedesktop draft:** "Apps that want explicit mode should switch to it on startup and switch back to implicit on exit". Implicit is `CSI 8 h` (default) and explicit is `CSI 8 l`. An explicit-mode app "should always set a direction" via SCP: `CSI 1 SPACE k` (LTR), `CSI 2 SPACE k` (RTL), `CSI 0 SPACE k` (terminal default) on exit. — [BiDi in Terminal Emulators, escape sequences](https://terminal-wg.pages.freedesktop.org/bidi/recommendation/escape-sequences.html)
- Vim's `termbidi` option is the inverse contract. It says the terminal is in charge of bidi and of shaping, and Vim then does nothing. — [denops_std termbidi docs (mirrors Vim help)](https://deno.land/x/denops_std@v6.2.0/option/mod.ts?s=termbidi)
- Emacs maintainers note that on text-mode frames Emacs "just writes the codes of the characters to the terminal", since it can't select glyphs, so shaping is hard to do app-side. — [emacs-devel via yhetil](https://yhetil.org/emacs/83o9ds9t24.fsf@gnu.org)

### Inferences
- **How a ratatui-bidi layer would work:** keep app state logical. At render time, for each `Line`/`Paragraph` row, run `unicode_bidi::BidiInfo::new(text, Some(base))` → `visual_runs(para, line_range)` → emit spans in visual order, reversing the characters inside RTL runs, mirroring brackets yourself (unicode-bidi skips L4, see §4), and optionally substituting Arabic presentation forms via `ar-reshaper` so a non-shaping terminal joins letters. Wrap first in logical order, then reorder per visual line (UAX #9 L1–L2 are per line). Styles must be carried per grapheme through the permutation. Hit-testing (mouse/cursor) needs the inverse map (`reorder_visual` gives visual→logical). That's the same `colToVisual`/`visualToCol` design prior-art.md credits to termenal-web, just done app-side.
- **The double-reordering hazard is real and has no auto-detection.** If the terminal also does implicit bidi (VTE with `?2501h`, Konsole, mlterm and others; see emulator researcher), visual text gets reordered again into garbage. The layer must send `CSI 8 l` + SCP on entering the alternate screen and `CSI 8 h` on exit. On terminals that ignore these sequences (most macOS terminals, presumably), whether the terminal reorders is unknowable, so the layer needs a user toggle.
- **Presentation forms vs. terminal shaping:** if the terminal shapes (WezTerm, kitty, iTerm2 with ligatures/HarfBuzz), sending base letters in visual order lets it shape using visual neighbours. But a shaper given visual-order text shapes RTL runs incorrectly unless it knows they're RTL. In practice, pre-shaping to presentation forms is the only predictable way to get joined letters cell by cell, with all the known costs: copy yields presentation forms, lam-alef ligatures collapse two logical chars into one cell, and no forms exist for non-Arabic-Persian joining scripts.
- This only fixes **apps you write or fork**. It doesn't meet the user's "any terminal app" goal. Its value is as a library others adopt (ratatui has a large ecosystem) and as the reference implementation of the transform that a PTY proxy would also need.

### Gaps
- No upstream ratatui maintainer statement on whether a bidi layer would be accepted in core vs. as a third-party widget. There are no discussions on it.
- Not verified: whether FrankenTUI's bidi partitioning actually reorders RTL runs to visual order or only segments them. That needs a code read.
- Which macOS terminals honour `CSI 8 l` was not tested here. Defer to the emulator researcher.

## 2. LD_PRELOAD / DYLD_INSERT_LIBRARIES write() interception: feasibility in Rust, weaknesses, prior art

### Takeaway
Technically buildable (a Rust `cdylib` using `redhook` on Linux, or a `__DATA,__interpose` table on macOS), but a poor fit for "any terminal app". On macOS it is **silently ignored for SIP-protected system binaries and for hardened-runtime binaries, which includes the user's own `claude` binary** (verified locally). Even where injection works, buffered stdio inside libSystem bypasses an interposed `write()` (verified locally). And write boundaries don't align with escape sequences or lines, with no screen model to tell where text lands. No prior art doing bidi this way was found.

### Cited Findings
- `man dyld` (macOS): "If System Integrity Protection is enabled, these environment variables are ignored when executing binaries protected by System Integrity Protection." — local `man dyld`, Darwin 25.6 (Apple's dyld(1) manual)
- Apple DTS (Quinn): the dynamic linker generally ignores `DYLD_INSERT_LIBRARIES` for "protected" executables, which include hardened-runtime programs and system software. — [Apple Developer Forums 731358](https://developer.apple.com/forums/thread/731358)
- Hardened-runtime binaries only honour DYLD variables with the `com.apple.security.cs.allow-dyld-environment-variables` entitlement. Loading a dylib signed by someone else additionally needs `com.apple.security.cs.disable-library-validation`. — [northpole.security cookbook](https://northpole.security/cookbook/block-dyld-injection); [Apple Developer Forums 703757](https://developer.apple.com/forums/thread/703757)
- An Apple forum reply says that on hardened-runtime binaries the runtime, not SIP, decides. Disabling SIP is a heavy, system-wide security downgrade. — [Apple Developer Forums 703757](https://developer.apple.com/forums/thread/703757)
- **Verified locally:** a C dylib interposing `write()` via `__DATA,__interpose`, loaded with `DYLD_INSERT_LIBRARIES`:
  - `/bin/echo` (Apple platform binary, arm64e): **0** hooked writes, because the variable is stripped.
  - `~/.local/bin/claude` (`codesign` flags `0x10000(runtime)`, i.e. hardened): **0** hooked writes.
  - `/Applications/WezTerm.app/.../wezterm-gui` is also `runtime`-flagged.
  - Homebrew `node` (ad-hoc signed): hooked. Homebrew `lazygit` (Go, ad-hoc/linker-signed): hooked. This shows Go on macOS goes through libSystem, so the Linux "Go is static, raw syscalls" objection doesn't apply on macOS.
  - Homebrew `nvim --version` and `fribidi --help`: **0** hooked writes although injection was allowed.
  - A test program calling `printf()` then `write()` logged only the direct `write()` (n=10). **stdio's internal writes inside libSystem don't pass through the interposed symbol**, so a hook would also have to cover `fwrite`/`fputs`/`puts`/`putc`/`vfprintf`/`writev` and so on.
  - Copying `/bin/echo` out of the SIP path to dodge protection: the copy was SIGKILLed (exit 137). The old "copy the SIP binary" workaround ([MacPorts #51905](https://trac.macports.org/ticket/51905), ~8 years old) doesn't work for arm64e platform binaries today.
- Rust tooling exists: `redhook` 2.0.0 (LD_PRELOAD helper; last release 2020-09-13, 47.6k downloads) and `frida-gum` 0.17.2 (Frida bindings, 2026-05) for inline hooking. — [crates.io/redhook](https://crates.io/crates/redhook), [crates.io/frida-gum](https://crates.io/crates/frida-gum)
- Prior-art search for LD_PRELOAD bidi/reshaping hooks found nothing. The closest things are stream transformers (estaterm PTY proxy, fa-console in-process). — [web search, 2026-10-11](https://www.unicode.org/mail-arch/unicode-ml/y2019-m01/0397.html) (only spec discussion surfaced); prior-art.md catalog

### Inferences
- **Structural weaknesses**, independent of the OS:
  1. One `write()` can hold half an escape sequence or half a UTF-8 code point, and one logical line can arrive across many writes. The shim must buffer and parse VT state, which turns it into a PTY proxy living inside the process, with worse failure modes such as latency and deadlocks on partial lines.
  2. There's no screen model. A TUI writes `CUP row;col` + a fragment, so the shim can't know a fragment's line context, which bidi needs at paragraph/line level. Full-screen apps (vim, htop, Claude Code's Ink UI) become unfixable, the same wall estaterm hit.
  3. It only sees processes it's injected into, and is lost on `exec` of protected binaries, inside `sudo`, `ssh` to remote hosts, and in containers.
  4. On Linux, statically linked binaries (Go by default, Rust `x86_64-unknown-linux-musl`) don't call libc `write()` dynamically, so LD_PRELOAD never fires. This is widely known but wasn't verified in this session.
  5. Text rewritten this way is visual order plus presentation forms. Prior-art.md already shows this breaks copy, search and ANSI.
- **Net:** on macOS specifically, the shim fails for exactly the user's main target (Claude Code is hardened). It isn't a viable "any app" route. At most it's a curiosity for ad-hoc-signed Homebrew tools.

### Gaps
- Not tested: Linux LD_PRELOAD behaviour on Go/musl binaries (no Linux box in this session).
- Not checked: whether Claude Code's entitlements include `allow-dyld-environment-variables`. The empirical 0 hooks strongly suggest not.

## 3. Line-oriented filter tools (`cmd | rtl`): what exists, Persian quality, limits

### Takeaway
`fribidi` (GNU FriBidi CLI, `brew install fribidi`) already is a working `rtl` pipe filter. It does UAX #9 reordering plus Arabic shaping into presentation forms, keeps ZWNJ, uses Persian-correct yeh/kaf forms, and keeps Persian digits in LTR order. Its defaults (80-column right-pad, its own line breaking that can split a word mid-letter) need flags. `bidiv` is an older Hebrew-oriented GPL viewer. A Rust clone is easy but only worth it for ANSI-aware handling (pass SGR colours through) and Persian presets. Filters only fit non-interactive, line-oriented output.

### Cited Findings
- `bidiv`: "converts such text into visual-order text which can be viewed on terminals that do not handle bidirectionality". Synopsis `bidiv [ -plj ] [ -w width ] [file...]`, used like `bidiv file | less`. Hebrew-oriented (ISO-8859-8-i or UTF-8), GPLv2, by Nadav Har'El, built on fribidi. Not packaged in Homebrew (`which bidiv` empty locally). — [Debian bidiv(1)](https://manpages.debian.org/trixie/bidiv/bidiv.1.en.html); [bidiv README](https://allstar.jhuapl.edu/repo/p1/amd64/bidiv/doc/README)
- `fribidi` CLI options: `--nopad` ("Do not right justify RTL lines"), `--nobreak`, `-w/--width` (default 80), `--rtl`/`--ltr`/`--wrtl`/`--wltr` base direction, `--clean` (strip explicit format codes). — local `fribidi --help`, v1.0.17; [fribidi(1)](https://unix.com/man-page/linux/1/fribidi/)
- **Verified locally:** input `می‌خواهم ۱۲۳ فایل را با git commit بفرستم.` → `fribidi --nopad` output `.ﻢﺘﺳﺮﻔﺑ git commit ﺎﺑ ﺍﺭ ﻞﯾﺎﻓ ۱۲۳ ﻢﻫﺍﻮﺧ‌ﯽﻣ`. In the code points:
  - letters became Arabic Presentation Forms-B (U+FExx) and, for Persian yeh, Forms-A (`FBFE` medial/`FBFD` final ی), so Persian ی was not degraded to Arabic ي;
  - ZWNJ `200C` is kept in place, so می‌ stays visually unjoined;
  - Persian digits `06F1 06F2 06F3` stay in left-to-right order;
  - the Latin run `git commit` stays intact;
  - the trailing period moved to the visual left (correct for an RTL paragraph).
- **Verified locally:** with `--width 40` and a 42-character line, fribidi wrapped by itself and **split the word می‌خواهم, stranding its first letter ﻣ** on a padded second line. Its line breaking is unusable for Persian prose, so use `--nobreak --nopad`.
- Rust: `fribidi` 0.1.2 / `fribidi-sys` bindings (2023, ~4k downloads) and `rtl_reshaper_rs` 0.1.0 (2021: "CLI tool to reshape and reorder bi-directional, Arabic/Persian text for display in apps that do not..."; no repo listed, 1.6k downloads). — [crates.io/fribidi](https://crates.io/crates/fribidi), [crates.io/rtl_reshaper_rs](https://crates.io/crates/rtl_reshaper_rs)
- The Dart `arabic_bidi` package (a terminal display helper) disables lam-alef ligature substitution by default "because not all terminal fonts render Presentation Forms correctly". That's a practical font-coverage caveat for every presentation-form filter. — [pub.dev arabic_bidi](https://pub.dev/packages/arabic_bidi)

### Inferences
- **Limits of any filter:**
  - It sees the output stream only after the app has already laid it out (column-aligned tables, `ls -l`, progress bars using `\r`).
  - ANSI SGR sequences inside the stream are reordered as text unless the filter parses them out. fribidi doesn't (prior-art.md shows fa-console corrupting ANSI the same way).
  - Copy yields presentation forms in visual order.
  - Interactive and full-screen programs can't be piped.
  - On a terminal that does its own bidi, the output is reordered twice.
- **What a Rust `rtl` filter could add over fribidi:**
  1. ANSI-aware: tokenize with a VT parser (e.g. the `vte` crate), reorder only the text and re-attach SGR to graphemes.
  2. Persian presets on by default: `--nobreak --nopad`, ي/ك → ی/ک normalisation, optional digit folding.
  3. A `--shape=none` mode for terminals that shape but don't reorder.
  4. Width-aware right alignment via `unicode-width` rather than byte counts.
- It's a weekend-sized project and a useful test harness for the core transform, but it covers maybe the "`cat` a Persian file / `git log` with Persian commit messages" slice, not interactive use.

### Gaps
- Not tested: fribidi's handling of embedded ANSI colour codes (expected broken, unverified). Same for lam-alef rendering in WezTerm with Vazirmatn and other fonts.

## 4. Rust crate ecosystem for the transform, and Persian gotchas

### Takeaway
The Rust building blocks are mature and current:
- `unicode-bidi` (servo; Unicode 17.0 data, full BidiTest/BidiCharacterTest suites in CI, ~530M downloads) for UAX #9;
- `ar-reshaper` (no-std, Persian-aware presentation forms) for cell-wise shaping;
- `harfrust` (the official HarfBuzz Rust port, v0.14.0 Oct 2026, superseding `rustybuzz`) for real shaping;
- `unicode-width` / `unicode-segmentation` for cells and graphemes.

The main caveats: unicode-bidi skips L3/L4 (mirroring, combining), and presentation forms change cell counts.

### Cited Findings
- `unicode-bidi` 0.3.18 (crate release 2024-12-16; repo HEAD 9a8c7b0, 2026-09-15): `UNICODE_VERSION: (u64, u64, u64) = (17, 0, 0)` in `src/char_data/tables.rs`. — [servo/unicode-bidi](https://github.com/servo/unicode-bidi)
- unicode-bidi API: `BidiInfo::new`, `ParagraphBidiInfo` (single paragraph), `reorder_line`, `reordered_levels`, `reordered_levels_per_char`, `reorder_visual(levels) -> Vec<usize>` (gives `indexMap[visualIndex]==logicalIndex`), `visual_runs`, `has_rtl`. — `src/lib.rs` lines 546–682, 790–827; [docs.rs/unicode-bidi](https://docs.rs/unicode-bidi/latest/unicode_bidi/)
- unicode-bidi limits, quoted from source: "This does not apply [Rule L3] or [Rule L4] around combining characters or mirroring" (`src/lib.rs:589`). `reorder_visual` "only runs Rule L2 ... as it does not have information about the actual text" and warns that byte-aligned level arrays can reverse bytes within a code point. — [servo/unicode-bidi src/lib.rs](https://github.com/servo/unicode-bidi/blob/main/src/lib.rs). The companion crate `unicode-bidi-mirroring` 0.4.0 supplies the mirroring property. — [crates.io](https://crates.io/crates/unicode-bidi-mirroring)
- Conformance: `tests/conformance_tests.rs` runs `BidiTest.txt` and `BidiCharacterTest.txt` with no `#[ignore]` and panics if `fails` is non-empty ("{} test cases failed! ({} passed)"), so a green CI implies full pass. CI status wasn't checked in this session. — [servo/unicode-bidi tests](https://github.com/servo/unicode-bidi/blob/main/tests/conformance_tests.rs)
- Alternatives: `wezterm-bidi` (republished as `zeughaus-wezterm-bidi` 0.2.3, "The Unicode Bidi Algorithm (UBA)" from WezTerm), `unic-bidi` (stale, 2019), `fribidi` bindings. — [crates.io search "bidi"](https://crates.io/search?q=bidi)
- `ar-reshaper` 1.5.0 (MIT, no-std, `unsafe` forbidden): "reconstruct Arabic, Turkish and Persian sentences to be used in applications that don't support Arabic script". It has Persian letters with full forms, e.g. `06A9` ک → `FB90/FB91/FB8F` and `06CC` ی → `FBFE/FBFF/FBFD`, plus optional ligatures, `ttf-parser` font-aware ligature gating, and configurable ZWJ support. — [YouKnow-sys/ar-reshaper](https://github.com/YouKnow-sys/ar-reshaper) (`src/letters/letters_db.rs`, `src/config.rs:148`)
- **ZWNJ in ar-reshaper (code read):** U+200C isn't in the letter DB, so it takes the `!self.letters.contains_key(&letter)` → `LetterForm::Unsupported` branch. The next letter sees `previous_letter.1 == Unsupported` and starts an isolated/initial form. ZWNJ is therefore **kept and correctly breaks joining**, though only by falling through rather than by explicit handling. — `src/reshaper.rs` ~L99–110 ([repo](https://github.com/YouKnow-sys/ar-reshaper/blob/master/src/reshaper.rs))
- Other reshapers: `arabic_reshaper` 0.4.2 (2023), `fa-shaper` 0.1.0 (2026-07: "zero-dependency Persian text reshaper and RTL layout helper for Rust GUI frameworks", 26 downloads), `autonomo-arabic-reshaper` (game modding). — [crates.io](https://crates.io/search?q=reshaper)
- Shaping: `harfrust` 0.14.0 (2026-10-04, repo `harfbuzz/harfrust`, ~11.7M downloads) vs `rustybuzz` 0.20.1 (last release 2024-11-12). The HarfBuzz org now hosts harfrust as the maintained line. — [crates.io/harfrust](https://crates.io/crates/harfrust), [crates.io/rustybuzz](https://crates.io/crates/rustybuzz)
- `unicode-width` 0.2.2 (2025-10-06) and `unicode-segmentation` 1.13.3 (2026-06-01) are current. — [crates.io/unicode-width](https://crates.io/crates/unicode-width), [crates.io/unicode-segmentation](https://crates.io/crates/unicode-segmentation)
- Persian normalisation crates exist (`parsitext`, `yekdast`, `persian-rs`, `rust-persian-tools`) for ي/ك → ی/ک folding and similar. — [crates.io search "farsi"](https://crates.io/search?q=farsi)

### Inferences
- **Persian gotchas a transform must handle:**
  - **ZWNJ U+200C:** must survive reordering (it's BN/neutral and stays adjacent), break joining, and be 0 cells wide. Confirm `unicode-width` gives it 0; ratatui #2730 shows zero-width symbols are a live footgun in cell buffers.
  - **Yeh/kaf:** Persian ی U+06CC / ک U+06A9 vs Arabic ي U+064A / ك U+0643. Use the Persian letters' own presentation forms. ar-reshaper and fribidi both do this; verified for fribidi.
  - **Digits:** Extended Arabic-Indic ۰–۹ (U+06F0–06F9, bidi class EN) vs Arabic-Indic U+0660–0669 (class AN). They resolve differently next to separators, e.g. dates `۱۴۰۵/۰۷/۱۹`, so test both.
  - **Lam-alef ligatures** collapse two logical characters into one cell, breaking the 1:1 logical↔cell map that cursor and hit-testing rely on. Many terminal fonts lack the ligature glyphs (see the arabic_bidi note). Default ligatures **off** for terminals.
  - **Harakat** (combining marks): width 0. unicode-bidi skips L3, so the app must keep marks attached to their base when reversing (reverse by grapheme cluster with `unicode-segmentation`, never by `char`).
  - **Mirroring:** brackets in RTL runs need explicit mirroring (`unicode-bidi-mirroring`), since L4 isn't applied.
- Recommended stack for a Rust helper: `unicode-segmentation` (graphemes) → `unicode-bidi` (levels, visual runs, `reorder_visual` for maps) → `unicode-bidi-mirroring` → optional `ar-reshaper` (presentation forms, ligatures off) → `unicode-width` (cells). `harfrust` only matters if you render glyphs yourself (an emulator), not when emitting characters to a terminal.

### Gaps
- `unicode-width`'s exact value for U+200C and for Arabic harakat in 0.2.2 wasn't verified (needs a one-line test).
- unicode-bidi CI status on its latest HEAD wasn't checked.

## 5. Best 80/20 for a solo builder: recommendation candidates

### Takeaway
Of the app-side routes, none delivers "any terminal app". The shim is effectively dead on macOS for the user's main target, Claude Code, which is hardened. The best 80/20 is to **build one Rust core crate for the transform** (logical line → visual cells + maps, Persian-correct) and ship it through cheap front-ends: a `fribidi`-beating ANSI-aware `rtl` filter now, and a ratatui widget/adapter as an ecosystem contribution. The same core is then reused unchanged by the PTY-proxy or emulator route that "any app" really needs.

### Cited Findings
- Claude Code's binary is hardened-runtime, so DYLD injection is ignored (verified locally, §2). Apple documents that protected and hardened binaries ignore DYLD variables. — [Apple Developer Forums 731358](https://developer.apple.com/forums/thread/731358)
- `fribidi` already gives correct Persian ordering and shaping for line output (verified locally, §3). — [fribidi](https://github.com/fribidi/fribidi)
- No ratatui RTL crate exists, and upstream has no bidi work in flight, so the niche is open. — [ratatui#756](https://github.com/ratatui/ratatui/issues/756), crates.io searches
- The terminal-ownership handshake for app-side bidi is `CSI 8 l` + SCP. — [terminal-wg BiDi escape sequences](https://terminal-wg.pages.freedesktop.org/bidi/recommendation/escape-sequences.html)

### Inferences
Ranked candidates:
1. **`persian-bidi-core` (Rust lib).** `fn layout_line(&str, base: Dir, opts) -> VisualLine { cells, logical_to_visual, visual_to_logical, styles }`, built on unicode-segmentation, unicode-bidi, mirroring, optional ar-reshaper and unicode-width. Test it with the UAX #9 conformance files plus a Persian corpus (ZWNJ, both digit sets, mixed paths/code, harakat, lam-alef). **Highest leverage:** every other route (filter, ratatui, PTY proxy, emulator plugin) consumes it.
2. **`rtl` filter CLI (1–3 days on top of the core).** ANSI-aware via the `vte` parser, Persian defaults, `--shape none|forms`, no line breaking. Covers `cat`/`git log`/`less -R` cases today. It doubles as the demo and test harness. Clearly document that it's for non-interactive output and for terminals that don't do bidi themselves.
3. **`ratatui-bidi` adapter (a week or more).** A `BidiParagraph` widget / `Line` extension that lays out via the core, sends `CSI 8 l` + `CSI 2 SPACE k` on enter and resets on exit, and exposes the hit-test maps. Valuable to the Rust TUI ecosystem and a strong showcase, but it only helps apps that adopt it.
4. **Not recommended:** the LD_PRELOAD/DYLD shim. It's blocked on hardened and SIP binaries (including Claude Code), misses stdio-internal writes, has no screen model, and on Linux misses static binaries.
5. For the stated "any terminal app" goal, the app-side routes are at best stepping stones. Defer to the PTY-proxy and emulator findings for the actual delivery vehicle, and plan for the core crate to be shared with it.

### Gaps
- No user-research data on which apps the user most needs fixed beyond Claude Code. If it's mostly Claude Code (an Ink/React TUI in a hardened binary), only a PTY-proxy or emulator route can reach it. App-side and shim routes can't.
