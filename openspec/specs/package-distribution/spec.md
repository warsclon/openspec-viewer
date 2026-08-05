# package-distribution Specification

## Purpose
TBD - created by archiving change prepare-public-launch. Update Purpose after archive.
## Requirements
### Requirement: Unambiguous package identity
The project SHALL publish under an npm scope controlled by the maintainer and
SHALL continue to expose the `openspec-viewer` executable.

#### Scenario: User selects the documented npm package
- **WHEN** a user follows the installation instructions
- **THEN** the scoped package resolves to this repository and does not conflict with the existing unscoped package

#### Scenario: Existing source user invokes the CLI
- **WHEN** the scoped package is installed or linked
- **THEN** the executable remains available as `openspec-viewer`

### Requirement: One-command evaluation
The project SHALL provide a documented command that installs or executes the
published CLI without requiring a repository clone.

#### Scenario: User tries the package with npx
- **WHEN** a user with a supported Node.js version runs the documented `npx` command
- **THEN** the CLI starts successfully and can open either a supplied OpenSpec project or demo mode

### Requirement: Reproducible package contents
The published package SHALL be built from a clean output directory and SHALL
contain only the runtime files and public documentation declared for
distribution.

#### Scenario: Release candidate is packed
- **WHEN** automation creates the npm tarball
- **THEN** it verifies the file list, executable mode, package version, license, and absence of stale or sensitive files

#### Scenario: Tarball is installed in isolation
- **WHEN** the release candidate is installed into an empty temporary directory
- **THEN** its binary reports the expected version and help output without depending on the source checkout

### Requirement: Verified versioned release
Each public release SHALL use a matching package version and Git tag, SHALL pass
all release checks, SHALL publish npm provenance, and SHALL create GitHub release
notes derived from the changelog.

#### Scenario: Maintainer pushes a valid release tag
- **WHEN** the tag matches the package version and all required checks pass
- **THEN** automation publishes the scoped package and creates the corresponding GitHub Release

#### Scenario: Release checks fail
- **WHEN** any test, artifact inspection, version check, or publish prerequisite fails
- **THEN** no npm package or GitHub Release is published

