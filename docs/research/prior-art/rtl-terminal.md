# rtl-terminal
- **Repo:** https://github.com/Tal9392/rtl-terminal · **Commit read:** 7774f26 (v0.2.0, 2026-05-25) · **License:** MIT · **Language:** Markdown only (no code) · **Platform:** Claude Code (any host terminal; targets macOS Terminal.app)
- **Category:** plugin (prompt-only output transform, performed by the LLM)

## What it is
A Claude Code plugin made entirely of Markdown instruction files. It tells the model to embed Unicode bidi control characters in any reply that contains Hebrew/Arabic-script text, so a terminal that runs UAX #9 on each line gets explicit hints about paragraph direction and LTR islands (paths, code, English).

## How it works (verified in code)
- **There is no runtime.** No hook, no output style, no script, no binary. The repo contains `.claude-plugin/plugin.json`, a marketplace manifest, four slash commands, one skill and one CLAUDE.md template. `grep` for hooks/`TERM_PROGRAM`/output-style finds nothing.
- **Mechanism 1, a skill:** `skills/rtl-formatting/SKILL.md:1-5` is a non-user-invocable skill whose description asks the model to apply it "automatically whenever you generate any text containing RTL script". Whether it fires depends on the model choosing to load it.
- **Mechanism 2, a CLAUDE.md injection:** `/rtl-terminal:enable` (`commands/enable.md:18-40`) has the *model* append `assets/CLAUDE-block.md` to the user's global `~/.claude/CLAUDE.md` between `<!-- rtl-terminal:start -->`/`end` markers. `disable.md:30-40` removes it. `status.md:25-35` greps for the markers. So the "always-on" mode is a persistent system-prompt rule.
- **Control characters prescribed** (`assets/CLAUDE-block.md:8-16`, `SKILL.md:11-18`):
  - RLE `U+202B` … PDF `U+202C` around every RTL paragraph, list item and heading.
  - LRI `U+2066` … PDI `U+2069` around paths, code, URLs and English words inside RTL text. RLM `U+200F` is explicitly rejected as "not strong enough" (`CLAUDE-block.md:9`).
  - LRM `U+200E` at the start of every Markdown table row, plus an LTR first column as an "anchor" (`CLAUDE-block.md:14-16`, `SKILL.md:62-65`). Tables with RTL-only cells are discouraged in favour of numbered lists.
  - Fenced code and pure-English output are left alone (rules 3 and 6).
- **RTL detection** is by code-point range, which the model applies mentally: Hebrew `0590–05FF`, `FB1D–FB4F`; Arabic `0600–06FF`, `0750–077F`, `08A0–08FF`, `FB50–FDFF`, `FE70–FEFF` (`CLAUDE-block.md:28`). The presentation-form blocks are listed only as *detection* ranges and are never emitted.
- **No terminal-surface detection.** There is no `bidi / nobidi / unknown` classification and no inspection of `TERM_PROGRAM`, `TERM` or the host. The marks are emitted unconditionally whenever RTL is present. The only "detection" is `/rtl-terminal:test` (`commands/test.md:10-96`), which prints the same content with and without marks and asks the human to judge by eye.
- **No nobidi mode exists**, so it never emits presentation forms or reversed text. The text stays in logical order and only invisible format controls are added.

## Layer coverage
| Layer | Status | Evidence |
|---|---|---|
| 1 Encoding & normalization | ❌ | Not addressed. It *adds* format characters (Cf) to the stream, which works against normalized, searchable text. |
| 2 Input (layouts, ZWNJ, IME) | ❌ | Out of scope. `SKILL.md:94` says input-field cursor is "the terminal's job". |
| 3 Width | ❌ | Not addressed. Its correctness relies on the host renderer (Ink/`string-width`) and the terminal treating the controls as zero-width. Nothing checks that. |
| 4 Shaping | ❌ | Not addressed. Assumes the terminal shapes Arabic. |
| 5 Bidi | ◐ | Supplies explicit UAX #9 hints (embeddings + isolates + LRM). The terminal still has to implement UAX #9 including X1–X10. Nothing verifies that the model actually emits balanced pairs. |
| 6 Cursor/selection/copy | ❌ | The controls survive copy. The README (`README.md:90-91`) calls this "correct" and suggests stripping them with `tr`. |
| 7 Fonts | ❌ | — |
| 8 Multiplexers | ❌ | Not considered. tmux and Zellij re-render lines, and their handling of these Cf characters is untested. |
| 9 Apps & TUI frameworks | ◐ | Claude Code only, and only through prompting. Markdown-table guidance (`SKILL.md:48-77`) is the one piece that is specific to an app. |

## Claimed but not verified
- "Every modern terminal supports them" (`README.md:16`), and it works in "Terminal.app, iTerm2, WezTerm, VS Code terminal, Hyper" (`README.md:64`). There are no tests or screenshots in the repo. Terminals that implement no bidi (several do none, or only partial support) ignore the controls or draw them as glyphs or tofu.
- "Verified failure mode: 2026-05-25" for tables (`CLAUDE-block.md:14`). This is anecdotal, with no fixture.
- "~30–60 extra tokens per response" (`README.md:67`). Not measured.
- "BiDi-unaware terminals like raw tty… are vanishingly rare" (`SKILL.md:96`). This is contradicted by the plugin's own troubleshooting advice to switch terminals (`README.md:81-82`).

## Relevance to Ink (Claude Code's renderer)
The plugin never touches Ink. The controls pass through Claude Code's Markdown renderer and Ink layout as ordinary text. Risks we can infer (not tested here):
1. Ink wraps lines by measured width. A wrapped paragraph puts RLE on one terminal row and PDF on another. Terminals run bidi per row, so the second row loses its embedding.
2. Ink's width math must count `U+202A–202E` and `U+2066–2069` as zero-width. If it doesn't, padding and borders drift.
3. Markdown table alignment is computed by Claude Code. LRM/RLE inside cells make every cell a separate bidi context.
The conclusion is that bidi ownership belongs in the renderer (Ink or the terminal), not in the model's token stream.

## What we can learn / reuse
- MIT, so reusable, though there is little code to reuse. The **test-pattern idea** (`commands/test.md`) is worth adopting: the same corpus with and without controls, including a mixed path, numbers with punctuation, and an RTL table. That belongs in our conformance fixtures.
- Its **isolates-over-marks** guidance for LTR islands (LRI/PDI rather than RLM) matches UAX #9 best practice. Paths and URLs are the dominant failure case.
- It documents real user pain: Markdown tables whose header row resolves to RTL base direction flip their columns. That is a useful case for the Layer 9 corpus.

## Limitations & anti-patterns
- **Content mutation as a display fix.** It writes invisible format characters into the *logical text*, so they reach clipboard, logs, transcripts, `grep` and `git`. Our principles reject display filters that rewrite text. This is a milder form (no reordering) but the same category.
- **Non-deterministic enforcement.** Correctness depends on an LLM remembering to balance RLE/PDF and LRI/PDI. An unbalanced pair corrupts the rest of the line in a conforming terminal.
- **Uses deprecated-in-practice embeddings.** RLE/PDF instead of RLI/PDI or FSI/PDI for paragraphs. UAX #9 recommends isolates, and embeddings leak into surrounding neutrals.
- **No surface detection.** The same bytes are sent to bidi-capable terminals (where they are redundant or harmful), to non-bidi terminals (where they don't help) and to non-terminal hosts (VS Code, web).
- **Mutates the user's global `~/.claude/CLAUDE.md`** through model-driven edits, which is fragile (`status.md:35` already anticipates duplicate blocks).
- Does nothing for Persian-specific concerns (ZWNJ, Persian digits, Arabic vs Persian yeh/kaf).
