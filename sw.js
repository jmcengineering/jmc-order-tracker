// JMC Order Tracker — service worker
// 1. Receives PDFs shared from Android (Web Share Target, POST ./share-target),
//    stores them in IndexedDB, and 303-redirects to the app's shared-PDF screen.
//    GitHub Pages cannot accept a POST, so this worker is the only handler.
// 2. Caches the app shell + pinned CDN libraries so the app opens offline and
//    a shared file is never lost. Microsoft login, Graph and Claude API calls are
//    NEVER cached or intercepted.
importScripts('./share-queue.js');

const VERSION='v3.2';
const SHELL_CACHE='jmc-shell-'+VERSION;
const CDN_CACHE='jmc-cdn-'+VERSION;
const SHELL=[
  './jmc_order_tracker.html','./manifest.webmanifest','./share-queue.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png','./icons/favicon-48.png'
];
// Version-pinned libraries the page loads. Cache-first is safe because the URLs are immutable.
const CDN_HOSTS=['cdnjs.cloudflare.com','alcdn.msauth.net','fonts.googleapis.com','fonts.gstatic.com'];

const APP_URL=new URL('./jmc_order_tracker.html',self.registration.scope).href;
const SHARE_URL=new URL('./share-target',self.registration.scope).href;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keep=new Set([SHELL_CACHE,CDN_CACHE]);
    for(const k of await caches.keys())if(k.startsWith('jmc-')&&!keep.has(k))await caches.delete(k);
    await self.clients.claim();
  })());
});

async function handleShare(request){
  let accepted=0,rejected=0;
  try{
    const form=await request.formData();
    const files=form.getAll('pdf').filter(f=>f&&typeof f==='object'&&'size' in f);
    for(const f of files){
      const rec=await self.JMCShareQueue.add(f);
      if(rec.status==='pending')accepted++;else rejected++;
    }
    if(!files.length)return Response.redirect(APP_URL+'?share=nofile',303);
  }catch(err){
    console.error('[sw] share-target failed',err);
    return Response.redirect(APP_URL+'?share=error',303);
  }
  // Tell any open window right away (if the app is already open it can start importing).
  const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  wins.forEach(w=>w.postMessage({type:'jmc-share-queued',accepted,rejected}));
  return Response.redirect(APP_URL+'?share=1',303);
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  const url=new URL(req.url);

  // ── Web Share Target ──
  if(url.href.split('?')[0]===SHARE_URL){
    if(req.method==='POST'){e.respondWith(handleShare(req));return;}
    e.respondWith(Response.redirect(APP_URL+'?share=1',303));return;
  }
  if(req.method!=='GET')return;

  // ── App shell: network first (always get the latest version), cache fallback offline ──
  if(url.origin===self.location.origin){
    e.respondWith((async()=>{
      try{
        const net=await fetch(req);
        if(net&&net.ok){const c=await caches.open(SHELL_CACHE);c.put(req.url.split('?')[0]===APP_URL?APP_URL:req,net.clone());}
        return net;
      }catch(err){
        const hit=await caches.match(req,{ignoreSearch:true})||(req.mode==='navigate'?await caches.match(APP_URL):null);
        if(hit)return hit;
        throw err;
      }
    })());
    return;
  }

  // ── Pinned CDN libraries: cache first ──
  if(CDN_HOSTS.includes(url.hostname)){
    e.respondWith((async()=>{
      const hit=await caches.match(req);
      if(hit)return hit;
      const net=await fetch(req);
      if(net&&(net.ok||net.type==='opaque')){const c=await caches.open(CDN_CACHE);c.put(req,net.clone());}
      return net;
    })());
  }
  // Everything else (login.microsoftonline.com, graph.microsoft.com, api.anthropic.com,
  // OneDrive download URLs) goes straight to the network untouched.
});
