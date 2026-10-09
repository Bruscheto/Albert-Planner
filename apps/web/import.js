import {courseContext, planningContext} from '../../src/shared/planning-context.js';
// Read only the planning fields from a legacy extension export.
export function parseBackup(value) {
 const fail = (message) => { throw new Error(message); };
 const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
 const string = (v, name) => typeof v === 'string' && v.trim() && v.length <= 500 ? v : fail(`Invalid ${name}.`);
 if (!object(value) || value.version !== 1 || !object(value.data)) fail('Choose an Albert Planner version 1 JSON export.');
 const raw = value.data.courses;
 if (!Array.isArray(raw) || raw.length > 100) fail('An export must contain at most 100 courses.');
 const ids = new Set();
 const courses = raw.map(c => {
  if (!object(c)) fail('Invalid course.');
  const id = string(c.id, 'course ID');
  if (ids.has(id)) fail('Duplicate course IDs.');
  ids.add(id);
  if (!Number.isFinite(c.credits) || c.credits < 0 || c.credits > 30) fail('Invalid credits.');
  if (!Array.isArray(c.components) || c.components.length > 20) fail('Invalid course components.');
  const components = c.components.map(part => {
   if (!object(part) || !Array.isArray(part.days) || part.days.some(d => !['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(d))) fail('Invalid meeting days.');
   let timeRange = null;
   if (part.timeRange != null) {
    const validTime = t => object(t) && Number.isInteger(t.hours) && t.hours >= 0 && t.hours < 24 && Number.isInteger(t.minutes) && t.minutes >= 0 && t.minutes < 60;
    if (!validTime(part.timeRange.start) || !validTime(part.timeRange.end)) fail('Invalid meeting time.');
    const {start, end} = part.timeRange;
    if (end.hours * 60 + end.minutes <= start.hours * 60 + start.minutes) fail('Meeting end must follow its start.');
    timeRange = {start: {hours: start.hours, minutes: start.minutes}, end: {hours: end.hours, minutes: end.minutes}};
   }
   return {type: string(part.type, 'component type'), days: [...new Set(part.days)], timeRange, isTBA: Boolean(part.isTBA) || !timeRange || !part.days.length};
  });
  return {id, courseCode: string(c.courseCode, 'course code'), section: string(c.section, 'section'), title: string(c.title, 'title'), credits: c.credits, components, ...courseContext(c)};
 });
 const selected = value.data.plannerSelection ?? [];
 if (!Array.isArray(selected) || selected.some(id => typeof id !== 'string' || !ids.has(id))) fail('The saved selection references an unknown course.');
 return {courses, selection: [...new Set(selected)], planningContext:planningContext(courses, value.data.planningContext ?? {term:value.data.activeTerm})};
}
