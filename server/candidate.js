import {exactObject} from '../src/shared/ai-contract.js';
import {parseBackup} from '../apps/web/import.js';
import {validateConstraints,DAYS} from '../src/shared/constraints.js';
import {requirePlanningContext} from '../src/shared/planning-context.js';
import {suggestSchedule} from '../apps/web/suggest.js';
import {calculateWeeklyHours} from '../src/shared/calendar-utils.js';
import {timeToMinutes,formatTime} from '../src/shared/time-parser.js';
export function createCandidate(input) {
 exactObject(input,['requestId','draftRevision','goalRevision','confirmedConstraints','courseSnapshot','planningContext']);
 if(typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>80) throw Error('Invalid request ID.');
 for(const key of ['draftRevision','goalRevision']) if(!Number.isSafeInteger(input[key])||input[key]<0) throw Error('Invalid revision.');
 exactObject(input.courseSnapshot,['courses','selection']);
 const snapshot=parseBackup({version:1,data:{courses:input.courseSnapshot.courses,plannerSelection:input.courseSnapshot.selection,planningContext:input.planningContext}});
 requirePlanningContext(snapshot);
 const constraints=validateConstraints(input.confirmedConstraints,snapshot.courses);
 const result=suggestSchedule(snapshot,constraints);
 const selected=snapshot.courses.filter(c=>result.selection.includes(c.id));
 const meetings=selected.flatMap(c=>c.components);
 const days=DAYS.filter(day=>meetings.some(p=>p.days.includes(day)));
 const earliest=meetings.reduce((best,p)=>!best||timeToMinutes(p.timeRange.start)<timeToMinutes(best)?p.timeRange.start:best,null);
 const skipped=result.skipped.map(({course,reason})=>({courseId:course.id,reason}));
 const unknowns=['Academic fit, prerequisites and degree requirements are not checked.','Meeting dates and current offerings are not verified.',...Object.entries(snapshot.planningContext).filter(([key,value])=>key!=='confirmed'&&value===null).map(([key])=>`${({term:'Term',institution:'Institution',campus:'Campus',timeZone:'Time zone'})[key]} is unknown.`)];
 const facts=[
  {id:'credits',text:`${selected.length} courses, ${result.credits} credits; limit ${constraints.maxCredits}.`},
  {id:'hours',text:`${calculateWeeklyHours(meetings).toFixed(1)} known class hours per week. Homework is not estimated.`},
  {id:'days',text:`Meeting days: ${days.join(', ')||'none'}.`},
  {id:'start',text:earliest?`Earliest meeting starts at ${formatTime(earliest)}.`:'No known meetings selected.'},
  ...skipped.map((item,index)=>({id:`skip-${index}`,text:`${snapshot.courses.find(c=>c.id===item.courseId).courseCode} · Section ${snapshot.courses.find(c=>c.id===item.courseId).section}: ${item.reason}.`})),
  ...unknowns.map((text,index)=>({id:`unknown-${index}`,text}))
 ];
 return {courseIds:result.selection,facts,skipped,unknowns};
}
export const explanationSchema={type:'object',additionalProperties:false,required:['factIds'],properties:{factIds:{type:'array',minItems:1,maxItems:6,uniqueItems:true,items:{type:'string'}}}};
export function validateExplanation(value,candidate) {
 exactObject(value,['factIds']);
 const ids=value.factIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>!candidate.facts.some(f=>f.id===id))) throw Error('Invalid explanation facts.');
 return ids;
}
