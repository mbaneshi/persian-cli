# Our earlier work

Before persian-cli, we had already worked on rendering Persian in a few places. This page
lists those efforts and checks each one against the artifacts that actually exist. Each
claim was first made in a ChatGPT recap and was then checked against the
`fa` digest archive, claude-mem, the local filesystem and GitHub on 2026-10-08.

The nine layers: 1 Encoding & normalization · 2 Input · 3 Width · 4 Shaping · 5 Bidi ·
6 Cursor/selection/copy · 7 Fonts · 8 Multiplexers · 9 Apps & TUI.

> **Note on links.** The `mbaneshi/mytodo` repository is **private**. The links below
> resolve only for people who have access to it. Its code is summarized here and is not
> quoted.

---

## 1. Terminal-stack investigation (WezTerm → Zellij → Claude Code → Neovim)

- **Status:** **not found.** No artifact supports this effort.
- **Date claimed:** around 2026-08-03.
- **Where we looked:**
  - `fa` digest archive (English and Persian queries for `bidi_enabled`, `termbidi`,
    `arabicshape`, "فارسی در ترمینال"). There are no hits before 2026-10-08. The closest
    early-August digest is #1348 (2026-08-02, a Zellij tab-rename focus race), which has
    nothing to do with Persian.
  - claude-mem, searching 2026-07-25 → 2026-08-15. There are no observations about Persian
    in the terminal.
  - Claude Code transcripts. None survive from 2026-07-28 to 2026-08-08. The only
    transcripts that mention `bidi_enabled` are from 2026-10-08, the persian-cli sessions
    themselves.
  - Local configs. Neither the WezTerm config nor `~/.config/nvim` sets `bidi_enabled`,
    `bidi_direction`, `termbidi`, `arabicshape` or `rightleft`.
- **What it reportedly did:** It looked at the WezTerm → Zellij → Claude Code → Neovim
  chain. It reportedly found that WezTerm has HarfBuzz shaping but only config-gated bidi,
  that Zellij was the suspect for wrapping, cursor and redraw problems, and that Neovim's
  `rightleft`/`arabicshape`/`termbidi` are off by default. It compared JetBrains Mono Nerd
  Font, IBM Plex Mono, Noto and Vazirmatn. It proposed this isolation ladder: `echo سلام` →
  WezTerm without Zellij → Claude Code → Neovim.
- **What it proved or disproved:** Nothing we can show. The investigation most likely
  happened in a ChatGPT conversation, or in a Claude session that was never filed as a
  digest. Its "findings" match general knowledge about these tools and were never tested
  on this machine. The persian-cli root-causes digest (#2797, 2026-10-08, "فارسی در
  ترمینال — نقشهٔ ریشه‌ها") is the first archived treatment of this topic.
- **What carries over to persian-cli:** Only the hypotheses and the isolation ladder. They
  are good first experiments, but each must be re-run and recorded before we cite it.
- **Nine-layer coverage (claimed, unverified):** 4 Shaping, 5 Bidi, 6 Cursor, 7 Fonts,
  8 Multiplexers, 9 Apps & TUI.

---

## 2. mytodo Persian title cards in headless Blender

- **Status:** **verified.**
- **Date:** 2026-10-01. Issue opened and PR merged the same day, at 10:40 UTC.
- **Where:**
  - Parent issue: [mbaneshi/mytodo#111](https://github.com/mbaneshi/mytodo/issues/111),
    "Blender as a deterministic visual-synthesis capability — research, capability map,
    first vertical slice" (closed).
  - PR: [mbaneshi/mytodo#116](https://github.com/mbaneshi/mytodo/pull/116), "blender:
    headless template renderer + Persian title card (#111)" (merged).
  - Code, in the private repo:
    - `packages/blender/py/fa_text.py` is the Persian shaping module.
    - `packages/blender/client.test.ts` holds the "Persian regression matrix" and the
      "determinism and cache" suites.
    - `packages/blender/README.md` describes the dependency cache. arabic-reshaper,
      python-bidi and fontTools are installed for Blender's own Python 3.13.
  - Research and findings:
    - `docs/superpowers/specs/2026-10-01-blender-research.md` §2 "Persian / RTL text"
    - `docs/superpowers/specs/2026-10-01-blender-discoveries.md`
  - Digests:
    - #2579 (2026-10-01) "بلندر در خط تولید: اولین قالب ساخته شد" (Blender in the
      pipeline: first template built)
    - #2582 (2026-10-01) "سخت‌سازی قابلیت بلندر پیش از ادغام" (Blender pre-merge
      hardening)
- **What it did:** Blender 5.2 does no complex-script shaping in 3D text. Raw Persian
  renders unjoined and in reverse order. We confirmed upstream that the HarfBuzz PRs
  !104662 and !150170 were closed unmerged and that tracking task #100207 was archived.
  So all shaping happens **before** the text reaches Blender:
  1. `arabic-reshaper` picks each letter's joined presentation form. Its default config
     deliberately deletes harakat (vowel marks).
  2. `python-bidi` (`get_display`) reorders the shaped string into display order.
  3. The result is written into a FONT curve's body, set in Vazirmatn.

  The pipeline also normalizes the text first:
  - «هٔ» (heh + combining hamza) becomes the precomposed «ۀ», so the hamza survives when
    harakat are stripped.
  - ۀ's isolated presentation form, U+FBA4, is mapped back to U+06C0, because Vazirmatn has
    no glyph for U+FBA4.
  - ASCII digits become Persian digits only in words that contain no Latin letters.
    "v2", "HTTP/2" and URLs keep their digits.

  Text is wrapped **in logical order** and bidi is applied **per line** afterwards.
- **What it proved:** The regression matrix runs against real headless renders. It shows:
  - joined shaping
  - embedded English keeps its direction
  - Persian digits, with Latin tokens left alone
  - ZWNJ survives
  - kasre-ezafe works
  - explicit line breaks are kept, in order
  - Persian question mark with embedded Latin
  - long titles wrap into balanced lines
  - characters the font can't draw fail the job instead of rendering as tofu boxes

  Renders are pixel-deterministic. Posters are byte-identical, and video frames match by
  framemd5. A repeat request is served from cache without launching Blender. Every failure
  comes back as a structured error that names the stage.

  The pre-merge review also caught a real bug. The local LLM router sent a line break as
  the two literal characters `\n`, and "n\\" was printed on the card. The fix turns them
  into a real line break automatically.
- **What it disproved:**
  - Letting the renderer wrap an already-bidi'd paragraph does not work: the last words end
    up on the first line. Wrapping must happen before bidi.
  - A variable font does not give weights in Blender. A FONT object always renders the
    default `wght` instance. The fix is static instances built with
    `fontTools.varLib.instancer`, with overlap removal.
- **Known limits (documented as tests):**
  - Harakat (diacritics) are **dropped, not mispositioned**.
  - There is no OpenType contextual forms or GPOS kerning.
  - Font weight is available only through static instances.
  - Animation works per line, not per letter.
  - Vazirmatn maps only 213 of the 832 Arabic presentation-form codepoints.
- **What carries over to persian-cli:**
  - **Wrap in logical order, then apply bidi per line.** This is the same problem a
    terminal faces at line wrap.
  - Presentation-form reshaping is fragile: it depends on the font covering those
    codepoints, and it loses marks. That is evidence for doing real shaping in the
    renderer, not in the app.
  - The ZWNJ, kasre-ezafe and Persian-digit cases make good test strings.
  - The regression-matrix + determinism style is a good model for a persian-cli test corpus.
- **Nine-layer coverage:** 1 Encoding & normalization (strong) · 4 Shaping (pre-shaped,
  partial) · 5 Bidi (strong, per line) · 7 Fonts (strong) · not 2, 3, 6, 8 or 9, because
  this is an offline renderer, not a terminal.

---

## 3. HarfBuzz → curves prototype (mytodo #119)

- **Status:** **partly verified.** The issue and the research write-up exist. There is **no
  #119 branch or PR**. The prototype was scratch code that was never committed.
- **Date:** prototype 2026-10-01; issue opened 2026-10-01 at 10:28 UTC and re-scoped the
  same day.
- **Where:**
  - Issue: [mbaneshi/mytodo#119](https://github.com/mbaneshi/mytodo/issues/119), "Blender
    text engine: HarfBuzz prototype → compare → decide (not a production change yet)"
    (open, parent #111).
  - `docs/superpowers/specs/2026-10-01-blender-research.md` §2, under "Robust future path
    (prototype VERIFIED-HERE)"
  - `docs/superpowers/specs/2026-10-01-blender-discoveries.md`, under EXPERIMENTAL and
    FUTURE #2
  - Digests #2579 (section 3, "limits") and #2582 (section 5, "next work")
  - `gh pr list --search harfbuzz --state all` returns only #116. No branch name contains
    `harf` or `119`.
- **What it did:** It shaped text with `uharfbuzz`, which applies the font's real GSUB/GPOS
  rules, with weight set via `set_variations`. It then drew each glyph through a fontTools
  pen into Bézier splines in Blender 5.2. The renders showed:
  - correct joining
  - lam-alef ligatures
  - `.long` contextual forms
  - GPOS-placed diacritics
  - real `wght` variation
- **What it proved or disproved:**
  - Proved: a real shaping engine lifts every limit of the reshaper approach. That covers
    harakat, kerning, contextual forms, weights, and per-glyph animation keyed by `cluster`.
  - Disproved the idea that HarfBuzz is enough by itself. **HarfBuzz does no bidi**: "API"
    rendered as "IPA" until bidi runs were split out *before* shaping.
  - Variable-font outlines overlap and leave seams. Fixing that needs instancing with
    overlap removal, plus correct fill of the holes inside letters.
  - It was deliberately re-scoped as **prototype → compare → decide, not a replacement**.
    The plan is to run both engines through the same regression matrix, compare them on
    correctness, render time and complexity, and adopt the new one only where it is
    needed. Hook titles rarely carry diacritics.
- **What carries over to persian-cli:** The ordering rule **itemise bidi runs → shape each
  run → place glyphs** applies directly to terminal renderers like WezTerm and kitty. The
  "API → IPA" failure is a ready-made test case for any terminal that shapes without
  itemising first. The "keep the simple path, prototype the real engine, compare on one
  matrix" discipline fits persian-cli's lab framing.
- **Nine-layer coverage:** 4 Shaping (strong, real OpenType) · 5 Bidi (as a hard
  prerequisite, found by failure) · 7 Fonts (variable axes, overlaps) · not 1-3, 6, 8 or 9.

---

## Not verified from the ChatGPT recap

- **The whole August 2026 terminal-stack investigation (effort 1).** We found no digest,
  memory, transcript, config change or note. Every specific claim in it is unverified:
  - WezTerm `bidi_enabled`/`bidi_direction`
  - Zellij as the cause of wrapping, cursor and redraw problems
  - Neovim `rightleft`/`arabicshape`/`termbidi` defaults
  - the four-font shortlist
  - the `echo سلام` isolation ladder
- **"HarfBuzz prototype (mytodo issue/branch #119)"** is half-verified: the *issue* exists,
  but there is no *branch*.
- The "byte-identical renders" claim needs one qualification. Poster PNGs are
  byte-identical. Video outputs are checked frame by frame (framemd5); their container
  bytes are only logged, not asserted.
