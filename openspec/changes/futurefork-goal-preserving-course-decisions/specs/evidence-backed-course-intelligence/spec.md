## ADDED Requirements

### Requirement: Structured course evidence
The system SHALL represent course evidence in a structured, versioned record containing course identity, term context, skills, potential artifacts, opportunities, workload signals, prerequisites or timing notes, and sources.

#### Scenario: Curator adds a course
- **WHEN** a course is added to the prototype dataset
- **THEN** the record passes schema validation and includes a last-reviewed date

### Requirement: Claim provenance
Every consequential comparison or recommendation claim SHALL identify the evidence records and source types that support it.

#### Scenario: Student opens an explanation
- **WHEN** the student expands a skill, workload, opportunity, or artifact claim
- **THEN** the system shows its supporting source, source type, review date, and confidence level

### Requirement: Source-type distinction
The system SHALL distinguish authoritative institutional information, instructor or syllabus material, aggregated student experience, and model-derived inference.

#### Scenario: Sources disagree
- **WHEN** an official description and student-experience source provide different signals
- **THEN** the system preserves both signals, labels their source types, and explains rather than erases the disagreement

### Requirement: Multidimensional workload
The system SHALL represent workload using separate dimensions for time demand, cognitive effort, stress or deadline concentration, collaboration, and schedule friction when evidence is available.

#### Scenario: Two courses have equal credits
- **WHEN** two courses carry the same credit value but have different workload evidence
- **THEN** the system displays the differing workload shapes without treating credits as equivalent workload

### Requirement: Confidence and missing evidence
The system SHALL assign an understandable confidence level to derived claims and SHALL display missing or weak evidence explicitly.

#### Scenario: Claim relies on one inferred source
- **WHEN** a claim is supported only by model inference from a single description
- **THEN** the system marks the claim low confidence and avoids using it as the sole basis for a strong recommendation

### Requirement: Validated model output
Any model-generated structured data SHALL be validated against the application schema before it affects a comparison or recommendation.

#### Scenario: Model output is malformed
- **WHEN** model output fails schema validation or contains unknown course identifiers
- **THEN** the system rejects the output and falls back to curated data or an explicit unavailable state

### Requirement: Evidence freshness
The system SHALL expose the review date of course and opportunity evidence and distinguish stable curriculum information from term-sensitive information.

#### Scenario: Term-sensitive evidence is stale
- **WHEN** instructor, offering, or schedule evidence is older than the configured freshness threshold
- **THEN** the system labels it stale and does not present it as confirmed-current
