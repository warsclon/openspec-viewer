## Why

The repository is public and already has CI, a security policy, private
vulnerability reporting, and a basic Dependabot schedule. However, GitHub
currently reports secret scanning, push protection, dependency security
updates, code scanning, and default-branch protection as disabled. The existing
Dependabot configuration also creates independent pull requests without an
explicit grouping or major-update policy.

These gaps do not indicate a current credential leak or known vulnerable
dependency, but they reduce the repository's ability to prevent the next
accidental secret, compromised dependency, unsafe workflow change, or force
push. Security controls must be configured before repository activity and
release automation grow.

## What Changes

- Replace the basic Dependabot schedule with a documented policy that groups
  compatible patch and minor updates while keeping major upgrades isolated.
- Resolve the five existing major-update pull requests explicitly: supersede
  the two GitHub Actions PRs with SHA-pinned v7 references, reject the
  incompatible Node 26 types and failing TypeScript 7 upgrades, and coordinate
  Vitest 4 with the matching coverage provider in `establish-test-foundation`.
- Enable the GitHub dependency graph, vulnerability alerts, and Dependabot
  security updates.
- Enable secret scanning, push protection, non-provider patterns, and validity
  checks wherever the repository plan supports them.
- Enable CodeQL analysis for JavaScript and TypeScript and add pull-request
  dependency review.
- Pin GitHub Actions to reviewed commit digests and retain least-privilege
  workflow permissions.
- Create an active default-branch ruleset that requires pull requests and
  successful security and CI checks while blocking deletion and force pushes.
- Audit collaborators, deploy keys, webhooks, Actions secrets, environments,
  and installed GitHub Apps for unnecessary access.
- Add a repeatable, non-secret-bearing verification procedure and record the
  final externally managed settings.

## Capabilities

### New Capabilities

- `repository-security-governance`: Preventive and detective controls for
  dependencies, secrets, workflow execution, code scanning, access, and
  default-branch governance.

### Modified Capabilities

None. The repository does not yet contain an archived security-governance
capability specification.

## Impact

- Changes `.github/dependabot.yml` and GitHub Actions workflow references.
- Closes or supersedes Dependabot PRs #1 through #5 only after the replacement
  decision has been implemented and verified against the current `main`.
- May add dependency-review and repository-security audit automation.
- Changes externally managed settings under GitHub Security, Actions, Rules,
  Branches, Collaborators, Webhooks, Deploy keys, Environments, and Apps.
- Changes how updates and contributions reach `main`; emergency access must be
  documented before enforcement.
- Refines the repository-trust work already identified by
  `prepare-public-launch`; this focused change is the implementation source of
  truth for GitHub security configuration.

## Non-Goals

- Fixing application-level localhost, CSRF, Markdown, or filesystem security
  findings.
- Publishing the npm package or configuring npm trusted publishing.
- Requiring paid GitHub Enterprise features.
- Adding a second dependency-update service alongside Dependabot.
- Requiring signed commits or multiple approving maintainers while the project
  has a single-maintainer operating model.
- Storing credentials, personal access tokens, or example secrets in the
  repository.
