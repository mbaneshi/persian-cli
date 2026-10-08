# persian-cli

[![Website](https://img.shields.io/badge/site-mbaneshi.github.io%2Fpersian--cli-E5B53B)](https://mbaneshi.github.io/persian-cli/)
[![RFC 0001](https://img.shields.io/badge/RFC%200001-open%20for%20comment-8A6FB5)](https://github.com/mbaneshi/persian-cli/discussions/12)
[![Roadmap](https://img.shields.io/badge/roadmap-project%20board-4A86C5)](https://github.com/users/mbaneshi/projects/22)
[![good first issues](https://img.shields.io/github/issues/mbaneshi/persian-cli/good%20first%20issue?label=good%20first%20issues&color=4FAE9A)](https://github.com/mbaneshi/persian-cli/labels/good%20first%20issue)
[![License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-1A1A1A)](LICENSE)
[![Docs: CC BY 4.0](https://img.shields.io/badge/docs-CC%20BY%204.0-1A1A1A)](LICENSE-docs)

**A research lab for making Persian a first-class language in the terminal.**

> ### North star
>
> A Persian speaker can do everything in a terminal that an English speaker can —
> **read, write, edit, search, select, copy, and paste** — with no workarounds,
> in any terminal, multiplexer, editor, or command-line app, on any operating system.

This is not one person's setup problem. Every language written in Arabic script
(Persian, Arabic, Urdu, Pashto, Sorani Kurdish, Uyghur, and others) breaks in the
terminal the same way, for the same reasons. We treat it as **one problem**, trace it
to its root causes, and solve it from the ground up: with standards, measurements,
and upstream fixes, not per-app hacks.

Persian is the first target. The fixes are designed to work for every
right-to-left and joining script.

---

## The problem

Open a terminal and print this line:

```
نسخهٔ 2.1 از «persian-cli» را با دستورِ `make test` (لا ۱۲۳) اجرا کنید.
```

Depending on your stack you'll see some mix of these problems: letters drawn
**disconnected** from each other, words in **reverse order**, the Latin text and
numbers **in the wrong place**, brackets **facing the wrong way**, the cursor landing
**somewhere other than where you typed**, and text that comes out **in a different order
when you copy it**. Every one of these is a known problem, and none of them happen in English.

## The root cause

The terminal was designed as a **grid of fixed-width cells**, filled left to right,
one character per cell, with the application deciding where each character goes.
That model is perfect for Latin script. Arabic-script text breaks three of its
assumptions:

| The grid assumes… | Arabic script needs… | What breaks |
|---|---|---|
| Each cell is independent | **Shaping**: a letter's form depends on its neighbours (ب vs بـ) | Disconnected, isolated letterforms |
| Text runs left to right | **Bidi**: visual order depends on the whole paragraph ([UAX #9](https://www.unicode.org/reports/tr9/)) | Reversed words, misplaced numbers, unmirrored brackets |
| One character = one cell | **Variable width**: لا is two characters but one glyph; ZWNJ (U+200C) and diacritics have no width | The application and the terminal disagree about where the cursor is |

Under all three is an **ownership problem**: nobody has settled whether the
*terminal* or the *application* is responsible for bidi. If both do it, text is
reversed twice and comes out wrong. If neither does, it stays backwards. A draft
standard addresses exactly this question,
[*BiDi in Terminal Emulators*](https://terminal-wg.pages.freedesktop.org/bidi/)
(Egmont Koblinger, 2019), but it has not been widely adopted.

## The problem map

We split the problem into nine layers. Layers 3–5 hold everything else up: until
they are right, fixing anything above them just moves the bug somewhere else.

| # | Layer | Done means… |
|---|---|---|
| 1 | **Encoding & normalization** | Search, sort, and grep treat Arabic ي/ك and Persian ی/ک consistently; all three digit systems are handled deliberately |
| 2 | **Input** | Persian keyboard layouts, ZWNJ, and dead keys work in every terminal and line editor |
| 3 | **Width** | The application and the terminal always agree on how many cells a string occupies |
| 4 | **Shaping** | Every joining script renders connected, in every terminal we test |
| 5 | **Bidi** | Mixed-direction lines display correctly, and it is unambiguous whether the terminal or the app is responsible |
| 6 | **Cursor, selection, copy** | The cursor moves predictably, and copied text is in logical order (the order it was typed in) |
| 7 | **Fonts** | Good monospace fonts with Persian coverage and metrics that fit the grid exist and are documented |
| 8 | **Multiplexers** | tmux and Zellij pass shaping and bidi through without breaking them |
| 9 | **Apps & TUI frameworks** | Editors (Neovim, Vim, Emacs), line editors (readline, zle), and TUI frameworks (Ink, ratatui, ncurses, Bubble Tea) handle the text correctly |

## Prior work

Ten earlier projects attack parts of this problem: terminal emulators, PTY proxies, overlays and plugins. We read each one's code and mapped it onto the nine layers. See [`docs/research/prior-art.md`](docs/research/prior-art.md) or the [Prior work page](https://mbaneshi.github.io/persian-cli/prior-work/). In short: no project solves width (layer 3) or multiplexers (layer 8), none negotiates bidi ownership, and every tool that rewrote the text broke copy and search.

## Principles

1. **Store and transmit text in logical order; reorder only at display time.**
   Never "fix" display by reversing strings or substituting presentation-form
   characters. Those hacks break search, copy, accessibility, and every tool
   further down the pipeline.
2. **Every concern has one owner.** Each layer gets one explicit owner (terminal,
   multiplexer, or app) and a clear way to hand it off. Two layers doing the same
   job is how text ends up reversed twice.
3. **Standards over hacks.** We build on Unicode (UAX #9 bidi, UAX #11 width,
   UAX #29 grapheme clusters), ECMA-48, and the terminal BiDi draft. Where those
   standards are silent or wrong, we write that down and propose a change.
4. **Measure before fixing.** Every claim is backed by a reproducible test case.
   A fix is something that changes a score.
5. **Upstream first.** We contribute fixes to the projects people already use.
   We build our own tooling only where upstream can't or won't move.
6. **Script-general by design.** Persian drives the work, but nothing we propose
   should work only for Persian.
7. **Never make it worse.** Applications that don't know about bidi must not
   look worse in a terminal that does.

## Roadmap

| Phase | Output | Why this order |
|---|---|---|
| **0. Root-cause map** | Research from primary sources: the Unicode and ECMA standards, the BiDi draft, and how terminals (VTE, Konsole, mlterm, WezTerm, kitty, Ghostty, iTerm2, Windows Terminal, Alacritty), multiplexers, editors, and frameworks actually behave today | Without knowing who owns what, any fix is guesswork |
| **1. Test corpus & scorecard** | A set of hard test cases (mixed direction, ZWNJ, لا, digits, brackets, diacritics, long wrapped lines, cursor movement) plus a harness that scores any terminal + multiplexer + app stack | This is what every fix gets measured against |
| **2. Fonts & terminals** | Recommended fonts, terminal configurations, and upstream fixes for rendering | The foundation everything else sits on |
| **3. Multiplexers** | Shaping and bidi passed through tmux and Zellij intact | The most common place for text to break |
| **4. Editors & TUI frameworks** | Fixes or plugins for Neovim, readline, Ink, ratatui, and similar | Where people actually read and write |
| **5. The ownership standard** | Working with terminal and app maintainers to finish and adopt a bidi negotiation standard | The permanent fix for layers 5 and 6 |

The results from each phase are published here as we go: research notes, scorecards,
and links to upstream issues and pull requests.

Each phase is a [milestone](https://github.com/mbaneshi/persian-cli/milestones), and every item is on the [roadmap board](https://github.com/users/mbaneshi/projects/22). The program itself is up for comment in [RFC 0001](https://github.com/mbaneshi/persian-cli/discussions/12).

## Non-goals

- **A new terminal emulator.** Not unless the research shows there's no other way.
- **Visual-order hacks**: pre-reversed strings, `fribidi`-style display filters
  that rewrite the text itself, presentation-form substitution. These are what we
  are replacing.
- **Transliteration or Finglish tools.** The goal is real Persian text, not a way
  around it.

## Status

**Phase 0 (root-cause map) is underway.** Done so far: the [prior-work survey](https://mbaneshi.github.io/persian-cli/prior-work/) of ten existing projects, read in code. Open now: [width](https://github.com/mbaneshi/persian-cli/issues/13), [bidi ownership](https://github.com/mbaneshi/persian-cli/issues/14), [multiplexers](https://github.com/mbaneshi/persian-cli/issues/15), and the [v0 test corpus](https://github.com/mbaneshi/persian-cli/issues/17).

## Contributing

This is an open lab, and most of the useful contributions right now aren't code:

- **Reproducible breakages.** Your terminal, multiplexer, app and font versions, the exact input, and expected vs. actual. [Open a breakage report](https://github.com/mbaneshi/persian-cli/issues/new?template=breakage.yml).
- **Test strings.** If you write Persian, Arabic, Urdu, Pashto, Kurdish, Hebrew or another RTL or joining script, your cases make the fixes general ([#17](https://github.com/mbaneshi/persian-cli/issues/17)).
- **Research.** Pick a [research question](https://github.com/mbaneshi/persian-cli/labels/type%2Fresearch) and answer it from primary sources.
- **Pointers to prior work.** Specs, patches, mailing-list threads, abandoned attempts.
- **Direction.** Weigh in on [RFC 0001](https://github.com/mbaneshi/persian-cli/discussions/12).

Read [CONTRIBUTING.md](CONTRIBUTING.md) for how work is organised, and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Maintainer

persian-cli is a project by [Mehdi Baneshi](https://mbaneshi.ir) ([@mbaneshi](https://github.com/mbaneshi)).

## License

Code is licensed under [Apache-2.0](LICENSE). Documentation, research notes, translations and the test corpus are licensed under [CC BY 4.0](LICENSE-docs).
