## ADDED Requirements

### Requirement: Complete bounded search
Schedule generation SHALL explore section combinations under the confirmed constraints, choosing at most one section per course code, until it is exhausted or reaches the node limit.

#### Scenario: Greedy misses, search finds
- **WHEN** a fixture has a feasible combination that the greedy order skips (the first-priority section blocks two later courses)
- **THEN** search returns the feasible combination

#### Scenario: Required course cannot fit
- **WHEN** a required course has no section compatible with the other constraints
- **THEN** generation fails visibly, names the course and the blocking constraint, and does not silently drop it

#### Scenario: Truncated search
- **WHEN** the node limit is reached
- **THEN** the result is labeled "Search stopped early — results may be incomplete" and never says that no schedule fits

### Requirement: Ranked alternatives with stated order
The planner SHALL return up to 3 distinct alternatives sorted by a fixed, displayed order and SHALL NOT label any result as best or optimal.

#### Scenario: Several feasible schedules
- **WHEN** more than 3 feasible combinations exist
- **THEN** the top 3 are shown, with a line stating the sort order

### Requirement: Computed explanations
Each alternative SHALL list every cart course as included, skipped with a reason, or unknown (TBA), with text rendered from computed facts.

#### Scenario: TBA section
- **WHEN** a section's meeting time is TBA
- **THEN** it is not auto-selected and appears under unknowns with "Meeting times are unconfirmed"

### Requirement: Preview before apply
Alternatives SHALL NOT change the planner selection until the student applies one, and applying SHALL recheck that the cart has not changed.

#### Scenario: Cart changed after preview
- **WHEN** the cart is re-imported after alternatives were shown
- **THEN** applying is blocked and the student is asked to regenerate
