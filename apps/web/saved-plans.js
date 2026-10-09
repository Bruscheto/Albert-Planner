import {defaultConstraints, validateConstraints} from '../../src/shared/constraints.js';
import { parseBackup } from './import.js';

const PREFIX = 'albert.web.plan.v1.';

export function exportPlan(plan) {
 const snapshot = parseBackup({version:1,data:{courses:plan.courses,plannerSelection:plan.selection,planningContext:plan.planningContext}});
 return JSON.stringify({version:1,data:{courses:snapshot.courses,plannerSelection:snapshot.selection,planningContext:snapshot.planningContext,constraints:validateConstraints(plan.constraints ?? defaultConstraints(),snapshot.courses)}},null,2);
}

export function deletePlan(storage, id) {
 if (typeof id !== 'string' || !id) throw new Error('Invalid plan ID.');
 storage.removeItem(PREFIX + id);
}

export function savePlan(storage, name, state, id = crypto.randomUUID()) {
 const title = name.trim();
 if (!title || title.length > 80) throw new Error('Enter a plan name of 1–80 characters.');
 const snapshot = parseBackup({version: 1, data: {courses: state.courses, plannerSelection: state.selection, planningContext:state.planningContext}});
 if (!snapshot.courses.length) throw new Error('Import courses before saving a plan.');
 const key = PREFIX + id;
 if (storage.getItem(key) !== null) throw new Error('This plan already exists. Save a new copy.');
 const plan = {version: 1, id, name: title, savedAt: new Date().toISOString(), ...snapshot, constraints:validateConstraints(state.constraints ?? defaultConstraints(), snapshot.courses)};
 // Each immutable snapshot gets its own key, so tabs cannot overwrite other plans.
 storage.setItem(key, JSON.stringify(plan));
 return plan;
}

export function listPlans(storage) {
 const plans = [];
 let unreadable = 0;
 for (let i = 0; i < storage.length; i++) {
  const key = storage.key(i);
  if (!key?.startsWith(PREFIX)) continue;
  try {
   const record = JSON.parse(storage.getItem(key));
   if (record.version !== 1 || typeof record.id !== 'string' || key !== PREFIX + record.id || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 80 || !Number.isFinite(Date.parse(record.savedAt))) throw new Error('Invalid saved plan.');
   const snapshot = parseBackup({version: 1, data: {courses: record.courses, plannerSelection: record.selection, planningContext:record.planningContext}});
   plans.push({id: record.id, name: record.name, savedAt: record.savedAt, ...snapshot, constraints:validateConstraints(record.constraints ?? defaultConstraints(), snapshot.courses)});
  } catch { unreadable++; }
 }
 return {plans: plans.sort((a, b) => b.savedAt.localeCompare(a.savedAt)), unreadable};
}
