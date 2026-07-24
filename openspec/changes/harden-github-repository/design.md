## Context

`warsclon/openspec-viewer` is a public, single-maintainer TypeScript repository.
It runs CI on Node.js 20 and 22 with a read-only workflow token. It includes a
security policy, private vulnerability reporting, and monthly Dependabot checks
for npm and GitHub Actions. GitHub repository inspection on 2026-07-23 showed
that security scanning, dependency security updates, code scanning, branch
protection, and rulesets were not active.

The implementation spans versioned files and settings that exist only in
GitHub. The change therefore needs an auditable order of operations and
post-configuration evidence rather than treating a committed YAML file as proof
that the control is active.

## Goals / Non-Goals

**Goals:**

- Prevent accidental secret publication before it reaches `main`.
- Detect vulnerable dependencies and insecure JavaScript or TypeScript changes.
- Keep routine dependency maintenance useful without flooding repository
  activity.
- Prevent accidental direct pushes, deletion, and history rewrites on `main`.
- Keep Actions and repository access at least privilege.
- Make every external setting independently verifiable.
- Preserve an emergency recovery path suitable for one maintainer.

**Non-Goals:**

- Solve application runtime vulnerabilities.
- Introduce paid controls as hard requirements.
- Automate dependency merging.
- Grant write permissions to untrusted pull-request workflows.
- Require approvals that make a single maintainer unable to merge.

## Decisions

### 1. Separate file-backed policy from externally managed enforcement

Dependabot policy, workflow definitions, security documentation, and audit
helpers live in Git. Secret scanning, repository rulesets, Actions policy,
alerts, default setup, access grants, and private reporting remain GitHub
settings. A versioned verification document will record expected values and the
date they were last checked without storing account identifiers or secrets.

### 2. Group compatible maintenance but isolate major upgrades

npm development dependencies and GitHub Actions will each have a patch/minor
group. Semver-major updates remain separate pull requests because they require
explicit compatibility review. Dependabot security updates remain eligible to
open immediately and must not wait for the routine monthly maintenance window.
Automatic merge is out of scope.

### 3. Use GitHub-native security analysis first

CodeQL default setup will analyze JavaScript and TypeScript. Pull requests that
modify dependency manifests or lockfiles will also run GitHub's dependency
review. This avoids adding runtime dependencies or long-lived service tokens.
Additional scanners can be proposed later if the native controls leave a
demonstrated gap.

### 4. Pin every reusable action to a reviewed commit

Workflow action references will use full commit digests with a trailing release
comment for readability. Dependabot will continue proposing action updates.
GitHub-owned actions are preferred; any future third-party action requires a
documented reason, reviewed source, minimal permissions, and a pinned digest.

### 5. Protect `main` without deadlocking a single maintainer

The default-branch ruleset will require a pull request, successful Node.js 20
and 22 CI jobs, successful CodeQL analysis, dependency review when applicable,
and resolved review conversations. It will require a current branch before
merge and block deletion and non-fast-forward updates.

The initial approval count will be zero because the repository currently has
one maintainer. This still prevents direct pushes and lets the maintainer review
the complete pull-request diff and checks before merging. The approval
requirement will be raised when a second active maintainer exists.

A narrowly scoped, documented maintainer bypass will be used only for recovery.
It must not be available to GitHub Apps, ordinary collaborators, or workflow
tokens.

### 6. Keep workflow authority minimal

Default workflow permissions remain read-only and Actions cannot approve pull
requests. Each workflow declares its permissions explicitly. Pull-request
workflows receive no repository secrets and no write permission. A future
release workflow must request its additional permission only at the publishing
job or protected environment boundary.

### 7. Verify controls from both API state and behavior

The change is complete only when GitHub reports the expected settings and a
representative pull request proves the ruleset and checks are enforced. Secret
push protection will be tested only with a GitHub-documented harmless test
value in a disposable branch; no real or plausibly valid credential will be
created.

## Rollout Order

1. Capture the current settings and successful CI check names.
2. Update Dependabot and pin existing action references.
3. Enable dependency, secret, and code-scanning controls.
4. Let all required checks complete successfully at least once.
5. Create the `main` ruleset using the observed check names.
6. Exercise the ruleset and push protection with safe test cases.
7. Audit repository access and record final evidence.

This order avoids creating a ruleset that requires a check GitHub has not yet
registered and therefore cannot satisfy.

## Risks / Trade-offs

- [Ruleset locks out normal maintenance] → Observe exact check names first,
  retain a narrow recovery bypass, and test with a disposable pull request.
- [Dependabot creates excessive noise] → Group patch/minor updates by ecosystem,
  cap open pull requests, and leave majors isolated.
- [Grouped updates hide the failing dependency] → Require the full CI matrix and
  split the group when diagnosis is needed.
- [Mutable Actions dependency is compromised] → Pin reviewed digests and let
  Dependabot propose digest changes.
- [Security feature is unavailable on the current plan] → Record it as
  unavailable with GitHub's reported reason; do not silently mark the task done.
- [Single maintainer bypass becomes routine] → Record every use in a follow-up
  issue and return enforcement to the normal pull-request path immediately.
- [Security checks receive excess authority] → Declare permissions per workflow
  and reject secrets or write permissions on untrusted pull requests.

## Rollback

- Disable the ruleset temporarily through the documented maintainer recovery
  path if required checks are misidentified or unavailable.
- Revert Dependabot grouping independently if grouped upgrades repeatedly
  prevent diagnosis.
- Disable a newly introduced workflow if it produces false positives, while
  preserving alerts and filing a follow-up with the observed evidence.
- Never disable secret scanning or push protection merely to land a change;
  remove or rotate the affected credential and clean the commit instead.
