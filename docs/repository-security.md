# Repository security

This document defines the expected GitHub security posture for
`warsclon/openspec-viewer`, the safe verification procedure, and the recovery
path for the single-maintainer operating model. It records statuses and public
evidence only. Do not add tokens, secret values, private integration URLs,
account identifiers, or private advisory details.

## Rollout state

The repository intentionally remains private while the hardening work is being
implemented. Controls that GitHub exposes only to public repositories or paid
private repositories remain pending until the final visibility transition.
Making the repository public is a separate, explicit maintainer action; it is
not performed by the audit procedure.

Baseline captured on 2026-07-26:

| Control | Baseline | Required public state |
| --- | --- | --- |
| Visibility | Private during implementation | Public after final maintainer confirmation |
| Default branch | `main` | `main` |
| Dependency graph | Not reported through the private-repository API response | Enabled and indexing `package.json` and `package-lock.json` |
| Dependabot vulnerability alerts | Disabled | Enabled |
| Dependabot security updates | Disabled | Enabled |
| Secret scanning | Unavailable on the current private-repository plan | Enabled across reachable history |
| Push protection | Unavailable on the current private-repository plan | Enabled for contributors |
| Non-provider patterns and validity checks | Unavailable on the current private-repository plan | Enabled where the public-repository plan exposes them |
| CodeQL default setup | Not configured; unavailable on the current private-repository plan | JavaScript and TypeScript analysis enabled |
| Default-branch ruleset | Unavailable on the current private-repository plan | Active for `main` |
| Classic branch protection | Unavailable on the current private-repository plan | Superseded by the active `main` ruleset |
| Private vulnerability reporting | Unavailable while the repository is private | Enabled |
| Actions policy | All actions allowed | GitHub-owned actions plus explicitly reviewed pinned actions only |
| Default workflow token | Read-only; cannot approve pull-request reviews | Same |

Controls enabled and re-queried during the private implementation on
2026-07-26:

- The dependency graph returned an SPDX 2.3 SBOM with 214 indexed packages.
- Dependabot vulnerability alerts returned the enabled response.
- Dependabot security updates reported `enabled: true` and `paused: false`.
- Actions reported `allowed_actions: selected`, GitHub-owned actions allowed,
  verified marketplace actions disallowed, and no additional allowed patterns.
- Default workflow permissions remained read-only and Actions remained unable
  to approve pull-request reviews.
- After the Dependabot policy reached `main`, GitHub rendered Dependabot version
  updates as configured and linked to the merged configuration. The file-backed
  npm and GitHub Actions entries had already passed local YAML parsing.

File-backed validation on 2026-07-26 completed with zero npm audit
vulnerabilities, a clean typecheck, 106 passing Vitest tests, a successful
build, successful CLI help and version smoke checks, and valid repository plus
fixture OpenSpec artifacts.

Gitleaks 8.30.1 completed a redacted scan of the working tree and all 29
reachable commits on 2026-07-26. Both scans reported no leaks.

A clean single-branch clone of `main` at
`55bdd192180b4d129dd8d4ff58f5ed7a9a7f0393` was inspected on 2026-07-26. It
contained no tracked `.env`, `dist`, `node_modules`, coverage, Playwright
output, `.openspec-viewer`, credential, or private-key paths. Focused content
searches found no personal machine paths or private fixture data, and Gitleaks
reported no leaks in either the clean tree or its reachable history. The
temporary clone was removed after verification.

The five stable CI check names observed before ruleset configuration are:

- `quality (Node 20)`
- `quality (Node 22)`
- `browser (Chromium)`
- `package smoke (Node 20)`
- `package smoke (Node 22)`

The security check names must be copied from successful GitHub runs after
CodeQL and dependency review are enabled. Never reconstruct a required-check
name from a workflow filename.

## Access and integration inventory

Inventory captured through the GitHub API on 2026-07-26:

| Surface | Safe result | Required action |
| --- | --- | --- |
| Direct collaborators | Repository owner only, with the required administrative role | Retain; reassess if another maintainer is added |
| Teams | None | None |
| Deploy keys | None | None |
| Webhooks | None | None |
| Actions secrets | None | Keep ordinary CI secret-free |
| Actions variables | None | Add only a documented, non-sensitive value when required |
| Environments | None | Create a protected release environment only with an approved release design |
| GitHub Apps | API inventory unavailable to the current OAuth token | Review manually before public launch |
| OAuth integrations | No repository-scoped API inventory is available | Review the maintainer account authorization page before public launch |

Do not retain an identity or integration without a current owner, purpose, and
minimum required permission. A future release environment must isolate package
publication authority from ordinary CI and must use trusted publishing rather
than a long-lived npm token.

## Dependency update policy

Dependabot checks npm and GitHub Actions monthly at 06:00 in the
`Europe/Madrid` timezone. It applies existing repository labels and limits each
ecosystem to five open version-update pull requests.

- Compatible npm development-dependency patch and minor updates are grouped.
- Compatible GitHub Actions patch and minor updates are grouped.
- Major updates remain independent for compatibility review.
- `@types/node` major updates remain ignored while the supported runtime matrix
  is Node.js 20 and 22.
- TypeScript major updates remain ignored until an explicit compiler-migration
  OpenSpec change exists.
- Security updates remain independent of the monthly version-update schedule.
- Dependabot pull requests are never auto-merged. They must pass the complete
  required CI and security matrix and receive an explicit maintainer decision.

Major-update backlog decisions completed on 2026-07-26:

- PR #3 (`@types/node` 26) was closed because Node.js 26 is outside the
  supported Node.js 20/22 runtime matrix. Revisit when the matrix changes.
- PR #4 (TypeScript 7) was closed after both matrix jobs failed typecheck.
  Revisit through an explicit compiler-migration OpenSpec change.
- PRs #1, #2, and #5 were previously superseded by the reviewed pinned Actions
  upgrades and coordinated Vitest 4 test-foundation work.

The dependency-review workflow rejects newly introduced vulnerabilities of
moderate, high, or critical severity in runtime or development dependencies. It
uses only `contents: read`, does not check out pull-request code, and does not
receive repository secrets. The job is skipped while the repository is
intentionally private because GitHub does not provide dependency review on the
current private-repository plan; the same workflow begins enforcing the policy
automatically when the repository becomes public.

## Workflow policy

Every reusable action must:

1. Come from GitHub or have a documented third-party justification.
2. Use a reviewed full commit SHA with a trailing release comment.
3. Run with the smallest explicit permissions required.
4. Avoid `pull_request_target` for untrusted code.
5. Avoid repository secrets and write permissions on pull requests.

Default workflow permissions remain read-only, and GitHub Actions must not be
allowed to create or approve pull-request reviews. Release authority belongs
only in a separately reviewed publishing job and protected environment.

## Maintainer recovery

Normal changes always reach `main` through a pull request. The repository owner
is the only recovery actor while the project has one maintainer. Workflows,
GitHub Apps, deploy keys, and ordinary collaborators must not receive a ruleset
bypass.

If a required check is renamed, unavailable, or persistently broken:

1. Confirm the failure on a pull request and preserve the run URL and exact
   check name.
2. Prefer repairing the workflow or updating only the misidentified check.
3. If the ruleset itself prevents recovery, use the repository-owner bypass
   only for the smallest settings correction. Do not use it to merge unverified
   application code.
4. Open a follow-up issue recording the reason, actor role, affected rule,
   start and end time, evidence URL, and restoration result. Never include
   tokens, private advisory details, or secret values.
5. Restore the normal ruleset immediately and verify it with a new pull request.

Disabling the entire ruleset is the last resort. Secret scanning or push
protection must never be disabled merely to land a change.

When a second active maintainer is added, require at least one approving review
and replace the single-owner recovery assumption with named operational
ownership.

## Read-only audit procedure

Requirements:

- GitHub CLI authenticated with repository administration access
- `jq` support provided by `gh api --jq`
- no shell tracing and no token printed to logs

Run these commands from any trusted directory:

```bash
gh api repos/warsclon/openspec-viewer \
  --jq '{visibility,default_branch,security_and_analysis}'

gh api repos/warsclon/openspec-viewer/actions/permissions \
  --jq '{enabled,allowed_actions}'

gh api repos/warsclon/openspec-viewer/actions/permissions/selected-actions \
  --jq '{github_owned_allowed,verified_allowed,patterns_allowed}'

gh api repos/warsclon/openspec-viewer/actions/permissions/workflow \
  --jq '{default_workflow_permissions,can_approve_pull_request_reviews}'

gh api repos/warsclon/openspec-viewer/rulesets \
  --jq '[.[] | {id,name,enforcement,target}]'

# Repeat for every ruleset ID returned above.
gh api repos/warsclon/openspec-viewer/rulesets/REPLACE_WITH_RULESET_ID \
  --jq '{name,enforcement,target,bypass_actors,rules}'

gh api repos/warsclon/openspec-viewer/branches/main/protection \
  --jq '{required_status_checks,required_pull_request_reviews,required_linear_history,allow_force_pushes,allow_deletions}'

gh api repos/warsclon/openspec-viewer/code-scanning/default-setup \
  --jq '{state,languages,query_suite}'

gh api repos/warsclon/openspec-viewer/dependency-graph/sbom \
  --jq '{format:.sbom.spdxVersion,name:.sbom.name,packages:(.sbom.packages | length)}'

gh api repos/warsclon/openspec-viewer/private-vulnerability-reporting \
  --jq '{enabled}'

gh api repos/warsclon/openspec-viewer/collaborators \
  --jq '[.[] | {login,role_name}]'

gh api repos/warsclon/openspec-viewer/teams \
  --jq '[.[] | {name,permission}]'

gh api repos/warsclon/openspec-viewer/keys \
  --jq '[.[] | {title,read_only}]'

gh api repos/warsclon/openspec-viewer/hooks \
  --jq '[.[] | {name,active,events}]'

gh api repos/warsclon/openspec-viewer/actions/secrets \
  --jq '{total_count,names:[.secrets[].name]}'

gh api repos/warsclon/openspec-viewer/actions/variables \
  --jq '{total_count,names:[.variables[].name]}'

gh api repos/warsclon/openspec-viewer/environments \
  --jq '{total_count,names:[.environments[].name]}'
```

The vulnerability-alert endpoint returns success with an empty body when
alerts are enabled:

```bash
gh api --silent repos/warsclon/openspec-viewer/vulnerability-alerts
```

Dependabot security updates report an explicit boolean:

```bash
gh api repos/warsclon/openspec-viewer/automated-security-fixes \
  --jq '{enabled,paused}'
```

GitHub App and OAuth authorization review remains a manual account-level check
because the current OAuth token cannot enumerate those installations. Record
only the review date and outcome, not installation IDs or unrelated account
access.

An unavailable endpoint is evidence only when its HTTP result is recorded with
the repository visibility and plan limitation. It must not be converted into an
enabled or passing status.

## Enforcement verification

After the repository becomes public:

1. Confirm dependency graph, alerts, security updates, secret scanning, push
   protection, non-provider patterns, validity checks, CodeQL, and private
   reporting through the API and repository Security settings.
2. Record the exact successful CodeQL and dependency-review check names.
3. Create the `main` ruleset from observed check names.
4. Verify a harmless direct push and a deliberately failing pull request cannot
   update `main`.
5. Verify a fully green representative pull request can merge normally.
6. Test push protection only with GitHub's documented harmless test value on a
   disposable branch, then remove the local commit and branch.
7. Run a maintained secret scanner over the working tree and reachable Git
   history.
8. Validate a clean clone of the default branch.

The final verification section must record the date, result, and non-sensitive
evidence URL for every control before this OpenSpec change is archived.
