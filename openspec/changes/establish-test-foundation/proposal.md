## Why

The repository has a working Vitest suite, but it is much smaller than the
product surface suggests. The 2026-07-24 baseline contains four test files and
eleven passing tests. They cover task parsing and mutations, spec-diff parsing,
selected project summaries and search behavior, package metadata, and CLI
version output.

There are no automated tests that start the real HTTP server, exercise its read
or write endpoints, observe Server-Sent Events, install the packed CLI, or drive
the browser UI. The filesystem mutation, local-notes, watcher, archive, error,
and most CLI paths are also untested. No coverage provider or threshold is
configured, so CI can remain green while important behavior becomes
unexercised.

This verification gap should be addressed before repository hardening and
public-launch work. Branch rules and release gates are only valuable when the
required checks exercise the behavior users depend on.

## What Changes

- Define a layered test strategy for domain logic, filesystem integration, real
  HTTP behavior, the installed CLI, browser workflows, and package contents.
- Add one deterministic fictional OpenSpec fixture shared across integration,
  browser, package, demo, and future media-capture tests.
- Add isolated temporary-project and real-server harnesses with reliable
  cleanup and ephemeral ports.
- Expand Vitest coverage across discovery, project parsing, search, task and
  artifact mutation, notes, archive behavior, file watching, and failure
  integrity.
- Make create and archive lifecycle publication isolated, conflict-aware, and
  safe for untrusted local project trees.
- Reject invalid artifact content, traversal-shaped note names, and symbolic
  links at lifecycle-copy boundaries with stable validation errors.
- Test every public HTTP read and mutation family through real requests,
  including validation errors, archived read-only enforcement, persistence,
  SSE, and shutdown.
- Add installed-tarball CLI smoke tests rather than relying only on source
  execution.
- Add development-only browser automation for the critical user journeys,
  keyboard access, and observable persistence.
- Add V8 coverage with enforceable Node-source thresholds and a ratchet policy.
- Split CI into stable, named verification checks suitable for the future
  `main` ruleset.
- Document local commands, fixture rules, coverage policy, test ownership, and
  failure diagnostics.

## Capabilities

### New Capabilities

- `verification-foundation`: Deterministic automated evidence for the domain,
  filesystem, HTTP, CLI, package, browser, and CI contracts of
  `openspec-viewer`.
- `local-project-integrity`: Conflict-aware lifecycle publication and stable
  validation that prevent partial writes, concurrent-edit loss, and symlink
  escape during create and archive operations.

### Modified Capabilities

None. The repository does not yet contain an archived verification-foundation
capability specification.

## Impact

- Adds development-only coverage and browser-test dependencies.
- Changes package scripts, Vitest configuration, GitHub Actions, test fixtures,
  and contributor documentation.
- Refactors server, subprocess invocation, browser launch, and temporary
  resources so their lifecycle is controllable from tests.
- Tightens invalid-input behavior for non-string artifacts, traversal-shaped
  note names, lifecycle symlinks, and concurrent create or archive conflicts.
- Creates stable CI check names that `harden-github-repository` can require.
- Becomes a prerequisite for `prepare-public-launch`; launch-specific demo and
  visual tests extend this foundation instead of duplicating it.
- Preserves the dependency-free published runtime.

## Non-Goals

- Replacing TDD with after-the-fact coverage work.
- Treating a coverage percentage as proof of correctness or security.
- Fixing the remaining known CSRF, non-loopback exposure, unsafe Markdown-link,
  request-size, or general filesystem-containment findings; their regression
  tests must be added with the corresponding security fixes. This change only
  covers the lifecycle-copy and note-name boundaries introduced or exercised
  by this foundation.
- Adding pixel-perfect screenshot tests.
- Testing every browser and operating-system combination in the first phase.
- Publishing an npm package, release, hosted demo, or GitHub Pages site.
- Mocking the HTTP or filesystem boundary so heavily that tests stop
  representing the shipped application.
