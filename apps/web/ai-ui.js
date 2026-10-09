import {DAYS,validateConstraints} from '../../src/shared/constraints.js';
import {createRequestState} from '../../src/shared/request-state.js';
const node=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
export function mountAI({getState,getConstraints,applyConstraints}) {
 const $=id=>document.getElementById(id);
 const requests=createRequestState();
 let proposal=null, expiry=null;
 const invalidate=()=>{
  requests.invalidate();proposal=null;clearTimeout(expiry);
  $('ai-review').replaceChildren();$('ai-review').hidden=true;
  $('ai-status').textContent='';$('interpret-goal').disabled=false;
 };
 for(const id of ['ai-goal','ai-consent']) $(id).addEventListener('input',()=>{invalidate();$('ai-notes').replaceChildren();});
 fetch('/api/ai/status').then(r=>r.ok?r.json():Promise.reject()).then(status=>{
  $('ai-availability').textContent=status.enabled?'GLM interpretation is available.': 'AI is not configured for this local preview. You can still set rules manually below.';
 }).catch(()=>{$('ai-availability').textContent='AI is unavailable in this preview. You can still set rules manually below.';});
 $('ai-form').onsubmit=async event=>{
  event.preventDefault();invalidate();$('ai-notes').replaceChildren();
  if(!$('ai-consent').checked){$('ai-status').textContent='Confirm the data notice before sending a goal.';return;}
  let ticket;
  try {
   const state=getState();
   if(!state.planningContext?.confirmed) throw new Error('Review and confirm the planning context below first.');
   const currentConstraints=getConstraints();
   const goalText=$('ai-goal').value.trim();
   if(!goalText || goalText.length>2000) throw new Error('Enter a goal of 1–2,000 characters.');
   ticket=requests.begin();
   $('interpret-goal').disabled=true;$('ai-status').textContent='Interpreting your goal…';
   const timeout=setTimeout(()=>ticket.controller.abort(),28000);
   let response, result;
   try {
    response=await fetch('/api/ai/interpret',{method:'POST',headers:{'Content-Type':'application/json'},signal:ticket.controller.signal,body:JSON.stringify({requestId:ticket.requestId,draftRevision:ticket.draftRevision,goalText,currentConstraints,courses:state.courses.map(({id,courseCode,title,section})=>({id,courseCode,title,section})),planningContext:state.planningContext})});
    result=await response.json();
   } finally {clearTimeout(timeout);}
   if(!requests.isCurrent(ticket)) return;
   if(!response.ok) throw new Error(result.error ?? 'Interpretation unavailable.');
   if(result.requestId!==ticket.requestId || result.draftRevision!==ticket.draftRevision) throw new Error('Outdated response discarded.');
   result.proposedConstraints=validateConstraints(result.proposedConstraints,state.courses);
   proposal={ticket,result};
   renderReview(result,currentConstraints,state.courses);
   $('ai-status').textContent='Review the proposed rules. Your draft has not changed.';
   expiry=setTimeout(()=>{invalidate();$('ai-status').textContent='The proposal expired. Interpret your goal again.';},10*60*1000);
  } catch(error) {
   // Superseded requests must not replace the status of a newer request.
   if(!ticket || requests.owns(ticket)) {
    $('ai-status').textContent=error.name==='AbortError'?'Interpretation cancelled or timed out. Your draft is unchanged.':error.message;
   }
  } finally {if(ticket && requests.owns(ticket)) $('interpret-goal').disabled=false;}
 };
 function renderReview(result,current,courses) {
  const form=$('ai-review');form.replaceChildren();form.hidden=false;
  form.append(node('h3','Review proposed rules'),node('p','Course-content evidence is not available. Academic fit, prerequisites and degree requirements are not checked.'));
  for(const [title,items] of [['Unresolved goals',result.unresolvedGoals],['Needs clarification',result.clarificationQuestions]]) {
   if(items.length){form.append(node('h3',title));const list=node('ul','');for(const item of items)list.append(node('li',item));form.append(list);}
  }
  const draft=structuredClone(result.proposedConstraints);
  const input=(title,type,value)=>{const label=node('label',title);const el=document.createElement('input');el.type=type;el.value=value;el.required=true;label.append(el);form.append(label);return el;};
  const credits=input(`Maximum credits (current: ${current.maxCredits})`,'number',draft.maxCredits);credits.min='0.5';credits.max='30';credits.step='0.5';
  const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const earliest=input(`No classes before (current: ${clock(current.earliestMinutes)})`,'time',clock(draft.earliestMinutes));
  const days=node('fieldset','');days.append(node('legend',`Days off (current: ${current.unavailableDays.join(', ')||'none'})`));
  for(const day of DAYS){const label=node('label','');const check=document.createElement('input');check.type='checkbox';check.checked=draft.unavailableDays.includes(day);check.onchange=()=>{draft.unavailableDays=check.checked?[...draft.unavailableDays,day]:draft.unavailableDays.filter(d=>d!==day);};label.append(check,document.createTextNode(day));days.append(label);}form.append(days);
  const rules=node('div','');rules.className='ai-course-rules';
  for(const course of courses){
   const previous=current.lockedCourseIds.includes(course.id)?'Required':current.excludedCourseIds.includes(course.id)?'Exclude':'Consider';
   const label=node('label',`${course.courseCode} · ${course.title} · Section ${course.section} (current: ${previous})`);
   const select=document.createElement('select');
   for(const [value,title] of [['auto','Consider'],['locked','Required'],['excluded','Exclude']]){const option=node('option',title);option.value=value;select.append(option);}
   select.value=draft.lockedCourseIds.includes(course.id)?'locked':draft.excludedCourseIds.includes(course.id)?'excluded':'auto';
   select.onchange=()=>{draft.lockedCourseIds=draft.lockedCourseIds.filter(id=>id!==course.id);draft.excludedCourseIds=draft.excludedCourseIds.filter(id=>id!==course.id);if(select.value==='locked')draft.lockedCourseIds.push(course.id);if(select.value==='excluded')draft.excludedCourseIds.push(course.id);};label.append(select);rules.append(label);
  }form.append(rules);
  const confirm=node('button','Use reviewed rules');confirm.type='submit';const cancel=node('button','Discard');cancel.type='button';cancel.className='secondary';cancel.onclick=invalidate;form.append(confirm,cancel);
  form.onsubmit=event=>{
   event.preventDefault();
   if(!proposal || !requests.isCurrent(proposal.ticket)){invalidate();$('ai-status').textContent='Proposal expired. Interpret again.';return;}
   try {
    const [hours,minutes]=earliest.value.split(':').map(Number);
    const confirmed=validateConstraints({...draft,maxCredits:Number(credits.value),earliestMinutes:hours*60+minutes},getState().courses);
    applyConstraints(confirmed);invalidate();
    const notes=[...result.unresolvedGoals,...result.clarificationQuestions];
    if(notes.length){$('ai-notes').append(node('h3','Still unresolved from your goal'));for(const item of notes)$('ai-notes').append(node('p',item));}
    $('ai-status').textContent='Reviewed rules applied. Preview a selection below; your agenda is unchanged.';
   } catch(error){$('ai-status').textContent=error.message;}
  };
 }
 return {invalidate,reset(){invalidate();$('ai-goal').value='';$('ai-consent').checked=false;$('ai-notes').replaceChildren();}};
}
