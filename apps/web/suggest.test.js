import assert from 'node:assert/strict';
import {suggestSchedule} from './suggest.js';
const course=(id,hour)=>({id,courseCode:id,section:'1',title:id,credits:4,components:[{type:'Lecture',days:['Mon'],timeRange:{start:{hours:hour,minutes:0},end:{hours:hour+1,minutes:0}}}]});
const state={courses:[course('early',8),course('a',10),course('b',10),course('c',11)],selection:['b']};
const options={maxCredits:8,earliest:540};
assert.deepEqual(suggestSchedule(state,options).selection,['b','c']);
assert.deepEqual(state.selection,['b']);
assert.equal(suggestSchedule(state,{...options,maxCredits:4}).credits,4);
const tba=course('tba',12); tba.components[0].timeRange=null;
assert.equal(suggestSchedule({courses:[tba],selection:[]},options).selection.length,0);
const duplicate=course('d',12); duplicate.courseCode='b';
assert.equal(suggestSchedule({courses:[course('b',10),duplicate],selection:[]},options).selection.length,1);
const internal=course('x',10); internal.components.push({...internal.components[0]});
assert.equal(suggestSchedule({courses:[internal],selection:[]},options).selection.length,0);
assert.throws(()=>suggestSchedule(state,{...options,maxCredits:NaN}));
assert.throws(()=>suggestSchedule(state,{...options,earliest:1440}));
console.log('Schedule suggestion checks passed');
const {defaultConstraints,validateConstraints} = await import('./constraints.js');
const rules = {...defaultConstraints(),maxCredits:8};
assert.deepEqual(suggestSchedule(state,{...rules,lockedCourseIds:['a']}).selection,['a','c']);
assert.deepEqual(suggestSchedule(state,{...rules,excludedCourseIds:['b']}).selection,['a','c']);
assert.deepEqual(suggestSchedule(state,{...rules,unavailableDays:['Mon']}).selection,[]);
for (const patch of [
 {lockedCourseIds:['a','b']},
 {lockedCourseIds:['early']},
 {lockedCourseIds:['a'],unavailableDays:['Mon']},
 {lockedCourseIds:['a','c'],maxCredits:4},
 {lockedCourseIds:['a'],excludedCourseIds:['a']},
 {lockedCourseIds:['missing']},
 {unavailableDays:['Monday']},
 {unavailableDays:['Mon','Mon']},
 {unsupported:true}
]) assert.throws(()=>suggestSchedule(state,{...rules,...patch}));
assert.throws(()=>suggestSchedule({courses:[tba],selection:[]},{...rules,lockedCourseIds:['tba']}),/Required course/);
assert.throws(()=>suggestSchedule({courses:[internal],selection:[]},{...rules,lockedCourseIds:['x']}),/Required course/);
assert.throws(()=>suggestSchedule({courses:[course('b',10),duplicate],selection:[]},{...rules,lockedCourseIds:['b','d']}),/Another section/);
const validated = validateConstraints(rules,state.courses); validated.unavailableDays.push('Tue');
assert.deepEqual(rules.unavailableDays,[]);
console.log('Constraint checks passed: required priority, exclusions, days off, collisions, unknowns, malformed rules.');
