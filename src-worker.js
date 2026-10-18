const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
const required=(s,max=120)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const email=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const allowedOrigins=(request,env)=>{const o=request.headers.get('origin');const u=new URL(request.url);return !o||o===u.origin||(env.SITE_ORIGIN&&o===env.SITE_ORIGIN)};
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/')){
if(request.method!=='POST'||!['/api/preorders','/api/bookings'].includes(url.pathname))return json({error:'Not found'},404);
if(!allowedOrigins(request,env))return json({error:'Invalid request origin'},403);
if(Number(request.headers.get('content-length')||0)>12000)return json({error:'Request too large'},413);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
if(!env.DB)return json({error:'Booking service is not configured'},503);
let d;try{d=await request.json()}catch{return json({error:'Invalid JSON'},400)}
if(!required(d.name)||!email(d.email))return json({error:'Enter a valid name and email'},400);
const id=crypto.randomUUID();const ref=(url.pathname==='/api/preorders'?'GN-BOOK-':'GN-CONS-')+id.slice(0,8).toUpperCase();
try{if(url.pathname==='/api/preorders'){
const quantity=Number(d.quantity);if(!required(d.country,80)||!Number.isInteger(quantity)||quantity<1||quantity>100||String(d.notes||'').length>1500)return json({error:'Please check country, quantity and notes'},400);
await env.DB.prepare('INSERT INTO preorders (id,reference,name,email,country,quantity,notes) VALUES (?,?,?,?,?,?,?)').bind(id,ref,d.name.trim(),d.email.trim(),d.country.trim(),quantity,String(d.notes||'')).run();
}else{
if(!required(d.service)||!required(d.preferred_date,10)||!/\d{4}-\d{2}-\d{2}/.test(d.preferred_date)||!required(d.timezone,80)||!required(d.notes,3000))return json({error:'Please complete all booking details'},400);
await env.DB.prepare('INSERT INTO bookings (id,reference,name,email,service,meeting_format,preferred_date,timezone,notes) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,ref,d.name.trim(),d.email.trim(),d.service,String(d.meeting_format||'Online'),d.preferred_date,d.timezone,d.notes).run();}
return json({ok:true,reference:ref},201)}catch{return json({error:'Could not save the request. Please try again.'},500)}
}
return env.ASSETS.fetch(request)} };
