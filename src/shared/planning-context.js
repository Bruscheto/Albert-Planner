const optionalText = (value, label) => {
 if (value == null || value === '') return null;
 if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error(`Invalid ${label}.`);
 return value.trim();
};
export function normalizeTerm(value) {
 if (value == null) return null;
 if (typeof value === 'string') return optionalText(value, 'term');
 if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid term.');
 const name = optionalText(value.name, 'term');
 if (!['Spring','Summer','Fall','Winter'].includes(value.semester) || !Number.isInteger(value.year) || value.year < 1900 || value.year > 2200) throw new Error('Invalid term.');
 const expected = `${value.semester} ${value.year}`;
 if (name && name !== expected) throw new Error('Conflicting term metadata.');
 return expected;
}
export function courseContext(course) {
 return {term:normalizeTerm(course.term), institution:optionalText(course.institution,'institution'), campus:optionalText(course.campus,'campus'), timeZone:optionalText(course.timeZone,'time zone')};
}
export function planningContext(courses, supplied = {}) {
 if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) throw new Error('Invalid planning context.');
 const result = {};
 for (const key of ['term','institution','campus','timeZone']) {
  const values = [...new Set(courses.map(c=>c[key]).filter(Boolean).map(v=>v.trim()))];
  if (new Set(values.map(v=>v.toLowerCase())).size > 1) throw new Error(`Courses have mixed ${key} values. Import one term and campus at a time.`);
  const explicit = key === 'term' ? normalizeTerm(supplied[key]) : optionalText(supplied[key],key);
  if (explicit && values.length && explicit.toLowerCase() !== values[0].toLowerCase()) throw new Error(`Planning ${key} does not match imported courses.`);
  result[key] = explicit ?? values[0] ?? null;
 }
 // Acknowledging unknowns does not turn imported meetings into verified facts.
 result.confirmed = supplied.confirmed === true;
 return result;
}
export function requirePlanningContext(state) {
 const context = planningContext(state.courses, state.planningContext);
 if (!context.confirmed) throw new Error('Review and confirm the planning context before suggesting a schedule.');
 return context;
}
