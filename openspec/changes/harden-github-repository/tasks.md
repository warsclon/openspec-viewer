## 1. Baseline and Recovery

- [x] 1.1 Capture the current repository visibility, default branch, security
  feature statuses, Actions policy, workflow permissions, rulesets, branch
  protection, and private vulnerability reporting through `gh api`
- [x] 1.2 Record the exact successful check names produced by the Node.js 20 and
  22 CI matrix so the ruleset does not depend on guessed names
- [x] 1.3 Inventory current collaborators, teams, deploy keys, webhooks, Actions
  secrets and variables, environments, and installed GitHub Apps without
  printing secret values
- [x] 1.4 Define the maintainer recovery procedure for a broken required check or
  ruleset, including who may bypass it and how each bypass will be recorded
- [x] 1.5 Record the baseline and expected final state in a versioned
  `docs/repository-security.md` checklist without account IDs, tokens, or private
  metadata
- [x] 1.6 Complete `establish-test-foundation` and observe its stable CI check
  names on GitHub before configuring required checks or the `main` ruleset

## 2. Dependabot Policy

- [x] 2.1 Update `.github/dependabot.yml` to retain the npm and GitHub Actions
  ecosystems with an explicit timezone, review cadence, labels, and bounded
  open-pull-request limit
- [x] 2.2 Group compatible npm development-dependency patch and minor updates
  into one maintenance pull request
- [x] 2.3 Group compatible GitHub Actions patch and minor updates into one
  maintenance pull request
- [x] 2.4 Keep npm and GitHub Actions major updates outside those groups so each
  receives an isolated compatibility review
- [x] 2.5 Document that Dependabot pull requests are never auto-merged and must
  pass the complete required CI and security matrix
- [x] 2.6 Validate the YAML structure locally and confirm GitHub accepts both
  update configurations on the repository dependency graph page
- [x] 2.7 Record the security and compatibility decision for Dependabot PRs #1
  through #5 in `design.md`
- [x] 2.8 After `establish-test-foundation` replaces `actions/setup-node`, verify
  its current-base CI and close PR #1 as superseded
- [x] 2.9 After `establish-test-foundation` replaces `actions/checkout`, verify
  its current-base CI and close PR #2 as superseded
- [x] 2.10 Close PR #3 with the supported Node.js 20/22 type-matrix reason and
  ignore incompatible `@types/node` majors until that matrix changes
- [x] 2.11 Close PR #4 with its observed TypeScript 7 typecheck failure and
  ignore TypeScript majors until an explicit compiler-migration change exists
- [x] 2.12 Resolve PR #5 from `establish-test-foundation`: adopt Vitest 4 only
  with the matching coverage provider and green Node.js 20/22 checks, then close
  the original PR as superseded; otherwise close it with the compatibility
  blocker and retain the matched Vitest 3 toolchain

## 3. Dependency and Secret Protection

- [x] 3.1 Enable the GitHub dependency graph and verify the npm manifest and
  lockfile are indexed
- [x] 3.2 Enable Dependabot vulnerability alerts and confirm the repository
  security overview reports the feature as active
- [x] 3.3 Enable Dependabot security updates and verify they are not constrained
  by the routine monthly version-update schedule
- [x] 3.4 Enable secret scanning for the public repository and confirm scans
  cover the full reachable Git history
- [ ] 3.5 Enable push protection for contributors and confirm bypass requests
  are visible to the maintainer
- [x] 3.6 Enable non-provider secret patterns and validity checks where the
  current GitHub plan exposes them; record unsupported controls explicitly
- [x] 3.7 Verify private vulnerability reporting remains enabled and that
  `.github/ISSUE_TEMPLATE/config.yml` and `SECURITY.md` route reports to the
  private advisory form
- [ ] 3.8 Test push protection in a disposable branch using only a
  GitHub-documented harmless test value, confirm the push is blocked, and remove
  the local test commit

## 4. Code and Workflow Security

- [x] 4.1 Enable CodeQL default setup for JavaScript and TypeScript on pushes and
  pull requests to the default branch
- [x] 4.2 Let the initial CodeQL analysis finish and record its exact check name
  and successful result before adding it to the ruleset
- [x] 4.3 Add a dependency-review workflow for pull requests that fails when a
  dependency change introduces a vulnerability at the agreed severity threshold
- [x] 4.4 Give the dependency-review workflow only `contents: read` permission
  unless a separately justified permission is required
- [x] 4.5 Verify the CI replacements from `establish-test-foundation` use
  reviewed v7 full commit SHAs plus release comments, and require the same
  format for every new reusable action reference
- [x] 4.6 Configure repository Actions policy to allow GitHub-owned actions and
  only explicitly reviewed third-party actions; reject mutable unreviewed
  actions
- [x] 4.7 Verify default workflow token permissions remain read-only and
  GitHub Actions cannot create or approve pull-request reviews
- [x] 4.8 Verify pull-request workflows do not use `pull_request_target`, expose
  repository secrets, or grant write permissions to code from forks
- [x] 4.9 Run CI, CodeQL, and dependency review on a representative pull request
  and retain links to the successful checks in the security checklist

## 5. Default-Branch Ruleset

- [x] 5.1 Create an active ruleset targeting the repository default branch
- [x] 5.2 Require changes to reach `main` through a pull request and require all
  review conversations to be resolved
- [x] 5.3 Set required approvals to zero for the current single-maintainer model
  and record the trigger for raising it to one when a second active maintainer
  exists
- [x] 5.4 Require the observed Node.js 20, Node.js 22, and CodeQL status checks,
  plus dependency review when GitHub exposes it as an always-applicable check
- [x] 5.5 Require branches to be up to date before merge and enable linear
  history if it remains compatible with the selected merge strategies
- [x] 5.6 Block branch deletion and non-fast-forward updates, including force
  pushes
- [x] 5.7 Configure only the documented maintainer recovery bypass and confirm
  workflows, GitHub Apps, and ordinary collaborators cannot use it
- [x] 5.8 Attempt a harmless direct update to `main` and a pull request with a
  deliberately failing check, confirming GitHub blocks both paths
- [ ] 5.9 Merge a fully green representative pull request through the normal
  path and confirm the ruleset permits it without using the bypass

## 6. Access and Integration Audit

- [x] 6.1 Remove stale collaborators and reduce remaining roles to the minimum
  repository permission required for their documented responsibility
- [x] 6.2 Remove unused deploy keys and ensure any retained write-capable key has
  a current owner and explicit purpose
- [x] 6.3 Remove unused webhooks and verify retained webhook URLs, event scopes,
  TLS verification, and secret rotation ownership
- [x] 6.4 Remove unused Actions secrets and variables, scope retained values to
  the smallest environment, and document their rotation owner without recording
  their values
- [ ] 6.5 Review installed GitHub Apps and OAuth integrations and remove or
  reduce any repository access that is broader than their current purpose
- [x] 6.6 Protect any future release environment with the minimum deployment
  permissions and keep package publication credentials out of ordinary CI

## 7. Verification and Closeout

- [x] 7.1 Add a read-only audit command or documented `gh api` procedure that
  reports each expected repository setting without leaking authentication data
- [x] 7.2 Run `npm audit`, typecheck, unit tests, build, and CLI smoke checks
  after all file-backed security changes
- [x] 7.3 Run a high-confidence secret scan over the working tree and complete
  reachable Git history using Gitleaks or an equivalent maintained scanner
- [x] 7.4 Clone the default branch into a clean temporary directory and confirm
  it excludes `.env` files, local notes, generated `dist`, credentials, and
  non-public fixture data
- [ ] 7.5 Re-query GitHub and confirm dependency alerts and updates, secret
  protection, CodeQL, Actions permissions, private reporting, and the `main`
  ruleset match the expected state
- [ ] 7.6 Update `docs/repository-security.md` with the verification date,
  control result, unsupported-feature notes, and links to non-sensitive GitHub
  evidence
- [x] 7.7 Cross-reference this change from `prepare-public-launch` as the source
  of truth for repository hardening and remove duplicated operational tasks
- [x] 7.8 Run `openspec validate harden-github-repository --strict` and resolve
  every validation error before implementation begins
