# Contributing

Thanks for helping improve openspec-viewer.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Where to start

- **[ROADMAP.md](ROADMAP.md)** — what is committed, what is next, and what is
  still an exploratory idea. Items under `Later` need a design conversation
  before code.
- **[Issues labeled `good first issue`](https://github.com/warsclon/openspec-viewer/labels/good%20first%20issue)**
  — scoped so you can finish them independently. Each one states its acceptance
  criteria and the checks it has to pass. `help wanted` issues are real work
  too, just less self-contained.
- **Questions** go in a [GitHub issue](https://github.com/warsclon/openspec-viewer/issues/new)
  with the `question` label. Discussions is intentionally off while the project
  is small, so there is one place to look. Security reports are the exception:
  follow the [Security Policy](SECURITY.md) and do not open a public issue.
- **The demo fixture** in `demo/representative-openspec/` is fictional and
  deterministic, with active, complete, and archived changes, delta specs, and
  graph edges. Run `npm run dev -- --demo` to get a working project without
  touching your own. Demo mode copies the fixture into a temporary directory,
  so edits are discarded on exit and the committed fixture never changes.

## Development setup

```bash
git clone https://github.com/warsclon/openspec-viewer.git
cd openspec-viewer
npm ci
npm run build
npm test
```

Run against a local OpenSpec project:

```bash
npm run dev -- --path /path/to/project --no-open
```

## Guidelines

- Keep the runtime dependency-free (Node.js built-ins only). Development-only
  verification tools are allowed when their maintenance cost is justified.
- Prefer small, focused PRs.
- Follow test-driven development for production behavior changes: add a focused
  failing test at a public seam, implement the smallest fix, and run the
  relevant regression layer.
- User-facing strings and docs should be in **English**.
- Do not commit secrets, real project notes under `.openspec-viewer/`, or generated `dist/` files (CI builds from source).
- `npm run capture:media` regenerates the launch media from the demo fixture.
  It needs `ffmpeg` on `PATH` (macOS: `brew install ffmpeg`) to optimize the
  screenshots and encode the animation. `docs/media/` is ignored except for the
  three committed assets (`hero.png`, `workflow.gif`, `social-preview.png`);
  everything else in it is an intermediate. Commit a new generated asset only
  after the script optimizes and byte-scans it, adding an explicit
  `.gitignore` exception for it.

## Checks

Run this before opening any pull request:

```bash
npm run typecheck
npm run test:coverage
npm run build
npm run test:openspec
```

Then add the seam that matches what you touched. These are the same gates CI
enforces, so running them locally is the fastest way to a green pull request:

| If you changed | Also run |
|----------------|----------|
| Browser UI or an end-to-end workflow | `npx playwright install chromium` once, then `npm run test:browser` |
| The CLI, build, packaging, release, or install path | `npm run prepublishOnly` |
| Launch media | `npm run capture:media` (needs `ffmpeg`) |

See [Testing](docs/testing.md) for the fixture policy, coverage thresholds, and
how to diagnose a failure.

## OpenSpec agent instructions

This repository uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for
spec-driven development, and the generated agent instructions are committed on
purpose: `.claude/`, `.codex/`, `.opencode/`, and `.pi/` give contributors the
same `opsx` commands and skills without running `openspec init` themselves.
They are generated files — regenerate them with the OpenSpec CLI rather than
editing them by hand.

## Commit style

Conventional-style one-liners are appreciated:

```
feat: add bulk task complete
fix: correct archive date sorting
docs: clarify deep link format
test: cover task reorder edge cases
```

## Reporting issues

Use GitHub Issues with:

1. What you expected
2. What happened
3. Node version (`node -v`)
4. How you launched the CLI
5. Whether the target project uses OpenSpec `spec-driven` layout

Do not report security vulnerabilities in public issues. Follow the
[Security Policy](SECURITY.md) instead.
