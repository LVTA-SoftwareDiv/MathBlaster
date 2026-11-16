const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=process.env.PWA_DIST||path.join(root,'dist');
const {TouchHolds}=require('../pwa/touch-input.js');
const calls=[],holds=new TouchHolds((...v)=>calls.push(v));
holds.press(1,'ArrowLeft');holds.press(2,' ');holds.release(1);
assert.deepEqual(calls,[['ArrowLeft',true],[' ',true],['ArrowLeft',false]]);
holds.press(3,' ');holds.release(2);assert.equal(calls.length,3);holds.release(3);assert.deepEqual(calls.at(-1),[' ',false]);
holds.press(4,'ArrowRight');holds.press(5,' ');holds.clear();assert.equal(holds.pointers.size,0);assert.deepEqual(calls.slice(-2),[['ArrowRight',false],[' ',false]]);
console.log('Touch: independent fingers, duplicate holds, release/cancel and focus-loss cleanup passed.');

class Store{
 constructor(){this.data=new Map();}
 async match(key){return this.data.get(typeof key==='string'?key:key.url)?.clone();}
 async put(key,value){this.data.set(typeof key==='string'?key:key.url,value.clone());}
}
const base='https://example.test/game/',stores=new Map(),messages=[],listeners={},net=[];
let failPack=false,offline=false,skipCount=0;
const caches={async open(name){if(!stores.has(name))stores.set(name,new Store());return stores.get(name);},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
const context={URL,Headers,Response,Request,TextDecoder,Uint8Array,Map,Set,Promise,Error,Number,JSON,Math,crypto:webcrypto,caches,
 self:{registration:{scope:base},clients:{matchAll:async()=>[{postMessage:m=>messages.push(m)}],claim:async()=>{}},skipWaiting:async()=>skipCount++,addEventListener:(name,fn)=>listeners[name]=fn},
 fetch:async input=>{const target=typeof input==='string'?input:input.url;net.push(target);if(offline)throw Error('offline');const file=target.slice(base.length);if(failPack&&file.endsWith('.pack'))return new Response('corrupt');return new Response(fs.readFileSync(path.join(dist,file)));}
};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(dist,'sw.js'),'utf8'),context,{filename:'sw.js'});
const run=code=>vm.runInContext(code,context);
(async()=>{
 const previous=new Store();previous.data.set(base+'index.html',new Response('previous working version'));stores.set('math-blaster-touch-old',previous);
 failPack=true;await assert.rejects(run('install()'),/verification/);
 assert(stores.has('math-blaster-touch-old'),'failed updates retain working game');assert.equal(stores.size,1,'failed new cache removed');
 failPack=false;await run('install()');assert.equal(skipCount,0,'updates wait for explicit consent');
 const index=JSON.parse(fs.readFileSync(path.join(dist,'offline-index.json'))),cache=stores.get(run('CACHE'));
 assert.equal(cache.data.size,index.entries.length+1,'all files and ready marker installed');
 for(const entry of index.entries){const actual=Buffer.from(await (await cache.match(base+entry.path)).arrayBuffer());assert.deepEqual(actual,fs.readFileSync(path.join(dist,entry.path)),entry.path);}
 console.log(`Offline: ${index.entries.length} cached files match source bytes; corrupt/interrupted update preserves old version.`);
 offline=true;net.length=0;
 const nav={url:base,mode:'navigate',headers:new Headers()};context.testRequest=nav;
 assert.match(await (await run('serve(testRequest)')).text(),/Math Blaster/);assert.equal(net.length,0,'offline start uses cache');
 const audio=index.entries.find(e=>e.path.endsWith('.wav'));
 for(const [range,start,end] of [['bytes=10-19',10,19],['bytes=-10',audio.size-10,audio.size-1],['bytes=20-',20,audio.size-1]]){
  context.testRequest={url:base+audio.path,headers:new Headers({Range:range})};const response=await run('serve(testRequest)');assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),`bytes ${start}-${end}/${audio.size}`);assert.equal((await response.arrayBuffer()).byteLength,end-start+1);
 }
 context.testRequest={url:base+audio.path,headers:new Headers({Range:'bytes=999999999-'})};assert.equal((await run('serve(testRequest)')).status,416);
 let intercepted=false;listeners.fetch({request:{url:'https://other.test/private',method:'GET'},respondWith(){intercepted=true;}});assert(!intercepted);
 listeners.fetch({request:{url:base+'save',method:'POST'},respondWith(){intercepted=true;}});assert(!intercepted);
 await new Promise((resolve,reject)=>listeners.activate({waitUntil:p=>p.then(resolve,reject)}));assert(!stores.has('math-blaster-touch-old'));
 await new Promise((resolve,reject)=>listeners.message({data:{type:'APPLY_UPDATE'},waitUntil:p=>p.then(resolve,reject)}));assert.equal(skipCount,1);
 console.log('Offline navigation, WAV byte ranges, scope isolation, atomic activation and explicit update passed.');
 const manifest=JSON.parse(fs.readFileSync(path.join(dist,'manifest.webmanifest')));assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'landscape');assert.equal(manifest.scope,'./');for(const icon of manifest.icons)assert(fs.existsSync(path.join(dist,icon.src)));
 console.log('Manifest and Home Screen icons passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
