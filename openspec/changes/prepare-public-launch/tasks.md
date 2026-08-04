## 1. Launch Prerequisites

- [x] 1.1 Verify control of the intended npm scope and record the final scoped package name
- [x] 1.2 Choose and document the static hosting target after testing base-path and hash-route behavior
- [x] 1.3 Define the supported Node.js and OpenSpec version matrix from current behavior and compatibility checks
- [x] 1.4 Inventory current GitHub settings, open dependency pull requests, metadata, and release state as the launch baseline
- [x] 1.5 Define fictional demo content that exercises every primary view without real project or machine data

## 2. Deterministic Demo Foundation

- [x] 2.1 Add the representative OpenSpec fixture with active, archived, partial, complete, and delta-spec examples
- [x] 2.2 Validate the demo fixture with each supported OpenSpec version in the compatibility matrix
- [x] 2.3 Add a CLI `--demo` option that resolves the bundled fixture without reading or writing the caller project
- [x] 2.4 Add isolated temporary-copy behavior for local demo mutations and verify cleanup on exit
- [x] 2.5 Add a visible demo indicator and document the difference between demo data and a real project
- [x] 2.6 Define a static snapshot adapter that conforms to the existing browser API response contracts
- [x] 2.7 Add a hosted-demo read-only capability flag and remove or disable every mutation control under that flag
- [x] 2.8 Build the static hosted demo with the shared fixture and verify all deep links under the selected base path

## 3. Public-Seam Verification

- [x] 3.1 Complete and archive `establish-test-foundation` before relying on CI
  as a public-launch or repository-ruleset gate
- [x] 3.2 Extend the shared deterministic fixture and browser harness only with
  launch-specific demo, hosted read-only, and media-capture scenarios
- [x] 3.3 Test hosted-demo read-only behavior and ensure every mutation control
  and write path is unavailable
- [x] 3.4 Add launch-specific accessibility checks for demo labeling, visual
  alternative text, keyboard flow, and reduced-motion media
- [x] 3.5 Run the inherited Node.js 20 and 22, browser, and package checks plus
  the launch-specific demo matrix and document expected execution time

## 4. Visual Launch and Positioning

- [x] 4.1 Implement the scripted browser capture journey using only the deterministic demo fixture
- [ ] 4.2 Generate and optimize the primary README screenshot with machine paths and sensitive data checks
- [ ] 4.3 Generate the short Now-to-Graph-to-task workflow recording and verify it renders on GitHub
- [ ] 4.4 Create a social preview composition from real UI output at GitHub's recommended dimensions
- [x] 4.5 Rewrite the README opening as an outcome-focused browser-workspace value proposition
- [x] 4.6 Add the hero visual, one-command quickstart, and concise comparison with `openspec view`
- [x] 4.7 Add supported-version, demo-mode, privacy, local-write, and hosted read-only explanations
- [ ] 4.8 Update the repository description and add the agreed OpenSpec, SDD, CLI, dashboard, TypeScript, and AI-agent topics
- [ ] 4.9 Publish the social preview and verify repository, search, and shared-link presentation

## 5. Scoped Package and Releases

- [x] 5.1 Change package identity to the verified scope while preserving the `openspec-viewer` executable
- [x] 5.2 Update installation and execution examples to use only the scoped package identity
- [x] 5.3 Extend package-content checks to cover fixture/static assets, executable mode, license, version, and sensitive-file exclusions
- [x] 5.4 Add release version and tag agreement checks that fail before any publication step
- [x] 5.5 Configure npm trusted publishing with minimal GitHub permissions and no long-lived npm token
- [x] 5.6 Add a tag-only release workflow that runs the complete validation and package installation sequence
- [x] 5.7 Publish npm provenance and create GitHub Release notes from the changelog only after validation succeeds
- [x] 5.8 Test the documented `npx` and global-install flows against the published scoped package
- [x] 5.9 Verify package ownership, repository links, license, README rendering, provenance, and executable behavior on npm

## 6. Repository Trust and Security

- [x] 6.1 Complete and archive `harden-github-repository` as the source of truth
  for dependency, secret, workflow, access, and default-branch controls
- [ ] 6.2 Re-run its versioned repository-security audit after the repository
  becomes public and retain launch-specific Pages and release configuration
  evidence
- [ ] 6.3 Verify release workflows add write or identity permissions only at a
  separately reviewed publishing job and protected environment boundary
- [ ] 6.4 Confirm the inherited clean-clone security evidence remains valid
  after adding demo, media, hosted-site, and release assets

## 7. Contributor Experience

- [ ] 7.1 Add a Now/Next/Later roadmap that distinguishes committed work from exploratory ideas
- [ ] 7.2 Create a small initial set of roadmap issues with context, scope, acceptance criteria, and validation notes
- [ ] 7.3 Mark only independently executable issues as `good first issue` or `help wanted`
- [ ] 7.4 Link contributor documentation to the roadmap, support path, demo fixture, and public-seam test commands
- [x] 7.5 Configure Dependabot groups for compatible patch/minor npm updates and GitHub Actions updates
- [x] 7.6 Keep major dependency updates isolated and document the required compatibility review
- [x] 7.7 Review the existing Dependabot pull requests and close, merge, or supersede each with a recorded reason
- [ ] 7.8 Decide whether Discussions has enough expected usage to enable now; otherwise document the current question channel

## 8. Public Launch Validation

- [ ] 8.1 Deploy the read-only demo and set the verified public URL as the repository homepage
- [ ] 8.2 Run README instructions from a clean machine or isolated environment with no source checkout
- [ ] 8.3 Verify the screenshot, animation, social preview, badges, links, package commands, and accessibility text on GitHub
- [x] 8.4 Verify required CI and security checks on a representative pull request after the ruleset is active
- [ ] 8.5 Verify the package and GitHub Release from a fresh external install and record the tested versions
- [ ] 8.6 Confirm GitHub community health, topics, roadmap issues, contribution paths, and dependency activity are publicly legible
- [ ] 8.7 Update the changelog and publish the launch announcement with demo, installation, release, and contribution links
