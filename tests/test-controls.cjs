const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const long=process.env.LONG==='1',target=long?25:15,gaps=long?12:6;const root='game/';let ids=new Map(),raf,clock=0,audios=[];
class E{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.attrs={};this.listeners={};this.className='';this.value='';this.disabled=false;this.clientWidth=640;this._text='';this.classList={add:()=>{},remove:()=>{},contains:()=>false};}
 set id(v){this._id=v;ids.set(v,this);}get id(){return this._id;}append(...a){for(const x of a){this.children.push(x);x.parent=this;}}replaceChildren(){this.children=[];for(const [key,v]of ids)if(v.parent===this)ids.delete(key);}
 set textContent(v){this._text=String(v);}get textContent(){return this._text;}set innerHTML(v){this._html=v;this.replaceChildren();if(v.includes('dialog-actions')){let ac=new E();ac.className='dialog-actions';this.append(ac);for(const [,id]of v.matchAll(/id="([^"]+)"/g)){let el=new E(id==='closeDialog'?'button':'input');el.id=id;this.append(el);}this.dialogActions=ac;}}
 get innerHTML(){return this._html||'';}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}focus(){doc.activeElement=this;}select(){}matches(){return false;}querySelector(s){if(s==='.dialog-actions')return this.dialogActions;if(s==='input,select,.dialog-actions button')return this.children.find(x=>x.tagName==='INPUT')||this.dialogActions?.children[0];if(s==='.dialog-actions button')return this.dialogActions?.children[0];if(s.startsWith('#'))return ids.get(s.slice(1));if(s==='button')return this.children.find(x=>x.tagName==='BUTTON');return null;}querySelectorAll(s){return [];}getBoundingClientRect(){return{left:0,top:0,width:640,height:428};}setPointerCapture(){}getContext(){return ctx;}}
const ctx=new Proxy({measureText:s=>({width:String(s).length*10})},{get:(t,p)=>p in t?t[p]:()=>{},set:(t,p,v)=>(t[p]=v,true)});
const documentEvents=new Map(),windowEvents=new Map();
const doc={hidden:false,activeElement:null,getElementById:id=>ids.get(id),createElement:tag=>new E(tag),querySelectorAll:()=>[],addEventListener:(type,fn)=>documentEvents.set(type,fn),fullscreenElement:null};
for(const id of ['window','game','ui','viewport','app','menubar','overlay','status','subjectStatus','levelStatus','scoreStatus','subtitles','hint','announcer','muteButton','helpButton','fullscreen']){const el=new E();el.id=id;}
const local=new Map([['math-blaster-spot-v1',JSON.stringify({player:'Test',settings:{transitions:false}})]]);
const sandbox={document:doc,console,Math,JSON,Image:class{constructor(){this.complete=true;}},Audio:class{constructor(src){this.src=src;audios.push(src);}play(){this.onplaying?.();return Promise.resolve();}pause(){}},ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},requestAnimationFrame:fn=>raf=fn,setInterval:()=>0,performance:{now:()=>clock},addEventListener:(type,fn)=>windowEvents.set(type,fn),print:()=>{},Date:class extends Date{static now(){return clock;}},Set,Map};sandbox.window=sandbox;sandbox.globalThis=sandbox;vm.createContext(sandbox);
for(const f of ['resources.js','math.js','original-data.js','original-engine.js','cave-engine.js'])vm.runInContext(fs.readFileSync(root+f,'utf8'),sandbox);
let source=fs.readFileSync(root+'game.js','utf8').replace('// Expose an intentionally read-only snapshot',`window.__t={state,settings,keys,startMission,startActivity,practice,submitAnswer,fireBeam,pushColumn,checkRecycler,applyDrop,completeActivity,dismiss,resume,snapshot,stopAudio,speak,showTitle,gameOver,tip,get activity(){return activity;},get saved(){return saved;}};\n// Expose an intentionally read-only snapshot`);vm.runInContext(source,sandbox);
const t=sandbox.__t,M=sandbox.MBMath;
function step(seconds=.04){let n=Math.ceil(seconds/.04);for(let i=0;i<n;i++){clock+=40;raf(clock);}}
function pressContinue(){assert(t.state.modal);const b=ids.get('overlay').dialogActions.children.find(b=>b.textContent==='Continue');assert(b);b.onclick();}
function answer(){const a=t.activity;ids.get('answer').value=a.question.answerText;t.submitAnswer();step(.8);}

function key(type,value){let prevented=false;documentEvents.get(type)({key:value,target:ids.get('game'),preventDefault(){prevented=true;}});return prevented;}
for(const scene of ['cave','blaster']){
 const motionStep=seconds=>step(seconds*(scene==='blaster'?7/6:1));
 t.startActivity(scene,false);const a=t.activity,p=a.player;if(scene==='cave'){let guard=0;while(a.guide&&guard++<1000)step(.06);assert(!a.guide);}if(scene==='blaster'){let guard=0;while(a.entry&&guard++<100)step(.06);assert(!a.entry);}
 const x=p.x;assert(key('keydown','ArrowLeft'));motionStep(.2);key('keyup','ArrowLeft');assert(p.x<x-8,scene+' left arrow');
 const leftX=p.x;assert(key('keydown','ArrowRight'));motionStep(.4);key('keyup','ArrowRight');assert(p.x>leftX+8,scene+' right arrow');
 assert(key('keydown',' '));key('keydown','ArrowRight');const startX=p.x,startY=p.y;motionStep(.32);key('keyup',' ');key('keyup','ArrowRight');assert(p.x>startX+20,scene+' steer while thrusting');assert(p.y<=startY-10,scene+' Spacebar thrust after the original takeoff pose');assert(p.vy<0,scene+' upward velocity');
 motionStep(.8);assert(p.vy>=0,scene+' release Spacebar resumes falling');
 key('keydown',' ');key('keydown','ArrowLeft');windowEvents.get('blur')();assert.equal(t.keys.size,0,scene+' losing focus releases controls');
 windowEvents.get('focus')();
 console.log(scene+': keyboard events, left/right steering, held Spacebar thrust, simultaneous steering, release-to-fall, page-scroll prevention, and focus loss passed.');
}

// Verify scene order and transition completion with sound disabled (media clocks are native).
t.settings.sound=false;t.settings.transitions=true;t.startMission('short');
for(const name of ['beamUp','alien','title','briefing']){assert.equal(t.activity.movie,name);key('keydown','Enter');key('keyup','Enter');}
assert.equal(t.state.scene,'zapper');console.log('Original opening sequence and Enter-to-skip passed.');
t.startActivity('blaster',true);t.gameOver();assert.equal(t.activity.movie,'escape');key('keydown','Enter');key('keyup','Enter');assert(t.state.modal);
assert.equal(ids.get('overlay').children.at(-1).attrs['aria-label'],'Personal Best for Test');assert.equal(t.saved,null);key('keydown','Enter');key('keyup','Enter');assert.equal(t.activity.movie,'beamUp');assert(!t.state.modal);
console.log('Original escape cutscene, Personal Best, and return to the mission introduction passed.');
