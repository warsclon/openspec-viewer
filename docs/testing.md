# Testing

`openspec-viewer` verifies behavior at public boundaries. Tests use fictional
OpenSpec data and must never read or mutate a developer's active project.

## Test layers

| Layer | Boundary | Command |
| --- | --- | --- |
| Unit | CLI parsing and in-memory OpenSpec transformations | `npm run test:unit` |
| Integration | Filesystem, subprocess, and real HTTP behavior in isolated temporary projects | `npm run test:integration` |
| Coverage | All current Vitest tests with V8 source coverage | `npm run test:coverage` |
| Browser | Real static UI in deterministic Chromium | `npm run test:browser` |
| Package | Packed, clean-installed `openspec-viewer` executable | `npm run test:package` |

Run the complete Vitest suite with `npm test` and use `npm run test:watch`
during focused development. Before every implementation commit, also run:

```bash
npm run typecheck
npm test
npm run build
```

Run `npm run prepublishOnly` as the complete package validation gate. It runs
typecheck, the default test projects, and `test:package`. The package test
rebuilds the package, creates a tarball, installs it offline in a clean
temporary directory, and invokes only the installed executable.

Run `npm run test:browser` after browser UI or end-to-end workflow changes.
Playwright uses deterministic Chromium settings, creates one isolated fictional
project per test, blocks external requests, and retains traces and screenshots
only when a test fails.

## Fixture policy

The committed fixture under `test/fixtures/representative-openspec/` contains
only deterministic fictional content. A mutating test must call the helpers in
`test/helpers/` to copy that fixture into a unique temporary directory. The
test owns the copy and must close servers, watchers, and event streams before
removing it.

Never add real repositories, usernames, machine paths, credentials, private
notes, or nondeterministic timestamps to fixtures. Validate fixture changes
from its project root:

```bash
openspec validate --all --strict
```

## TDD workflow

Production behavior changes follow red then green:

1. Add one focused test at an agreed public seam.
2. Run it and confirm it fails because the behavior is missing or incorrect.
3. Implement the smallest production change that makes it pass.
4. Run the focused test and relevant regression layer.
5. Check off the OpenSpec task only after verification succeeds.

A broken test, unsupported matcher, or compilation error is not valid red
evidence.

## Coverage

`npm run test:coverage` measures TypeScript under `src/` using V8 and writes
text, JSON, and HTML reports to the ignored `coverage/` directory. Vitest and
`@vitest/coverage-v8` must always use the same major version.

The completed `establish-test-foundation` change will enforce at least
80 percent statements, lines, and functions and 70 percent branches. Aggregate
coverage never replaces explicit scenarios for artifact writes, task
mutations, notes, archives, validation errors, and failed-write integrity.

The 2026-07-25 pre-expansion baseline used the original four test files and
eleven tests:

| Statements | Branches | Functions | Lines |
| ---: | ---: | ---: | ---: |
| 41.47% | 32.87% | 41.22% | 43.14% |

The first fixture and real-server lifecycle slice raised the measured totals to
48.47 percent statements, 36.02 percent branches, 50.38 percent functions, and
50.57 percent lines. These figures document the starting point; they are not
temporary thresholds.

Vitest 4.1.10 is evaluated together with `@vitest/coverage-v8` 4.1.10. The
transitive Vite 8.1.5 development tool requires Node.js 20.19 or newer, or
Node.js 22.12 or newer. This does not add a published runtime dependency. The
upgrade was accepted after pull request #8 passed the Node.js 20 and 22 GitHub
checks on 2026-07-25.

## Failure diagnosis

- Re-run the smallest responsible test file with
  `vitest run path/to/file.test.ts`.
- Confirm the test uses a copied fixture and an operating-system-assigned
  loopback port.
- Check that teardown awaits server and event-stream closure.
- Re-run the complete relevant layer after the focused test passes.
- Treat a failure that occurs only in CI as a reproducibility problem; do not
  add sleeps, retries, or lower thresholds without an approved exception.

The contributor who changes a public seam owns its tests, fixture updates,
diagnostics, and OpenSpec task status in the same pull request.
