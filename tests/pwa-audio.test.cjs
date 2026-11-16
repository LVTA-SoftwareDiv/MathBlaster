const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pwa/mobile-audio.js'),'utf8'),scope);
function harness(nav){
 const calls=[],media=[];
 class Media{
  constructor(src){this.src=src;media.push(this);}
  play(){calls.push('media.play');return Promise.resolve();}
  pause(){calls.push('media.pause');}
 }
 const audio=new scope.MBMobileAudio(nav,Media);
 const context={state:'suspended',sampleRate:48000,destination:{},
  createBuffer(channels,length,rate){assert.equal(length,1);assert.equal(rate,48000);return{};},
  createBufferSource(){return{connect(){},disconnect(){},start(){calls.push('source.start');}};}
 };
 audio.bank={context,unlock(){calls.push('context.resume');context.state='running';return Promise.resolve();}};
 return {audio,calls,context,media};
}
(async()=>{
 const nav={audioSession:{type:'auto'}},modern=harness(nav);
 assert.equal(nav.audioSession.type,'playback','select media category before creating game context');
 assert.equal(modern.media.length,0,'no permanent silent loop when the session API exists');
 const ready=modern.audio.unlock();
 assert.deepEqual(modern.calls,['context.resume','source.start'],'resume and pulse occur in the tap, before any await');await ready;
 nav.audioSession.type='auto';modern.context.state='interrupted';await modern.audio.unlock();
 assert.equal(nav.audioSession.type,'playback','restore route after interruption');
 const old=harness({});assert.equal(old.media[0].loop,true);assert.equal(old.media[0].src,'audio-unlock.wav');
 const legacyReady=old.audio.unlock();assert.deepEqual(old.calls,['media.play','context.resume','source.start']);await legacyReady;
 old.audio.pause();assert.equal(old.calls.at(-1),'media.pause','silent loop stops on background/rotation');
 await old.audio.unlock();assert.equal(old.calls.filter(x=>x==='media.play').length,2,'resume reactivates old Safari');
 const unsupported={};Object.defineProperty(unsupported,'type',{get(){return'auto';},set(){throw Error('unsupported');}});
 assert.equal(harness({audioSession:unsupported}).media.length,1,'fall back if session setter is unavailable');
 const failed=harness({audioSession:{type:'auto'}});failed.audio.bank.unlock=()=>Promise.resolve();
 await assert.rejects(failed.audio.unlock(),/Tap again/,'do not hide Resume while audio is still interrupted');
 console.log('Mobile audio: playback category, synchronous tap activation, legacy fallback, interruption recovery and pause passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
