'use strict';
(() => {
// Web Audio defaults to the ambient session on iOS, even when its context is
// running. Playback uses media volume, including when the ring switch is silent.
class MobileAudio {
 constructor(nav=navigator,Media=Audio){
  this.nav=nav;this.bank=null;this.media=null;
  if(!this.playbackSession()){
   // Older Safari has no Audio Session API. A silent media element selects the
   // playback route; the original samples still use the low-latency audio bank.
   this.media=new Media('audio-unlock.wav');this.media.preload='auto';
   this.media.loop=true;this.media.playsInline=true;
  }
 }
 playbackSession(){
  try{if(this.nav.audioSession){this.nav.audioSession.type='playback';return this.nav.audioSession.type==='playback';}}catch(error){}
  return false;
 }
 unlock(){
  this.playbackSession();
  const context=this.bank?.context;if(!context)return Promise.reject(Error('Audio is not ready.'));
  // All activation-sensitive calls happen synchronously in the Play/Resume tap.
  // Starting an actual source also unlocks Safari versions that resume a context
  // without unlocking its output. This silent pulse never changes game cues.
  const media=this.media?.play();
  const resumed=this.bank.unlock();
  const pulse=context.createBufferSource();pulse.buffer=context.createBuffer(1,1,context.sampleRate);
  pulse.connect(context.destination);pulse.onended=()=>pulse.disconnect();pulse.start();
  return Promise.all([media,resumed]).then(()=>{
   if(context.state!=='running')throw Error('Tap again to enable sound.');
  });
 }
 pause(){this.media?.pause();}
}
globalThis.MBMobileAudio=MobileAudio;
})();
