## 1. Baseline and Test Contract

- [x] 1.1 Inventory the existing test files, test count, directly exercised
  modules, package scripts, CI jobs, and missing public seams
- [x] 1.2 Run the current unit suite, typecheck, and build and record the
  2026-07-24 baseline of 4 files and 11 passing tests
- [x] 1.3 Add `docs/testing.md` with the test layers, commands, fixture policy,
  ownership, failure diagnostics, and TDD red/green expectations
- [ ] 1.4 Add `test:unit`, `test:integration`, `test:coverage`, `test:browser`,
  and `test:package` scripts with non-overlapping responsibilities
- [x] 1.5 Add `@vitest/coverage-v8` as a development-only dependency and
  configure text, JSON, and HTML reports outside tracked source
- [x] 1.6 Measure and record the pre-expansion Node-source coverage without
  weakening the final required thresholds
- [x] 1.7 Add coverage output, browser output, package tarballs, and transient
  test projects to `.gitignore` while retaining any committed fictional fixture
- [x] 1.8 Test Vitest 4.1.10 with the matching `@vitest/coverage-v8` major on
  Node.js 20 and 22, record its minimum development-runtime impact, and either
  adopt the matched pair or retain Vitest 3 with the blocker documented
- [x] 1.9 Coordinate the chosen toolchain with Dependabot PR #5 and close that
  PR as superseded or compatibility-blocked only after the decision is verified

## 2. Deterministic Fixture and Harnesses

- [x] 2.1 Add one fictional fixture containing active, complete, archived,
  partial-task, main-spec, delta-spec, search, graph, and timeline examples
- [x] 2.2 Validate the committed fixture with the supported OpenSpec CLI and
  assert that it contains no local paths, real project data, credentials, or
  private notes
- [x] 2.3 Add a fixture-copy helper that creates a unique temporary project for
  every mutating test and recursively removes it during teardown
- [x] 2.4 Add a real-server harness that binds to an operating-system assigned
  `127.0.0.1` port and returns the actual URL plus an idempotent async close
- [ ] 2.5 Add lifecycle assertions proving servers, watchers, SSE clients, and
  temporary directories are cleaned after success and failure
- [ ] 2.6 Add a narrow subprocess seam for OpenSpec archive and browser-launch
  behavior so tests never open desktop applications or require a global CLI
- [x] 2.7 Confirm the harness supports concurrent workers without shared ports,
  paths, notes, or fixture mutations

## 3. Domain and Filesystem Coverage

- [x] 3.1 Expand discovery tests for ancestor lookup, direct OpenSpec paths,
  missing projects, active/archive listing, invalid names, and deterministic
  ordering
- [x] 3.2 Expand task tests for malformed headings, duplicate or missing IDs,
  section operations, boundary moves, explicit completion state, file writes,
  and validation errors
- [x] 3.3 Expand project tests for empty, partial, complete, and archived changes,
  missing optional artifacts, overview counts, details, graph edges, and next-up
  ordering
- [x] 3.4 Expand search tests across task, proposal, design, main spec, delta
  spec, separated multi-term, empty, case-insensitive, limit, and snippet
  behavior
- [x] 3.5 Expand spec-diff tests for renamed and unknown sections, multiple
  requirements, absent scenarios, previews, and change-level spec discovery
- [x] 3.6 Add artifact mutation tests for active proposal, design, raw tasks,
  structured tasks, stable invalid-content errors, missing changes, and
  archived rejection
- [x] 3.7 Add notes tests for directory creation, `.gitignore` preservation,
  read/write behavior, rejected traversal-shaped change names, and isolation
  from OpenSpec artifacts
- [x] 3.8 Add create and archive tests with a narrow fake OpenSpec process,
  verifying arguments, output, errors, resulting paths, symlink rejection,
  contained local recovery state, deterministic partial-publication rollback,
  cross-platform no-clobber publication, post-commit cleanup warnings,
  conflict-aware publication, workspace cleanup, and no partial writes
- [x] 3.9 Add watcher tests for relevant create, update, and rename events,
  debounce behavior, ignored local notes, and reliable close

## 4. Real HTTP and SSE Integration

- [ ] 4.1 Test health, project, changes, change detail, graph, next-up, and search
  through real HTTP requests against the fixture
- [ ] 4.2 Test missing routes, unknown changes, malformed encoding, empty search,
  invalid JSON, missing required fields, and documented status codes
- [ ] 4.3 Test proposal, design, raw-task, structured-task, task-mutation,
  task-toggle, and note writes and verify exact persisted content
- [ ] 4.4 Test change creation and archive requests, including confirmation,
  skip-spec arguments, subprocess failures, and resulting filesystem state
- [ ] 4.5 Test archived artifact read-only enforcement for every mutation route
  and confirm rejected requests leave files unchanged
- [ ] 4.6 Test SSE connection, hello event, filesystem-triggered reload event,
  mutation-triggered reload event, disconnect, and server shutdown
- [ ] 4.7 Test concurrent independent server instances and confirm neither
  instance observes or mutates the other fixture
- [ ] 4.8 Verify every integration test closes the server and watcher even when
  an assertion or request fails

## 5. Installed CLI and Package Verification

- [ ] 5.1 Expand source CLI tests for help, version, positional path,
  `--path`, `--port`, `--host`, archive visibility, `--no-open`, unknown
  options, invalid ports, and missing OpenSpec roots
- [ ] 5.2 Add a child-process harness that starts the compiled CLI against an
  isolated fixture, waits for readiness, verifies output, and terminates cleanly
- [ ] 5.3 Build and inspect `npm pack --json` output for intended files,
  executable mode, version, license, README, generated UI, and sensitive-file
  exclusions
- [ ] 5.4 Install the tarball into a clean temporary directory and invoke only
  its installed `openspec-viewer` binary
- [ ] 5.5 Verify installed `--help`, `--version`, invalid input, project start,
  health response, and clean termination on Node.js 20 and 22
- [ ] 5.6 Confirm package smoke never imports source files, local `node_modules`,
  or unlisted repository assets

## 6. Critical Browser Workflows

- [ ] 6.1 Add `@playwright/test` as a development-only dependency and configure
  deterministic Chromium, viewport, locale, timezone, theme, and reduced motion
- [ ] 6.2 Launch the real server and isolated fixture from Playwright without
  external network requests or desktop browser side effects
- [ ] 6.3 Test initial load and navigation across Now, Graph, Timeline, Board,
  change detail, artifact tabs, and archived changes
- [ ] 6.4 Test global search by keyboard, result selection, deep-link updates,
  focus restoration, empty results, and direct deep-link loading
- [ ] 6.5 Test graph focus, change/spec navigation, next-task navigation, and
  observable state after browser history changes
- [ ] 6.6 Test task toggle, add, edit, move, delete, and section operations and
  verify persistence after a full page reload
- [ ] 6.7 Test proposal, design, tasks, and notes editing plus archive read-only
  controls and visible validation errors
- [ ] 6.8 Assert primary controls have accessible names, keyboard focus is
  visible, dialogs restore focus, and critical journeys need no pointer input
- [ ] 6.9 Fail on unexpected browser console errors, page errors, or external
  requests and retain trace and screenshot only on failure

## 7. Coverage and CI Gates

- [ ] 7.1 Configure Node-source coverage thresholds at 80 percent statements,
  lines, and functions and 70 percent branches
- [ ] 7.2 Add explicit scenario review for artifact writes, task mutations,
  notes, archives, validation errors, and failed-write integrity regardless of
  aggregate coverage
- [ ] 7.3 Split CI into stable `quality` checks for Node.js 20 and 22 that run
  install, typecheck, unit/integration tests, coverage, and build
- [ ] 7.4 Add a stable Chromium browser check with cached tooling and
  non-sensitive diagnostics uploaded only on failure
- [ ] 7.5 Add stable package-smoke checks on Node.js 20 and 22 using the clean
  tarball installation path
- [ ] 7.6 Validate the fictional fixture and all active OpenSpec changes in CI
- [ ] 7.7 Measure each job duration and keep the required pull-request path
  within the documented target or record an optimization follow-up
- [ ] 7.8 Verify the displayed GitHub check names and provide them to
  `harden-github-repository` before its `main` ruleset is enabled
- [ ] 7.9 Replace the mutable `actions/checkout@v4` and
  `actions/setup-node@v4` references with reviewed current v7 commit SHAs and
  release comments, then supersede Dependabot PRs #1 and #2

## 8. Reliability and Closeout

- [ ] 8.1 Run unit/integration tests repeatedly with randomized ordering where
  supported and resolve resource, timing, and shared-state failures
- [ ] 8.2 Run the complete suite from a clean clone or equivalent isolated
  checkout with no globally installed OpenSpec CLI
- [ ] 8.3 Confirm tests leave no server, watcher, browser, temporary project,
  tarball, installation, coverage, or trace resource behind
- [ ] 8.4 Update `CONTRIBUTING.md`, the pull-request template, and README
  development commands with the new verification layers
- [x] 8.5 Replace the duplicated general public-seam tasks in
  `prepare-public-launch` with a dependency on this change while retaining
  launch-specific demo and media checks there
- [x] 8.6 Add this change as an explicit prerequisite for the required-check and
  ruleset tasks in `harden-github-repository`
- [ ] 8.7 Run the full Node.js 20 and 22, browser, package, coverage, build,
  OpenSpec, and clean-worktree validation and record the results
- [x] 8.8 Run `openspec validate establish-test-foundation --strict` and resolve
  every artifact validation error before implementation begins
