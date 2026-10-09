import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPlannerServer} from './index.js';
import {defaultConstraints} from '../apps/web/constraints.js';
import {savePlan,listPlans} from '../apps/web/saved-plans.js';

// Synthetic fixtures only: no browser storage, exports or personal course records.
export function acceptanceFixture() {
 const course=(id,code,title,hour,days=['Mon'])=>({id,courseCode:code,title,section:'001',credits:4,components:[{type:'Lecture',days,timeRange:{start:{hours:hour,minutes:0},end:{hours:hour+1,minutes:0}}}]});
 return {
  courses:[course('sample-math-a','SAMPLE-MATH-A','Mathematics A',10),course('sample-math-b','SAMPLE-MATH-B','Mathematics B',11),course('sample-friday','SAMPLE-FRI','Friday Seminar',12,['Fri']),course('sample-early','SAMPLE-EARLY','Early Seminar',8)],
  selection:[],planningContext:{term:'Fall 2026',institution:'Synthetic test institution',campus:'Synthetic campus',timeZone:'America/New_York',confirmed:true}
 };
}
export async function runAcceptance({onCase=()=>{},...options}={}) {
 const server=createPlannerServer({...options,requestLimit:4});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin=`http://127.0.0.1:${server.address().port}`;
 const fixture=acceptanceFixture();const courses=fixture.courses.map(({id,courseCode,title,section})=>({id,courseCode,title,section}));
 const passed=[];
 const post=async(route,input)=>{
  const response=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify(input)});
  assert.equal(response.status,200,'Endpoint did not return a successful result.');
  const result=await response.json();
  assert.equal(result.requestId,input.requestId,'Request ID mismatch.');assert.equal(result.draftRevision,input.draftRevision,'Revision mismatch.');
  return result;
 };
 const interpret=(requestId,goalText)=>post('/api/ai/interpret',{requestId,draftRevision:1,goalText,currentConstraints:defaultConstraints(),courses,planningContext:fixture.planningContext});
 const record=name=>{passed.push(name);onCase(name);};
 try {
  const normalized=await interpret('normalize','No Friday classes, nothing before 10am, at most 4 credits.');
  assert.equal(normalized.proposedConstraints.maxCredits,4);assert.equal(normalized.proposedConstraints.earliestMinutes,600);
  assert.deepEqual(normalized.proposedConstraints.unavailableDays,['Fri']);
  assert.deepEqual(normalized.proposedConstraints.lockedCourseIds,[]);assert.deepEqual(normalized.proposedConstraints.excludedCourseIds,[]);
  assert.equal(normalized.clarificationQuestions.length,0);assert.equal(normalized.unresolvedGoals.length,0);
  record('Credit, start-time and day preferences');

  const ambiguous=await interpret('ambiguity','Keep math in my schedule.');
  assert.ok(ambiguous.clarificationQuestions.length>0,'Ambiguous math reference must ask for clarification.');
  assert.deepEqual(ambiguous.proposedConstraints,defaultConstraints(),'Ambiguous reference must not silently choose a course or change rules.');
  record('Ambiguous course reference');

  const unsupported=await interpret('unsupported','Prepare me for a career in machine learning.');
  assert.ok(unsupported.unresolvedGoals.length>0,'Unsupported educational fit must remain unresolved.');
  assert.deepEqual(unsupported.proposedConstraints,defaultConstraints(),'Career aspiration must not invent schedule rules.');
  record('Unsupported academic aspiration');

  const result=await post('/api/ai/suggest',{requestId:'candidate',draftRevision:2,goalRevision:1,confirmedConstraints:normalized.proposedConstraints,courseSnapshot:{courses:fixture.courses,selection:fixture.selection},planningContext:fixture.planningContext});
  assert.equal(result.goalRevision,1);assert.equal(result.explanationStatus,'available','Fallback is not evidence of a successful live explanation.');
  assert.deepEqual(result.candidate.courseIds,['sample-math-a']);
  assert.ok(result.explanationFactIds.length>0);
  assert.ok(result.explanationFactIds.every(id=>result.candidate.facts.some(f=>f.id===id)));
  assert.ok(result.candidate.skipped.some(item=>item.courseId==='sample-friday'&&item.reason==='Meets on an unavailable day'));
  assert.ok(result.candidate.skipped.some(item=>item.courseId==='sample-early'&&item.reason==='Starts before your earliest time'));
  record('Server candidate and grounded explanation');

  const values=new Map();const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  savePlan(storage,'Synthetic acceptance',{...fixture,selection:result.candidate.courseIds,constraints:normalized.proposedConstraints},'acceptance');
  const restored=listPlans(storage).plans[0];
  assert.deepEqual(restored.selection,result.candidate.courseIds);assert.deepEqual(restored.constraints,normalized.proposedConstraints);assert.deepEqual(restored.planningContext,fixture.planningContext);
  record('Snapshot save and restore');
  return {passed,providerRequests:4};
 } finally {await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
}
