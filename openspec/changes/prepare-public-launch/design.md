## Context

openspec-viewer already provides a capable local browser workspace, a
dependency-free Node.js runtime, public documentation, and CI on supported Node
versions. Its public launch surface is weaker than the product: there are no
visual assets or hosted demo, installation requires cloning from source, the
unscoped npm name belongs to another project, no GitHub release exists, and
several trust and community settings remain unconfigured.

The change crosses CLI behavior, static UI bootstrapping, fixture data, browser
automation, package identity, release automation, repository documentation, and
externally managed GitHub/npm settings. It therefore needs one coordinated
design even though delivery will be incremental.

## Goals / Non-Goals

**Goals:**

- Let a visitor understand and try the product with minimal reading or setup.
- Give the project an unambiguous npm identity and reproducible release path.
- Reuse one deterministic demo project across demo mode, E2E verification, and
  launch media.
- Make CI evidence representative of the installed CLI and browser workflow.
- Establish durable repository trust and contributor signals.
- Preserve the dependency-free runtime and the existing executable name.

**Non-Goals:**

- Rename the GitHub repository or product executable.
- Add a writable hosted backend, authentication, telemetry, or cloud storage.
- Replace the current local filesystem and localhost API architecture.
- Automate publication before npm namespace ownership and trusted publishing are
  explicitly configured.
- Require Discussions, sponsorship, or a large governance structure before the
  project has an active community.

## Decisions

### 1. Use a scoped npm package and keep the executable stable

The package identity will become `@warsclon/openspec-viewer`; its `bin` mapping
will continue to expose `openspec-viewer`. The unscoped name is already owned by
another project, so attempting to publish it would be ambiguous and unsafe.

Alternatives considered:

- Renaming the repository and CLI: rejected because it discards existing
  discoverability and breaks the established command.
- Publishing only GitHub archives: rejected because it does not provide a
  reliable one-command trial.

### 2. Make one deterministic demo fixture the source for product proof

A self-contained OpenSpec sample project will exercise active and archived
changes, partial and completed task sets, proposal/design content, delta specs,
search, graph edges, timeline dates, and local notes where safe. Demo mode,
browser E2E tests, screenshots, recordings, and the hosted read-only demo will
all consume this fixture.

Demo mode will resolve the bundled fixture without creating OpenSpec files in
the caller's project. Mutating controls will be disabled in hosted mode; local
demo mode may use an isolated temporary copy when edit interactions need to be
demonstrated.

Alternatives considered:

- Separate hand-written fixtures for documentation and tests: rejected because
  they will drift.
- A public writable demo server: rejected because it adds abuse, persistence,
  and operational concerns unrelated to the local-first product.

### 3. Add a UI data-source boundary for hosted demo mode

The browser application will continue using the local HTTP API in normal mode.
Hosted demo builds will use a static snapshot conforming to the same response
contracts. A read-only capability flag will control whether mutation actions are
rendered and accepted.

This keeps the production local path unchanged while allowing a static host to
demonstrate real views without emulating a filesystem backend.

### 4. Generate visual assets through a scripted browser journey

A development-only browser automation flow will launch the deterministic demo,
wait for stable rendering, set a fixed viewport and theme, and capture:

- A primary product screenshot for the README.
- A social preview with the product name and real UI.
- A short journey covering Now, Graph, and task interaction for animated media.

The capture process will redact machine paths, use fictional data, and fail if
the fixture or expected controls cannot be loaded. Generated assets intended for
the README will be committed; transient browser artifacts will remain ignored.

### 5. Release from a validated tag using trusted publishing

A version tag will trigger the same typecheck, unit test, integration test,
browser test, build, package dry-run, and installed-CLI smoke used before local
publication. Only after those checks pass will automation publish the scoped
package with npm provenance and create a GitHub Release from the changelog.

npm trusted publishing/OIDC is preferred over a long-lived npm token. The
release workflow will use minimal GitHub permissions and will not publish from
ordinary branch pushes.

### 6. Test at public seams

The primary seams are:

1. The installed package executable and its observable CLI output.
2. The localhost HTTP API exercised through real requests against a fixture.
3. The browser workflow exercised through accessible controls and visible state.
4. The static hosted-demo build and its read-only behavior.
5. Repository/release automation validated through configuration and artifact
   inspection.

Existing parser and mutation unit tests remain useful, but release confidence
will not rely on private helpers or implementation-coupled mocks.

### 7. Treat GitHub settings as versioned operational work

Repository metadata and file-backed configuration will be committed normally.
Settings that live outside Git—topics, homepage, social preview, rulesets,
security scanning, push protection, dependency security updates, Pages, and npm
trusted publishing—will have explicit checklist tasks and post-change
verification.

The `main` ruleset will require the CI workflow, prevent deletion and force
pushes, and preserve a documented emergency bypass for the maintainer.

### 8. Keep automation useful rather than noisy

Dependabot updates will be grouped by ecosystem and update class. Patch/minor
development updates can share a PR; major updates remain isolated for explicit
compatibility review. Existing bot PRs superseded by the grouping policy will be
closed or consolidated after the new policy is active.

Human-facing roadmap issues will have a problem statement, acceptance criteria,
scope, and validation notes. A small number will receive `good first issue` or
`help wanted` only when they are genuinely self-contained.

## Testing Decisions

- Tests SHALL assert external behavior and stable contracts rather than private
  functions, DOM implementation details, or exact visual pixel snapshots.
- Package tests will create a tarball, install it in an isolated directory, and
  invoke the installed binary.
- HTTP integration tests will start the real server on an ephemeral port and
  cover read operations, safe mutation, archived read-only enforcement, errors,
  notes, search, and SSE connectivity.
- Browser tests will use the deterministic fixture and cover first load,
  navigation, graph focus, search, task interaction, and read-only demo mode.
- Accessibility checks will cover keyboard access, labels, focus, and meaningful
  alternative text in the launch surface.
- Release configuration will be tested by building and inspecting artifacts on
  pull requests, while publish steps remain tag-only.
- Prior art includes the existing Vitest parser/project tests and CLI metadata
  smoke test; new tests extend those seams upward rather than replacing them.

## Risks / Trade-offs

- [Scoped npm namespace is unavailable to the maintainer] → Verify npm account
  ownership before changing package metadata; choose another explicit scope if
  necessary.
- [Demo content drifts from supported OpenSpec layouts] → Validate the fixture
  with the installed OpenSpec CLI and run it in CI.
- [Hosted demo implies unsupported write behavior] → Display a visible read-only
  indicator and remove mutation actions from the hosted build.
- [Committed media becomes stale or bloats the repository] → Keep one optimized
  hero image and one short animation; regenerate only through the scripted flow.
- [Browser tooling expands development dependencies] → Keep it development-only
  and retain the dependency-free runtime package.
- [Branch protection blocks emergency maintenance] → Configure and document a
  narrow maintainer bypass before enforcement.
- [Release automation publishes a bad version] → Require tag/version agreement,
  full artifact smoke tests, protected environments, and npm provenance.
- [Large umbrella change becomes difficult to land] → Implement in independently
  verifiable phases and keep incomplete hosted/release features disabled.

## Migration Plan

1. Add the deterministic fixture, public-seam test harness, and demo-mode
   foundations without changing normal CLI behavior.
2. Produce visual assets and update positioning, metadata, comparison material,
   topics, and homepage.
3. Confirm npm scope ownership, change package identity, validate installation,
   and publish the first scoped release.
4. Deploy the read-only demo and set it as the repository homepage.
5. Enable the GitHub ruleset and security features after CI checks are visible.
6. Publish the roadmap, curated issues, and grouped dependency policy; resolve
   superseded bot PRs.

Rollback is phase-specific: remove demo routing without affecting normal mode,
disable Pages without removing the local demo, disable the release workflow
before another tag, or relax the ruleset through the documented maintainer
bypass. Published npm versions and GitHub releases are immutable records and
will be corrected with a new version rather than silently replaced.

## Open Questions

- Confirm that the maintainer controls the `warsclon` npm scope or select the
  final publishable scope before package metadata changes.
- Choose whether the hosted demo uses GitHub Pages or another static host after
  validating path routing and cache behavior.
- Choose the final social-preview composition after reviewing generated options.
- Define the initial supported OpenSpec version range from compatibility tests.
