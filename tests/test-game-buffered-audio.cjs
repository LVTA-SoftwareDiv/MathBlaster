const fs=require('fs'),vm=require('vm');
let harness=fs.readFileSync('tests/test-controls.cjs','utf8').split('\nfunction key(')[0];
harness=harness.replace('window.__t={state,settings,keys,','window.__t={mixer,beginCollection,selectRecycler,showRecyclerDemo,state,settings,keys,');
harness=harness.replace("'cave-engine.js']","'cave-engine.js','effect-audio.js','sound-engine.js']");
harness=harness.replace('sandbox.window=sandbox;',`
const starts=[];sandbox.atob=s=>Buffer.from(s,'base64').toString('binary');
sandbox.AudioContext=class{
 constructor(){this.state='running';this.destination={};}
 get currentTime(){return clock/1000;}
 createBuffer(channels,length,rate){const data=new Float32Array(length);return{duration:length/rate,getChannelData:()=>data};}
 createGain(){return{gain:{value:1},connect(){},disconnect(){}};}
 createBufferSource(){const source={connect(){},disconnect(){},stop(){},start(){starts.push([clock,source.buffer.duration]);}};return source;}
 resume(){return Promise.resolve();}
};sandbox.window=sandbox;`);
harness+=`
assert.equal(ids.get('game').dataset.audioBackend,'buffered');
t.practice('zapper');step(3);t.activity.beams=5;t.beginCollection();t.activity.trash=[];
let count=starts.length;t.fireBeam(100,100);assert.equal(starts.length,count+1);assert.equal(t.mixer.active.id,8314,'miss cue starts through the production backend');
step(.16);const Z=sandbox.MBOriginal.Zapper,D=sandbox.MB_ORIGINAL_DATA;Z.init(t.activity,D.zapper);Z.spawn(t.activity,D.zapper,()=>.3);const trash=t.activity.trash.find(t=>t.alive);trash.x=100;trash.y=140;const bounds=Z.bounds(trash,D.zapper);count=starts.length;
t.fireBeam((bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2);assert.equal(starts.length,count+1);assert.equal(t.mixer.active.id,8315,'hit cue starts through the production backend');
t.practice('recycler');step(4);let a=t.activity;const seen=new Set();t.showRecyclerDemo();
for(let i=0;a.demo&&i<10000;i++){step(.04);if(t.mixer.active)seen.add(t.mixer.active.id);}
assert(!a.demo,'Recycler demonstration finishes with real sound durations, even without onended events');
for(const id of [8301,8302,8303,8304,8305,8317])assert(seen.has(id),'Recycler cue '+id+' actually started');
console.log('Production buffered playback: Zapper hits/misses and a complete Recycler demonstration passed, with real sample durations and delayed completion notifications.');
`;
vm.runInNewContext(harness,{require,console,process,Buffer,Float32Array});
