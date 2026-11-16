'use strict';
// Cave Runner model. Coordinates below are the original 640×440 game area,
// with the Windows menu's 20-pixel offset removed. Sources: MB4.EXE v1.2C,
// 4:7422–8f6a (layout/droplets), 4:9124–a2ac (flight and collisions).
(() => {
const rand=(n,rng)=>Math.floor(rng()*32768)%n;
const between=(n,a,b)=>n>Math.min(a,b)&&n<Math.max(a,b);
// 4:6580 and 4:bd0c: cave labels/drops use the four integer operations.
// Pattern, estimation and fraction subjects map to addition, subtraction and
// division respectively. Review selects one of those four operations.
function caveSubject(subject,rng=Math.random){return subject===7?[0,1,4,5][rand(4,rng)]:({2:0,3:1,6:5})[subject]??subject;}
// 4:a2e8: before an incorrect gap is tried, help targets the first opening
// in the row above Blasternaut's feet. Afterwards it targets that tried gap.
function dropTarget(a){
 if(a.lastWrong)return a.lastWrong;
 const row=a.rows.find(r=>r.index===((a.player.y+58>225||a.finalSection)?1:0));
 return row?.gaps[0]||a.rows[0]?.gaps[0];
}
function dropArithmetic(a,large,subject,rng=Math.random){
 const mapped=caveSubject(subject,rng);let op=['+','−','×','÷'][rand(mapped<2?2:4,rng)];
 let maximum=Math.max(Math.abs(a.number),10);
 if(!large)maximum=Math.min(maximum,9);
 if(op==='×'||op==='÷')maximum=Math.min(maximum,12);
 let value=1+rand(maximum,rng);
 if(large){
  a.helpfulDrop=!a.helpfulDrop;
  if(a.helpfulDrop){const g=dropTarget(a),delta=Math.trunc((g.a+g.b)/2)-a.number;op=delta<0?'−':'+';value=Math.abs(delta);}
 }
 // 4:87a8: even the helpful midpoint adjustment is limited to 99.
 return {op,value:Math.max(-99,Math.min(99,value))};
}
function shape(pattern,data){
 let bits=(pattern<<2)+0x603;
 return Array.from({length:9},()=>{const kind=data.kindMap[bits&7];bits>>=1;return kind;});
}
function openings(cells){
 const gaps=[];let left=-1;
 for(let i=0;i<cells.length;i++){
  const k=typeof cells[i]==='number'?cells[i]:cells[i].kind;
  if(k===2||k===4||k===11||k===13){if(left>=0)gaps.push({leftCell:left,rightCell:i,left:116+58*left,right:58+58*i});}
  if(k===3||k===4||k===12||k===13)left=i;
 }
 return gaps;
}
function patternAllowed(pattern,data,level,first){
 const gaps=openings(shape(pattern,data));
 return gaps.length>0&&(!first||gaps.length>=2)&&(level!==1||gaps.every(g=>g.rightCell-g.leftCell-1>=2));
}
function choosePattern(data,level,first,rng){
 for(let tries=0;tries<256;tries++){const p=rand(127,rng);if(patternAllowed(p,data,level,first))return p;}
 // Deterministic fallback also protects seeded tests with constant RNGs.
 for(let p=0;p<127;p++)if(patternAllowed(p,data,level,first))return p;
 throw Error('No legal Cave Runner pattern');
}
function makeRow(pattern,row,data,level,problem,rng,blank=false){
 const labels=[];let previous=-31000;
 const cells=shape(pattern,data).map((kind,column)=>{
  let label=null;
  if(kind>=2&&kind<=4&&!blank){
   const numeric=rand(100,rng)>=(data.expressionChance||data.numericChance)[level-1];
   for(let tries=0;tries<20;tries++){
    const q=problem(),value=q.value;
    if(Math.abs(value-previous)>1){
     label={value,text:numeric?String(value):q.text};break;
    }
   }
   if(!label){const value=previous+2;label={value,text:String(value)};}
   previous=label.value;labels.push(label.value);
  }
  if(blank&&kind>=2)kind+=9;
  return {kind,column,row,x:58+58*column,y:49+176*row,label};
 });
 const gaps=openings(cells).map(g=>({...g,a:cells[g.leftCell].label?.value??0,b:cells[g.rightCell].label?.value??0}));
 return {pattern,index:row,y:49+176*row,cells,gaps,labels,passed:blank};
}
function firstNumber(row,unique=true){
 const lo=Math.min(...row.labels),hi=Math.max(...row.labels);
 for(let n=lo+1;n<hi;n++){const count=row.gaps.filter(g=>between(n,g.a,g.b)).length;if(count===1||(!unique&&count>1))return n;}
 return hi;
}
function generateRow(a,data,problem,rng,index,fallback=null){
 const first=a.section===0;let row;
 // 4:753e..78fc retries the whole row, requiring one usable gap for the
 // first nine completed attempts and accepting several thereafter.
 for(let attempt=0;attempt<20;attempt++){
  row=makeRow(choosePattern(data,a.level,first,rng),index,data,a.level,problem,rng);
  if(first&&index===1)a.number=firstNumber(row,attempt<10);
  const count=row.gaps.filter(g=>between(a.number,g.a,g.b)).length;
  if(!first||attempt===19||count===1||(attempt>=9&&count>1))break;
 }
 if(first&&fallback&&!row.gaps.some(g=>between(a.number,g.a,g.b))){
  row=JSON.parse(JSON.stringify(fallback));row.index=index;row.y=49+176*index;row.cells.forEach(c=>{c.row=index;c.y=row.y;});
 }
 return row;
}
function placeRocks(rows,data,seen={},used={},beforeCell=()=>{}){
 for(const row of rows)for(const c of row.cells){
  beforeCell(c);
  if(!c.kind)continue;
  // 4:7d3b: use an unused, never-shown actor before reusing an old one.
  // The pool's history survives a screen change (4:6bbe).
  const pool=data.pools[c.kind],taken=used[c.kind]??=[],shown=seen[c.kind]??=[];
  let index=pool.findIndex((_,i)=>!taken[i]&&!shown[i]);
  if(index<0)index=pool.findIndex((_,i)=>!taken[i]);
  if(index<0){c.kind=0;continue;}
  const entry=pool[index];taken[index]=shown[index]=true;
  c.track=entry[0];c.variant=entry[1];c.dx=c.x-63;c.dy=c.y-69;
 }
}
function makeScreen(a,data,problem,rng=Math.random,resetProblems=()=>{}){
 const first=a.section===0,final=a.section===a.sections-1;
 a.subject??=0;a.problemSubject??=caveSubject(a.subject,rng);a.rockPoolSeen??={};
 const used={},beforeCell=()=>{if(a.subject===7){a.problemSubject=caveSubject(7,rng);resetProblems(a.problemSubject);}};
 const place=row=>placeRocks([row],data,a.rockPoolSeen,used,beforeCell),nextProblem=()=>problem(a.problemSubject,rng);
 a.gems=[];a.gemBonusTicks=0;a.chest=null;a.obstacle=null;a.soundQueue=[];
 // 4:6e70 stops every obstacle cue before choosing the next screen's
 // obstacle, including loops belonging to a creature left behind.
 if(!first)for(const spec of data.obstacles.rows)for(const id of spec.slice(6,9))queue(a,id,true);
 // 4:7376 builds the floor, middle, and top in that order. Each row's
 // placement/guide/obstacle/gem choices precede the next row's labels.
 if(!first&&a.level>1){const roll=rand(100,rng);if(roll<80)a.chest={kind:roll<40?2:1,x:(a.player.x>320?58:580)-18,y:369,cooldown:0};}
 const oldTop=a.rows?.find(r=>r.index===0),floor=makeRow(first?127:oldTop.pattern,2,data,a.level,problem,rng,true);
 place(floor);
 const mid=generateRow(a,data,nextProblem,rng,1);place(mid);
 const rows=[mid];a.rows=rows;
 if(a.chest)spawnObstacle(a,data,rng);
 if(!first&&a.gemsCollected<(a.sections===8?2:1)){
  const roll=rand(200,rng),threshold=a.sections===8?25:50;
  if(roll<threshold*2)a.gems.push({x:(roll<threshold?58:580)-19,y:185,ticks:Math.trunc((12+rand(9,rng))*1000/60),alive:true});
 }
 const midGap=first?mid.gaps[rand(mid.gaps.length,rng)]:null;
 let topGap=midGap;
 if(!final){
  const top=generateRow(a,data,nextProblem,rng,0,mid);place(top);rows.push(top);
  if(first)topGap=top.gaps[rand(top.gaps.length,rng)];
 }
 a.rows=rows;a.floorRow=floor;a.camera=0;a.screenFloor=401;a.gapScore=500;
 // 4:968c releases attachment slots; 4:6b0c then stops their owned
 // sounds after the new screen's obstacle controller in the same tick.
 for(const d of a.drops||[])if(d.sound)(a.dropSoundStops??=[]).push({track:d.track,pool:dropPool(d),index:d.poolIndex??0,sound:d.sound});
 a.drops=[];a.effects=[];a.fallingDrops=0;a.laser=null;a.laserFlash=null;a.helpfulDrop??=false;a.lastWrong=null;a.finalSection=final;
 a.player??={x:111,y:343,vx:0,vy:0};
 Object.assign(a.player,{y:343,vx:0,vy:0,flight:{state:4,frame:0,active:false,floor:401}});
 if(first){
  const midX=Math.trunc((midGap.left+midGap.right)/2)-23,topX=Math.trunc((topGap.left+topGap.right)/2)-23;
  a.guide={x:111,y:401,vx:0,vy:0,index:0,track:10,points:[[midX,360],[midX,184],[topX,184],[topX,8],[320,8],[320,-20]]};
 }else a.guide=null;
 return a;
}
function create(data,level,sections,problem,rng=Math.random,options={}){
 const subject=options.subject??0,problemSubject=caveSubject(subject,rng);options.resetProblems?.(problemSubject);
 return makeScreen({geometryVersion:3,subject,problemSubject,level,sections,section:0,number:0,player:null,passed:0,target:sections*2-1,correct:0,attempts:0,health:10,hitUntil:0,gemsCollected:0,tools:[]},data,problem,rng,options.resetProblems);
}
// 4:9337 advances to the next cell when center==the current right edge.
function gapAt(row,x){return row.gaps.find(g=>x>=g.left&&x<g.right)||null;}
// 4:9124: both the platform top and the41-pixel underside are inclusive.
function rowContact(a,box){return [...a.rows,a.floorRow].sort((a,b)=>a.index-b.index).find(r=>box.top<=r.y+41&&box.bottom>=r.y)||null;}
function supported(row,x,number){const g=gapAt(row,x);return !g||row.index===2||!between(number,g.a,g.b);}
// 4:986a, repeated by4:a2ac before animation advances. The proposed
// pose supplies collision dimensions; an existing pose keeps its frame.
// p.y is the feet coordinate here, matching the shared flight controller.
function resolveFlight(a,p,flight,target,next,hooks={}){
 const actor=p.flight,old=actor.state,rows=[...a.rows,a.floorRow].sort((a,b)=>a.index-b.index);
 let row=rows.find(r=>r.index===actor.row)||rows.find(r=>r.y===actor.floor)||a.floorRow;
 const result={state:next,landed:false,screenChange:false,exit:false};
 const clampGap=(g,width)=>{const left=p.x-g.left,right=g.right-p.x-width;if(left<0)p.x-=left;if(right<0)p.x+=right;if(p.x<g.left||p.x+width>g.right)p.x=58+58*(actor.cell??0)+29-Math.trunc(width/2);};
 const boxFor=(width,height)=>({left:p.x,right:p.x+width,top:p.y-height,bottom:p.y,width,height});
 for(let retry=0;retry<16;retry++){
  const s=flight.cave[next],w=s.words,f=s.track.frames[next===old?actor.frame:0],width=f[3]-f[1],height=f[4]-f[2];
  if(a.laser)a.laser.needed=false;
  if(w[1]){
   actor.blocked=false;p.vx=p.vy=0;
   if(next===old&&w[2]&&!actor.active){next=4;continue;}
   if(next!==old)p.y=row.y;
   if(next===0){if(next===old&&!actor.active){next=4;continue;}break;}
   const g=gapAt(row,p.x+Math.trunc(width/2));
   if(g){actor.gap=g;clampGap(g,width);next=w[4];continue;}
   if(!flight.cave[old].words[1]&&!a.finalSection&&row.index===0)result.screenChange=true;
   break;
  }
  if(a.finalSection){
   const cx=p.x+Math.trunc(width/2),top=p.y-height+20;
   if(cx>=254&&cx<360&&top>=0&&top<31){result.exit=true;break;}
  }else if(p.y<49){result.screenChange=true;next=4;break;}
  globalThis.MBOriginal.flightStep(p,target,next===7||next===13,Math.trunc(width/2),!!actor.blocked);
  if(actor.inRow&&actor.gap){const x=p.x;clampGap(actor.gap,width);if(x!==p.x)p.vx=0;}
  if(p.x<29){p.x=29;p.vx=0;}if(p.x>580){p.x=580;p.vx=0;}
  const ceiling=Math.trunc(69/(a.finalSection?8:2))-20;
  if(p.y<ceiling){p.y=ceiling;p.vy=0;}if(p.y>401){p.y=401;p.vy=1;}
  const touched=rowContact(a,boxFor(width,height));actor.inRow=!!touched;
  if(!touched){actor.gap=null;break;}
  row=touched;const cx=p.x+Math.trunc(width/2),g=gapAt(row,cx);
  actor.cell=Math.max(0,Math.min(8,Math.floor((cx-58)/58)));actor.gap=g;
  if(!g){
   actor.inRow=false;
   if(p.vy<0){p.y=row.y+42+height;p.vy=0;actor.gap=null;}
   else if(p.vy>0){p.y=row.y;p.vy=0;next=w[3];result.landed=true;continue;}
   break;
  }
  const line=rows.find(r=>p.y-height<=r.y&&p.y>=r.y);
  if(!line)break;row=line;
  if(between(a.number,g.a,g.b)){
   a.lastWrong=null;
   if(!row.passed){const points=a.gapScore??500;row.passed=true;a.passed++;a.attempts++;if(points===500)a.correct++;hooks.pass?.(row,points,points===500);a.gapScore=500;}
   break;
  }
  if(p.vy<0){
   hooks.laser?.(row,g,boxFor(width,height));
   if(a.lastWrong?.row===row.index&&a.lastWrong.leftCell===g.leftCell)hooks.hint?.();
   a.lastWrong={...g,row:row.index};a.gapScore=Math.max(100,(a.gapScore??500)-100);actor.blocked=true;
   p.y++;for(const r of rows)if(p.y-height<=r.y&&p.y>=r.y)p.y=r.y+height+1;
   p.vx=0;p.vy=10;next=1;
  }else if(p.vy>0){
   hooks.laser?.(row,g,null);actor.inRow=false;
   if(next===1){actor.blocked=false;next=6;}
   p.y=row.y;p.vx=p.vy=0;
  }
  break;
 }
 actor.row=row.index;actor.floor=row.y;result.state=next;return result;
}
function dropResult(number,op,value,level){
 let result=op==='+'?number+value:op==='−'?number-value:op==='×'?number*value:number/value;
 return Number.isInteger(result)&&result>-100&&result<1000&&(op!=='−'||result>=0||level>=4)?result:null;
}
// 4:9054 and 4:a742. The guide steers toward six points using the same
// integer braking law on both axes; a point is reached within six pixels.
function guideTick(a){
 const g=a.guide;if(!g)return false;
 let target=g.points[g.index];
 if(Math.abs(g.x-target[0])<=6&&Math.abs(g.y-target[1])<=6){
  if(++g.index===6){a.guide=null;return false;}target=g.points[g.index];
 }
 function accel(error,v){return Math.abs(error)>3?Math.trunc((error+(error>0?40:-40))/40)-Math.trunc(v/4):-Math.trunc(v/(Math.abs(v)>0&&Math.abs(v)<4?Math.abs(v):4));}
 g.vx+=accel(target[0]-g.x,g.vx);g.vy+=accel(target[1]-g.y,g.vy);g.x+=g.vx;g.y+=g.vy;g.track=g.vx>0?10:11;
 return true;
}
function dropSprite(d,data){
 const base=d.phase==='effect'?40:d.phase==='splash'?61:d.phase==='fall'?(d.large?49:58):(d.large?43:52),track=data.tracks[d.track??base];
 const f=track.frames[Math.min(d.frame,track.n-1)];
 return {track,frame:f,dx:d.dx,dy:d.dy,left:f[1]+d.dx,top:f[2]+d.dy,right:f[3]+d.dx,bottom:f[4]+d.dy};
}
function dropPool(d){return d.phase==='effect'?10:d.phase==='splash'?9:d.phase==='fall'?(d.large?7:8):(d.large?5:6);}
function reserveDrop(a,data,pool,retired={}){
 const entries=data.pools[pool],used=new Set(a.drops.filter(d=>d.alive&&dropPool(d)===pool).map(d=>d.poolIndex??0));
 let index=entries.findIndex((_,i)=>!used.has(i)&&!retired[pool]?.has(i));
 if(index<0)index=entries.findIndex((_,i)=>!used.has(i));
 if(index<0)return null;
 const track=entries[index][0],pending=a.dropSoundStops?.find(s=>s.track===track&&!s.reused);
 if(pending)pending.reused=true;
 return {track,poolIndex:index,sound:pending?.sound??null};
}
function spawnDrop(a,data,subject,rng=Math.random){
 if(a.section===0)return null;
 // 4:81f8 walks top row to middle row, left to right, slot1 then slot2.
 const rocks=a.rows.slice().sort((a,b)=>a.index-b.index).flatMap(r=>r.cells.filter(c=>c.kind));
 const wanted=Math.min(Math.floor(rocks.length/2),a.finalSection?3:6);
 // A splash or collection effect still owns its attachment slot (4:855c).
 if(a.drops.filter(d=>d.alive).length>=wanted)return null;
 const free=[];
 for(const c of rocks)for(let slot=0;slot<2;slot++)if(!a.drops.some(d=>d.alive&&d.row===c.row&&d.column===c.column&&d.slot===slot))free.push({c,slot});
 if(!free.length)return null;
 const {c,slot}=free[rand(free.length,rng)],large=!!rand(2,rng),actor=reserveDrop(a,data,large?5:6);
 if(!actor)return null;
 const track=data.tracks[actor.track];
 const attach=data.tracks[155].frames[c.variant*2+slot],rock=data.tracks[c.track].frames[0];
 const {op,value}=dropArithmetic(a,large,subject,rng);
 const support=[...a.rows,a.floorRow].filter(r=>r.index>c.row&&r.cells[c.column].kind).sort((a,b)=>a.index-b.index)[0];
 const d={...actor,alive:true,active:true,next:0,phase:'grow',large,row:c.row,column:c.column,slot,op,value,frame:0,vy:0,hang:0,
  dx:rock[1]+attach[1]+c.x-track.frames[0][1]-63,dy:c.y-track.frames.at(-1)[2]+attach[2],supportY:support?.y??null};
 d.nextDY=d.dy;
 a.drops.push(d);return d;
}
function dropsTick(a,data,box,airborne,subject,onCollect=()=>{},onSound=()=>{},rng=Math.random,deferAnimation=false,onStop=()=>{}){
 // 4:c822: allocate first, then visit slots in row/column order. All
 // animation frames advance afterward in5:081a, after hero/controller logic.
 a.fallingDrops??=a.drops.filter(d=>d.alive&&d.phase==='fall').length;
 for(const d of a.drops)if(d.active===undefined){const n=data.tracks[dropPool(d)===10?40:dropPool(d)===9?61:d.phase==='fall'?(d.large?49:58):(d.large?43:52)].n;d.active=d.phase!=='hang'&&(d.phase==='fall'||d.frame<n-1);d.next=d.phase==='fall'?(d.frame+1)%n:d.frame+1;d.nextDY=d.dy;}
 spawnDrop(a,data,subject,rng);
 const retired={};
 function release(d){const pool=dropPool(d);if(d.sound){(a.dropSoundStops??=[]).push({track:d.track,pool,index:d.poolIndex??0,sound:d.sound});d.sound=null;}(retired[pool]??=new Set()).add(d.poolIndex??0);}
 function change(d,pool,phase,dx,dy){const actor=reserveDrop(a,data,pool,retired);if(!actor)return false;release(d);Object.assign(d,actor,{phase,active:true,next:0,frame:0,dx,dy,nextDY:dy,vy:0});return true;}
 // WANIM1:0f5e collides the displayed bitmap, not the motion descriptor.
 // The fully grown large drop is31×39, while its descriptor is29×36.
 function touching(d){const b=dropSprite(d,data),size=data.sizes?.[b.frame[0]],right=size?b.left+size[0]:b.right,bottom=size?b.top+size[1]:b.bottom;return box.left<right&&box.right>b.left&&box.top<bottom&&box.bottom>b.top;}
 function collect(d){
  const result=dropResult(a.number,d.op,d.value,a.level);if(result==null)return false;
  a.number=result;if(d.phase==='fall')a.fallingDrops--;
  const b=dropSprite(d,data),f=data.tracks[40].frames[0];change(d,10,'effect',b.left-f[1],b.top-f[2]);onCollect(d);return true;
 }
 for(const e of a.effects)e.frame++;a.effects=a.effects.filter(e=>e.frame<4);
 for(const d of a.drops.slice().sort((a,b)=>a.row-b.row||a.column-b.column||a.slot-b.slot)){
  if(!d.alive)continue;
  if(d.phase==='grow'){
   if(!d.active){d.phase='hang';d.hang=rand(200,rng);}
  }else if(d.phase==='hang'){
   if(airborne&&touching(d)&&collect(d))continue;
   if(--d.hang<0&&a.fallingDrops<3&&change(d,d.large?7:8,'fall',d.dx,d.dy))a.fallingDrops++;
  }else if(d.phase==='fall'){
   if(!d.active){
    // 4:82e6 reanchors every splash using large-growth frame10 and
    // attachment0, regardless of the former droplet's size or slot.
    if(change(d,9,'splash',d.dx,(d.supportY??0)-237)){a.fallingDrops--;if(d.supportY==null){release(d);d.alive=false;}}
   }else if(touching(d))collect(d);
  }else if(!d.active){release(d);d.alive=false;}
 }
 a.drops=a.drops.filter(d=>d.alive);
 if(!deferAnimation){finishDropSounds(a,onStop);animateDrops(a,data,onSound,onStop);}
}
function finishDropSounds(a,stop=()=>{}){
 // 4:6b0c releases retired pooled actors after flight/obstacle control,
 // before laser cleanup and the shared frame pass. Reused slots survive.
 for(const s of (a.dropSoundStops||[]).sort((a,b)=>a.pool-b.pool||a.index-b.index))if(!s.reused)stop(s.sound);
 a.dropSoundStops=[];
}
function animateDrops(a,data,onSound=()=>{},onStop=()=>{}){
 // 5:081a paints the current frame before acceleration and testing the
 // NEXT frame's bounds. A completed animation remains visible until its
 // owning controller releases or replaces it on a subsequent tick.
 for(const d of a.drops.slice().sort((a,b)=>(a.track??0)-(b.track??0))){
  if(!d.active)continue;
  const track=data.tracks[d.track??(d.phase==='effect'?40:d.phase==='splash'?61:d.phase==='fall'?(d.large?49:58):(d.large?43:52))];
  d.frame=d.next;d.dy=d.nextDY;const cue=track.frames[d.frame][5];if(cue){if(d.sound)onStop(d.sound);d.sound=cue-32768;onSound(d.sound);}
  d.next++;
  if(d.phase==='fall'){
   d.vy++;d.nextDY+=d.vy;d.next%=track.n;
   const f=track.frames[d.next],top=f[2]+d.nextDY,left=f[1]+d.dx,maxTop=d.supportY==null?420:d.supportY-32;
   if(left<0||left>640||top<-20||top>maxTop)d.active=false;
  }else if(d.next===track.n)d.active=false;
 }
}
// The obstacle controllers use the same frame-relative motion as 5:081a.
// Walking/rolling displacement is applied when a frame sequence wraps, rather
// than a guessed velocity added to every frame. Bounds test the NEXT frame.
function animation(track,data,dx,dy,options={}){
 return {track,frame:-1,next:0,dx,dy,drawDX:dx,drawDY:dy,active:true,loop:false,wrapX:0,wrapY:0,minX:-640,maxX:1280,minY:-20,maxY:420,...options};
}
function animationBox(s,data){
 if(!s||s.frame<0)return null;
 const t=data.tracks[s.track],f=t.frames[s.frame];
 return {track:s.track,frame:s.frame,dx:s.drawDX,dy:s.drawDY,left:f[1]+s.drawDX,top:f[2]+s.drawDY,right:f[3]+s.drawDX,bottom:f[4]+s.drawDY};
}
function animationTick(s,data,stop=()=>{}){
 if(!s?.active)return 0;
 s.frame=s.next;s.drawDX=s.dx;s.drawDY=s.dy;
 const cue=data.tracks[s.track].frames[s.frame][5];
 if(cue){if(s.sound)stop(s.sound);s.sound=cue-32768;}
 if(++s.next===data.tracks[s.track].n){
  if(!s.loop){s.active=false;return cue?cue-32768:0;}
  s.next=0;s.dx+=s.wrapX;s.dy+=s.wrapY;
 }
 if(s.loop){const f=data.tracks[s.track].frames[s.next],x=f[1]+s.dx,y=f[2]+s.dy;if(x<s.minX||x>s.maxX||y<s.minY||y>s.maxY)s.active=false;}
 return cue?cue-32768:0;
}
function startLaser(a,data,row,gap,hitBox=null){
 // 4:9f32: one beam remains attached until its impact flash has ended.
 if(!a.laser){const track=gap.rightCell-gap.leftCell-1,f=data.tracks[track].frames[0];a.laser={...animation(track,data,gap.left-f[1],row.y-f[2],{loop:true,minX:0,maxX:640,minY:-20,maxY:420}),key:row.index+':'+gap.leftCell+':'+gap.rightCell,x:gap.left,y:row.y};}
 a.laser.needed=true;
 if(hitBox&&!a.laserFlash?.active){const f=data.tracks[0].frames[0];a.laserFlash=animation(0,data,hitBox.left+Math.trunc(hitBox.width/2)-Math.trunc((f[3]-f[1])/2)-f[1],hitBox.top-Math.trunc((f[4]-f[2])/2)-f[2]);}
}
function updateLasers(a,data,play=()=>{},stop=()=>{}){
 if(a.laser?.next===undefined&&a.laser){const old=a.laser,f=data.tracks[old.track].frames[0];a.laser={...old,...animation(old.track,data,old.x-f[1],old.y-f[2],{loop:true,minX:0,maxX:640,minY:-20,maxY:420,frame:old.frame??0,next:((old.frame??0)+1)%data.tracks[old.track].n})};}
 // 4:c86a..c8c3 cleanup precedes the generic actor0..7 frame pass.
 if(a.laserFlash&&!a.laserFlash.active)a.laserFlash=null;
 if(a.laser&&!a.laser.needed&&!a.laserFlash){stop(8237);a.laser=null;}
 for(const actor of [a.laserFlash,a.laser])if(actor){const cue=animationTick(actor,data,stop);if(cue)play(cue);}
}
function obstacleAnimation(o,data,track,left,feet,options={}){
 const f=data.tracks[track].frames[0];return animation(track,data,left-f[1],feet-f[4],options);
}
function queue(a,id,stop=false){if(id)(a.soundQueue??=[]).push({id,stop});}
function spawnObstacle(a,data,rng=Math.random){
 if(!a.chest||!data.obstacles)return null;
 const row=a.rows.find(r=>r.index===1),first=row.gaps[0],last=row.gaps.at(-1),choice=rand(100,rng),narrow=rand(100,rng)<50&&(first.rightCell-first.leftCell===2||last.rightCell-last.leftCell===2);
 const kind=narrow?(choice<50?2:3):(choice<50?1:4),left=narrow?first.rightCell-first.leftCell===2:9-last.rightCell<first.leftCell+1,gap=left?first:last;
 const spec=data.obstacles.rows[kind],track=spec[left?0:1],f=data.tracks[track].frames[0],width=f[3]-f[1],height=f[4]-f[2];
 let end=kind===1?(left?first.left+14:last.right-14):kind===2?(left?first.right:last.left):Math.trunc((gap.left+gap.right)/2)+(left?1:-1)*Math.trunc(11*width/20);
 const minX=kind===4?-width:left?-2*width:end,maxX=kind===4?640:left?end-width:640;
 const x=left?minX:maxX,feet=row.y+spec[4],o={kind,left,gap,phase:0,defeated:false,wait:1,minX,maxX,minY:row.y-height+spec[4],maxY:row.y-height,wrap:spec[5],feet,secondary:null,light:null};
 o.main=obstacleAnimation(o,data,track,x,feet,{loop:true,wrapX:(left?1:-1)*spec[5],minX:left?-640:minX,maxX:left?maxX:1280});
 if(kind===4)Object.assign(o,{x,y:feet-height,targetX:x,targetY:feet-height,vx:0,vy:0});
 a.obstacle=o;queue(a,spec[6]);return o;
}
const toolNames=['','bug spray','hammer','scissors','flashlight'];
function awardTool(a,rng=Math.random){
 let kind=a.obstacle?.kind||(rand(5,rng)<1?1:rand(5,rng));
 a.tools??=[];
 if(a.tools.includes(kind))kind=[1,2,3,4].find(k=>!a.tools.includes(k))??4;
 if(!a.tools.includes(kind))a.tools.push(kind);
 return kind;
}
function obstacleContact(a,data,box){
 const o=a.obstacle,b=o&&!o.defeated&&animationBox(o.main,data);
 if(!b||box.left>=b.right||box.right<=b.left||box.top>=b.bottom||box.bottom<=b.top)return null;
 const spec=data.obstacles.rows[o.kind],i=(a.tools||[]).indexOf(o.kind);
 if(i>=0){a.tools.splice(i,1);o.defeated=true;queue(a,spec[6],true);queue(a,spec[7],true);queue(a,spec[8]);return {used:o.kind};}
 return {blocked:o.kind};
}
function obstacleTick(a,data,rng=Math.random,deferFrameCues=false){
 const o=a.obstacle;if(!o)return;
 const spec=data.obstacles.rows[o.kind],b=animationBox(o.main,data),ready=!o.main.active&&(!o.secondary||!o.secondary.active),rowY=225;
 const pause=()=>Math.trunc((rand(9,rng)+2)*1000/60);
 const erase=(stopDefeat=true)=>{if(stopDefeat)queue(a,spec[8],true);for(const row of data.obstacles.rows)for(const id of row.slice(6,9))queue(a,id,true);for(const actor of [o.main,o.secondary,o.light].filter(Boolean).sort((a,b)=>a.track-b.track))if(actor.sound)queue(a,actor.sound,true);a.obstacle=null;};
 const walk=(out=false)=>{
  const left=out?!o.left:o.left,track=o.kind===1?(left?16:17):(left?25:24),f=data.tracks[track].frames[0];
  let x=out?b?.left??o.minX:o.left?o.minX:o.maxX;
  if(o.kind===3)x=Math.trunc((o.gap.left+o.gap.right)/2)-Math.trunc((f[3]-f[1])/2);
  return obstacleAnimation(o,data,track,x,o.feet,{loop:true,wrapX:(left?1:-1)*o.wrap,minX:left?-640:o.minX,maxX:left?o.maxX:1280});
 };
 if(o.kind===1&&(ready||o.defeated)){
  if(o.defeated&&o.phase<4){
   const flipped=o.phase===2||o.phase===3,track=o.left!==flipped?12:13,offset=track===13?data.tracks[154].frames[2][3]-data.tracks[154].frames[2][1]:0;
   o.main=obstacleAnimation(o,data,track,(b?.left??0)+offset,o.feet);o.phase=6;
  }else if(o.phase===0){
   queue(a,spec[6],true);o.main=obstacleAnimation(o,data,o.left?14:15,b.left,o.feet);o.phase=1;o.wait=pause();
  }else if(o.phase===1&&--o.wait===0){o.main=obstacleAnimation(o,data,o.left?18:19,b.left,o.feet);o.phase=2;
  }else if(o.phase===2){o.main=walk(true);o.phase=3;
  }else if(o.phase===3){o.phase=4;o.wait=pause();
  }else if(o.phase===4&&--o.wait===0){o.main=walk();o.phase=0;queue(a,spec[6]);
  }else if(o.phase===6&&!o.main.active){erase();}
 }else if(o.kind===2&&(ready||o.defeated)){
  if(o.phase===0&&o.defeated){erase(false);
  }else if(o.phase===0){
   queue(a,spec[6],true);const f=data.tracks[o.main.track].frames[o.main.next],g=data.tracks[154].frames[10];
   o.main=animation(o.main.track,data,o.gap.left+(g[3]-g[1])-f[1],rowY+(g[4]-g[2])-f[4],{next:o.main.next,frame:o.main.next,active:false});o.phase=1;
  }else if(o.phase===1&&o.defeated){const f=data.tracks[20].frames[0];o.main=animation(20,data,b.left-f[1],b.top-f[2]);o.phase=3;
  }else if(o.phase===3&&!o.main.active){erase();}
 }else if(o.kind===3&&(ready||o.defeated)){
  if(o.phase===0&&o.defeated){erase(false);
  }else if(o.phase===0){
   queue(a,spec[6],true);const web=o.left?29:28,bug=o.left?27:26,w=data.tracks[web].frames.at(-1),f=data.tracks[bug].frames[0],cx=Math.trunc((o.gap.left+o.gap.right)/2);
   o.main=animation(web,data,cx-Math.trunc((w[1]+w[3])/2),rowY-Math.trunc((w[2]+w[4])/2));
   o.secondary=animation(bug,data,cx-Math.trunc((f[1]+f[3])/2),rowY-Math.trunc((f[2]+f[4])/2));o.phase=1;queue(a,spec[7]);
  }else if(o.phase===1&&!o.defeated){queue(a,spec[7],true);o.secondary=walk(true);o.phase=2;
  }else if((o.phase===1||o.phase===2||o.phase===3)&&o.defeated){
   const f=data.tracks[23].frames[0],cx=Math.trunc((o.gap.left+o.gap.right)/2);o.secondary=null;
   o.main=animation(23,data,cx-Math.trunc((f[1]+f[3])/2),rowY-Math.trunc((f[2]+f[4])/2));o.phase=5;
  }else if(o.phase===2){o.secondary=null;o.phase=3;
  }else if(o.phase===5&&!o.main.active){erase();}
 }else if(o.kind===4){
  if(o.defeated&&!o.light){const goLeft=a.player.x>o.x;o.targetX=goLeft?o.minX:o.maxX;o.targetY=goLeft?o.minY:o.maxY;o.light={track:goLeft?31:32};}
  const arrived=Math.abs(o.x-o.targetX)<=6&&Math.abs(o.y-o.targetY)<=6;
  let move=!arrived;
  if(arrived){
   if(o.defeated)erase();
   else if(--o.wait===0){
    o.wait=pause();const w=o.maxX-o.minX,h=o.maxY-o.minY,third=Math.trunc(w/3),twelfth=Math.trunc(w/12);
    const right=o.targetX<=Math.trunc((o.minX+o.maxX)/2),lo=right?o.maxX-third:o.minX+twelfth,hi=right?o.maxX-twelfth:o.minX+third;
    o.targetX=lo+rand(hi-lo+1,rng);o.targetY=o.minY+Math.trunc(h/12)+rand(h-2*Math.trunc(h/12)+1,rng);queue(a,spec[6]);move=true;
   }
  }
  if(move){
   const accel=(error,v)=>Math.abs(error)>3?Math.trunc((error+(error>0?40:-40))/40)-Math.trunc(v/4):-Math.trunc(v/(Math.abs(v)>0&&Math.abs(v)<4?Math.abs(v):4));
   o.vx+=accel(o.targetX-o.x,o.vx);o.vy+=accel(o.targetY-o.y,o.vy);
   o.x=Math.max(o.minX,Math.min(o.maxX,o.x+o.vx));o.y=Math.max(o.minY,Math.min(o.maxY,o.y+o.vy));
   const f=data.tracks[30].frames[0];o.main.dx=o.x-f[1];o.main.dy=o.y-f[4];
   if(!o.main.active)o.main=obstacleAnimation(o,data,30,o.x,o.y,{loop:true,minX:o.minX,maxX:o.maxX});
   if(o.light){const track=o.light.track,g=data.tracks[154].frames[track===31?11:12];o.light=obstacleAnimation(o,data,track,o.x+g[3]-g[1],o.y,{loop:true,minX:o.minX,maxX:o.maxX});}
  }
 }
 const frameCues=[];
 if(a.obstacle)for(const s of [o.main,o.secondary,o.light].filter(s=>s?.next!==undefined).sort((a,b)=>a.track-b.track)){const cue=animationTick(s,data);if(cue)frameCues.push(cue);}
 if(!deferFrameCues)for(const cue of frameCues)queue(a,cue);
 return frameCues;
}
function obstacleSprites(a,data){return a.obstacle?[a.obstacle.main,a.obstacle.secondary,a.obstacle.light].map(s=>s?.next!==undefined?animationBox(s,data):null).filter(Boolean).sort((a,b)=>data.tracks[a.track].z-data.tracks[b.track].z):[];}
globalThis.MBCave={shape,openings,patternAllowed,makeRow,generateRow,firstNumber,placeRocks,makeScreen,create,gapAt,rowContact,supported,resolveFlight,between,caveSubject,dropTarget,dropArithmetic,dropResult,dropSprite,spawnDrop,dropsTick,finishDropSounds,animateDrops,guideTick,animation,animationBox,animationTick,startLaser,updateLasers,spawnObstacle,obstacleTick,obstacleContact,obstacleSprites,awardTool,toolNames};
})();
