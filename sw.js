const OFFLINE_VERSION='4w1f-offline-2026-10-28';
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/sw.js'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch('./index.html',{cache:'no-store'}).catch(()=>new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#050507;color:white;font:16px system-ui;text-align:center}b{color:#a94cff}</style><div><h2>4 Wheels <b>1 Family</b></h2><p>Die App ist derzeit offline.</p></div>',
      {headers:{'content-type':'text/html; charset=utf-8'}}
    )));
    return;
  }
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>new Response('',{status:503,statusText:'4W1F offline'})));
});
