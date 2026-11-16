'use strict';
(() => {
const $=id=>document.getElementById(id),app=$('app'),launch=$('launch'),play=$('play'),status=$('loadStatus');
let registration,started=false,prepared=false,booting=false,lastMode='',lastGeneration=-1;
const portrait=matchMedia('(orientation: portrait)');
const mobileAudio=new MBMobileAudio();
function requestLandscape(){try{screen.orientation?.lock?.('landscape').catch(()=>{});}catch(error){}}
window.MBMobilePaused=true;
const holds=new TouchHolds((key,down)=>window.MBTouchBridge?.hold(key,down));
function release(){holds.clear();window.MBTouchBridge?.release();document.querySelectorAll('[data-hold]').forEach(b=>b.classList.remove('pressed'));}
function showResume(){if(!started)return;release();window.MBTouchBridge.pause(true);mobileAudio.pause();$('resumeScreen').hidden=false;app.inert=true;}
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('Could not load '+src));document.head.append(script);});}
function workerStatus(worker){return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Offline storage did not respond.')),15000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type:'STATUS'},[channel.port2]);});}
async function offlineReady(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)throw Error('Open this game in Safari using its HTTPS link.');
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='DOWNLOAD_PROGRESS'&&!prepared){$('loadProgress').value=event.data.progress;status.textContent=`Downloading for offline play… ${event.data.progress}%`;}
  if(event.data?.type==='DOWNLOAD_ERROR'&&!prepared)status.textContent='The download was interrupted. Check your connection and try again.';
 });
 try{registration=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});}
 catch(error){registration=await navigator.serviceWorker.getRegistration();if(!registration?.active)throw error;}
 const checkUpdate=()=>{if(registration.waiting&&navigator.serviceWorker.controller)$('updateNotice').hidden=false;};
 registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',checkUpdate);});checkUpdate();
 if(!navigator.serviceWorker.controller){
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>finish(Error('The download is taking too long. Check your connection and try again.')),180000);
   const finish=error=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);error?reject(error):resolve();};
   const changed=()=>{if(navigator.serviceWorker.controller)finish();};
   navigator.serviceWorker.addEventListener('controllerchange',changed);
   const worker=registration.installing||registration.waiting;
   worker?.addEventListener('statechange',()=>{if(worker.state==='redundant')finish(Error('Could not save the offline game. Check your connection and free space, then try again.'));});
   changed();
  });
 }
 const result=await workerStatus(navigator.serviceWorker.controller);
 if(!result.ready)throw Error('The game download is incomplete. Please retry while online.');
 app.dataset.offlineReady='true';
}
async function prepare(){
 if(booting)return;booting=true;play.disabled=true;
 try{
  await offlineReady();status.textContent='Preparing the original audio…';$('loadProgress').value=100;
  for(const file of ['resources.js','math.js','original-data.js','original-engine.js','cave-engine.js','effect-audio.js','sound-engine.js'])await loadScript(file);
  const bank=new MBSound.SampleBank(MB_EFFECT_AUDIO);if(!bank.context)throw Error('Audio could not start. Close other audio apps and try again.');
  window.MBMobileAudioBank=bank;
  mobileAudio.bank=bank;
  const files=new Set(Object.values(MB_ORIGINAL_DATA.scenes).flatMap(s=>(s.audio.parts||[s.audio]).map(p=>p.file)));
  for(const file of files){const response=await fetch('assets/'+file);if(!response.ok)throw Error('A cutscene could not be loaded.');bank.buffers.set(file,await bank.context.decodeAudioData(await response.arrayBuffer()));}
  prepared=true;status.textContent='Ready for offline play';play.disabled=false;play.textContent='Play';$('loadProgress').hidden=true;
  bank.context.addEventListener('statechange',()=>{if(started&&!document.hidden&&bank.context.state!=='running')showResume();});
 }catch(error){status.textContent=error.message;play.disabled=false;play.textContent='Try again';play.onclick=()=>location.reload();}
 finally{booting=false;}
}
async function begin(){
 if(!prepared||started||portrait.matches)return;play.disabled=true;requestLandscape();
 try{
  // Resume occurs directly in the tap handler, before any asynchronous loading.
  const unlocked=mobileAudio.unlock();await unlocked;
  await loadScript('game.js');started=true;app.inert=false;launch.hidden=true;
  window.MBTouchBridge.pause(false);sync();navigator.storage?.persist?.().catch(()=>{});
 }catch(error){status.textContent='Could not start the game. Tap to try again.';play.disabled=false;}
}
play.onclick=begin;
$('resume').onclick=async()=>{if(portrait.matches)return;requestLandscape();try{await mobileAudio.unlock();$('resumeScreen').hidden=true;app.inert=false;window.MBTouchBridge.pause(false);}catch(error){$('resume').textContent='Tap to resume sound';}};
$('later').onclick=()=>$('updateNotice').hidden=true;
$('update').onclick=()=>{release();window.MBTouchBridge?.pause(true);navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration?.waiting?.postMessage({type:'APPLY_UPDATE'});};
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('installHelp').hidden=true;

function answerKey(key){
 const input=$('chestAnswer')||$('answer');if(!input||input.disabled||input.closest('[inert]')||window.MBMobilePaused)return;
 input.focus({preventScroll:true});input.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 syncAnswer();
}
function syncAnswer(){
 const input=$('chestAnswer')||$('answer'),value=input?.value.trim()||'—';
 if($('answerDisplay').textContent!==value)$('answerDisplay').textContent=value;
 for(const button of $('numberPad').querySelectorAll('button'))button.disabled=!input||input.disabled;
}
for(const key of ['1','2','3','4','5','6','7','8','9','.','0','Backspace']){
 const button=document.createElement('button');button.textContent=key==='Backspace'?'⌫':key;button.setAttribute('aria-label',key==='Backspace'?'Delete last digit':key==='.'?'Decimal point':key);button.onclick=()=>answerKey(key);$('numberPad').querySelector('.digits').append(button);
}
$('answerEnter').onclick=()=>answerKey('Enter');
$('movieContinue').onclick=()=>window.MBTouchBridge?.continueMovie();
for(const button of document.querySelectorAll('[data-hold]')){
 button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);holds.press(event.pointerId,button.dataset.hold);button.classList.add('pressed');});
 const up=event=>{holds.release(event.pointerId);if(![...holds.pointers.values()].includes(button.dataset.hold))button.classList.remove('pressed');};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,up);
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
// Opening a menu or dialog, rotating, backgrounding, or losing a pointer must
// never leave thrust or steering latched on.
$('menubar').addEventListener('pointerdown',release,true);
window.addEventListener('blur',release);
window.addEventListener('pagehide',showResume);
document.addEventListener('visibilitychange',()=>{if(document.hidden)showResume();});
window.addEventListener('resize',()=>{release();layout();});
window.visualViewport?.addEventListener('resize',layout);
portrait.addEventListener('change',()=>{release();if(portrait.matches)showResume();layout();});

const preparedDialogs=new WeakSet();
function adaptDialogs(){
 for(const body of $('overlay').querySelectorAll('.native-dialog-client')){
  if(preparedDialogs.has(body))continue;preparedDialogs.add(body);
  const children=[...body.children],actions=[],rows=[];
  children.sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top)||parseFloat(a.style.left)-parseFloat(b.style.left));
  for(const child of children){
   if(child.classList.contains('native-group')){child.hidden=true;continue;}
   if(child.classList.contains('native-button')){actions.push(child);continue;}
   const top=parseFloat(child.style.top)||0;let row=rows.find(r=>Math.abs(r.top-top)<7);
   if(!row){row={top,node:document.createElement('div')};row.node.className='touch-dialog-row';rows.push(row);}
   row.node.append(child);
  }
  for(const row of rows)body.append(row.node);
  if(actions.length){const holder=document.createElement('div');holder.className='touch-dialog-actions';holder.append(...actions);body.append(holder);}
 }
}
function sync(){
 if(!started)return;
 const view=window.MBTouchBridge.view(),chest=!!$('chestAnswer');
 document.body.classList.toggle('flight-layout',['cave','blaster','bonus'].includes(view.scene)&&!chest);
 let mode=chest?'answer':view.modal||view.menu?'none':['cave','blaster','bonus'].includes(view.scene)?'flight':view.scene==='recycler'?'recycler':view.scene==='movie'?'movie':$('answer')?'answer':view.scene==='zapper'?'zapper':'none';
 if(mode!==lastMode||view.generation!==lastGeneration){release();lastMode=mode;lastGeneration=view.generation;
  $('controls').dataset.mode=mode;app.dataset.scene=view.scene;
  $('controls').hidden=view.scene==='recycler';
  document.body.classList.toggle('recycler-layout',view.scene==='recycler');
  document.body.classList.toggle('answer-layout',mode==='answer');
  $('numberPad').hidden=mode!=='answer';$('flightPad').hidden=mode!=='flight';$('movieContinue').hidden=mode!=='movie';
  $('touchHint').textContent={answer:'Tap the missing number, then Enter.',flight:'Hold to fly. Release to fall.',recycler:'',zapper:'Tap the floating trash to zap it.',movie:'',none:''}[mode];
  // The chest keypad stays below the dialog; other modal controls remain paused.
  document.body.classList.toggle('chest-open',chest);layout();
 }
 $('movieContinue').textContent=view.waiting?'Continue':'Skip scene';
 if(mode==='answer'){$('touchHint').textContent=($('chestAnswer')||$('answer'))?.getAttribute('aria-label')||'Enter the missing number.';syncAnswer();}
 adaptDialogs();
}
new MutationObserver(()=>{if(started){adaptDialogs();sync();}}).observe($('overlay'),{childList:true,subtree:true});
setInterval(sync,100);
function layout(){
 $('rotateScreen').hidden=!portrait.matches;
 launch.inert=portrait.matches;$('resumeScreen').inert=portrait.matches;
 if(portrait.matches&&started&&!window.MBMobilePaused)showResume();
 const height=window.visualViewport?.height||innerHeight;
 document.documentElement.style.setProperty('--visible-height',height+'px');
 const wide=innerWidth>height*1.3&&height<600;document.body.classList.toggle('landscape-phone',wide);
 const flight=document.body.classList.contains('flight-layout'),answer=document.body.classList.contains('answer-layout'),padding=getComputedStyle(document.body);
 const answerSide=wide?200:250;app.style.setProperty('--answer-control-width',answerSide+'px');
 const availableWidth=Math.min(1100,innerWidth-parseFloat(padding.paddingLeft)-parseFloat(padding.paddingRight));
 const side=Math.min(144,Math.max(100,availableWidth*.14));app.style.setProperty('--side-control-width',side+'px');
 const steering=Math.min(240,Math.max(200,availableWidth*.26));app.style.setProperty('--steering-control-width',steering+'px');
 const recycler=document.body.classList.contains('recycler-layout');
 const controlsHeight=$('controls').getBoundingClientRect().height;
 const verticalPadding=parseFloat(padding.paddingTop)+parseFloat(padding.paddingBottom);
 const available=wide||flight||answer||recycler?Math.max(140,height-verticalPadding-72):Math.max(140,height-verticalPadding-controlsHeight-86);
 const width=Math.min(960,availableWidth-(flight?side+steering+28:answer?answerSide+18:wide&&!recycler?218:0),available*640/425);
 app.style.setProperty('--board-width',Math.max(120,width)+'px');
}
new ResizeObserver(layout).observe($('controls'));
layout();prepare();
})();
