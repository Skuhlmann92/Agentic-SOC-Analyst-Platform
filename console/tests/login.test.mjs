import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createHmac} from 'node:crypto';
// Real route, throttle, TOTP and session modules; simulated database transport.
const hooks=registerHooks({resolve(s,c,next){
 if(s==='@neondatabase/serverless')return {shortCircuit:true,url:'data:text/javascript,export const neon=()=>({query:(...args)=>globalThis.loginDb(...args)});'};
 if(s==='@/lib/live-api')return {shortCircuit:true,url:'data:text/javascript,export const LIVE_TENANT="22222222-2222-4222-8222-222222222222";'};
 if(s.startsWith('@/'))return next(new URL('../src/'+s.slice(2)+'.ts',import.meta.url).href,c);
 return next(s==='next/server'?'next/server.js':s,c);
}});
const {POST}=await import('../src/app/api/auth/login/route.ts');
const {openSession,sealSession}=await import('../src/lib/session-token.ts');
const original={...process.env},secret=Buffer.from('12345678901234567890').toString('hex');
let calls,attempts,lastStep,failDb,failReplay;
function codeAt(step=Math.floor(Date.now()/30000)){
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
 const d=createHmac('sha1',Buffer.from(secret,'hex')).update(counter).digest();
 return String((d.readUInt32BE(d[19]&15)&0x7fffffff)%1000000).padStart(6,'0');
}
function login(body,origin='https://soc.test'){
 return POST(new Request('https://soc.test/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));
}
const admin=()=>({operator:'admin',password:'test-password',totp:codeAt()});
beforeEach(()=>{
 Object.assign(process.env,{NODE_ENV:'production',CONSOLE_SESSION_SECRET:'isolated-test-session-secret',SOC_ADMIN_PASSWORD:'test-password',SOC_ADMIN_TOTP_SECRET_HEX:secret,POSTGRES_DATABASE_URL:'postgresql://test:test@localhost/test'});
 delete process.env.POSTGRES_URL;
 calls=[];attempts=0;lastStep=-1;failDb=false;failReplay=false;
 globalThis.loginDb=async(sql,params)=>{
  calls.push({sql,params});if(failDb)throw new Error('test unavailable');
  if(sql.includes('soc_auth_throttle'))return [{attempts:++attempts}];
  assert.match(sql,/soc_admin_totp_state/);
  if(failReplay)throw new Error('test replay unavailable');
  if(params[0]<=lastStep)return [];
  lastStep=params[0];return [{id:1}];
 };
});
after(()=>{hooks.deregister();delete globalThis.loginDb;for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];Object.assign(process.env,original);});
async function denied(r,status){assert.equal(r.status,status);assert.equal(r.headers.get('set-cookie'),null);}
test('malformed input returns 422 before authentication work',async()=>{
 for(const body of [null,[],42,'admin',{password:12},{password:{}},{operator:[]},{tenantId:3},{totp:123456},{demo:'true'},{password:'a'.repeat(4097)}])await denied(await login(body),422);
 await denied(await POST(new Request('https://soc.test/api/auth/login',{method:'POST',body:'{'})),422);
 assert.equal(calls.length,0);
});
test('cross-origin login cannot create even a demo session',async()=>{await denied(await login({demo:true},'https://attacker.test'),403);assert.equal(calls.length,0);});
test('valid credentials issue protected tenant-bound MFA session',async()=>{
 const r=await login({...admin(),tenantId:'attacker-controlled'});assert.equal(r.status,200);
 const cookie=r.cookies.get('soc_session'),claims=await openSession(cookie.value);
 assert.equal(claims.mfa,true);assert.equal(claims.role,'admin');assert.equal(claims.tenantId,'22222222-2222-4222-8222-222222222222');
 assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'lax');assert.equal(calls.length,2);
});
test('wrong password and wrong second factor return identical failures',async()=>{
 const a=await login({...admin(),password:'wrong'});await denied(a,401);assert.equal(calls.length,1);
 const b=await login({...admin(),totp:'invalid'});await denied(b,401);assert.deepEqual(await a.json(),await b.json());
});
test('concurrent reuse rejected with simulated atomic database transport',async()=>{
 const body=admin(),rs=await Promise.all([login(body),login(body),login(body)]);
 assert.deepEqual(rs.map(r=>r.status).sort(),[200,401,401]);for(const r of rs.filter(r=>r.status===401))await denied(r,401);
});
test('expired code and absent or malformed secret fail closed',async()=>{
 await denied(await login({...admin(),totp:codeAt(Math.floor(Date.now()/30000)-5)}),401);
 for(const key of ['','bad-secret']){process.env.SOC_ADMIN_TOTP_SECRET_HEX=key;await denied(await login(admin()),401);}
});
test('throttling and database outage never issue cookies',async()=>{
 attempts=30;await denied(await login(admin()),429);failDb=true;await denied(await login(admin()),429);
 delete process.env.POSTGRES_DATABASE_URL;await denied(await login(admin()),429);
});
test('replay-storage failure fails closed after throttle succeeds',async()=>{failReplay=true;await denied(await login(admin()),401);});
test('demo cannot acquire admin or MFA claims',async()=>{
 const r=await login({...admin(),demo:true}),c=await openSession(r.cookies.get('soc_session').value);
 assert.equal(c.role,'analyst');assert.equal(c.mfa,undefined);assert.equal(c.tenantId,'11111111-1111-4111-8111-111111111111');assert.equal(calls.length,0);
});
test('old admin sessions and tampered sessions are rejected',async()=>{
 const c={sub:'admin',role:'admin',name:'Admin',tenantId:'test',exp:Date.now()/1000+3600};
 assert.equal(await openSession(await sealSession(c)),null);
 const token=await sealSession({...c,mfa:true});assert.equal(await openSession(token+'tampered'),null);assert.ok(await openSession(token));
});
test('sample operators disabled in production',async()=>{
 Object.assign(process.env,{ENABLE_LOCAL_OPERATORS:'true',LOCAL_ANALYST_PASSWORD:'test-password'});
 await denied(await login({operator:'analyst',password:'test-password'}),403);
});
