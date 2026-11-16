'use strict';
(() => {
// Samples are included as local script data so file:// playback needs no fetch,
// media seek, asynchronous decoder, or disk access at the animation cue.
class SampleBank {
 constructor(samples,Context=globalThis.AudioContext||globalThis.webkitAudioContext){
  this.buffers=new Map();this.context=null;
  if(!samples||!Context)return;
  try{
   this.context=new Context({latencyHint:'interactive'});
   for(const [id,sample] of Object.entries(samples)){
    const pcm=atob(sample.pcm),buffer=this.context.createBuffer(1,pcm.length,sample.rate),channel=buffer.getChannelData(0);
    for(let i=0;i<pcm.length;i++)channel[i]=(pcm.charCodeAt(i)-128)/128;
    this.buffers.set(Number(id),buffer);
   }
  }catch(error){this.context?.close();this.context=null;this.buffers.clear();}
 }
 unlock(){return this.context&&this.context.state!=='running'?this.context.resume():Promise.resolve();}
 voice(id){const buffer=this.buffers.get(id);return buffer?new SampleVoice(this,buffer):null;}
}
class SampleVoice {
 constructor(bank,buffer){
  this.bank=bank;this.buffer=buffer;this.duration=buffer.duration;this.loop=false;this.volume=1;
  this.paused=true;this.offset=0;this.source=null;this.gain=null;this.generation=0;
 }
 get currentTime(){
  const elapsed=this.source?Math.max(0,this.bank.context.currentTime-this.startedAt):0;
  return this.loop?(this.offset+elapsed)%this.duration:Math.min(this.duration,this.offset+elapsed);
 }
 set currentTime(value){const playing=!this.paused;this.pause();this.offset=Math.max(0,Math.min(this.duration,value));if(playing)this.play().catch(()=>{});}
 get ended(){return !this.loop&&this.currentTime>=this.duration;}
 play(){
  if(!this.paused)return Promise.resolve();
  this.paused=false;const generation=++this.generation,context=this.bank.context;
  const start=()=>{
   // A stopped or superseded cue must never start after a delayed resume.
   if(this.paused||generation!==this.generation)return;
   if(this.offset>=this.duration)this.offset=0;
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=this.buffer;source.loop=this.loop;gain.gain.value=this.volume;
   source.connect(gain);gain.connect(context.destination);
   this.source=source;this.gain=gain;this.startedAt=context.currentTime;
   source.onended=()=>{
    if(this.source!==source||generation!==this.generation)return;
    this.source=null;this.gain=null;this.offset=this.duration;this.paused=true;
    source.disconnect();gain.disconnect();this.onended?.();
   };
   source.start(0,this.offset);this.onplaying?.();
  };
  if(context.state==='running'){start();return Promise.resolve();}
  return this.bank.unlock().then(start);
 }
 pause(){
  this.offset=this.currentTime;this.paused=true;this.generation++;
  if(this.source){const source=this.source;this.source=null;source.onended=null;source.stop();source.disconnect();}
  this.gain?.disconnect();this.gain=null;
 }
}
globalThis.MBSound={SampleBank};
})();
