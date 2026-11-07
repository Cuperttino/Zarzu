// Simula GoTrue y PostgREST (subconjunto) solo para las pruebas E2E, incluida la clave única de verse_history.
const http=require('http');const users={},tok={};const T={verse_history:[],favorites:[],activity_log:[],conversations:[],messages:[],profiles:[],push_subscriptions:[],verified_schedules:[],content_items:[],app_admins:[]};
const pk={verse_history:r=>r.user_id+r.shown_on,favorites:r=>r.user_id+r.kind+r.item_id,activity_log:r=>r.user_id+r.kind+r.ref+r.day,conversations:r=>r.id,messages:r=>r.id,profiles:r=>r.id,verified_schedules:r=>r.osm_ref+r.kind,content_items:r=>r.id||Math.random(),push_subscriptions:r=>r.endpoint};
http.createServer((q,s)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{
 const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
 if(q.method==='OPTIONS'){s.writeHead(204,H);return s.end()}
 const u=new URL(q.url,'http://x');const J=b?JSON.parse(b):null;const send=(c,o)=>{s.writeHead(c,H);s.end(o===undefined?'':JSON.stringify(o))};
 const who=()=>tok[(q.headers.authorization||'').replace('Bearer ','')];
 if(u.pathname==='/__dump')return send(200,T);
 if(u.pathname==='/auth/v1/signup'){if(users[J.email])return send(422,{msg:'User already registered'});const id=crypto.randomUUID();users[J.email]={id,password:J.password,email:J.email};T.profiles.push({id,display_name:J.data?.display_name||''});const t='t'+id;tok[t]=id;return send(200,{access_token:t,refresh_token:'r'+id,expires_in:3600,user:{id,email:J.email}})}
 if(u.pathname==='/auth/v1/token'){const x=users[J.email];if(!x||x.password!==J.password)return send(400,{error_code:'invalid_credentials',msg:'Invalid login credentials'});const t='t'+x.id+Math.random();tok[t]=x.id;return send(200,{access_token:t,refresh_token:'r',expires_in:3600,user:{id:x.id,email:x.email}})}
 if(u.pathname==='/auth/v1/logout')return send(204);
 if(u.pathname==='/auth/v1/recover')return send(200,{});
 const m=u.pathname.match(/^\/rest\/v1\/(\w+)/);if(!m)return send(404,{});const tb=m[1],uid=who();if(!(tb in T))return send(404,{});
 const pub=tb==='verified_schedules'||tb==='content_items';
 const own=r=>pub||(tb==='profiles'?r.id===uid:r.user_id===uid);
 const flt=[...u.searchParams].filter(([k])=>!['select','order','limit','on_conflict'].includes(k));
 const match=r=>own(r)&&flt.every(([k,v])=>{if(v.startsWith('eq.'))return String(r[k])===decodeURIComponent(v.slice(3));if(v==='is.true')return r[k]===true;return true});
 if(q.method==='GET'){let rows=T[tb].filter(match);return send(200,rows)}
 if(q.method==='DELETE'){T[tb]=T[tb].filter(r=>!match(r));return send(204)}
 if(q.method==='POST'){const pr=q.headers.prefer||'';for(const r of [].concat(J)){if(!pub&&(tb==='profiles'?r.id:r.user_id)!==uid)return send(403,{message:'RLS'});const k=pk[tb](r);const i=T[tb].findIndex(x=>pk[tb](x)===k);if(i>=0){if(pr.includes('merge'))T[tb][i]={...T[tb][i],...r};else if(!pr.includes('ignore'))return send(409,{})}else T[tb].push(r)}return send(201)}
 send(405,{})})}).listen(54399,()=>console.log('mock on'));
