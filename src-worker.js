const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const required=(s,max=120)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const email=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const enc=new TextEncoder();
const bytes=s=>Uint8Array.from(s.match(/.{2}/g).map(x=>parseInt(x,16)));
const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0};
const b64=s=>btoa(String.fromCharCode(...enc.encode(s))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const ub64=s=>{try{return atob(s.replaceAll('-','+').replaceAll('_','/'))}catch{return ''}};
async function hmac(secret,value){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(value)))}
async function authenticated(request,env){if(!env.ADMIN_SESSION_SECRET)return false;const c=(request.headers.get('cookie')||'').match(/(?:^|;\s*)gn_session=([^;]+)/);if(!c)return false;const [payload,sig]=c[1].split('.');if(!payload||!sig||!/^[a-f0-9]{64}$/.test(sig))return false;const expect=await hmac(env.ADMIN_SESSION_SECRET,payload);if(!same(enc.encode(sig),enc.encode(expect)))return false;try{const data=JSON.parse(ub64(payload));return data.role==='owner'&&Number.isFinite(data.exp)&&data.exp>Date.now()&&data.exp<Date.now()+86400000}catch{return false}}
function originOk(request){const o=request.headers.get('origin');return !o||o===new URL(request.url).origin}
async function body(request){if(Number(request.headers.get('content-length')||0)>16000)throw Error('too large');if(!request.headers.get('content-type')?.includes('application/json'))throw Error('JSON required');return request.json()}
const csrf=(r)=>originOk(r)&&r.headers.get('content-type')?.includes('application/json');
const statuses={preorders:['new','contacted','confirmed','fulfilled','cancelled'],bookings:['new','contacted','scheduled','completed','cancelled']};
async function adminApi(request,env,path){
 if(path==='/api/admin/login'&&request.method==='POST'){
  if(!csrf(request))return json({error:'Invalid request'},403);
  if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_SESSION_SECRET)return json({error:'Owner login is not configured'},503);
  let d;try{d=await body(request)}catch{return json({error:'Invalid request'},400)}
  if(typeof d.password!=='string'||d.password.length>256)return json({error:'Invalid credentials'},401);
  const parts=env.ADMIN_PASSWORD_HASH.split(':');if(parts.length!==3||parts[0]!=='pbkdf2')return json({error:'Owner login is misconfigured'},503);
  const salt=bytes(parts[1]);const expected=bytes(parts[2]);const key=await crypto.subtle.importKey('raw',enc.encode(d.password),'PBKDF2',false,['deriveBits']);
  const derived=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256));
  if(!same(expected,derived))return json({error:'Invalid credentials'},401);
  const payload=b64(JSON.stringify({role:'owner',exp:Date.now()+12*3600000,nonce:crypto.randomUUID()}));const sig=await hmac(env.ADMIN_SESSION_SECRET,payload);
  const r=json({ok:true});r.headers.append('set-cookie',`gn_session=${payload}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);return r;
 }
 if(path==='/api/admin/logout'&&request.method==='POST'){
  if(!csrf(request))return json({error:'Invalid origin'},403);const r=json({ok:true});r.headers.set('set-cookie','gn_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');return r;
 }
 if(!await authenticated(request,env))return json({error:'Authentication required'},401);
 if(!env.DB)return json({error:'Database not configured'},503);
 if(path==='/api/admin/me'&&request.method==='GET')return json({ok:true,role:'owner'});
 if(path==='/api/admin/summary'&&request.method==='GET'){
  const [orders,appointments,books]=await Promise.all([env.DB.prepare('SELECT COUNT(*) n,COALESCE(SUM(quantity),0) copies FROM preorders').first(),env.DB.prepare('SELECT COUNT(*) n FROM bookings').first(),env.DB.prepare('SELECT COUNT(*) n FROM books').first()]);return json({orders:orders.n,copies:orders.copies,appointments:appointments.n,books:books.n,confirmedRevenue:null,paymentsEnabled:false});
 }
 const list=path.match(/^\/api\/admin\/(preorders|bookings|books)$/);
 if(list&&request.method==='GET'){const table=list[1];const q=table==='books'?'SELECT * FROM books ORDER BY updated_at DESC LIMIT 250':`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 250`;return json({items:(await env.DB.prepare(q).all()).results||[]})}
 if(path==='/api/admin/books'&&request.method==='POST'){
  if(!csrf(request))return json({error:'Invalid origin'},403);let d;try{d=await body(request)}catch{return json({error:'Invalid JSON'},400)}
  if(!required(d.title,180)||!required(d.author,160)||!['draft','preorder','published'].includes(d.status)||String(d.description||'').length>3000||String(d.cover_url||'').length>500)return json({error:'Invalid book information'},400);
  const price=d.price_zmw===''||d.price_zmw==null?null:Number(d.price_zmw);if(price!==null&&(!Number.isInteger(price)||price<0||price>100000000))return json({error:'Price must be in ngwee (integer)'},400);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO books(id,title,author,description,cover_url,price_zmw,status) VALUES(?,?,?,?,?,?,?)').bind(id,d.title.trim(),d.author.trim(),String(d.description||''),String(d.cover_url||''),price,d.status).run();return json({ok:true,id},201);
 }
 const book=path.match(/^\/api\/admin\/books\/([\w-]{36})$/);
 if(book&&request.method==='PATCH'){
  if(!csrf(request))return json({error:'Invalid origin'},403);let d;try{d=await body(request)}catch{return json({error:'Invalid JSON'},400)};
  if(!required(d.title,180)||!required(d.author,160)||!['draft','preorder','published'].includes(d.status)||String(d.description||'').length>3000||String(d.cover_url||'').length>500)return json({error:'Invalid book'},400);
  const price=d.price_zmw===''||d.price_zmw==null?null:Number(d.price_zmw);if(price!==null&&(!Number.isInteger(price)||price<0||price>100000000))return json({error:'Invalid price'},400);
  await env.DB.prepare('UPDATE books SET title=?,author=?,description=?,cover_url=?,price_zmw=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(d.title.trim(),d.author.trim(),String(d.description||''),String(d.cover_url||''),price,d.status,book[1]).run();return json({ok:true});
 }
 const status=path.match(/^\/api\/admin\/(preorders|bookings)\/([\w-]{36})\/status$/);
 if(status&&request.method==='PATCH'){
  if(!csrf(request))return json({error:'Invalid origin'},403);let d;try{d=await body(request)}catch{return json({error:'Invalid JSON'},400)};if(!statuses[status[1]].includes(d.status))return json({error:'Invalid status'},400);
  await env.DB.prepare(`UPDATE ${status[1]} SET status=? WHERE id=?`).bind(d.status,status[2]).run();return json({ok:true});
 }
 return json({error:'Not found'},404);
}
async function publicApi(request,env,path){
 if(request.method!=='POST'||!['/api/preorders','/api/bookings'].includes(path))return json({error:'Not found'},404);
 if(!originOk(request))return json({error:'Invalid origin'},403);
 if(!env.DB)return json({error:'Booking service not configured'},503);
 let d;try{d=await body(request)}catch{return json({error:'Invalid JSON'},400)};
 if(!required(d.name)||!email(d.email))return json({error:'Enter valid name and email'},400);
 const id=crypto.randomUUID(),ref=(path==='/api/preorders'?'GN-BOOK-':'GN-CONS-')+id.slice(0,8).toUpperCase();
 try{if(path==='/api/preorders'){
  const quantity=Number(d.quantity);if(!required(d.country,80)||!Number.isInteger(quantity)||quantity<1||quantity>100||String(d.notes||'').length>1500)return json({error:'Check request details'},400);
  await env.DB.prepare('INSERT INTO preorders(id,reference,name,email,country,quantity,notes) VALUES(?,?,?,?,?,?,?)').bind(id,ref,d.name.trim(),d.email.trim(),d.country.trim(),quantity,String(d.notes||'')).run();
 }else{
  if(!required(d.service)||!required(d.preferred_date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(d.preferred_date)||!required(d.timezone,80)||!required(d.notes,3000))return json({error:'Complete booking details'},400);
  await env.DB.prepare('INSERT INTO bookings(id,reference,name,email,service,meeting_format,preferred_date,timezone,notes) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,ref,d.name.trim(),d.email.trim(),d.service,String(d.meeting_format||'Online'),d.preferred_date,d.timezone,d.notes).run();
 }return json({ok:true,reference:ref},201)}catch{return json({error:'Could not save request'},500)}
}
export default {async fetch(request,env){
 const u=new URL(request.url),p=u.pathname;
 try{
  if(p.startsWith('/api/admin/'))return await adminApi(request,env,p);
  if(p.startsWith('/api/'))return await publicApi(request,env,p);
  if(p==='/admin'||p==='/admin/'){
   const asset=new URL('/admin.html',u);const response=await env.ASSETS.fetch(new Request(asset,request));const h=new Headers(response.headers);h.set('cache-control','no-store');h.set('x-frame-options','DENY');h.set('content-security-policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");return new Response(response.body,{status:response.status,headers:h});
  }
  return env.ASSETS.fetch(request);
 }catch(e){return json({error:'Service temporarily unavailable'},500)}
}};
