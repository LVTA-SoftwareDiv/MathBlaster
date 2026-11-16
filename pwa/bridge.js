function paintMobileBackground(id,y,sourceY,preserveCenter=false){
 const image=img(id);
 if(window.MBMobileBackdrop&&image.complete&&image.naturalWidth){window.MBMobileBackdrop.paint(image,sourceY,preserveCenter);if(!preserveCenter)return;}
 draw(id,0,y);
}
window.MBTouchBridge=Object.freeze({
 hold(key,down){
  if(!['ArrowLeft','ArrowRight',' '].includes(key))return;
  if(!down){keys.delete(key);return;}
  if(state.modal||state.menu||window.MBMobilePaused||!['cave','blaster','bonus'].includes(state.scene))return;
  pointer.mode='keyboard';pointer.down=false;keys.add(key);
 },
 release(){keys.clear();pointer.down=false;},
 closeMenu(){closeMenus();},
 continueMovie(){if(state.scene==='movie'&&!state.modal&&!state.menu&&!window.MBMobilePaused)nextLine();},
 pause(paused){
  window.MBMobilePaused=!!paused;keys.clear();pointer.down=false;previous=Date.now();
  if(paused){snapshot();for(const a of effects)a.pause();}
  else if(settings.sound&&!state.modal&&!state.focusPaused)for(const a of effects)a.play().catch(()=>{});
 },
 view(){return {scene:state.scene,modal:state.modal,menu:state.menu,generation:state.generation,
  mode:activity?.mode,selected:activity?.selected,waiting:!!movie?.waiting};}
});
