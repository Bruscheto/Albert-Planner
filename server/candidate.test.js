import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createCandidate,validateExplanation} from './candidate.js';
import {createPlannerServer} from './index.js';
import {defaultConstraints} from '../apps/web/constraints.js';
const course=(id,hour,days=['Mon'])=>({id,courseCode:id,section:'1',title:id,credits:4,components:[{type:'Lecture',days,timeRange:{start:{hours:hour,minutes:0},end:{hours:hour+1,minutes:0}}}]});
const input=()=>({requestId:'candidate-1',draftRevision:4,goalRevision:2,confirmedConstraints:{...defaultConstraints(),maxCredits:8,unavailableDays:['Fri'],lockedCourseIds:['b']},courseSnapshot:{courses:[course('a',10),course('b',10),course('c',11),course('friday',12,['Fri']),{...course('unknown',13),components:[]}],selection:['a']},planningContext:{term:null,institution:null,campus:null,timeZone:null,confirmed:true}});
test('candidate respects locks, times, days and credits; facts come from schedule',()=>{
 const request=input(),before=structuredClone(request),candidate=createCandidate(request);
 assert.deepEqual(candidate.courseIds,['b','c']);assert.deepEqual(request,before);
 assert.equal(candidate.facts.find(f=>f.id==='credits').text,'2 courses, 8 credits; limit 8.');
 assert.match(candidate.facts.find(f=>f.id==='hours').text,/2.0 known/);
 assert.match(candidate.facts.find(f=>f.id==='start').text,/10:00 AM/);
 assert.equal(candidate.skipped.find(s=>s.courseId==='friday').reason,'Meets on an unavailable day');
 assert.equal(candidate.skipped.find(s=>s.courseId==='unknown').reason,'Meeting times are unconfirmed');
 assert.ok(candidate.unknowns.includes('Term is unknown.'));
 const invalid=input();invalid.confirmedConstraints.lockedCourseIds=['a','b'];assert.throws(()=>createCandidate(invalid),/Required course/);
 for(const mutate of [x=>x.goalRevision=-1,x=>x.planningContext.confirmed=false,x=>x.courseSnapshot.selection=['invented'],x=>x.confirmedConstraints.lockedCourseIds=['invented'],x=>x.facts=['untrusted']]){const bad=input();mutate(bad);assert.throws(()=>createCandidate(bad));}
});
test('explanations can select facts but cannot add prose or unsupported IDs',()=>{
 const candidate=createCandidate(input());assert.deepEqual(validateExplanation({factIds:['days','credits']},candidate),['days','credits']);
 for(const value of [{factIds:['invented']},{factIds:['credits','credits']},{factIds:[]},{factIds:['credits'],prose:'This course guarantees a job'}])assert.throws(()=>validateExplanation(value,candidate));
});
async function setup(t,options) {
 const server=createPlannerServer({apiKey:'',model:'',...options});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 return (value=input(),headers={})=>fetch(origin+'/api/ai/suggest',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(value)});
}
test('endpoint recomputes candidate, exposes only facts to model and shares quota',async t=>{
 let calls=0;const post=await setup(t,{requestLimit:1,explain:async payload=>{calls++;assert.deepEqual(Object.keys(payload),['facts']);return {factIds:['credits','days']};}});
 const bad=input();bad.confirmedConstraints.lockedCourseIds=['a','b'];assert.equal((await post(bad)).status,400);
 assert.equal((await post(input(),{Origin:'https://evil.example'})).status,403);assert.equal(calls,0);
 const result=await (await post()).json();assert.equal(result.requestId,'candidate-1');assert.equal(result.goalRevision,2);assert.equal(result.explanationStatus,'available');assert.deepEqual(result.candidate.courseIds,['b','c']);
 const limited=await (await post()).json();assert.equal(limited.explanationStatus,'limited');assert.deepEqual(limited.candidate,result.candidate);assert.equal(calls,1);
});
test('missing credentials, malformed output, refusal and timeout preserve deterministic result',async t=>{
 for(const options of [{},{explain:async()=>({factIds:['fake']})},{explain:async()=>{throw Error('provider refusal');}},{timeoutMs:10,explain:(_,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}))}]){
  const post=await setup(t,options);const response=await post();assert.equal(response.status,200);const result=await response.json();assert.notEqual(result.explanationStatus,'available');assert.deepEqual(result.candidate.courseIds,['b','c']);assert.ok(result.explanationFactIds.every(id=>result.candidate.facts.some(f=>f.id===id)));
 }
});
