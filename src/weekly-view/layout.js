// Overlap layout math for day-column events (pure, no shared state).

import { timeToMinutes } from "../utils/time-parser.js";

/**
 * Calculate layout for overlapping events in a day.
 * Returns array of { left, width } objects corresponding to input events array.
 */
export function layoutEventsForDay(events) {
	// 1. Sort events by start time, then duration (longer first)
	const sortedIndices = events
		.map((_, i) => i)
		.sort((a, b) => {
			const startA = timeToMinutes(events[a].timeRange.start);
			const startB = timeToMinutes(events[b].timeRange.start);
			if (startA !== startB) return startA - startB;

			const endA = timeToMinutes(events[a].timeRange.end);
			const endB = timeToMinutes(events[b].timeRange.end);
			return endB - startB - (endA - startA);
		});

	const result = new Array(events.length);

	// 2. Group events into clusters of (transitively) overlapping events.
	const clusters = [];
	let currentCluster = [];
	let clusterEnd = -1;

	for (const eventIndex of sortedIndices) {
		const event = events[eventIndex];
		const start = timeToMinutes(event.timeRange.start);
		const end = timeToMinutes(event.timeRange.end);

		if (currentCluster.length === 0) {
			currentCluster.push(eventIndex);
			clusterEnd = end;
		} else if (start < clusterEnd) {
			currentCluster.push(eventIndex);
			clusterEnd = Math.max(clusterEnd, end);
		} else {
			clusters.push(currentCluster);
			currentCluster = [eventIndex];
			clusterEnd = end;
		}
	}
	if (currentCluster.length > 0) clusters.push(currentCluster);

	// 3. Pack each cluster into columns and assign equal widths within it.
	for (const cluster of clusters) {
		const clusterColumns = [];
		const clusterEventColumn = {}; // eventIndex -> colIndex

		for (const eventIndex of cluster) {
			const event = events[eventIndex];
			const start = timeToMinutes(event.timeRange.start);

			let placed = false;
			for (let i = 0; i < clusterColumns.length; i++) {
				const lastEventIndex = clusterColumns[i][clusterColumns[i].length - 1];
				const lastEventEnd = timeToMinutes(
					events[lastEventIndex].timeRange.end,
				);

				if (lastEventEnd <= start) {
					clusterColumns[i].push(eventIndex);
					clusterEventColumn[eventIndex] = i;
					placed = true;
					break;
				}
			}
			if (!placed) {
				clusterColumns.push([eventIndex]);
				clusterEventColumn[eventIndex] = clusterColumns.length - 1;
			}
		}

		const width = 100 / clusterColumns.length;
		for (const eventIndex of cluster) {
			const colIndex = clusterEventColumn[eventIndex];
			result[eventIndex] = {
				left: colIndex * width,
				width: width,
			};
		}
	}

	return result;
}
