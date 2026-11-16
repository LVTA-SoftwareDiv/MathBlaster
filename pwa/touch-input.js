'use strict';
// Independent pointers allow steering and thrust together. Releasing one finger
// never releases another finger holding the same action.
class TouchHolds {
 constructor(send){this.send=send;this.pointers=new Map();}
 press(pointer,key){this.release(pointer);const held=[...this.pointers.values()].includes(key);this.pointers.set(pointer,key);if(!held)this.send(key,true);}
 release(pointer){const key=this.pointers.get(pointer);if(key===undefined)return;this.pointers.delete(pointer);if(![...this.pointers.values()].includes(key))this.send(key,false);}
 clear(){for(const key of new Set(this.pointers.values()))this.send(key,false);this.pointers.clear();}
}
class HorizontalStick {
 constructor(holds,deadZone=.18){this.holds=holds;this.deadZone=deadZone;this.pointer=null;this.key=null;this.value=0;}
 start(pointer,value){if(this.pointer!==null)return false;this.pointer=pointer;this.move(pointer,value);return true;}
 move(pointer,value){
  if(pointer!==this.pointer)return this.value;
  this.value=Math.max(-1,Math.min(1,value));
  const key=this.value < -this.deadZone?'ArrowLeft':this.value > this.deadZone?'ArrowRight':null;
  if(key!==this.key){this.holds.release(pointer);if(key)this.holds.press(pointer,key);this.key=key;}
  return this.value;
 }
 end(pointer){if(pointer!==this.pointer)return false;this.holds.release(pointer);this.pointer=null;this.key=null;this.value=0;return true;}
 clear(){if(this.pointer!==null)this.end(this.pointer);}
}
function bindHorizontalStick(element,stick,paint,valueAt,root=document){
 let touchId=null,pointerType=null;
 const finish=pointer=>{if(stick.end(pointer)){touchId=null;pointerType=null;paint();}};
 element.addEventListener('pointerdown',event=>{
  if(event.button!==undefined&&event.button!==0)return;
  event.preventDefault();
  if(!stick.start(event.pointerId,valueAt(event)))return;
  touchId=null;pointerType=event.pointerType;
  // Document listeners still handle release if capture is unavailable/lost.
  try{element.setPointerCapture(event.pointerId);}catch(error){}
  paint();
 });
 root.addEventListener('pointermove',event=>{
  if(stick.pointer!==event.pointerId)return;
  if(event.pointerType!=='touch'&&event.buttons===0){finish(event.pointerId);return;}
  event.preventDefault();stick.move(event.pointerId,valueAt(event));paint();
 },{capture:true,passive:false});
 for(const type of ['pointerup','pointercancel'])root.addEventListener(type,event=>finish(event.pointerId),true);
 element.addEventListener('lostpointercapture',event=>finish(event.pointerId));
 // A touch-end fallback also clears the owning finger without interrupting a
 // second finger that is still holding Thrust. Touch and pointer IDs differ.
 element.addEventListener('touchstart',event=>{
  if(pointerType==='touch'&&touchId===null&&event.changedTouches.length)touchId=event.changedTouches[0].identifier;
 },{passive:true});
 for(const type of ['touchend','touchcancel'])root.addEventListener(type,event=>{
  if(pointerType==='touch'&&(touchId===null?event.touches.length===0:Array.from(event.changedTouches).some(t=>t.identifier===touchId)))finish(stick.pointer);
 },{capture:true,passive:true});
}
if(typeof module!=='undefined')module.exports={TouchHolds,HorizontalStick,bindHorizontalStick};
else {
 window.TouchHolds=TouchHolds;
 window.HorizontalStick=HorizontalStick;
 window.bindHorizontalStick=bindHorizontalStick;
 // Safari may ignore viewport scale limits. Cancel its zoom gestures without
 // cancelling touch/pointer events needed for simultaneous thrust and steering.
 const preventZoom=event=>event.preventDefault();
 for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])
  document.addEventListener(type,preventZoom,{capture:true,passive:false});
}
