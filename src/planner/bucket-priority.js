export function sortCoursesByPriority(courses, buckets) {
	const bucketPriority = {};
	for (const bucket of buckets) {
		bucketPriority[bucket.id] = bucket.priority;
	}
	bucketPriority[null] = 999;

	return [...courses].sort((a, b) => {
		const priorityA = bucketPriority[a.bucket] ?? 999;
		const priorityB = bucketPriority[b.bucket] ?? 999;
		return priorityA - priorityB;
	});
}
