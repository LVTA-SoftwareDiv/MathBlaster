'use strict';
const VERSION='__VERSION__',INDEX_HASH='__INDEX_HASH__',PREFIX='math-blaster-touch-',CACHE=PREFIX+VERSION;
const BASE=self.registration.scope,READY=new URL('__offline_ready__',BASE).href;
let progress=0;
const url=path=>new URL(path,BASE).href;
async function announce(message){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(message);}
async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function verified(path,digest){
 const response=await fetch(url(path),{cache:'no-store',credentials:'same-origin',redirect:'error'});
 if(!response.ok||response.type==='opaque')throw Error('Download failed: '+path);
 const bytes=await response.arrayBuffer();
 if(await hash(bytes)!==digest)throw Error('Download verification failed: '+path);
 return bytes;
}
async function install(){
 const cache=await caches.open(CACHE);
 if(await cache.match(READY))return;
 try{
  const bytes=await verified('offline-index.json',INDEX_HASH),index=JSON.parse(new TextDecoder().decode(bytes));
  const total=index.entries.length;let done=0;
  for(let i=0;i<index.packs.length;i++){
   const pack=index.packs[i],body=await verified(pack.path,pack.sha256);
   if(body.byteLength!==pack.size)throw Error('Incomplete download');
   const entries=index.entries.filter(e=>e.pack===i);
   for(let offset=0;offset<entries.length;offset+=24){
    await Promise.all(entries.slice(offset,offset+24).map(async entry=>{
     const target=url(entry.path);
     if(!target.startsWith(BASE)||entry.offset<0||entry.size<0||entry.offset+entry.size>body.byteLength)throw Error('Invalid offline file');
     await cache.put(target,new Response(body.slice(entry.offset,entry.offset+entry.size),{headers:{'Content-Type':entry.type,'Content-Length':String(entry.size)}}));
    }));
    done+=Math.min(24,entries.length-offset);progress=Math.round(done/total*100);
    await announce({type:'DOWNLOAD_PROGRESS',progress});
   }
  }
  // This marker is written last: incomplete installations cannot claim readiness.
  await cache.put(READY,new Response(VERSION));
  await announce({type:'DOWNLOAD_COMPLETE',version:VERSION});
 }catch(error){await caches.delete(CACHE);await announce({type:'DOWNLOAD_ERROR',message:error.message});throw error;}
}
self.addEventListener('install',event=>event.waitUntil(install()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 if(!await cache.match(READY))throw Error('Offline installation incomplete');
 await self.clients.claim();
 // Old caches survive failed downloads and are retired only after activation.
 await Promise.all((await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='APPLY_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='STATUS')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);event.ports[0]?.postMessage({ready:!!await cache.match(READY),version:VERSION,progress});
 })());
});
async function ranged(response,range){
 const bytes=await response.arrayBuffer(),size=bytes.byteLength,match=/^bytes=(\d*)-(\d*)$/.exec(range);
 let start,end;
 if(match&&(match[1]||match[2])){
  if(!match[1]){start=Math.max(0,size-Number(match[2]));end=size-1;}
  else{start=Number(match[1]);end=match[2]?Math.min(size-1,Number(match[2])):size-1;}
 }
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
 return new Response(bytes.slice(start,end+1),{status:206,headers});
}
async function serve(request){
 const target=new URL(request.url),cache=await caches.open(CACHE);
 let path=target.href;target.search='';
 if(request.mode==='navigate'&&(target.href===BASE||target.href===url('index.html')))path=url('index.html');
 const hit=await cache.match(path);
 if(hit)return request.headers.has('Range')?ranged(hit,request.headers.get('Range')):hit;
 return fetch(request);
}
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET'&&event.request.url.startsWith(BASE))event.respondWith(serve(event.request));
});
