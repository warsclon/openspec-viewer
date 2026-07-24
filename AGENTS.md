# Repository guidance

## Product scope

`openspec-viewer` is a local-first browser workspace and CLI for OpenSpec
projects. It discovers an `openspec/` directory, presents changes and
specifications, and can update proposals, designs, tasks, archives, and local
notes through a localhost HTTP API.

Keep the CLI and its static browser UI as the only user-facing product. Do not
turn the project into a hosted multi-user service, cloud persistence layer, or
telemetry platform without an approved OpenSpec change.

All user-facing application text, public documentation, repository metadata,
issues, pull requests, and release notes must be written in English.

## Stack

- Runtime: Node.js 20+, TypeScript, native ESM, and Node.js built-ins.
- Browser UI: dependency-free static HTML, CSS, and JavaScript.
- HTTP layer: the Node.js server in `src/server.ts`, including JSON endpoints
  and Server-Sent Events.
- OpenSpec integration: discovery, parsing, search, graph, mutation, notes, and
  archive behavior under `src/openspec/`.
- Testing: Vitest, with tests under `test/`.
- Tooling: TypeScript, `tsx`, npm, and GitHub Actions on Node.js 20 and 22.

The published runtime must remain dependency-free unless an approved design
documents why a runtime dependency is necessary and how its maintenance and
security costs are controlled.

## Commands

- Install exactly from the lockfile: `npm ci`
- Run in development: `npm run dev -- --path /path/to/project --no-open`
- Type check: `npm run typecheck`
- Unit and integration tests: `npm test`
- Watch tests: `npm run test:watch`
- Build: `npm run build`
- Run the compiled CLI: `npm start -- --path /path/to/project --no-open`
- Full package validation: `npm run prepublishOnly`
- CLI smoke checks:
  - `node dist/cli.js --help`
  - `node dist/cli.js --version`
- Inspect package contents: `npm pack --dry-run`
- Audit npm dependencies: `npm audit`
- Validate all OpenSpec artifacts: `openspec validate --all --strict`
- List active OpenSpec changes: `openspec list --json`

Run commands from the repository root unless a task explicitly says otherwise.
Do not rely on stale generated files in `dist/`; `npm run build` must recreate
the distributable output from source.

## Architecture overview

- **CLI**: `src/cli.ts` parses arguments, discovers the target project, starts
  the server, and optionally opens the browser. The default host is loopback.
- **Server**: `src/server.ts` owns the HTTP and SSE boundary. It serves the
  static UI and exposes read and mutation operations over OpenSpec artifacts.
- **Domain modules**: `src/openspec/` owns filesystem discovery, parsing,
  project summaries, graphs, search, task mutations, notes, spec diffs, and
  file watching. Keep this logic out of HTTP routing and browser rendering.
- **Browser UI**: `src/ui/` renders server responses and emits user intents. It
  must not assume direct filesystem access.
- **Project data**: OpenSpec artifacts remain in the user's selected project.
  Project-specific notes live under `.openspec-viewer/` and must remain local
  and gitignored.
- **Archives**: archived OpenSpec artifacts are read-only. Any exception
  requires an explicit specification and migration design.
- **Packaging**: TypeScript output and copied UI assets form `dist/`. Generated
  output is not committed.

Prefer explicit boundaries between HTTP transport, OpenSpec filesystem logic,
and browser presentation. Tests should target these public seams rather than
private implementation details.

## Mandatory TDD red/green

TDD is required for every production-code behavior change. Before modifying
implementation code:

1. Add or update a focused automated test.
2. Run it and observe the expected behavioral failure (red).
3. Implement the smallest change that makes it pass (green).
4. Run the relevant regression suite.
5. Check off the corresponding OpenSpec task only after verification passes.

A compilation failure caused by a broken test is not valid red evidence. The
failure must demonstrate missing or incorrect behavior. No red, no production
code; no green, no completed task; no tests, no merge.

Prefer tests at these public seams:

- CLI arguments, output, exit behavior, and installed-package execution.
- Real HTTP requests against an isolated temporary OpenSpec project.
- OpenSpec parsing and filesystem mutations.
- Archived read-only enforcement and failed-write integrity.
- Browser-visible behavior for workflows that unit tests cannot represent.
- Package contents and clean installation for distribution changes.

Documentation-only, comment-only, and narrow configuration changes do not need
a synthetic failing test, but they still require focused validation.

## Development workflow (specs first)

Every non-trivial feature, security change, or repository-wide behavior change
follows this pipeline:

1. **Analyze** — read `AGENTS.md`, relevant public documentation,
   `openspec/config.yaml`, current specs under `openspec/specs/`, and related
   active changes.
2. **Spec** — create or update
   `openspec/changes/<change-id>/proposal.md`, `design.md`, capability deltas
   under `specs/`, and `tasks.md`. Validate the change strictly before
   implementation.
3. **Branch** — create a dedicated branch before implementation. Agents use
   `codex/<openspec-change-id>` unless the user or repository workflow specifies
   another convention.
4. **Implement** — work task by task using TDD. Keep `tasks.md` synchronized
   after each verified unit of work.
5. **Review** — run focused checks during development, then the complete
   relevant validation suite and a code review before merge. The pull request
   references the OpenSpec change ID.
6. **Close** — after the implementation is merged and externally managed
   settings are verified, archive the OpenSpec change so its deltas are synced
   into `openspec/specs/`.

Division of truth:

- `openspec/specs/` defines implemented system behavior.
- `openspec/changes/<change-id>/tasks.md` is the progress source of truth for an
  active change.
- GitHub settings are only considered complete after live verification.
- Git history and pull requests record reviewed implementation.
- Do not duplicate active task lists in roadmaps, comments, or ad hoc documents.

Typos, comment-only edits, and narrow documentation fixes may skip a new
OpenSpec change, but they still use a dedicated branch and focused validation.

## No build or type errors in commits

Before every implementation commit, run:

```bash
npm run typecheck
npm test
npm run build
```

Use `npm run prepublishOnly` for changes affecting the CLI, packaging, build,
release behavior, or public installation. Also run `npm pack --dry-run` and
inspect the package manifest for distribution changes.

Run `npm audit` after dependency or lockfile changes. If a failure is
pre-existing or caused by the execution environment, report the evidence
before expanding scope. Never commit known TypeScript errors, failing tests,
stale build output, or unexplained audit regressions.

## Branch discipline

Treat local `main` as read-only for implementation work. Create and switch to a
dedicated branch before editing production code, documentation, repository
configuration, OpenSpec artifacts, or GitHub automation.

Every change reaches `main` through a GitHub pull request after required checks
pass. Do not merge a local branch directly into local `main`. After GitHub
merges a pull request, update local `main` from `origin/main` before creating
the next branch.

Keep unrelated user changes out of commits. Preserve dirty-worktree changes
unless their ownership and purpose are known. Use non-destructive Git commands,
and never rewrite shared history or force-push unless the user explicitly
authorizes the exact operation.

Use concise conventional-style commit subjects, for example:

```text
feat: add read-only demo mode
fix: reject cross-site mutation requests
docs: explain repository security controls
test: cover archived write rejection
```

## Security, privacy, and local-service conventions

- Treat every OpenSpec project and Markdown document as untrusted input.
- Never commit credentials, API keys, `.env` files, real local notes,
  authentication material, or private project fixtures.
- Keep the default server binding on `127.0.0.1`. Exposing the service to a
  non-loopback interface requires an approved security design, explicit user
  intent, authentication, and prominent documentation.
- Protect state-changing HTTP operations against cross-site requests. Validate
  origin and fetch metadata, require an appropriate JSON content type, and use
  a session-bound anti-CSRF mechanism where applicable.
- Enforce bounded request bodies and return `413` for oversized input.
- Validate and allowlist Markdown link schemes before creating clickable URLs.
  Do not render `javascript:` or unsafe `data:` links.
- Escape untrusted text for its exact HTML, attribute, URL, or script context.
- Use `realpath` or equivalent containment checks for filesystem operations.
  Reject traversal and unsafe symlink escapes.
- Do not expose absolute local paths, raw subprocess output, or sensitive error
  details to non-local clients.
- Spawn subprocesses with argument arrays and `shell: false`; never construct a
  shell command from project content.
- Keep archived artifacts read-only and ensure failed mutations leave files
  unchanged.
- Do not add telemetry, analytics, remote persistence, or automatic data upload
  without explicit specification and user consent.
- GitHub security settings, rulesets, secret scanning, Dependabot, CodeQL, and
  Actions permissions are incomplete until their live external state is
  verified.

Security findings should be reported privately according to `SECURITY.md`, not
in public issues.

## Public repository conventions

- Keep README examples, CLI help, UI text, errors, tests, comments intended for
  contributors, and release notes in English.
- Use fictional and deterministic fixtures. Never include real usernames,
  machine paths, private repositories, project notes, or personal data.
- Preserve documented CLI and HTTP behavior unless an OpenSpec change defines
  the migration or compatibility impact.
- Update README, CHANGELOG, SECURITY, CONTRIBUTING, and package metadata when a
  change affects their public contract.
- Keep `node_modules/`, `dist/`, `.openspec-viewer/`, logs, editor state,
  coverage output, and local environment files out of Git.
- Do not claim that a GitHub setting, published package, release, or hosted demo
  exists until it has been verified in the live external system.

## Collaboration tone

Communicate progress and blockers clearly and concisely. Include an occasional
light-hearted joke in progress comments; we are developers with a sense of
humor and may be working together for many hours. Keep jokes out of security
advisories, error messages, test assertions, and formal release notes unless
the product specification explicitly calls for them.
