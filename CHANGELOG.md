# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.0] - 2026-08-04

### Added

- Bundled `--demo` workflow backed by an isolated, deterministic fictional
  OpenSpec project
- Static read-only demo build for repository-path hosting
- Browser and package checks for local and hosted demo behavior
- Scripted launch media capture (`npm run capture:media`) driving the shared
  Now → Graph → task journey against the demo fixture
- Launch accessibility checks for demo labeling, visual naming, keyboard flow,
  and reduced-motion behavior
- Reduced-motion support in the web UI via `prefers-reduced-motion`
- Tag-only release workflow with full validation, npm trusted publishing with
  provenance, and GitHub Release notes generated from this changelog

### Changed

- Package identity is now the scoped `@warsclon/openspec-viewer`; the
  `openspec-viewer` executable name is unchanged
- README rewritten around the browser-workspace value proposition with a hero
  screenshot, one-command quickstart, and an `openspec view` comparison

### Fixed

- Shutdown no longer hangs when a client socket is left mid-request, so
  `Ctrl+C` reliably stops the CLI

## [0.5.0] - 2026-07-23

### Added

- Public repository essentials: CI, tests, license, contribution guidelines,
  security policy, code of conduct, issue templates, and dependency updates
- Edit proposal and design with split markdown preview
- Task add / edit / delete / reorder writing clean `tasks.md`
- Create change and archive (via `openspec` CLI with local scaffold fallback)
- Local per-change notes under `.openspec-viewer/` (gitignored)
- Live reload (`fs.watch` + SSE)
- Global search (`⌘K` / `Ctrl+K`)
- Spec diff tab (ADDED / MODIFIED / REMOVED)
- Deep links for views and change tabs
- Now queue, specs↔changes graph, timeline, and board views
- Light / dark theme and font scale preferences

### Changed

- Standardized documentation, CLI output, errors, and the web UI in English
- Made builds deterministic by cleaning generated output before compilation
- Archived changes are read-only for OpenSpec artifacts
- Archive listing enabled by default

## [0.1.0] - 2026-07-21

### Added

- Initial MVP: local web UI to list changes and toggle tasks
