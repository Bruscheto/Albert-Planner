import {defaultConstraints, validateConstraints} from '../../src/shared/constraints.js';
import {parseBackup} from './import.js';
import {hasConflict} from '../../src/shared/calendar-utils.js';
import {timeToMinutes} from '../../src/shared/time-parser.js';

export function suggestSchedule(state, options) {
 const {courses, selection} = parseBackup({version:1, data:{courses:state.courses, plannerSelection:state.selection}});
 // Keep the original manual suggestion API readable by older callers.
 const input = Object.hasOwn(options, 'earliest') ? {...defaultConstraints(), maxCredits:options.maxCredits, earliestMinutes:options.earliest} : options;
 const {maxCredits, earliestMinutes, unavailableDays, lockedCourseIds, excludedCourseIds} = validateConstraints(input, courses);
 const priority = course => lockedCourseIds.includes(course.id) ? 2 : Number(selection.includes(course.id));
 const ordered = [...courses].sort((a,b)=>priority(b)-priority(a));
 const chosen = [], skipped = [], meetings = [];
 let credits = 0;
 // ponytail: greedy shortlist order, bounded search if students need alternative combinations.
 for (const course of ordered) {
  let reason;
  const parts = course.components;
  if (excludedCourseIds.includes(course.id)) reason = 'Excluded by you';
  else if (!parts.length || parts.some(p=>p.isTBA)) reason = 'Meeting times are unconfirmed';
  else if (parts.some(p=>timeToMinutes(p.timeRange.start)<earliestMinutes)) reason = 'Starts before your earliest time';
  else if (parts.some(p=>p.days.some(day=>unavailableDays.includes(day)))) reason = 'Meets on an unavailable day';
  else if (chosen.some(c=>c.courseCode.trim().toUpperCase()===course.courseCode.trim().toUpperCase())) reason = 'Another section of this course is included';
  else if (credits + course.credits > maxCredits) reason = 'Would exceed your credit limit';
  else if (parts.some((p,index)=>hasConflict(p,[...meetings,...parts.slice(0,index)]))) reason = 'Overlaps an included meeting';
  if (reason && lockedCourseIds.includes(course.id)) throw new Error(`Required course ${course.courseCode} · Section ${course.section}: ${reason}. Change your constraints before suggesting.`);
  if (reason) { skipped.push({course,reason}); continue; }
  chosen.push(course); meetings.push(...parts); credits += course.credits;
 }
 return {selection:chosen.map(c=>c.id), credits, skipped};
}
