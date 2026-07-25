## Context

`openspec-viewer` is a local-first Node.js CLI with a static browser UI and an
HTTP/SSE server that reads and writes OpenSpec projects. A regression can alter
user files, expose local information, make archives writable, break the packed
binary, or leave the UI disconnected even when parser unit tests pass.

The current suite has eleven tests:

- Five task parser and mutation tests.
- Three project discovery, summary, graph, next-up, and search tests.
- One spec-diff parser test.
- Two package metadata and source-CLI version tests.

The suite directly imports five domain modules. It does not start
`src/server.ts`, drive `src/ui/app.js`, install the npm tarball, measure
coverage, or exercise the notes, watcher, archive, and most mutation behavior.
CI runs the same suite on Node.js 20 and 22, then builds and invokes only
compiled `--help` and `--version`.

## Goals / Non-Goals

**Goals:**

- Make public product seams the primary verification targets.
- Keep all filesystem writes inside isolated temporary projects.
- Reuse one representative fixture across integration and browser layers.
- Produce stable CI checks that can safely become branch requirements.
- Measure Node-source coverage while prioritizing behavioral scenarios.
- Keep browser tests deterministic, accessible, and fast enough for pull
  requests.
- Preserve the dependency-free runtime package.
- Make future security work follow red/green tests without accepting insecure
  behavior as the baseline contract.

**Non-Goals:**

- Reach 100 percent coverage.
- Replace focused unit tests with only end-to-end tests.
- Add a production test mode or test-only HTTP endpoint.
- Depend on a live external OpenSpec repository, network service, or browser
  account.
- Merge known-vulnerability assertions that normalize unsafe behavior.

## Decisions

### 1. Use a layered verification model

The suite will have four layers:

1. **Domain unit and filesystem integration** with Vitest.
2. **HTTP integration** against the real server and an isolated project.
3. **Browser workflow tests** with Playwright against that real server.
4. **Package smoke tests** against a packed and freshly installed tarball.

Unit tests keep diagnosis fast. HTTP and browser tests prove composition. The
package smoke proves that build output, package metadata, executable mode, and
installation work outside the source checkout.

### 2. Share one deterministic fictional fixture

A committed fixture will include:

- Active, completed, and archived changes.
- Proposal, design, tasks, main specs, and delta specs.
- Partial and completed task sections.
- Searchable content and graph relationships.
- No real usernames, machine paths, private notes, or credentials.

Tests that mutate data will copy the fixture into a fresh temporary directory.
No test writes to the committed fixture or the developer's active OpenSpec
project. The same source fixture can later support demo mode and documentation
capture.

### 3. Start the real server on an ephemeral local port

The integration harness will bind to `127.0.0.1` using an operating-system
assigned port, expose the actual bound URL, and provide an idempotent async
close operation. Tests will wait for readiness, close SSE clients, stop file
watchers, and remove temporary directories in teardown.

If production code needs a small lifecycle refactor to support this, the change
must preserve CLI behavior and begin with a failing public-seam test.

The HTTP boundary validates that mutation bodies are JSON objects and checks
action-specific field types before calling domain functions. Invalid encoding,
JSON, or typed input returns `400`; missing routes, changes, or tasks return
`404`; existing-change and archived-read-only conflicts return `409`; and local
operation or OpenSpec subprocess failures return `500`. Note writes emit an
explicit SSE reload because `.openspec-viewer/` is intentionally outside the
OpenSpec filesystem watcher.

### 4. Prefer real boundaries and narrow fakes

HTTP tests use real requests and real files. Browser tests use the built or
development UI served by the real server. Subprocess boundaries such as
OpenSpec archive and OS browser launch may use injected narrow command runners
so tests do not open applications or depend on globally installed tools.

Create and archive commands run against an isolated temporary copy of the
selected OpenSpec project. Lifecycle copies reject symbolic links and
unsupported filesystem entries rather than allowing a subprocess to follow
them outside the selected project.

A successful create publishes only the completed change directory. Publication
first reserves the destination directory atomically, so another writer cannot
be replaced between an existence check and the final rename. On Windows, where
renaming over the process-owned empty reservation is not supported, publication
uses the platform's direct no-replace directory rename behavior.

A successful archive is published only when a content fingerprint proves that
the live project has not changed since the temporary copy was created. The
publisher computes the path delta between the original and command-result
trees, stages replacement files on the project filesystem, and applies only
that delta. Fingerprints include entry type, file content, and relevant
permission bits. New files use no-clobber hard links. Replacements and removals
atomically move the current live file to a path-scoped backup, validate the
captured file, and use no-clobber publication for the replacement. The
publisher revalidates the result and the backups before commit. It never clears
and recopies the entire live OpenSpec tree, so unrelated concurrent data is not
overwritten and the watched root directory remains stable.

Archive staging under `.openspec-viewer/lifecycle/` verifies directory
identity and realpath containment before writing or cleanup. Symlinked local
state components are rejected. The local ignore file is retained and repaired
when necessary so that recovery material and notes remain ignored even when
another local operation creates data during publication. Temporary publish
directories are atomically moved to an identity-checked quarantine name before
recursive deletion.

The lifecycle distinguishes publication commit from cleanup. A cleanup error
after the live result is committed returns the successful mutation together
with an English `cleanupWarning`; it does not report the mutation as unapplied
or invite an unsafe retry. If publication and cleanup both fail before commit,
the publication error remains primary and carries the cleanup failure as
diagnostic context.

Failed commands, failed fallback scaffolds, preparation errors, and detected
concurrent-edit conflicts restore paths changed by the transaction and remove
their temporary workspaces. If an external writer makes exact rollback
impossible, its data is preserved and recovery files remain only in ignored
local viewer state rather than as an unignored repository-root copy.

File-watch mapping, create/update/rename notifications, debounce, ignored local
notes, error tolerance, and idempotent close are tested through the injected
`WatchFactory` boundary with fake timers. The suite does not use a timing-based
`fs.watch` smoke test: delivery timing varies by operating system and retaining
one would violate the no-fixed-sleeps and no-silent-retries reliability
requirements. Real server and SSE tests verify watcher ownership and shutdown
without treating best-effort operating-system timing as a deterministic gate.

Tests assert observable results: response status and body, resulting file
content, emitted event, visible UI state, CLI output, exit status, and package
contents. They do not assert private helper calls or exact DOM structure.

### 5. Add coverage as a guardrail, not the objective

Vitest and `@vitest/coverage-v8` will always use the same major. Dependabot PR
#5 proposes Vitest 4.1.10, but it will not be merged independently. The
foundation will test the matched Vitest 4 and coverage-v8 pair against the
current source, Node.js 20, and Node.js 22. It will be adopted only if:

- Unit and integration behavior remains green.
- Coverage semantics and thresholds remain stable.
- The minimum supported development runtime is documented and compatible with
  the repository's Node.js policy.
- The package remains dependency-free at runtime.

If those conditions fail, the foundation retains the matched Vitest 3 pair and
records the blocker. This is a compatibility decision, not an automatic
security upgrade.

The chosen `@vitest/coverage-v8` version will measure TypeScript Node sources.
The completed foundation will enforce at least:

- 80 percent statements and lines.
- 80 percent functions.
- 70 percent branches.

Generated output, type declarations, scripts, and browser UI are excluded from
the Node threshold. Browser behavior is guarded by explicit Playwright
journeys. Thresholds may only increase unless an OpenSpec design documents the
reason for a temporary reduction.

Critical write paths require scenario coverage even if global thresholds pass:
artifact writes, task mutations, notes, archive enforcement, validation
failures, and failed-write integrity.

### 6. Use Playwright only as development tooling

`@playwright/test` and its Chromium browser are development-only. The first
browser suite uses one deterministic Chromium configuration with:

- Fixed viewport.
- Fixed locale and timezone.
- Reduced motion.
- Explicit light or dark theme.
- No external network access.
- Accessible roles and names as primary selectors.

Pixel snapshots are avoided. Screenshots and traces are retained only when a
test fails.

### 7. Give CI checks stable responsibilities

CI will expose stable named checks suitable for a repository ruleset:

- `quality (Node 20)` and `quality (Node 22)` for typecheck, unit/integration
  tests, coverage, and build.
- `browser (Chromium)` for critical UI journeys.
- `package smoke (Node 20)` and `package smoke (Node 22)` for tarball install
  and executable verification.

The exact displayed GitHub check names will be verified before
`harden-github-repository` configures the ruleset. Browser diagnostics are
uploaded only on failure and contain fictional fixture data.

When these jobs replace the current CI workflow, they will also supersede
Dependabot PRs #1 and #2 by using the reviewed current v7 commits for
`actions/checkout` and `actions/setup-node`, pinned to full SHAs with version
comments. Mutable major tags are not accepted even when the underlying upgrade
is desirable.

### 8. Add security tests with their fixes

The foundation supplies harnesses for origin, content type, body size, URL
scheme, path, symlink, and non-loopback scenarios. Tests that assert safer
behavior for known findings belong to the security-hardening change and must be
introduced red before the matching production fix.

This avoids either merging permanently failing tests or recording vulnerable
behavior as the expected contract.

## Test Matrix

| Surface | Tool | Required evidence |
| --- | --- | --- |
| Parsers and domain rules | Vitest | Values, errors, edge cases |
| Filesystem mutations | Vitest + temporary project | Exact resulting files and failed-write integrity |
| HTTP API and SSE | Vitest + real server | Status, payload, persistence, event, cleanup |
| Browser workflows | Playwright Chromium | Visible state, navigation, keyboard use, persistence |
| CLI | Child process | Output, exit status, argument behavior, lifecycle |
| Published package | `npm pack` + isolated install | Contents, install, executable behavior |
| CI | GitHub Actions | Stable required checks on supported Node versions |

## Risks / Trade-offs

- [Browser tests become flaky] → Eliminate timing sleeps, wait on observable
  state, fix locale/time/motion, isolate data, and retain failure traces.
- [Coverage work encourages low-value assertions] → Require scenario-based
  acceptance criteria and review test behavior, not only percentages.
- [Server tests leak processes or watchers] → Make lifecycle ownership explicit
  and verify teardown with repeated runs.
- [Fixture diverges from OpenSpec] → Validate it with OpenSpec in CI and reuse
  it across product proof rather than maintaining parallel examples.
- [CI becomes slow] → Keep unit/integration tests parallel and fast, run one
  browser, cache browser binaries appropriately, and measure job duration.
- [Package tests depend on the source tree] → Install the tarball into a clean
  temporary directory and invoke only the installed executable.
- [Existing security bug gets normalized] → Add its assertion only in the
  paired security change, starting red and ending green.

## Rollout Order

1. Add the test strategy, decide the matched Vitest/coverage version, and add
   the coverage tooling, fixture, and lifecycle harnesses.
2. Fill domain and filesystem gaps.
3. Add real HTTP and SSE integration tests.
4. Add installed CLI and package smoke tests.
5. Add the deterministic browser suite.
6. Split CI into stable checks, pin the reviewed v7 Actions digests, and enforce
   coverage thresholds.
7. Run repeatability and clean-environment validation.
8. Make this foundation a prerequisite for GitHub hardening and public launch.

## Rollback

- A flaky browser test may be quarantined only with a linked issue, owner, and
  expiry date; the critical journey must retain another reliable assertion.
- Coverage thresholds may not be silently lowered. A temporary reduction
  requires an explicit documented exception and restoration task.
- Testability refactors can be reverted independently if public behavior and
  lifecycle tests remain intact.
- The existing fast unit suite remains available even if a higher layer needs
  temporary repair.
