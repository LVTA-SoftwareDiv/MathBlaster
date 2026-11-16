'use strict';
(() => {
function fitGame(width,height,{left=0,right=0,top=0,bottom=0}={}){
 const availableWidth=Math.max(1,width-left-right),availableHeight=Math.max(1,height-top-bottom);
 const scale=Math.min(availableWidth/640,availableHeight/425),w=640*scale,h=425*scale;
 return {left:left+(availableWidth-w)/2,top:top+(availableHeight-h)/2,width:w,height:h};
}
class MobileBackdrop {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.scene='';this.image=null;this.frame=null;}
 begin(scene){if(scene!==this.scene){this.scene=scene;this.image=null;this.repaint();}}
 paint(image,sourceY,preserveCenter=false){
  if(this.image===image&&this.sourceY===sourceY&&this.preserveCenter===preserveCenter)return;
  this.image=image;this.sourceY=sourceY;this.preserveCenter=preserveCenter;this.repaint();
 }
 resize(width,height,frame){this.canvas.width=Math.round(width);this.canvas.height=Math.round(height);this.frame=frame;this.repaint();}
 repaint(){
  const {canvas,ctx,image,frame}=this,w=canvas.width,h=canvas.height;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);
  if(!image?.complete||!image.naturalWidth)return;
  if(!this.preserveCenter||!frame){ctx.drawImage(image,0,this.sourceY,640,425,0,0,w,h);return;}
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
