import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequestState} from '../../src/shared/request-state.js';
test('edits and subsequent requests reject stale replies and abort earlier work',()=>{
 const gate=createRequestState();const first=gate.begin();assert.equal(gate.isCurrent(first),true);
 gate.invalidate();assert.equal(first.controller.signal.aborted,true);assert.equal(gate.isCurrent(first),false);
 const second=gate.begin();const third=gate.begin();assert.equal(gate.owns(second),false);assert.equal(gate.isCurrent(third),true);
 third.controller.abort();assert.equal(gate.owns(third),true);assert.equal(gate.isCurrent(third),false);
 const expired=gate.begin();expired.expiresAt=0;assert.equal(gate.isCurrent(expired),false);
});
