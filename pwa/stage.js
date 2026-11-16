'use strict';
(() => {
function fitGame(width,height,{left=0,right=0,top=0,bottom=0}={}){
 const availableWidth=Math.max(1,width-left-right),availableHeight=Math.max(1,height-top-bottom);
 const scale=Math.min(availableWidth/640,availableHeight/425),w=640*scale,h=425*scale;
 return {left:left+(availableWidth-w)/2,top:top+(availableHeight-h)/2,width:w,height:h};
}
class MobileBackdrop {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.scene='';this.image=null;this.frame=null;}
 begin(scene){if(scene!==this.scene){this.scene=scene;this.image=null;this.planet=null;this.repaint();}}
 paint(image,sourceY,preserveCenter=false){
  if(this.image===image&&this.sourceY===sourceY&&this.preserveCenter===preserveCenter)return;
  this.image=image;this.sourceY=sourceY;this.preserveCenter=preserveCenter;this.repaint();
 }
 paintPlanet(image,x,y){
  const ready=image?.complete&&image.naturalWidth?image:null;
  if(this.planet?.image===ready&&this.planet.x===x&&this.planet.y===y)return;
  this.planet={image:ready,x,y};this.repaint();
 }
 resize(width,height,frame){this.canvas.width=Math.round(width);this.canvas.height=Math.round(height);this.frame=frame;this.repaint();}
 repaint(){
  const {canvas,ctx,image,frame}=this,w=canvas.width,h=canvas.height;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);
  if(!image?.complete||!image.naturalWidth)return;
  if(this.scene==='cave'&&frame){
   // Cave wall shelves are part of the background bitmap. Keep their joints
   // with the 58-pixel rock cells aligned; stretching the entire bitmap leaves
   // false openings between those shelves and the foreground platforms.
   const {left,top,width,height}=frame,scale=width/640;
   const firstJoint=left+64*scale,lastJoint=left+576*scale;
   ctx.drawImage(image,0,this.sourceY,64,425,0,top,firstJoint,height);
   ctx.drawImage(image,64,this.sourceY,512,425,firstJoint,top,lastJoint-firstJoint,height);
   ctx.drawImage(image,576,this.sourceY,64,425,lastJoint,top,w-lastJoint,height);
   // Taller tablets also need scenery above/below the game. Reflect a narrow
   // texture strip after the wall joints are aligned, avoiding stretched pixels
   // or duplicated shelves (which are farther than 15 source pixels away).
   const strip=Math.min(15*scale,height),bottom=top+height;
   if(top>0){ctx.save();ctx.translate(0,top);ctx.scale(1,-1);ctx.drawImage(canvas,0,top,w,strip,0,0,w,top);ctx.restore();}
   if(bottom<h){ctx.save();ctx.translate(0,bottom);ctx.scale(1,-1);ctx.drawImage(canvas,0,bottom-strip,w,strip,0,-(h-bottom),w,h-bottom);ctx.restore();}
   return;
  }
  if(!this.preserveCenter||!frame){
   ctx.drawImage(image,0,this.sourceY,640,425,0,0,w,h);
   // The eclipse and timeout explosion belong to the planet baked into this
   // scenery. Composite them with the same transform, behind the game actors.
   const planet=this.planet;
   if(['blaster','bonus'].includes(this.scene)&&planet?.image){
    ctx.drawImage(planet.image,planet.x*w/640,(planet.y-this.sourceY)*h/425,planet.image.naturalWidth*w/640,planet.image.naturalHeight*h/425);
   }
   return;
  }
  // The Recycler's machine is baked into its room bitmap. Keep that central
  // image proportional and extend only its outer wall strips, never the machine.
  const {left,top,width,height}=frame,right=left+width,bottom=top+height;
  ctx.drawImage(image,0,this.sourceY,640,425,left,top,width,height);
  if(left>0){ctx.save();ctx.translate(left,top);ctx.scale(-1,1);ctx.drawImage(image,0,this.sourceY,64,425,0,0,left,height);ctx.restore();}
  if(right<w){ctx.save();ctx.translate(w+right,top);ctx.scale(-1,1);ctx.drawImage(image,576,this.sourceY,64,425,right,0,w-right,height);ctx.restore();}
  // Extend the edge rows vertically; reflecting a wider strip would duplicate
  // the machine's base below the playfield on the iPad's taller screen.
  if(top>0)ctx.drawImage(image,0,this.sourceY,640,1,0,0,w,top);
  if(bottom<h)ctx.drawImage(image,0,this.sourceY+424,640,1,0,bottom,w,h-bottom);
 }
}
if(typeof module!=='undefined')module.exports={fitGame,MobileBackdrop};
else {window.fitMobileGame=fitGame;window.MobileBackdrop=MobileBackdrop;}
})();
