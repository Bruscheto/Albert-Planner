import {calculateWeeklyHours} from '../../src/shared/calendar-utils.js';

export function comparePlans(left, right) {
 const selected = plan => plan.courses.filter(course => plan.selection.includes(course.id));
 const summarize = courses => ({
  credits: courses.reduce((sum, course) => sum + course.credits, 0),
  hours: calculateWeeklyHours(courses.flatMap(course => course.components.filter(part => !part.isTBA))),
  unknown: courses.filter(course => !course.components.length || course.components.some(part => part.isTBA)).length,
 });
 const a = selected(left), b = selected(right);
 // Compare full imported course records: the same ID may have updated meetings.
 const same = (course, other) => JSON.stringify(course) === JSON.stringify(other);
 return {
  left: summarize(a), right: summarize(b),
  onlyLeft: a.filter(course => !b.some(other => same(course, other))),
  onlyRight: b.filter(course => !a.some(other => same(course, other))),
  shared: a.filter(course => b.some(other => same(course, other))),
 };
}
