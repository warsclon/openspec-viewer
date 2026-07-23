# Contributing

Thanks for helping improve openspec-viewer.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/warsclon/openspec-viewer.git
cd openspec-viewer
npm install
npm run build
npm test
```

Run against a local OpenSpec project:

```bash
npm run dev -- --path /path/to/project --no-open
```

## Guidelines

- Keep the runtime dependency-free (Node.js built-ins only). Dev tools (TypeScript, Vitest, tsx) are fine.
- Prefer small, focused PRs.
- Add or update unit tests for parser/logic changes under `test/`.
- Run before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

- User-facing strings and docs should be in **English**.
- Do not commit secrets, real project notes under `.openspec-viewer/`, or generated `dist/` files (CI builds from source).

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
