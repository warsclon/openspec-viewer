# Public launch baseline

This document records the non-sensitive launch baseline for
`warsclon/openspec-viewer`. It distinguishes verified behavior from external
configuration that is still pending.

## Baseline verified on 2026-07-29

| Surface | Verified state | Launch implication |
| --- | --- | --- |
| Repository | Public, with `main` as the default branch | Ready for public launch work |
| Description | `Local web UI CLI to visualize and manage OpenSpec changes/tasks` | Rewrite during the positioning phase |
| Homepage | Not configured | Set only after the hosted demo is deployed and verified |
| Topics | Not configured | Add the approved launch topics during the positioning phase |
| Discussions | Disabled | Keep disabled until there is enough community usage to moderate a separate question channel |
| Pull requests | No open pull requests | No dependency backlog blocks launch work |
| GitHub Releases | No releases | Create the first release only through the validated tag workflow |
| GitHub Pages | Not configured | Selected hosting target after base-path and hash-route verification |
| npm package | `@warsclon/openspec-viewer` is not currently published | Verify scope control before changing package identity |
| npm authentication | The local npm session is not authenticated | The maintainer must authenticate before scope ownership or trusted publishing can be verified |

The archived `harden-github-repository` change is the source of truth for
dependency monitoring, secret scanning, workflow permissions, integration
access, CodeQL, dependency review, and default-branch governance. Pull requests
#20 and #21 completed and archived that work without using the ruleset bypass.

## Supported compatibility matrix

| Surface | Supported and verified versions | Evidence |
| --- | --- | --- |
| Published CLI runtime | Node.js 20 and 22 release lines | Required CI quality and package-smoke jobs run on both majors |
| Source and browser development | Node.js 20.19 or newer, or Node.js 22.12 or newer | The current Vitest/Vite development toolchain requires those minimums |
| OpenSpec CLI integration | OpenSpec 1.6.0 and 1.7.0 | Strict validation passed for both this repository and the representative fixture |

The viewer can read compatible OpenSpec filesystem layouts without invoking the
OpenSpec CLI. Create and archive integrations are optional and are claimed only
for the exact OpenSpec versions listed above. Other versions may work, but are
not part of the launch support claim until they pass the same validation.

## Static hosting decision

The hosted read-only demo targets GitHub Pages at the repository path
`/openspec-viewer/`. The generated static artifact uses relative UI and snapshot
URLs, while product deep links remain URL hash routes such as `#/next`,
`#/graph?spec=interface`, and `#/change/add-dark-mode/tasks`.

The browser verification serves the generated artifact under the exact
repository base path and confirms that navigation, search, graph focus, detail
views, and direct hash deep links work without a backend. GitHub Pages remains
disabled until the manually triggered deployment workflow and public URL pass
the launch gate. Automatic deployment from `main` must not be enabled before
that external verification succeeds.

## Deterministic demo content

The committed fixture under
`demo/representative-openspec/` is fictional and contains:

- the implemented `interface` specification;
- the active, partially complete `add-dark-mode` change;
- the completed `completed-export` change;
- the archived `legacy-search` change;
- proposal, design, task, and delta-spec examples;
- graph relationships, timeline dates, and board states derived from those
  artifacts.

Demo mode, hosted-demo snapshots, browser tests, and launch media must derive
from this one fixture. Local notes or mutation examples must be seeded only
into an isolated temporary copy and must never alter the committed fixture or
the caller's project.

The fixture passed strict validation with OpenSpec 1.6.0 and 1.7.0 on
2026-07-29.

## Launch media capture workflow

`npm run capture:media` regenerates every launch asset from the shared
deterministic fixture. The script starts an isolated temporary demo project,
drives the Now → Graph → task-interaction journey defined in
`test/helpers/capture-journey.ts` at a fixed 1280×800 dark-theme viewport with
reduced motion, and writes to `docs/media/`:

- `hero.png` — primary README screenshot (Now view);
- `journey-now.png`, `journey-graph.png`, `journey-tasks.png` — per-step frames;
- `social-preview.png` — raw 1280×640 frame for the social preview composition;
- `workflow.webm` — the recorded Now → Graph → task journey.

The journey fails if an expected control is missing or if any rendered page
contains machine paths, so stale fixtures cannot silently produce launch media.
The same journey runs in CI through `test/browser/launch-media.spec.ts`, and
`test/browser/accessibility.spec.ts` covers demo labeling, visual naming,
keyboard flow, and reduced-motion behavior for the launch surface.

## Pending external prerequisites

1. Authenticate the maintainer's npm account and verify control of the
   `@warsclon` scope.
2. Enable GitHub Pages, run the constrained manual deployment workflow, and
   verify the public repository-path URL before setting the homepage or
   enabling automatic deployment from `main`.
3. Configure npm trusted publishing only after the scoped package identity and
   protected release environment are ready.
4. Set repository homepage, topics, social preview, and release metadata only
   after their target artifacts are publicly verifiable.
