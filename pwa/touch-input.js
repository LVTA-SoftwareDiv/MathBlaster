'use strict';
// Independent pointers allow steering and thrust together. Releasing one finger
// never releases another finger holding the same action.
class TouchHolds {
 constructor(send){this.send=send;this.pointers=new Map();}
 press(pointer,key){this.release(pointer);const held=[...this.pointers.values()].includes(key);this.pointers.set(pointer,key);if(!held)this.send(key,true);}
 release(pointer){const key=this.pointers.get(pointer);if(key===undefined)return;this.pointers.delete(pointer);if(![...this.pointers.values()].includes(key))this.send(key,false);}
 clear(){for(const key of new Set(this.pointers.values()))this.send(key,false);this.pointers.clear();}
}
if(typeof module!=='undefined')module.exports={TouchHolds};
else {
 window.TouchHolds=TouchHolds;
 // Safari may ignore viewport scale limits. Cancel its zoom gestures without
 // cancelling touch/pointer events needed for simultaneous thrust and steering.
 const preventZoom=event=>event.preventDefault();
 for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])
  document.addEventListener(type,preventZoom,{capture:true,passive:false});
}
