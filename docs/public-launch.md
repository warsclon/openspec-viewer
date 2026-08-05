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
| npm package | `@warsclon/openspec-viewer` is not currently published (registry returns 404) | Final scoped package name confirmed as `@warsclon/openspec-viewer`; safe to change package identity |
| npm authentication | Authenticated as `warsclon`, owner of the `warsclon` npm scope (verified 2026-08-04 via `npm whoami` and `npm org ls warsclon`) | Scope control verified; trusted publishing can be configured during the release phase |

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
reduced motion, and writes to `docs/media/`. Three assets are committed:

| Asset | What it is |
| --- | --- |
| `hero.png` | Primary README screenshot, 1280×800 Now view |
| `workflow.gif` | Now → Graph → task recording, 800px wide at 10 fps |
| `social-preview.png` | Composed 1280×640 social card |

Everything else it writes — `journey-{now,graph,tasks}.png`, `social-frame.png`,
`workflow.webm` — is an intermediate and stays ignored.

The journey fails if an expected control is missing or if any rendered page
contains machine paths, so stale fixtures cannot silently produce launch media.
The same journey runs in CI through `test/browser/launch-media.spec.ts`, and
`test/browser/accessibility.spec.ts` covers demo labeling, visual naming,
keyboard flow, and reduced-motion behavior for the launch surface.

### Optimization and sensitive-data checks

The script requires `ffmpeg`. Screenshots are requantized to a 256-colour
palette with metadata stripped, which took `hero.png` from 146 KB to 58 KB at a
measured SSIM of 0.9996 against the original — no visible loss on a flat dark
UI. Dithering is deliberately off: its noise costs more bytes than the accuracy
it buys here.

Sensitive-data protection is split across the two places a leak can happen:

- **Rendered pixels** — the capture journey reads the page text and refuses to
  screenshot a page containing the home directory, the temporary directory, or
  the demo project path.
- **File metadata** — `scripts/lib/media-guard.ts` byte-scans every committed
  asset for those same tokens plus the account username, as both UTF-8 and
  UTF-16LE, and fails the run before anything reaches the working tree. Its
  logic is unit-tested in `test/media-guard.test.ts`, so CI covers the check
  even though CI cannot run the capture itself.

### Animation format

GitHub renders an animated GIF inline from a plain Markdown image; it does not
render a repository-relative `.webm` that way. The recording is therefore
transcoded to GIF for the README, at 800px — GitHub's rendered README width, so
no browser downscaling. The current encode is 36 frames over 3.6 s for 591 KB;
the exact size moves a little between runs because the recording length does.
The `.webm` master stays in `docs/media/` as an ignored intermediate.

### Social preview

`social-preview.png` is composed in the same browser that captured the UI, so
the card is real product output rather than a mockup: the product name and
one-line value proposition on the left, and the live Graph view bleeding off
the bottom-right corner. It is generated at 1280×640, GitHub's recommended
social preview size, and is legible at thumbnail scale.

Uploading it is a manual step — the GitHub REST API has no social-preview
endpoint. Upload `docs/media/social-preview.png` under **Settings → General →
Social preview**.

## Repository metadata, updated 2026-08-05

| Field | Value |
| --- | --- |
| Description | `A browser workspace for OpenSpec projects — browse changes, manage tasks, edit specs, and follow your coding agent live.` |
| Topics | `openspec`, `spec-driven-development`, `cli`, `dashboard`, `typescript`, `ai-agents` |
| Homepage | Still unset — it is set to the hosted demo URL only after Pages is deployed and verified |
| Social preview | Uploaded 2026-08-05 from `docs/media/social-preview.png` |

The description and topics were applied through the GitHub API and match the
README positioning. The homepage stays unset until the hosted demo is deployed
and verified.

The social preview had to be uploaded by hand because the GitHub REST API has
no endpoint for it. Upload verified from the public repository page: its
`og:image` resolves to `repository-images.githubusercontent.com`, which GitHub
serves only for a custom upload — an auto-generated card would come from
`opengraph.githubassets.com`.

README media rendering was verified on `main` after merge, against the public
repository page rather than a local preview:

| Asset | Served | In the rendered README | Alt text |
| --- | --- | --- | --- |
| `hero.png` | 200, `image/png`, 58 KB | `<img>` present | Present, descriptive |
| `workflow.gif` | 200, `image/gif`, 591 KB | `<img>` present | Present, descriptive |

The GIF is a valid `GIF89a` with a `NETSCAPE2.0` loop extension over 36 frames,
so it animates and loops inline instead of rendering as a static poster.
GitHub serves `raw.githubusercontent.com` images directly; only the shields.io
badges are proxied through camo.

## Roadmap and contributor entry points, 2026-08-05

`ROADMAP.md` publishes Now / Next / Later, with `Later` explicitly marked as
exploratory and not open for contribution. The initial issues are:

| Issue | Roadmap tier | Labels |
| --- | --- | --- |
| #34 Explain how to recover when the port is already in use | Next | `good first issue`, `enhancement` |
| #35 Add keyboard shortcuts for switching between views | Next | `good first issue`, `enhancement` |
| #36 Verify Windows and macOS support in CI | Next | `help wanted` |
| #37 Explore: publish a read-only snapshot of a real project | Later | `enhancement` only |

Each carries context, bounded scope, acceptance criteria, and the exact checks
it must pass. #36 is deliberately not a starter issue: it will surface real
cross-platform bugs and deciding which to fix versus document is a judgement
call. #37 carries no contribution label at all and says so in its first line,
because its scope is unresolved — it exists to collect use cases.

Until Discussions is enabled, the question channel is a GitHub issue with the
`question` label, documented in `CONTRIBUTING.md`.

## First release, published 2026-08-04

`@warsclon/openspec-viewer@0.6.0` is on npm with signed provenance, together
with the `v0.6.0` tag and its GitHub Release.

npm cannot register a trusted publisher for a package that does not exist yet
([npm/cli#8544](https://github.com/npm/cli/issues/8544)), so the first version
could not authenticate through OIDC. Publishing it by hand would have produced
no provenance, because provenance can only be generated in CI. It was therefore
published by a one-shot `workflow_dispatch` workflow using a short-lived
granular token, which ran the full validation first. The token was revoked and
the `NPM_TOKEN` secret deleted immediately afterwards, and the workflow was
removed. Every later release goes through `release.yml` with no token at all.

Verified against the published package, not the repository:

| Check | Result |
| --- | --- |
| Clean install from the registry | Installs one package with no runtime dependencies |
| `npx @warsclon/openspec-viewer@0.6.0` | Reports `0.6.0` |
| Global install into an isolated prefix | Links `openspec-viewer` to `dist/cli.js` and runs |
| `npm audit signatures` | Verified registry signature and verified attestation |
| Registry metadata | MIT, repository and homepage links correct, 49 files, 227 KB |

README rendering was confirmed visually by the maintainer, since npmjs.com
returns 403 to automated requests: the page renders correctly and npm resolved
the repository-relative hero image on its own. The hero was still changed to an
absolute `raw.githubusercontent.com` URL as a defensive measure for registries
and mirrors that do not resolve relative paths — not because anything was
broken. That change reaches the npm page only with the next published version,
because npm freezes the README per version.

Two environment gotchas found while releasing, both fixed:

- Node 22 still bundles npm 10, but trusted publishing needs npm >= 11.5.1, so
  the publish job upgrades npm first.
- npm 12 reports `npm pack --json` as an object keyed by package name while
  npm 10 reports an array; the package smoke test now accepts both.

## Pending external prerequisites

1. ~~Authenticate the maintainer's npm account and verify control of the
   `@warsclon` scope.~~ Done 2026-08-04: authenticated as `warsclon`, scope
   owner confirmed, `@warsclon/openspec-viewer` unpublished and available.
2. Enable GitHub Pages, run the constrained manual deployment workflow, and
   verify the public repository-path URL before setting the homepage or
   enabling automatic deployment from `main`.
3. ~~Configure npm trusted publishing.~~ Done 2026-08-04: the `release`
   environment exists and the trusted publisher is registered for
   `@warsclon/openspec-viewer` (repository `warsclon/openspec-viewer`, workflow
   `release.yml`, environment `release`). The OIDC path itself is exercised for
   the first time by the next `vX.Y.Z` tag; until then it is configured but
   unproven.
4. Set repository homepage, topics, social preview, and release metadata only
   after their target artifacts are publicly verifiable.
