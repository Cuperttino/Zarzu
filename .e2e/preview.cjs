const { chromium } = require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root='dist-preview';const skel=`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${fs.readFileSync(root+'/zarzu.html','utf8')}</body></html>`;
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];if(u==='/'){r.setHeader('content-type','text/html');return r.end(skel)}const f=path.join(root,u);if(fs.existsSync(f)){r.setHeader('content-type','application/json');return r.end(fs.readFileSync(f))}r.statusCode=404;r.end()}).listen(4180,async()=>{
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await c.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
await p.goto('http://localhost:4180/');await p.getByRole('button',{name:'Empezar'}).click();await p.locator('blockquote').first().waitFor();await p.waitForTimeout(500);
console.log('verso',(await p.locator('blockquote').first().innerText()).slice(0,50));console.log('fuente',await p.evaluate(()=>document.fonts.check('700 16px Bricolage')));
await p.screenshot({path:'.e2e/shots/p1.png'});
for(const t of ['Biblia','Oración','Descubrir','Perfil']){await p.getByRole('link',{name:t,exact:true}).first().click();await p.waitForTimeout(350)}
await p.getByRole('link',{name:'Biblia',exact:true}).first().click();await p.getByRole('link',{name:/^Juan/}).first().click();await p.getByRole('link',{name:'3',exact:true}).click();await p.getByText(/amó tanto Dios/).waitFor();console.log('lector ok');await p.getByRole('button',{name:'Volver'}).click();await p.waitForTimeout(200);console.log('volver',await p.locator('h1').first().innerText());
await p.getByRole('link',{name:'Inicio',exact:true}).first().click();await p.getByRole('link',{name:'Evangelio de hoy'}).first().click();await p.waitForTimeout(300);await p.screenshot({path:'.e2e/shots/p2.png'});
console.log('errores',errs);await b.close();s.close()});
