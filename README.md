# openspec-viewer

Local web UI for [OpenSpec](https://github.com/Fission-AI/OpenSpec) projects.

OpenSpec already ships `openspec view` (terminal dashboard). This tool is the browser version: browse changes, track tasks, edit artifacts, and keep an eye on project evolution while your coding agent works.

[![CI](https://github.com/warsclon/openspec-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/warsclon/openspec-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## Features

- Discovers `openspec/` from the current directory (or `--path`)
- **Active + archived** changes with filters
- Views: **Now** (next incomplete task), **Graph** (specs ↔ changes), **Timeline**, **Board**, **Detail**
- **Live reload** via `fs.watch` + Server-Sent Events
- **Global search** (`⌘K` / `Ctrl+K`) across changes, tasks, proposal, design, specs
- **Spec diff** tab (ADDED / MODIFIED / REMOVED requirements)
- **Deep links**: `#/next`, `#/graph?spec=…`, `#/change/<name>/diff`
- Edit **proposal / design / tasks** (markdown split preview)
- Task CRUD + reorder → writes clean `tasks.md`
- Create changes and archive (via `openspec` CLI when available)
- **Local notes** per change under `.openspec-viewer/` (gitignored)

## Requirements

- Node.js **20+**
- Optional: [`@fission-ai/openspec`](https://www.npmjs.com/package/@fission-ai/openspec) CLI for create/archive integration

## Install

```bash
# from source
git clone https://github.com/warsclon/openspec-viewer.git
cd openspec-viewer
npm install
npm run build
npm link
```

Or run without linking:

```bash
npm start -- --path /path/to/your-project
```

## Usage

```bash
# inside a project that contains openspec/
openspec-viewer

# point at another project
openspec-viewer /path/to/project
openspec-viewer --path ../my-app --port 5173
openspec-viewer --no-open
openspec-viewer --no-archive   # hide archived changes
```

Development (TypeScript, no build step):

```bash
npm run dev -- --path /path/to/project
```

## CLI options

| Option | Description |
|--------|-------------|
| `[path]` / `--path <dir>` | Project root to scan (default: cwd) |
| `-p, --port <n>` | Port (default: `4321`; use `0` for an ephemeral port) |
| `--host <host>` | Host (default: `127.0.0.1`) |
| `--no-archive` | Hide archived changes |
| `--no-open` | Do not open the browser |
| `-h, --help` | Help |
| `-V, --version` | Version |

## Local HTTP API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/project` | Project paths |
| `GET` | `/api/changes` | Changes + overview + graph + next-up |
| `GET` | `/api/changes/:name` | Detail, tasks, spec diffs, notes |
| `POST` | `/api/changes` | Create change `{ name, description? }` |
| `POST` | `/api/changes/:name/archive` | Archive `{ confirm: true, skipSpecs? }` |
| `PUT` | `/api/changes/:name/proposal` | Write proposal.md |
| `PUT` | `/api/changes/:name/design` | Write design.md |
| `PUT` | `/api/changes/:name/tasks` | Replace tasks (`content` or `sections`) |
| `POST` | `/api/changes/:name/tasks/mutate` | Add/update/delete/move tasks |
| `POST` | `/api/changes/:name/tasks/toggle` | Toggle checkbox |
| `GET`/`PUT` | `/api/changes/:name/notes` | Local notes |
| `GET` | `/api/search?q=` | Global search |
| `GET` | `/api/events` | SSE live reload stream |

Archived changes are **read-only** for OpenSpec artifacts. Local notes remain editable.

JSON API responses use these status classes:

| Status | Meaning |
|--------|---------|
| `200` / `201` | The read or mutation completed successfully |
| `400` | The URL encoding, JSON body, or required input is invalid |
| `404` | The route, change, or task does not exist |
| `409` | The mutation conflicts with existing or archived project state |
| `500` | A local operation or OpenSpec subprocess failed |

## Deep links

```
#/next
#/graph
#/graph?spec=billing-quotas
#/timeline
#/board
#/change/my-feature
#/change/my-feature/diff
#/change/archive%2F2026-07-19-my-feature/tasks
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run CLI via `tsx` |
| `npm run build` | Compile TypeScript + copy UI assets |
| `npm test` | Run all unit and integration tests (Vitest) |
| `npm run test:unit` | Run focused unit tests |
| `npm run test:integration` | Run filesystem and HTTP integration tests |
| `npm run test:coverage` | Run Node-source coverage with V8 |
| `npm run test:browser` | Run critical UI journeys in deterministic Chromium |
| `npm run test:package` | Pack, clean-install, and smoke-test the published CLI |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
src/
  cli.ts              # CLI entrypoint
  server.ts           # HTTP + SSE API
  openspec/           # parsers, graph, search, mutate, notes
  ui/                 # static web UI
test/                 # unit tests
```

## Related

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) — spec-driven development for AI coding assistants
- OpenSpec terminal dashboard: `openspec view`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues should
be reported privately according to the [Security Policy](SECURITY.md).

## License

[MIT](LICENSE)
