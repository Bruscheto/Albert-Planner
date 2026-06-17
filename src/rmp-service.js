const RMP_GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";
const NYU_SCHOOL_ID = "U2Nob29sLTY3NQ==";
const NYU_SCHOOL_NAME = "New York University";

const COURSE_PREFIX_DEPARTMENTS = {
	// Sciences & math
	CSCI: ["computer science", "data science"],
	DS: ["data science", "computer science"],
	MATH: ["mathematics", "math"],
	STAT: ["statistics", "data science", "mathematics"],
	PHYS: ["physics"],
	CHEM: ["chemistry"],
	BIOC: ["biochemistry", "chemistry", "biology"],
	BIOL: ["biology"],
	NEURL: ["neural science", "neurological", "neuroscience", "biology"],
	ENVST: ["environmental"],
	// Engineering (Tandon)
	CS: ["computer science", "engineering", "data science"],
	EE: ["engineering"],
	ECE: ["engineering"],
	ME: ["engineering"],
	CE: ["engineering"],
	BE: ["engineering"],
	CBE: ["engineering"],
	FRE: ["engineering", "finance"],
	// Social sciences
	ECON: ["economics"],
	PSYCH: ["psychology"],
	ANTH: ["anthropology"],
	SOC: ["sociology"],
	POL: ["political science", "politics", "international relations", "international affairs"],
	SCA: ["social and cultural", "cultural studies", "sociology", "anthropology"],
	AMST: ["american studies", "cultural studies"],
	AFRST: ["african studies", "africana", "cultural studies"],
	GEND: ["gender studies", "cultural studies"],
	LATC: ["latino studies", "cultural studies"],
	// Humanities
	HIST: ["history"],
	MEDI: ["medieval studies", "history"],
	PHIL: ["philosophy"],
	RELST: ["religious studies", "religion"],
	CLASS: ["classics"],
	LING: ["linguistics"],
	// Literature & writing
	ENGL: ["english", "literature", "writing"],
	COLIT: ["comparative literature", "literature"],
	DRLIT: ["dramatic literature", "literature", "theater"],
	EXPOS: ["writing", "expository"],
	// Languages
	FREN: ["french", "foreign languages"],
	SPAN: ["spanish", "foreign languages"],
	ITAL: ["italian", "foreign languages"],
	GERM: ["german", "foreign languages"],
	RUSSN: ["russian", "foreign languages"],
	// Area studies
	EAST: ["east asian studies", "asian studies"],
	HBRJD: ["hebrew", "judaic", "near eastern studies"],
	MEIS: ["middle eastern studies", "near eastern studies"],
	// Arts & media
	ARTH: ["art history", "visual culture", "fine arts"],
	ART: ["fine arts", "art history", "visual culture", "art design", "art studio"],
	PHTI: ["photography"],
	ANIM: ["animation"],
	GAMES: ["game center", "game design"],
	MUSIC: ["music"],
	DANCE: ["dance", "performing arts"],
	THEA: ["theater", "performing arts", "drama"],
	DRAM: ["theater", "performing arts", "drama"],
	CINE: ["cinema", "film television", "film", "performing arts"],
	MCC: ["communication", "media", "cultural studies"],
	JOUR: ["journalism", "communication"],
	// Education & human development (Steinhardt)
	EDUC: ["education", "teaching learning"],
	TCHL: ["teaching learning", "education"],
	APSY: ["applied psychology", "psychology", "human development"],
	HDEV: ["human development", "psychology"],
	// Health & public service
	GPH: ["public health", "health science"],
	NURSE: ["nursing"],
	NUTR: ["nutrition"],
	CSD: ["speech hearing", "communicative", "speech"],
	SCWK: ["social work"],
	UPADM: ["public policy", "public service"],
	PADM: ["public policy", "public service"],
	// Interdisciplinary
	IDSEM: ["individualized studies", "interdisciplinary"],
	LAW: ["law"],
	// Business (Stern / Schack)
	ACCT: ["accounting", "business"],
	FINC: ["finance", "business"],
	MKTG: ["marketing", "business"],
	MGMT: ["management", "business"],
	INFO: ["information science", "business"],
	REAL: ["real estate", "business"],
	HMGT: ["hospitality", "tourism"],
	TCS: ["tourism", "hospitality"],
};

const NYU_CAREER_CODES = new Set([
	"UA",
	"GA",
	"UB",
	"UG",
	"GY",
	"AD",
	"SH",
	"SHU",
]);

const TEACHER_SEARCH_QUERY = `
query TeacherSearchResultsPageQuery(
	$query: TeacherSearchQuery!
	$schoolID: ID
	$includeSchoolFilter: Boolean!
) {
	search: newSearch {
		teachers(query: $query, first: 8, after: "") {
			edges {
				node {
					id
					legacyId
					firstName
					lastName
					department
					avgRating
					numRatings
					avgDifficulty
					wouldTakeAgainPercent
					school {
						id
						name
					}
				}
			}
			resultCount
		}
	}
	school: node(id: $schoolID) @include(if: $includeSchoolFilter) {
		__typename
		... on School {
			name
		}
		id
	}
}`;

const TEACHER_RATING_COURSES_QUERY = `
query TeacherRatingCoursesQuery($id: ID!, $after: String) {
	node(id: $id) {
		__typename
		... on Teacher {
			ratings(first: 100, after: $after) {
				edges {
					node {
						class
					}
				}
				pageInfo {
					hasNextPage
					endCursor
				}
			}
		}
	}
}`;

export function normalizeProfessorName(name) {
	return String(name || "")
		.normalize("NFKD")
		.replace(/^'[^']+'\s*/, "")
		.replace(/-/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function professorFullName(professor) {
	return normalizeProfessorName(
		`${professor?.firstName || ""} ${professor?.lastName || ""}`,
	);
}

function normalizeForCompare(value) {
	return normalizeProfessorName(value)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenize(value) {
	const normalized = normalizeForCompare(value);
	return normalized ? normalized.split(" ") : [];
}

function getLastName(name) {
	const parts = tokenize(name);
	return parts[parts.length - 1] || "";
}

function getCoursePrefix(courseCode) {
	const match = String(courseCode || "")
		.toUpperCase()
		.match(/\b([A-Z]+)-[A-Z]+\b/);
	return match?.[1] || "";
}

function addCourseMatchKeys(keys, prefix, career, number) {
	if (!prefix || !number) {
		return;
	}

	const normalizedNumber = String(Number(number));
	keys.add(`${prefix}${normalizedNumber}`);
	if (career) {
		keys.add(`${prefix}${career}${normalizedNumber}`);
	}
}

export function getCourseMatchKeys(courseCode) {
	const normalized = String(courseCode || "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	const keys = new Set();
	if (!normalized) {
		return keys;
	}

	keys.add(normalized);
	const separatedMatch = String(courseCode || "")
		.toUpperCase()
		.match(/\b([A-Z]+)[\s.-]*([A-Z]{2,3})?[\s.-]*0*(\d{1,5})\b/);
	if (separatedMatch) {
		const [, prefix, maybeCareer = "", number] = separatedMatch;
		addCourseMatchKeys(
			keys,
			prefix,
			NYU_CAREER_CODES.has(maybeCareer) ? maybeCareer : "",
			number,
		);
	}

	const compactMatch = normalized.match(/^([A-Z]+?)(UA|GA|UB|UG|GY|AD|SHU|SH)?0*(\d{1,5})/);
	if (compactMatch) {
		const [, prefix, career = "", number] = compactMatch;
		addCourseMatchKeys(keys, prefix, career, number);
	} else {
		const noCareerMatch = normalized.match(/^([A-Z]+)0*(\d{1,5})/);
		if (noCareerMatch) {
			const [, prefix, number] = noCareerMatch;
			addCourseMatchKeys(keys, prefix, "", number);
		}
	}

	return keys;
}

function getExpectedDepartments(courseCode) {
	return COURSE_PREFIX_DEPARTMENTS[getCoursePrefix(courseCode)] || [];
}

function departmentMatchesExpected(department, expectedDepartments) {
	const normalizedDepartment = normalizeForCompare(department);
	return expectedDepartments.some((expected) => {
		const normalizedExpected = normalizeForCompare(expected);
		if (!normalizedExpected) {
			return false;
		}
		// Multi-word terms match as a contiguous phrase anywhere in the department
		// name (e.g. "visual culture" inside "Art & Visual Culture").
		if (normalizedExpected.includes(" ")) {
			return normalizedDepartment.includes(normalizedExpected);
		}
		// Single-word terms must be the department's head word so "history"
		// matches "History" but not "Art History".
		return (
			normalizedDepartment === normalizedExpected ||
			normalizedDepartment.startsWith(`${normalizedExpected} `)
		);
	});
}

function scoreTitleOverlap(courseTitle, department) {
	const titleTokens = new Set(
		tokenize(courseTitle).filter((token) => token.length >= 4),
	);
	const departmentTokens = tokenize(department).filter((token) => token.length >= 4);
	if (!titleTokens.size || !departmentTokens.length) {
		return 0;
	}

	const overlapCount = departmentTokens.filter((token) =>
		titleTokens.has(token),
	).length;
	return Math.min(12, overlapCount * 6);
}

function findRatingCourseMatch(courseCode, ratingCourseLabels = []) {
	const courseKeys = getCourseMatchKeys(courseCode);
	if (!courseKeys.size || !Array.isArray(ratingCourseLabels)) {
		return null;
	}

	for (const label of ratingCourseLabels) {
		const labelKeys = getCourseMatchKeys(label);
		for (const key of labelKeys) {
			if (courseKeys.has(key)) {
				return String(label);
			}
		}
	}

	return null;
}

function getCourseLookupContext({ course = null, courseCode = "", courseTitle = "" }) {
	return {
		courseCode:
			typeof course?.courseCode === "string" ? course.courseCode : courseCode,
		courseTitle:
			typeof course?.title === "string" ? course.title : courseTitle,
	};
}

function scoreProfessorCandidate(context, professor) {
	const queryName = normalizeForCompare(context.professorName);
	const queryParts = tokenize(queryName);
	const queryLastName = getLastName(queryName);
	const professorName = professorFullName(professor);
	const normalizedProfessorName = normalizeForCompare(professorName);
	const professorLastName = getLastName(professorName);

	if (!queryLastName || !professorLastName || queryLastName !== professorLastName) {
		return null;
	}

	let score = 15;
	const reasons = ["last-name"];

	if (queryParts.length > 1) {
		if (normalizedProfessorName === queryName) {
			score += 60;
			reasons.push("exact-full-name");
		} else if (queryParts.every((part) => tokenize(professorName).includes(part))) {
			score += 35;
			reasons.push("full-name-parts");
		}
	}

	const expectedDepartments = getExpectedDepartments(context.courseCode);
	if (expectedDepartments.length) {
		if (departmentMatchesExpected(professor.department, expectedDepartments)) {
			score += 35;
			reasons.push("course-department");
		} else {
			score -= 10;
			reasons.push("department-mismatch");
		}
	}

	const titleScore = scoreTitleOverlap(context.courseTitle, professor.department);
	if (titleScore) {
		score += titleScore;
		reasons.push("title-department");
	}

	const ratingCourseMatch = findRatingCourseMatch(
		context.courseCode,
		professor.ratingCourseLabels,
	);
	if (ratingCourseMatch) {
		score += 55;
		reasons.push(`rating-course:${ratingCourseMatch}`);
	}

	const ratingsCount = Number(professor.numRatings) || 0;
	if (ratingsCount > 0) {
		score += Math.min(5, Math.floor(Math.log10(ratingsCount + 1) * 3));
		reasons.push("has-ratings");
	}

	return { professor, score, reasons };
}

function normalizeCandidate(professor) {
	return {
		id: professor.id,
		legacyId: professor.legacyId,
		firstName: professor.firstName,
		lastName: professor.lastName,
		name: professorFullName(professor),
		department: professor.department || null,
		avgRating: professor.avgRating,
		numRatings: professor.numRatings,
		avgDifficulty: professor.avgDifficulty,
		wouldTakeAgainPercent: professor.wouldTakeAgainPercent,
		school: {
			id: professor.school?.id || null,
			name: professor.school?.name || null,
		},
	};
}

export function resolveNyuProfessorMatch({
	professorName,
	course = null,
	courseCode = "",
	courseTitle = "",
	candidates = [],
}) {
	const normalizedName = normalizeProfessorName(professorName);
	const courseContext = getCourseLookupContext({ course, courseCode, courseTitle });
	if (!normalizedName) {
		return {
			status: "not_found",
			professor: null,
			candidates: [],
			confidence: 0,
			reason: "missing-professor-name",
		};
	}

	const nyuCandidates = candidates.filter(
		(professor) =>
			professor?.school?.id === NYU_SCHOOL_ID ||
			professor?.school?.name === NYU_SCHOOL_NAME,
	);
	const scoredCandidates = nyuCandidates
		.map((professor) =>
			scoreProfessorCandidate(
				{ professorName: normalizedName, ...courseContext },
				professor,
			),
		)
		.filter(Boolean)
		.sort((a, b) => b.score - a.score);

	if (!scoredCandidates.length) {
		return {
			status: "not_found",
			professor: null,
			candidates: [],
			confidence: 0,
			reason: "no-exact-nyu-last-name-match",
		};
	}

	const [bestCandidate, nextCandidate] = scoredCandidates;
	const confidence = Math.min(100, bestCandidate.score);
	const isFullNameQuery = tokenize(normalizedName).length > 1;
	const clearLead =
		!nextCandidate || bestCandidate.score - nextCandidate.score >= 15;
	const highConfidence = bestCandidate.score >= (isFullNameQuery ? 55 : 45);

	if (scoredCandidates.length === 1 || (highConfidence && clearLead)) {
		return {
			status: "matched",
			professor: normalizeCandidate(bestCandidate.professor),
			candidates: scoredCandidates.slice(0, 5).map((candidate) => ({
				...normalizeCandidate(candidate.professor),
				matchScore: candidate.score,
				matchReasons: candidate.reasons,
			})),
			confidence,
			reason:
				scoredCandidates.length === 1
					? "single-nyu-last-name-match"
					: bestCandidate.reasons.join(","),
		};
	}

	return {
		status: "ambiguous",
		professor: null,
		candidates: scoredCandidates.slice(0, 5).map((candidate) => ({
			...normalizeCandidate(candidate.professor),
			matchScore: candidate.score,
			matchReasons: candidate.reasons,
		})),
		confidence,
		reason: "multiple-plausible-professors",
	};
}

async function fetchNyuProfessorCandidates(professorName) {
	const normalizedName = normalizeProfessorName(professorName);
	if (!normalizedName) {
		throw new Error("Professor name is required.");
	}

	const response = await fetch(RMP_GRAPHQL_URL, {
		method: "POST",
		credentials: "include",
		headers: {
			Accept: "*/*",
			"Content-Type": "application/json",
			Authorization: "Basic dGVzdDp0ZXN0",
		},
		body: JSON.stringify({
			query: TEACHER_SEARCH_QUERY,
			variables: {
				query: {
					text: normalizedName,
					schoolID: NYU_SCHOOL_ID,
					fallback: true,
					departmentID: null,
				},
				schoolID: NYU_SCHOOL_ID,
				includeSchoolFilter: true,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Rate My Professors request failed: ${response.status}`);
	}

	const payload = await response.json();
	if (payload.errors?.length) {
		throw new Error(payload.errors[0]?.message || "Rate My Professors error.");
	}

	const edges = payload?.data?.search?.teachers?.edges || [];
	return edges.map((edge) => edge?.node).filter(Boolean);
}

async function fetchTeacherRatingCourseLabels(teacherId) {
	if (!teacherId) {
		return [];
	}

	const labels = new Set();
	let after = null;

	for (let pageCount = 0; pageCount < 3; pageCount += 1) {
		const response = await fetch(RMP_GRAPHQL_URL, {
			method: "POST",
			credentials: "include",
			headers: {
				Accept: "*/*",
				"Content-Type": "application/json",
				Authorization: "Basic dGVzdDp0ZXN0",
			},
			body: JSON.stringify({
				query: TEACHER_RATING_COURSES_QUERY,
				variables: { id: teacherId, after },
			}),
		});

		if (!response.ok) {
			throw new Error(`Rate My Professors request failed: ${response.status}`);
		}

		const payload = await response.json();
		if (payload.errors?.length) {
			throw new Error(payload.errors[0]?.message || "Rate My Professors error.");
		}

		const ratings = payload?.data?.node?.ratings;
		for (const edge of ratings?.edges || []) {
			const label = String(edge?.node?.class || "").trim();
			if (label) {
				labels.add(label);
			}
		}

		if (!ratings?.pageInfo?.hasNextPage) {
			break;
		}
		after = ratings.pageInfo.endCursor;
	}

	return [...labels];
}

function isNyuProfessor(professor) {
	return (
		professor?.school?.id === NYU_SCHOOL_ID ||
		professor?.school?.name === NYU_SCHOOL_NAME
	);
}

function hasExactLastName(professorName, professor) {
	return getLastName(professorName) === getLastName(professorFullName(professor));
}

async function attachRatingCourseLabels(professorName, candidates) {
	const hydratedCandidates = await Promise.all(
		candidates.map(async (candidate) => {
			if (!isNyuProfessor(candidate) || !hasExactLastName(professorName, candidate)) {
				return candidate;
			}
			if (Array.isArray(candidate.ratingCourseLabels)) {
				return candidate;
			}
			return {
				...candidate,
				ratingCourseLabels: await fetchTeacherRatingCourseLabels(candidate.id),
			};
		}),
	);

	return hydratedCandidates;
}

export async function searchNyuProfessorMatch({
	professorName,
	course = null,
	courseCode = "",
	courseTitle = "",
}) {
	const candidates = await fetchNyuProfessorCandidates(professorName);
	const courseContext = getCourseLookupContext({ course, courseCode, courseTitle });
	const initialMatch = resolveNyuProfessorMatch({
		professorName,
		...courseContext,
		candidates,
	});

	if (
		initialMatch.status !== "ambiguous" ||
		!getCourseMatchKeys(courseContext.courseCode).size
	) {
		return initialMatch;
	}

	const candidatesWithRatingCourses = await attachRatingCourseLabels(
		professorName,
		candidates,
	);
	return resolveNyuProfessorMatch({
		professorName,
		...courseContext,
		candidates: candidatesWithRatingCourses,
	});
}
