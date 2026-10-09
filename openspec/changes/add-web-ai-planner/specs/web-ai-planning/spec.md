## ADDED Requirements

### Requirement: Private persistent planning
The system SHALL authenticate users and restrict profiles, snapshots, plans and runs to their owners at both the API and database boundaries.

#### Scenario: Another user's resource is requested
- **WHEN** an authenticated user requests or references another user's plan or snapshot
- **THEN** access is denied and no private content is returned or modified

### Requirement: Explicit validated import
The system SHALL preview and validate allowlisted versioned course data before an explicitly confirmed cloud upload and SHALL preserve existing saved plans.

#### Scenario: Legacy export contains unrelated storage
- **WHEN** the student imports an extension v1 backup
- **THEN** only supported planning fields enter the preview and cloud payload, and unrelated storage keys are excluded

### Requirement: Bounded personal AI planning
The system SHALL generate candidates from known records using confirmed constraints and SHALL validate model results before presentation or application.

#### Scenario: Model invents a course
- **WHEN** a model result references a course or evidence ID absent from the authorized input
- **THEN** the result is rejected and the manual planner remains usable

#### Scenario: Schedule information is incomplete
- **WHEN** a candidate includes TBA meetings or unknown academic conditions
- **THEN** it is labeled provisional and is not represented as verified academically valid

#### Scenario: Search limit is reached
- **WHEN** candidate exploration reaches its configured limit
- **THEN** the system reports incomplete search rather than asserting no possible plan exists

### Requirement: Revision-safe application
The system SHALL require the expected plan revision when saving or applying a recommendation and SHALL detect changes to its input profile.

#### Scenario: Another tab has saved a newer plan
- **WHEN** a stale draft or recommendation is applied
- **THEN** the system rejects the overwrite and offers a review or reload path

### Requirement: Account data control
The system SHALL provide versioned export and deletion of user-owned data and SHALL disclose upload and model processing before use.

#### Scenario: Account deletion completes
- **WHEN** an authenticated student confirms account deletion
- **THEN** live owned records and access are removed and pending generation cannot recreate the account's planning data

### Requirement: Local extension continuity
The extension SHALL retain its local planning behavior without requiring a website account.

#### Scenario: Website is unavailable
- **WHEN** the student uses the extension without network access to the website
- **THEN** existing local course and scheduling functions remain available
