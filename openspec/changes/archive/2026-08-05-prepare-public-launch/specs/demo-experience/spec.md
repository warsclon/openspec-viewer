## ADDED Requirements

### Requirement: Deterministic representative demo project
The project SHALL provide a fictional OpenSpec fixture that represents the
primary views and states supported by the product.

#### Scenario: Demo fixture is validated
- **WHEN** the fixture is checked in CI
- **THEN** it is accepted by the supported OpenSpec CLI and includes active, archived, partial, complete, proposal, design, task, and delta-spec examples

### Requirement: Isolated CLI demo mode
The CLI SHALL provide a documented demo mode that launches the product without
requiring an existing OpenSpec project and SHALL NOT modify the caller's working
directory.

#### Scenario: User launches demo mode
- **WHEN** a user runs the CLI with the demo option
- **THEN** the browser workspace opens with the representative fixture and identifies itself as demo content

#### Scenario: Demo permits a local write interaction
- **WHEN** the local demo demonstrates an edit or task mutation
- **THEN** the mutation affects only an isolated temporary copy and is discarded without changing the repository fixture or caller project

### Requirement: Hosted read-only demo
The project SHALL provide a static hosted demo or equivalent public preview that
uses the representative fixture and prevents persistent mutation.

#### Scenario: Visitor opens the hosted demo
- **WHEN** a visitor follows the repository homepage link
- **THEN** the primary views, navigation, search, graph, timeline, board, and details are usable without installing the CLI

#### Scenario: Visitor reaches a mutating feature
- **WHEN** the hosted demo would normally show an edit, create, archive, note, or task mutation action
- **THEN** the action is disabled or omitted and the interface clearly indicates read-only demo mode

### Requirement: Shared demo contract
Demo mode, hosted demo data, browser tests, and launch media SHALL derive from
the same fixture and public response contracts.

#### Scenario: Fixture changes
- **WHEN** a maintainer changes the representative fixture
- **THEN** CI exercises local demo and hosted demo behavior and reports any incompatible data or visual journey
