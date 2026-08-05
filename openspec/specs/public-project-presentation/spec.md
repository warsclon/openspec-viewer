# public-project-presentation Specification

## Purpose
TBD - created by archiving change prepare-public-launch. Update Purpose after archive.
## Requirements
### Requirement: Outcome-focused repository landing
The public repository SHALL explain within its initial visible section that the
product is a browser workspace for OpenSpec and SHALL identify the primary
benefits of browsing changes, managing tasks, editing artifacts, inspecting spec
diffs, and following live project activity.

#### Scenario: First-time visitor opens the repository
- **WHEN** a visitor opens the repository README
- **THEN** the visitor sees an outcome-focused value proposition, a primary visual, and a one-command trial path before detailed reference material

#### Scenario: Visitor compares the product with OpenSpec CLI
- **WHEN** a visitor looks for the difference from `openspec view`
- **THEN** the README presents a concise comparison based on supported workflows rather than dismissive marketing claims

### Requirement: Authentic visual proof
The repository SHALL include optimized visual assets generated from a
deterministic fictional project, and each visual SHALL represent the current
product without exposing local paths, credentials, or real project information.

#### Scenario: Visitor reviews the hero media
- **WHEN** the README renders on GitHub
- **THEN** it shows a current product screenshot or short animation with meaningful alternative text

#### Scenario: Maintainer regenerates launch media
- **WHEN** the documented capture workflow runs against the demo fixture
- **THEN** it produces the expected media at a fixed viewport and theme without machine-specific content

### Requirement: Discoverable repository metadata
The GitHub repository SHALL have an outcome-focused description, relevant
topics, a useful homepage URL, and a social preview consistent with the README.

#### Scenario: User discovers the repository through GitHub search
- **WHEN** GitHub displays the repository in search, topic, or share previews
- **THEN** the description, topics, and social image identify the product and its OpenSpec use case

### Requirement: Public content quality
Public-facing repository content SHALL be written in English, SHALL be
accessible to keyboard and screen-reader users where interactive, and SHALL
avoid unsupported badges or unverifiable claims.

#### Scenario: Public content is reviewed before release
- **WHEN** a launch-surface change is proposed
- **THEN** CI or review verifies English copy, valid links, meaningful image alternatives, and claims backed by a working feature or check

