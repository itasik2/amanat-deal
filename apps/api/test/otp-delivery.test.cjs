const {test}=require('node:test');
const assert=require('node:assert/strict');
const {OtpDeliveryService}=require('../dist/modules/auth/otp-delivery.service');
test('production login queues sensitive OTP through scoped Notify API without debug echo',async()=>{
 const original=global.fetch,env={...process.env};
 try{
  process.env.NODE_ENV='production';process.env.OTP_DEBUG_CODE_ENABLED='true';
  process.env.NOTIFY_KZ_INTEGRATION_KEY='server-only-key';process.env.NOTIFY_KZ_API_URL='https://notify.example';
  delete process.env.OTP_DELIVERY_WEBHOOK_URL;
  let sent; global.fetch=async(url,init)=>{sent={url,init};return Response.json({id:'queued',status:'queued'});};
  const service=new OtpDeliveryService();service.ensureConfigured();
  const input={phone:'+77000000000',code:'123456',expiresAt:new Date(Date.now()+300000)};
  assert.deepEqual(await service.deliver(input),{mode:'notify'});
  assert.equal(sent.url,'https://notify.example/v1/integration-api/login-otp');
  assert.equal(sent.init.headers.authorization,'Bearer server-only-key');assert.equal(sent.init.redirect,'error');
  assert.equal(JSON.parse(sent.init.body).code,input.code);
  global.fetch=async()=>new Response('123456',{status:429});
  await assert.rejects(service.deliver(input),e=>!e.message.includes('123456'));
  delete process.env.NOTIFY_KZ_INTEGRATION_KEY;assert.throws(()=>service.ensureConfigured(),/транспорт OTP не настроен/);
 } finally {global.fetch=original;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
});
