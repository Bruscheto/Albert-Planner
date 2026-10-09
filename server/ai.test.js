import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {createPlannerServer} from './index.js';
import {createOpenAIInterpreter} from './openai.js';
import {validateInterpretation,validateInterpretRequest} from '../apps/web/ai-contract.js';
import {defaultConstraints} from '../apps/web/constraints.js';
const input=()=>({requestId:'test-1',draftRevision:1,goalText:'No Friday classes, nothing before 10am, at most 16 credits.',currentConstraints:defaultConstraints(),courses:[{id:'a',courseCode:'MATH',title:'Math',section:'1'}],planningContext:{term:null,institution:null,campus:null,timeZone:null,confirmed:true}});
const output=()=>({constraintPatch:{maxCredits:16,earliestMinutes:600,unavailableDays:['Fri'],lockedCourseIds:null,excludedCourseIds:null},unresolvedGoals:[],clarificationQuestions:[]});
async function server(t,options={}) {
 const app=createPlannerServer(options);app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
 const origin=`http://127.0.0.1:${app.address().port}`;
 const post=(value=input(),headers={})=>fetch(origin+'/api/ai/interpret',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:typeof value==='string'?value:JSON.stringify(value)});
 return {origin,post};
}
test('strict interpretation, unchanged fields and explicit clearing',()=>{
 const request=input();request.currentConstraints.lockedCourseIds=['a'];
 assert.deepEqual(validateInterpretation(output(),request.currentConstraints,request.courses).proposedConstraints.lockedCourseIds,['a']);
 const clear=output();clear.constraintPatch.lockedCourseIds=[];assert.deepEqual(validateInterpretation(clear,request.currentConstraints,request.courses).proposedConstraints.lockedCourseIds,[]);
 for(const mutate of [x=>x.extra=true,x=>x.constraintPatch.extra=true,x=>x.constraintPatch.lockedCourseIds=['missing'],x=>{x.constraintPatch.lockedCourseIds=['a'];x.constraintPatch.excludedCourseIds=['a'];},x=>x.constraintPatch.earliestMinutes=1440,x=>x.unresolvedGoals=['x'.repeat(501)]]){const bad=output();mutate(bad);assert.throws(()=>validateInterpretation(bad,request.currentConstraints,request.courses));}
 const ambiguous=output();ambiguous.clarificationQuestions=['Which math section?'];ambiguous.unresolvedGoals=['Course-content evidence is unavailable for ML preparation.'];assert.equal(validateInterpretation(ambiguous,request.currentConstraints,request.courses).clarificationQuestions.length,1);
 for(const mutate of [x=>x.goalText='x'.repeat(2001),x=>x.planningContext.confirmed=false,x=>x.courses[0].secret='do not forward',x=>x.courses.push({...x.courses[0]}),x=>x.draftRevision=-1]){const bad=input();mutate(bad);assert.throws(()=>validateInterpretRequest(bad));}
});
test('host/origin/body validation and static allowlist block before provider',async t=>{
 let calls=0;const {origin,post}=await server(t,{interpret:async()=>{calls++;return output();}});
 for(const path of ['/server/index.js','/.env','/.git/config','/package.json','/apps/web/import.test.js','/apps/web/%2e%2e/%2e%2e/.env']) assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+'/apps/web/')).status,200);
 const health=await (await fetch(origin+'/api/health')).json();assert.deepEqual(health,{ok:true,aiEnabled:true});
 assert.equal((await fetch(origin+'/apps/web/ai-ui.js')).headers.get('cache-control'),'no-store');
 const badHost = await new Promise((resolve,reject)=>{const req=http.get(origin+'/api/ai/status',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
 assert.equal(badHost,403);
 assert.equal((await post(input(),{Origin:'https://evil.example'})).status,403);
 assert.equal((await post(input(),{Origin:''})).status,403);
 assert.equal((await post(input(),{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post('{')).status,400);
 assert.equal((await post({...input(),goalText:'x'.repeat(2001)})).status,400);
 assert.equal((await post('x'.repeat(256*1024+1))).status,413);
 assert.equal(calls,0);
 const response=await post();assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),null);
 const result=await response.json();assert.equal(result.requestId,'test-1');assert.equal(result.proposedConstraints.earliestMinutes,600);assert.equal(calls,1);
});
test('disabled and quota states',async t=>{
 const disabled=await server(t,{apiKey:'',model:''});assert.equal((await disabled.post()).status,503);
 const {origin,post}=await server(t,{interpret:async()=>output(),requestLimit:1});assert.equal((await post()).status,200);assert.equal((await post()).status,429);
 assert.equal((await (await fetch(origin+'/api/ai/status')).json()).remainingRequests,0);
});
test('busy requests do not call provider; failures stay generic',async t=>{
 let release,started;const ready=new Promise(r=>started=r);let calls=0;
 const {post}=await server(t,{interpret:()=>{calls++;started();return new Promise(r=>release=r);}});
 const pending=post();await ready;assert.equal((await post()).status,429);assert.equal(calls,1);release(output());assert.equal((await pending).status,200);
 const failed=await server(t,{interpret:async()=>{throw Error('SECRET provider detail');}});
 const response=await failed.post();assert.equal(response.status,502);assert.equal((await response.text()).includes('SECRET'),false);
 const malformed=await server(t,{interpret:async()=>({...output(),extra:'bad'})});assert.equal((await malformed.post()).status,502);
});
test('timeout aborts provider and releases slot',async t=>{
 let aborted=false;
 const {post}=await server(t,{timeoutMs:20,interpret:(_,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('abort'));},{once:true}))});
 assert.equal((await post()).status,504);assert.equal(aborted,true);assert.equal((await post()).status,504);
});
test('client disconnect cancels provider',async t=>{
 let started,aborted;const ready=new Promise(r=>started=r),cancelled=new Promise(r=>aborted=r);
 const {origin}=await server(t,{interpret:(_,signal)=>new Promise((_,reject)=>{started();signal.addEventListener('abort',()=>{aborted();reject(Error('abort'));},{once:true});})});
 const controller=new AbortController();const pending=fetch(origin+'/api/ai/interpret',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(input())}).catch(()=>{});
 await ready;controller.abort();await pending;await cancelled;
});
test('GLM adapter requests JSON and rejects malformed output',async()=>{
 const good={choices:[{finish_reason:'stop',message:{content:JSON.stringify(output())}}]};
 let payload;
 const interpret=createOpenAIInterpreter({apiKey:'test-key',model:'configured-model',fetchImpl:async(url,options)=>{assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');payload=JSON.parse(options.body);return new Response(JSON.stringify(good));}});
 assert.deepEqual(await interpret(input(),new AbortController().signal),output());assert.equal(payload.response_format.type,'json_object');assert.equal(payload.model,'configured-model');assert.equal(payload.messages[1].content.includes('goalText'),true);
 assert.match(payload.messages[0].content,/constraintPatch/);
 assert.deepEqual(payload.thinking,{type:'disabled'});
 for(const data of [{choices:[]},{choices:[{finish_reason:'stop',message:{content:'not json'}}]},{choices:[{finish_reason:'stop',message:{}}]},{choices:[{finish_reason:'length',message:{content:JSON.stringify(output())}}]}]) {
  const invalid=createOpenAIInterpreter({fetchImpl:async()=>new Response(JSON.stringify(data))});await assert.rejects(()=>invalid(input()));
 }
});
test('chunked oversized bodies are rejected before provider calls',async t=>{
 let calls=0;const {origin}=await server(t,{interpret:async()=>{calls++;return output();}});
 const status=await new Promise((resolve,reject)=>{
  const req=http.request(origin+'/api/ai/interpret',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});
  req.on('error',reject);req.write('x'.repeat(128*1024));req.write('x'.repeat(128*1024+1));req.end();
 });
 assert.equal(status,413);assert.equal(calls,0);
});
test('interpretation and explanations share concurrency and budget',async t=>{
 const {acceptanceFixture}=await import('./acceptance.js');
 let release,started;const ready=new Promise(resolve=>started=resolve);let explanationCalls=0;
 const {origin,post}=await server(t,{requestLimit:1,interpret:()=>{started();return new Promise(resolve=>release=resolve);},explain:async()=>{explanationCalls++;return {factIds:['credits']};}});
 const fixture=acceptanceFixture();
 const suggest=()=>fetch(origin+'/api/ai/suggest',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({requestId:'shared',draftRevision:1,goalRevision:1,confirmedConstraints:defaultConstraints(),courseSnapshot:{courses:fixture.courses,selection:fixture.selection},planningContext:fixture.planningContext})});
 const pending=post();await ready;
 const busy=await (await suggest()).json();assert.equal(busy.explanationStatus,'busy');assert.ok(busy.candidate.courseIds.length>0);
 release(output());assert.equal((await pending).status,200);
 const limited=await (await suggest()).json();assert.equal(limited.explanationStatus,'limited');assert.equal(explanationCalls,0);
});
