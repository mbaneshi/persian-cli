---
title: Prior work
sidebar:
  label: Overview
  order: 0
description: Ten earlier attempts at Persian/RTL in the terminal, each read in code and mapped onto our nine layers.
---

Several projects already tackle parts of this problem. We read the **code** of each one, not just its README, and mapped it onto our [nine layers](/persian-cli/problem-map/). The full catalog, with file-level evidence, is in [`docs/research/prior-art.md`](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art.md).

## The catalog

| Project | Kind | Shaping | Bidi | Verdict |
|---|---|---|---|---|
| [RtlTerminal](/persian-cli/prior-work/rtlterminal/) | Windows terminal | WPF, per word | heuristic | Most serious: logical buffer and logical copy, but no UAX #9 and glyphs squashed into cells |
| [termenal-web](/persian-cli/prior-work/termenal-web/) | browser terminal | HarfBuzz | UAX #9 levels | Best reference design: per-row logical↔visual map |
| [termux-app-arabic](/persian-cli/prior-work/termux-app-arabic/) | Android terminal | HarfBuzz | UAX #9 per row | Renderer-only proof of concept |
| [Tarminal](/persian-cli/prior-work/tarminal/) | macOS terminal | (none in repo) | none | A wrapper over SwiftTerm |
| [Terminal-ar](/persian-cli/prior-work/terminal-ar/) | Electron overlay | Chromium | heuristic | Not reusable (no license) |
| [ar-terminal](/persian-cli/prior-work/ar-terminal/) | VS Code overlay | Chromium / presentation forms | per row | Not reusable (no license) |
| [estaterm](/persian-cli/prior-work/estaterm/) | PTY proxy | presentation forms | FriBidi | Visual-order hack |
| [bidiscope](/persian-cli/prior-work/bidiscope/) | xterm.js library | presentation forms | partial UAX #9 | Right idea, wrong execution |
| [fa-console](/persian-cli/prior-work/fa-console/) | Python stdout wrapper | presentation forms | python-bidi | Good Layer 1 normalization |
| [rtl-terminal](/persian-cli/prior-work/rtl-terminal/) | Claude Code plugin | — | prompt-injected controls | Content mutation; useful test corpus |

## What the field tells us

1. **Rewriting the text always costs.** Every tool that wrote presentation forms or visual order into the terminal broke copy, search or escape sequences, and gave up on full-screen apps. The renderers that kept a logical buffer got copy right.
2. **Width is unsolved.** No project fits shaped Persian text to the cell grid. Glyphs are squashed, clipped, or allowed to overflow.
3. **Multiplexers are untouched.** None of the ten considers tmux or Zellij.
4. **Nobody negotiates who owns bidi.** All of them apply it unconditionally or by guesswork, including inside full-screen apps.
5. **Input is ignored.** No project handles IME composition or ZWNJ entry.
6. **READMEs overstate.** That is why our scorecard will measure, not trust claims.
