export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export function defaultConstraints() {
 return {maxCredits:16, earliestMinutes:540, unavailableDays:[], lockedCourseIds:[], excludedCourseIds:[]};
}
export function validateConstraints(value, courses) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid schedule constraints.');
 const keys = Object.keys(defaultConstraints());
 if (Object.keys(value).some(key=>!keys.includes(key))) throw new Error('Unknown schedule constraint.');
 const {maxCredits, earliestMinutes} = value;
 if (!Number.isFinite(maxCredits) || maxCredits <= 0 || maxCredits > 30) throw new Error('Choose a credit limit above 0 and at most 30.');
 if (!Number.isInteger(earliestMinutes) || earliestMinutes < 0 || earliestMinutes >= 1440) throw new Error('Choose a valid earliest start time.');
 const list = (key, allowed) => {
  const items = value[key];
  if (!Array.isArray(items) || items.length > allowed.length || items.some(item=>!allowed.includes(item)) || new Set(items).size !== items.length) throw new Error(`Invalid ${key}.`);
  return [...items];
 };
 const ids = courses.map(course=>course.id);
 const result = {maxCredits, earliestMinutes, unavailableDays:list('unavailableDays',DAYS), lockedCourseIds:list('lockedCourseIds',ids), excludedCourseIds:list('excludedCourseIds',ids)};
 if (result.lockedCourseIds.some(id=>result.excludedCourseIds.includes(id))) throw new Error('A course cannot be both required and excluded.');
 return result;
}
