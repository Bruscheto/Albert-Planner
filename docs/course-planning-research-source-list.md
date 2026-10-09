# Course Planning Product Research: Questions, Findings, and Sources

Research date: July 30, 2026  
Scope: NYU and general undergraduate course discovery, degree planning, registration, advising, and AI-assisted recommendations.

## What we wanted to learn before designing the product

| Research question | Why it matters to the product |
| --- | --- |
| How do students actually choose courses? | The recommender must account for requirements, interests, workload, instructor, meeting time, peer signals, and future goals instead of optimizing a single score. |
| Where does the current workflow break? | We need to distinguish missing capabilities from fragmentation between catalogs, audits, planners, registration systems, reviews, spreadsheets, and advisors. |
| How do students plan under uncertainty? | TBA instructors, changing offerings, full sections, prerequisites, conflicts, and exceptions require backup plans and explicit confidence levels. |
| What do official NYU systems already provide? | Rebuilding degree audits, four-year planning, or schedule generation would duplicate NYU's ongoing Stellic rollout. |
| What work requires human advising judgment? | Waivers, transfer credit, unusual sequences, sensitive goals, and school-specific policy interpretations need escalation rather than confident automation. |
| What information changes student decisions? | The product should expose decision-relevant evidence such as cognitive effort, stress, workload, and fit, not only credits or average grades. |
| What would make an AI recommendation trustworthy? | Students need provenance, understandable reasoning, editable assumptions, privacy boundaries, alternatives, and a clear path to verify high-stakes claims. |
| What outcome would demonstrate value? | Useful measures include time saved, fewer unresolved conflicts, plan stability, requirement coverage, informed backup selection, and confidence—not just clicks or generated schedules. |

## What desk research can and cannot replace

This research is sufficient to identify recurring problems, map official workflows, study existing products, and define prototype hypotheses without beginning with a large interview round.

It does **not** replace direct validation of:

- what current NYU students privately do when official tools fail;
- which data they would permit an AI tool to read, retain, or send to a server;
- whether they trust recommendations enough to change enrollment decisions;
- how advisors handle ambiguous rules and exceptions in practice;
- differences among schools, majors, class years, international students, transfer students, and students with accommodations;
- whether the proposed experience is understandable when students use a real prototype;
- willingness to adopt, return, or pay.

The practical conclusion is to use these sources to narrow the concept first, then run a small number of targeted validation sessions around the remaining unknowns instead of asking broad discovery questions that public evidence already answers.

## Findings that should shape the product direction

1. **NYU is already buying much of the planning layer.** NYU's phased Stellic rollout includes degree audits, multi-term plans, requirement and prerequisite warnings, what-if pathways, schedule generation, backup sections, and eventually registration.
2. **The near-term opportunity is a bridge and decision-intelligence layer.** Albert Planner can help students move from imported registration data to evidence-backed choices about workload, instructor, fit, tradeoffs, and alternatives while Albert and Stellic coexist.
3. **Fragmentation is a demonstrated problem.** Students and NYU's own usability study describe moving among official screens, calendars, notes, spreadsheets, peer advice, and course evaluations.
4. **Course load is not captured by credits alone.** Published studies distinguish time demand, mental effort, and psychological stress, and show that these dimensions can change course choices.
5. **Recommendations can cause harm even when the data is accurate.** A field experiment found that exposure to grade information in a course-planning tool reduced average GPA, so the interface must be designed around healthy decisions rather than “easy course” optimization.
6. **The consideration stage is a useful intervention point.** Students consider a small subset of the catalog, and that early set is associated with later major choice; discovery quality therefore matters before schedule optimization begins.
7. **Context improves AI advice, but it does not eliminate verification.** Transcript, plan, prerequisite, and goal context can make answers more relevant, while policy exceptions and current offerings still need authoritative sources or human escalation.
8. **Advising is relational as well as informational.** A product can organize facts and surface tradeoffs, but it should support—not claim to replace—the goal-setting, interpretation, and relationship work of an advisor.
9. **Privacy and agency are product requirements.** Education records are protected, students care about data use, and trustworthy AI research recommends clarifying expectations before data collection or model implementation.

## Source list

### Current NYU systems, rules, and workflows

| Source | One-sentence summary |
| --- | --- |
| [NYU Transition to Stellic](https://www.nyu.edu/students/student-information-and-resources/registration-records-and-graduation/stellic.html) | NYU's official rollout page shows that Stellic already covers degree audits, personalized multi-term plans, prerequisite and offering warnings, schedule building, and backup classes while registration remains in Albert during the transition. |
| [Stellic for Advisors](https://www.nyu.edu/students/student-information-and-resources/registration-records-and-graduation/for-faculty-and-staff/stellic-for-advisors.html) | NYU documents advisor-facing pathways, what-if plans, reports, exceptions, and nightly Albert data refreshes, while identifying registration and several exception workflows that temporarily remain in Albert. |
| [NYU to begin phasing out Albert in favor of new platform](https://nyunews.com/news/2025/12/12/university-senate-albert-stellic/) | Washington Square News reports the student-facing rationale for the transition—including disconnected tools—and describes Stellic features and rollout expectations in accessible language. |
| [Tracking Degree Progress at NYU](https://www.nyu.edu/students/student-information-and-resources/registration-records-and-graduation/registration/tracking-degree-progress.html) | NYU explains the transition from Albert's Degree Progress Report to Stellic and confirms that completed, outstanding, transferred, waived, and exception-based requirements are core planning data. |
| [NYU Albert Student Course Registration Usability Study](https://sites.google.com/nyu.edu/nyuusabilitylab/usability-services/case-studies/nyu-albert-student-course-registration) | NYU's ten-student usability study found that students relied on calendars and manual notes outside Albert and struggled with outdated listings, excessive scrolling, search accuracy, and inconsistent screens. |
| [Your Guide to Course Registration at NYU](https://meet.nyu.edu/academics/your-guide-to-course-registration-at-nyu/) | NYU's student guide frames registration as a multi-factor task involving holds, prerequisites, schedules, advisors, and peer knowledge rather than a simple enrollment transaction. |
| [Registration Checklist: A First-Year's Guide to Course Registration](https://meet.nyu.edu/academics/registration-checklist-a-first-years-guide-to-course-registration/) | This first-year guide recommends checking degree rules and prerequisites, consulting an advisor, and preparing multiple schedules before registration opens. |
| [Preparing for Your Advising Meeting](https://www.nyu.edu/students/academic-services/undergraduate-advisement/preparing-for-your-meeting.html) | NYU describes advising as an ongoing partnership centered on goals, prepared questions, school-specific information, regular communication, and student responsibility. |
| [Tandon Undergraduate Academic Advisement](https://engineering.nyu.edu/academics/undergraduate/academic-advisement) | Tandon's advising page shows that school-specific advisors help interpret curriculum, policies, progress, registration, and academic or career goals beyond what a generic catalog can provide. |
| [Computer Science (BA), NYU Bulletin](https://bulletins.nyu.edu/undergraduate/arts-science/programs/computer-science-ba/) | The official CS curriculum demonstrates the rule complexity a knowledge base must represent, including course sequences, placement and AP paths, mutually exclusive calculus tracks, residency constraints, substitutions, study-away limits, and a sample eight-term plan. |

### Student discussions and observed workarounds

These sources are useful for discovering vocabulary and edge cases, but they are anecdotal and should not be treated as policy or prevalence estimates.

| Source | One-sentence summary |
| --- | --- |
| [Academic planner, schedules, etc. — r/nyu](https://www.reddit.com/r/nyu/comments/140r614/academic_planner_schedules_etc/) | An incoming student describes being lost across Albert's planner and cart, while replies emphasize core requirements, prerequisites, backup classes, professor research, and time-of-day preferences. |
| [Google Sheet NYU Albert Schedule Planner — r/nyu](https://www.reddit.com/r/nyu/comments/1260g26/google_sheet_nyu_albert_schedule_planner/) | A student-built spreadsheet that accepts pasted Albert data and pairs schedules with course evaluations is direct evidence that users create glue tools around fragmented official information. |
| [Can't see professors in Albert course search — r/nyu](https://www.reddit.com/r/nyu/comments/1ttr1rr/cant_see_professors_in_albert_course_search/) | This discussion illustrates a common planning uncertainty—missing or TBA instructors—that a responsible recommender should expose rather than silently impute. |
| [Can I convince my advisor to take a class without the prerequisite? — r/college](https://www.reddit.com/r/college/comments/17vydeq/can_i_convince_my_advisor_to_take_a_class_without/) | The thread shows that prerequisite override authority can belong to an advisor, instructor, department, or registrar depending on local policy, making confident universal advice unsafe. |
| [Academic advisor had me in the wrong degree program — r/college](https://www.reddit.com/r/college/comments/1mtw6bp/academic_advisor_had_me_in_the_wrong_degree/) | This high-stakes anecdote demonstrates why degree assumptions, source dates, recommendation rationales, and human confirmation need an auditable trail. |

### Existing products and adjacent solutions

| Source | One-sentence summary |
| --- | --- |
| [Coursicle Course Planner](https://www.coursicle.com/course-planner/) | Coursicle already offers weekly schedule building, backup sections, seat notifications, calendar export, and local storage, establishing a baseline that a new product must exceed. |
| [UChicago My Planner Resources and FAQ](https://college.uchicago.edu/advising/my-planner-resources-faq) | UChicago's Stellic implementation supports four-year plans, requirement progress, multiple what-if plans, and major or minor exploration while explicitly stating that the tool does not replace advisors. |

### Research on course choice, planning, and recommendation

| Source | One-sentence summary |
| --- | --- |
| [Academic Advising Systems: A Systematic Literature Review of Empirical Evidence](https://doi.org/10.3390/educsci7040090) | This review of 43 studies organizes the evidence on technology-supported academic advising and identifies both demonstrated value and unresolved gaps across advising systems. |
| [Studying Undergraduate Course Consideration at Scale](https://doi.org/10.1177/2332858421991148) | Platform traces and 29 interviews found that first-term students considered about nine courses on average and that this small consideration set predicted majors declared two years later. |
| [Insights into Undergraduate Pathways Using Course Load Analytics](https://doi.org/10.1145/3576050.3576081) | Machine-learned course-load estimates revealed that credit hours can hide especially heavy first semesters and that understated load is associated with program departure, particularly in STEM. |
| [Effects of Course Load Analytics on Student Course Selection](https://learning-analytics.info/index.php/JLA/article/view/8473) | A preregistered experiment with 61 undergraduates found that time load, mental effort, and psychological stress information changed course preferences, with mental effort producing the strongest effect. |
| [Factors Influencing Undergraduate Students Toward Choosing a New Course](https://doi.org/10.56103/nactaj.v68i1.138) | A survey of 84 students found that subject interest, instructor attitudes, advisor recommendations, manageable workload, peer opinions, and requirement completion all influenced enrollment decisions. |
| [How a Data-Driven Course Planning Tool Affects College Students' GPA](https://doi.org/10.1145/3231644.3231668) | Two field experiments found that using a transcript- and evaluation-based planner lowered average GPA by 0.28 standard deviations and identified grade information as a likely driver, warning against naive optimization. |
| [Goal-based Course Recommendation](https://doi.org/10.1145/3303772.3303814) | This work recommends preparatory courses for a student's target course using prior-knowledge context and validates the model through grade prediction, prerequisite recovery, and comparison with actual paths. |
| [Helping University Students Choose Elective Courses Using a Hybrid Multi-Criteria Recommendation System](https://doi.org/10.1016/j.knosys.2019.105385) | The study treats elective choice as a multi-criteria recommendation problem and combines student and course information, supporting a design that explains tradeoffs rather than producing one opaque ranking. |
| [SmartCourse: A Contextual AI Approach for Intelligent Course Advising](https://arxiv.org/abs/2507.22946) | This early 2025 preprint reports that transcript and academic-plan context improved the relevance of AI answers across 25 computer-science advising queries, offering a useful prototype pattern but not deployment-scale proof. |
| [Systematic Review of Research on Artificial Intelligence Applications in Higher Education](https://doi.org/10.1186/s41239-019-0171-0) | A review of 146 studies found limited educator involvement and insufficient critical and ethical reflection, indicating that advisor expertise and risk review must be part of product development. |
| [Artificial Intelligence in Education: A Critical View Through the Lens of Human Rights, Democracy and the Rule of Law](https://doi.org/10.1111/ejed.12532) | This critical analysis warns that educational AI cannot fully model social context and can create value-laden harms, reinforcing the need for bounded claims and human agency. |

### Advising quality, trust, privacy, and governance

| Source | One-sentence summary |
| --- | --- |
| [NACADA Academic Advising Core Competencies](https://nacada.ksu.edu/Resources/Pillars/CoreCompetencies) | NACADA divides effective advising into conceptual, informational, and relational competencies, showing why a database plus chatbot does not reproduce the complete advisor role. |
| [Expectation Management in AI](https://doi.org/10.1016/j.heliyon.2024.e28562) | Interviews with 14 healthcare and education stakeholders support eliciting expectations about trustworthy AI before data collection, modeling, and implementation rather than after a product is built. |
| [Data Privacy in Higher Education: Yes, Students Care](https://er.educause.edu/articles/2021/2/data-privacy-in-higher-education-yes-students-care) | This review of student privacy research finds genuine concern alongside a privacy paradox, so consent and data-minimization decisions should not be inferred from casual user behavior. |
| [Family Educational Rights and Privacy Act (FERPA)](https://studentprivacy.ed.gov/ferpa) | The U.S. Department of Education explains the federal protections governing access to and disclosure of education records, which become relevant if the product ingests transcripts or degree-audit data. |

## What we would still miss without students and advisors

| Missing evidence | Focused way to obtain it later |
| --- | --- |
| Current NYU workflow and hidden workarounds | Ask students to screen-share one real planning session and narrate every source they consult. |
| Trust boundary for transcript, GPA, and goals | Test concrete data-permission choices with local-only, opt-in cloud, and no-transcript prototype variants. |
| Advisor exception practice | Give advisors three ambiguous cases and map the evidence, authority, and escalation path they use. |
| Differences across NYU schools and class years | Recruit a small matrix across CAS, Tandon, Stern or SPS and first-year, transfer, and upper-level students. |
| Whether explanations change decisions | Compare an unexplained recommendation with one showing requirements, evidence, uncertainty, and alternatives. |
| Product value and repeat use | Measure completion time, correction rate, confidence, and return behavior during an actual registration cycle. |

## Research implications for the next concept discussion

- Treat **official degree and prerequisite data as versioned evidence**, not permanent facts embedded in prompts.
- Position the AI as a **decision-support and explanation layer**, not an advisor replacement or source of record.
- Make every plan editable and show **why a course was suggested, what assumption it depends on, and what alternatives remain**.
- Represent at least three workload dimensions: **time demand, mental effort, and stress**, with source and confidence.
- Preserve **backup courses and scenarios** as first-class objects because availability and instructor information are unstable.
- Keep the existing local-first privacy posture unless a server-side knowledge base produces enough demonstrated value to justify a separate consent decision.
- Design around the **Albert-to-Stellic transition** and verify whether the long-term product should integrate with Stellic, complement it, or become institution-agnostic.

## Research method and limitations

Sources were discovered and checked with AnySearch across academic, resource, and social-media search, with full-page extraction where available; some Reddit and NYU marketing pages restricted extraction, so their summaries rely on indexed snippets and should be rechecked before they support a high-stakes product claim.

This is a directional evidence review rather than a systematic review: it prioritizes sources that can change product scope, reveal user behavior, or identify risk, and it does not estimate the prevalence of any single complaint.
