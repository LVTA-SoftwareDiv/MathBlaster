'use strict';
// MB4.EXE v1.2C: 5:081a advances every active track together; 4:e23c
// displays a frame and triggers its sound. -1 means leave the old image alone.
(() => {
class Timeline {
 constructor(scene, cue=()=>{}) {
  this.scene=scene;this.cue=cue;this.frame=-1;this.elapsed=0;
  this.ms=scene.tracks[scene.start[0]].ms;
  this.length=Math.max(...scene.start.map(i=>scene.tracks[i].n));
  this.display=scene.tracks.map(t=>t.initial);
  this.done=false;this.waiting=false;this.waitPassed=false;
 }
 advance(ms) {
  if(this.done||this.waiting)return;
  this.elapsed+=ms;
  // 1:21ad..21d5 draws briefing frame 315, then suspends all seven
  // tracks until a key or mouse button resumes them (5:1634..171b).
  const wait=this.scene.waitAfterFrame;
  if(wait!=null&&!this.waitPassed&&this.elapsed+1e-7>=wait*this.ms){
   this.elapsed=wait*this.ms;this.waiting=true;
  }
  const target=Math.min(this.length-1,this.waiting?wait:Math.floor((this.elapsed+1e-7)/this.ms));
  while(this.frame<target){
   ++this.frame;
   for(const i of this.scene.start){
    const t=this.scene.tracks[i],f=t.frames[this.frame];
    if(!f||f[0]===-1)continue;
    this.display[i]=this.frame;
    if(f[5])this.cue(f[5]-32768,i,this.frame*this.ms);
   }
  }
  this.done=this.elapsed+1e-7>=this.length*this.ms;
 }
 resume(){if(this.waiting){this.waiting=false;this.waitPassed=true;}}
 sprites(){return this.scene.tracks.map((t,i)=>({track:t,index:i,frame:t.frames[this.display[i]]}))
  .filter(s=>s.frame&&s.frame[0]>=0&&!(this.scene.hideFinished?.includes(s.index)&&this.elapsed>=s.track.n*this.ms)).sort((a,b)=>a.track.z-b.track.z||a.index-b.index);}
}
// 4:3d14 and 4:424c use the fixed reference pose for answer-port
// detection and ceiling support. Coordinates here are native descriptors.
const Blaster={
 heroBounds(p,d,flight){const b=flightBounds(p,flight,'blaster'),f=flightFrame(p,flight,'blaster'),s=d.sizes?.[f[0]];return s?{...b,right:b.left+s[0],bottom:b.top+s[1],width:s[0],height:s[1]}:b;},
 trashBounds(t,trash,d){const b=trashBounds(t,trash),f=trashFrame(t,trash),s=d.sizes?.[f[0]];return s?{...b,right:b.left+s[0],bottom:b.top+s[1]}:b;},
 port(x,d){const center=x+Math.trunc((d.anchor[3]-d.anchor[1])/2);return d.ports.findIndex(r=>center>=r[1]&&center<=r[3]);},
 answer(p,d){return p.y===d.portLimit[2]+d.anchor[4]-d.anchor[2]?this.port(p.x,d):-1;},
 capturing(p,d){return p.y<=d.flightRect[2]+d.anchor[4]-d.anchor[2]&&this.port(p.x,d)>=0;},
 entry(d,oldState){const width=d.anchor[3]-d.anchor[1];return{x:-10*width,y:Math.trunc((d.flightRect[2]+d.flightRect[4]+d.anchor[4]-d.anchor[2])/2),vx:width,vy:0,state:oldState===6?12:6};},
 failureStep(f){if(--f.blink===0){f.blink=8;f.highlight=!f.highlight;}f.frame=(f.frame+1)%25;return --f.ticks===0;},
 // 4:28ec chooses three persistent slots; 4:36a6 places the first free
 // slot using the original descriptor bounds and two random integers.
 gemSlots(phase){return [0,1,phase>6?2:3+((phase&2)>>1)];},
 gemCandidate(slot,d,spawn,randomX,randomY){const [track,points]=d.gems[slot],f=d.tracks[track].frames[0],w=f[3]-f[1],h=f[4]-f[2],left=randomX%(641-w),top=spawn[1]+randomY%(spawn[3]-spawn[1]+1)-20;return{slot,track,points,left,top,right:left+w,bottom:top+h,alive:true};},
 constrain(p,d,answering=true){
  const top=(answering&&this.port(p.x,d)>=0?d.portLimit[2]:d.flightRect[2])+d.anchor[4]-d.anchor[2];
  if(p.y<top){p.y=top;p.vy=0;}
  if(p.y>=d.flightRect[4]){p.y=d.flightRect[4];p.vy=0;}
 },
 // 4:4772 refreshes grounded coordinates from the painted frame before
 // choosing input; 4:3c28 resolves ground/air poses before animation.
 prepareFlight(p,d,flight,answering=true){
  const a=p.flight;if(!a||!flight.blaster[a.state].words[1])return;
  a.visible??={x:p.x,y:p.y};
  if(a.visible){p.x=a.visible.x;p.y=a.visible.y;}
  const width=d.anchor[3]-d.anchor[1],left=a.entry?-10*width:0,right=640-2*width;
  if(p.x<left){p.x=left;p.vx=0;}if(p.x>right){p.x=right;p.vx=0;}
  const top=(answering&&this.port(p.x,d)>=0?d.portLimit[2]:d.flightRect[2])+d.anchor[4]-d.anchor[2]-20;
  if(p.y<top){p.y=top;p.vy=0;}if(p.y>d.flightRect[4]-20){p.y=d.flightRect[4]-20;p.vy=0;}
 },
 resolveFlight(p,d,flight,target,next,answering=true){
  const a=p.flight,old=a.state,floor=d.flightRect[4]-20;let landed=false;
  for(let attempt=0;attempt<4;attempt++){
   const s=flight.blaster[next],w=s.words;
   if(w[1]){
    a.blocked=false;a.entry=false;p.vx=p.vy=0;
    if(next===old&&(w[2]||next===0)&&!a.active){next=4;continue;}
    a.floor=floor;if(next!==old)p.y=floor;
   }else{
    const f=s.track.frames[next===old?a.frame:0];
    if(a.blocked){p.vy++;p.x+=p.vx;p.y+=p.vy;}
    else if(answering&&this.capturing({x:p.x,y:p.y+20},d)){p.vy--;p.x+=p.vx;p.y+=p.vy;}
    else flightStep(p,target,next===7||next===13,Math.trunc((f[3]-f[1])/2));
    const width=d.anchor[3]-d.anchor[1],left=a.entry?-10*width:0,right=640-2*width;
    if(p.x<left){p.x=left;p.vx=0;}if(p.x>right){p.x=right;p.vx=0;}
    p.y+=20;this.constrain(p,d,answering);p.y-=20;
    if(p.y>=floor){p.y=floor;p.vy=0;next=w[3];landed=true;continue;}
   }
   break;
  }
  return {state:next,landed,minX:a.entry?-10*(d.anchor[3]-d.anchor[1]):0};
 },
 // 4:4398..455c tests the previously painted hero and hazards after
 // motion is resolved, before any actor advances to its next frame.
 contact(p,d,flight,old,answering,overlaps,play=()=>{}){
  if(p.flight.blocked||flight.blaster[old].words[1]||answering&&this.capturing({x:p.x,y:p.y+20},d))return null;
  const hit=overlaps();if(!hit)return null;
  if(hit.blast){play(8296);p.vx=0;p.vy=Math.max(p.vy,10);}
  else{
   if(!hit.trash?.length)return null;
   for(const velocity of hit.trash)play(8298);
   p.vx+=Math.trunc(hit.trash.at(-1));p.vy=Math.max(p.vy,0);
  }
  p.flight.blocked=true;return {state:1,blast:!!hit.blast};
 },
 hazards(a,trash,weapon,play=()=>{},stop=()=>{},rng=Math.random){
  //1:0f83/0f8c: weapon controller precedes trash allocation; both run
  //before the common animation pass. Finished trash is retired only when
  //the next allocation check is due (4:3a43..3a79).
  weaponStep(a,weapon,play,rng,stop);
  a.trash??=[];a.spawn=(a.spawn||0)+.06;
  if(a.spawn+1e-9>=trash.interval[a.motionLevel??0]*5*.06){
   const level=adaptTrashDifficulty(a),uses=a.trashUses??=Array(15).fill(0),stats=a.motionStats??={takeoffs:0,hits:0,exits:0};
   for(const t of a.trash)if(t.alive&&t.active===false){t.alive=false;uses[t.type]++;stats.exits++;}
   const live=a.trash.filter(t=>t.alive),busy=new Set(live.map(t=>t.type));
   let type=-1;for(let i=0;i<15;i++)if(!busy.has(i)&&(type<0||uses[i]<uses[type]))type=i;
   if(live.length<trash.limit[level]&&type>=0){
    a.trash=a.trash.filter(t=>t.type!==type);a.trash.push(makeFlyingTrash(trash,type,level,rng));a.spawn=0;
   }
  }
  for(const t of a.trash)stepFlyingTrash(t,trash);
 }
};
// Integer acceleration law shared by Cave Runner (4:9b34..9c40) and
// Math Blaster (4:407c..4180). Original default timer = 60 ms (3:11fa).
// Positions and velocities are original pixels and pixels per game tick.
function flightStep(p,targetX,thrust,halfWidth=22,blocked=false){
 let error=Math.trunc(targetX)-p.x-halfWidth,ax=0;
 if(!blocked){
  if(error>halfWidth||error< -halfWidth){
   error+=error>0?40:-40;
   ax=Math.trunc(error/40)-Math.trunc(p.vx/4);
  }else ax=-Math.trunc(p.vx/(Math.abs(p.vx)>0&&Math.abs(p.vx)<4?Math.abs(p.vx):4));
 }
 p.vx+=ax;p.vy+=thrust&&!blocked?-1:1;p.x+=p.vx;p.y+=p.vy;
 return {ax,ay:thrust&&!blocked?-1:1};
}
// 4:a932 / 4:4772: input selects one of six columns of the shared
// 15-state table. The wider no-thrust dead band is intentional.
function flightChoice(state,x,width,target,thrust,transitions){
 const h=Math.trunc(width/2),left=x-(thrust?0:h),right=x+(thrust?2:3)*h;
 return transitions[state][(thrust?0:3)+(target<left?0:target>right?2:1)];
}
function flightFrame(p,data,kind){
 const s=data[kind][p.flight?.state??4];
 return s.track.frames[p.flight?.frame??0];
}
function flightBounds(p,data,kind){
 const f=flightFrame(p,data,kind),x=p.flight?.visible?.x??p.x,y=p.flight?.visible?.y??p.y;
 return {left:x,top:y-(f[4]-f[2]),right:x+f[3]-f[1],bottom:y,
  width:f[3]-f[1],height:f[4]-f[2]};
}
// The actor uses original coordinates: x is the sprite's left edge, y its
// feet. Platform support/landing is supplied by the activity; cave geometry
// and obstacle-specific collision responses are separate from this controller.
// Control runs before the frame advances (4:c853, then 4:c8c8 -> 5:081a).
function flightTick(p,data,kind,target,thrust,world={},audio={}){
 const states=data[kind],play=audio.play||(()=>{}),stop=audio.stop||(()=>{});
 if(!p.flight){p.flight={state:world.grounded?4:6,frame:0,active:false,floor:world.floor??p.y};if(world.grounded&&world.floor!=null)p.y=world.floor;}
 const a=p.flight,old=a.state,oldFrame=states[old].track.frames[a.frame],oldWidth=oldFrame[3]-oldFrame[1];
 if(world.nativeFrameBounds)a.visible??={x:p.x,y:p.y};
 let next=flightChoice(old,p.x,oldWidth,Math.trunc(target),thrust,data.transitions),landed=false,resolution=null;
 if(kind==='blaster'&&old===0)next=0;
 if(world.resolve){resolution=world.resolve(p,next);next=resolution.state;landed=!!resolution.landed;}
 // 4:986a / 4:3c28 resolve a proposed pose until it is valid.
 for(let attempt=0;!world.resolve&&attempt<4;attempt++){
  const s=states[next],w=s.words;
  if(w[1]){
   p.vx=0;p.vy=0;
   if(next===old&&(w[2]||next===0)&&!a.active){next=4;continue;}
   const support=world.support?world.support(p,next,a.floor):a.floor;
   if(support==null&&w[4]){next=w[4];continue;}
   if(support!=null){a.floor=support;if(next!==old)p.y=support;}
  }else{
   const f=s.track.frames[next===old?a.frame:0],before=p.y;
   const forced=world.acceleration&&!world.blocked&&!a.blocked?world.acceleration:null;
   if(forced){p.vx+=forced.x;p.vy+=forced.y;p.x+=p.vx;p.y+=p.vy;}
   else flightStep(p,target,next===7||next===13,Math.trunc((f[3]-f[1])/2),!!world.blocked||!!a.blocked);
   const floor=world.land?.(p,before,next);
   if(floor!=null){p.y=floor;p.vy=0;a.floor=floor;a.blocked=false;next=w[3];landed=true;continue;}
  }
  break;
 }
 let s=states[next],w=s.words;
 const wasThrust=old===7||old===13,isThrust=next===7||next===13;
 if(!wasThrust&&isThrust)play(8236);
 if(wasThrust&&!isThrust)stop(8236);
 const takeoff=!!states[old].words[1]&&!w[1];
 const contact=world.contact?.(p,next,old,resolution);
 if(contact){next=contact.state;s=states[next];w=s.words;}
 const changed=next!==old||!!contact?.restart;
 let advanced=false;
 if(changed){
  if(!contact?.preserveSound){if(a.sound)stop(a.sound);a.sound=null;}
  const f=s.track.frames[0];
  p.x+=Math.trunc(((contact?.referenceWidth??oldWidth)-(f[3]-f[1]))/2);
  a.state=next;a.frame=0;a.active=!!w[2]||s.track.n>1;
 }else if((w[2]||s.track.n>1)&&a.active){
  const i=(a.frame+1)%s.track.n,f=s.track.frames[i];
  if(w[1]){
   if(kind==='blaster'&&world.nativeFrameBounds){p.x=a.visible.x;p.y=a.visible.y;}
   p.x+=f[1]-oldFrame[1]+(i===0?w[7]:0);
   p.y+=f[4]-oldFrame[4]+(i===0?w[8]:0);
  }
  a.frame=i;advanced=true;
  if(!w[2]&&i===s.track.n-1)a.active=false;
 }
 if(!world.nativeFrameBounds||changed){
  const minX=resolution?.minX??world.minX;
  if(minX!=null&&p.x<minX){p.x=minX;p.vx=0;}
  if(world.maxX!=null&&p.x>world.maxX){p.x=world.maxX;p.vx=0;}
 }
 // The original stops a walking track if its NEXT frame would leave bounds.
 if(w[2]&&(w[1]||world.nativeFrameBounds)&&(!world.nativeFrameBounds||changed||advanced)){
  const i=(a.frame+1)%s.track.n,f=s.track.frames[a.frame],n=s.track.frames[i];
  const nx=p.x+n[1]-f[1]+(i===0?w[7]:0);
  const ny=p.y-f[4]+n[2]+(i===0?w[8]:0)+20;
  a.active=nx>=w[9]&&nx<=w[10]&&(!world.nativeFrameBounds||ny>=0&&ny<=440);
 }
 const frame=s.track.frames[a.frame];
 if((changed||advanced)&&frame[5]){
  const emit=()=>{if(a.sound)stop(a.sound);a.sound=frame[5]-32768;play(a.sound);};
  // Activities may finish their controllers before the shared animation
  // pass emits frame cues. Cave actors139..153 follow droplets40..63.
  if(audio.frame)audio.frame(emit,{actor:a,state:next,frame:a.frame});else emit();
 }
 // A stopped looping actor retains its last painted position even while
 // its physics continue (4:ec34 changes offsets;5:084c skips its repaint).
 // Non-looping airborne poses are explicitly redrawn by4:a5ee each tick.
 if(world.nativeFrameBounds&&((!w[2]&&(!w[1]||kind!=='blaster'))||changed||advanced))a.visible={x:p.x,y:p.y};
 return {...resolution,state:next,frame:a.frame,thrust:next===7||next===13,landed,changed,takeoff,contact};
}
// 4:44dc..455c: a blast cancels horizontal speed and gives at least 10
// pixels/tick downward speed; trash adds its own horizontal speed instead.
// State 1 stays disabled until landing, which enters the 30-frame state 0.
function flightImpact(p,data,kind,blast=false,trashVelocity=0,audio={}){
 const old=p.flight?.state??4;
 if(old===1||data[kind][old].words[1])return false;
 const f=flightFrame(p,data,kind),hit=data[kind][1].track.frames[0];
 if(p.flight?.sound)audio.stop?.(p.flight.sound);
 audio.stop?.(8236);
 p.x+=Math.trunc(((f[3]-f[1])-(hit[3]-hit[1]))/2);
 p.vx=blast?0:p.vx+Math.trunc(trashVelocity);p.vy=Math.max(p.vy,blast?10:0);
 p.flight={state:1,frame:0,active:false,blocked:true,floor:p.flight?.floor??p.y};
 audio.play?.(blast?8296:8298);return true;
}
function trashFrame(t,data,kind='blaster'){
 const track=data[kind][t.type%data[kind].length];
 return track.frames[Math.max(0,Math.floor((t.age+1e-9)/.06))%track.n];
}
function trashBounds(t,data){
 const first=data.blaster[t.type].frames[0],f=trashFrame(t,data);
 const left=t.x+f[1]-first[1],top=t.y+f[2]-first[2];
 return {left,top,right:left+f[3]-f[1],bottom:top+f[4]-f[2]};
}
function makeFlyingTrash(data,type,level=0,rng=Math.random){
 const right=Math.floor(rng()*32768)%2===0,spawn=data.spawn,speed=data.speed[Math.max(0,Math.min(15,level))];
 rng(); //4:3b30 consumes a random integer even though its divisor is1.
 return {type,x:right?spawn[0]:spawn[2],y:spawn[1]+Math.floor(rng()*32768)%(spawn[3]-spawn[1]+1)-20,
  vx:right?speed:-speed,vy:0,age:-.06,alive:true,active:true,laser:false};
}
function stepFlyingTrash(t,data){
 if(t.active===false)return trashBounds(t,data);
 if(t.age>=0)t.x+=t.vx;
 t.age+=.06;
 const next=trashBounds({...t,x:t.x+t.vx,age:t.age+.06},data),b=data.bounds;
 t.active=next.left>=b[0]&&next.left<=b[2]&&next.top>=b[1]-20&&next.top<=b[3]-20;
 return trashBounds(t,data);
}
// 4:38ca: flying-trash difficulty adapts to takeoffs, impacts, and objects
// that crossed the screen, independently of the selected arithmetic level.
function adaptTrashDifficulty(a){
 const s=a.motionStats??={takeoffs:0,hits:0,exits:0};if(!s.takeoffs)return a.motionLevel??0;
 const half=Math.trunc(s.takeoffs/2),passes=Math.trunc((s.exits+half)/s.takeoffs);
 const avoidance=10-Math.trunc((s.hits*10+half)/s.takeoffs);let delta=0;
 if(avoidance>=0&&avoidance<=4){
  if(avoidance<=1&&s.takeoffs>=2)delta=-2;
  if(avoidance<=2&&s.hits>=2)delta=-2;
  if(avoidance<=3&&s.hits>=3)delta=-2;
  if(passes>=5)delta=-2;
  if(!delta)delta=-1;
 }else if(avoidance===5||avoidance===6){
  if(avoidance===5&&s.takeoffs>=3)delta=-1;
  if(passes>=5)delta=-1;if(passes>10)delta=-2;
 }else if(avoidance>=7&&avoidance<=9){if(passes>10)delta=-1;}
 else if(avoidance===10&&s.takeoffs>=3){if(passes<=5)delta=1;if(passes<=2)delta=2;}
 if(delta){a.motionLevel=Math.max(0,Math.min(15,(a.motionLevel??0)+delta));s.takeoffs=s.hits=s.exits=0;}
 return a.motionLevel??0;
}
function weaponSprite(w,data){
 if(!w||w.phase==='idle')return null;
 const track=data[w.phase],frame=track.frames[w.frame],port=data.ports[w.port],first=data.charge.frames[0];
 const x=port[1]-first[1],y=port[2]-first[2]-20;
 return {track,frame,x,y,box:{left:x+frame[1],top:y+frame[2],right:x+frame[3],bottom:y+frame[4]}};
}
// 4:37a6: five charging frames, twelve beam frames, then 33 ticks of
// cooldown at the default timer. The five muzzles are distinct from answer ports.
function weaponStep(a,data,play=()=>{},rng=Math.random,stop=()=>{}){
 const w=a.weapon??={phase:'idle',left:data.cooldownTicks,port:0,frame:0};
 if(w.phase==='idle'){
  if(--w.left>0)return null;
  w.port=Math.floor(rng()*32768)%data.ports.length;w.phase='charge';w.frame=0;
 }else if(++w.frame>=data[w.phase].n){
  if(w.sound){stop(w.sound);w.sound=null;}
  if(w.phase==='charge'){w.phase='beam';w.frame=0;}
  else{w.phase='idle';w.left=data.cooldownTicks-1;w.frame=0;return null;}
 }
 const sprite=weaponSprite(w,data);if(sprite.frame[5]){if(w.sound)stop(w.sound);w.sound=sprite.frame[5]-32768;play(w.sound);}return sprite;
}
// Trash Zapper: 3:e446 / e58e / eb8e. Coordinates below are descriptor
// coordinates, before the original window's -34 pixel viewport offset.
// Number Recycler: 3:a1bc/a35e (hopper), cf47 (equation), d22c
// (recycling row), d487 (column motion). All distances are pixels/60ms.
const Recycler={
 walk(a,column){
  const right=column>a.selected;
  a.walk={track:right?0:1,frame:0,next:0,dx:(a.selected-2)*50+(right?-10:-76),stride:right?66:-66,bound:199+50*column,finished:false};
  a.selected=column;a.walkTo=221+50*column;a.busy=1;
 },
 walkTick(a,data,play=()=>{}){
  const w=a.walk;if(!w)return false;
  if(w.finished){a.walk=null;a.walkX=a.walkTo;a.busy=0;return true;}
  w.frame=w.next;const t=data.tracks[w.track],f=t.frames[w.frame];w.displayDx=w.dx;
  if(f[5])play(f[5]-32768);
  w.next++;if(w.next>=t.n){w.next=0;w.dx+=w.stride;}
  const nextX=t.frames[w.next][1]+w.dx;
  w.finished=w.track===0?nextX>w.bound:nextX<w.bound;
  return false;
 },
 initHopper(a,data){
  if(a.hopper)return;
  a.hopper=data.hopper.map(t=>({...t,alive:false,y:0}));a.hopperOrder=1;
  this.refillHopper(a);
 },
 refillHopper(a){
  for(const t of a.hopper)if(t.alive&&t.y+t.height>168){t.alive=false;t.y=a.hopperOrder++;}
  let live=a.hopper.filter(t=>t.alive),top=Math.min(168,...live.map(t=>t.y));
  while(live.length<a.target-a.fuel&&top>0){
   const next=a.hopper.filter(t=>!t.alive).reduce((best,t)=>!best||t.y<best.y?t:best,null);if(!next)break;
   top-=next.height;next.y=top;next.alive=true;live.push(next);
  }
 },
 begin(a,data,kind,before,event,column=0){
  this.initHopper(a,data);
  const visual=[];for(let c=0;c<5;c++)for(let i=0;i<8;i++)if(before[c][i]>=0){const row=before[c][i];visual.push({c,i,row,x:221+c*50,y:data.rows[row][2],visible:true});}
  const low=a.hopper.filter(t=>t.alive).reduce((best,t)=>!best||t.y>best.y?t:best,null);
  a.motionClock=0;a.motion={kind,phase:kind==='accept'?'open':event.zapped.length?'zap':'fall',ticks:0,phaseTicks:0,visual,event,column,offset:0,recycleOffset:0,fallOffset:0,dropLeft:low?.height||0,zapDone:!event.zapped.length,recycleDone:kind!=='accept'||!event.recycled.length,fuel:kind==='accept'?a.fuel-1:a.fuel};
 },
 tick(a,data,{play=()=>{},stop=()=>{},animate=()=>{},width=()=>8,playing=()=>false}={}){
  const m=a.motion;if(!m)return false;m.ticks++;m.phaseTicks++;
  if(!m.zapDone){
   if(m.ticks===8)for(const [c,i]of m.event.zapped){const t=m.visual.find(t=>t.c===c&&t.i===i);if(t)t.visible=false;}
   if(m.ticks>data.tracks[15].n&&!playing(8306))m.zapDone=true;
  }
  if(!m.recycleDone){
   m.recycleOffset+=6;let moving=false;
   for(const [c,i]of m.event.recycled){const t=m.visual.find(t=>t.c===c&&t.i===i);if(t.returned)continue;
    const margin=Math.trunc((38-width(a.columns[c][i]))/2);
    if(199+c*50+m.recycleOffset>399+margin){t.row=a.positions[c][i]-1;t.y=t.row<0?161:data.rows[t.row][2];t.x=221+c*50;t.returned=true;}
    else{t.x=218+c*50+m.recycleOffset;moving=true;}
   }m.recycleDone=!moving;
  }
  const phase=p=>{m.phase=p;m.phaseTicks=0;};
  if(m.phase==='open'&&m.phaseTicks>data.tracks[9].n){phase('drop');play(8317);}
  if(m.phase==='drop'){
   if(m.dropLeft>0){const dy=Math.min(5,m.dropLeft);m.dropLeft-=dy;for(const t of a.hopper)if(t.alive){t.y+=dy;if(t.y+t.height>199){t.alive=false;t.y=a.hopperOrder++;}}}
   else{this.refillHopper(a);phase('plunge');animate(13);}
  }else if(m.phase==='plunge'&&m.phaseTicks>=data.tracks[13].n){phase('consume');play(8304);}
  if(m.phase==='consume'){
   m.offset+=6;let moving=false;
   for(const t of m.visual.filter(t=>t.row===7&&t.visible)){
    const margin=Math.trunc((38-width(a.columns[t.c][t.i]))/2);
    if(199+t.c*50-m.offset<193-margin)t.visible=false;
    else{t.x=218+t.c*50-m.offset;moving=true;}
   }
   if(!moving){stop(8304);play(8305);m.fuel=a.fuel;phase('settle');}
  }else if(m.phase==='settle'&&m.zapDone&&m.recycleDone)phase('fall');
  else if(m.phase==='zap'&&m.zapDone)phase('fall');
  if(m.phase==='fall'){
   if(!m.fallOffset&&m.kind==='push')animate(5,m.column*50);
   m.fallOffset+=4;let moved=false;
   for(const t of m.visual){
    if(!t.visible||a.positions[t.c][t.i]<0)continue;
    const target=data.rows[a.positions[t.c][t.i]][2],next=t.y+Math.sign(target-t.y)*Math.min(4,Math.abs(target-t.y));
    if(next!==t.y){t.y=next;moved=true;}
   }
   if(!moved){a.motion=null;stop(8305);return true;}
  }
  return false;
 }
};
const Zapper={
 init(a,data){
  a.zapperVersion=1;a.motionLevel??=0;a.shotStats??={shots:0,hits:0,exits:0};
  a.round??=0;a.spawnTicks=10000;a.bonusTicks=0;
  a.trash=data.objects.map(([track,type,icon],slot)=>({track,type,icon,slot,
   x:0,y:0,vx:0,vy:0,frame:0,age:-.06,alive:false,collect:0,
   collected:slot<a.collected,iconVisible:slot<a.collected,collectedIndex:slot}));
 },
 adapt(a){
  const s=a.shotStats;if(!s.shots)return a.motionLevel;
  const half=Math.trunc(s.shots/2),passes=Math.trunc((s.exits+half)/s.shots);
  const success=Math.trunc((10*s.hits+half)/s.shots),misses=s.shots-s.hits;let delta=0;
  if(success<=4){
   if(success<=1&&s.shots>=2)delta=-2;
   if(success<=2&&misses>=2)delta=-2;
   if(success<=3&&misses>=3)delta=-2;
   if(passes>=5)delta=-2;if(!delta)delta=-1;
  }else if(success<=6){
   if(success===5&&s.shots>=3)delta=-1;
   if(passes>=5)delta=-1;if(passes>10)delta=-2;
  }else if(success<=9){if(passes>10)delta=-1;}
  else if(success===10&&s.shots>=3){if(passes<=5)delta=1;if(passes<=2)delta=2;}
  if(delta){a.motionLevel=Math.max(0,Math.min(15,a.motionLevel+delta));s.shots=s.hits=s.exits=0;}
  return a.motionLevel;
 },
 spawn(a,data,rng=Math.random){
  // Adaptation precedes the active-object scan, even when no slot can spawn.
  this.adapt(a);
  for(const t of a.trash)if(t.expired){a.shotStats.exits++;t.expired=false;}
  const live=a.trash.filter(t=>t.alive&&!t.collected).length;
  const t=a.trash.find(t=>!t.collected&&!t.alive);
  if(!t||live>=a.beams)return null;
  const level=a.motionLevel,n=Math.trunc(level/4)+1;
  const side=n===1?a.round%3:Math.floor(rng()*n);
  const cross=data.crossSpeed[level],low=Math.trunc(cross/2);
  const drift=low+Math.floor(rng()*(cross-low+1)),speed=data.forwardSpeed[level];
  const region=data.tracks[80].frames[1],l=region[1],top=region[2],r=region[3],bottom=region[4];
  const insetX=Math.trunc((r-l)/5),insetY=Math.trunc((bottom-top)/5);
  if(side<2){
   t.x=side===0?l:r;t.y=top+insetY+Math.floor(rng()*(bottom-top-2*insetY+1));
   t.vx=side===0?speed:-speed;t.vy=t.y<top+Math.trunc((bottom-top)/2)?drift:-drift;
  }else{
   t.x=l+insetX+Math.floor(rng()*(r-l-2*insetX+1));t.y=side===2?top:bottom;
   t.vx=t.x<l+Math.trunc((r-l)/2)?drift:-drift;t.vy=side===2?speed:-speed;
  }
  t.alive=true;t.age=-.06;t.frame=0;t.collect=0;a.spawnTicks=0;return t;
 },
 sprite(t,data){
  const track=data.tracks[t.collect?30+t.type:t.track],f=track.frames[t.frame];
  const first=data.tracks[t.track].frames[0];
  return {track,frame:f,x:t.x+f[1]-first[1],y:t.y+f[2]-first[2]};
 },
 bounds(t,data){const s=this.sprite(t,data),f=s.frame,size=data.sizes?.[f[0]]||[f[3]-f[1],f[4]-f[2]];return {left:s.x,top:s.y-34,right:s.x+size[0],bottom:s.y+size[1]-34};},
 aimable(x,y){const yy=y+34;return x>=0&&x<640&&yy>=20&&yy<320&&(x-320)**2+(yy-1142)**2>=883**2;},
 hit(a,data,x,y){
  x=Math.trunc(x);y=Math.trunc(y);
  if(!a.beams||a.beam||!this.aimable(x,y))return null;
  // 4:e926 gives WANIM a 6×6 aim rectangle; WANIM 1:0fd6/0f5e
  // tests strict rectangle overlap, including the transparent sprite margin.
  const t=a.trash.find(t=>{if(!t.alive||t.collected)return false;const b=this.bounds(t,data);return x+3>b.left&&x-3<b.right&&y+3>b.top&&y-3<b.bottom;});
  a.beams--;a.shotStats.shots++;a.beam={x,y,ticks:2,ttl:.12};
  if(!t){a.streak=0;return {hit:false,points:0};}
  t.collected=true;t.collectedIndex=a.collected++;t.collect=1;t.frame=0;t.age=-.06;
  a.shotStats.hits++;a.streak=(a.streak||0)+1;
  return {hit:true,points:100+(a.streak===5?1000:0),trash:t};
 },
 tick(a,data,play=()=>{},rng=Math.random){
  if(a.beam){a.beam.ticks--;a.beam.ttl=a.beam.ticks*.06;if(a.beam.ticks<=0)a.beam=null;}
  if(a.bonusTicks>0)a.bonusTicks--;
  let collectedNow=false;
  for(const t of a.trash){
   if(!t.alive)continue;
   if(t.age<0){t.age=0;continue;}
   t.age+=.06;
   if(t.collect){
    if(++t.frame>=data.tracks[30+t.type].n){t.collect=0;t.alive=false;t.iconVisible=true;t.frame=0;collectedNow=true;}
   }else{
    t.x+=t.vx;t.y+=t.vy;t.frame=(t.frame+1)%data.tracks[t.track].n;
    const s=this.sprite(t,data),b=data.tracks[80].frames[0];
    if(s.x<b[1]||s.x>b[3]||s.y<b[2]||s.y>b[4]){t.alive=false;t.expired=true;}
   }
  }
  if(collectedNow){play(8317);if(a.streak===5&&!a.trash.some(t=>t.collect))a.bonusTicks=33;}
  if(a.beams>0&&++a.spawnTicks>=data.interval[a.motionLevel])this.spawn(a,data,rng);
  return a.beams===0&&!a.beam&&!a.trash.some(t=>t.collect)&&!a.bonusTicks;
 },
 begin(a){a.spawnTicks=10000;a.streak=0;a.bonusTicks=0;a.beam=null;for(const t of a.trash){if(!t.collected)t.alive=false;}},
 end(a){a.round++;for(const t of a.trash){t.alive=false;t.collect=0;}},
 beamStarts(x,y){
  const yy=y+34;
  return [259,382].map(startX=>{let sy=354,sx=startX;const slope=(startX-x)/(354-yy);
   while(!this.aimable(sx,sy-34)&&sy>yy){sy--;sx=Math.trunc((sy-yy)*slope+x);}
   return [sx,sy-34];});
 }
};
// MB4 3:7a42 / 3:7c96: one sound channel, with pending loop flags.
// Interrupted loops restart from their beginning, not their old playhead.
class SoundArbiter {
 constructor(priority,loops,start,halt){this.priority=priority;this.loops=loops;this.start=start;this.halt=halt;this.active=null;this.pending=new Set();}
 play(id){
  // Audio completion callbacks may arrive after the next input/timer event.
  // Retire an already finished sample before comparing cue priorities.
  if(this.active?.handle?.ended)this.finish(this.active);
  const current=this.active,loop=!!this.loops[id];
  if(current?.id===id&&loop)return current.handle;
  if(current&&(this.priority[current.id]||0)>(this.priority[id]||0)){
   if(loop)this.pending.add(id);return null;
  }
  if(current){if(this.loops[current.id])this.pending.add(current.id);this.active=null;this.halt(current);}
  this.pending.delete(id);
  const item={id,loop};this.active=item;item.handle=this.start(item);return item.handle;
 }
 resume(){
  if(this.active||!this.pending.size)return;
  const ids=[...this.pending].sort((a,b)=>(this.priority[b]||0)-(this.priority[a]||0)||a-b);
  this.play(ids[0]);
 }
 stop(id,resume=true){
  this.pending.delete(id);
  if(this.active?.id!==id)return;
  const current=this.active;this.active=null;this.halt(current);if(resume)this.resume();
 }
 finish(item){if(this.active!==item)return;this.active=null;this.pending.delete(item.id);this.halt(item);this.resume();}
 clear(){this.pending.clear();if(this.active){const current=this.active;this.active=null;this.halt(current);}}
}
globalThis.MBOriginal={Timeline,Blaster,flightStep,flightChoice,flightFrame,flightBounds,flightTick,flightImpact,trashFrame,trashBounds,makeFlyingTrash,stepFlyingTrash,adaptTrashDifficulty,weaponSprite,weaponStep,Recycler,Zapper,SoundArbiter,tickMs:60};
})();
