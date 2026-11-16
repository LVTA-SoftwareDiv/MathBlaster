const assert=require('node:assert/strict');
const {TouchHolds,HorizontalStick,bindHorizontalStick}=require('../pwa/touch-input.js');
const {fitGame,MobileBackdrop}=require('../pwa/stage.js');
const calls=[],holds=new TouchHolds((...args)=>calls.push(args)),stick=new HorizontalStick(holds);
holds.press(1,' ');assert(stick.start(2,0));assert.deepEqual(calls,[[' ',true]]);
stick.move(2,.8);stick.move(2,.9);assert.deepEqual(calls,[[' ',true],['ArrowRight',true]],'dragging within one side does not retrigger steering');
assert.equal(stick.start(3,-1),false,'a second joystick finger cannot steal the first');
stick.move(3,-1);assert.equal(stick.key,'ArrowRight');
stick.move(2,-.9);assert.deepEqual(calls.slice(-2),[['ArrowRight',false],['ArrowLeft',true]],'crossing the center changes direction');
stick.move(2,.1);assert.deepEqual(calls.at(-1),['ArrowLeft',false]);assert.equal(holds.pointers.get(1),' ','dead zone preserves simultaneous thrust');
stick.move(2,3);assert.equal(stick.value,1);stick.end(2);assert.equal(stick.value,0);assert.equal(stick.pointer,null);assert.equal(holds.pointers.get(1),' ');
stick.start(4,-1);stick.clear();holds.clear();assert.equal(holds.pointers.size,0);assert.equal(stick.key,null);
// Exercise the actual browser event binding, including release outside the
// joystick and a touch ending while another finger continues holding thrust.
function eventTarget(){const listeners=new Map();return {addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},emit(type,event){for(const fn of listeners.get(type)||[])fn(event);},setPointerCapture(){}};}
const surface=eventTarget(),page=eventTarget(),events=[],inputHolds=new TouchHolds((...event)=>events.push(event)),inputStick=new HorizontalStick(inputHolds);
let painted=null;bindHorizontalStick(surface,inputStick,()=>painted=inputStick.value,e=>e.value,page);
const pointer=(id,type='touch',value=.9)=>({pointerId:id,pointerType:type,button:0,buttons:1,value,preventDefault(){}});
for(const [target,type] of [[page,'pointerup'],[page,'pointercancel'],[surface,'lostpointercapture']]){
 surface.emit('pointerdown',pointer(10));assert.equal(painted,.9);
 target.emit(type,pointer(10));assert.equal(painted,0,type+' immediately paints the centered knob');
 assert.equal(inputStick.pointer,null);assert.equal(inputHolds.pointers.size,0,type+' stops horizontal steering');
}
inputHolds.press(20,' ');surface.emit('pointerdown',pointer(10));surface.emit('touchstart',{changedTouches:[{identifier:91}]});
surface.emit('pointerdown',pointer(11));surface.emit('touchstart',{changedTouches:[{identifier:92}]});
page.emit('pointerup',pointer(11));page.emit('touchend',{changedTouches:[{identifier:92}],touches:[{identifier:91},{identifier:93}]});
assert.equal(inputStick.pointer,10,'another finger ending cannot steal joystick ownership');
page.emit('touchend',{changedTouches:[{identifier:91}],touches:[{identifier:93}]});
assert.equal(painted,0,'touch-end fallback centers the joystick when pointerup is missing');
assert.equal(inputHolds.pointers.get(20),' ','joystick release preserves held thrust');inputHolds.clear();
surface.setPointerCapture=()=>{throw Error('Capture unavailable');};
surface.emit('pointerdown',pointer(12,'mouse',-.8));page.emit('pointermove',{...pointer(12,'mouse',-.9),buttons:0});
assert.equal(painted,0,'released mouse cannot leave steering latched when capture fails');
surface.emit('pointerdown',pointer(13));page.emit('touchcancel',{changedTouches:[],touches:[]});
assert.equal(painted,0,'all touches cancelled clears ownership even without a touchstart');
for(const [width,height,insets] of [[844,390,{}],[667,320,{}],[1024,768,{}],[1366,1024,{}],[844,390,{left:47,right:47,top:0,bottom:21}]]){
 const f=fitGame(width,height,insets);assert(Math.abs(f.width/f.height-640/425)<1e-12,'uniform original aspect ratio');
 assert(f.left>=(insets.left||0));assert(f.top>=(insets.top||0));assert(f.left+f.width<=width-(insets.right||0)+1e-9);assert(f.top+f.height<=height-(insets.bottom||0)+1e-9);
 assert(Math.abs(f.width-(width-(insets.left||0)-(insets.right||0)))<1e-9||Math.abs(f.height-(height-(insets.top||0)-(insets.bottom||0)))<1e-9,'game uses one full available dimension');
}
const paints=[],ctx={clearRect(){},drawImage(...args){paints.push(args);},save(){},restore(){},translate(){},scale(){}};
const canvas={width:844,height:390,getContext:()=>ctx},backdrop=new MobileBackdrop(canvas),image={complete:true,naturalWidth:640};
backdrop.resize(844,390,fitGame(844,390));backdrop.begin('blaster');backdrop.paint(image,35);
assert.deepEqual(paints.at(-1),[image,0,35,640,425,0,0,844,390]);
const count=paints.length;backdrop.paint(image,35);assert.equal(paints.length,count,'unchanged scenery is not repainted every animation tick');
backdrop.begin('movie');assert.equal(backdrop.image,null,'cutscenes do not inherit stretched game scenery');
for(const [width,height,insets] of [[844,390,{}],[667,320,{}],[1024,768,{}],[844,390,{left:47,right:47,bottom:21}]]){
 const frame=fitGame(width,height,insets),scale=frame.width/640;
 backdrop.begin('cave');backdrop.paint(image,35);paints.length=0;backdrop.resize(width,height,frame);
 const [left,center,right]=paints;
 assert.equal(left[5],0,'left wall reaches the physical screen edge');
 assert(Math.abs(right[5]+right[7]-width)<1e-9,'right wall reaches the physical screen edge');
 assert.equal(left[5]+left[7],center[5],'no gap at the left platform joint');
 assert.equal(center[5]+center[7],right[5],'no gap at the right platform joint');
 // The first/last possible openings (116..524) and all row heights must keep
 // the original gameplay mapping, even with a wide phone or safe-area insets.
 for(const x of [116,174,232,290,348,406,464,524]){
  const paintedX=center[5]+(x-center[1])*center[7]/center[3];
  assert(Math.abs(paintedX-(frame.left+x*scale))<1e-9,'numbered openings stay aligned with collisions');
 }
 for(const strip of [left,center,right])for(const rowY of [69,245,421]){
  const paintedY=strip[6]+(rowY-strip[2])*strip[8]/strip[4];
  assert(Math.abs(paintedY-(frame.top+(rowY-35)*scale))<1e-9,'wall shelves align with every rock row');
 }
}
backdrop.resize(1024,768,fitGame(1024,768));backdrop.begin('recycler');paints.length=0;backdrop.paint(image,34,true);
assert.equal(paints.length,3);assert.equal(paints[0][7]/paints[0][8],640/425,'Recycler machine keeps its proportions');
assert.equal(paints[1][4],1);assert.equal(paints[2][4],1,'top/bottom extensions cannot duplicate machine parts');
console.log('Stage: proportional full-screen fit, connected Cave walls/openings/row heights, safe areas, scenery-only stretching, joystick dead zone, simultaneous thrust, outside release, touch-end fallback, capture failure and cancellation passed.');
