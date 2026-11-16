const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
let harness=fs.readFileSync('tests/test-controls.cjs','utf8').split('\nfunction key(')[0];
harness=harness.replace("const root='game/'",'const root='+JSON.stringify((process.env.PWA_DIST||path.resolve('dist'))+'/'));
harness=harness.replace("'cave-engine.js']","'cave-engine.js','effect-audio.js','sound-engine.js']");
harness=harness.replace('sandbox.window=sandbox;',`
const starts=[];sandbox.atob=s=>Buffer.from(s,'base64').toString('binary');
sandbox.AudioContext=class{
 constructor(){this.state='running';this.destination={};}
 get currentTime(){return clock/1000;}
 createBuffer(channels,length,rate){const data=new Float32Array(length);return{duration:length/rate,getChannelData:()=>data};}
 createGain(){return{gain:{value:1},connect(){},disconnect(){}};}
 createBufferSource(){const s={connect(){},disconnect(){},stop(){},start(){starts.push(s.buffer);}};return s;}
 resume(){return Promise.resolve();}
};sandbox.window=sandbox;`);
harness=harness.replace('let source=fs.readFileSync',`
sandbox.MBMobileAudioBank=new sandbox.MBSound.SampleBank(sandbox.MB_EFFECT_AUDIO);
for(const scene of Object.values(sandbox.MB_ORIGINAL_DATA.scenes))for(const part of scene.audio.parts||[scene.audio])sandbox.MBMobileAudioBank.buffers.set(part.file,{duration:part.duration});
let source=fs.readFileSync`);
harness+=`
const bridge=sandbox.MBTouchBridge;
for(const scene of ['cave','blaster']){
 t.startActivity(scene,true);let n=0;while((t.activity.guide||t.activity.entry)&&n++<1000)step(.06);
 const p=t.activity.player,x=p.x,y=p.y;
 bridge.hold('ArrowRight',true);bridge.hold(' ',true);step(.4);bridge.release();assert(p.x>x+10);assert(p.y<y,scene+' touch thrust');
 bridge.pause(true);const frozen=JSON.stringify(p);step(2);assert.equal(JSON.stringify(p),frozen,scene+' portrait/background pause');
 bridge.hold(' ',true);assert.equal(t.keys.size,0,'paused touch ignored');
 windowEvents.get('blur')();windowEvents.get('focus')();const audioCount=starts.length;documentEvents.get('visibilitychange')();assert.equal(starts.length,audioCount,'foreground cannot resume sound behind Resume screen');
 bridge.pause(false);bridge.hold('ArrowLeft',true);windowEvents.get('pagehide')();assert.equal(t.keys.size,0);assert(JSON.parse(local.get('math-blaster-spot-v1')).saved,'pagehide saves mission');
}
t.startActivity('zapper',false);step(3);const input=ids.get('answer');assert.equal(input.readOnly,true);assert.equal(input.inputMode,'none');
const text=t.activity.question.answerText;for(const key of text)input.onkeydown({key,preventDefault(){}});assert.equal(input.value,text);input.onkeydown({key:'Enter',preventDefault(){},stopPropagation(){}});assert.equal(t.state.stats.correct,1,'touch keypad follows original answer evaluator');
t.settings.transitions=true;t.startMission('short');step(.1);assert.equal(ids.get('game').dataset.lastAudio,'cutscene_beamUp.wav','movie uses predecoded voice');assert(starts.some(b=>b===sandbox.MBMobileAudioBank.buffers.get('cutscene_beamUp.wav')));
console.log('PWA game adapter: touch flight, pause/resume, background audio guard, pagehide save, keypad and predecoded movie startup passed.');
`;
vm.runInNewContext(harness,{require,console,process,Buffer,Float32Array});
