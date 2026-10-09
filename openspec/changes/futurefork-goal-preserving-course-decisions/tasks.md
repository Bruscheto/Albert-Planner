This schedule is intentionally approximate. Adjacent phases may overlap, but each phase has a cut line so the project can remain submission-ready if later work slips.

## 1. Eligibility and scope gates (July 30–August 1)

- [ ] 1.1 Ask the Pathfinders organizers whether extending or reusing code from the pre-existing Albert Planner is eligible, and retain the written answer
- [ ] 1.2 Choose a conservative fresh-project boundary if organizer clarification is unavailable
- [ ] 1.3 Confirm College to Career as the submission category and write the one-sentence differentiation from Stellic
- [ ] 1.4 Freeze the canonical demo problem, persona, two plans, disruption, and resolution
- [ ] 1.5 Decide whether FutureFork remains the working name and perform basic product-name and domain-conflict checks
- [ ] 1.6 Record the exact minimum submission requirements, deadline, time zone, and ownership or disclosure obligations

## 2. Fresh project foundation (July 31–August 2)

- [ ] 2.1 Create the fresh TypeScript application in the approved project boundary
- [ ] 2.2 Configure formatting, linting, type checking, unit tests, and a production build
- [ ] 2.3 Add schema validation for application data and external model output
- [ ] 2.4 Establish the module boundaries for goal profiles, course evidence, comparisons, alternatives, demo scenarios, and UI
- [ ] 2.5 Configure a preview deployment and verify it from a clean incognito session
- [ ] 2.6 Add a CI path that runs formatting checks, lint, type checking, tests, and build
- [ ] 2.7 Document the sample-data privacy boundary and disable raw free-text logging

## 3. Demo story and evidence dataset (August 1–4)

- [ ] 3.1 Define the controlled skill, artifact, opportunity, workload, and option-value taxonomies
- [ ] 3.2 Define the evidence-source, confidence, freshness, and assumption fields
- [ ] 3.3 Select the minimum 12 courses required for the canonical comparison and two backup scenarios
- [ ] 3.4 Curate official catalog and syllabus evidence for the minimum course set
- [ ] 3.5 Add workload evidence while keeping time, cognitive effort, stress concentration, collaboration, and schedule friction separate
- [ ] 3.6 Mark every course claim as fact, aggregated experience, or inference and attach its source identifiers
- [ ] 3.7 Add reviewed dates and term context to time-sensitive evidence
- [ ] 3.8 Create Maya's goal profile, Plan A, Plan B, disruption, candidate alternatives, and expected comparison
- [ ] 3.9 Create two secondary demo profiles that exercise different priority orderings
- [ ] 3.10 Add build-time validation that rejects missing sources, invalid course identifiers, malformed confidence values, and stale required demo data
- [ ] 3.11 Expand toward 20–30 courses only after the canonical comparison is complete and reviewed

## 4. Static vertical slice (August 2–6)

- [ ] 4.1 Establish visual tokens for typography, spacing, color, focus, motion, confidence, and plan identity
- [ ] 4.2 Build the entry screen with the product promise, demo-persona action, manual path, and academic-validity disclaimer
- [ ] 4.3 Build the compact goal-profile interface and its plain-language confirmation summary
- [ ] 4.4 Build the side-by-side Plan A and Plan B comparison using deterministic fixture data
- [ ] 4.5 Build consequence sections for skills, artifacts, opportunities, workload, option value, and uncertainty
- [ ] 4.6 Build the evidence drawer with source, source type, review date, assumption, confidence, and verification guidance
- [ ] 4.7 Build the course-unavailable interaction and goal-preserving alternative panel using fixture data
- [ ] 4.8 Build explicit missing-evidence, stale-evidence, no-alternative, and offline states
- [ ] 4.9 Verify that the complete fixture-based demo can be narrated in under two minutes

## 5. Deterministic comparison engine (August 5–10)

- [ ] 5.1 Write failing tests for goal-profile validation, priority preservation, and unknown preferences
- [ ] 5.2 Implement the typed goal-profile model and validation
- [ ] 5.3 Write failing tests for evidence aggregation and claim-level provenance
- [ ] 5.4 Implement course-evidence loading, validation, and indexing
- [ ] 5.5 Write failing tests for shared versus material consequence detection
- [ ] 5.6 Implement plan aggregation and side-by-side difference calculation
- [ ] 5.7 Implement missing-evidence and confidence propagation without manufacturing defaults
- [ ] 5.8 Write failing tests for hard-constraint exclusion and goal-preservation ranking
- [ ] 5.9 Implement transparent alternative filtering and per-priority preservation calculation
- [ ] 5.10 Implement close-tie resolution based on lower uncertainty
- [ ] 5.11 Implement the explicit no-adequate-alternative outcome
- [ ] 5.12 Connect the comparison engine to the vertical-slice interface
- [ ] 5.13 Verify that changing a goal, priority, plan, or alternative recomputes the visible consequences

## 6. Bounded AI assistance (August 9–12, optional cut line)

- [ ] 6.1 Define the narrow model tasks: goal normalization and concise explanation only
- [ ] 6.2 Create redacted structured prompts that contain only validated profile and evidence data
- [ ] 6.3 Implement the server-side model endpoint with secret isolation, input limits, timeout, and rate limiting
- [ ] 6.4 Validate all model output against the comparison or explanation schema
- [ ] 6.5 Reject unknown evidence identifiers, unsupported claims, malformed output, and instruction leakage
- [ ] 6.6 Implement deterministic explanation fallback for timeout, quota, validation, or network failure
- [ ] 6.7 Add tests proving that disabling the model leaves the canonical demo complete
- [ ] 6.8 Add a clear disclosure when user-entered goal text is sent to an external model
- [ ] 6.9 Remove this phase from the submission build if it reduces reliability or polish

## 7. Interaction and visual polish (August 11–15)

- [ ] 7.1 Reduce the first comparison view to the three most material differences with progressive disclosure
- [ ] 7.2 Add restrained transitions that clarify which consequences changed after a swap
- [ ] 7.3 Keep Plan A and Plan B spatially stable during comparison updates
- [ ] 7.4 Implement responsive behavior for desktop, tablet, and narrow mobile layouts
- [ ] 7.5 Complete keyboard navigation and visible focus states
- [ ] 7.6 Add semantic landmarks, headings, labels, and screen-reader text for visual comparison cues
- [ ] 7.7 Verify contrast and implement reduced-motion behavior
- [ ] 7.8 Refine loading, error, empty, stale, and offline states to match the main experience
- [ ] 7.9 Optimize fonts, images, scripts, and initial data so the deployed demo loads predictably
- [ ] 7.10 Perform a content pass to remove jargon, unsupported certainty, generic AI language, and duplicated explanations

## 8. Product validation and quality assurance (August 15–18)

- [ ] 8.1 Run five informal evaluator sessions using the two-minute demo flow
- [ ] 8.2 Measure whether evaluators understand the product's difference from degree planning
- [ ] 8.3 Measure whether evaluators can identify the main tradeoff and find its evidence
- [ ] 8.4 Record confusion, trust concerns, missing information, and moments that exceed the demo timing
- [ ] 8.5 Fix critical comprehension and trust failures before adding any new feature
- [ ] 8.6 Run unit, scenario, interface, accessibility, type, lint, and production-build checks
- [ ] 8.7 Test the deployed experience in incognito mode, on a second device, and with the model endpoint disabled
- [ ] 8.8 Review the application for exposed credentials, unsafe output rendering, unnecessary data collection, and broken source links
- [ ] 8.9 Verify every consequential claim in the canonical demo has an inspectable source or explicit low-confidence label
- [ ] 8.10 Freeze the dataset, behavior, and visual structure after the critical findings are resolved

## 9. Submission production (August 17–20)

- [ ] 9.1 Draft the 500-word write-up covering problem, target student, solution, differentiation, evidence, scalability, and limitations
- [ ] 9.2 Create a two-minute storyboard with narration, cursor path, timing, and the exact final sentence
- [ ] 9.3 Record a clean demo at readable resolution without personal notifications or credentials
- [ ] 9.4 Add captions and verify that the video remains understandable without audio
- [ ] 9.5 Create the complete list of libraries, AI tools, public data, sources, and reused open-source material
- [ ] 9.6 Capture final screenshots and a short fallback recording
- [ ] 9.7 Verify the public deployment, video link, repository permissions, and submission text from a logged-out session
- [ ] 9.8 Submit before August 20 if possible, preserving August 21 as contingency rather than planned production time

## 10. Final contingency and handoff (August 21)

- [ ] 10.1 Re-run the critical demo and deployment smoke checks without changing scope
- [ ] 10.2 Use the static comparison fallback if model reliability has degraded
- [ ] 10.3 Correct only submission-blocking defects and avoid last-day redesigns
- [ ] 10.4 Confirm the submission receipt and preserve the final build, video, write-up, and source manifest
- [ ] 10.5 Record deferred ideas and evaluator feedback separately from the submitted version

## 11. Explicit post-submission backlog

- [ ] 11.1 Evaluate institution-agnostic course and syllabus ingestion
- [ ] 11.2 Explore an approved Stellic or institutional-data integration
- [ ] 11.3 Test local transcript import only after privacy, consent, and retention requirements are defined
- [ ] 11.4 Expand beyond CS/math after validating the taxonomy with another discipline
- [ ] 11.5 Investigate advisor-facing review and correction workflows
- [ ] 11.6 Evaluate whether the concept should remain standalone, become an Albert Planner companion, or inform a separate product
