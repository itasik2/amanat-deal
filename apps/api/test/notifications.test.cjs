const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NotificationsService}=require('../dist/modules/notifications/notifications.service');
const original=global.fetch;
test('journal replay uses stable event identities and cursor moves only after both recipients succeed',async()=>{
 process.env.NOTIFY_KZ_INTEGRATION_KEY='test-scoped-key';
 const row={id:'event-1',dealId:'d',eventType:'mock_escrow.funds_secured',createdAt:new Date('2026-01-02'),deal:{sellerId:'s',buyerId:'b'}};
 const service=new NotificationsService({dealEvent:{findMany:async()=>[row]}});
 let fail=true;const calls=[];
 global.fetch=async(url,init)=>{
  const body=init.body?JSON.parse(init.body):null;calls.push({url,body});
  if(url.endsWith('/cursor')&&!body)return Response.json({at:'2026-01-01T00:00:00.000Z',id:'',since:'2026-01-01T00:00:00.000Z'});
  if(url.endsWith('/events')&&body.externalId==='b'&&fail)return new Response('',{status:503});
  return Response.json({ok:true});
 };
 try{
  await assert.rejects(service.dispatch());
  assert.equal(calls.filter(c=>c.url.endsWith('/cursor')&&c.body).length,0);
  fail=false;await service.dispatch();
  const sends=calls.filter(c=>c.url.endsWith('/events'));
  assert.equal(new Set(sends.map(c=>c.body.eventId)).size,1);
  assert.ok(sends.every(c=>c.body.text.includes('Реальные деньги не списывались')));
  assert.equal(calls.filter(c=>c.url.endsWith('/cursor')&&c.body).length,1);
 }finally{global.fetch=original;delete process.env.NOTIFY_KZ_INTEGRATION_KEY;}
});
test('connection identity comes from authenticated user and only a verified account phone is forwarded',async()=>{
 process.env.NOTIFY_KZ_INTEGRATION_KEY='test-scoped-key';
 let sent;global.fetch=async(url,init)=>{sent=JSON.parse(init.body);return Response.json({url:'https://notify.example/connect#token'});};
 try{const service=new NotificationsService({});await service.connect({id:'account-user',phone:null,email:'unverified@example.com',name:null});assert.deepEqual(sent,{externalId:'account-user'});}
 finally{global.fetch=original;delete process.env.NOTIFY_KZ_INTEGRATION_KEY;}
});
