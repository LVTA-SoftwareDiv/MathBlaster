const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
global.window=global;
for(const file of ['effect-audio.js','sound-engine.js','original-data.js','original-engine.js'])vm.runInThisContext(fs.readFileSync('game/'+file,'utf8'));
class Context{
 constructor(){this.currentTime=0;this.state='running';this.destination={};this.sources=[];}
 createBuffer(channels,length,rate){const data=new Float32Array(length);return {duration:length/rate,length,sampleRate:rate,getChannelData:()=>data};}
 createGain(){return{gain:{value:1},connect(){},disconnect(){}};}
 createBufferSource(){const source={connect(){},disconnect(){},start:(when,offset)=>{source.startTime=this.currentTime;source.offset=offset;},stop:()=>{source.stopped=true;}};this.sources.push(source);return source;}
 resume(){return this.resumePromise||Promise.resolve().then(()=>this.state='running');}
}
(async()=>{
 const bank=new MBSound.SampleBank(MB_EFFECT_AUDIO,Context),context=bank.context;
 assert.equal(bank.buffers.size,86);
 for(const [id,sample]of Object.entries(MB_EFFECT_AUDIO)){
  const original=fs.readFileSync(`game/assets/MB4_${id}.wav`);let offset=12,data,rate;
  while(offset<original.length){const type=original.toString('ascii',offset,offset+4),size=original.readUInt32LE(offset+4);if(type==='data')data=original.subarray(offset+8,offset+8+size);if(type==='fmt ')rate=original.readUInt32LE(offset+12);offset+=8+size+(size&1);}
  const buffer=bank.buffers.get(Number(id));assert.equal(buffer.sampleRate,rate);assert.equal(buffer.length,data.length);
  for(let i=0;i<data.length;i++)assert.equal(buffer.getChannelData(0)[i],(data[i]-128)/128);
 }
 console.log('All 86 prepared buffers match every sample and sample rate in the original WAV files.');
 const events=[],mixer=new MBOriginal.SoundArbiter(MB_ORIGINAL_DATA.soundPriority,MB_ORIGINAL_DATA.soundLoops,item=>{
  const a=bank.voice(item.id);item.audio=a;a.loop=item.loop;a.onplaying=()=>events.push([item.id,context.currentTime]);a.onended=()=>mixer.finish(item);a.play();return a;
 },item=>item.audio.pause());
 for(let i=0;i<200;i++){
  for(const id of [8307,8301,8302,8317,8303,8304,8305,8306,8314,8315,8317]){
   // Deliberately withhold onended: the event queue can lag the sound clock.
   context.currentTime+=6;const before=events.length;mixer.play(id);
   assert.equal(events.length,before+1,`cue ${id} plays even if previous ended notification is late`);
   assert.equal(events.at(-1)[1],context.currentTime);
  }
 }
 assert.equal(events.length,2200);console.log('2,200 Recycler/Zapper cues start immediately, including delayed completion events.');
 mixer.clear();mixer.play(8306);const before=events.length;mixer.play(8301);assert.equal(events.length,before,'original priority still protects an active zap');
 const a=bank.voice(8304);a.play();context.currentTime+=.25;a.pause();assert.equal(a.currentTime,.25);context.currentTime+=1;await a.play();assert.equal(context.sources.at(-1).offset,.25);assert(!context.sources.at(-1).stopped);a.pause();
 const pending=bank.voice(8315);let resolve;context.state='suspended';context.resumePromise=new Promise(r=>resolve=r);const n=context.sources.length,promise=pending.play();pending.pause();context.state='running';resolve();await promise;assert.equal(context.sources.length,n,'cancelled sound never starts after delayed context resume');
 const loop=bank.voice(8236);loop.loop=true;loop.play();context.currentTime+=loop.duration*3+.1;assert(!loop.ended);assert(Math.abs(loop.currentTime-.1)<1e-9);loop.pause();
 console.log('Priority, pause/resume, looping and cancellation during delayed audio startup passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
