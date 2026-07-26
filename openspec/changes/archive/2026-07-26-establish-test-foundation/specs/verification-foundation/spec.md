## ADDED Requirements

### Requirement: Tests use deterministic isolated project data

The verification system SHALL provide one committed fictional OpenSpec fixture
and SHALL copy it into a unique temporary project before any test mutates data.
Tests SHALL NOT read or write the developer's active OpenSpec project, committed
fixture, credentials, or private notes.

#### Scenario: A mutation test starts

- **WHEN** a test needs to create, edit, toggle, archive, or annotate an OpenSpec
  change
- **THEN** it performs the operation in a unique temporary fixture copy and
  removes that copy during teardown

#### Scenario: Tests run concurrently

- **WHEN** multiple test workers execute filesystem or HTTP scenarios
- **THEN** each worker uses independent project and port resources without
  observable cross-test state

### Requirement: Domain and filesystem behavior is covered

The automated suite SHALL cover discovery, summaries, graphs, search, spec
diffs, task parsing and mutation, artifact writes, local notes, archive
enforcement, and file-watch behavior through their observable results and
documented validation errors.

#### Scenario: A supported artifact mutation succeeds

- **WHEN** a test writes an active proposal, design, task set, or local note
- **THEN** it verifies the returned representation and exact persisted file
  content

#### Scenario: A mutation is rejected

- **WHEN** an invalid, archived, missing, or otherwise unsupported mutation is
  attempted
- **THEN** the test verifies the error and confirms that no target file was
  partially modified

### Requirement: The real HTTP API is contract tested

The suite SHALL start the real server on an ephemeral loopback port and SHALL
exercise every public read and mutation endpoint family using real HTTP
requests. Tests SHALL verify status, payload, persistence, validation errors,
SSE delivery, and clean shutdown.

#### Scenario: A read workflow is exercised

- **WHEN** integration tests request project, changes, detail, graph, next-up,
  search, health, or events
- **THEN** the real server returns the documented contract derived from the
  isolated fixture

#### Scenario: A write workflow is exercised

- **WHEN** integration tests create or archive a change, update an artifact,
  mutate or toggle tasks, or write notes
- **THEN** the response and resulting fixture files agree and an applicable SSE
  event is observable

#### Scenario: The server test finishes

- **WHEN** an HTTP or SSE test passes or fails
- **THEN** the server, watchers, open event streams, and temporary resources are
  closed without keeping the test process alive

### Requirement: HTTP failures use stable JSON status classes

The local HTTP API SHALL validate the JSON root and action-specific fields
before mutation. It SHALL return JSON errors with `400` for malformed encoding,
invalid JSON, invalid field types, or missing required input; `404` for unknown
routes, changes, or tasks; `409` for existing-change and archived-read-only
conflicts; and `500` when a local operation or OpenSpec subprocess fails.
Rejected requests SHALL leave their target files unchanged.

#### Scenario: A request has invalid typed input

- **WHEN** a mutation body is null, lacks a required field, or supplies a field
  with an unsupported type
- **THEN** the server returns `400` with an English JSON error and does not
  mutate project data

#### Scenario: A request conflicts with project state

- **WHEN** a client creates an existing change or attempts to mutate an archived
  OpenSpec artifact
- **THEN** the server returns `409` and preserves the existing files byte for
  byte

### Requirement: The installed CLI and package are verified

The suite SHALL build a package tarball, inspect its public contents, install it
into a clean temporary directory, and invoke the installed
`openspec-viewer` executable on every supported Node.js major version.

#### Scenario: A package candidate is tested

- **WHEN** CI builds a release candidate
- **THEN** the tarball contains only intended public files and the installed
  executable reports the expected version and help text

#### Scenario: Invalid CLI input is supplied

- **WHEN** the installed CLI receives an unknown option, invalid port, or path
  without an OpenSpec project
- **THEN** it exits non-zero with actionable English output and does not open a
  browser or create project files

#### Scenario: The CLI requests an ephemeral listener

- **WHEN** the installed CLI starts with `--host 127.0.0.1 --port 0`
- **THEN** the operating system assigns the child process a unique port and the
  CLI reports the actual loopback URL without a release-and-rebind race

#### Scenario: The desktop browser opener is unavailable

- **WHEN** the local server starts successfully but the platform browser
  launcher emits an asynchronous process error
- **THEN** the CLI keeps the server running because automatic browser launch is
  optional

### Requirement: Critical browser workflows are automated

The suite SHALL drive the real static UI in a deterministic Chromium session
and SHALL verify primary navigation, search, graph focus, change detail,
artifact and task workflows, notes, archive read-only behavior, and keyboard
access using observable user-facing state.

#### Scenario: A user explores the project

- **WHEN** the browser opens the fixture project and navigates through Now,
  Graph, Timeline, Board, search, and change detail
- **THEN** each view displays the expected fictional project state without
  browser console errors

#### Scenario: A user changes project state

- **WHEN** the browser updates an allowed task, artifact, or local note
- **THEN** the UI confirms the result and a fresh page load observes the
  persisted value

#### Scenario: A user adds an empty task section

- **WHEN** the browser adds a named section before adding its first task
- **THEN** the section remains visible, is preserved in `tasks.md`, and can be
  renamed or deleted through the structured task editor

#### Scenario: An external update arrives during a local edit

- **WHEN** another local client changes an artifact while the browser contains
  unsaved editor content
- **THEN** the browser preserves the unsaved value, reports that changes are
  pending, and applies the external update after the local value is saved or
  reverted

#### Scenario: A user operates by keyboard

- **WHEN** the user navigates primary controls, opens search, selects a result,
  and returns focus using the keyboard
- **THEN** controls have accessible names, focus remains visible, and the
  workflow completes without pointer input

### Requirement: Coverage protects Node-source regressions

The test command SHALL measure V8 coverage for TypeScript Node sources and SHALL
fail below 80 percent statements, 80 percent lines, 80 percent functions, or 70
percent branches. Thresholds SHALL NOT be reduced without an approved OpenSpec
exception and restoration task.

Vitest and its coverage provider SHALL use the same major and any major upgrade
SHALL pass the supported Node.js matrix before adoption.

#### Scenario: Untested Node behavior lowers coverage

- **WHEN** a pull request reduces a configured coverage metric below its
  threshold
- **THEN** the quality check fails and reports the uncovered files and lines

#### Scenario: Global coverage passes

- **WHEN** the aggregate threshold is satisfied
- **THEN** review still verifies explicit scenarios for artifact writes, tasks,
  notes, archives, validation errors, and failed-write integrity

#### Scenario: A test-tooling major is proposed

- **WHEN** Dependabot proposes a new Vitest major
- **THEN** the matching coverage-provider major is evaluated in the same change
  on all supported Node.js versions before either dependency is adopted

### Requirement: CI exposes stable verification gates

GitHub Actions SHALL run stable named quality checks on Node.js 20 and 22,
browser checks in deterministic Chromium, and installed-package smoke checks on
both supported Node.js majors. These checks SHALL be suitable for enforcement
by the default-branch ruleset.

#### Scenario: A pull request changes product or test code

- **WHEN** CI runs for the pull request
- **THEN** typecheck, domain and HTTP tests, coverage, build, browser journeys,
  and package smoke report independently attributable results

#### Scenario: A check fails

- **WHEN** any verification layer fails
- **THEN** CI provides logs and only non-sensitive fictional diagnostics needed
  to reproduce the failure

### Requirement: Tests remain reliable and maintainable

Tests SHALL avoid fixed sleeps, external network dependencies, mutable shared
state, implementation-only assertions, and real user data. Flaky tests SHALL
not be silently retried or disabled without a tracked owner and removal date.

#### Scenario: The suite is repeated

- **WHEN** the complete suite runs repeatedly in a clean environment
- **THEN** it produces the same results and leaves no server, watcher, browser,
  temporary project, or generated package resource behind

#### Scenario: A known security finding receives a regression test

- **WHEN** work begins on an existing security finding
- **THEN** its test is introduced as valid red evidence in the matching
  security change and passes only after the production fix
