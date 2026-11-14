import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const testDatabase=process.env.TEST_DATABASE_URL?.trim();
if(testDatabase)process.env.DATABASE_URL=testDatabase;

describe('Production-compatible legacy phone sessions protect Fitness (PostgreSQL)',{skip:!testDatabase},()=>{
  const active=randomUUID(),closing=randomUUID(),inactive=randomUUID(),guest=randomUUID();
  const actors=[active,closing,inactive];const suffix=String(Date.now()).slice(-6);
  const phone=new Map([[active,`+919001${suffix}`],[closing,`+919002${suffix}`],[inactive,`+919003${suffix}`]]);
  const otpRequestId=randomUUID();const otpPhone=`+919004${suffix}`;const tokens:Record<string,string>={};const original={node:process.env.NODE_ENV,jwt:process.env.JWT_SECRET,key:process.env.FITNESS_DATA_ENCRYPTION_KEY};
  let app:any,db:any,sqlClient:any,schema:any,sign:any,verify:any;let issuedUser:string|undefined;const sendCalls:unknown[][]=[],verifyCalls:unknown[][]=[];
  async function request(path:string,method='GET',token?:string,body?:unknown){const response=await app.request(path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,headers:response.headers,body:await response.json() as any};}
  before(async()=>{
    process.env.NODE_ENV='production';process.env.JWT_SECRET='candidate-auth-compatibility-test-only-secret-2026';process.env.FITNESS_DATA_ENCRYPTION_KEY='5'.repeat(64);
    const {Hono}=await import('hono');const {createAuthRoutes}=await import('./auth.js');const {fitnessMobileRoutes}=await import('./fitness.js');const {requireAuth}=await import('../middleware/auth.js');const auth=await import('../lib/auth.js');sign=auth.signToken;verify=auth.verifyToken;
    const connection=await import('../db/client.js');db=connection.db;sqlClient=connection.sql;schema=await import('../db/schema.js');
    app=new Hono().route('/auth',createAuthRoutes({otpProvider:{sendOtp:async(...args:any[])=>{sendCalls.push(args);return {requestId:otpRequestId,expiresInSeconds:300};},verifyOtp:async(...args:any[])=>{verifyCalls.push(args);return true;}}})).route('/v1/fitness',fitnessMobileRoutes);
    app.get('/protected',requireAuth,(c:any)=>c.json({ok:true,userId:c.get('auth').sub}));
    await db.insert(schema.mobileUsers).values(actors.map(id=>({id,phone:phone.get(id),displayName:'Compatibility fixture',isActive:id!==inactive})));
    for(const id of actors)tokens[id]=await sign({kind:'mobile',sub:id,email:phone.get(id),name:'Compatibility fixture',roles:[],permissions:[]},'30d');
    tokens.alias=await sign({kind:'mobile',sub:active,email:'',name:'Caller-selected device',roles:[],permissions:[]},'30d');
  });
  after(async()=>{if(db){try{const {inArray,eq}=await import('drizzle-orm');await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id,[...actors,...(issuedUser?[issuedUser]:[])]));await db.delete(schema.mobileDevices).where(eq(schema.mobileDevices.id,guest));}finally{await sqlClient.end({timeout:5});}}for(const [key,value] of [['NODE_ENV',original.node],['JWT_SECRET',original.jwt],['FITNESS_DATA_ENCRYPTION_KEY',original.key]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  it('accepts a genuine existing production phone-bound JWT without sid and returns JSON Fitness data',async()=>{
    const claims=await verify(tokens[active]);assert.equal(claims.sub,active);assert.equal(claims.email,phone.get(active));assert.equal('sid' in claims,false);
    assert.equal((await request('/auth/mobile/me','GET',tokens[active])).status,200);assert.equal((await request('/protected','GET',tokens[active])).status,200);
    for(const path of ['/v1/fitness/profile','/v1/fitness/summary']){const response=await request(path,'GET',tokens[active]);assert.equal(response.status,200,JSON.stringify(response.body));assert.match(response.headers.get('content-type')??'',/application\/json/);}
  });
  it('rejects a signed guest/device alias targeting a known real account and refuses new alias issuance',async()=>{
    for(const subject of [active,active.replace(/-/g,''),`{${active.toUpperCase()}}`,` ${active} `]){
      const alias=await sign({kind:'mobile',sub:subject,email:'',name:'Caller-selected device',roles:[],permissions:[]},'30d');
      await assert.rejects(()=>verify(alias));for(const path of ['/protected','/auth/mobile/me','/v1/fitness/profile'])assert.equal((await request(path,'GET',alias)).status,401);
      const issued=await request('/auth/mobile/token','POST',undefined,{deviceId:subject,displayName:'Impersonation attempt'});assert.equal(issued.status,410);assert.equal(issued.body.error.code,'otp_required');
    }
  });
  it('preserves unknown legacy device guests while denying their Fitness access',async()=>{
    const response=await request('/auth/mobile/token','POST',undefined,{deviceId:guest,displayName:'Legacy guest'});assert.equal(response.status,200);assert.equal((await verify(response.body.token)).sub,guest);assert.equal((await request('/protected','GET',response.body.token)).status,200);assert.equal((await request('/v1/fitness/profile','GET',response.body.token)).status,403);
  });
  it('globally denies a previously valid legacy phone token after successful account closure',async()=>{
    assert.equal((await request('/protected','GET',tokens[closing])).status,200);
    const closed=await request('/auth/mobile/account','DELETE',tokens[closing],{confirmAccountClosure:true});assert.equal(closed.status,200,JSON.stringify(closed.body));assert.equal(closed.body.accountClosed,true);
    await assert.rejects(()=>verify(tokens[closing]));for(const path of ['/protected','/auth/mobile/me','/v1/fitness/profile'])assert.equal((await request(path,'GET',tokens[closing])).status,401);
    assert.equal((await request('/protected','GET',tokens[inactive])).status,401);
  });
  it('retains the deployed OTP call shape and issues a genuine phone-bound no-sid session without session tables',async()=>{
    const sent=await request('/auth/mobile/otp/send','POST',undefined,{phone:otpPhone});assert.equal(sent.status,200);assert.deepEqual(sendCalls[0],[otpPhone]);
    const verified=await request('/auth/mobile/otp/verify','POST',undefined,{phone:otpPhone,code:'123456',requestId:otpRequestId});assert.equal(verified.status,200,JSON.stringify(verified.body));issuedUser=verified.body.user.id;assert.deepEqual(verifyCalls[0],[otpPhone,'123456',otpRequestId]);const claims=await verify(verified.body.token);assert.equal(claims.email,otpPhone);assert.equal('sid' in claims,false);assert.equal((await request('/v1/fitness/profile','GET',verified.body.token)).status,200);
    const {sql}=await import('drizzle-orm');const tables=await db.execute(sql`select to_regclass('public.mobile_auth_sessions') as sessions,to_regclass('public.otp_phone_states') as otp`);assert.equal(tables[0].sessions,null);assert.equal(tables[0].otp,null);
  });
  it('keeps HEAD profile and avatar endpoints available with legacy verified sessions',async()=>{
    const profile=await request('/auth/mobile/profile','PUT',tokens[active],{displayName:'Updated compatibility fixture',avatarUrl:null,bio:null,location:null,website:null});assert.equal(profile.status,200,JSON.stringify(profile.body));
    const avatar=await request('/auth/mobile/avatar','POST',tokens[active],{});assert.equal(avatar.status,400);assert.equal(avatar.body.error.code,'validation_error');
  });
});
