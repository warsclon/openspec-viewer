## ADDED Requirements

### Requirement: Lifecycle subprocesses operate on isolated safe copies

Create and archive commands SHALL run against a temporary copy rather than the
selected live OpenSpec project. The copy boundary SHALL reject symbolic links
and unsupported filesystem entries without invoking the subprocess.

#### Scenario: An OpenSpec tree contains a symbolic link

- **WHEN** a create or archive lifecycle operation prepares its command
  workspace
- **THEN** it rejects the operation with a stable error, does not invoke the
  command, does not follow the link, and removes the temporary workspace

#### Scenario: A lifecycle command fails

- **WHEN** a create or archive subprocess returns an error or produces partial
  output
- **THEN** the live OpenSpec project remains unchanged and the command
  workspace is removed

### Requirement: Change creation uses no-clobber publication

A completed generated or fallback change SHALL become visible only after its
destination has been reserved atomically. Publication SHALL NOT replace a
change directory created by another writer.

#### Scenario: Another writer creates the requested change

- **WHEN** the destination appears while change generation is running
- **THEN** publication rejects the conflict and preserves the other writer's
  directory and content

#### Scenario: A change is published on Windows

- **WHEN** the destination is absent and a completed change is ready
- **THEN** publication uses the platform no-replace rename without first
  creating an incompatible empty destination directory

#### Scenario: Fallback scaffolding fails

- **WHEN** the fallback writer fails before completing every required artifact
- **THEN** no partial change is published and all staging resources are removed

### Requirement: Archive publication preserves concurrent data

Archive publication SHALL apply only the path delta produced in the isolated
workspace. It SHALL use no-clobber additions, path-scoped backups, atomic
live-file capture followed by no-clobber replacement publication, conflict
detection, and verified rollback instead of clearing and recopying the live
OpenSpec tree. Its fingerprint SHALL cover entry types, file content, and
relevant permission bits.

#### Scenario: The live project changes while archive runs

- **WHEN** the selected project no longer matches the captured source
  fingerprint before publication
- **THEN** the archive is rejected and the concurrent live content is
  preserved

#### Scenario: Publication fails after applying part of the delta

- **WHEN** a filesystem error or exact-path conflict interrupts publication
- **THEN** paths owned by the transaction are rolled back, unrelated concurrent
  content is not overwritten, and recovery material is removed unless keeping
  an ignored local copy is necessary to prevent data loss

#### Scenario: Local recovery state is symlinked

- **WHEN** `.openspec-viewer` or its lifecycle directory resolves through a
  symbolic link or outside the selected project
- **THEN** archive publication rejects the operation without writing to or
  removing the linked target

#### Scenario: Notes appear during publication

- **WHEN** another local operation creates notes while archive staging exists
- **THEN** cleanup preserves both the notes and the ignore rule that keeps them
  out of Git

#### Scenario: Archive publication succeeds

- **WHEN** every changed path still matches its expected source state
- **THEN** the resulting live tree matches the isolated archive result, the
  watched OpenSpec root remains in place, and all staging and backup resources
  are removed

#### Scenario: Post-commit cleanup fails

- **WHEN** a create or archive result is committed but a temporary workspace or
  staging cleanup subsequently fails
- **THEN** the operation returns success with an explicit cleanup warning and
  does not represent the already-applied mutation as failed

#### Scenario: Publication and cleanup both fail before commit

- **WHEN** archive publication fails and cleanup of its temporary state also
  fails
- **THEN** the publication error remains the primary failure and includes the
  cleanup error as diagnostic context

### Requirement: Filesystem mutation validation is stable

Artifact and local-note mutation boundaries SHALL reject unsupported values
before writing project or local-state files.

#### Scenario: Artifact content is not text

- **WHEN** an artifact write receives a non-string content value
- **THEN** it returns the documented validation error and leaves the artifact
  byte-for-byte unchanged

#### Scenario: A note name is traversal-shaped

- **WHEN** a local-note operation receives an absolute, nested, or traversal
  change name outside the supported active and archive forms
- **THEN** it returns the documented validation error without creating local
  viewer state or files outside that state
