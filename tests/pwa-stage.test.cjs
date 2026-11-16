const assert=require('node:assert/strict');
const {TouchHolds,HorizontalStick}=require('../pwa/touch-input.js');
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
for(const [width,height,insets] of [[844,390,{}],[667,320,{}],[1024,768,{}],[1366,1024,{}],[844,390,{left:47,right:47,top:0,bottom:21}]]){
 const f=fitGame(width,height,insets);assert(Math.abs(f.width/f.height-640/425)<1e-12,'uniform original aspect ratio');
 assert(f.left>=(insets.left||0));assert(f.top>=(insets.top||0));assert(f.left+f.width<=width-(insets.right||0)+1e-9);assert(f.top+f.height<=height-(insets.bottom||0)+1e-9);
 assert(Math.abs(f.width-(width-(insets.left||0)-(insets.right||0)))<1e-9||Math.abs(f.height-(height-(insets.top||0)-(insets.bottom||0)))<1e-9,'game uses one full available dimension');
}
const paints=[],ctx={clearRect(){},drawImage(...args){paints.push(args);},save(){},restore(){},translate(){},scale(){}};
const canvas={width:844,height:390,getContext:()=>ctx},backdrop=new MobileBackdrop(canvas),image={complete:true,naturalWidth:640};
backdrop.resize(844,390,fitGame(844,390));backdrop.begin('cave');backdrop.paint(image,35);
assert.deepEqual(paints.at(-1),[image,0,35,640,425,0,0,844,390]);
const count=paints.length;backdrop.paint(image,35);assert.equal(paints.length,count,'unchanged scenery is not repainted every animation tick');
backdrop.begin('movie');assert.equal(backdrop.image,null,'cutscenes do not inherit stretched game scenery');
backdrop.resize(1024,768,fitGame(1024,768));backdrop.begin('recycler');paints.length=0;backdrop.paint(image,34,true);
assert.equal(paints.length,3);assert.equal(paints[0][7]/paints[0][8],640/425,'Recycler machine keeps its proportions');
assert.equal(paints[1][4],1);assert.equal(paints[2][4],1,'top/bottom extensions cannot duplicate machine parts');
console.log('Stage: proportional full-screen fit, safe areas, scenery-only stretching, joystick dead zone, simultaneous thrust, direction changes and cancellation passed.');
