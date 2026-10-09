## ADDED Requirements

### Requirement: Manual constraint controls
The side panel SHALL provide controls for max credits, earliest start, unavailable days, required courses and excluded courses, validated with the shared constraint contract, and usable without any model.

#### Scenario: Model unavailable
- **WHEN** `LanguageModel.availability()` reports `unavailable`
- **THEN** the goal box explains that on-device AI is not supported on this device and all manual controls remain usable

#### Scenario: Contradictory manual input
- **WHEN** a course is marked both required and excluded
- **THEN** the change is rejected with a visible message and the previous constraints are kept

### Requirement: Goal interpretation proposes, never applies
A plain-language goal SHALL produce a proposed constraint patch shown as a diff against current controls. Constraints SHALL change only after explicit confirmation.

#### Scenario: Common preferences
- **WHEN** the student enters "no Friday classes, nothing before 10, at most 16 credits"
- **THEN** the proposal shows unavailable day Fri, earliest start 10:00 and max credits 16, and the controls are unchanged until the student confirms

#### Scenario: Ambiguous course reference
- **WHEN** the goal says "keep math" and several cart courses match
- **THEN** no course is locked and a clarification question lists the matching courses

#### Scenario: Unsupported fit goal
- **WHEN** the goal says "courses that prepare me for ML"
- **THEN** the goal appears as unresolved, with the note that course-content evidence is unavailable, and no course is ranked by fit

#### Scenario: Invalid or late model output
- **WHEN** the model output fails validation, times out after 10 s, or returns after the cart or constraints changed
- **THEN** it is discarded, constraints are unchanged, and an inline message is shown

### Requirement: Explicit model download
The extension SHALL NOT trigger an on-device model download without a user action.

#### Scenario: Downloadable model
- **WHEN** availability is `downloadable`
- **THEN** the goal box shows the download size note and a "Download on-device model" button, and no download starts until it is pressed

### Requirement: No goal data leaves the device
Goal text, cart data and constraints SHALL NOT be sent to any network endpoint by this feature.

#### Scenario: Network audit
- **WHEN** a goal is interpreted and a schedule is generated
- **THEN** the extension makes no network request attributable to this feature
