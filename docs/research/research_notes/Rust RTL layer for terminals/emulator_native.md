# Emulator-native RTL/BiDi support, and a Rust patch or plugin inside the emulator

> Researched 2026-10-11. Scope: the terminal-emulator layer only. Spec theory, the PTY-proxy/multiplexer route and app-side routes are covered elsewhere. It does not repeat [prior-art.md](../../prior-art.md), which catalogs ten small projects (RtlTerminal, termenal-web, termux-app-arabic and others). This file covers the **mainstream** emulators and the Rust crate ecosystem.
>
> Method: GitHub issue threads and maintainer comments (read through `gh api`), a sparse clone of `wezterm/wezterm@main` (read on 2026-10-11; grep only, nothing built), crates.io API metadata, and official changelogs. Where a claim rests on one secondary source, it says so.

## 1. WezTerm: what works today, and is `wezterm-bidi` reusable?

### Takeaway
WezTerm is the only mainstream **Rust** emulator with real UAX #9 bidi wired end to end: config, the terminal-wg escape sequences, per-line bidi and HarfBuzz shaping per direction run. It is still labelled "experimental (and incomplete!)". There has been no tagged release since 2024-02-03, and the known gaps are cursor/editing in RTL runs, Lam-Alef cell width and paragraph = physical line. `wezterm-bidi` is a standalone, `no_std`, 100 %-conformant UBA crate, but it does only levels + line reordering, not shaping or the grid mapping.

### Cited Findings
- Bidi landed in release **20220319-142410-0fcdea07**. The changelog says: "Experimental (and incomplete!) support for Bidi/RTL can be enabled through the config", with tracking issue #784. — [wezterm changelog (docs/changelog.md, line 1721, read in clone)](https://github.com/wezterm/wezterm/blob/main/docs/changelog.md)
- Config gating: `wezterm-gui/src/main.rs:880` uses `config.bidi_enabled` and `config.bidi_direction` as a hint to `line.cluster(bidi_hint)`. The shaper (`wezterm-font/src/shaper/harfbuzz.rs`) takes a `wezterm_bidi::Direction` per run, so HarfBuzz shapes each run in its resolved direction. — [wezterm source, main branch](https://github.com/wezterm/wezterm/tree/main/wezterm-gui/src)
- Terminal-wg escape-sequence support is implemented in `term/src/terminalstate/mod.rs`. BDSM (`BiDirectionalSupportMode`) can be set, reset and queried (lines 1748–1759). A comment says `bidi_enabled = true` "is equivalent to 'implicit' bidi mode" as in the terminal-wg basic-modes recommendation (line 401). SCP (`SelectCharacterPath`) sets the paragraph-direction hint to LTR, RTL or default (`performer.rs:510–521`). RIS resets both (`performer.rs:716`). — [term/src/terminalstate/mod.rs](https://github.com/wezterm/wezterm/blob/main/term/src/terminalstate/mod.rs), [performer.rs](https://github.com/wezterm/wezterm/blob/main/term/src/terminalstate/performer.rs)
- Bidi state is applied **per line** (`Screen::…bidi_mode.apply_to_line(&mut line, seqno)`), and there are `FIXME: borrow bidi mode from line` comments in `term/src/screen.rs:262,306`. So the paragraph is the physical line, and there is unfinished work around reflow. — [term/src/screen.rs](https://github.com/wezterm/wezterm/blob/main/term/src/screen.rs)
- An older change filters Unicode bidi controls and other zero-width graphemes out of the terminal model. The changelog admits "that information is essentially lost when copying to the clipboard". `performer.rs:150` still notes that U+2068 (FSI) is dropped. This matters for the LRI/FSI-isolation strategy that apps rely on. — [changelog line 1799, #1422](https://github.com/wezterm/wezterm/issues/1422)
- Tracking issue **#784 "Add support for RTL languages"** (opened 2021-05-11, 72 comments) is still open. A user on 2025-05-23 thanked the author for RTL/bidi support but reported the main pain point: cursor movement and **editing in the middle of RTL runs** (the cursor doesn't flip direction over RTL text). A user on 2026-03-17 said "as expected it works partially". — [wezterm#784](https://github.com/wezterm/wezterm/issues/784)
- Lam-Alef bug **#6791** (open, 2025-03-13): "السلام" leaves an extra cell, because the LAM-ALEF ligature occupies two cells. Fonts tried: JetBrains Mono + Kawkab Mono. — [wezterm#6791](https://github.com/wezterm/wezterm/issues/6791)
- In #784, a contributor explains that vim/neovim `arabicshape` emits Presentation Forms-B and depends on it for Lam-Alef. On a shaping terminal like WezTerm you would set `noarabicshape`, but then you lose neovim's Lam-Alef handling. This is a "two owners" conflict in practice. — [wezterm#784 comments, 2025-03-09/10](https://github.com/wezterm/wezterm/issues/784)
- Other open issues: #4354 "Bidi control per word instead of sentence" (2023); #5056 "﷽ doesn't display properly (super small)"; #8032 (2026-08-08) "Devanagari clusters overflow their allocated cells; `.min(2)` clamp defeats the `cell_widths` workaround". That is the same width/grid tension Persian hits. — [wezterm issues search](https://github.com/wezterm/wezterm/issues?q=bidi)
- In kitty's width-compliance test (April 2025), WezTerm 5046fc22 failed 179 grapheme/width tests (kitty master: 0). — [kitty#8533](https://github.com/kovidgoyal/kitty/issues/8533)
- **Maintenance:** the latest GitHub release is still `20240203-110809-5046fc22` (published 2024-02-03), but `main` is active. Wez Furlong committed on 2026-10-10 (mux, ssh, escape-parser `no_std`, CI). The repo has 29.2k stars and is not archived. — [GitHub API: wezterm/wezterm](https://github.com/wezterm/wezterm/commits/main)
- **`wezterm-bidi` crate:** v0.2.3, "pure Rust", `no_std` + `alloc`, "does not depend on other code in wezterm". It "resolves embedding levels and can reorder line ranges" and is "conformant with 100% of BidiTest.txt and BidiCharacterTest.txt (approx 780,000 test cases)". License: MIT AND Unicode-DFS-2016. The README says it was derived from Unicode's bidiref. The only runtime dependencies are `log` and `wezterm-dynamic`. The last crates.io publish was 2024-01-27; the repo dir was last touched in 2026-09 (style only). — [bidi/README.md](https://github.com/wezterm/wezterm/tree/main/bidi), [crates.io wezterm-bidi](https://crates.io/crates/wezterm-bidi)
- The WezTerm author, quoted on a social post, called Arabic shaping + BiDi hard for terminals and pointed to the open issue. The snippet was truncated, so this is a secondary source. — [Hackers' Pub (wez)](https://hackers.pub/@wez@treehouse.systems/019ed0bf-7ff1-708f-8392-3bc3e644e0a1/quotes)

### Inferences
- For Persian on the user's machine, WezTerm with `bidi_enabled = true` should give joined letters and UAX #9 reordering on plain output. Expect breakage in: editing mid-RTL (cursor), Lam-Alef width, lines that wrap (paragraph = row), dropped FSI/LRI controls on copy, and full-screen TUIs that do their own reordering.
- Because WezTerm already implements BDSM + SCP, it's the natural target for testing persian-cli's "negotiate bidi ownership" principle, as the only Rust emulator where an app can turn terminal bidi off on the alt screen.
- Upstream PRs land on `main` but don't reach users through a release, which lowers the value of contributing there: Homebrew users get nightly or nothing.

### Gaps
- I couldn't fetch the rendered docs pages for `bidi_enabled` / `bidi_direction`. wezterm.org returned 404 and the files weren't in the sparse docs tree, so the exact defaults (`bidi_enabled=false` and `bidi_direction="AutoLeftToRight"` as I remember them) are **unverified**.
- ZWNJ handling: no issue or test found that specifically covers ZWNJ (U+200C) in WezTerm. Given the zero-width filtering in #1422, it should be tested empirically. It may be dropped from the model.
- Not verified whether selection/copy returns logical order with bidi on.

## 2. Comparison of other emulators

### Takeaway
Only VTE (GNOME Terminal and friends), mlterm, Konsole and Apple Terminal have long-standing working RTL. Among GPU/modern emulators, WezTerm (Rust) and iTerm2 3.6 (experimental) ship it. Ghostty has an open, active shaping PR. Kitty, Alacritty and Windows Terminal maintainers decline it or defer it to a standard. No Rust emulator other than WezTerm does bidi. Alacritty refuses it, Rio has a bare feature request, and COSMIC Terminal (cosmic-text) shapes but forces LTR lines.

### Cited Findings
| Emulator | Lang | Shaping | Bidi | terminal-wg BiDi spec | Plugin surface | Status / source |
|---|---|---|---|---|---|---|
| **WezTerm** | Rust | Yes (HarfBuzz, per bidi run) | Yes, opt-in, "experimental (and incomplete!)" | Partial: implicit mode via BDSM, SCP direction | Lua config + event callbacks (no glyph hook) | §1 above |
| **Alacritty** | Rust | No (no ligatures either, #50 open since 2017) | No | No | None | Maintainer chrisduerr: "extremely little interest… recommend using a different terminal emulator" (2024-01-12). "very unlikely an outside contributor would be capable of sending a PR that would get accepted" (2024-01-13). 2025-11-28: "complexity that none of the maintainers are interested/familiar with". #663 is open; #8828 (word-level RTL, 2026-01) was closed. [alacritty#663](https://github.com/alacritty/alacritty/issues/663), [#8828](https://github.com/alacritty/alacritty/issues/8828) |
| **Rio** | Rust | Uses its own Sugarloaf renderer; no RTL found | No | No | None found | Only #1257 "[Feature] BiDi Text Support" (2025-08-06, 0 comments). It names VTE, mlterm and Apple Terminal as the ones that do it well. Active: v0.5.28 on 2026-09-17. [rio#1257](https://github.com/raphamorim/rio/issues/1257) |
| **COSMIC Terminal** (cosmic-term) | Rust (alacritty_terminal 0.25 + cosmic-text) | Yes (cosmic-text/HarfRust) | **Forced LTR**: "Lines are always laid out left to right since #38" | No | None | A third-party patch mirrors RTL lines within the row: [rezainet/cosmic-term-persian-arabic](https://github.com/rezainet/cosmic-term-persian-arabic). [cosmic-term#927](https://github.com/pop-os/cosmic-term/issues/927) (2026-09-29), [Cargo.toml](https://github.com/pop-os/cosmic-term/blob/master/Cargo.toml) |
| **Ghostty** | Zig | In progress | In progress (renderer-only scope) | No (Mitchell: doesn't plan to implement the terminal-wg spec "in the near term", 2024-02-02) | libghostty embedding API; no glyph plugin | PR **#11079** "font/shaper: add RTL shaping for Arabic and Hebrew", open since 2026-02-28 and updated 2026-10-05. It uses **itijah** (pure-Zig UAX #9, MIT, passes BidiTest/BidiCharacterTest). Scope is "shaping only. Cursor positioning, selection, terminal model, and protocol changes are intentionally out of scope". A parallel fork (ibrahimhajjaj) has cursor/selection branches. A 2026-10-05 tester report compares it with VTE 0.84.1. [ghostty#1442](https://github.com/ghostty-org/ghostty/issues/1442), [PR #11079](https://github.com/ghostty-org/ghostty/pull/11079) |
| **Kitty** | C + Python | Yes (HarfBuzz) for LTR | No | No | Kittens (Python), remote control | #2109 open since 2019. Kovid (2020): won't accept "significant negative performance impact on normal (i.e. no bidi) usage". He also noted kitty tracks only lines and cells, not paragraphs. #10378 (Arabic, 2026-08) closed as "dup of #2109". [kitty#2109](https://github.com/kovidgoyal/kitty/issues/2109), [#10378](https://github.com/kovidgoyal/kitty/issues/10378). The Alacritty #8828 author shows a screenshot of kitty rendering a Hebrew word un-reversed, so some word-level behaviour exists, but this is unverified in code. |
| **iTerm2** | Obj-C/Swift | Yes (Core Text) | **Experimental** since 3.6.0 (released 2025-09-16): "Right-to-left text support" under Settings > General > Experimental | Unknown | Python API (scripting, not rendering) | [iTerm2 3.6.0 changelog](https://iterm2.com/downloads/stable/iTerm2-3_6_0.changelog). A user blog calls it imperfect for mixed LTR/RTL: [melashri.net](https://blog.melashri.net/micro/iterm2-rtl-support/) |
| **Apple Terminal** | ObjC (Core Text) | Yes | Yes (implicit, system text stack) | No | None | Cited as doing it well in [rio#1257](https://github.com/raphamorim/rio/issues/1257), and as the reference in [ghostty#1442](https://github.com/ghostty-org/ghostty/issues/1442) ("Terminal.app render the same Arabic text correctly") |
| **VTE / GNOME Terminal / Ptyxis** | C | Yes (FriBidi + its own Arabic shaping) | Yes, since VTE 0.58 (2019) | **Reference implementation** of terminal-wg BiDi (Egmont Koblinger) | None (GTK widget) | [terminal-wg BiDi](https://terminal-wg.pages.freedesktop.org/bidi/). Already noted in [prior-art.md](../../prior-art.md). Ghostty testers use VTE 0.84.1 as the comparison baseline in 2026: [PR #11079](https://github.com/ghostty-org/ghostty/pull/11079) |
| **Konsole** | C++/Qt | Yes (Qt) | Yes, implicit (Qt text layout, a profile option) | No | None | Named in [wezterm#784](https://github.com/wezterm/wezterm/issues/784) body and in a 2026 comment ("Konsole by KDE has a nice solution for bidi text"). KDE bug 198169 tracks bidi in the default profile: [bugs.kde.org](https://bugs.kde.org/show_bug.cgi?id=198169) |
| **mlterm** | C | Yes | Yes (FriBidi), long-standing | Partial/own | None | Named as a good implementation in [rio#1257](https://github.com/raphamorim/rio/issues/1257) |
| **Windows Terminal** | C++ | DirectWrite (LTR) | No | No | None | #538 (2019) locked. #20302 (2026-06) was closed as a dup. Microsoft member zadjii (2026-08-28): RTL is hard, it "requires cooperation from both the terminal emulator and the commandline application… there's not a standard", and "we had folks sitting in on the Unicode consortium meetings to help create a standard". [terminal#20302](https://github.com/microsoft/terminal/issues/20302) |
| **st** (suckless) | C | No | Patch only | No | Patches | A 2026-05-07 patch on hackers@ adds FriBidi `fribidi_log2vis()` in `xdrawline()`. It isn't upstream. [lists.suckless.org](https://lists.suckless.org/hackers/2605/19657.html) |
| **Warp** | Rust (own UI) | Unknown | No (open request) | No | Workflows/AI; no rendering hook | Issue #10355 "RTL (Right-to-Left) text direction support", seen only through a mirror: [upd.dev mirror](https://upd.dev/warpdotdev/warp/issues/10355) |
| **Contour / foot** | C++ / C | Contour: HarfBuzz; foot: HarfBuzz via fcft (optional) | Not found | Not found | None | GitHub search was rate-limited, so **unverified**. foot failed 186 tests in kitty's width test: [kitty#8533](https://github.com/kovidgoyal/kitty/issues/8533) |

- Alacritty: a commit titled "Support terminal-wg's BiDi draft proposal in alacritty_terminal" (March 2024, behind a feature flag) exists on a **fork mirror** (PolytreeDE), not upstream. — [git.causa-arcana.com](https://git.causa-arcana.com/PolytreeDE/alacritty/commit/2295953a6627a88fd985ff8a22edb6b3fee3bec1)
- Unicode authorized a limited-duration text-terminal working group at UTC #175 (2023) to advance complex-script support in terminals. Its chair noted that each terminal renders multi-cell text and bidi/shaping cursor behaviour differently. — [Unicode L2/23-194](https://www.unicode.org/L2/L2023/23194-text-terminal-wg-report.pdf)
- Kitty has specified a terminal cell-splitting algorithm (2025) and ships `kitten __width_test__`. Failures out of the test set: WezTerm 179, foot 186, Konsole 280, iTerm2 3.5.13 289, gnome-terminal 317, Apple Terminal 479; it couldn't run on Ghostty 1.1.3. — [kitty#8533](https://github.com/kovidgoyal/kitty/issues/8533)

### Inferences
- In Rust there's exactly one working base (WezTerm). Every other Rust emulator either rejects RTL (Alacritty), hasn't started (Rio, Warp), or has the engine but switched it off (cosmic-term).
- The 2026 burst of Ghostty PRs, the st patch, the cosmic-term patch and LLM-written Windows Terminal requests (zadjii's complaint) all show the same pattern: renderer-only reordering, with cursor, selection and protocol left for later. That matches the "two families" finding in prior-art.md.

### Gaps
- VTE, Konsole, mlterm and Apple Terminal details come from secondary mentions. I didn't fetch their docs (wiki.gnome.org returned 403).
- No Contour or foot issue data (GitHub search API rate limit hit).
- I didn't verify whether iTerm2's RTL implements any terminal-wg sequences.

## 3. Plugin surfaces: can any plugin intercept glyph rendering?

### Takeaway
No. No mainstream emulator exposes a hook between the cell grid and the shaper/rasterizer. WezTerm Lua, Kitty kittens and the iTerm2 Python API operate on config, events, panes, tabs, overlays or text I/O, never on per-row shaping or visual order. Doing it at the emulator layer means an upstream PR or a fork.

### Cited Findings
- WezTerm's Lua module exposes config and event functions; none of them is bidi- or rendering-related. — [wezterm module](https://wezterm.org/config/lua/wezterm/)
- In WezTerm, bidi is applied inside the `term` model (`apply_to_line`) and in `wezterm-gui` clustering/shaping (`line.cluster(bidi_hint)`). These are compiled Rust paths, and no Lua callback reaches them. — [wezterm-gui/src/main.rs](https://github.com/wezterm/wezterm/blob/main/wezterm-gui/src/main.rs)
- Kitty's design tracks only "lines and cells", and adding bidi needs "some kind of extra data structure to track paragraph properties" in the core, not in a kitten. — [kitty#2109](https://github.com/kovidgoyal/kitty/issues/2109)
- The Ghostty work is happening as core PRs (shaper, run iterator, renderer), not through libghostty's embedding API. — [PR #11079](https://github.com/ghostty-org/ghostty/pull/11079)
- iTerm2 ships RTL as a core "Experimental" setting, not as a script. — [iTerm2 3.6.0 changelog](https://iterm2.com/downloads/stable/iTerm2-3_6_0.changelog)

### Inferences
- A "plugin" in practice means one of: (a) a WezTerm fork or PR, which is Rust, so persian-cli could contribute directly; (b) a renderer patch like the cosmic-term one; or (c) leaving the emulator alone and working at the PTY/mux layer (another researcher's scope). Kitty kittens and the iTerm2 API can only draw an overlay, such as a kitten showing a shaped preview, not fix the main grid.

### Gaps
- I didn't confirm from code whether the kitty or iTerm2 overlay APIs could render arbitrary shaped text on top of the grid (a possible "preview pane" hack).

## 4. Reusable Rust crates for the emulator layer

### Takeaway
Bidi is solved in Rust: `unicode-bidi` (servo, very widely used), `wezterm-bidi` (100 % conformance, `no_std`) and ICU4X. Shaping is solved by **HarfRust**, the official HarfBuzz port that succeeds rustybuzz, plus swash. Full layout engines (cosmic-text, parley) do bidi + shaping for **proportional paragraphs**, not cell grids. No crate does "bidi + shaping → cell-grid visual map + cursor/selection mapping".

### Cited Findings (crates.io API, read 2026-10-11)
| Crate | Latest | Last publish | Recent downloads (90 d) | Role |
|---|---|---|---|---|
| `harfrust` | 0.14.0 | 2026-10-04 | 7.57 M | HarfBuzz org's Rust port of HarfBuzz shaping, the successor to rustybuzz — [crates.io](https://crates.io/crates/harfrust), [repo](https://github.com/harfbuzz/harfrust) |
| `rustybuzz` | 0.20.1 | 2024-11-12 | 11.1 M | Older HarfBuzz port; no release in about 2 years — [crates.io](https://crates.io/crates/rustybuzz) |
| `swash` | 0.2.10 | 2026-07-17 | 5.8 M | Shaping + scaling/rasterization (dfrg) — [crates.io](https://crates.io/crates/swash) |
| `cosmic-text` | 0.19.0 | 2026-04-22 | 3.9 M | Full text layout (bidi + shaping + fallback), used by COSMIC Terminal — [crates.io](https://crates.io/crates/cosmic-text) |
| `parley` | 0.12.0 | 2026-10-09 | 2.1 M | Linebender rich-text layout (bidi + shaping) — [crates.io](https://crates.io/crates/parley) |
| `unicode-bidi` | 0.3.18 | 2024-12-16 | 88 M | Servo UAX #9 — [crates.io](https://crates.io/crates/unicode-bidi) |
| `wezterm-bidi` | 0.2.3 | 2024-01-27 | 11.8 M | UAX #9, 100 % conformance, `no_std` — [crates.io](https://crates.io/crates/wezterm-bidi) |
| `icu_properties` (ICU4X) | 2.3.0 | 2026-08-13 | 209 M | Unicode properties, including bidi class; ICU4X also has a bidi component — [crates.io](https://crates.io/crates/icu_properties) |
| `fribidi` (Rust bindings) | 0.1.2 | 2023-02-13 | 17 | Essentially unused; suggested in wezterm#784 — [crates.io](https://crates.io/crates/fribidi) |

- cosmic-text is real-world evidence that it can feed a cell-grid terminal (cosmic-term). But cosmic-term forces LTR line layout, and the community patch had to add mirroring plus cursor/selection mapping itself. It also had to turn off the `rtla` font feature because Menlo-based fonts swap brackets a second time. — [cosmic-term#927](https://github.com/pop-os/cosmic-term/issues/927)
- The Ghostty design shows what a grid layer needs on top of UAX #9: an LTR fast path (skip bidi on rows with no strong-RTL cells), run splitting at level boundaries, per-run shaper direction, per-row logical→visual reorder with `cell.x` kept logical in the shaper, and per-cluster mark anchors. — [ghostty#1442 comments, 2026-05](https://github.com/ghostty-org/ghostty/issues/1442)

### Inferences
- A production stack for Persian in Rust today would be `unicode-bidi` or `wezterm-bidi` (levels/reorder) + `harfrust` (shaping, Persian/Arabic joining, Lam-Alef, marks) + a font-fallback layer. Both bidi crates are conformance-tested. HarfRust inherits HarfBuzz's Arabic shaper and should be preferred over rustybuzz for new work.
- cosmic-text and parley are paragraph engines. Using them for a grid means fighting their line-breaking and proportional advances. They're better as a source of ideas than as the grid core.

### Gaps
- I didn't verify the HarfRust Arabic/Persian test-suite pass rate or swash's Arabic shaping completeness. Both claim HarfBuzz parity or compatibility, but I didn't read them.
- I didn't check whether ICU4X ships a standalone UAX #9 implementation in 2.x or only properties.

## 5. A "drop-in" Rust library for emulator authors: does one exist?

### Takeaway
Nothing like it exists. Each implementation (WezTerm, Ghostty #11079, cosmic-term patch, termenal-web, RtlTerminal) re-builds the same middle layer by hand: bidi runs per row, per-run shaping, a cell↔visual permutation, cursor/selection mapping, a width policy and mode negotiation. A small, emulator-agnostic Rust crate for that layer (call it `bidi-grid`) is a genuine gap, and it would be the highest-leverage emulator-layer contribution.

### Cited Findings
- Ghostty contributors explicitly wrote a standalone UAX #9 library (itijah, Zig) and then built a run iterator, shaper wiring, cursor/selection mapping and RTL justify as **separate stacked branches**. Two contributors produced divergent designs (cluster mirroring vs. per-cluster anchors), and the maintainers asked them to "come up with a unified approach". — [ghostty#1442](https://github.com/ghostty-org/ghostty/issues/1442)
- The Windows Terminal maintainers' position is that the missing piece is a cross-ecosystem standard for terminal/app cooperation, not renderer code. — [terminal#20302](https://github.com/microsoft/terminal/issues/20302)
- WezTerm's `wezterm-bidi` stops at "resolves embedding levels and can reorder line ranges". Cluster/cell mapping lives inside wezterm-gui. — [bidi/README.md](https://github.com/wezterm/wezterm/tree/main/bidi)

### Inferences (proposed shape, not an existing artifact)
- **Input:** one row (or one paragraph spanning wrapped rows) of logical cells `{grapheme, width, attrs}`, a mode (`implicit|explicit`, from BDSM), a direction hint (from SCP/`bidi_direction`) and an optional pane boundary.
- **Output:** a `RowLayout` with visual runs `(cell_range, level, direction)`, `log2vis` / `vis2log` permutations over cells, the cursor's visual x plus a direction-flag affordance, selection → logical ranges, and an LTR fast path (zero cost when there's no strong RTL, which meets Kovid's performance bar).
- **Shaping adapter trait:** the emulator supplies its shaper (HarfRust/HarfBuzz/CoreText). The crate only guarantees shaping per run in the right direction with full-run context, and returns a width policy for clusters such as Lam-Alef (fit, stretch or overflow). That is exactly the layer-3 unsolved problem noted in prior-art.md and wezterm#6791.
- **Control preservation:** keep bidi controls (LRI/FSI/PDI, ZWNJ) in the model as zero-width cells instead of filtering them as WezTerm's #1422 does, so copy round-trips.
- **Where it pays off:** WezTerm (replace or extend its internal clustering and fix #6791 and the cursor issue in #784), cosmic-term (replace the forced-LTR path) and any Rust emulator or multiplexer renderer (Zellij also renders a grid). A FFI/C-ABI build would even let Ghostty or Kitty use it, though Ghostty's Zig culture already rejected adding a C library ("contribute to zg first"): [jcollie, ghostty#1442](https://github.com/ghostty-org/ghostty/issues/1442).
- **Strategic read:** the emulator layer is necessary for correct shaping (only the renderer knows the fonts). But it's not sufficient on its own, because app cooperation and mode negotiation are needed too. For the user's own stack, WezTerm is in Rust, already has BDSM/SCP and is maintained on `main` but unreleased. The best emulator-layer move is a reusable grid crate plus targeted WezTerm PRs (cursor in RTL runs, Lam-Alef width, keeping controls), rather than a plugin, because no plugin surface can reach rendering.

### Gaps
- I found no crate on crates.io that advertises terminal-grid bidi. This is based on the threads above and the crates I checked, not on an exhaustive crates.io search.
- I didn't assess how Zellij's renderer interacts with WezTerm bidi. Zellij redraws with cursor-positioned runs, so WezTerm's per-row bidi would reorder across pane borders, as prior-art.md finding 3 says. That belongs to the multiplexer researcher.
