## ADDED Requirements

### Requirement: Goal-preserving alternative recommendation
The system SHALL recommend an alternative from a supplied set of academically valid candidates by comparing how closely each candidate preserves the student's stated outcomes and constraints.

#### Scenario: Preferred course becomes unavailable
- **WHEN** the preferred course is marked unavailable and valid alternatives exist
- **THEN** the system identifies the alternative that best preserves the student's highest-priority outcomes and explains the comparison

### Requirement: Preserved and changed consequences
Every alternative recommendation SHALL state what the replacement preserves, improves, weakens, delays, or makes uncertain.

#### Scenario: Alternative preserves skills but changes artifacts
- **WHEN** a replacement teaches similar skills but produces a different form of portfolio evidence
- **THEN** the explanation separately identifies the preserved skill outcome and changed artifact outcome

### Requirement: Constraint-aware filtering
The system SHALL exclude candidates that violate explicit hard constraints before comparing goal preservation.

#### Scenario: Candidate conflicts with a hard schedule constraint
- **WHEN** a candidate falls outside the student's available time or exceeds an explicit maximum
- **THEN** the candidate is excluded and the interface explains the violated constraint

### Requirement: Academic-validity boundary for alternatives
The system MUST NOT claim that a suggested alternative satisfies institutional requirements unless that status was supplied by an authoritative source or curated demo data.

#### Scenario: Candidate validity is unverified
- **WHEN** an alternative was discovered without authoritative requirement data
- **THEN** the system labels it as an exploratory option and directs the student to verify it before acting

### Requirement: Student agency
The system SHALL allow the student to inspect, reject, or replace a recommended alternative and recompute the comparison.

#### Scenario: Student rejects the top recommendation
- **WHEN** the student selects a different valid candidate
- **THEN** the system recomputes the future comparison without penalizing or blocking the student's choice

### Requirement: No adequate alternative
The system SHALL report when no candidate preserves the student's critical goals within their hard constraints.

#### Scenario: All candidates violate critical goals or constraints
- **WHEN** no supplied candidate passes the configured preservation threshold
- **THEN** the system states that no adequate alternative was found and suggests human or official-system verification instead of forcing a recommendation
