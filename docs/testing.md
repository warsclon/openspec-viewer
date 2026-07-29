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
| OpenSpec | Active changes and the representative fixture | `npm run test:openspec` |
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

Install the test browser once with `npx playwright install chromium`, then run
`npm run test:browser` after browser UI or end-to-end workflow changes.
Playwright uses deterministic Chromium settings, creates one isolated
fictional project per test, blocks external requests, and retains traces and
screenshots only when a test fails.

## Fixture policy

The shared public fixture under `demo/representative-openspec/` contains only
deterministic fictional content. Local demo mode, the hosted read-only build,
browser tests, and package tests all consume that same source. A mutating test
must call the helpers in `test/helpers/` to copy the fixture into a unique
temporary directory. The test owns the copy and must close servers, watchers,
and event streams before removing it.

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

The suite enforces at least 80 percent statements, lines, and functions and
70 percent branches. Aggregate coverage never replaces explicit scenarios for
artifact writes, task mutations, notes, archives, validation errors, and
failed-write integrity.

## Critical scenario review

| Required behavior | Primary evidence |
| --- | --- |
| Artifact writes and unchanged targets after rejection | `test/integration/artifact-mutations.test.ts`, `test/integration/http-mutations.test.ts` |
| Structured and raw task mutations | `test/tasks.test.ts`, `test/integration/http-mutations.test.ts`, `test/browser/workspace.spec.ts` |
| Local note isolation and persistence | `test/integration/notes.test.ts`, `test/browser/workspace.spec.ts` |
| Archive success, rejection, and failure integrity | `test/integration/change-lifecycle.test.ts`, `test/integration/http-lifecycle.test.ts`, `test/browser/workspace.spec.ts` |
| Stable validation errors | `test/integration/http-errors.test.ts`, `test/integration/artifact-mutations.test.ts` |
| Failed-write and publication integrity | `test/integration/change-lifecycle.test.ts`, `test/integration/artifact-mutations.test.ts` |

Review this table whenever one of these public seams changes. A passing global
percentage does not permit deleting the corresponding scenario evidence.

## Continuous integration

Pull requests run the five inherited checks plus four compatibility checks in
parallel:

- `quality (Node 20)` and `quality (Node 22)`.
- `browser (Chromium)`.
- `package smoke (Node 20)` and `package smoke (Node 22)`.
- OpenSpec 1.6.0 and 1.7.0 strict validation for both the repository and the
  shared demo fixture.

The required pull-request path targets completion within 10 minutes. Browser
traces and screenshots are uploaded only when that job fails, use only the
fictional fixture, and expire after seven days.

Pull request #13 established the first live baseline on 2026-07-26:

| Displayed check name | Result | Duration |
| --- | --- | ---: |
| `quality (Node 20)` | Passed | 44 seconds |
| `quality (Node 22)` | Passed | 24 seconds |
| `browser (Chromium)` | Passed | 57 seconds |
| `package smoke (Node 20)` | Passed | 22 seconds |
| `package smoke (Node 22)` | Passed | 21 seconds |

All jobs ran in parallel. The observed required path was 57 seconds, well
within the 10-minute target.

## Foundation closeout evidence

The test-foundation closeout validation ran on 2026-07-26 with these additional
checks:

- Three complete Vitest runs passed with shuffled file and test ordering using
  seeds `20260726`, `8675309`, and `424242`.
- A clean clone of `main` completed `npm ci`, `npm run prepublishOnly`,
  `npm run test:coverage`, `npm run test:browser`, and
  `npm run test:openspec`.
- The clean-clone `PATH` intentionally excluded any globally installed
  `openspec` executable; validation succeeded through the exact development
  dependency in the lockfile.
- The clean-clone run reproduced 106 Vitest tests, four installed-package smoke
  tests, six Chromium journeys, and final coverage of 88.36% statements,
  77.93% branches, 92.39% functions, and 89.63% lines.
- Server and watcher lifecycle assertions passed in every shuffled and
  clean-clone run. Test-owned servers, watchers, browser processes, temporary
  projects, package installations, tarballs, reports, coverage, and traces were
  absent after cleanup.
- `git status --short` returned no paths in the clean clone after validation and
  cleanup. A pre-existing user-launched `openspec-viewer` process was identified
  by its earlier start time and left untouched.

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
