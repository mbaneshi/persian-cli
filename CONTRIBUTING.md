# Contributing to persian-cli

Thanks for helping make Persian, and every right-to-left and joining script, first-class in the terminal. This is a **research lab**, so many of the most valuable contributions aren't code.

> **Start here:** read [RFC 0001](https://github.com/mbaneshi/persian-cli/discussions/12) (the research program and roadmap) and the [problem map](https://mbaneshi.github.io/persian-cli/problem-map/).

## Ways to contribute

| You have… | Do this | Label |
|---|---|---|
| A terminal and 15 minutes | Report how Persian renders in your stack ([breakage report](https://github.com/mbaneshi/persian-cli/issues/new?template=breakage.yml)) | `type/breakage` |
| Fluency in an RTL script | Add hard strings to the [test corpus](https://github.com/mbaneshi/persian-cli/issues/17), or translate the site | `type/test-corpus`, `type/i18n` |
| Curiosity and patience | Pick a [research question](https://github.com/mbaneshi/persian-cli/labels/type%2Fresearch) and write it up from primary sources | `type/research` |
| A pointer to prior work | Suggest a project, spec, patch or mailing-list thread ([prior-art suggestion](https://github.com/mbaneshi/persian-cli/issues/new?template=prior-art.yml)) | `type/research` |
| Upstream experience | Help carry a fix to a terminal, multiplexer or editor | `type/upstream` |
| An opinion on direction | Comment on an [RFC](https://github.com/mbaneshi/persian-cli/discussions/categories/ideas) | `rfc` |

New here? Filter by [`good first issue`](https://github.com/mbaneshi/persian-cli/labels/good%20first%20issue) or [`help wanted`](https://github.com/mbaneshi/persian-cli/labels/help%20wanted).

## How work is organised

- **Phases → milestones.** The roadmap runs from Phase 0 (root-cause map) to Phase 5 (bidi ownership standard). See [milestones](https://github.com/mbaneshi/persian-cli/milestones) and the [roadmap board](https://github.com/users/mbaneshi/projects/22).
- **Layers → `layer/*` labels.** Every issue is tagged with the layers of the [nine-layer problem map](https://mbaneshi.github.io/persian-cli/problem-map/) it touches.
- **RFCs → Discussions.** Changes in direction start as a Discussion titled `RFC NNNN: …`. Accepted RFCs are summarised under `docs/` and linked from the issues that implement them.

## Ground rules for research

These come from the project's [principles](README.md#principles), and reviews hold every contribution to them.

1. **Logical order is sacred.** Never "fix" display by reversing strings or substituting presentation forms (U+FB50–FDFF, U+FE70–FEFF).
2. **Cite primary sources.** Specs, source code (with file and line), upstream issues. Link the exact commit you read.
3. **Separate verified from claimed.** "The README says X" and "the code does X" are different statements. Say which one you are making.
4. **Measure.** A claim about behaviour comes with a reproducible case: the exact input, the versions, expected vs. actual.
5. **Script-general.** If a proposal only works for Persian, say why, or generalise it.

## Pull requests

1. Open (or find) an issue first. For anything non-trivial, agree on the approach there.
2. Branch from **`dev`** (the default branch); `main` only moves on releases.
3. Keep PRs focused. Link the issue (`Closes #N`) and fill in the PR template.
4. **Site changes:** `cd site && pnpm install && pnpm dev`. The prior-art pages are generated from `docs/research/prior-art/`, so edit the notes there, not the generated files.
5. Translations: write for a native reader, not word for word. Keep code, paths and identifiers untouched.

## Licensing

By contributing, you agree that your contributions are licensed under:

- **Apache-2.0** ([`LICENSE`](LICENSE)) for code, and
- **CC BY 4.0** ([`LICENSE-docs`](LICENSE-docs)) for documentation, research notes, translations and the test corpus.

## Conduct

Everyone participating is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
