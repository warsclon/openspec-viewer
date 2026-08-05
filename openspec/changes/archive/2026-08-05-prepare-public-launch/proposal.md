## Why

The repository is technically ready for public use, but a new visitor still has
to read extensively and build from source before seeing the product's value.
The public launch needs visual proof, one-command installation, a safe demo,
stronger trust signals, and an intentional contributor path so that discovery
turns into adoption and participation.

## What Changes

- Reposition the product as a browser workspace for OpenSpec rather than a
  passive viewer, with outcome-focused GitHub metadata and comparison material.
- Add a deterministic visual launch kit: hero screenshot, short workflow
  recording, social preview, and reproducible capture process.
- Publish the CLI under the available scoped npm identity
  `@warsclon/openspec-viewer` while retaining the `openspec-viewer` executable.
- Create a versioned GitHub release and an automated, provenance-enabled release
  path that validates the exact package before publication.
- Add a safe `--demo` experience backed by a deterministic sample project, plus
  a read-only hosted demo where practical.
- Expand verification at public seams: installed CLI, local HTTP API, browser
  workflow, generated launch media, and release artifact.
- Strengthen GitHub trust settings with protected `main`, security scanning,
  push protection, dependency security updates, and constrained automation.
- Publish a small product roadmap and curated contributor issues, and group
  dependency updates to avoid bot-dominated repository activity.

## User Stories

1. As a first-time visitor, I want to understand the product in a few seconds,
   so that I can decide whether it fits my OpenSpec workflow.
2. As a prospective user, I want to see the real interface before installing,
   so that I can trust the feature claims.
3. As an OpenSpec user, I want a clear comparison with `openspec view`, so that
   I understand when the browser workspace is useful.
4. As a CLI user, I want one-command execution, so that I can try the product
   without cloning or linking a repository.
5. As a package consumer, I want an unambiguous package identity, so that I do
   not install a different project with the same unscoped name.
6. As a security-conscious user, I want provenance and a versioned release, so
   that I can verify what I install.
7. As an evaluator without an OpenSpec project, I want a demo mode, so that I
   can explore the workflow immediately.
8. As a visitor on a phone or restricted device, I want a hosted read-only demo,
   so that I can inspect the product without running Node.js.
9. As a maintainer, I want visual assets generated from a deterministic fixture,
   so that documentation does not drift from the product.
10. As a maintainer, I want end-to-end tests at public interfaces, so that green
    CI represents a working product rather than isolated parsers.
11. As a contributor, I want a visible roadmap and scoped starter issues, so
    that I can find useful work without reverse-engineering priorities.
12. As a repository visitor, I want meaningful human activity, so that the
    project does not look like an unattended dependency-update feed.
13. As a maintainer, I want protected branches and security scanning, so that a
    public contribution cannot silently weaken the release.
14. As a returning user, I want release notes and compatibility information, so
    that I know what changed and which Node.js and OpenSpec versions are supported.

## Capabilities

### New Capabilities

- `public-project-presentation`: Public positioning, visual launch assets,
  repository metadata, comparison content, and discoverability.
- `package-distribution`: Scoped npm packaging, one-command installation,
  versioned releases, provenance, and release verification.
- `demo-experience`: Deterministic sample project, CLI demo mode, hosted
  read-only experience, and reproducible media capture.
- `repository-trust`: Public-seam test coverage, branch governance, security
  controls, supply-chain safeguards, and compatibility reporting.
- `contributor-experience`: Roadmap, curated issues, dependency update hygiene,
  and contributor entry points.

### Modified Capabilities

None. This repository did not contain archived OpenSpec capability
specifications before this change.

## Impact

- Affects CLI argument handling, package metadata, build and release automation,
  static UI data loading, tests, README content, visual assets, and contributor
  documentation.
- Introduces browser automation and package/release tooling as development-only
  dependencies while preserving the dependency-free runtime.
- Requires externally managed configuration in GitHub repository settings,
  GitHub Pages or an equivalent static host, npm trusted publishing, and the
  scoped npm namespace.
- Supersedes the current one-PR-per-dependency Dependabot presentation with
  grouped updates and a maintainer-defined policy for major upgrades.

## Non-Goals

- Renaming the GitHub repository or replacing the `openspec-viewer` executable.
- Adding authentication, cloud persistence, analytics, or telemetry.
- Turning the hosted demo into a writable multi-user service.
- Committing generated build output or secrets to the repository.
- Guaranteeing compatibility with every historical OpenSpec or Node.js release.
