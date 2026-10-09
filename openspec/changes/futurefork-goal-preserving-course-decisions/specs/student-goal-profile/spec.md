## ADDED Requirements

### Requirement: Compact editable goal profile
The system SHALL let a student create and edit a goal profile containing an intended outcome, areas of interest, workload tolerance, learning preferences, practical constraints, and relative priorities.

#### Scenario: Student creates a profile
- **WHEN** a student completes the goal intake with at least one intended outcome and one priority
- **THEN** the system stores a structured profile and displays a plain-language summary for confirmation

#### Scenario: Student revises a profile
- **WHEN** a student changes a goal, constraint, or priority
- **THEN** the system updates the profile and clearly marks existing comparisons as needing refresh

### Requirement: Priority tradeoffs remain visible
The system SHALL preserve the student's relative priorities as separate dimensions rather than collapsing them into an unexplained preference label.

#### Scenario: Competing priorities are entered
- **WHEN** a student values both near-term internship readiness and graduate-school option value
- **THEN** the system displays both priorities and uses them independently in plan comparisons

### Requirement: Demo presets and manual input
The system SHALL provide curated demo profiles and a short manual-input path so judges can experience the core feature without supplying personal academic data.

#### Scenario: Judge chooses a demo profile
- **WHEN** a judge selects a predefined CS/math persona
- **THEN** the system loads a complete goal profile and proceeds to the plan comparison without authentication

#### Scenario: Student chooses manual input
- **WHEN** a student declines a preset
- **THEN** the system accepts a minimal goal statement and constraints without requiring a transcript, GPA, or institution login

### Requirement: No sensitive-trait inference
The system MUST NOT infer protected or sensitive personal traits from the student's goals, course choices, or free-text input.

#### Scenario: Free text contains ambiguous personal context
- **WHEN** the student's text could support an inference about a protected or sensitive trait
- **THEN** the system ignores that inferred trait and bases the comparison only on explicitly selected academic and practical preferences

### Requirement: Profile uncertainty
The system SHALL distinguish explicit student preferences from assumptions introduced by defaults or incomplete input.

#### Scenario: Workload tolerance is omitted
- **WHEN** a student does not specify workload tolerance
- **THEN** the system labels the workload preference as unknown and avoids presenting a personalized workload recommendation as certain
