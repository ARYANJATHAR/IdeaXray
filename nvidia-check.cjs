const { createRequire } = require('node:module');
const path = require('node:path');
const req = createRequire(path.join(process.cwd(), 'package.json'));
req('@next/env').loadEnvConfig(process.cwd());
const {z} = req('zod');
const key = process.env.NVIDIA_API_KEY;
if (!key) { console.log('NVIDIA_API_KEY is missing'); process.exit(1); }
const synthesis = process.argv.includes('--synthesis');
const args = process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const models = args.length ? args : (process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b,moonshotai/kimi-k3,nvidia/nemotron-3.5-lightning-30b-a3b').split(',').map(s=>s.trim()).filter(Boolean);
const timeout = Number(process.env.NVIDIA_TIMEOUT_MS || 12000);
const short=z.string().min(1).max(500), strings=z.array(short).max(12);
const citation = '11111111-1111-4111-8111-111111111111';
const schema=synthesis ? z.object({findings:z.array(z.object({title:short,body:z.string().min(1).max(1200),evidenceIds:z.array(z.literal(citation)).min(1).max(12),confidence:z.enum(['low','medium','high'])})).min(1).max(6)}) : z.object({actionable:z.literal(true),title:z.string().min(1).max(120),problem:short,solution:short,targetUsers:strings,technologies:strings,mechanisms:strings,synonyms:strings,commercialTerms:strings.min(1),researchTerms:strings.min(1),concepts:strings.min(2).max(8)});
async function probe(model, ms, mode='app') {
  const start=Date.now();
  try {
    const input = synthesis ? {task:'Write one cautious finding supported only by the supplied excerpt. Cite its exact evidence ID. No legal novelty conclusions.',idea:'Wearable posture reminder',evidence:[{id:citation,title:'Test fixture: wearable posture reminder',snippet:'This test fixture describes a wearable posture reminder that detects slouching and provides a vibration alert.'}]} : {idea:'A low-cost wearable posture reminder that vibrates when a desk worker slouches and works without a smartphone. Return actionable=true and identify broad technical and commercial search terms.'};
    const body={model,stream:false,max_tokens:8192,response_format:{type:'json_object'},messages:[{role:'system',content:'You are an evidence analyst. Return only a JSON object matching this schema. Do not invent external facts. '+JSON.stringify(z.toJSONSchema(schema))},{role:'user',content:JSON.stringify(input)}],...(model.startsWith('nvidia/nemotron-')?{chat_template_kwargs:{enable_thinking:false}}:{}),...(model==='moonshotai/kimi-k3'?{reasoning_effort:'low'}:{})};
    const r=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(ms)});
    const raw=await r.json().catch(()=>null);
    let valid=false;
    try {valid=schema.safeParse(JSON.parse(raw?.choices?.[0]?.message?.content)).success;}catch{}
    const result={model,mode,http:r.status,durationMs:Date.now()-start,finishReason:raw?.choices?.[0]?.finish_reason||null,schemaValid:valid};
    if (!r.ok) result.reason=({401:'Credentials rejected',403:'Access denied',404:'Model unavailable',429:'Rate limited',503:'Service unavailable'})[r.status]||'Provider error';
    console.log(JSON.stringify(result));
    return result;
  }catch(e){const result={model,mode,durationMs:Date.now()-start,reason:e.name==='TimeoutError'?'Timed out':'Network request failed',networkCode:e.cause?.code||null};console.log(JSON.stringify(result));return result;}
}
(async()=>{
  try {
    const r=await fetch('https://integrate.api.nvidia.com/v1/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
    const json=await r.json().catch(()=>null);
    console.log(JSON.stringify({modelCatalogHttp:r.status,configuredModels:models.map(model=>({model,listed:json?.data?.some(item=>item.id===model)??null}))}));
  }catch(e){console.log(JSON.stringify({catalogError:e.name,networkCode:e.cause?.code||null}));}
  const results=await Promise.all(models.map(model=>probe(model,timeout)));
  const slow=results.filter(r=>r.reason==='Timed out');
  if(slow.length) await Promise.all(slow.map(r=>probe(r.model,60000,'longer-timeout-diagnostic')));
})();
