## ADDED Requirements

### Requirement: Public-seam continuous integration
CI SHALL validate supported Node.js versions through typechecking, unit tests,
HTTP integration tests, browser workflow tests, a clean build, and installed
package smoke tests.

#### Scenario: Pull request changes runtime or UI behavior
- **WHEN** a pull request targets `main`
- **THEN** CI exercises the installed CLI, real local server, and representative browser journey on supported Node.js versions

#### Scenario: Public behavior regresses
- **WHEN** a CLI, API, browser, demo, or package contract fails
- **THEN** the required CI check fails with actionable diagnostic output

### Requirement: Protected default branch
The default branch SHALL prevent force pushes and deletion and SHALL require the
project CI checks before unreviewed changes can be merged, with a documented
maintainer emergency bypass.

#### Scenario: Change attempts to bypass required checks
- **WHEN** a contributor tries to merge or push a change that has not passed required CI
- **THEN** the repository ruleset blocks the operation unless the documented emergency bypass is deliberately used

### Requirement: Repository security controls
The public repository SHALL enable available secret scanning, push protection,
dependency vulnerability alerts and security updates, private vulnerability
reporting, and least-privilege workflow permissions.

#### Scenario: Commit contains a recognized secret
- **WHEN** a contributor attempts to push a recognized credential
- **THEN** push protection blocks or explicitly warns about the secret before it reaches the default branch

#### Scenario: Vulnerable dependency is detected
- **WHEN** GitHub identifies a supported dependency vulnerability
- **THEN** maintainers receive an alert and an actionable security update without exposing report details publicly

### Requirement: Supply-chain-conscious automation
Third-party GitHub Actions SHALL be trusted explicitly and automated publishing
SHALL use short-lived identity and provenance rather than repository-stored
long-lived publication credentials where supported.

#### Scenario: Workflow dependency changes
- **WHEN** an action version or digest is updated
- **THEN** the update is reviewed through a pull request and required CI runs before merge

### Requirement: Supported compatibility is visible
The project SHALL document and test the supported Node.js and OpenSpec version
ranges without claiming unverified compatibility.

#### Scenario: User checks prerequisites
- **WHEN** a user reads installation or release documentation
- **THEN** the supported Node.js and OpenSpec versions and any optional integration behavior are stated clearly
