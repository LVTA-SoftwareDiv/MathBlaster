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
if(typeof module!=='undefined')module.exports={TouchHolds,HorizontalStick};
else {
 window.TouchHolds=TouchHolds;
 window.HorizontalStick=HorizontalStick;
 // Safari may ignore viewport scale limits. Cancel its zoom gestures without
 // cancelling touch/pointer events needed for simultaneous thrust and steering.
 const preventZoom=event=>event.preventDefault();
 for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])
  document.addEventListener(type,preventZoom,{capture:true,passive:false});
}
