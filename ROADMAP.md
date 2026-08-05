# Roadmap

What the project is working on, what is committed next, and what is still an
idea. Anything under **Later** is exploratory: it has no agreed scope yet, so
please open an issue to discuss it before building it.

This file is maintained by hand. When an item is ready to be worked on, it gets
an issue; when it ships, it leaves the roadmap and lands in
[CHANGELOG.md](CHANGELOG.md).

## Now

Committed and actively in progress.

- **Public launch.** Deploy the read-only demo to GitHub Pages, set it as the
  repository homepage, verify the published package from a clean machine, and
  publish the launch announcement. Tracked as the `prepare-public-launch`
  OpenSpec change in `openspec/changes/`, not as issues.

## Next

Committed, scoped, and ready to be picked up. Each item has an issue with
acceptance criteria and the checks it must pass.

- **A useful message when the port is taken.** Starting the viewer while
  something already holds port 4321 prints Node's raw `listen EADDRINUSE` and
  exits, with no hint that `--port` exists.
  → [#34](https://github.com/warsclon/openspec-viewer/issues/34) · `good first issue`
- **Keyboard navigation between views.** Search is reachable with `⌘K`/`Ctrl+K`,
  but switching between Now, Graph, Timeline, Board, and Detail needs the
  mouse.
  → [#35](https://github.com/warsclon/openspec-viewer/issues/35) · `good first issue`
- **Windows and macOS verification in CI.** The viewer is a filesystem tool and
  CI runs only on Linux, so path handling on other platforms is unverified. The
  support claim should follow the evidence in either direction.
  → [#36](https://github.com/warsclon/openspec-viewer/issues/36) · `help wanted`

## Later

Ideas worth exploring. **No commitment, and no agreed scope** — these are not
starter issues, and a pull request implementing one may be declined on design
grounds. Discussion first, please.

- **Share a read-only snapshot of a real project.** The hosted demo already
  builds a static, backend-free snapshot from a fixture
  (`src/openspec/hosted-demo.ts`). Pointing that at a real project would let a
  team publish a browsable view of its specs. Unresolved: what gets redacted,
  where local notes go, and whether publishing project artifacts by accident is
  too easy.
  → [#37](https://github.com/warsclon/openspec-viewer/issues/37) — use cases wanted
- **OpenSpec layouts beyond `spec-driven`.** The viewer assumes the
  `spec-driven` schema. Supporting other schemas means deciding how much of the
  UI is schema-specific.
- **Multi-project workspaces.** One server showing several OpenSpec projects
  side by side. Unclear whether this beats running the CLI twice.

## Not planned

- **Hosting anything.** The viewer is local-first: it binds to `127.0.0.1`, has
  no telemetry, and has no account system. The hosted demo is a static build of
  fictional data, not a service.
- **Editing main specs directly.** Specs change through OpenSpec's archive flow,
  not by typing into them. The viewer shows spec deltas rather than offering to
  edit `openspec/specs/`.

## Proposing something

Open an issue describing the outcome you want and how you would know it worked.
For anything under **Later**, expect a design conversation before code. See
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and the checks a pull request has
to pass.
