## ADDED Requirements

### Requirement: Side-by-side future comparison
The system SHALL compare two academically valid course-plan scenarios against the same student goal profile.

#### Scenario: Two plans are available
- **WHEN** the student selects or loads Plan A and Plan B
- **THEN** the system presents their consequences side by side using the same dimensions and evidence rules

### Requirement: Consequence dimensions
The comparison SHALL address skills, potential portfolio artifacts, opportunities unlocked, workload shape, option value, and uncertainty when evidence is available.

#### Scenario: Evidence exists across all dimensions
- **WHEN** both plans contain sufficient course evidence
- **THEN** the system explains the material differences for every required dimension

#### Scenario: A dimension lacks evidence
- **WHEN** reliable evidence is missing for a dimension
- **THEN** the system displays that dimension as unknown rather than fabricating or silently omitting it

### Requirement: Tradeoffs instead of a universal winner
The system SHALL explain which plan better supports each stated priority and MUST NOT present a universal winner when different priorities favor different plans.

#### Scenario: Plans optimize different goals
- **WHEN** Plan A better supports near-term portfolio evidence and Plan B better preserves graduate-study options
- **THEN** the system presents the tradeoff and ties any recommendation to the student's declared priority order

### Requirement: No opaque aggregate score
The system MUST NOT use a single unexplained numeric score as the primary decision output.

#### Scenario: Comparison calculations use internal weights
- **WHEN** internal weights contribute to ordering or emphasis
- **THEN** the interface exposes the contributing dimensions and describes how the student's priorities affected the result

### Requirement: Counterfactual explanation
The system SHALL explain the smallest important change between the two plans and the downstream consequences of that change.

#### Scenario: One elective differs
- **WHEN** Plan A and Plan B differ by one elective
- **THEN** the system identifies the elective and explains the skills, artifacts, opportunities, workload, and option-value changes attributable to the swap

### Requirement: Academic-validity boundary
The system SHALL label plan validity as supplied or assumed and MUST NOT claim to certify degree requirements, prerequisites, or registration eligibility.

#### Scenario: Demo plans are curated as valid
- **WHEN** a curated demo plan is displayed
- **THEN** the interface states the source and date of the validity assumption

#### Scenario: A user enters an unverified plan
- **WHEN** academic validity has not been checked by an authoritative system
- **THEN** the system warns the user to verify the plan in their institution's official degree-planning or registration system

### Requirement: Comparison refresh
The system SHALL recompute or reload the comparison when the student changes a plan, goal, or priority.

#### Scenario: Student changes the primary goal
- **WHEN** the student changes from internship readiness to graduate-research preparation
- **THEN** the comparison updates its emphasis and explanation while preserving the underlying evidence
