import {DAYS, defaultConstraints, validateConstraints} from './constraints.js';
import {planningContext} from './planning-context.js';
export function exactObject(value, keys) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key)) || keys.some(key=>!Object.hasOwn(value,key))) throw new Error('Invalid fields.');
}
function boundedText(value, max) {
 if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid text.');
 return value;
}
export function validateInterpretRequest(value) {
 exactObject(value,['requestId','draftRevision','goalText','currentConstraints','courses','planningContext']);
 const requestId = boundedText(value.requestId,80);
 if (!Number.isSafeInteger(value.draftRevision) || value.draftRevision < 0) throw new Error('Invalid revision.');
 const goalText = boundedText(value.goalText,2000);
 if (!Array.isArray(value.courses) || !value.courses.length || value.courses.length > 100) throw new Error('Invalid course count.');
 const courses = value.courses.map(course=>{
  exactObject(course,['id','courseCode','title','section']);
  return Object.fromEntries(Object.entries(course).map(([key,v])=>[key,boundedText(v,500)]));
 });
 if (new Set(courses.map(c=>c.id)).size !== courses.length) throw new Error('Duplicate course IDs.');
 exactObject(value.planningContext,['term','institution','campus','timeZone','confirmed']);
 const context = planningContext([],value.planningContext);
 if (!context.confirmed) throw new Error('Confirm planning context first.');
 return {requestId,draftRevision:value.draftRevision,goalText,courses,currentConstraints:validateConstraints(value.currentConstraints,courses),planningContext:context};
}
export function validateInterpretation(value, current, courses) {
 exactObject(value,['constraintPatch','unresolvedGoals','clarificationQuestions']);
 exactObject(value.constraintPatch,Object.keys(defaultConstraints()));
 const patch = Object.fromEntries(Object.entries(value.constraintPatch).filter(([,v])=>v !== null));
 const proposedConstraints = validateConstraints({...current,...patch},courses);
 const texts = key => {
  if (!Array.isArray(value[key]) || value[key].length > 10) throw new Error('Invalid clarification list.');
  return value[key].map(v=>boundedText(v,500));
 };
 return {proposedConstraints,unresolvedGoals:texts('unresolvedGoals'),clarificationQuestions:texts('clarificationQuestions')};
}
const array = items => ({type:['array','null'],items});
export const interpretationSchema = {
 type:'object',additionalProperties:false,required:['constraintPatch','unresolvedGoals','clarificationQuestions'],properties:{
  constraintPatch:{type:'object',additionalProperties:false,required:Object.keys(defaultConstraints()),properties:{
   maxCredits:{type:['number','null']},earliestMinutes:{type:['integer','null']},
   unavailableDays:array({type:'string',enum:DAYS}),lockedCourseIds:array({type:'string'}),excludedCourseIds:array({type:'string'})
  }},
  unresolvedGoals:{type:'array',items:{type:'string'}},clarificationQuestions:{type:'array',items:{type:'string'}}
 }
};
