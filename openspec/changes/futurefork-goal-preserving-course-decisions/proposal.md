## Why

Students can use Stellic and other institutional systems to determine whether a course plan is valid, but they still lack a clear way to compare what two valid plans will help them learn, produce, and become. The Pathfinders Challenge creates an opportunity to demonstrate a complementary decision layer that explains personal, academic, and career consequences without rebuilding degree audit, scheduling, or registration.

## What Changes

- Introduce **FutureFork**, a provisional standalone hackathon experience for comparing two academically valid course-plan scenarios against a student's stated goals and constraints.
- Let a student define a compact goal profile covering intended outcomes, interests, workload tolerance, learning preferences, and constraints.
- Translate course and plan evidence into an understandable comparison of skills, portfolio artifacts, opportunities unlocked, workload shape, option value, and uncertainty.
- Recommend one high-leverage course swap and one goal-preserving backup while explaining what changes and what remains equivalent.
- Attach provenance, confidence, assumptions, and verification guidance to consequential claims.
- Provide a polished sample-data path that can be completed in a two-minute judging demo.
- Explicitly exclude degree-audit calculation, automated registration, institution-wide ingestion, transcript storage, social networking, and generalized chatbot behavior from the hackathon scope.
- Keep implementation gated on confirming challenge eligibility and choosing a fresh project boundary because the existing Albert Planner predates the competition.

## Capabilities

### New Capabilities

- `student-goal-profile`: Capture the student's intended outcomes, interests, constraints, and relative priorities in a compact, editable structure.
- `counterfactual-plan-comparison`: Compare two valid course-plan scenarios and explain their different consequences without collapsing them into one opaque score.
- `evidence-backed-course-intelligence`: Represent course-derived skills, artifacts, opportunities, workload signals, sources, assumptions, and confidence.
- `goal-preserving-alternatives`: Recommend and explain course swaps or backups that preserve the student's intended outcome as closely as possible.

### Modified Capabilities

None. The proposal does not change the requirements of the existing Albert Planner extension.

## Impact

- **Product:** Creates a new College-to-Career concept positioned as complementary to Stellic's Progress and Registration products.
- **User experience:** Adds a goal intake, side-by-side future comparison, evidence inspection, and explained swap flow.
- **Data:** Requires a small curated dataset of approximately 20–30 NYU CS/math courses, a controlled goal/skill taxonomy, source provenance, and several demo personas.
- **AI:** May use a language model for bounded goal normalization or explanation within validated schemas; deterministic application logic remains responsible for comparison structure, alternative ranking inputs, and safety checks.
- **Privacy:** The prototype should use sample or manually entered planning data and avoid transcript, GPA, or protected education-record ingestion.
- **Code:** No existing extension implementation is changed by this planning proposal; the implementation target remains a decision gate.
- **Operations:** A live demo link, two-minute video, concise write-up, attribution list, and fallback recorded path are required for the challenge submission.
