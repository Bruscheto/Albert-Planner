import {runAcceptance} from './acceptance.js';

if(!process.argv.includes('--live')) {
 console.error('Not run. Add --live to allow up to four paid model requests using synthetic fixtures only.');
 process.exitCode=2;
} else if(!process.env.GLM_API_KEY?.trim() || !process.env.GLM_MODEL?.trim()) {
 console.error('Not run. Configure GLM_API_KEY and GLM_MODEL in the server environment. No provider requests were made.');
 process.exitCode=2;
} else {
 console.log('Running synthetic live acceptance (up to four provider requests; no retries).');
 try {
  const result=await runAcceptance({onCase:name=>console.log(`PASS: ${name}`)});
  console.log(`PASS: ${result.passed.length} acceptance checks completed with ${result.providerRequests} provider requests. Browser interaction/accessibility review remains separate.`);
 } catch {
  // Do not dump raw provider output, credentials or assertions containing payloads.
  console.error('FAIL: live acceptance stopped. See the last passing case above. No automatic retry was attempted. Check configuration and investigate with synthetic fixtures.');
  process.exitCode=1;
 }
}
