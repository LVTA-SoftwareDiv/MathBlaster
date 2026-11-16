'use strict';
(() => {
const O=MBOriginal,Z=O.Zapper,N=O.Recycler,C=MBCave,D=MB_ORIGINAL_DATA,M=MBMath,R=MB_RESOURCES,$=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),ui=$('ui');
const nativeHost=!!window.webkit?.messageHandlers?.printCertificate;
const W=640,H=425,STORE='math-blaster-spot-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stored={};try{stored=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}
 let settings=Object.assign({subject:0,level:1,sound:true,transitions:true,subtitles:true,missing:'result',format:'horizontal',direction:'left-to-right',order:'random',length:'short'},stored.settings||{});
let player=stored.player||'',records=stored.records||[],saved=stored.saved||null;
settings.goal=Object.assign({enabled:false,increase:90,decrease:50},settings.goal||{});
let personalBests=Array.isArray(stored.personalBests)?stored.personalBests:[];
if(!stored.personalBests)for(const entry of records.slice().reverse().filter(r=>r.activity==='mission')){
 let profile=personalBests.find(p=>p.player===entry.player);if(!profile){profile={player:entry.player,entries:[]};personalBests.push(profile);}profile.entries=M.insertPersonalBest(profile.entries,{score:entry.score,date:entry.date});
}
const state={scene:'title',score:0,phase:1,mission:false,length:'short',time:0,sceneTime:0,feedback:'',feedbackUntil:0,paused:false,modal:false,menu:false,stats:{correct:0,attempts:0},generation:0};
let caveImages=[],zapperImages=[],recyclerImages=[],blasterImages=[],activity=null,keys=new Set(),pointer={x:320,y:180,down:false,mode:'keyboard'},images=new Map(),voice=null,effects=new Set(),voiceToken=0,captionUntil=0,autoSaveAt=0,previous=0,flightClock=0,movie=null,movieNext=null;
const art=(group,id)=>`${group}_${id}`;
function img(id){if(!images.has(id)){const i=new Image();i.onload=()=>render();i.src=`assets/${id}.png`;images.set(id,i);}return images.get(id);}
function draw(id,x=0,y=0,w,h,flip=false){const i=img(id);if(!i.complete||!i.naturalWidth)return;ctx.save();if(flip){ctx.translate(x+(w||i.naturalWidth),y);ctx.scale(-1,1);ctx.drawImage(i,0,0,w||i.naturalWidth,h||i.naturalHeight);}else ctx.drawImage(i,x,y,w||i.naturalWidth,h||i.naturalHeight);ctx.restore();}
function text(s,x,y,size=16,color='#fff',align='center',font='Arial'){ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(String(s),x,y);}
// 1:111e: Cave Runner uses a 16-pixel MS Sans Serif bitmap font, bold,
// centered with integer GDI coordinates. Hero text has an opaque white cell;
// the platform and drop labels use a transparent background.
function bitmapWidth(value,font){return Array.from(String(value).replaceAll('−','-')).reduce((width,c)=>width+(font.glyphs[c]||font.glyphs['?']).width+(font.bold??1),0)+(String(value).length?font.overhang||0:0);}
function caveTextWidth(value){return bitmapWidth(value,D.cave.font);}
function bitmapText(value,cx,top,color,font,opaque=false,target=ctx){
 const chars=Array.from(String(value).replaceAll('−','-')),glyphs=chars.map(c=>font.glyphs[c]||font.glyphs['?']);
 const bold=font.bold??1,width=bitmapWidth(value,font);let x=Math.trunc(cx)-Math.trunc(width/2);top=Math.trunc(top);
 if(opaque){target.fillStyle='#fff';target.fillRect(x,top,width,font.height);}target.fillStyle=color;
 for(const g of glyphs){for(let y=0;y<font.height;y++)for(let col=0;col<g.width;col++)if(g.rows[y]&(1<<(g.width-col-1)))target.fillRect(x+col,top+y,1+bold,1);x+=g.width+bold;}
}
// 5:20d2 / 2500 / 278e: measure m placeholders, right-align vertical
// rows, and leave half a font height before the result or dividend row.
function problemLayout(q,font,cx,top,format=q.format||'horizontal'){
 const blank='m'.repeat(q.answerText.length),display=q.display.replaceAll('−','-'),h=font.height,gap=Math.trunc(h/2),measure=s=>bitmapWidth(s.replace('__',blank),font);
 let rows=[display],kind=0;
 if(format==='vertical'&&q.op){const [lhs,rhs]=display.split(' = '),op=q.op==='−'?'-':q.op,parts=lhs.split(` ${op} `);
  if(rhs!==undefined&&parts.length===2){if(op==='÷'){rows=[rhs,parts[1]+' '+parts[0]];kind=2;}else{rows=[parts[0],op+' '+parts[1],rhs];kind=3;}}
 }
 const width=Math.max(...rows.map(measure)),height=rows.length*h+(kind?gap:0),x=cx-Math.trunc(width/2),right=x+width,bars=[];
 const lines=rows.map((text,i)=>({text,x:kind?right-measure(text):x,y:top+i*h+(kind&&i===rows.length-1?gap:0),width:measure(text)}));
 if(kind===3)bars.push([x,top+2*h+Math.trunc(gap/2),width,1]);
 if(kind===2){const bottom=lines[1],divisor=rows[1].split(' ')[0],offset=Math.trunc((measure(divisor)+measure(divisor+' '))/2),barX=bottom.x+offset,barY=top+h+Math.trunc(gap/2);bars.push([barX,barY,right-barX,1],[barX,barY,1,top+height-barY]);}
 let field;
 for(const line of lines)if(line.text.includes('__')){const [left,rightText='']=line.text.split('__');line.left=left;line.right=rightText;line.lw=bitmapWidth(left,font);line.rw=bitmapWidth(rightText,font);field={x:line.x+line.lw,y:line.y,width:bitmapWidth(blank,font),height:h};}
 return {lines,bars,field,height,top,kind,instructionTop:top+height+(kind?Math.trunc(D.fonts[13].height/2):2*D.fonts[13].height)};
}
function problemText(s,x,y,color,font,target=ctx){
 // 5:229e replaces the two » glyphs with a filled arrow, measured
 // in the same text run. Its shaft and triangle keep integer pixels.
 const at=s.indexOf('»»'),put=(text,left)=>bitmapText(text,left+Math.trunc(bitmapWidth(text,font)/2),y,color,font,false,target);
 if(at<0){put(s,x);return;}
 const before=s.slice(0,at),after=s.slice(at+2),a=bitmapWidth(before,font),b=bitmapWidth(s.slice(0,at+2),font),inset=Math.trunc((b-a)/10),left=x+a+inset,right=x+b-inset,mid=left+Math.trunc((right-left)/2),h=font.height;
 put(before,x);put(after,x+b);target.fillStyle=color;target.fillRect(left,y+Math.trunc(2*h/5),mid-left,Math.trunc(3*h/5)-Math.trunc(2*h/5));
 pixelTriangle([[mid,y+Math.trunc(h/5)],[right,y+Math.trunc(h/2)],[mid,y+Math.trunc(4*h/5)]],color,target,true);
}
function paintProblem(layout,q,input,color,font,target=ctx,underlineOffset=1){
 const put=(s,x,y,w)=>problemText(s,x,y,color,font,target);
 for(const l of layout.lines){if(l.left!==undefined){put(l.left,l.x,l.y,l.lw);put(l.right,layout.field.x+layout.field.width,l.y,l.rw);}else put(l.text,l.x,l.y,l.width);}
 target.fillStyle=color;for(const b of layout.bars)target.fillRect(...b);
 const f=layout.field,n=q.answerText.length,cell=Math.trunc(f.width/n),inset=Math.trunc(cell/8);
 for(let i=0;i<n;i++){const x=f.x+i*cell;target.fillStyle=color;target.fillRect(x+inset,f.y+f.height-underlineOffset,cell-2*inset,1);if(input[i])bitmapText(input[i],x+Math.trunc(cell/2),f.y,color,font,false,target);}
}
function bindAnswerInput(input,q,field,parent,changed,onEnter,color='#fff'){
 // The original is a fixed-cell control, not an insert-mode edit box.
 // 5:7122 / 733a allow digits and '.', and both deletion keys erase
 // the last character entered. Right-to-left starts in the units cell.
 const n=q.answerText.length,rtl=settings.direction==='right-to-left',cell=Math.trunc(field.width/n),inset=Math.trunc(cell/8);
 const caret=element('span',{className:'answer-caret'},field.x+inset,field.y+field.height-2,cell-2*inset,1,parent);caret.style.background=color;caret.setAttribute('aria-hidden','true');
 function update(){const count=input.value.replaceAll(' ','').length,index=rtl?n-1-count:count;caret.style.left=(field.x+Math.max(0,Math.min(n-1,index))*cell+inset)+'px';caret.hidden=count>=n;changed();}
 input.onkeydown=e=>{
  if(e.key==='Enter'){if(onEnter){e.preventDefault();e.stopPropagation?.();onEnter();}return;}
  const count=input.value.replaceAll(' ','').length,characters=(rtl?input.value.padStart(n,' '):input.value.padEnd(n,' ')).split('');
  if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();if(count){characters[rtl?n-count:count-1]=' ';input.value=characters.join('');update();}return;}
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(/^[0-9.]$/.test(e.key)&&count<n){characters[rtl?n-1-count:count]=e.key;input.value=characters.join('');update();}return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))e.preventDefault();
 };
 input.oninput=()=>{const v=input.value.replace(/[^0-9.]/g,'').slice(0,n);input.value=rtl?v.padStart(n,' '):v.padEnd(n,' ');update();};input.refreshNativeAnswer=update;update();
}
function caveText(value,cx,top,color='#000',opaque=false){bitmapText(value,cx,top,color,D.cave.font,opaque);}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x,y,x2,y2,color='#fff',width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function pixelLine(x,y,x2,y2,target=ctx,lowerTie=false){x=Math.trunc(x);y=Math.trunc(y);x2=Math.trunc(x2);y2=Math.trunc(y2);const dx=Math.abs(x2-x),dy=-Math.abs(y2-y),sx=x<x2?1:-1,sy=y<y2?1:-1;let error=dx+dy;for(;;){target.fillRect(x,y,1,1);if(x===x2&&y===y2)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(lowerTie?twice<dx:twice<=dx){error+=dx;y+=sy;}}}
function message(s,seconds=2.5){state.feedback=s;state.feedbackUntil=state.time+seconds;$('status').textContent=s;$('announcer').textContent=s;}
function save(){try{localStorage.setItem(STORE,JSON.stringify({player,settings,records,saved,personalBests}));}catch(e){}}
function snapshot(){if(state.mission&&!['title','certificate','intro','briefing','rescue','movie'].includes(state.scene)){saved={version:5,player,score:state.score,phase:state.phase,length:state.length,scene:state.scene,stats:state.stats,activity:JSON.parse(JSON.stringify(activity))};save();}}
function stopAudio(){mixer.clear();voiceToken++;if(voice){voice.pause();voice=null;}for(const a of effects)a.pause();effects.clear();$('subtitles').textContent='';}
const soundCache=new Map(),sampleBank=window.MBSound?new MBSound.SampleBank(window.MB_EFFECT_AUDIO):null;let channel=null;
canvas.dataset.audioBackend=sampleBank?.context?'buffered':'media';
const unlockSound=()=>sampleBank?.unlock().catch(()=>{});
document.addEventListener('pointerdown',unlockSound,true);document.addEventListener('keydown',unlockSound,true);
function preloadSound(id){
 if(sampleBank?.buffers.has(id))return;
 let a=soundCache.get(id);if(!a){a=new Audio(`assets/MB4_${id}.wav`);a.preload='auto';soundCache.set(id,a);}
 return a;
}
const mixer=new O.SoundArbiter(D.soundPriority,D.soundLoops,item=>{
 const {id,loop}=item,a=sampleBank?.voice(id)||preloadSound(id);item.audio=a;channel=item;
 a.currentTime=0;a.volume=1;a.loop=loop;effects.add(a);
 a.onended=()=>mixer.finish(item);
 a.onplaying=()=>{canvas.dataset.lastAudio=String(id);canvas.dataset.audioState='playing';};
 a.onerror=()=>{canvas.dataset.audioState='error';mixer.finish(item);};if(!((state.modal&&!state.nativeTip?.active)||state.focusPaused||state.paused))a.play().catch(()=>mixer.finish(item));return a;
},item=>{item.audio?.pause();effects.delete(item.audio);if(channel===item)channel=null;});
function sound(id){if(!settings.sound||!R.sounds[id])return null;return mixer.play(id);}
function stopSound(id){mixer.stop(id);}
function speak(id){const info=R.sounds[id];if(!info)return;captionUntil=state.time+info.duration;
 if(settings.subtitles)$('subtitles').textContent=info.caption;voice=sound(id);return info.duration;}
function refreshSound(){if(!settings.sound)stopAudio();if(movie){movie.audioStarted=false;if(!settings.sound)movie.audio?.pause();}$('muteButton').textContent=settings.sound?'Sound on':'Sound off';$('muteButton').setAttribute('aria-pressed',String(!settings.sound));save();buildMenus();}
function updateStatus(){const names={title:'',intro:'Introduction',briefing:'Mission instructions',zapper:'Trash Zapper',recycler:'Number Recycler',cave:'Cave Runner',blaster:'Math Blaster',bonus:'Bonus Round',rescue:'Mission accomplished',certificate:'Mission accomplished'};
 canvas.setAttribute('aria-label',(names[state.scene]||'Math Blaster')+(activity?.question&&(state.scene!=='zapper'||activity.mode==='solve')?' — '+activity.question.display:''));
 $('subjectStatus').textContent=M.subjects[settings.subject];$('levelStatus').textContent=`Level ${settings.level}`;$('scoreStatus').textContent=`${R.strings[40222]}${state.score}`;
 if($('playerStatus'))$('playerStatus').textContent=player;
 const status=$('status'),flightActivity=state.scene==='blaster'?activity:state.scene==='bonus'?activity.previous:null;
 if(flightActivity){
  // 4:2490: each remaining pack occupies its native 18-pixel cell. The
  // phase label follows the last pack with half a cell of separation.
  const packs=Math.max(0,flightActivity.health),phase=state.scene==='bonus'?R.strings[40205]:R.strings[40206].replace('%d',Math.trunc((flightActivity.phaseIndex||0)/2)+1),key=`packs:${packs}:${phase}`;
  if(status.dataset.icons!==key){status.dataset.icons=key;status.textContent='';status.replaceChildren();status.classList.add('jetpacks');status.setAttribute('aria-label',`${packs} spare jet packs; ${phase}`);
   const icons=document.createElement('span');icons.className='pack-icons';
   for(let i=0;i<packs;i++){const icon=document.createElement('img');icon.src='assets/MB4DLL_2551.png';icon.alt='';icons.append(icon);}status.append(icons);
   const label=document.createElement('span');label.className='phase-label';label.textContent=phase;status.append(label);}
 }else{status.dataset.icons='';status.classList.remove('jetpacks');status.setAttribute('aria-label','');if(state.time>=state.feedbackUntil)status.textContent=state.scene==='cave'?'':activity?.status||names[state.scene]||'';}
 const holder=$('toolStatus'),tools=state.scene==='cave'&&state.time>=state.feedbackUntil?(activity?.tools||[]).filter(k=>k>=1&&k<=4).sort((a,b)=>a-b):[];
 if(holder&&holder.dataset.tools!==tools.join(',')){
  holder.dataset.tools=tools.join(',');holder.replaceChildren();holder.hidden=!tools.length;
  for(const kind of tools){const t=D.cave.tracks[32+kind],b=D.bitmaps[t.frames[0][0]],icon=document.createElement('img');icon.src=`assets/${b.hi}.png`;icon.alt=C.toolNames[kind];icon.title=C.toolNames[kind];holder.append(icon);}
 }
}
function setHint(s){$('hint').textContent=s;}
function clearUI(){ui.replaceChildren();}
function element(tag,attrs,x,y,w,h,parent=ui){const el=document.createElement(tag);Object.assign(el,attrs);Object.assign(el.style,{left:x+'px',top:y+'px'});if(w!==undefined)el.style.width=w+'px';if(h!==undefined)el.style.height=h+'px';parent.append(el);return el;}
function button(label,x,y,w,fn){const b=element('button',{textContent:label,className:'win-button'},x,y,w,27);b.addEventListener('click',fn);return b;}
function focusGame(){canvas.focus({preventScroll:true});}
function changeScene(scene){movie=null;movieNext=null;flightClock=0;canvas.style.cursor='default';state.scene=scene;state.sceneTime=0;state.feedback='';state.feedbackUntil=0;state.generation++;keys.clear();pointer.down=false;clearUI();stopAudio();updateStatus();buildMenus();}
function dismiss(){const resetEquation=state.scene==='recycler'&&activity?.noEquations;if(resetEquation)activity.noEquations=false;state.modal=false;state.nativeTip=null;state.dialogKeys=null;$('menubar').inert=false;$('fullscreen').disabled=false;$('app').classList.remove('inactive-window');$('overlay').style.display='none';$('overlay').classList.remove('native-overlay');$('overlay').replaceChildren();if(settings.sound)for(const a of effects)a.play().catch(()=>{});if(state.scene==='zapper'&&activity?.mode==='solve')$('answer')?.focus({preventScroll:true});else focusGame();if(resetEquation)resetRecycler(false);}
function dialog(title,body,actions=[['OK',dismiss]]){keys.clear();pointer.down=false;state.modal=true;state.dialogKeys=null;$('menubar').inert=true;$('fullscreen').disabled=true;$('app').classList.add('inactive-window');for(const a of effects)a.pause();const overlay=$('overlay');overlay.classList.remove('native-overlay');overlay.style.display='flex';overlay.innerHTML=`<section class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="dialog-title"><span>${esc(title)}</span><button class="win-button" id="closeDialog" aria-label="Close">×</button></div><div class="dialog-body">${body}</div><div class="dialog-actions"></div></section>`;overlay.querySelector('#closeDialog').onclick=dismiss;for(const [label,fn]of actions){const b=document.createElement('button');b.className='win-button';b.textContent=label;b.onclick=fn;overlay.querySelector('.dialog-actions').append(b);}overlay.querySelector('input,select,.dialog-actions button')?.focus();}
// Windows 3.x dialog units: the original 8-point MS Sans Serif font maps
// four horizontal units to 7 pixels and eight vertical units to 13 pixels.
function nativeDialog(id,values={},actions={},options={}){
 const d=typeof id==='object'?id:D.dialogs[id],captioned=!!(d.style&0xc00000),dx=n=>Math.round(n*7/4),dy=n=>Math.round(n*13/8),overlay=$('overlay');
 keys.clear();pointer.down=false;state.modal=true;$('menubar').inert=true;$('fullscreen').disabled=true;$('app').classList.add('inactive-window');state.dialogKeys={Escape:options.cancel||(()=>{})};for(const a of effects)if(a!==options.keepSound)a.pause();if(!options.stack)overlay.replaceChildren();overlay.classList.add('native-overlay');overlay.style.display='flex';
 const box=document.createElement('section');box.className='native-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',options.label||d.title||'Continue Saved Mission');Object.assign(box.style,{width:(dx(d.width)+8)+'px',left:(321-Math.trunc((dx(d.width)+8)/2))+'px',top:(options.bottom?H-dy(d.height)-(captioned?27:8):options.owner==='main'?203-Math.trunc((dy(d.height)+(captioned?27:8))/2):Math.trunc((H-dy(d.height)-(captioned?27:8))/2))+'px'});
 const title=document.createElement('div');title.className='native-caption';const caption=document.createElement('span');caption.textContent=d.title;Object.assign(caption.style,{position:'absolute',left:(Math.trunc((dx(d.width)+19)/2)-Math.trunc(bitmapWidth(d.title,D.systemFont)/2))+'px',top:'1px'});title.append(caption);
 const close=document.createElement('button');close.className='native-system-menu';close.tabIndex=-1;close.setAttribute('aria-label','Window menu');close.textContent='−';close.ondblclick=options.cancel||(()=>{});title.append(close);if(captioned)box.append(title);
 const body=document.createElement('div');body.className='native-dialog-client';body.style.height=dy(d.height)+'px';box.append(body);overlay.append(box);const controls=new Map();controls.all=[];controls.box=box;controls.body=body;
 for(const c of d.controls){
  const label=String(values[c.id]??c.text),button=c.class===128&&(c.style&15)<=1,edit=c.class===129;
  const radio=c.class===128&&(c.style&15)===9,group=c.class===128&&(c.style&15)===7;
  const icon=c.class===130&&(c.style&31)===3&&typeof c.text==='number';
  const e=document.createElement(button||radio?'button':edit?'input':icon?'img':'span');e.className=button?'native-button':radio?'native-radio':group?'native-group':edit?'native-input':icon?'native-icon':'native-label';e.dataset.control=String(c.id);Object.assign(e.style,{left:dx(c.x)+'px',top:dy(c.y)+'px',width:dx(c.width)+'px',height:dy(c.height)+'px'});
  if(edit){e.value=label;e.setAttribute('aria-label',options.labels?.[c.id]||String(c.id));}
  else if(icon){e.src=`assets/original_icon_${c.text}.png`;e.alt='';e.style.width=e.style.height='32px';}
  else if(!button){e.textContent=label.replace(/&&/g,'\u0000').replace(/&/g,'').replace(/\u0000/g,'&');e.style.textAlign=(c.style&3)===2?'right':(c.style&3)===1?'center':'left';if((c.style&3)===2)e.style.paddingRight='1px';}
  if(button){const match=label.match(/&(.)/),textLabel=document.createElement('span'),plain=label.replace(/&/g,'');e.setAttribute('aria-label',plain);textLabel.className='native-button-label';textLabel.innerHTML=esc(label).replace(/&amp;(.)/,'<u>$1</u>');Object.assign(textLabel.style,{left:(Math.trunc((dx(c.width)-5-bitmapWidth(plain,D.fonts[13]))/2))+'px',top:(Math.trunc((dy(c.height)-13)/2)-1)+'px'});e.append(textLabel);if(match)state.dialogKeys[match[1].toLowerCase()]=()=>{if(!e.disabled)e.onclick?.();};e.onclick=actions[c.id]||(()=>{});e.disabled=options.disabled?.includes(c.id)||false;if(c.id===(options.defaultButton??options.focus))e.classList.add('native-default');}
  controls.set(c.id,e);controls.all.push(e);body.append(e);
 }
 const focus=controls.get(options.focus),defaultButton=controls.get(options.defaultButton??options.focus);focus?.focus();if(defaultButton?.tagName==='BUTTON')state.dialogKeys.Enter=()=>{if(!defaultButton.disabled)defaultButton.onclick?.();};return controls;
}
function signin(after=showTitle){
 const accept=()=>{const p=controls.get(144).value.trim();if(!p){controls.get(144).focus();return;}player=p;save();dismiss();after();};
 const controls=nativeDialog(148,{144:player},{1:accept,2:dismiss},{focus:144,defaultButton:1,cancel:dismiss,owner:'main',labels:{144:'Your name'}}),input=controls.get(144);
 input.id='playerName';input.maxLength=24;input.autocomplete='off';input.select();
}
function showGoalSetter(){
 let enabled=settings.goal.enabled;
 const accept=()=>{
  const fields=[[112,5,100],[113,0,Number(controls.get(112).value)-1]];
  for(const [id,lo,hi]of fields){const input=controls.get(id),raw=input.value.trim(),n=Number(raw);if(!/^[+-]?\d+$/.test(raw)||n<lo||n>hi){
   const message=!/^[+-]?\d+$/.test(raw)?'Please enter an integer.':`Please enter an integer between ${lo} and ${hi}.`;
   return nativeNotice(message,controls.box,()=>{input.focus();input.select();});
  }}
  settings.goal={enabled,increase:Number(controls.get(112).value),decrease:Number(controls.get(113).value)};save();dismiss();
 };
 const controls=nativeDialog(147,{112:settings.goal.increase,113:settings.goal.decrease},{1:accept,2:dismiss},{focus:112,defaultButton:1,cancel:dismiss,owner:'main',labels:{112:'Percent accuracy before player level increases',113:'Minimum percent accuracy before player level decreases'}});
 const radios=controls.all.filter(e=>e.dataset.control==='111');
 const choose=index=>{enabled=!!index;radios.forEach((e,i)=>{e.setAttribute('aria-checked',String(i===index));e.tabIndex=i===index?0:-1;});};
 radios.forEach((e,i)=>{e.setAttribute('role','radio');e.setAttribute('aria-label',i?'On':'Off');e.replaceChildren();const label=document.createElement('span');label.className='native-radio-label';label.textContent=i?'On':'Off';e.append(label);e.onclick=()=>choose(i);e.onkeydown=event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key)){event.preventDefault();event.stopPropagation();const index=event.key===' '?i:1-i;choose(index);radios[index].focus();}};});choose(Number(enabled));
 for(const id of [112,113]){controls.get(id).maxLength=3;controls.get(id).inputMode='numeric';}controls.get(112).select();
}
function nativeNotice(message,owner,after){
 const previousKeys=state.dialogKeys;owner.inert=true;owner.classList.add('native-inactive');
 const close=()=>{notice.box.remove();owner.inert=false;owner.classList.remove('native-inactive');state.dialogKeys=previousKeys;after();};
 const notice=nativeDialog({style:0xc00000,title:'Math Blaster: In Search of Spot',width:208,height:66,controls:[{id:1,x:87,y:43,width:32,height:16,class:128,style:1,text:'OK'}]},{},{1:close},{focus:1,cancel:close,owner:'main',stack:true});
 notice.box.classList.add('native-notice');notice.box.style.width='372px';notice.box.style.left='135px';notice.box.style.top='136px';notice.body.style.height='106px';
 notice.get(1).style.left='154px';
 const label=document.createElement('span');label.className='native-notice-text';label.textContent=message;notice.body.append(label);
 const icon=document.createElement('img');icon.src='assets/native-warning.svg';icon.className='native-notice-icon';icon.alt='';notice.body.append(icon);
}
function replayActivity(scene,accuracy){
 record(scene);Object.assign(settings,M.goalAdjustment(settings,accuracy,!state.mission));save();dismiss();practice(scene);
}
function showTitle(){
 $('viewport').classList.remove('print-certificate');state.mission=false;
 // 3:69c0/6b62: Main Screen returns to the mission introduction, or
 // offers the previously saved mission. There is no extra launcher page.
 if(saved){
  const fresh=()=>{dismiss();saved=null;save();startMission();};
  nativeDialog(164,{164:`Do you want to continue the saved ${saved.length==='long'?'long':'short'} mission?`},{1:resume,2:fresh},{focus:1,cancel:fresh,owner:'main'});
 }else startMission();
}
function startMission(length=settings.length){if(!player)return signin(()=>startMission(length));snapshot();state.mission=true;state.missionFinished=false;state.length=length;settings.length=length;state.score=0;state.phase=1;state.stats={correct:0,attempts:0};activity=null;save();if(settings.transitions)startIntro();else startActivity('zapper',true);}
function newGame(){state.mission=false;saved=null;activity=null;M.resetQuestions();save();startMission();}
function resume(){
 if(!saved)return;if(state.modal)dismiss();const s=JSON.parse(JSON.stringify(saved));player=s.player||player;state.mission=true;state.missionFinished=false;state.length=s.length;state.score=s.score;state.phase=s.phase;state.stats=s.stats;changeScene(s.scene);activity=s.activity;
 if((s.version||1)<2&&activity?.player){activity.player.vx=Math.trunc(activity.player.vx*.06);activity.player.vy=Math.trunc(activity.player.vy*.06);}
 if((s.version||1)<3){
  if(activity?.trash)activity.trash=[];
  const a=s.scene==='bonus'?activity.previous:s.scene==='blaster'?activity:null;
  if(a){a.trash=[];a.target=state.length==='long'?30:15;a.attempts=a.correct;a.health=Math.min(state.length==='long'?10:5,a.health);}
  if(s.scene==='bonus'){activity.gems=[];activity.eclipse=null;}
 }
 if(s.scene==='recycler'&&!activity.positions){const fuel=Math.floor(activity.fuel/5)*5;Object.assign(activity,M.recycler(settings.subject,settings.level),{fuel,history:[],busy:0,started:false});}
 if(s.scene==='cave'&&!activity.geometryVersion){const old=activity;activity=C.create(D.cave,settings.level,state.length==='long'?8:4,caveProblem,Math.random,{subject:settings.subject,resetProblems:M.resetQuestions});activity.number=old.number;}
 if(s.scene==='cave'&&activity.geometryVersion<2){activity.tools=(activity.tools||[]).map(k=>typeof k==='number'?k:({spider:1,rock:2,web:3,bat:4}[k])).filter(k=>k!=null);activity.geometryVersion=2;if(activity.chest&&!activity.obstacle)C.spawnObstacle(activity,D.cave);}
 if(s.scene==='cave'&&activity.geometryVersion<3){activity.subject=settings.subject;activity.problemSubject=C.caveSubject(settings.subject);activity.geometryVersion=3;M.resetQuestions();}
 if(s.scene==='bonus'&&(s.version||1)<5){const phase=Math.floor(activity.previous.attempts/5)*2-1;activity.gemSlots=O.Blaster.gemSlots(phase);activity.gemTicks=Math.max(1,33-Math.trunc((activity.gemClock||0)/.06));activity.labels=[];activity.gems=activity.gems.slice(0,3).map((g,i)=>{const slot=activity.gemSlots[i],[track,points]=D.blaster.gems[slot];return{...g,slot,track,points};});}
 mountActivity();message('Mission resumed.');
}
// 3:76c7 sets option +56 (activity +a0) to long for individual activities.
function practice(scene){snapshot();state.mission=false;state.length='long';state.score=0;state.stats={correct:0,attempts:0};state.phase=1;startActivity(scene,false);}
// Original mission sequence from 3:759a and activity constructors at 3:6e08.
function startIntro(){playMovies(['beamUp','alien','title','briefing'],()=>startActivity('zapper',true));}
function nextLine(){if(!movie)return;if(movie.waiting){movie.resume();movieAudio(movie,1);activity.status='';setHint('');}else finishMovie();}
function showBriefing(){playMovies(['briefing'],()=>startActivity('zapper',true));}
function playMovies(names,done){
 if(!names.length){done();return;}
 const [name,...rest]=names;changeScene('movie');activity={movie:name};
 const scene=D.scenes[name];movieNext=()=>playMovies(rest,done);
 for(const t of scene.tracks)for(const f of t.frames){if(f[0]>=0){const b=D.bitmaps[f[0]];img(b.variants?.[t.mask]||b.hi);}if(f[5]){const id=f[5]-32768;if(!soundCache.has(id)){const a=new Audio(`assets/MB4_${id}.wav`);a.preload='auto';soundCache.set(id,a);}}}
 for(const z of scene.zones)img(D.bitmaps[z[0]].hi);
 movie=new O.Timeline(scene,(id)=>{
  const info=R.sounds[id];if(info?.caption&&settings.subtitles){$('subtitles').textContent=info.caption;captionUntil=state.time+info.duration;}
 });
 movieAudio(movie,0);setHint('');focusGame();
}
function movieAudio(timeline,part){
 const info=timeline.scene.audio.parts?.[part]||timeline.scene.audio;
 const a=new Audio(`assets/${info.file}`);a.preload='auto';timeline.audio=a;timeline.audioOffset=info.offset||0;timeline.audioDuration=info.duration;timeline.audioStarted=false;timeline.audioEnded=false;
 timeline.audioEnd=part===0&&timeline.scene.waitAfterFrame!=null?timeline.scene.waitAfterFrame*timeline.ms/1000:timeline.audioOffset+info.duration;
 a.onended=()=>{timeline.audioEnded=true;effects.delete(a);};
 a.onerror=()=>{timeline.audioFailed=true;effects.delete(a);};
 a.onplaying=()=>{canvas.dataset.audioState='playing';canvas.dataset.lastAudio=info.file;};
}
function finishMovie(){const next=movieNext;if(next)next();}
function startActivity(scene,mission=state.mission){state.mission=mission;changeScene(scene);const target=state.length==='long'?25:15;
 if(scene==='zapper'){activity={mode:'opening',panelFrame:0,earned:0,beams:0,collected:0,target,question:M.question(settings.subject,settings.level,settings),input:'',trash:[],aim:{x:320,y:120},beam:null,roundTime:0,wait:0,correct:0,attempts:0};Z.init(activity,D.zapper);}
 if(scene==='recycler'){activity={...M.recycler(settings.subject,settings.level),target,started:false,busy:(D.recycler.tracks[11].n+1)*.06,history:[],walkX:320,walkTo:320,correct:0,attempts:0,animations:[]};recyclerAnimation(11);activity.initialColumns=activity.columns.map(c=>c.slice());}
 if(scene==='cave')activity=C.create(D.cave,settings.level,state.length==='long'?8:4,caveProblem,Math.random,{subject:settings.subject,resetProblems:M.resetQuestions});
 if(scene==='blaster')activity={question:M.question(settings.subject,settings.level,settings),choices:null,player:{x:290,y:342,vx:0,vy:0},health:state.length==='long'?10:5,correct:0,attempts:0,target:state.length==='long'?30:15,trash:[],spawn:0,hitUntil:0,wait:0};
 if(scene==='blaster')beginBlasterEntry();
 mountActivity();snapshot();}
function mountActivity(){clearUI();
 if(state.scene==='bonus'&&!activity.eclipse){resetEclipse(activity,Math.max(1,Math.floor(activity.previous.attempts/5)*2-1));activity.left=activity.eclipse.period*45*.06;}
 if(['cave','blaster','bonus'].includes(state.scene)){
  preloadSound(8236);
  for(const s of D.flight[heroKind()])for(const f of s.track.frames){if(f[0]>=0){const b=D.bitmaps[f[0]];img(b.variants?.[s.track.mask]||b.hi);}if(f[5])preloadSound(f[5]-32768);}
  if(state.scene==='cave'){caveImages=[];for(const t of D.cave.tracks.filter(t=>t.type===1))for(const f of t.frames)if(f[0]>=0){const b=D.bitmaps[f[0]];caveImages.push(img(b.variants?.[t.mask]||b.hi));}for(const f of D.cave.tracks[158].frames)caveImages.push(img(D.bitmaps[f[0]].hi));}
  if(state.scene!=='cave'){blasterImages=[];for(const track of D.blaster.tracks)for(const f of track.frames)if(f[0]>=0){const b=D.bitmaps[f[0]];blasterImages.push(img(b.variants?.[track.mask]||b.hi));}}
 }
 if(state.scene==='zapper'){
  if(!activity.zapperVersion)Z.init(activity,D.zapper);
  zapperImages=[];for(const t of D.zapper.tracks)for(const f of t.frames)if(f[0]>=0){const b=D.bitmaps[f[0]];zapperImages.push(img(b.variants?.[t.mask]||b.hi));}
  if(activity.mode==='solve')mountQuestion();else mountZapperAction();setHint('Type the missing number and press Enter. Earn 5 tractor beams, then click the floating trash.');
 }
 if(state.scene==='recycler'){
  N.initHopper(activity,D.recycler);
  recyclerImages=[];for(const t of D.recycler.tracks)for(const f of t.frames)if(f[0]>=0){const b=D.bitmaps[f[0]];recyclerImages.push(img(b.variants?.[t.mask]||b.hi));}
  for(let i=0;i<5;i++){const b=button('',199+i*50,129,44,()=>selectRecycler(i));b.style.height='17px';b.style.minHeight='0';b.style.padding='0';b.setAttribute('aria-label',`Column ${i+1}: select or push`);}
  const ok=button('OK',460,96,41,checkRecycler);ok.style.height='24px';ok.style.minHeight='0';ok.style.padding='0';
  setHint('← → select; ↓ pushes; ↑ undoes. Enter accepts a true equation. The next row recycles; the bottom row zaps.');
 }
 if(state.scene==='cave'){setHint('← → steer; hold Spacebar to thrust, release to fall. Pass between the numbers and catch drops to change your number.');}
 if(state.scene==='blaster'){if(!activity.choices)activity.choices=M.choices(activity.question);setHint('← → steer; hold Spacebar to thrust into the correct answer porthole. Release to fall. Avoid trash and energy blasts.');}
 if(state.scene==='bonus')setHint('Bonus round! Steer with left/right arrows, hold Spacebar to thrust, and collect as many gems as you can.');if(!$('answer'))focusGame();}
function mountQuestion(){clearUI();const q=activity.question,font={...D.fonts[20],overhang:1};
 activity.questionLayout=problemLayout(q,font,320,65,q.format||settings.format);const f=activity.questionLayout.field;
 const input=element('input',{className:'answer bitmap-answer',id:'answer',inputMode:'decimal',autocomplete:'off',spellcheck:false,value:activity.input||'',maxLength:q.answerText.length},f.x,f.y,f.width,f.height);input.setAttribute('aria-label',q.display);bindAnswerInput(input,q,f,ui,()=>activity.input=input.value,submitAnswer);input.focus({preventScroll:true});
 activity.status=`${activity.collected} of ${activity.target} collected`;
}
function submitAnswer(){
 if(state.scene!=='zapper'||activity.mode!=='solve'||state.modal||state.menu)return;
 const a=activity,input=$('answer'),value=String(input?.value??a.input);
 // 4:13ea: five problems per batch. A third incorrect try shows the
 // answer; Enter then advances without awarding a tractor beam.
 if(!a.questionTries){a.roundQuestions=(a.roundQuestions||0)+1;if(!a.retake){a.attempts++;state.stats.attempts++;}}
 a.questionTries=(a.questionTries||0)+1;
 // 4:1472..1481 uses the completed answer text, not numeric coercion.
 if(value===a.question.answerText){
  if(!a.revealed){M.acceptQuestion(a.question);a.correct++;state.stats.correct++;a.earned++;a.beams++;sound(8316);if(a.retake)a.missed[a.retake.queue[a.retake.index]].solved=true;}
  if(a.retake)a.retake.index++;
  a.input='';a.questionTries=0;a.revealed=false;
  if(a.roundQuestions>=(state.mission?Math.min(5,a.target-a.collected):5)||(a.retake&&a.retake.index>=a.retake.queue.length))beginCollection();
  else{newZapperQuestion();mountQuestion();}
 }else if(a.questionTries>=3){
  // 4:16a0..16e3: only a third failed try goes onto the practice retake list.
  if(!a.revealed){M.acceptQuestion(a.question,false);if(!state.mission&&!a.retake)(a.missed??=[]).push({question:a.question,solved:false});}
  a.revealed=true;a.input=a.question.answerText;if(input){input.value=a.input;input.refreshNativeAnswer?.();}
 }else{
  a.input='';if(input){input.value='';input.refreshNativeAnswer?.();}if(a.questionTries===2)tip();
 }
 snapshot();
}
function trashSprite(t,kind='zapper'){return D.bitmaps[O.trashFrame(t,D.trash,kind)[0]].hi;}
function mountZapperAction(){clearUI();setHint('Click a piece of trash to fire a tractor beam.');}
function beginCollection(){activity.mode='collect';activity.roundTime=0;activity.roundQuestions=0;activity.earned=0;Z.begin(activity);mountZapperAction();}
function fireBeam(x,y){if(state.scene!=='zapper'||activity.mode!=='collect'||state.modal||state.menu)return;
 const shot=Z.hit(activity,D.zapper,x,y);if(!shot)return;activity.aim={x,y};sound(shot.hit?D.zapperSounds.hit:D.zapperSounds.miss);state.score+=shot.points;
 activity.status=`${activity.collected} of ${activity.target} collected`;snapshot();
}
function newZapperQuestion(){const a=activity,old=a.retake?a.missed[a.retake.queue[a.retake.index]].question:null;a.question=old?M.question(old.subject,old.level,settings,Math.random,old.sourceIndex):M.question(settings.subject,settings.level,settings);a.input='';a.questionTries=0;a.revealed=false;}
function endCollection(){Z.end(activity);activity.mode='opening';activity.panelFrame=0;activity.panelSound=false;newZapperQuestion();activity.wait=0;activity.beams=0;clearUI();}
function finishZapperCollection(){
 const a=activity;
 // 4:19e0..1a9f: missions end at the trash goal; practice ends after
 // five shooting rounds even if shots miss, or after the retake queue.
 if(!state.mission)a.batches=(a.batches||0)+1;
 const done=state.mission?a.collected>=a.target:a.batches>=5||(a.retake&&a.retake.index>=a.retake.queue.length);
 if(done)completeActivity();else endCollection();
}
function recyclerAnimation(track,dx=0){
 const a={track,dx,frame:-1,next:0,active:true};activity.animations=(activity.animations||[]).filter(a=>a.track!==track);activity.animations.push(a);return a;
}
function selectRecycler(i,push=false){
 if(activity.demo&&!activity.demoAdvancing){activity.demo.stop=true;return;}
 if(activity.walk&&!activity.exiting&&activity.selected===i&&!state.modal&&!state.menu){activity.queuedPush=true;return;}
 if(activity.busy>0||state.modal||state.menu)return;
 if(activity.selected===i||push){activity.selected=i;activity.walkTo=221+i*50;pushColumn(i);}
 else {N.walk(activity,i);activity.walkClock=0;}
}
function pushColumn(i){
 if(state.scene!=='recycler'||activity.busy>0||state.modal||state.menu)return;
 activity.started=true;if(!activity.demo)activity.tips=false;activity.selected=i;activity.walkTo=221+i*50;
 const before=activity.positions.map(p=>p.slice()),event=M.recyclerPush(activity,i);
 const undo=before.map(p=>p.slice());for(const [c,j]of event.zapped)undo[c][j]=-1;activity.history=[undo];activity.undoColumn=i;
 N.begin(activity,D.recycler,'push',before,event,i);activity.busy=1;
 if(event.zapped.length)recyclerAnimation(15);snapshot();
}
function undoRecycler(){
 if(state.scene!=='recycler'||activity.demo||!activity.history.length||activity.busy>0||state.modal||state.menu)return;
 const before=activity.positions.map(p=>p.slice());activity.positions=activity.history.pop();activity.undoColumn=-1;N.begin(activity,D.recycler,'undo',before,{zapped:[],recycled:[]});activity.busy=1;message('Last push undone.');snapshot();
}
function checkRecycler(){
 if(activity?.demo&&!activity.demoAdvancing){activity.demo.stop=true;return;}
 if(state.scene!=='recycler'||activity.busy>0||activity.complete||state.modal||state.menu)return;
 activity.started=true;if(!activity.demo){activity.tips=false;activity.attempts++;state.stats.attempts++;}
 if(M.recyclerValid(activity)){
  const before=activity.positions.map(p=>p.slice()),values=M.recyclerValues(activity),event=M.recyclerAccept(activity);
  if(!activity.demo){activity.correct++;state.stats.correct++;}activity.fuel++;activity.history=[];activity.undoColumn=-1;
  N.begin(activity,D.recycler,'accept',before,event);activity.busy=1;
  recyclerAnimation(9);
  if(event.zapped.length)recyclerAnimation(15);
  if(activity.fuel%5===0){if(!activity.demo)state.score+=1000;activity.nextGrid=true;}
  if(!activity.demo&&activity.fuel>=activity.target){activity.complete=true;activity.nextGrid=false;}
  message('Correct! Recycling the equation and returning the recycling row.');
 }else {recyclerAnimation(3,(activity.selected-3)*50);activity.busy=(D.recycler.tracks[3].n+1)*.06;message('That equation is not true. Check the boxed row.');}
 activity.status=`Fuel: ${activity.fuel} of ${activity.target}`;snapshot();
}
function newRecyclerGrid(same=false){
 const {fuel,target,correct,attempts,selected}=activity,columns=activity.initialColumns;
 const board=same&&columns?{columns:columns.map(c=>c.slice()),positions:columns.map(c=>c.map((_,i)=>i)),selected:2}:M.recycler(settings.subject,settings.level,Math.random,{difficulty:Math.floor(fuel/5)});
 Object.assign(activity,board,{fuel,target,correct,attempts,selected,started:false,tips:false,queuedPush:false,walk:null,exiting:null,pendingIdle:false,demo:null,demoAdvancing:false,nextGrid:false,complete:false,busy:0,history:[],undoColumn:-1,animations:[],process:null,motion:null,slide:null});
 activity.initialColumns=activity.columns.map(c=>c.slice());activity.walkTo=221+selected*50;
}
function resetRecycler(same){if(activity.busy>0||activity.demo)return;activity.fuel=Math.floor(activity.fuel/5)*5;N.refillHopper(activity);newRecyclerGrid(same);message('Round reset. Completed fuel chambers are kept.');snapshot();}
function showRecyclerDemo(){
 if(state.scene!=='recycler')return;
 if(activity.started)return dialog('Math Blaster: In Search of Spot',`<p>${esc(R.strings[40213])}</p>`);
 activity.demo={index:0,fuel:activity.fuel,stop:false};
}
function finishRecyclerDemo(){activity.fuel=activity.demo.fuel;N.refillHopper(activity);newRecyclerGrid(true);snapshot();}
function updateRecycler(dt){
 if(recyclerImages.some(i=>!i.complete))return;
 const a=activity;a.tickClock=(a.tickClock||0)+dt;
 while(a.tickClock+1e-9>=.06&&activity===a){a.tickClock-=.06;recyclerTick();}
}
function recyclerTick(){
 const a=activity,idleProcessed=a.pendingIdle;
 // 3:c982 handles state first; 5:081a paints the next animation frames
 // at the end of the same timer event. Finished frames remain until then.
 a.animations=(a.animations||[]).filter(x=>x.active!==false);
 if(idleProcessed){a.pendingIdle=false;a.busy=0;recyclerIdle();if(activity!==a)return;}
 if(a.demo&&!a.busy){
  if(a.demo.stop)finishRecyclerDemo();
  else {const command=a.recipe[a.demo.index];a.demoAdvancing=true;
   if(command===0){a.demo.index++;checkRecycler();}
   else if(command){if(a.selected===command-1)a.demo.index++;selectRecycler(command-1);}
   a.demoAdvancing=false;
  }
 }
 if(a.walk){if(N.walkTick(a,D.recycler,sound)){if(a.exiting)recyclerIdle();else if(a.queuedPush){a.queuedPush=false;pushColumn(a.selected);}}}
 else if(a.motion){
  const previousPhase=a.motion.phase;
  if(N.tick(a,D.recycler,{play:sound,stop:stopSound,animate:recyclerAnimation,width:v=>bitmapWidth(v,D.recycler.font),playing:id=>mixer.active?.id===id}))a.pendingIdle=true;
  if(a.motion?.phase==='consume')a.canFrame=previousPhase==='consume'?((a.canFrame||0)+1)%D.recycler.tracks[10].n:0;
 }else if(a.busy>0&&!idleProcessed){a.busy=Math.max(0,a.busy-.06);if(a.busy<1e-9){a.busy=0;recyclerIdle();}}
 if(activity!==a)return;
 for(const animation of a.animations){
  const t=D.recycler.tracks[animation.track];
  // Resume saves made before the discrete animation timer was introduced.
  animation.next??=Math.min(t.n-1,Math.floor((animation.elapsed||0)/.06));
  animation.frame=animation.next++;
  const f=t.frames[animation.frame];if(f?.[5])sound(f[5]-32768);
  animation.active=animation.next<t.n;
 }
}
function recyclerIdle(){
 if(activity.demo){if(activity.demo.stop||activity.nextGrid)finishRecyclerDemo();return;}
 if(activity.complete){
  // 3:cb2c / 3:cd84: mission play walks to column 3, then takes the
  // 36-frame lift out. Practice completion bypasses this departure.
  if(!state.mission||activity.exiting==='lift'){completeActivity();return;}
  activity.queuedPush=false;
  if(activity.selected!==2){activity.exiting='walk';N.walk(activity,2);activity.walkClock=0;}
  else {activity.exiting='lift';recyclerAnimation(12);activity.busy=D.recycler.tracks[12].n*.06;}
  return;
 }
 if(activity.nextGrid)newRecyclerGrid();
 else if(activity.started&&!M.recyclerSolution(activity,activity.history.length?activity.undoColumn:-1)){
  activity.noEquations=true;const restart=dismiss;
  dialog('Math Blaster: In Search of Spot',`<p>${esc(R.strings[40215])}</p>`,[['OK',restart]]);
  $('overlay').querySelector('#closeDialog').onclick=restart;
 }
}
function caveProblem(subject,rng=Math.random){
 const q=M.question(subject,settings.level,{missing:'result',format:'horizontal',order:settings.order},rng);M.acceptQuestion(q);
 let {a,b,op}=q;
 // 4:807b: shrink the larger multiplication operand until its product fits
 // on the cave's three-digit number plates.
 if(op==='×')while(a*b>999){if(a>b)a=Math.trunc(a/10);else b=Math.trunc(b/10);}
 const value=M.operate(a,op,b);let text=`${a} ${op} ${b}`;
 // 4:7f0e..81cc: try the spaced expression, then compact it, then use the
 // numerical result if it still exceeds the original 44-pixel label width.
 if(caveTextWidth(text)>44)text=`${a}${op}${b}`;
 if(caveTextWidth(text)>44)text=String(value);
 return {value,text};
}
function openTreasure(){
 if(state.scene!=='cave'||!activity.chest)return;
 // 4:c95d/cb5e: chest problems use the selected subject and a fresh bank;
 // closing the chest restores a freshly selected cave arithmetic bank.
 M.resetQuestions();
 const subject=settings.subject===7?Math.floor(Math.random()*32768)%7:settings.subject;
 const chest=activity.chest,q=M.question(subject,settings.level,{...settings,format:'horizontal'}),opening=sound(8248);
 const finish=correct=>{M.acceptQuestion(q,correct);if(correct){C.awardTool(activity);state.feedback='';state.feedbackUntil=state.time;}activity.subject=settings.subject;activity.problemSubject=C.caveSubject(settings.subject);M.resetQuestions();delete activity.chestQuestion;chest.cooldown=16;dismiss();if(correct)sound(8249);snapshot();};
 // 4:c98e / cd34 / cfc2: an uncaptioned resource-154 question, with
 // a regular MS Sans Serif field. Enter closes it on the first answer;
 // the parent receives ID 1 for correct and ID 2 for wrong or Escape.
 const controls=nativeDialog(154,{},{},{cancel:()=>finish(false),label:'Treasure chest problem',keepSound:opening}),holder=controls.get(123),font={...D.cave.font,bold:0,overhang:0};
 holder.className='chest-equation';activity.chestQuestion=q;
 // 4:cd66 takes the 16-pixel system font height, with weight 400.
 // 5:3060 replaces each missing character with an m before measuring.
 const layout=problemLayout(q,font,175,Math.trunc((91-font.height)/2)),f=layout.field,panel=element('canvas',{width:350,height:91},0,0,350,91,holder),dc=panel.getContext('2d');
 const input=element('input',{id:'chestAnswer',value:'',autocomplete:'off',spellcheck:false,maxLength:q.answerText.length},f.x,f.y,f.width,f.height,holder);input.setAttribute('aria-label',q.display);
 const paint=()=>{dc.clearRect(0,0,350,91);paintProblem(layout,q,input.value,'#000',font,dc);};bindAnswerInput(input,q,f,holder,paint,null,'#000');
 state.dialogKeys.Enter=()=>finish(input.value===q.answerText);input.focus({preventScroll:true});
}
function hurt(where,losePack=false){if(activity.hitUntil>state.time)return;if(losePack)activity.health--;activity.hitUntil=state.time+1.8;activity.player.vy=8;if(state.scene==='cave')activity.gapScore=Math.max(100,(activity.gapScore??500)-100);if(state.scene==='blaster')sound(8296);message(where||'Watch out!',1.5);if(activity.health<=0)gameOver();}
function gameOver(){
 if(!state.mission){if(state.scene==='blaster')showBlasterScoreboard();else showPlatformScoreboard(state.scene);return;}
 if(state.scene==='blaster'&&settings.transitions)playMovies(['escape'],()=>finishMission(false));
 else finishMission(false);
}
function heroKind(){return state.scene==='cave'?'cave':'blaster';}
function heroBounds(p){return O.flightBounds({...p,y:p.y+58},D.flight,heroKind());}
function heroContactBounds(p){const kind=heroKind(),b=heroBounds(p),f=O.flightFrame(p,D.flight,kind),size=D[kind].sizes?.[f[0]];return size?{...b,right:b.left+size[0],bottom:b.top+size[1],width:size[0],height:size[1]}:b;}
function movement(p,dt,floor=D.blaster.flightRect[4]-20,frameSounds=null,caveContact=null,caveScreen=null){
 const moving=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0);
 const thrust=keys.has(' ')||pointer.down;
 const kind=heroKind(),box=heroBounds(p),half=Math.trunc(box.width/2);
 const contactBox=kind==='blaster'?O.Blaster.heroBounds({...p,y:p.y+58},D.blaster,D.flight):box;
 const target=pointer.mode==='mouse'?pointer.x:p.x+half+moving*120;
 const old=p.y,q={...p,y:p.y+58},oldPose=p.flight?.state??(q.y>=floor?4:6);
 if(kind==='blaster'){
  q.flight??={state:oldPose,frame:0,active:false,floor};
  q.flight.entry=!!activity.entry;q.flight.blocked=!!activity.entry||!!q.flight.blocked;
  O.Blaster.prepareFlight(q,D.blaster,D.flight,state.scene==='blaster');
 }
 if(kind==='cave'&&D.flight.cave[oldPose].words[1]){
  if(q.x<29){q.x=29;q.vx=0;}if(q.x>580){q.x=580;q.vx=0;}
  const ceiling=Math.trunc(69/(activity.finalSection?8:2))-20;
  if(q.y<ceiling){q.y=ceiling;q.vy=0;}if(q.y>401){q.y=401;q.vy=1;}
 }
 const result=O.flightTick(q,D.flight,kind,target,thrust,{
  floor,grounded:q.y>=floor,minX:kind==='cave'?29:activity.entry?-310:0,maxX:kind==='cave'?580:578,nativeFrameBounds:true,
  resolve:kind==='cave'?(actor,pose)=>{const result=C.resolveFlight(activity,actor,D.flight,target,pose,{
   pass:(row,points,correct)=>{state.stats.attempts++;state.score+=points;if(correct){state.stats.correct++;sound(8249);}},
   laser:caveLaser,hint:tip
  });if(result.screenChange)caveScreen?.(actor);return result;}:(actor,pose)=>O.Blaster.resolveFlight(actor,D.blaster,D.flight,target,pose,state.scene==='blaster'),
  contact:kind==='blaster'?(actor,pose,old)=>{
   const hit=O.Blaster.contact(actor,D.blaster,D.flight,old,state.scene==='blaster',()=>{
    const weapon=O.weaponSprite(activity.weapon,D.weapon);
    return {blast:!!weapon&&overlaps(weapon.box,contactBox),trash:(activity.trash||[]).filter(t=>t.alive&&t.age>=0).sort((a,b)=>a.type-b.type).filter(t=>overlaps(O.Blaster.trashBounds(t,D.trash,D.blaster),contactBox)).map(t=>t.vx)};
   },sound);
   if(hit?.blast){if(activity.weapon?.sound)stopSound(activity.weapon.sound);activity.weapon={phase:'idle',left:D.weapon.cooldownTicks,port:activity.weapon?.port??0,frame:0};}
   return hit;
  }:caveContact
 },{play:sound,stop:stopSound,frame:frameSounds?(emit,pose)=>frameSounds.push({emit,...pose}):null});
 p.x=q.x;p.y=q.y-58;p.vx=q.vx;p.vy=q.vy;p.flight=q.flight;
 if(kind==='blaster')activity.entry=!!q.flight.entry;
 if(kind==='blaster'){
  const stats=activity.motionStats??={takeoffs:0,hits:0,exits:0};if(result.takeoff)stats.takeoffs++;
  if(result.contact)stats.hits++;
 }
 return {old,thrust:result.thrust,moving,screenChange:result.screenChange,exit:result.exit};
}
function applyDrop(d){
 const n=C.dropResult(activity.number,d.op,d.value,settings.level);
 if(n==null)return false;activity.number=n;d.alive=false;sound(8241);return true;
}
function caveLaser(row,gap,hitBox=null){C.startLaser(activity,D.cave,row,gap,hitBox);}
function updateCave(dt){
 if(caveImages.some(i=>!i.complete))return;
 // 4:c841/c846: finishing the guide hands over to flight in this tick.
 if(activity.guide){C.guideTick(activity);if(activity.guide)return;}
 const a=activity;
 if(a.laser)a.laser.needed=false;
 if(a.chest?.cooldown>0)a.chest.cooldown--;
 // 4:c770/c78d expire the gem and its bonus label before collision checks.
 if(a.gemBonusTicks>0)a.gemBonusTicks--;
 for(const g of a.gems)if(--g.ticks<=0)g.alive=false;
 const p=a.player,oldBox=heroContactBounds(p);
 const playObstacleSounds=()=>{for(const cue of a.soundQueue||[])if(cue.stop)stopSound(cue.id);else sound(cue.id);a.soundQueue=[];};
 // 4:c826/c82f precede the hero controller atc853. A caught drop
 // changes the number before this tick's gap/laser decision.
 C.dropsTick(a,D.cave,oldBox,!D.flight.cave[p.flight?.state??4].words[1],a.problemSubject,()=>{},sound,Math.random,true,stopSound);
 // 4:a3c4..a558 resolve contacts before selecting/painting the new hero
 // pose. Knockback keeps that pose and resets its animation at the floor.
 const caveContact=(actor,pose,old,resolution)=>{
  if(resolution?.screenChange||resolution?.exit)return null;
  const contact=C.obstacleContact(a,D.cave,oldBox);
  playObstacleSounds();
  if(contact?.blocked){
   actor.y=401;actor.vx=actor.vy=0;actor.flight.row=2;actor.flight.floor=401;
   const id=D.cave.obstacles.rows[contact.blocked][9]+65536+(a.chest?0:1);message(R.strings[id],Math.trunc(4000/60)*.06);
   const reference=D.flight.cave[old===7?13:7].track.frames[0];
   return {state:pose,restart:true,preserveSound:pose===old,referenceWidth:pose===old?reference[3]-reference[1]:undefined};
  }
  for(const g of a.gems)if(g.alive&&oldBox.left<g.x+39&&oldBox.right>g.x&&oldBox.top<g.y+40&&oldBox.bottom>g.y){g.alive=false;a.gemsCollected++;a.gemBonusTicks=Math.trunc(3000/60);state.score+=5000;sound(8240);}
  return null;
 };
 // 4:968c rebuilds the screen inside the resolver, before changing the
 // hero pose or stopping thrust. Creature cues are stopped in that order.
 const caveScreen=actor=>{
  if(a.laser)stopSound(8237);
  p.x=actor.x;a.section++;C.makeScreen(a,D.cave,caveProblem,Math.random,M.resetQuestions);
  playObstacleSounds();actor.y=401;actor.vx=actor.vy=0;actor.flight.row=2;actor.flight.floor=401;
 };
 const frameSounds=[],motion=movement(p,dt,401,frameSounds,caveContact,caveScreen);a.thrust=motion.thrust;
 let box=heroContactBounds(p);
 // 4:986a changes screens before obstacle/gem contact and before the
 // new screen's obstacle controller and animation pass.
 if(motion.screenChange){
  snapshot();box=heroContactBounds(p);
 }else if(motion.exit){completeActivity();return;}
 playObstacleSounds();
 a.gems=a.gems.filter(g=>g.alive);
 const obstacleFrameCues=C.obstacleTick(a,D.cave,Math.random,true)||[];
 playObstacleSounds();
 C.finishDropSounds(a,stopSound);
 C.updateLasers(a,D.cave,sound,stopSound);
 for(const cue of obstacleFrameCues)sound(cue);
 C.animateDrops(a,D.cave,sound,stopSound);
 for(const cue of frameSounds)if(p.flight===cue.actor&&p.flight.state===cue.state&&p.flight.frame===cue.frame)cue.emit();
 if(a.chest){const c=a.chest,near=box.left<c.x+37&&box.right>c.x&&box.bottom>c.y&&box.top<c.y+32;
  if(near){const ready=!c.cooldown;c.cooldown=16;if(ready)openTreasure();}
 }
}
// 1:0cb4 and 4:27da: 45 eclipse frames, with an integer countdown per
// frame. The source's multiplier of two is preserved (not wall-clock seconds).
function resetEclipse(a,index){const period=Math.trunc(Math.trunc(D.phaseSeconds[index]*1000/60)*2/45);a.phaseIndex=index;a.eclipse={frame:0,period,left:period};}
function advanceEclipse(a){if(--a.eclipse.left<=0){a.eclipse.left=a.eclipse.period;a.eclipse.frame++;}return a.eclipse.frame>=45;}
function awardFlightPoints(points){
 // 4:359b and 4:3db0 save the old score in a signed 16-bit word before
 // comparing thousands. Preserve the original extra-pack behavior at high scores.
 const a=state.scene==='bonus'?activity.previous:activity,before=Math.trunc(((state.score<<16)>>16)/1000);
 state.score+=points;const earned=Number(Math.trunc(state.score/1000)!==before);
 a.health=Math.min(state.length==='long'?10:5,a.health+earned);
}
function finishBlasterProblem(correct,timeout=false){
 if(!correct){
  if(activity.failure)return;
  M.acceptQuestion(activity.question,false);
  if(!state.mission&&!activity.retake)(activity.missed??=[]).push({question:activity.question,solved:false});
  activity.health--;activity.failure={ticks:timeout?49:50,blink:timeout?7:8,highlight:true,frame:0,correct:activity.choices.findIndex(v=>M.equal(M.parseAnswer(v),activity.question.answer))};return;
 }
 if(activity.retake){activity.missed[activity.retake.queue[activity.retake.index]].solved=true;activity.retake.index++;}else{activity.attempts++;state.stats.attempts++;}
 M.acceptQuestion(activity.question);activity.correct++;state.stats.correct++;awardFlightPoints(200);
 const oldPose=activity.player.flight?.state;
 advanceBlasterProblem();if(state.scene==='blaster'||state.scene==='bonus'){if(oldPose===7||oldPose===13)stopSound(8236);activity.spotFrame=0;activity.spotAnimating=true;}
}
function advanceBlasterProblem(){
 if(activity.retake&&activity.retake.index>=activity.retake.queue.length){completeActivity();return;}
 if(!activity.retake&&activity.attempts>=activity.target){completeActivity();return;}
 if(blasterAttempts(activity)%5===0){startBonus();return;}
 newBlasterQuestion();
}
function beginBlasterEntry(){const p=activity.player,e=O.Blaster.entry(D.blaster,p.flight?.state??4);Object.assign(p,{x:e.x,y:e.y-78,vx:e.vx,vy:e.vy,flight:{state:e.state,frame:0,active:false,floor:D.blaster.flightRect[4]-20}});activity.entry=true;activity.hitUntil=0;}
function blasterAttempts(a){return a.retake?a.retake.index:a.attempts;}
function newBlasterQuestion(){const old=activity.retake?activity.missed[activity.retake.queue[activity.retake.index]].question:null;activity.question=old?M.question(old.subject,old.level,settings,Math.random,old.sourceIndex):M.question(settings.subject,settings.level,settings);activity.choices=M.choices(activity.question);activity.wait=0;activity.planetFailureFrame=null;beginBlasterEntry();resetEclipse(activity,Math.floor(blasterAttempts(activity)/5)*2);snapshot();}
function updateBlaster(dt){
 if(activity.finished||blasterImages.some(i=>!i.complete))return;
 let resumed=false;
 if(activity.spotAnimating){if(++activity.spotFrame>=D.blaster.tracks[37].n-1){activity.spotFrame=D.blaster.tracks[37].n-1;activity.spotAnimating=false;}}
 if(activity.failure){
  if(O.Blaster.failureStep(activity.failure)){
   activity.planetFailureFrame=activity.failure.frame;activity.failure=null;if(activity.retake)activity.retake.index++;else{activity.attempts++;state.stats.attempts++;}
   if(activity.health<0){gameOver();return;}
   advanceBlasterProblem();if(state.modal)return;if(state.scene==='bonus'){updateBonus(dt,true);return;}if(state.scene!=='blaster')return;resumed=true;
  }else{updateHazards(dt);return;}
 }
 if(!activity.eclipse)resetEclipse(activity,Math.floor(blasterAttempts(activity)/5)*2);
 if(!resumed&&activity.wait<=0&&advanceEclipse(activity)){
  if(O.Blaster.capturing({x:activity.player.x,y:activity.player.y+78},D.blaster)){activity.eclipse.frame=45;activity.eclipse.left=1;}
  else{finishBlasterProblem(false,true);updateHazards(dt);return;}
 }
 const p=activity.player,which=O.Blaster.answer({x:p.x,y:p.y+78},D.blaster);
 if(which>=0&&activity.wait<=0){sound(8297);finishBlasterProblem(M.equal(M.parseAnswer(activity.choices[which]),activity.question.answer));if(['blaster','bonus'].includes(state.scene)&&!state.modal)updateHazards(dt);return;}
 const frameSounds=[],motion=movement(p,dt,undefined,frameSounds);activity.thrust=motion.thrust;
 if(state.scene!=='blaster')return;
 updateHazards(dt);
 for(const cue of frameSounds)cue.emit();
 activity.status=`Phase ${Math.floor(activity.attempts/5)+1} · ${activity.attempts} of ${activity.target}`;
}
function overlaps(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
function updateHazards(dt){
 activity.trash=(activity.trash||[]).filter(t=>!t.laser);
 O.Blaster.hazards(activity,D.trash,D.weapon,sound,stopSound);
}
function spawnBonusGem(){
 const used=new Set(activity.gems.map(g=>g.slot)),slot=activity.gemSlots.find(slot=>!used.has(slot));if(slot===undefined)return true;
 const gem=O.Blaster.gemCandidate(slot,D.blaster,D.trash.spawn,M.int(Math.random,0,32767),M.int(Math.random,0,32767));
 if(activity.gems.some(g=>overlaps(gem,g)))return false;
 activity.gems.push(gem);return true;
}
function startBonus(){
 const previousActivity=activity,phase=Math.floor(blasterAttempts(previousActivity)/5)*2-1;
 // A bonus is a phase of the same activity: held controls, flying trash,
 // weapon animation and the current sound continue across the boundary.
 state.scene='bonus';activity={previous:previousActivity,player:previousActivity.player,gems:[],gemSlots:O.Blaster.gemSlots(phase),gemTicks:33,labels:[],left:0,spawn:previousActivity.spawn,trash:previousActivity.trash,trashUses:previousActivity.trashUses,motionLevel:previousActivity.motionLevel,motionStats:previousActivity.motionStats,weapon:previousActivity.weapon,spotFrame:previousActivity.spotFrame,spotAnimating:previousActivity.spotAnimating,collected:0};
 resetEclipse(activity,phase);activity.left=activity.eclipse.period*45*.06;beginBlasterEntry();for(let i=0;i<3;i++)spawnBonusGem();clearUI();setHint('Bonus Round! Use ← → to steer and hold Spacebar for thrust. Collect gems.');
}
function updateBonus(dt,resumed=false){
 if(blasterImages.some(i=>!i.complete))return;
 if(!resumed){
  if(activity.spotAnimating&&++activity.spotFrame>=D.blaster.tracks[37].n-1){activity.spotFrame=D.blaster.tracks[37].n-1;activity.spotAnimating=false;}
  activity.labels=activity.labels.filter(label=>--label.ticks>0);
 }
 if(!resumed&&advanceEclipse(activity)){
  const a=activity.previous;for(const key of ['player','trash','trashUses','spawn','motionLevel','motionStats','weapon','spotFrame','spotAnimating'])a[key]=activity[key];state.scene='blaster';activity=a;if(!state.mission)a.health=10;newBlasterQuestion();mountActivity();const frames=[];movement(activity.player,dt,undefined,frames);updateHazards(dt);for(const cue of frames)cue.emit();return;
 }
 activity.left=((45-activity.eclipse.frame-1)*activity.eclipse.period+activity.eclipse.left)*.06;
 // 1:0f52 calls gem collection before moving Blasternaut this tick.
 const box=O.Blaster.heroBounds({...activity.player,y:activity.player.y+58},D.blaster,D.flight);
 if(![0,1].includes(activity.player.flight?.state))for(const slot of activity.gemSlots){const g=activity.gems.find(g=>g.slot===slot);if(g&&overlaps(box,g)){
  g.alive=false;activity.collected++;awardFlightPoints(g.points);activity.labels=activity.labels.filter(label=>label.slot!==g.slot);activity.labels.push({slot:g.slot,left:g.left,top:g.top,points:g.points,ticks:50});sound(8299);
 }}
 activity.gems=activity.gems.filter(g=>g.alive);
 if(activity.gemTicks>0&&--activity.gemTicks===0)activity.gemTicks=spawnBonusGem()?33:1;
 const frames=[];movement(activity.player,dt,undefined,frames);updateHazards(dt);for(const cue of frames)cue.emit();
}
function showZapperScoreboard(){
 const a=activity,now=new Date(),percentage=a.attempts?Math.trunc((a.correct*100+Math.trunc(a.attempts/2))/a.attempts):0,retake=(a.missed||[]).some(q=>!q.solved);
 a.finished=true;clearUI();
 nativeDialog(155,{138:player,136:now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}),142:now.toLocaleTimeString('en-US'),141:M.subjects[settings.subject],137:`Level ${settings.level}`,140:String(a.attempts),135:String(a.correct),139:percentage+'%',134:String(a.collected)},{
  158:()=>{record('zapper');dismiss();showTitle();},159:()=>replayActivity('zapper',percentage),161:()=>window.print(),162:()=>{if(!retake)return;dismiss();a.finished=false;a.retake={queue:a.missed.map((q,i)=>q.solved?-1:i).filter(i=>i>=0),index:0};a.batches=0;a.round=0;a.roundQuestions=0;a.earned=0;endCollection();a.round=0;mountActivity();}
 },{focus:retake?162:159,disabled:retake?[]:[162],cancel:()=>{record('zapper');dismiss();showTitle();}});
}
function showBlasterScoreboard(){
 const a=activity,now=new Date(),percentage=a.attempts?Math.trunc((a.correct*100+Math.trunc(a.attempts/2))/a.attempts):0,retake=(a.missed||[]).some(q=>!q.solved);
 a.finished=true;a.playerHidden=true;stopSound(8236);
 nativeDialog(150,{138:player,136:now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}),142:now.toLocaleTimeString('en-US'),141:M.subjects[settings.subject],137:`Level ${settings.level}`,140:String(a.attempts),135:String(a.correct),139:percentage+'%'},{
  158:()=>{record('blaster');dismiss();showTitle();},159:()=>replayActivity('blaster',percentage),161:()=>window.print(),162:()=>{if(!retake)return;dismiss();a.finished=false;a.playerHidden=false;a.retake={queue:a.missed.map((q,i)=>q.solved?-1:i).filter(i=>i>=0),index:0};a.health=10;a.failure=null;newBlasterQuestion();mountActivity();}
 },{focus:retake?162:159,disabled:retake?[]:[162],cancel:()=>{record('blaster');dismiss();showTitle();}});
}
function showPlatformScoreboard(scene){
 const a=activity,now=new Date(),percentage=a.attempts?Math.trunc((a.correct*100+Math.trunc(a.attempts/2))/a.attempts):0;
 stopSound(8236);
 nativeDialog(scene==='cave'?156:151,{138:player,136:now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}),142:now.toLocaleTimeString('en-US'),141:M.subjects[settings.subject],137:`Level ${settings.level}`,140:String(a.attempts),135:String(a.correct),139:percentage+'%'},{
  158:()=>{record(scene);dismiss();showTitle();},159:()=>replayActivity(scene,percentage),161:()=>window.print()
 },{focus:159,cancel:()=>{record(scene);dismiss();showTitle();}});
}
function completeActivity(){snapshot();const scene=state.scene==='bonus'?'blaster':state.scene;const next={zapper:'recycler',recycler:'cave',cave:'blaster',blaster:'rescue'}[scene];if(!next)return;
 if(!state.mission&&scene==='zapper'){showZapperScoreboard();return;}
 if(!state.mission&&scene==='blaster'){showBlasterScoreboard();return;}
 if(!state.mission&&['cave','recycler'].includes(scene)){showPlatformScoreboard(scene);return;}
 if(!state.mission){const score=state.score;record(scene);dialog('Activity complete!',`<p>Great work, ${esc(player||'Blasternaut')}!</p><p>Score: <strong>${score.toLocaleString()}</strong></p>`,[['Play again',()=>{dismiss();practice(scene);} ],['Choose another activity',()=>{dismiss();showTitle();}]]);return;}
 if(next==='rescue'){startRescue();return;}
 if(next==='recycler'){startActivity('recycler',true);return;}
 if(next==='cave'&&settings.transitions)playMovies(['fuel','landing'],()=>startActivity(next,true));else startActivity(next,true);
}
function startRescue(){saved=null;save();if(settings.transitions)playMovies(['rescueFlight','congratulations'],()=>finishMission(true));else finishMission(true);}
function record(scene='mission'){const accuracy=state.stats.attempts?Math.round(state.stats.correct/state.stats.attempts*100):100,now=new Date();records.unshift({player:player||'Blasternaut',score:state.score,activity:scene,date:now.toLocaleDateString(),accuracy,subject:M.subjects[settings.subject],level:settings.level});records=records.slice(0,50);
 if(scene==='mission'){let profile=personalBests.find(p=>p.player===player);if(!profile){profile={player,entries:[]};personalBests.push(profile);}profile.entries=M.insertPersonalBest(profile.entries,{score:state.score,date:now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})});}save();}
function finishMission(success){
 // 4:580a–5917: both outcomes enter Personal Best. Only a rescue enters
 // certificate146; neither outcome offers an activity-only retry.
 if(state.missionFinished)return;
 state.missionFinished=true;saved=null;record();stopAudio();movieNext=null;
 showPersonalBest(success?certificate:showTitle);
}
function certificate(){
 changeScene('certificate');activity={date:new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})};
 $('viewport').classList.add('print-certificate');setHint('');
 const close=()=>{dismiss();showTitle();};
 nativeDialog(146,{},{160:()=>window.print(),2:close},{focus:160,cancel:close,bottom:true,label:'Mission Certificate'});
}
function help(){const how={
 title:'Choose In Search of Spot from the Activity menu for the complete rescue story. The Activity menu lets you practice any of the four games. Subject and Level choose the arithmetic.',
 movie:'Press a key or click to continue the animation or the paused mission briefing.',
 briefing:'Collect the trash, turn it into fuel, track down the Trash Alien, and rescue Spot.',
 zapper:'Type the missing number and press Enter. Five correct answers give you five tractor beams. Then click floating trash to collect it. Each click uses one beam. When the beams run out, solve more problems. Collect 15 pieces in a short mission or 25 in a long mission.',
 recycler:'Select a column, then click again to push its numbers or symbols down. Form a true equation in the red Equation Window and press Enter or click OK. Numbers pushed into the row below wait to be recycled to the top when an equation is accepted. The bottom row is the Zap Chamber: its contents are removed. Five equations fill one fuel chamber. Left/right select, down pushes, and up or Undo reverses the last push. Reset same/new restarts the current round and keeps completed chambers.',
 cave:'Use left/right arrows to steer and hold Spacebar to thrust. Release Spacebar to fall. The number on Blasternaut must be strictly between the two numbers on either side of a gap. For a gap marked 3 and 9, a number from 4 through 8 works. Catch blue drops to add or subtract from your number. Gems earn bonus points. Higher difficulty adds obstacles; approach a treasure chest and answer its question to earn a tool.',
 blaster:'Read the problem on the alien ship. Steer with left/right arrows and hold Spacebar to thrust into the porthole showing the correct answer. Avoid flying trash and energy blasts. Every five problems starts a gem-collecting bonus round. Complete the activity to rescue Spot.',
 bonus:'Steer with left/right arrows, hold Spacebar to thrust, and collect as many gems as you can before time runs out.',certificate:'You rescued Spot! Print your certificate or return to the title to start another mission.',rescue:'Spot is safe! Your mission certificate is next.'};dialog('Help',`<p>${how[state.scene]||how.title}</p><p>Use Options to turn sound and transitions on or off.</p>`);}
function tip(){if(state.scene==='zapper'||state.scene==='blaster')return showMathTip();if(state.scene==='recycler'){if(activity.started)return dialog('Math Tips',`<p>${esc(R.strings[40219])}</p>`);activity.tips=true;return;}if(state.scene==='cave'){const g=C.dropTarget(activity);if(g)message(activity.section===0?R.strings[40270]:R.strings[40275].replace('%d',Math.min(g.a,g.b)).replace('%d',Math.max(g.a,g.b)),Math.trunc(4000/60)*.06);return;}help();}
function showPersonalBest(after=null){
 const profile=personalBests.find(p=>p.player===player),values={},scoreIds=[124,126,127,128,129,130,131,132,133,125],dateIds=[101,103,104,105,106,107,108,109,110,102];
 for(let i=0;i<10;i++){const entry=profile?.entries[i];values[scoreIds[i]]=entry?.score?String(entry.score):'';values[dateIds[i]]=entry?.score?entry.date:'';}
 const close=()=>{dismiss();after?.();};
 nativeDialog({...D.dialogs[153],title:'Personal Best for '+player},values,{1:close},{focus:1,cancel:close,owner:'main'});
}
function showAbout(){const controls=nativeDialog(145,{},{1:dismiss},{focus:1,cancel:dismiss,owner:'main'});controls.box.style.top=(parseInt(controls.box.style.top,10)-1)+'px';}
function showMathTip(){
 const q=activity?.question;if(!q)return;
 const data=M.mathTip(q),t={...data,question:q,active:false,phase:0,countdown:1,number:-1,direction:1,clock:0},font=D.systemFont;
 const start=()=>{if(t.active)return;Object.assign(t,{active:true,phase:0,countdown:1,number:-1,direction:1});t.paint();};
 const controls=nativeDialog(data.numberLine?152:149,{},{1:dismiss,163:start},{label:'Math Tips',focus:1,cancel:dismiss,bottom:true});state.nativeTip=t;
 const holder=controls.get(123),portrait=controls.get(165),height=data.numberLine?59:91;
 holder.className='native-tip-surface';holder.replaceChildren();holder.tabIndex=-1;holder.setAttribute('aria-label',q.display);
 portrait.className='native-tip-portrait';portrait.replaceChildren();Object.assign(portrait.style,{left:'0px',top:'71px',width:'96px',height:'80px'});portrait.tabIndex=-1;portrait.onclick=start;portrait.setAttribute('aria-label','Show Me');
 element('img',{src:'assets/MB4DLL_1097.png',alt:''},0,0,96,80,portrait);
 const panel=element('canvas',{width:490,height},0,0,490,height,holder),dc=panel.getContext('2d'),parts=[];
 let at=0;const template=R.strings[data.id];
 for(const m of template.matchAll(/([!|])(s?)(\d)/g)){
  if(m.index>at)parts.push({text:template.slice(at,m.index)});
  parts.push({text:String(m[2]?data.strings[+m[3]]:data.values[+m[3]]),blank:m[1]==='|'});at=m.index+m[0].length;
 }
 if(at<template.length)parts.push({text:template.slice(at)});
 const rows=[[]];for(const part of parts){const lines=part.text.split('\n');for(let i=0;i<lines.length;i++){if(i)rows.push([]);if(!lines[i])continue;const row=rows.at(-1),last=row.at(-1);if(last&&!last.blank&&!part.blank)last.text+=lines[i];else row.push({text:lines[i],blank:part.blank});}}
 const widths=rows.map(row=>{const text=row.map(p=>p.text).join(''),at=text.indexOf('=');return {full:bitmapWidth(text,font),left:at<0?0:bitmapWidth(text.slice(0,at),font),right:at<0?0:bitmapWidth(text.slice(at),font)};});
 const maxLeft=Math.max(...widths.map(w=>w.left)),maxRight=Math.max(...widths.map(w=>w.right)),equals=Math.trunc((490-maxLeft-maxRight)/2)+maxLeft;
 const put=(text,x,y,color='#000')=>bitmapText(text,x+Math.trunc(bitmapWidth(text,font)/2),y,color,font,false,dc);
 t.paint=()=>{
  dc.clearRect(0,0,490,height);
  if(t.numberLine){
   const line=Array.from({length:26},(_,i)=>String(i).padStart(3,' ')).join(''),x=Math.trunc((490-bitmapWidth(line,font))/2),prefix=line.slice(0,3*(t.number+1));
   if(prefix){dc.fillStyle='#0ff';dc.fillRect(x,0,bitmapWidth(prefix,font),font.height);}
   put(line,x,0);
  }else if(q.subject===3){
   // 5:7cdc: interval endpoints, midpoint, and the original rounded
   // MulDiv placement of the number on the scale.
   const lower=Math.trunc(q.a/q.b)*q.b,upper=lower+q.b,mid=lower+Math.trunc(q.b/2),left=98,right=392,top=30,half=Math.trunc(font.height/2),at=left+Math.floor(((right-left)*(q.a-lower)+Math.trunc(q.b/2))/q.b),color=t.active?'#00f':'#000';
   dc.fillStyle='#000';dc.fillRect(left,top+half,right-left,1);for(const x of [left,245,right])dc.fillRect(x,top,1,half+1);dc.fillRect(at,top+half,1,half);
   bitmapText(lower,left,top-2*half,lower===q.result?color:'#000',font,false,dc);bitmapText(mid,245,top-2*half,'#000',font,false,dc);bitmapText(upper,right,top-2*half,upper===q.result?color:'#000',font,false,dc);bitmapText(q.a,at,top+2*half,color,font,false,dc);
  }else{
   const step=Math.trunc(height/(rows.length+1));
   rows.forEach((row,i)=>{let x=widths[i].left?equals-widths[i].left:Math.trunc((490-widths[i].full)/2);const y=step*(i+1)-font.height;
    for(const p of row){const text=p.blank&&!t.active?'_'.repeat(p.text.length):p.text;put(text,x,y,p.blank?'#00f':'#000');x+=bitmapWidth(text,font);}
   });
  }
  if(t.active)problemText(q.solution,245-Math.trunc(bitmapWidth(q.solution,font)/2),height-font.height,'#000',font,dc);
  else{const layout=problemLayout(q,font,245,height-font.height,'horizontal');paintProblem(layout,q,'','#000',font,dc,2);}
 };
 t.paint();
}
function changeSetting(key,value){
 if(settings[key]===value)return;settings[key]=value;save();buildMenus();updateStatus();if(!['subject','level'].includes(key))return;
 if(state.scene==='cave'){
  // 4:6534 / c7b5: practice restarts its cave when Subject or Level
  // changes. A mission keeps the current screen, tools and score.
  const a=activity;if(key==='subject'){a.subject=value;a.problemSubject=C.caveSubject(value);}else a.level=value;
  M.resetQuestions();
  if(!state.mission){stopAudio();state.score=0;state.stats={correct:0,attempts:0};Object.assign(a,{section:0,passed:0,correct:0,attempts:0,tools:[]});a.player.x=111;C.makeScreen(a,D.cave,caveProblem,Math.random,M.resetQuestions);flightClock=0;}
  snapshot();updateStatus();return;
 }
 if(state.scene==='zapper'){M.resetQuestions();startActivity('zapper',state.mission);}else if(state.scene==='recycler'&&!activity.started){newRecyclerGrid();mountActivity();}else if(['recycler','blaster'].includes(state.scene))message('Subject and Level changes take effect at the next activity or round.');
}
// The original continues activity and cutscene timers inside the Windows menu loop.
function closeMenus(){document.querySelectorAll('.dropdown.open').forEach(e=>e.classList.remove('open'));document.querySelectorAll('.menu [aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'));state.menu=false;}
function buildMenus(){const menus=[
 ['File',[['&New Game',newGame],['New &Student...',()=>signin()],null,['&Goal Setter...',showGoalSetter],null,['&Personal Best...',()=>showPersonalBest()]]],
 ['Activity',[['&In Search of Spot',[['&Long Mission',()=>startMission('long')],['&Short Mission',()=>startMission('short')]]],null,['&Trash Zapper',()=>practice('zapper')],['&Number Recycler',()=>practice('recycler')],['&Cave Runner',()=>practice('cave')],['&Math Blaster',()=>practice('blaster')]]],
 ['Options',[
  ['&Sound',()=>{settings.sound=!settings.sound;refreshSound();},{checked:settings.sound}],['&Transitions',()=>changeSetting('transitions',!settings.transitions),{checked:settings.transitions}],null,
  ['Sol&ve Problems',[['&Right to left',()=>changeSetting('direction','right-to-left'),{checked:settings.direction==='right-to-left'}],['&Left to right',()=>changeSetting('direction','left-to-right'),{checked:settings.direction!=='right-to-left'}]]],
  ['&Problem Format',['horizontal','vertical','mixed'].map(v=>['&'+v[0].toUpperCase()+v.slice(1),()=>changeSetting('format',v),{checked:settings.format===v}])],
  ['Problem &Order',[['&Random',()=>changeSetting('order','random'),{checked:settings.order!=='file'}],['&File',()=>changeSetting('order','file'),{checked:settings.order==='file'}]]],
  ['&Missing Number Position',[['&Result',()=>changeSetting('missing','result'),{checked:settings.missing==='result'}],['&Operand',()=>changeSetting('missing','operand'),{checked:settings.missing==='operand'}],['&Mixed',()=>changeSetting('missing','either'),{checked:settings.missing==='either'}]]],null,
  ['&Undo',undoRecycler,{disabled:()=>state.scene!=='recycler'||!activity?.history?.length}],['&Reset Same Game',()=>resetRecycler(true),{disabled:()=>state.scene!=='recycler'}],['Reset &New Game',()=>resetRecycler(false),{disabled:()=>state.scene!=='recycler'}]
 ]],
 ['Subject',[2,0,1,3,4,5,6,7].map(i=>['&'+M.subjects[i],()=>changeSetting('subject',i),{checked:settings.subject===i}])],
 ['Level',Array.from({length:6},(_,i)=>['Level &'+(i+1),()=>changeSetting('level',i+1),{checked:settings.level===i+1}])],
 ['Help',[['&Help',help],null,['&Show Me',showRecyclerDemo,{disabled:()=>state.scene!=='recycler'}],['&Math Tips...',tip,{disabled:()=>!['zapper','recycler','blaster'].includes(state.scene)}],null,['&About...',showAbout]]]
 ];const bar=$('menubar'),roots=[];bar.replaceChildren();
 function makeDrop(items,owner,rootIndex,parentDrop=null){
  const drop=document.createElement('div');drop.className='dropdown';const entries=[];
  function hideChildren(){for(const e of entries)if(e.child){e.child.classList.remove('open');e.button.setAttribute('aria-expanded','false');}}
  function focusNext(button,delta){const enabled=entries.filter(e=>!e.button.disabled),index=enabled.findIndex(e=>e.button===button);enabled[(index+delta+enabled.length)%enabled.length]?.button.focus();}
  for(const item of items){if(!item){drop.append(document.createElement('hr'));continue;}
   const [label,action,flags={}]=item,b=document.createElement('button'),plain=label.replaceAll('&',''),entry={button:b,key:label.match(/&(.)/)?.[1].toLowerCase()};
   b.setAttribute('aria-label',plain);b.innerHTML=esc(label).replace(/&amp;(.)/,'<u>$1</u>');entry.refresh=()=>b.disabled=typeof flags.disabled==='function'?!!flags.disabled():!!flags.disabled;entry.refresh();b.className=flags.checked?'checked':'';entries.push(entry);
   if(Array.isArray(action)){
    const branch=document.createElement('div');branch.className='menu-branch';b.classList.add('submenu-button');b.setAttribute('aria-haspopup','true');b.setAttribute('aria-expanded','false');const child=makeDrop(action,b,rootIndex,drop);entry.child=child;
    entry.open=()=>{hideChildren();child.classList.add('open');b.setAttribute('aria-expanded','true');};b.onclick=()=>{entry.open();child.firstEntry?.focus();};branch.append(b,child);drop.append(branch);
   }else{b.onclick=()=>{closeMenus();action();};drop.append(b);}
   b.onpointerenter=()=>{hideChildren();b.focus();if(entry.open)entry.open();};
   b.onkeydown=e=>{let handled=true;
    if(e.key==='ArrowDown'||e.key==='ArrowUp')focusNext(b,e.key==='ArrowDown'?1:-1);
    else if(e.key==='ArrowRight'){if(entry.open){entry.open();entry.child.firstEntry?.focus();}else roots[(rootIndex+1)%roots.length]?.open();}
    else if(e.key==='ArrowLeft'){if(parentDrop){drop.classList.remove('open');owner.setAttribute('aria-expanded','false');owner.focus();}else roots[(rootIndex+roots.length-1)%roots.length]?.open();}
    else if(e.key==='Escape'&&parentDrop){drop.classList.remove('open');owner.setAttribute('aria-expanded','false');owner.focus();}
    else if(e.key==='Enter'||e.key===' '){if(!b.disabled)b.onclick();}
    else{const match=entries.find(x=>x.key===e.key.toLowerCase()&&!x.button.disabled);if(match)match.button.onclick();else handled=false;}
    if(handled){e.preventDefault();e.stopPropagation();}
   };
  }
  drop.refreshAvailability=()=>{for(const entry of entries){entry.refresh();entry.child?.refreshAvailability();}drop.firstEntry=entries.find(e=>!e.button.disabled)?.button;};drop.refreshAvailability();return drop;
 }
 for(const [index,[name,items]]of menus.entries()){
  const holder=document.createElement('div');holder.className='menu';const toggle=document.createElement('button');toggle.setAttribute('aria-label',name);toggle.innerHTML='<u>'+esc(name[0])+'</u>'+esc(name.slice(1));toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-haspopup','true');const drop=makeDrop(items,toggle,index);
  const open=()=>{closeMenus();drop.refreshAvailability();drop.classList.add('open');toggle.setAttribute('aria-expanded','true');state.menu=true;keys.clear();pointer.down=false;drop.firstEntry?.focus();};roots.push({open});
  toggle.onclick=e=>{e.stopPropagation();const was=drop.classList.contains('open');if(was)closeMenus();else open();};holder.append(toggle,drop);bar.append(holder);
 }
}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.();else $('app').requestFullscreen?.();}
function drawTitle(){draw('MB4DLL3_1441',0,-20);draw('MB4DLL3_1395',200,308);}
function drawMovie(){
 // Original cutscenes retain native pixels: the zone starts 20 pixels above
 // the visible viewport. Scaling to 428/440 compressed every vertical motion.
 if(!movie)return;ctx.save();ctx.translate(0,-20);
 const scene=movie.scene;
 for(const z of scene.zones){ctx.save();ctx.beginPath();ctx.rect(z[1],z[2],z[3]-z[1],z[4]-z[2]);ctx.clip();draw(D.bitmaps[z[0]].hi,0,0);ctx.restore();}
 for(const {track,frame} of movie.sprites()){
  const z=scene.zones[track.zone],b=D.bitmaps[frame[0]];ctx.save();
  if(z){ctx.beginPath();ctx.rect(z[1],z[2],z[3]-z[1],z[4]-z[2]);ctx.clip();}
  draw(b.variants?.[track.mask]||b.hi,frame[1],frame[2]);ctx.restore();
 }
 ctx.restore();canvas.dataset.movie=activity.movie;canvas.dataset.movieFrame=String(movie.frame);
}
function drawZapper(){
 if(zapperImages.some(i=>!i.complete))return;
 const a=activity,data=D.zapper;
 function sprite(index,frame=0,x=null,y=null){const t=data.tracks[index],f=t.frames[frame],b=D.bitmaps[f[0]];if(b)draw(b.variants?.[t.mask]||b.hi,x??f[1],(y??f[2])-34);}
 draw('MB4DLL_1788',0,-34);
 for(const t of a.trash){if(!t.alive)continue;const s=Z.sprite(t,data),b=D.bitmaps[s.frame[0]];draw(b.variants?.[s.track.mask]||b.hi,s.x,s.y-34);}
 if(a.mode==='opening')sprite(79,a.panelFrame);
 if(a.mode==='solve'){
  sprite(79,data.tracks[79].n-1);
  const q=a.question,l=a.questionLayout;
  if(l)paintProblem(l,q,$('answer')?.value??a.input,'#fff',{...D.fonts[20],overhang:1});
  const instructionTop=l?.instructionTop??111;
  if(a.revealed){bitmapText(R.strings[40262].replace('%s',q.answerText),320,instructionTop,'#ffff00',D.fonts[13]);bitmapText(R.strings[40264],320,instructionTop+19,'#ffff00',D.fonts[13]);}
  else{bitmapText(q.instruction,320,instructionTop,'#ffff00',D.fonts[13]);if(q.kind==='estimate')bitmapText(R.strings[40121],320,instructionTop+19,'#ffff00',D.fonts[13]);}
 }
 sprite(78);sprite(77,Math.min(5,a.beams));
 for(const t of a.trash)if(t.iconVisible){const slot=data.tracks[81].frames[t.collectedIndex];if(slot)sprite(t.icon,0,slot[1],slot[2]);}
 if(a.beam){const b=a.beam;ctx.save();ctx.globalCompositeOperation='difference';ctx.fillStyle='#fff';for(const [x,y]of Z.beamStarts(b.x,b.y))pixelLine(x,y,b.x,b.y);ctx.restore();sprite(75);}
 const aiming=a.mode==='collect'&&Z.aimable(a.aim.x,a.aim.y);canvas.style.cursor=aiming?'none':'default';
 if(aiming){
  // The source uses a white cross cursor; the console's radar blip has its
  // own original sprite and mapping, independent of the system cursor.
  const aim=a.aim,cursor=data.cursor;ctx.fillStyle='#fff';
  for(let y=0;y<cursor.height;y++)for(let x=0;x<cursor.width;x++)if(cursor.rows[y][x]===1)ctx.fillRect(Math.trunc(aim.x)+x-cursor.hotspot[0],Math.trunc(aim.y)+y-cursor.hotspot[1],1,1);
  const geo=data.tracks[80].frames,from=geo[1],to=geo[2];
  sprite(76,0,to[1]+Math.round((aim.x-from[1])*(to[3]-to[1])/(from[3]-from[1])),to[2]+Math.round((aim.y+34-from[2])*(to[4]-to[2])/(from[4]-from[2])));
 }
 if(a.bonusTicks>0)bitmapText(R.strings?.[40263]||'1000 Bonus Points!',320,66,'#ffff00',D.fonts[20]);
}
function drawRecycler(){
 if(recyclerImages.some(i=>!i.complete))return;
 ctx.save();ctx.translate(0,-34);draw('MB4DLL_1908',0,0);
 const tracks=D.recycler.tracks;
 function sprite(index,frame=0,dx=0,dy=0){const t=tracks[index],f=t.frames[Math.min(t.n-1,frame)],b=D.bitmaps[f[0]];ctx.save();if(t.zone===1){ctx.beginPath();ctx.rect(190,20,261,141);ctx.clip();}if(b)draw(b.variants?.[t.mask]||b.hi,f[1]+dx,f[2]+dy);ctx.restore();}
 const motion=activity.motion;
 sprite(4);sprite(9,motion&&['drop','plunge'].includes(motion.phase)?3:0);sprite(10,activity.canFrame||0);sprite(13);sprite(15);sprite(6+(activity.target===25),motion?.fuel??activity.fuel);
 for(const t of activity.hopper||[])if(t.alive){const f=tracks[t.track].frames[0];sprite(t.track,0,514+Math.trunc((47-t.width)/2)-f[1],22+t.y-f[2]);}sprite(14);
 const tokens=motion?.visual||activity.positions.flatMap((p,c)=>p.map((row,i)=>({c,i,row,visible:row>=0,x:221+c*50,y:D.recycler.rows[row]?.[2]})));
 for(const token of tokens){
  const {c,i,row}=token;if(!token.visible)continue;
  const v=activity.columns[c][i],slide=activity.slide;let yy=token.y,xx=token.x;
  if(slide&&slide.before[c][i]>=0){const oldY=D.recycler.rows[slide.before[c][i]][2];yy=oldY+(yy-oldY)*Math.min(1,slide.elapsed/slide.duration);}
  ctx.save();ctx.beginPath();ctx.rect(193,180,250,242);ctx.clip();
  const color=activity.tips?D.recycler.colors[activity.colors?.[c]?.[i]||0]:'#000';
  bitmapText(typeof v==='number'?M.fmt(v):v,xx,yy,color,D.recycler.font);ctx.restore();
 }
 sprite(8);
 for(let i=0;i<5;i++)sprite(5,8,i*50);
 const entering=(activity.animations||[]).some(a=>a.track===11||a.track===12);
 if(!entering&&!(activity.animations||[]).some(a=>a.track===3)){
  if(activity.walk)sprite(activity.walk.track,activity.walk.frame,activity.walk.displayDx??activity.walk.dx);
  else sprite(2,0,(activity.selected-2)*50);
 }
 for(const a of activity.animations||[])if(a.frame>=0)sprite(a.track,a.frame,a.dx);
 ctx.restore();
}
function drawCave(){
 if(caveImages.some(i=>!i.complete))return;
 // Original 640×480 reference: the game viewport starts at y=37, while
 // descriptor coordinates are painted at y+2. The model already subtracts
 // 20, leaving a further -15 pixels of presentation offset. Measured against
 // the background and platform labels; physics stays in descriptor space.
 ctx.save();ctx.translate(0,-15);
 const a=activity,tracks=D.cave.tracks,paint=[];
 // WANIM1:05ae sorts attached actors by ascending priority, preserving
 // attachment order at equal priorities;1:0bc0 paints that order. The
 // descriptor priority also puts droplets/impact flashes in front of the hero.
 function sprite(index,frame=0,dx=0,dy=-20,label=null){const t=tracks[index],f=t.frames[frame],b=D.bitmaps[f[0]];paint.push({z:t.z,index,draw(){draw(b.variants?.[t.mask]||b.hi,f[1]+dx,f[2]+dy);label?.();}});}
 const bg=tracks[158].frames[a.section*2%5],bitmap=D.bitmaps[bg[0]];draw(bitmap.hi,0,-20);
 for(const r of [...a.rows,a.floorRow])for(const c of r.cells){
  if(!c.kind)continue;sprite(c.track,0,c.dx,c.dy,()=>{if(c.label){const f=tracks[c.track].frames[0];caveText(c.label.text,c.x+29,f[2]+c.dy+3);}});
 }
 if(a.section===0)sprite(8);
 if(a.section===a.sections-2)sprite(9);
 if(a.finalSection)sprite(39);
 if(a.chest)sprite(37,0,a.chest.x-450,a.chest.y-389);
 for(const g of a.gems)sprite(38,0,g.x-301,g.y-205);
 for(const s of C.obstacleSprites(a,D.cave))sprite(s.track,s.frame,s.dx,s.dy);
 if(a.laser){const l=a.laser,f=tracks[l.track].frames[0];sprite(l.track,l.frame,l.x-f[1],l.y-f[2]);}
 if(a.laserFlash){const f=a.laserFlash;sprite(0,f.frame,f.dx,f.dy);}
 for(const d of a.drops){const b=C.dropSprite(d,D.cave),bitmap=D.bitmaps[b.frame[0]];paint.push({z:b.track.z,index:tracks.indexOf(b.track),draw(){draw(bitmap.variants?.[b.track.mask]||bitmap.hi,b.left,b.top);
  if(d.phase==='hang'||d.phase==='fall')caveText(`${d.op}${d.value}`,(b.left+b.right)/2,b.top+Math.trunc((b.bottom-b.top-D.cave.font.height)*2/3));}});
 }
 for(const e of a.effects)sprite(40,e.frame,e.dx,e.dy);
 if(a.guide){const g=a.guide,f=tracks[g.track].frames[0];sprite(g.track,0,g.x-f[1],g.y-f[4]);}
 else {const t=D.flight.cave[a.player.flight?.state??4].track;paint.push({z:t.z,index:tracks.indexOf(t),draw(){drawHero(a.player,0,a.thrust,true);}});}
 // 4:a510/bd80/bf0d and 1:1127: transparent yellow, bold 20-pixel
 // text at descriptor center (320,200), displayed for 3000/60 ticks.
 // 4:beb7 creates the separate text actor with priority25.
 if(a.gemBonusTicks>0)paint.push({z:25,index:-1,draw(){bitmapText(R.strings[40267],320,180,'#ffff00',{...D.fonts[20],overhang:1});}});
 paint.sort((a,b)=>a.z-b.z||a.index-b.index);for(const actor of paint)actor.draw();
 ctx.restore();
}
function drawHero(p,cam=0,thrust=false,number=false){
 if(activity.hitUntil>state.time&&Math.floor(state.time*10)%2===0)return;
 const kind=heroKind(),f=O.flightFrame(p,D.flight,kind),s=D.flight[kind][p.flight?.state??4],b=D.bitmaps[f[0]],box=heroBounds(p);
 draw(b.variants?.[s.track.mask]||b.hi,box.left,box.top-cam);
 // 1:11b3 uses " %d ": the two spaces and GDI overhang form the white
 // bib. ExtTextOut clips that text to the current actor's rectangle.
 if(number){const font={...D.cave.font,overhang:1};ctx.save();ctx.beginPath();ctx.rect(box.left,box.top-cam,box.width,box.height);ctx.clip();bitmapText(` ${activity.number} `,(box.left+box.right)/2,box.top-cam+Math.trunc((box.height-font.height)/2),'#f00',font,true);ctx.restore();}
}
function drawEclipse(){const f=D.eclipse.frames[Math.min(44,activity.eclipse?.frame??0)],b=D.bitmaps[f[0]];draw(b.variants?.[D.eclipse.mask]||b.hi,f[1],f[2]-20);}
function blasterSprite(i,frame=0){const t=D.blaster.tracks[i],f=t.frames[frame],b=D.bitmaps[f[0]];draw(b.variants?.[t.mask]||b.hi,f[1],f[2]-20);}
function drawBlasterStage(behindShip,beforeWeapon=null){const sprite=blasterSprite;
 // Original actor priorities: planet/gems10, trash50..64, hero100..114,
 // ship250, alien/weapon/Spot300. The ship masks the entering hero.
 draw('MB4DLL_1098',0,-20);if(activity.failure||activity.planetFailureFrame!=null)sprite(33,activity.failure?.frame??activity.planetFailureFrame);else drawEclipse();
 // WANIM1:05ae keeps attachment order for equal priorities. The static
 // alien and Spot exist before the first weapon actor is attached.
 behindShip();sprite(26);sprite(24);sprite(37,activity.spotFrame||0);beforeWeapon?.();drawWeapon();
}
function drawBlaster(){
 if(blasterImages.some(i=>!i.complete))return;
 const d=D.blaster;drawBlasterStage(()=>{drawFlyingTrash();if(!activity.failure&&!activity.playerHidden)drawHero(activity.player,0,activity.thrust);});
 const q=activity.question,font=d.font,r=d.question,[left,right='']=q.display.split('__'),blank='m'.repeat(q.answerText.length),width=bitmapWidth(left+blank+right,font),x=Math.trunc((r[1]+r[3])/2)-Math.trunc(width/2),y=r[2]-20;
 // 5:2500 measures the original 'm' placeholders, then draws each
 // underline at 1/8 of its cell width, two pixels above the box bottom.
 problemText(left,x,y,'#000',font);
 const bx=x+bitmapWidth(left,font),bw=bitmapWidth(blank,font),cell=Math.trunc(bw/blank.length),inset=Math.trunc(cell/8);
 for(let i=0;i<blank.length;i++)rect(bx+i*cell+inset,r[4]-22,cell-2*inset,1,'#000');
 problemText(right,bx+bw,y,'#000',font);
 activity.choices.forEach((v,i)=>{const r=d.answers[i],highlight=activity.failure?.highlight&&activity.failure.correct===i;
  if(highlight){rect(r[1],r[2]-20,r[3]-r[1],r[4]-r[2],'#000');const [l,h]=d.answerEdges[i];pixelTriangle([[l[1],l[2]-20],[r[1],r[2]-20],[r[1],r[4]-21]],'#000');pixelTriangle([[h[1],h[2]-20],[r[3],r[2]-20],[r[3],r[4]-21]],'#000');}
  bitmapText(v,Math.trunc((r[1]+r[3])/2),r[2]-20,highlight?'#fff':'#000',font);});
}
function pixelTriangle(points,color,target=ctx,lowerTie=false){
 const min=Math.min(...points.map(p=>p[1])),max=Math.max(...points.map(p=>p[1]));
 for(let y=min;y<=max;y++){const crossings=[];for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3];if(y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1])){if(a[1]===b[1])crossings.push(a[0],b[0]);else crossings.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}}if(crossings.length){const x=Math.ceil(Math.min(...crossings)),right=Math.ceil(Math.max(...crossings));target.fillStyle=color;target.fillRect(x,y,Math.max(0,right-x),1);}}
 // GDI Polygon draws both its fill and its same-color one-pixel pen.
 target.fillStyle=color;for(let i=0;i<3;i++)pixelLine(...points[i],...points[(i+1)%3],target,lowerTie);
}
function drawFlyingTrash(){
 for(const t of [...(activity.trash||[])].sort((a,b)=>a.type-b.type)){if(t.laser)continue;const f=O.trashFrame(t,D.trash),b=D.bitmaps[f[0]],box=O.trashBounds(t,D.trash);draw(b.variants?.[D.trash.blaster[t.type].mask]||b.hi,box.left,box.top);}
}
function drawWeapon(){
 const weapon=O.weaponSprite(activity.weapon,D.weapon);if(weapon){const b=D.bitmaps[weapon.frame[0]];draw(b.variants?.[weapon.track.mask]||b.hi,weapon.x+weapon.frame[1],weapon.y+weapon.frame[2]);}
}
function drawBonus(){
 const labelPaint=label=>{const font=D.blaster.font;bitmapText(label.points,label.left+Math.trunc(bitmapWidth(label.points,font)/2),label.top,'#ffff00',font);};
 if(blasterImages.some(i=>!i.complete))return;drawBlasterStage(()=>{
  for(const g of activity.gems){const t=D.blaster.tracks[g.track],b=D.bitmaps[t.frames[0][0]];draw(b.variants?.[t.mask]||b.hi,g.left,g.top);}
  drawFlyingTrash();drawHero(activity.player,0,activity.thrust);
 },()=>{for(const label of activity.labels.filter(l=>l.slot===0))labelPaint(label);});
 //4:5250 creates the five score-label actors at priorities300..304;
 //the first predates the weapon, while the other four paint above it.
 for(const label of activity.labels.filter(l=>l.slot>0).sort((a,b)=>a.slot-b.slot))labelPaint(label);
}
function drawRescue(){draw('MB4DLL_1098',0,-32);const t=state.sceneTime;if(t<2){draw('MB4DLL_2397',60,0);draw('MB4DLL_2480',85,25);}else {draw(art('MB4DLL2',2421+Math.floor(Math.min(13,(t-2)*2))),300,Math.min(230,(t-2)*35));draw(art('MB4DLL2',2482+Math.floor(state.time*5)%4),272,326);}text('Spot is safe!',320,220,28,'#ffff00','center','Times New Roman');}
function drawCertificate(){
 // 4:4b14/591c: the original bitmap, with name/date clipped to
 // descriptor rect182,162,443,270. The requested font height is108/5;
 // Windows selects the20-pixel MS Sans Serif strike and emboldens it.
 draw('MB4DLL_2834',0,-35);
 const font={...D.fonts[20],overhang:1};ctx.save();ctx.beginPath();ctx.rect(182,127,261,108);ctx.clip();
 bitmapText(player,312,148,'#000',font);bitmapText(activity.date,312,190,'#000',font);ctx.restore();
}
function render(){ctx.imageSmoothingEnabled=false;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);switch(state.scene){case'title':drawTitle();break;case'movie':drawMovie();break;case'zapper':drawZapper();break;case'recycler':drawRecycler();break;case'cave':drawCave();break;case'blaster':drawBlaster();break;case'bonus':drawBonus();break;case'rescue':drawRescue();break;case'certificate':drawCertificate();break;}
 if(state.feedback&&state.time<state.feedbackUntil&&['blaster','bonus'].includes(state.scene)){const size=state.feedback.length>70?11:13;ctx.font=`${size}px Arial`;const ww=Math.min(620,ctx.measureText(state.feedback).width+24);rect((W-ww)/2,2,ww,22,'#000c');text(state.feedback,320,13,size,'#ffff00');}
}
function tick(now){const dt=previous?Math.min(.25,Math.max(0,(now-previous)/1000)):0;previous=now;const paused=state.paused||state.focusPaused||state.modal||(document.hidden&&!nativeHost);
 if(mixer.active?.handle?.ended)mixer.finish(mixer.active);
 if(state.nativeTip&&!state.focusPaused&&!state.paused&&!(document.hidden&&!nativeHost)){const t=state.nativeTip;t.clock+=dt;while(t.clock+1e-9>=.06){t.clock-=.06;if(M.advanceMathTip(t,t.question))sound(8302);}t.paint();}
 if(!paused){state.time+=dt;state.sceneTime+=dt;if(state.time>captionUntil&&$('subtitles').textContent)$('subtitles').textContent='';
  if(state.scene==='movie'&&movie){
   const m=movie,a=m.audio,ready=m.scene.tracks.every(t=>t.frames.every(f=>f[0]<0||img(D.bitmaps[f[0]].variants?.[t.mask]||D.bitmaps[f[0]].hi).complete));
   if(ready&&!m.waiting){
    if(settings.sound&&!m.audioFailed){
     if(!m.audioStarted){m.audioStarted=true;effects.add(a);a.currentTime=m.elapsed/1000-m.audioOffset;a.play().catch(()=>{m.audioFailed=true;effects.delete(a);});}
     const playhead=m.audioEnded?m.audioEnd:a.currentTime+m.audioOffset;
     if(Number.isFinite(playhead))m.advance(Math.max(0,playhead*1000-m.elapsed));
    }else m.advance(dt*1000);
    if(m.waiting){a.pause();effects.delete(a);m.audioStarted=false;activity.status=R.strings[40207];setHint(activity.status);}
    if(m.done&&(!settings.sound||m.audioFailed||m.audioEnded))finishMovie();
   }
  }
  if(state.scene==='zapper'){
   if(activity.mode==='opening'&&!zapperImages.some(i=>!i.complete)){
    if(!activity.panelSound){activity.panelSound=true;sound(8313);}
    flightClock+=dt;while(flightClock+1e-9>=.06&&activity.mode==='opening'){
     flightClock-=.06;if(++activity.panelFrame>=D.zapper.tracks[79].n){activity.panelFrame=D.zapper.tracks[79].n-1;activity.mode='solve';mountQuestion();}
    }
   }
   else if(activity.mode==='collect'){
    activity.roundTime+=dt;
    flightClock+=dt;
    while(flightClock+1e-9>=.06&&state.scene==='zapper'&&activity.mode==='collect'&&!state.modal){
     flightClock-=.06;const done=Z.tick(activity,D.zapper,sound);
     const captured=state.mission&&activity.collected>=activity.target&&!activity.trash.some(t=>t.collect)&&!activity.bonusTicks&&!activity.beam;
     if((done||captured)&&channel?.id!==8317)finishZapperCollection();
    }
   }
  }
  if(state.scene==='recycler')updateRecycler(dt);
  if(['cave','blaster','bonus'].includes(state.scene)){
   flightClock+=dt;
   // Keep the original integer physics intact. The requested gentler Math
   // Blaster pace changes its wall-clock cadence, including its hazards.
   while(flightClock+1e-9>=(state.scene==='cave'?.06:.07)&&!state.modal){
    flightClock-=state.scene==='cave'?.06:.07;
    if(state.scene==='cave')updateCave(.06);
    else if(state.scene==='blaster'){activity.wait=Math.max(0,activity.wait-.06);updateBlaster(.06);}
    else if(state.scene==='bonus')updateBonus(.06);else break;
   }
  }
  if(state.scene==='rescue'){if(!activity.started){activity.started=true;speak(8284);}if(state.sceneTime>8)finishMission(true);}
  if(state.time>autoSaveAt){autoSaveAt=state.time+8;snapshot();}
 }
 updateStatus();render();}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointermove',e=>{Object.assign(pointer,point(e));pointer.mode='mouse';if(state.scene==='zapper'&&activity.mode==='collect')activity.aim=point(e);});
canvas.addEventListener('pointerdown',e=>{if(state.modal)return;closeMenus();if(state.scene==='movie'){nextLine();return;}if(state.scene==='recycler'&&activity.demo){activity.demo.stop=true;return;}Object.assign(pointer,point(e));pointer.down=true;pointer.mode='mouse';canvas.setPointerCapture(e.pointerId);focusGame();if(state.scene==='zapper')fireBeam(pointer.x,pointer.y);});
canvas.addEventListener('pointerup',()=>pointer.down=false);canvas.addEventListener('pointercancel',()=>pointer.down=false);
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))closeMenus();});
document.addEventListener('keydown',e=>{
 if(state.modal){if(state.dialogKeys){const action=e.key==='Enter'&&e.target.tagName==='BUTTON'&&!e.target.disabled?e.target.onclick:state.dialogKeys[e.key]||state.dialogKeys[e.key.toLowerCase()];if(action&&(!/INPUT|SELECT/.test(e.target.tagName)||['Escape','Enter'].includes(e.key))){e.preventDefault();action();}}else if(e.key==='Escape'){e.preventDefault();dismiss();}if(e.key==='Tab'){const focusables=[...$('overlay').querySelectorAll('button,input,select')].filter(e=>!e.disabled&&e.tabIndex!==-1);const current=focusables.indexOf(document.activeElement);if(e.shiftKey&&current===0){e.preventDefault();focusables.at(-1)?.focus();}else if(!e.shiftKey&&current===focusables.length-1){e.preventDefault();focusables[0]?.focus();}}return;}
 if(state.scene==='recycler'&&activity.demo&&!state.menu&&!e.altKey){e.preventDefault();activity.demo.stop=true;return;}
 if(e.altKey){const index={f:0,a:1,o:2,s:3,l:4,h:5}[e.key.toLowerCase()];if(index!==undefined){e.preventDefault();$('menubar').children[index].querySelector('button').click();return;}}
 if(state.scene==='movie'&&!state.menu&&!e.altKey){e.preventDefault();if(!e.repeat)nextLine();return;}
 if(e.key==='Escape'){e.preventDefault();if(state.menu){closeMenus();focusGame();}return;}
 if(state.menu)return;if(e.target.matches('input,select'))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(['ArrowLeft','ArrowRight'].includes(e.key))pointer.mode='keyboard';
 if(state.scene==='title'&&e.key==='Enter')startMission();else if(state.scene==='movie'&&e.key==='Enter')nextLine();else if(state.scene==='briefing'&&e.key==='Enter')startActivity('zapper',true);
 else if(state.scene==='zapper'&&activity.mode==='solve'&&e.key==='Enter')$('answer')?.focus();
 else if(state.scene==='recycler'){if(e.key==='ArrowLeft'&&activity.selected>0)selectRecycler(activity.selected-1);if(e.key==='ArrowRight'&&activity.selected<4)selectRecycler(activity.selected+1);if(e.key==='ArrowDown')selectRecycler(activity.selected);if(e.key==='ArrowUp')undoRecycler();if(e.key==='Enter')checkRecycler();}
 
});
document.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>{keys.clear();pointer.down=false;state.focusPaused=true;stopSound(8236);for(const a of effects)a.pause();});
window.addEventListener('focus',()=>{state.focusPaused=false;previous=Date.now();if(!state.modal&&settings.sound)for(const a of effects)a.play().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{keys.clear();pointer.down=false;if(document.hidden){snapshot();if(voice)voice.pause();for(const a of effects)a.pause();}else if(settings.sound&&!state.modal&&!state.focusPaused)for(const a of effects)a.play().catch(()=>{});});
window.addEventListener('beforeunload',snapshot);
$('fullscreen').onclick=fullscreen;$('helpButton').onclick=help;$('muteButton').onclick=()=>{settings.sound=!settings.sound;refreshSound();};
function resizeUI(){ui.style.transform='scale('+($('viewport').clientWidth/640)+')';const title=$('windowTitle');if(title)title.style.left=(Math.trunc($('viewport').clientWidth/2)-Math.trunc(bitmapWidth(title.textContent,D.systemFont)/2))+'px';const app=$('app');app.style.transform='';const r=app.getBoundingClientRect();app.style.transform=`translate(${Math.floor(r.left)-r.left}px,${Math.floor(r.top)-r.top}px)`;}
const resizeObserver=new ResizeObserver(resizeUI);resizeObserver.observe($('viewport'));resizeObserver.observe($('app'));window.addEventListener('resize',resizeUI);resizeUI();
// Expose an intentionally read-only snapshot for inspection, and no way to skip play.
window.MathBlaster={get state(){return JSON.parse(JSON.stringify({scene:state.scene,score:state.score,mission:state.mission,stats:state.stats,activity,settings,player}));},get assetErrors(){return [...images].filter(([id,i])=>i.complete&&!i.naturalWidth).map(([id])=>id);}};
const essential=['MB4DLL3_1441','MB4DLL3_1395','MB4DLL_1788','MB4DLL_1786','MB4DLL_1784','MB4DLL_1908','MB4DLL_1098','MB4DLL_2397','MB4DLL_2521','MB4DLL_1802','MB4DLL4_2282','MB4DLL_2834','MB4DLL2_1377','MB4DLL2_1379'];
for(const id of essential)img(id);for(const a of Object.keys(R.images)){const n=+a.split('_').at(-1);if((a.startsWith('MB4DLL_')&&n>=1527&&n<=1804)||(a.startsWith('MB4DLL4_')&&n>=2097&&n<=2290)||(a.startsWith('MB4DLL2_')&&n>=1188&&n<=1377))img(a);}
buildMenus();refreshSound();showTitle();
window.addEventListener('error',e=>{ $('status').textContent='Game error: '+e.message; });
function animationFrame(){tick(Date.now());requestAnimationFrame(animationFrame);}
if(nativeHost){window.MathBlasterNativeFrame=now=>tick(now);}else{requestAnimationFrame(animationFrame);
// WebKit can defer animation frames when a newly opened native window is not yet active.
// Keep a single fallback clock; it runs only when the display clock has stalled.
setInterval(()=>{const now=Date.now();if(now-previous>40)tick(now);},40);}
})();
