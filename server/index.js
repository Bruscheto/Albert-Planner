import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateInterpretRequest,validateInterpretation} from '../src/shared/ai-contract.js';
import {createCandidate,validateExplanation} from './candidate.js';
import {createOpenAIExplainer,createOpenAIInterpreter} from './openai.js';
const root = new URL('../',import.meta.url);
const webFiles = ['index.html','app.js','style.css','fonts.css','import.js','saved-plans.js','compare.js','suggest.js','ai-ui.js','fonts/font-3.ttf','fonts/font-4.ttf','fonts/font-5.ttf'];
const assets = new Map([...webFiles.map(file=>[`/apps/web/${file}`,`apps/web/${file}`]),...['calendar-utils.js','time-parser.js','constants.js','constraints.js','planning-context.js','ai-contract.js','request-state.js'].map(file=>[`/src/shared/${file}`,`src/shared/${file}`])]);
assets.set('/apps/web/','apps/web/index.html');
const mime = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',ttf:'font/ttf'};
class HttpError extends Error { constructor(status,message) { super(message); this.status=status; } }
async function body(req) {
 if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {req.resume();throw new HttpError(415,'Use JSON.');}
 if (Number(req.headers['content-length'])>256*1024) {req.resume();throw new HttpError(413,'Request is too large.');}
 const bytes=await new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  const cleanup=()=>{req.off('data',data);req.off('end',end);req.off('error',error);};
  const error=()=>{cleanup();reject(new HttpError(400,'Request interrupted.'));};
  const data=chunk=>{size+=chunk.length;if(size>256*1024){cleanup();req.resume();reject(new HttpError(413,'Request is too large.'));}else chunks.push(chunk);};
  const end=()=>{cleanup();resolve(Buffer.concat(chunks));};
  req.on('data',data);req.once('end',end);req.once('error',error);
 });
 try {return JSON.parse(bytes.toString('utf8'));} catch {throw new HttpError(400,'Invalid JSON.');}
}
export function createPlannerServer({apiKey=process.env.GLM_API_KEY,model=process.env.GLM_MODEL,baseUrl=process.env.GLM_BASE_URL,interpret,explain,timeoutMs=25000,requestLimit=20}={}) {
 const enabled = Boolean(interpret || (apiKey && model));
 const provider = interpret ?? createOpenAIInterpreter({apiKey,model,baseUrl});
 const explainer=explain ?? createOpenAIExplainer({apiKey,model,baseUrl});
 const explanationEnabled=Boolean(explain || (apiKey && model));
 let busy=false, used=0;
 const server=http.createServer(async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const json=(status,value)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}};
  try {
   const authority=`127.0.0.1:${server.address().port}`;
   if (req.headers.host !== authority) throw new HttpError(403,'Unapproved host.');
   if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403,'Unapproved request.');
   if (req.method==='GET' && req.url==='/api/ai/status') return json(200,{enabled,provider:'GLM',remainingRequests:Math.max(0,requestLimit-used)});
   if (req.method==='GET' && req.url==='/api/health') return json(200,{ok:true,aiEnabled:enabled});
   if(req.method==='POST' && req.url==='/api/ai/suggest') {
    if(req.headers.origin !== `http://${authority}`) throw new HttpError(403,'Unapproved origin.');
    const input=await body(req);
    let candidate;
    try {candidate=createCandidate(input);} catch {throw new HttpError(400,'Cannot build this selection. Confirm context and check required courses for conflicting rules or meetings.');}
    let explanationFactIds=candidate.facts.slice(0,4).map(f=>f.id);
    let explanationStatus=!explanationEnabled?'disabled':busy?'busy':used>=requestLimit?'limited':'unavailable';
    if(explanationEnabled && !busy && used<requestLimit) {
     busy=true;used++;
     const controller=new AbortController();const disconnect=()=>controller.abort();
     res.once('close',disconnect);const timer=setTimeout(()=>controller.abort(),timeoutMs);
     try {
      const output=await explainer({facts:candidate.facts},controller.signal);
      if(controller.signal.aborted) throw Error('Aborted');
      explanationFactIds=validateExplanation(output,candidate);explanationStatus='available';
     } catch {explanationStatus='unavailable';}
     finally {clearTimeout(timer);res.off('close',disconnect);busy=false;}
    }
    return json(200,{requestId:input.requestId,draftRevision:input.draftRevision,goalRevision:input.goalRevision,candidate,explanationFactIds,explanationStatus});
   }
   if (req.method==='POST' && req.url==='/api/ai/interpret') {
    if(req.headers.origin !== `http://${authority}`) throw new HttpError(403,'Unapproved origin.');
    const input=await body(req);
    let request;
    try { request=validateInterpretRequest(input); } catch { throw new HttpError(400,'Invalid planning request. Check your goal, courses, context and constraints.'); }
    if(!enabled) throw new HttpError(503,'AI is not configured. Set GLM_API_KEY and GLM_MODEL on the local server.');
    if(busy) throw new HttpError(429,'Another interpretation is running. Try again after it finishes.');
    if(used>=requestLimit) throw new HttpError(429,'The local session AI request limit has been reached.');
    busy=true; used++;
    const controller=new AbortController();
    const disconnect=()=>controller.abort();
    res.once('close',disconnect);
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
     const output=await provider(request,controller.signal);
     if(controller.signal.aborted) throw new Error('Aborted');
     const result=validateInterpretation(output,request.currentConstraints,request.courses);
     return json(200,{requestId:request.requestId,draftRevision:request.draftRevision,...result});
    } catch {
     throw new HttpError(controller.signal.aborted?504:502,controller.signal.aborted?'AI request timed out or was cancelled. Your rules are unchanged.':'AI interpretation unavailable. Your rules are unchanged; edit them manually or retry.');
    } finally {clearTimeout(timer);res.off('close',disconnect);busy=false;}
   }
   if(req.method!=='GET' && req.method!=='HEAD') throw new HttpError(405,'Method not allowed.');
   if(req.url==='/') {res.writeHead(302,{Location:'/apps/web/'});return res.end();}
   const path=assets.get(req.url?.split('?')[0]);
   if(!path) throw new HttpError(404,'Not found.');
   const bytes=await readFile(new URL(path,root));
   res.writeHead(200,{'Content-Type':mime[path.split('.').pop()]});res.end(req.method==='HEAD'?undefined:bytes);
  } catch(error) {json(error instanceof HttpError?error.status:500,{error:error instanceof HttpError?error.message:'Request failed.'});}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const port=Number(process.env.PORT ?? 4175);
 if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid PORT.');
 createPlannerServer().listen(port,'127.0.0.1',()=>console.log(`Planner: http://127.0.0.1:${port}/apps/web/`));
}
