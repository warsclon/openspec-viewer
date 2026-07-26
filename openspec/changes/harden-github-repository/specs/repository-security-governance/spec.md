## ADDED Requirements

### Requirement: Dependency risk is continuously monitored

The repository SHALL enable GitHub's dependency graph, vulnerability alerts,
and Dependabot security updates. Routine npm and GitHub Actions patch/minor
updates SHALL be grouped by ecosystem, while semver-major updates SHALL remain
independent and SHALL NOT be automatically merged.

#### Scenario: Compatible routine updates are available

- **WHEN** Dependabot detects multiple compatible patch or minor updates in one
  configured ecosystem
- **THEN** it opens a grouped pull request that runs the complete required CI
  and security checks

#### Scenario: A major update is available

- **WHEN** Dependabot detects a semver-major dependency or action update
- **THEN** it opens or retains an independent pull request for explicit
  compatibility review

#### Scenario: A major update is rejected

- **WHEN** a major update fails required checks or exceeds the supported Node.js
  or toolchain compatibility matrix
- **THEN** the pull request is closed with the evidence and revisit trigger, and
  Dependabot suppresses equivalent major proposals until that trigger changes

#### Scenario: A vulnerable dependency is detected

- **WHEN** GitHub identifies a dependency vulnerability affecting the default
  branch
- **THEN** the maintainer receives an alert and Dependabot security updates may
  propose a remediation without waiting for the routine schedule

### Requirement: Secrets are blocked and reported

The repository SHALL enable secret scanning and push protection for contributors
where GitHub supports them. Supported non-provider patterns and validity checks
SHALL also be enabled. No verification procedure SHALL commit a real or
plausibly valid credential.

#### Scenario: A supported secret is pushed

- **WHEN** a contributor attempts to push a commit containing a supported secret
  pattern
- **THEN** GitHub blocks the push or produces the expected security alert before
  the value can be merged into `main`

#### Scenario: A security feature is unavailable

- **WHEN** the current GitHub plan or repository type does not expose a requested
  scanning option
- **THEN** the audit records the feature as unavailable and preserves every
  available equivalent control

### Requirement: Code and dependency changes receive security analysis

The repository SHALL run CodeQL analysis for JavaScript and TypeScript and SHALL
review dependency changes on pull requests. Security workflows SHALL use
least-privilege permissions and SHALL NOT expose repository secrets to untrusted
pull-request code.

#### Scenario: A code pull request is opened

- **WHEN** a pull request changes JavaScript or TypeScript source
- **THEN** CodeQL and the supported Node.js CI matrix report a required result
  before merge

#### Scenario: A dependency manifest changes

- **WHEN** a pull request changes `package.json`, `package-lock.json`, or a
  workflow action reference
- **THEN** dependency review reports newly introduced vulnerable dependencies
  and blocks the merge at the configured severity threshold

### Requirement: Workflow dependencies and permissions are constrained

Every reusable GitHub Action SHALL be pinned to a reviewed full commit digest
with a human-readable version comment. Default workflow permissions SHALL
remain read-only, and every workflow SHALL declare the smallest permissions it
needs.

#### Scenario: A workflow dependency is added or updated

- **WHEN** a pull request changes an action reference
- **THEN** the reference identifies a full commit digest, its source and release
  are reviewable, and Dependabot can propose future digest updates

#### Scenario: An untrusted pull request runs

- **WHEN** Actions executes code from an external contribution
- **THEN** the workflow has no repository secret and cannot write repository
  content or approve a pull request

### Requirement: The default branch is governed by an active ruleset

The default branch SHALL reject deletion, force pushes, and direct changes that
bypass the pull-request path. Merge SHALL require the registered CI and security
checks, an up-to-date branch, and resolution of review conversations.

#### Scenario: A direct or non-fast-forward update targets main

- **WHEN** an actor without the documented emergency bypass attempts a direct
  push, deletion, or force push to `main`
- **THEN** GitHub rejects the operation

#### Scenario: A pull request has failing or missing checks

- **WHEN** any required CI, CodeQL, or applicable dependency-review check is not
  successful
- **THEN** GitHub prevents the pull request from merging

#### Scenario: The project gains another active maintainer

- **WHEN** a second maintainer is granted sustained review responsibility
- **THEN** the ruleset review requirement is reassessed and raised to at least
  one approval unless a documented constraint prevents it

### Requirement: Repository access remains least privilege

The maintainer SHALL periodically review collaborators, deploy keys, webhooks,
Actions secrets and variables, environments, and installed GitHub Apps. Access
without a current documented purpose SHALL be removed.

Installed GitHub Apps SHALL use repository-selected access by default and SHALL
be granted only the repositories required for their current purpose.
Account-wide access MAY be retained only as an optional, explicitly documented
exception with a current necessity, accountable owner, and review date; it
SHALL NOT be a baseline requirement for contributing to or maintaining this
repository.

#### Scenario: Repository access is audited

- **WHEN** the hardening change is completed or a scheduled security review
  occurs
- **THEN** every write-capable integration and identity has a documented
  purpose, minimum required permission, and accountable owner

#### Scenario: A GitHub App is retained

- **WHEN** a maintainer retains a GitHub App used with this repository
- **THEN** the installation uses only selected repositories unless a current
  account-wide exception is privately documented and approved

#### Scenario: An OAuth authorization is retained

- **WHEN** a maintainer reviews an authorized OAuth application
- **THEN** its current purpose, requested scopes, accountable owner, and review
  date are recorded privately, and the authorization is revoked when its
  purpose or required scopes cannot be justified

### Requirement: Security posture is repeatably verifiable

The repository SHALL contain a non-sensitive verification procedure covering
file-backed configuration, GitHub API state, and representative behavioral
tests. Completion evidence SHALL identify the date and result of each control
without recording tokens, secret values, or private account data.

#### Scenario: A maintainer verifies repository hardening

- **WHEN** the documented audit is run with authorized GitHub access
- **THEN** it reports Dependabot, alerts, scanning, Actions permissions,
  rulesets, required checks, access surfaces, and private vulnerability
  reporting as enabled, unavailable, or failing

#### Scenario: The repository is cloned externally

- **WHEN** a clean clone of the default branch is scanned
- **THEN** it contains no credentials, local notes, generated build output, or
  private fixture data and its documented validation commands pass
