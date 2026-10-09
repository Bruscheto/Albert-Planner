import assert from 'node:assert/strict';
import {parseBackup} from './import.js';
import {findConflicts} from '../../src/shared/calendar-utils.js';
const course = {id:'a',courseCode:'CS',section:'001',title:'Test',credits:4,components:[{type:'Lecture',days:['Mon'],timeRange:{start:{hours:10,minutes:0},end:{hours:11,minutes:0}}}]};
const backup = () => ({version:1,data:{courses:[structuredClone(course)],plannerSelection:['a'],secret:'must not survive'}});
const result = parseBackup(backup());
assert.deepEqual(Object.keys(result),['courses','selection','planningContext']);
assert.equal(JSON.stringify(result).includes('secret'),false);
for(const mutate of [b=>b.version=2,b=>b.data.courses.push(course),b=>b.data.plannerSelection=['missing'],b=>b.data.courses[0].credits=-1,b=>b.data.courses[0].components[0].days=['Oops'],b=>b.data.courses[0].components[0].timeRange.end.hours=9]) {
 const b=backup(); mutate(b); assert.throws(()=>parseBackup(b));
}
const tba=backup(); tba.data.courses[0].components[0].timeRange=null;
assert.equal(parseBackup(tba).courses[0].components[0].isTBA,true);
const schedule=[{...course.components[0],courseId:'b'}];
assert.equal(findConflicts(course,schedule).length,1);
const adjacent=structuredClone(course); adjacent.components[0].timeRange={start:{hours:11,minutes:0},end:{hours:12,minutes:0}};
assert.equal(findConflicts(adjacent,schedule).length,0);
assert.deepEqual(parseBackup({version:1,data:{courses:[]}}).selection,[]);
console.log('Web import checks passed');
