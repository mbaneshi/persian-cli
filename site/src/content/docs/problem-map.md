---
title: The problem map
description: Nine layers, from encoding to apps, with a "done means" criterion for each.
---

Print this line in a terminal:

```text
نسخهٔ 2.1 از «persian-cli» را با دستورِ `make test` (لا ۱۲۳) اجرا کنید.
```

Depending on your stack you'll see letters drawn disconnected, words in reverse order, Latin text and numbers in the wrong place, brackets facing the wrong way, and a cursor that isn't where you typed. None of this happens in English.

## Root cause

The terminal is a **grid of fixed-width cells**, filled left to right, one character per cell. Arabic script breaks three of its assumptions:

| The grid assumes… | Arabic script needs… | What breaks |
|---|---|---|
| Each cell is independent | **Shaping**: a letter's form depends on its neighbours | Disconnected letterforms |
| Text runs left to right | **Bidi**: visual order depends on the whole paragraph ([UAX #9](https://www.unicode.org/reports/tr9/)) | Reversed words, misplaced numbers |
| One character = one cell | **Variable width**: لا, ZWNJ, diacritics | Cursor and app disagree |

## Nine layers

Layers 3–5 hold everything else up.

| # | Layer | Done means… |
|---|---|---|
| 1 | Encoding & normalization | ي/ك and ی/ک are treated consistently; all three digit systems are handled deliberately |
| 2 | Input | Persian layouts, ZWNJ and dead keys work in every terminal and line editor |
| 3 | **Width** | App and terminal always agree on how many cells a string occupies |
| 4 | **Shaping** | Every joining script renders connected in every terminal we test |
| 5 | **Bidi** | Mixed-direction lines display correctly, with an unambiguous owner |
| 6 | Cursor, selection, copy | Predictable cursor; copied text is in logical order |
| 7 | Fonts | Monospace fonts with Persian coverage and metrics that fit the grid |
| 8 | Multiplexers | tmux and Zellij pass shaping and bidi through intact |
| 9 | Apps & TUI frameworks | Neovim, readline, zle, Ink, ratatui, ncurses, Bubble Tea all handle the text correctly |

The full framing lives in the [README](https://github.com/mbaneshi/persian-cli#readme) and the [kickoff discussion](https://github.com/mbaneshi/persian-cli/discussions/1).
