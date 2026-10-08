# Tarminal
- **Repo:** https://github.com/Moshe-ship/Tarminal · **Commit read:** `8c8ad7e` (2026-04-04, shallow) · **License:** MIT (`LICENSE`, © 2026 Mousa Abu Mazin) · **Language:** Swift 5.9 / SwiftUI · **Platform:** macOS 14+
- **Category:** terminal emulator (thin app shell around the SwiftTerm library)

## What it is
A macOS terminal app with tabs, themes, session restore, notifications and Touch ID helpers, marketed with "Connected Arabic letters — proper shaping via Core Text (every other terminal breaks Arabic)". The whole repo is ~1.5k lines of Swift across 12 files; all terminal emulation and rendering is delegated to **SwiftTerm 1.13.0** (`Package.swift`, `Package.resolved` pins rev `8e7a1e15`).

## How it works (verified in code)
- **Architecture:** SwiftUI app → `TerminalContainerView` (`NSViewRepresentable`) → `TarminalTerminalView`, a 20-line subclass of SwiftTerm's `LocalProcessTerminalView` that only overrides `bell(source:)` and adds `enableMetal()` (`Tarminal/Terminal/TarminalTerminalView.swift:5-19`).
- **PTY / process:** `startProcess(executable: shell, args: ["--login"], environment: env …)` with `TERM=xterm-256color` from `Terminal.getEnvironmentVariables` (`Tarminal/Terminal/TerminalContainerView.swift:107-123`).
- **Rendering:** toggles SwiftTerm's Metal renderer via `setUseMetal(true)` (`TarminalTerminalView.swift:11-13`, `TerminalContainerView.swift:66-70`, `:135-139`).
- **Font:** `tv.font = NSFont(name: theme.fontName, …) ?? NSFont.monospacedSystemFont(…)` (`TerminalContainerView.swift:160`); default SF Mono 13pt per commit message. No Arabic fallback font configured.
- **Arabic / RTL code in this repo: none.** A grep for `rtl|bidi|arabic|harfbuzz|CTLine|CoreText|direction|ligature|shaping|persian|hebrew` over `Tarminal/` returns zero matches outside UI shape modifiers. There is no shaping, bidi, width, selection or input code; the "Core Text shaping" claim refers entirely to whatever SwiftTerm does internally.
- **Input:** SwiftTerm defaults; app only sets `optionAsMetaKey` (`TerminalContainerView.swift:51`). File drops are shell-escaped and sent (`:209-213`).
- **Selection/copy:** SwiftTerm defaults; app only sets `selectedTextBackgroundColor` (`:162`).
- **Tests:** none. No test target in `Package.swift`.

## Layer coverage
(Status reflects this repo; anything SwiftTerm does is marked `?` because the dependency is not in the clone and was not read.)

| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ? | Entirely SwiftTerm; no code here |
| 2 Input | ? | SwiftTerm `NSTextInputClient`; app sets only Option-as-Meta (`TerminalContainerView.swift:51`) |
| 3 Width | ? | SwiftTerm's wcwidth; nothing here |
| 4 Shaping | ? | README/CLAUDE.md claim Core Text via SwiftTerm; no shaping code in repo; Metal renderer enabled by default and its shaping behavior unverified |
| 5 Bidi | ❌ | No bidi code; README does not even claim bidi/RTL ordering — only "connected letters" |
| 6 Cursor/selection/copy | ? | SwiftTerm defaults |
| 7 Fonts | ◐ | User-selectable font with SF Mono fallback (`:160`); no Arabic-script fallback chain |
| 8 Multiplexers | ❌ | Nothing |
| 9 Apps & TUI frameworks | ? | Inherits SwiftTerm's xterm emulation; no RTL-specific handling |

## Claimed but not verified
- "Connected Arabic letters — proper shaping via Core Text (every other terminal breaks Arabic)" (`README.md` Features; `CLAUDE.md` "What Works"). Not implemented in this repo; depends on SwiftTerm, and the README's "every other terminal" claim is false (mlterm, Konsole, VTE/GNOME Terminal with bidi, iTerm2 partially, etc.).
- "Core Text (Arabic shaping) + Metal (GPU rendering)" architecture diagram — the app enables Metal by default; whether SwiftTerm's Metal path shapes Arabic runs (vs per-cell glyph-atlas lookup) is unverified and must be checked in SwiftTerm itself.
- No claim at all about bidi order, cursor in RTL text, or logical copy.

## What we can learn / reuse
- Very little RTL know-how; the useful pointer is **SwiftTerm** (MIT, Swift, macOS/iOS) as the actual subject of study: a follow-up should read SwiftTerm's `AppleTerminalView` draw path (CoreText `CTLine` runs vs per-cell glyph positioning) and its Metal renderer to see whether Arabic shaping survives, and where bidi could be inserted.
- Marketing lesson: Arabic-speaking users strongly value "letters connect" as the headline feature, even without bidi — shaping alone is perceived as the big win.
- Small engineering note: caching `NSView` terminal instances so SwiftUI view recreation does not close the PTY (`TerminalViewStore.swift`) — irrelevant to RTL, relevant if we ever ship a SwiftUI host.

## Limitations & anti-patterns
- **Marketing ahead of implementation:** the only Arabic feature is inherited from a dependency and is untested here; no fixtures, no screenshots of mixed-direction text in the code base.
- **No bidi** — Arabic/Persian lines would show joined letters in LTR (reversed-reading) order unless SwiftTerm reorders, so "proper Arabic" is at best half a solution.
- No tests, no layer-specific settings (no RTL toggle, no fallback font for Arabic, no ZWNJ input help).
- Metal renderer on by default — GPU glyph-atlas terminals commonly render per cell, which would undo Core Text shaping; unverified risk.
