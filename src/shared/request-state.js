// One pending request/proposal per tab. Any relevant edit invalidates both.
export function createRequestState() {
 let revision=0, active=null;
 const invalidate=()=>{revision++;active?.controller.abort();active=null;};
 return {
  invalidate,
  begin() {invalidate();active={requestId:crypto.randomUUID(),draftRevision:revision,controller:new AbortController(),expiresAt:Date.now()+10*60*1000};return active;},
  owns(ticket) {return active===ticket && ticket.draftRevision===revision;},
  isCurrent(ticket) {return active===ticket && ticket.draftRevision===revision && !ticket.controller.signal.aborted && Date.now()<ticket.expiresAt;}
 };
}
