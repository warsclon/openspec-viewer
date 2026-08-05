# Contributing

Thanks for helping improve openspec-viewer.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

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
- Run before opening a PR:

```bash
npm run typecheck
npm run test:coverage
npm run build
npm run test:openspec
```

- Install the test browser once with `npx playwright install chromium`, then run
  `npm run test:browser` for browser UI or end-to-end workflow changes.
- Run `npm run prepublishOnly` for CLI, build, packaging, release, or public
  installation changes.
- See [Testing](docs/testing.md) for fixture policy, commands, coverage
  thresholds, and failure diagnosis.
- User-facing strings and docs should be in **English**.
- Do not commit secrets, real project notes under `.openspec-viewer/`, or generated `dist/` files (CI builds from source).
- `npm run capture:media` regenerates the launch media from the demo fixture.
  It needs `ffmpeg` on `PATH` (macOS: `brew install ffmpeg`) to optimize the
  screenshots and encode the animation. `docs/media/` is ignored except for the
  three committed assets (`hero.png`, `workflow.gif`, `social-preview.png`);
  everything else in it is an intermediate. Commit a new generated asset only
  after the script optimizes and byte-scans it, adding an explicit
  `.gitignore` exception for it.

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
