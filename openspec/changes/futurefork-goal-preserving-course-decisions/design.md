## Context

### Product context

Stellic already provides institutional-grade degree audits, multi-term planning, what-if pathways, prerequisite and requirement warnings, schedule generation, alternatives, advising coordination, and registration capabilities. Competing on those surfaces would make a hackathon prototype look incomplete while obscuring the student's unresolved decision:

> Of the plans that are academically valid, which one best supports what I want to learn, produce, and become?

FutureFork is a complementary decision layer. It compares the consequences of two valid course plans and recommends a goal-preserving swap or backup. Its job is not to certify the plan; its job is to make tradeoffs understandable and actionable.

The supporting evidence review is in [course-planning-research-source-list.md](../../../docs/course-planning-research-source-list.md).

### Challenge context

The Pathfinders Challenge is judged equally on:

1. whether the project solves a real student problem;
2. originality;
3. potential impact at scale;
4. design and experience quality;
5. build quality.

The submission requires a working link, a two-minute demo video, a 500-word write-up, and a tool list. The challenge page states that the submitted project must be newly built during the competition window, so eligibility and project boundaries must be resolved before implementation.

### Current project context

Albert Planner already imports NYU Albert course data, displays weekly schedules, detects conflicts, supports priority buckets and backup courses, exposes professor context, and stores planner data locally. These capabilities informed the concept, but the existing extension predates the competition and is not assumed to be the submission artifact.

### Primary stakeholders

- **Student:** Wants to choose among valid courses without reading every syllabus, forum, review, and career page.
- **Judge:** Needs to understand the problem, interaction, and value within two minutes.
- **Advisor:** Needs the product to preserve human authority around exceptions, ambiguous goals, and high-stakes decisions.
- **Course-data curator:** Needs a repeatable way to add evidence without turning unverified claims into facts.
- **Developer:** Needs a narrow, reliable vertical slice that can be polished before the deadline.

## Goals / Non-Goals

**Goals:**

- Demonstrate one memorable decision: compare two valid plans and understand their different futures.
- Explain consequences through skills, potential artifacts, opportunities, workload shape, option value, and uncertainty.
- Recommend one goal-preserving swap and one backup using explicit student priorities.
- Make evidence, assumptions, source types, freshness, and confidence inspectable.
- Deliver a complete two-minute demo without authentication or personal student records.
- Keep the architecture capable of later supporting additional majors and institutions.
- Preserve student agency: the system advises, the student chooses, and official systems verify.
- Meet a high visual, accessibility, and interaction-quality bar on desktop and mobile.

**Non-Goals:**

- Degree-audit calculation or certification.
- Prerequisite, substitution, residency, or graduation-rule adjudication.
- Course registration, waitlisting, or seat monitoring.
- Comprehensive NYU catalog ingestion.
- Transcript, GPA, or protected education-record storage.
- A general-purpose advising chatbot.
- “Easiest class,” “best professor,” or GPA-maximization recommendations.
- A campus social network, peer-matching system, or advisor case-management product.
- Population-level outcome prediction.
- Claims that a course guarantees a job, internship, admission, skill, or portfolio result.

## Product thesis

### Positioning

**Stellic answers:** “Will this path satisfy institutional rules, and can I register for it?”

**FutureFork answers:** “What will this valid path help me learn and demonstrate, which opportunities might it preserve or delay, and what changes if I choose another valid path?”

### Category recommendation

Submit under **College to Career** rather than Degree Planning & Discovery. The prototype still begins with courses, but its differentiated outcome is translating academic choices into skills, evidence, and future option value.

### Core feature

The single feature that must feel complete is the **goal-preserving counterfactual swap**:

1. Start with a proposed plan and an intended outcome.
2. Replace one course or mark it unavailable.
3. Compare the original and replacement plans.
4. Show what is preserved, improved, weakened, delayed, or uncertain.
5. Attach evidence and confidence to every consequential statement.

Everything else exists to make this feature understandable and credible.

## Primary user and demo scenario

### Initial target

An NYU undergraduate considering CS and math electives who is balancing:

- a near-term software or machine-learning internship;
- preparation for advanced coursework or graduate research;
- a manageable semester;
- continued freedom to explore.

This audience is narrow enough for curated evidence while demonstrating a problem that generalizes to other majors.

### Canonical demo persona

**Student:** Maya, a second-year CS/math student.  
**Goal:** “Prepare for an ML internship next summer without closing the door on graduate study.”  
**Constraints:** No Friday classes, moderate workload tolerance, prefers project-based evidence, must choose one of three curated electives.  
**Plan A:** More applied and project-oriented.  
**Plan B:** More mathematical and research-oriented.  
**Disruption:** The preferred elective becomes unavailable.  
**Resolution:** FutureFork suggests the closest goal-preserving backup and explains the consequences.

### Two-minute demo narrative

| Approximate time | Demo beat | What the judge should understand |
| --- | --- | --- |
| 0:00–0:15 | State the problem and select Maya | Valid schedules still hide meaningful consequences. |
| 0:15–0:35 | Confirm Maya's goals and constraints | The system optimizes against declared priorities, not a generic ranking. |
| 0:35–1:05 | Reveal Plan A versus Plan B | Each plan opens different skills, artifacts, workload, and future options. |
| 1:05–1:30 | Expand one evidence-backed claim | Recommendations have sources, dates, assumptions, and confidence. |
| 1:30–1:50 | Mark a course unavailable and apply a goal-preserving swap | The backup preserves outcomes, not merely a requirement slot. |
| 1:50–2:00 | Show the new comparison and closing statement | FutureFork complements institutional planning by explaining what valid choices mean. |

The demo MUST be rehearsable with deterministic sample data and MUST NOT depend on a live model response.

## Experience architecture

### Screen 1: Entry

Purpose:

- communicate the product in one sentence;
- offer “Try Maya's scenario” as the primary action;
- offer a lightweight manual path as secondary;
- state that FutureFork does not verify degree requirements.

Recommended headline:

> Compare the futures behind your next semester.

Recommended supporting line:

> See what each valid plan helps you learn, produce, and keep possible.

### Screen 2: Goal profile

The intake should take less than 45 seconds for a new user and less than 5 seconds for the demo persona.

Inputs:

- primary goal;
- secondary goal;
- areas of curiosity;
- learning-format preference;
- workload tolerance;
- practical schedule constraints;
- “keep this option open” priority.

The system presents the normalized profile in plain language before comparison:

> Prioritize internship-ready evidence, preserve graduate-study options, avoid very high deadline concentration, and prefer project-based courses.

### Screen 3: Future comparison

Use a side-by-side visual rather than chat bubbles.

Each plan should show:

- a short identity, such as “Ship sooner” or “Research depth”;
- the one or two courses creating the main difference;
- skills emphasized;
- plausible artifacts;
- opportunities unlocked or delayed;
- workload shape;
- option value;
- major uncertainties.

The comparison should emphasize differences, not repeat every shared attribute.

### Screen 4: Evidence drawer

Selecting a claim reveals:

- exact claim;
- source title and link;
- source type;
- reviewed date;
- confidence;
- system assumption;
- what the user should verify.

This is a trust surface, not a bibliography dump.

### Screen 5: Goal-preserving alternative

When a course becomes unavailable or the student requests a swap:

- show the top alternative;
- explain the preserved outcome;
- show the material loss or delay;
- expose rejected candidates and violated constraints;
- allow the student to choose a different candidate;
- recompute the future comparison.

### Empty, loading, and failure states

- Missing evidence becomes “We do not have enough evidence,” not a blank card.
- Model failure falls back to precomputed explanations.
- No acceptable alternative becomes an escalation state, not a forced recommendation.
- Unverified academic validity remains visible throughout the flow.
- A network failure must not break the curated demo path.

## Decisions

### Decision 1: Build a fresh standalone prototype

**Decision:** Treat the submission as a newly created TypeScript web application with a fresh repository or clearly isolated project boundary after eligibility confirmation.

**Rationale:**

- reduces risk from the challenge's “new project” rule;
- creates a judge-friendly link without requiring a browser extension;
- supports a responsive, presentation-focused experience;
- avoids coupling the demo to Albert DOM behavior or NYU authentication.

**Alternatives considered:**

- **Add the feature directly to Albert Planner:** Strong reuse, but high eligibility risk and unnecessary extension friction for judges.
- **Figma-only prototype:** Fast visual polish, but weaker build-quality evidence and no real comparison behavior.
- **Chatbot:** Fast to implement, but generic, hard to trust, and visually weak.

**Gate:** Do not implement until the user either receives organizer clarification or accepts the conservative fresh-project interpretation.

### Decision 2: Curated evidence before automated ingestion

**Decision:** Curate approximately 20–30 NYU CS/math course records and three complete demo scenarios.

**Rationale:**

- maximizes evidence quality and demo reliability;
- makes source review feasible within the competition window;
- avoids spending the hackathon on scraping and normalization;
- creates enough variety to demonstrate applied, theoretical, systems, and exploratory paths.

**Alternatives considered:**

- **Entire NYU catalog:** More impressive in quantity but likely shallow, inconsistent, and unfinished.
- **Live scraping:** Fragile, potentially disallowed by source terms, and unnecessary for the core interaction.
- **Pure model knowledge:** Quick but unauditable and likely to hallucinate current course facts.

### Decision 3: Evidence graph as the source of truth

**Decision:** Store normalized course, skill, artifact, opportunity, workload, and source records in version-controlled structured data.

**Rationale:**

- separates evidence from generated language;
- supports deterministic comparison and testing;
- enables provenance and freshness;
- creates a migration path to databases or institutional APIs later.

Suggested conceptual entities:

```ts
type Confidence = "high" | "medium" | "low";
type SourceKind =
  | "official-catalog"
  | "official-syllabus"
  | "instructor-material"
  | "aggregated-student-experience"
  | "derived-inference";

interface EvidenceRef {
  id: string;
  title: string;
  url: string;
  kind: SourceKind;
  reviewedAt: string;
}

interface CourseEvidence {
  courseId: string;
  title: string;
  termContext?: string;
  skills: EvidenceClaim[];
  artifacts: EvidenceClaim[];
  opportunities: EvidenceClaim[];
  workload: WorkloadProfile;
  timingNotes: EvidenceClaim[];
  sourceIds: string[];
  reviewedAt: string;
}

interface EvidenceClaim {
  statement: string;
  sourceIds: string[];
  confidence: Confidence;
  assumption?: string;
}
```

The final field names may change, but provenance and claim-level confidence are required invariants.

### Decision 4: Deterministic comparison with bounded model assistance

**Decision:** Use deterministic application logic to retrieve evidence, aggregate dimensions, identify differences, filter candidates, and construct the comparison payload; use a language model only for structured goal normalization and concise explanation.

**Rationale:**

- keeps the demo reliable;
- permits repeatable tests;
- prevents generated prose from inventing the decision structure;
- allows precomputed explanations as a fallback.

Recommended processing pipeline:

1. Validate the goal profile.
2. Validate Plan A and Plan B course identifiers.
3. Retrieve curated course evidence.
4. Aggregate each plan by dimension without losing claim provenance.
5. Compute shared attributes and material differences.
6. Apply explicit hard constraints.
7. Rank candidate alternatives by priority-weighted preservation.
8. Create a structured comparison payload.
9. Optionally ask the model to transform the payload into concise explanatory text.
10. Validate model output and attach the original evidence references.

The model MUST NOT:

- decide whether a course satisfies a degree requirement;
- invent course attributes or sources;
- infer protected traits;
- provide unsupported job or admission predictions;
- override hard constraints;
- silently convert missing evidence into certainty.

### Decision 5: Explainable multidimensional output

**Decision:** Do not expose one overall plan score.

**Rationale:**

- different priorities legitimately produce different preferred plans;
- aggregate scores hide normative choices;
- the comparison itself is the value;
- visible dimensions create a stronger visual demo.

Internal weighting is allowed only to select emphasis or rank alternatives. The user's priority inputs and the contributing dimensions must remain visible.

### Decision 6: Goal preservation, not course similarity

**Decision:** Rank alternatives based on preserved student outcomes after hard-constraint filtering, rather than title similarity or shared keywords.

Example:

- Original course produces a substantial software artifact and supports an internship goal.
- Candidate A covers similar theory but has no project evidence.
- Candidate B has a different topic but produces a comparable artifact and satisfies the student's schedule.

FutureFork may prefer Candidate B for this student while explaining that the theoretical content changed.

This is the primary distinction from requirement-equivalent substitution.

### Decision 7: Sample-first privacy

**Decision:** The hackathon prototype uses sample personas and manually selected plans; no account, transcript, GPA, or institution login is required.

**Rationale:**

- avoids unnecessary FERPA and security complexity;
- eliminates judge onboarding friction;
- keeps the prototype credible within the available time;
- permits a later local-first or institution-integrated architecture.

If free-text goals are sent to a model provider, the UI must disclose that fact and avoid encouraging sensitive personal information.

### Decision 8: Demo reliability over live novelty

**Decision:** The core demo runs entirely from bundled, validated data with precomputed comparison output available as fallback.

**Rationale:**

- a live API outage cannot be allowed to ruin the two-minute presentation;
- deterministic output makes visual timing and testing possible;
- judges still see real interactive state changes.

The live model path can be demonstrated as an enhancement, not a prerequisite.

## Proposed technical architecture

### Recommended deployment shape

- Fresh TypeScript web application.
- React-based responsive interface.
- Static curated evidence bundled at build time for the demo.
- One narrow serverless endpoint for optional model-assisted goal normalization or explanation.
- Schema validation at data load and model boundaries.
- Static hosting or Vercel deployment with a shareable URL.

The exact framework and component library are deferred until the project-boundary gate; the architecture does not require a database for the hackathon slice.

### Logical modules

| Module | Responsibility |
| --- | --- |
| `goal-profile` | Parse, validate, edit, and summarize student priorities and constraints. |
| `course-evidence` | Load and validate curated evidence and source records. |
| `plan-comparison` | Aggregate plan evidence and calculate shared versus different consequences. |
| `alternative-engine` | Apply hard constraints and rank goal preservation. |
| `explanation` | Produce concise evidence-linked language from structured results. |
| `demo-scenarios` | Provide deterministic personas, plans, disruptions, and expected results. |
| `ui` | Render intake, comparison, evidence, and alternative interactions. |
| `telemetry` | Capture anonymous demo completion and failure signals if explicitly enabled. |

### Suggested plan comparison payload

```ts
interface PlanComparison {
  profileId: string;
  planA: PlanOutcome;
  planB: PlanOutcome;
  materialDifferences: ConsequenceDifference[];
  recommendation?: Recommendation;
  assumptions: string[];
  validityBoundary: string;
}

interface PlanOutcome {
  planId: string;
  label: string;
  skills: EvidenceClaim[];
  artifacts: EvidenceClaim[];
  opportunities: EvidenceClaim[];
  workload: WorkloadProfile;
  optionValue: EvidenceClaim[];
  uncertainties: EvidenceClaim[];
}

interface Recommendation {
  favoredPlanId?: string;
  rationaleByPriority: PriorityRationale[];
  preserved: EvidenceClaim[];
  weakened: EvidenceClaim[];
  verificationSteps: string[];
}
```

### Alternative ranking approach

The prototype can use a transparent weighted preservation calculation:

1. Remove candidates violating hard constraints.
2. Calculate per-priority preservation in the range 0–1 using curated mappings.
3. Penalize missing evidence rather than treating it as a match.
4. Apply the student's visible priority weights.
5. Prefer the candidate with the strongest minimum performance across critical priorities.
6. Break close ties by lower uncertainty, not model preference.

This calculation is a recommendation aid, not a prediction of student success.

### Data curation workflow

For each course:

1. Record official identity and description.
2. Add available syllabus or instructor material.
3. Extract candidate skills and artifacts.
4. Identify prerequisite chains or downstream courses only from authoritative sources.
5. Add workload evidence from appropriate aggregated sources where available.
6. Separate facts from inference.
7. Assign confidence.
8. Run schema and source-link validation.
9. Review the course as part of at least one demo comparison.

No source should be added only to make a desired recommendation look stronger.

## Design direction

### Visual metaphor

Use a branching-path or split-future metaphor without turning the product into a literal road-map illustration. The interface should feel analytical, optimistic, and calm.

### Information hierarchy

1. The student's stated goal.
2. The one decision creating the fork.
3. The consequences that materially differ.
4. The recommendation tied to priorities.
5. Evidence and uncertainty.

### Interaction principles

- Prefer direct manipulation and comparison over conversation.
- Reveal evidence progressively.
- Use plain language before academic or AI terminology.
- Use color as reinforcement, never as the only distinction.
- Keep Plan A and Plan B spatially stable during comparison.
- Animate changed consequences after a swap, but respect reduced-motion preferences.
- Never hide a negative tradeoff to make the recommendation appear stronger.

### Accessibility requirements

- Full keyboard access for profile, plan, evidence, and alternative controls.
- Semantic headings and landmarks.
- Visible focus states.
- Sufficient color contrast.
- Text alternatives for visual comparison markers.
- Reduced-motion support.
- Responsive layout that converts side-by-side panels into a clear ordered comparison on narrow screens.

## Privacy and security

- Do not require authentication for the demo.
- Do not collect transcripts, GPA, student IDs, or registration data.
- Keep sample data clearly fictional.
- Validate all free-text and model inputs at boundaries.
- Rate-limit any public model endpoint.
- Keep model credentials server-side.
- Do not log raw free-text goals by default.
- If analytics are used, collect only coarse anonymous interaction events and provide a no-analytics path.
- Sanitize rendered model output and never render model-produced HTML.
- Keep source URLs allow-listed or rendered safely to prevent unsafe redirects.

## Verification strategy

### Unit tests

- Goal-profile validation and priority normalization.
- Evidence-schema validation.
- Plan aggregation and difference detection.
- Hard-constraint filtering.
- Goal-preservation ranking.
- Missing-evidence penalties.
- Confidence propagation.
- Model-output rejection and fallback.

### Scenario tests

- Internship priority favors applied evidence while preserving visible research tradeoffs.
- Graduate-research priority changes the recommendation without changing evidence.
- An unavailable course produces an acceptable goal-preserving backup.
- No adequate backup produces an explicit escalation.
- Stale or missing evidence reduces confidence.
- Unverified plan validity triggers the official-system boundary.

### Interface tests

- Demo persona reaches comparison in one action.
- Evidence drawer exposes source, type, date, and confidence.
- Changing a goal recomputes the result.
- Applying a swap highlights changed consequences.
- Keyboard-only flow is complete.
- Mobile comparison remains understandable.
- Reduced-motion mode avoids nonessential animation.

### Demo acceptance tests

- Fresh browser completes the canonical flow in under two minutes.
- The demo works without a model API response.
- Every visible consequential claim opens to supporting evidence.
- The fallback path is visually identical to the live path.
- No loading state lasts long enough to disrupt narration.
- The deployed link works in an incognito window without login.

## Success criteria

### Product success for the prototype

- At least 80% of five informal evaluators can explain the difference between FutureFork and a degree planner after one viewing.
- At least four of five can identify the main tradeoff between the demo plans without prompting.
- At least four of five can locate the evidence supporting a recommendation.
- The canonical task can be completed in under two minutes.
- No evaluator interprets the prototype as certifying degree requirements.

These are directional hackathon checks, not statistically significant user research.

### Technical success

- All curated data validates at build time.
- Comparison and alternative tests are deterministic.
- The application builds and deploys from a clean checkout.
- The demo remains functional when the model endpoint is disabled.
- No known high-severity accessibility, privacy, or security issue remains.

### Submission success

- Working public link.
- Two-minute video with readable UI.
- 500-word problem, user, solution, differentiation, and impact write-up.
- Complete tool and data-source disclosure.
- Backup video and local demo.
- Submission completed before the final-day buffer.

## Risks / Trade-offs

- **[Eligibility risk] The existing Albert Planner predates the competition.**  
  → Confirm with organizers or build a clearly new standalone project; keep this repository as planning context only.

- **[Competitive overlap] Stellic describes plans aligned with goals and careers.**  
  → Focus the demo on evidence-linked counterfactual consequences and goal-preserving swaps, not generic goal alignment.

- **[Evidence burden] Course experience is difficult to represent accurately.**  
  → Use a small curated dataset, separate source types, label inference, and show missing evidence.

- **[Overclaiming] Skills and artifacts may depend on instructor, section, or student choices.**  
  → Use “may,” “typically,” or “potential artifact” where appropriate and attach term context.

- **[Model hallucination] Generated explanations may introduce unsupported claims.**  
  → Generate only from structured claims, validate output, attach existing evidence IDs, and provide deterministic fallback text.

- **[Normative weighting] Any recommendation encodes values.**  
  → Make student priorities visible and editable; present tradeoffs instead of a universal ranking.

- **[Scope expansion] Career data, syllabi, reviews, requirements, and schedules can become a platform-sized ingestion project.**  
  → Freeze the dataset and demo scenarios early; treat additional coverage as post-submission work.

- **[Demo fragility] Live APIs or model latency may break the presentation.**  
  → Bundle demo data and precomputed outputs; rehearse an offline path.

- **[Visual overload] Six comparison dimensions can become unreadable.**  
  → Lead with the three material differences and progressively disclose the rest.

- **[Privacy drift] Personalization can tempt transcript or GPA ingestion.**  
  → Keep the hackathon version sample-first and manual; treat education-record access as a future institutional integration.

- **[False career precision] Course-to-job mappings can imply guaranteed outcomes.**  
  → Describe skill and evidence alignment, not employment probability.

## Migration / rollout plan

There is no production migration in the hackathon phase.

Recommended rollout:

1. Confirm eligibility and project boundary.
2. Create the fresh implementation repository.
3. Build with sample data and no external model.
4. Add deterministic comparison and alternatives.
5. Add bounded model assistance behind a feature flag.
6. Deploy a private preview and complete interface QA.
7. Run five informal comprehension checks.
8. Freeze features.
9. Record the demo and create the submission package.
10. Deploy the final public version.

Rollback strategy:

- Disable model assistance and use precomputed explanations.
- Revert to the last validated evidence dataset.
- Keep a static demo build and recorded video available.

## Open questions and decision gates

### Gate 1: Eligibility and ownership

- Does extending an existing project violate the “new project” rule?
- Can generic code or design patterns from Albert Planner be reused?
- Should the implementation live in a brand-new repository?

**Recommendation:** Assume a new standalone repository unless the organizers provide written approval otherwise.

### Gate 2: Demo outcome

- Should the canonical goal be ML internship readiness, graduate research, or a tension between both?

**Recommendation:** Use the tension between internship readiness and graduate-study option value because it produces a visible, nontrivial tradeoff.

### Gate 3: Course coverage

- Which 20–30 NYU CS/math courses provide enough contrasting evidence?
- Are syllabi and learning outcomes publicly available for those courses?

**Recommendation:** Select courses only after defining three complete comparison stories; coverage exists to support the stories, not the reverse.

### Gate 4: Career evidence source

- Should career-skill mappings use public occupational data, curated role descriptions, or only course outcomes?

**Recommendation:** Use a small curated skill taxonomy and public role descriptions, avoiding labor-market predictions in the prototype.

### Gate 5: Model provider and disclosure

- Is live model assistance worth the latency and privacy complexity?

**Recommendation:** Make the deterministic experience complete first, then add the challenge-provided model credits only for goal normalization or explanation.

### Gate 6: Product name

- Is “FutureFork” memorable and sufficiently distinct from the Pathfinders challenge branding?

**Recommendation:** Treat FutureFork as a working name and perform naming/domain checks before visual branding.

### Gate 7: Relationship to Albert Planner

- Is this a standalone experiment, a future companion, or the long-term evolution of Albert Planner?

**Recommendation:** Decide after the challenge; do not let long-term integration complicate the hackathon build.
