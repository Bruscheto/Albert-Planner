import {createRequestState} from './request-state.js';
import {mountAI} from './ai-ui.js';
import {requirePlanningContext} from '../../src/shared/planning-context.js';
import {DAYS, defaultConstraints, validateConstraints} from '../../src/shared/constraints.js';
import {suggestSchedule} from './suggest.js';
import {comparePlans} from './compare.js';
import {savePlan, listPlans, exportPlan, deletePlan} from './saved-plans.js';
import {parseBackup} from './import.js';
import {findConflicts, calculateWeeklyHours} from '../../src/shared/calendar-utils.js';
import {formatTime} from '../../src/shared/time-parser.js';
const $ = id => document.getElementById(id);
let state = {courses: [], selection: []};
let pending = null;
let suggestion = null;
let fileRequest = 0;
let ai = null;
const serverRequests=createRequestState();
const text = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if(className) el.className = className; return el; };
function preview(data) {
 const snapshot = parseBackup(data);
 const constraints = validateConstraints(data.data.constraints ?? defaultConstraints(), snapshot.courses);
 pending = {...snapshot, constraints};
 pending.planningContext.confirmed = false;
 $('preview-text').textContent = `${pending.courses.length} courses · ${pending.selection.length} selected. Using these courses replaces this tab's current preview. No data will be uploaded.`;
 $('preview').hidden = false;
 $('preview-context').replaceChildren();
 for (const [key, label] of Object.entries({term:'Term', institution:'Institution', campus:'Campus', timeZone:'Time zone'})) {
  $('preview-context').append(text('dt', label), text('dd', pending.planningContext[key] ?? 'Unknown — not verified'));
 }
 $('preview-courses').replaceChildren(...pending.courses.map(course => text('li', `${course.courseCode} · ${course.title} · ${course.credits} credits`)));
 $('status').textContent = '';
 $('confirm').focus();
}
$('file').addEventListener('change', async event => {
 const request = ++fileRequest;
 const file = event.target.files[0];
 if (!file) return;
 pending = null; $('preview').hidden = true;
 try {
  if (file.size > 2 * 1024 * 1024) throw new Error('Choose a JSON export smaller than 2 MB.');
  const contents = await file.text();
  if (request !== fileRequest) return;
  preview(JSON.parse(contents));
 } catch(error) { if(request === fileRequest) $('status').textContent = `Could not import: ${error.message}`; }
 event.target.value = '';
});
$('sample').onclick = () => {
 ++fileRequest;
 const course = (id, title, days, hour) => ({id, courseCode: id, section: '001', title, credits: 4, components: [{type:'Lecture', days, timeRange: {start:{hours:hour,minutes:0},end:{hours:hour+1,minutes:15}}}]});
 preview({version:1,data:{courses:[course('SAMPLE-CS','Algorithms · sample',['Mon','Wed'],10),course('SAMPLE-MATH','Linear Algebra · sample',['Tue','Thu'],13),course('SAMPLE-AI','Machine Learning · sample',['Mon','Wed'],10)],plannerSelection:['SAMPLE-CS','SAMPLE-MATH']}});
};
$('confirm').onclick = () => { if(!pending) return; ai?.reset(); state = {...pending}; pending = null; renderConstraints(); $('import-controls').open = false; $('preview').hidden = true; $('status').textContent = 'Courses loaded in this tab.'; render(); $('context-confirmed').focus(); };
$('cancel').onclick = () => { pending = null; $('preview').hidden = true; };
$('clear').onclick = () => { ai?.reset(); ++fileRequest; pending = null; state = {courses:[],selection:[]}; $('preview').hidden = true; $('workspace').hidden = true; invalidateSuggestion(); $('import-controls').open = true; $('status').textContent = 'Preview cleared.'; };
function render() {
 invalidateSuggestion();
 $('workspace').hidden = false;
 const selected = state.courses.filter(c => state.selection.includes(c.id));
 const schedule = selected.flatMap(c => c.components.filter(p => !p.isTBA).map(p => ({...p, courseId:c.id, courseCode:c.courseCode, title:c.title})));
 const conflicts = new Set(selected.filter(c => findConflicts({...c,components:c.components.filter(p=>!p.isTBA)}, schedule).length).map(c=>c.id));
 const unknown = selected.filter(c => !c.components.length || c.components.some(p=>p.isTBA));
 $('stats').textContent = `${selected.length} courses selected · ${selected.reduce((sum,c)=>sum+c.credits,0)} credits · ${calculateWeeklyHours(schedule).toFixed(1)} known class hours / week`;
 $('warnings').textContent = [conflicts.size ? `${conflicts.size} courses have overlapping meetings.` : 'No overlaps in known meetings.', unknown.length ? `${unknown.length} courses have unconfirmed meeting times.` : '', 'Academic requirements are not checked.'].filter(Boolean).join(' ');
 $('courses').replaceChildren();
 for(const c of state.courses) {
  const label = document.createElement('label'); label.className = 'course';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = state.selection.includes(c.id);
  checkbox.onchange = () => { state.selection = checkbox.checked ? [...state.selection,c.id] : state.selection.filter(id=>id!==c.id); render(); $('courses').querySelectorAll('input')[state.courses.indexOf(c)].focus(); };
  const detail = document.createElement('span'); detail.append(text('strong',c.courseCode),text('span',c.title),text('small',`Section ${c.section} · ${c.credits} credits${conflicts.has(c.id) ? ' · Overlap' : ''}${!c.components.length || c.components.some(p=>p.isTBA) ? ' · Time unconfirmed' : ''}`));
  label.append(checkbox,detail); $('courses').append(label);
 }
 $('week').replaceChildren();
 for(const day of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']) {
  const column = text('section','', 'day'); column.append(text('h3',day));
  const meetings = schedule.filter(p=>p.days.includes(day)).sort((a,b)=>(a.timeRange.start.hours*60+a.timeRange.start.minutes)-(b.timeRange.start.hours*60+b.timeRange.start.minutes));
  if(!meetings.length) column.append(text('p','No scheduled classes','empty'));
  for(const p of meetings) { const card = text('div','',conflicts.has(p.courseId)?'meeting conflict':'meeting'); card.append(text('small',p.courseCode),text('strong',p.title),text('span',`${formatTime(p.timeRange.start)}–${formatTime(p.timeRange.end)}`),text('small',`${p.type}${conflicts.has(p.courseId) ? ' · Time conflict' : ''}`)); column.append(card); }
  $('week').append(column);
 }
}

function refreshSavedPlans() {
 $('saved-list').replaceChildren();
 try {
  const {plans, unreadable} = listPlans(localStorage);
  setupComparison(plans);
  $('saved-status').textContent = unreadable ? `${unreadable} saved plans could not be read. Their data has been left untouched.` : plans.length ? 'Open a saved copy to continue planning.' : 'No saved plans yet.';
  for (const plan of plans) {
   const row = text('div', '', 'saved-row');
   const info = text('div', '');
   info.append(text('strong', plan.name), text('small', `${plan.selection.length} selected · ${new Date(plan.savedAt).toLocaleString()}`));
   const open = text('button', 'Open', 'secondary');
   open.type = 'button';
   open.onclick = () => {
    if (state.courses.length && !confirm('Replace the current draft with this saved plan? Save a copy first if you want to keep your changes.')) return;
    ++fileRequest;
    pending = null;
    ai?.reset();
    state = structuredClone({courses: plan.courses, selection: plan.selection, constraints:plan.constraints, planningContext:plan.planningContext});
    renderConstraints();
    $('plan-name').value = plan.name;
    $('preview').hidden = true;
    $('import-controls').open = false;
    render();
    $('status').textContent = `Opened “${plan.name}”. Changes remain a draft until you save a copy.`;
    $('context-confirmed').focus();
   };
   const download = text('button', 'Export', 'secondary');
   download.type = 'button';
   download.onclick = () => {
    try {
     const url = URL.createObjectURL(new Blob([exportPlan(plan)], {type:'application/json'}));
     const link = document.createElement('a');
     link.href = url; link.download = 'albert-plan.json'; link.click();
     setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { $('status').textContent = 'Could not export this plan. Your saved copy is unchanged.'; }
   };
   const remove = text('button', 'Delete', 'secondary');
   remove.type = 'button';
   remove.onclick = () => {
    if (!confirm(`Delete “${plan.name}” from this browser? Export it first if you need a backup. Your current draft will not change.`)) return;
    try {
     deletePlan(localStorage, plan.id);
     refreshSavedPlans();
     $('status').textContent = `Deleted “${plan.name}”. Your current draft is unchanged.`;
     $('saved-plans').focus();
    } catch { $('status').textContent = 'Could not delete this plan. Try again; your draft is unchanged.'; }
   };
   const actions = text('div', '', 'actions');
   actions.append(open, download, remove);
   row.append(info, actions);
   $('saved-list').append(row);
  }
 } catch {
  $('saved-status').textContent = 'Browser storage is unavailable. You can still plan in this tab.';
 }
}
$('save-form').onsubmit = event => {
 event.preventDefault();
 try {
  Object.assign(state.constraints, readConstraints());
  const plan = savePlan(localStorage, $('plan-name').value, state);
  $('status').textContent = `Saved “${plan.name}” in this browser.`;
  refreshSavedPlans();
 } catch (error) {
  $('status').textContent = `Not saved: ${error.message} Your current draft is still available.`;
 }
};
window.addEventListener('storage', refreshSavedPlans);
refreshSavedPlans();

function setupComparison(plans) {
 $('comparison').hidden = plans.length < 2;
 const previous = [$('compare-left').value, $('compare-right').value];
 for (const [index, id] of ['compare-left', 'compare-right'].entries()) {
  const select = $(id);
  select.replaceChildren();
  for (const plan of plans) {
   const option = text('option', `${plan.name} — ${new Date(plan.savedAt).toLocaleString()}`);
   option.value = plan.id;
   select.append(option);
  }
  select.value = plans.some(plan => plan.id === previous[index]) ? previous[index] : plans[index]?.id ?? '';
 }
 if (plans.length > 1 && $('compare-left').value === $('compare-right').value) {
  $('compare-right').value = plans.find(plan => plan.id !== $('compare-left').value).id;
 }
 const update = () => {
  const result = $('compare-result');
  result.replaceChildren();
  const left = plans.find(plan => plan.id === $('compare-left').value);
  const right = plans.find(plan => plan.id === $('compare-right').value);
  if (!left || !right) return;
  if (left.id === right.id) { result.append(text('p', 'Choose two different saved plans.')); return; }
  const comparison = comparePlans(left, right);
  result.append(text('p', `${comparison.shared.length} selected courses unchanged. Changed meeting details appear on both sides.`));
  const columns = text('div', '', 'compare-columns');
  for (const [plan, stats, courses] of [[left, comparison.left, comparison.onlyLeft], [right, comparison.right, comparison.onlyRight]]) {
   const column = text('section', '', 'compare-column');
   column.append(text('h3', plan.name), text('p', `${stats.credits} credits · ${stats.hours.toFixed(1)} known class hours/week`));
   if (stats.unknown) column.append(text('p', `${stats.unknown} selected courses have unconfirmed times.`));
   column.append(text('h3', 'Different courses'));
   if (!courses.length) column.append(text('p', 'None.'));
   const list = document.createElement('ul');
   for (const course of courses) {
    const item = text('li', `${course.courseCode} · ${course.title} · Section ${course.section}`);
    for (const part of course.components) item.append(text('small', part.isTBA ? `${part.type}: time unconfirmed` : `${part.days.join(', ')} · ${formatTime(part.timeRange.start)}–${formatTime(part.timeRange.end)}`));
    list.append(item);
   }
   column.append(list); columns.append(column);
  }
  result.append(columns, text('p', 'Compares saved snapshots, not current offerings or degree requirements.'));
 };
 $('compare-left').onchange = update;
 $('compare-right').onchange = update;
 update();
}

function invalidateSuggestion() {
 serverRequests.invalidate();
 $('server-suggest').disabled=false;
 ai?.invalidate();
 suggestion = null;
 $('suggest-result').replaceChildren();
 $('apply-suggestion').hidden = true;
}
function readConstraints() {
 const [hours, minutes] = $('earliest').value.split(':').map(Number);
 return validateConstraints({...state.constraints, maxCredits:Number($('max-credits').value), earliestMinutes:hours*60+minutes}, state.courses);
}
function renderConstraints() {
 renderContext();
 const constraints = state.constraints;
 $('max-credits').value = constraints.maxCredits;
 $('earliest').value = `${String(Math.floor(constraints.earliestMinutes/60)).padStart(2,'0')}:${String(constraints.earliestMinutes%60).padStart(2,'0')}`;
 $('unavailable-days').replaceChildren();
 for (const day of DAYS) {
  const label = text('label','');
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = constraints.unavailableDays.includes(day);
  input.onchange = () => { constraints.unavailableDays = input.checked ? [...constraints.unavailableDays,day] : constraints.unavailableDays.filter(d=>d!==day); invalidateSuggestion(); };
  label.append(input,document.createTextNode(day)); $('unavailable-days').append(label);
 }
 $('course-rules').replaceChildren();
 for (const course of state.courses) {
  const label = text('label',`${course.courseCode} · ${course.title} · Section ${course.section}`);
  const select = document.createElement('select');
  for (const [value,title] of [['auto','Consider'],['locked','Required'],['excluded','Exclude']]) {
   const option = text('option',title); option.value=value; select.append(option);
  }
  select.value = constraints.lockedCourseIds.includes(course.id) ? 'locked' : constraints.excludedCourseIds.includes(course.id) ? 'excluded' : 'auto';
  select.onchange = () => {
   constraints.lockedCourseIds = constraints.lockedCourseIds.filter(id=>id!==course.id);
   constraints.excludedCourseIds = constraints.excludedCourseIds.filter(id=>id!==course.id);
   if (select.value === 'locked') constraints.lockedCourseIds.push(course.id);
   if (select.value === 'excluded') constraints.excludedCourseIds.push(course.id);
   invalidateSuggestion();
  };
  label.append(select); $('course-rules').append(label);
 }
}
for (const id of ['max-credits','earliest']) $(id).oninput = () => {
 invalidateSuggestion();
 // Retain invalid input in the form; saving and suggesting validate it explicitly.
};
$('suggest-form').onsubmit = event => {
 event.preventDefault();
 invalidateSuggestion();
 try {
  Object.assign(state.constraints, readConstraints());
  requirePlanningContext(state);
  const result = suggestSchedule(state, state.constraints);
  showSuggestion(result);
 } catch (error) { $('suggest-result').textContent = error.message; }
};
$('apply-suggestion').onclick = () => {
 if (!suggestion) return;
 if(suggestion.ticket && !serverRequests.isCurrent(suggestion.ticket)){invalidateSuggestion();$('suggest-result').textContent='Selection expired. Preview again.';return;}
 try {
  requirePlanningContext(state);
  const fresh=suggestSchedule(state,readConstraints());
  if(JSON.stringify(fresh.selection)!==JSON.stringify(suggestion.selection)) throw Error('Rules changed. Preview again.');
 } catch(error){invalidateSuggestion();$('suggest-result').textContent=error.message;return;}
 state.selection = [...suggestion.selection];
 render();
 $('status').textContent = 'Suggested selection applied to your draft. Save a copy to keep it.';
};

function renderContext() {
 const context = state.planningContext;
 $('context-summary').textContent = `Term: ${context.term ?? 'unknown'} · Institution: ${context.institution ?? 'unknown'} · Campus: ${context.campus ?? 'unknown'} · Time zone: ${context.timeZone ?? 'unknown'}. Imported meeting details are not verified against current offerings.`;
 $('context-confirmed').checked = context.confirmed;
}
$('context-confirmed').onchange = event => {
 state.planningContext.confirmed = event.target.checked;
 invalidateSuggestion();
};

ai = mountAI({getState:()=>state,getConstraints:readConstraints,applyConstraints:constraints=>{
 state.constraints=constraints;
 invalidateSuggestion();
 renderConstraints();
}});

function showSuggestion(result) {
  const container = $('suggest-result');
  container.append(text('p', result.selection.length ? `${result.selection.length} courses · ${result.credits} credits. Review before applying.` : 'No courses were selected with these settings. Review your credit limit, start time, days off, and exclusions.'));
  const included = document.createElement('ul');
  for (const course of state.courses.filter(c=>result.selection.includes(c.id))) included.append(text('li', `${course.courseCode} · ${course.title} · Section ${course.section}`));
  container.append(included);
  if (result.skipped.length) {
   container.append(text('h3','Not included'));
   const list = document.createElement('ul');
   for (const {course,reason} of result.skipped) list.append(text('li',`${course.courseCode} · Section ${course.section}: ${reason}`));
   container.append(list);
  }
  suggestion = result;
  $('apply-suggestion').hidden = !result.selection.length;
}

for(const id of ['ai-goal','explanation-consent']) $(id).addEventListener('input',invalidateSuggestion);
$('server-suggest').onclick=async()=>{
 invalidateSuggestion();
 if(!$('explanation-consent').checked){$('suggest-result').textContent='Confirm the explanation data notice first, or use the local preview.';return;}
 let ticket;
 try {
  requirePlanningContext(state);
  Object.assign(state.constraints,readConstraints());
  // Check required-course conflicts locally before sending a request.
  suggestSchedule(state,state.constraints);
  ticket=serverRequests.begin();$('server-suggest').disabled=true;
  $('suggest-result').textContent='Building suggested combination…';
  const timer=setTimeout(()=>ticket.controller.abort(),28000);
  let response,result;
  try {
   response=await fetch('/api/ai/suggest',{method:'POST',signal:ticket.controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:ticket.requestId,draftRevision:ticket.draftRevision,goalRevision:ticket.draftRevision,confirmedConstraints:state.constraints,courseSnapshot:{courses:state.courses,selection:state.selection},planningContext:state.planningContext})});
   result=await response.json();
  } finally {clearTimeout(timer);}
  if(!serverRequests.isCurrent(ticket)) return;
  if(!response.ok) throw Error(result.error ?? 'Server suggestion unavailable. Use the local preview.');
  if(result.requestId!==ticket.requestId || result.draftRevision!==ticket.draftRevision || result.goalRevision!==ticket.draftRevision) throw Error('Outdated suggestion discarded.');
  const local=suggestSchedule(state,readConstraints());
  if(JSON.stringify(result.candidate.courseIds)!==JSON.stringify(local.selection)) throw Error('Selection could not be verified. Use the local preview.');
  $('suggest-result').replaceChildren();
  showSuggestion({...local,ticket});
  const container=$('suggest-result');
  container.append(text('h3','Suggested combination'),text('p',result.explanationStatus==='available'?'AI selected the highlights below from calculated facts.':'AI explanation unavailable. Showing calculated facts.'));
  const facts=new Map(result.candidate.facts.map(f=>[f.id,f.text]));
  for(const id of result.explanationFactIds) if(facts.has(id))container.append(text('p',facts.get(id)));
  for(const unknown of result.candidate.unknowns)container.append(text('p',unknown,'hint'));
  container.append(text('p','Uses shortlist order after required and checked courses. Other combinations may be possible.','hint'));
 } catch(error) {
  if(!ticket || serverRequests.owns(ticket)){$('suggest-result').textContent=error.name==='AbortError'?'Request cancelled or timed out. Use the local preview or try again.':error.message;}
 } finally {if(ticket && serverRequests.owns(ticket)) $('server-suggest').disabled=false;}
};
