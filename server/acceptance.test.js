import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runAcceptance} from './acceptance.js';
const unchanged=()=>({maxCredits:null,earliestMinutes:null,unavailableDays:null,lockedCourseIds:null,excludedCourseIds:null});
function interpretation({requestId}) {
 return {constraintPatch:requestId==='normalize'?{...unchanged(),maxCredits:4,earliestMinutes:600,unavailableDays:['Fri']}:unchanged(),unresolvedGoals:requestId==='unsupported'?['Course-content evidence is unavailable.']:[],clarificationQuestions:requestId==='ambiguity'?['Which math course?']:[]};
}
test('acceptance harness exercises interpretation, candidate, explanation and persistence with synthetic fixtures',async()=>{
 let calls=0;
 const result=await runAcceptance({apiKey:'',model:'',interpret:async input=>{calls++;return interpretation(input);},explain:async()=>{calls++;return {factIds:['credits','days']};}});
 assert.equal(result.passed.length,5);assert.equal(calls,4);
});
test('acceptance fails instead of treating explanation fallback as live success',async()=>{
 await assert.rejects(()=>runAcceptance({apiKey:'',model:'',interpret:async input=>interpretation(input),explain:async()=>{throw Error('unavailable');}}),/Fallback is not evidence/);
});
test('acceptance catches invented rules for ambiguous references',async()=>{
 await assert.rejects(()=>runAcceptance({apiKey:'',model:'',interpret:async input=>{const output=interpretation(input);if(input.requestId==='ambiguity')output.constraintPatch.lockedCourseIds=['sample-math-a'];return output;},explain:async()=>({factIds:['credits']})}),/Ambiguous reference/);
});
test('live runner requires explicit opt-in and credentials without logging them',()=>{
 const env={...process.env,GLM_API_KEY:'',GLM_MODEL:''};
 const result=spawnSync(process.execPath,['server/live-check.js','--live'],{env,encoding:'utf8'});
 assert.equal(result.status,2);assert.match(result.stderr,/No provider requests/);
 const denied=spawnSync(process.execPath,['server/live-check.js'],{env:{...env,GLM_API_KEY:'synthetic-secret',GLM_MODEL:'synthetic'},encoding:'utf8'});
 assert.equal(denied.status,2);assert.equal((denied.stdout+denied.stderr).includes('synthetic-secret'),false);
});
