'use strict';
const {app,BrowserWindow,Menu,protocol,net,session,dialog}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {resolveGameFile}=require('./paths.cjs');
const gameRoot=path.join(__dirname,'game');
const gameURL='mathblaster://game/Play%20Math%20Blaster.html';
app.setName('Math Blaster');
app.setPath('userData',path.join(app.getPath('appData'),'MathBlasterInSearchOfSpot'));
if(process.platform==='win32')app.setAppUserModelId('local.mathblaster.insearchofspot');
protocol.registerSchemesAsPrivileged([{scheme:'mathblaster',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
let win=null;
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(()=>{
  const ses=session.defaultSession;
  const permitsFullscreen=(contents,permission)=>permission==='fullscreen'&&contents?.getURL().startsWith('mathblaster://game/');
  ses.setPermissionRequestHandler((contents,permission,callback)=>callback(permitsFullscreen(contents,permission)));
  ses.setPermissionCheckHandler((contents,permission)=>permitsFullscreen(contents,permission));
  protocol.handle('mathblaster',request=>{
   const file=resolveGameFile(gameRoot,request.url);
   if(!file)return new Response('Not found',{status:404});
   return net.fetch(pathToFileURL(file).toString());
  });
  ses.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{
   ...details.responseHeaders,
   'Content-Security-Policy':["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'none'"]
  }}));
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([
   {label:'Math Blaster',submenu:[{role:'quit'}]},
   {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
   {label:'View',submenu:[{role:'togglefullscreen'}]}
  ]):null);
  win=new BrowserWindow({width:1000,height:840,minWidth:660,minHeight:610,
   title:'Math Blaster: In Search of Spot',backgroundColor:'#192126',show:false,
   icon:path.join(__dirname,'icon.png'),
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,
    autoplayPolicy:'no-user-gesture-required',backgroundThrottling:false,spellcheck:false}
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==gameURL)event.preventDefault();});
  win.webContents.on('before-input-event',(event,input)=>{
   if(input.type==='keyDown'&&input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}
  });
  let closing=false,allowClose=false;
  win.on('close',event=>{
   if(allowClose)return;
   event.preventDefault();if(closing)return;closing=true;
   let timer;
   const fallback=new Promise(resolve=>{timer=setTimeout(resolve,5000);});
   const saved=win.webContents.executeJavaScript("window.dispatchEvent(new Event('beforeunload'))").catch(()=>{});
   Promise.race([saved,fallback]).then(()=>{
    clearTimeout(timer);ses.flushStorageData();allowClose=true;
    if(win&&!win.isDestroyed())win.close();
   });
  });
  win.on('closed',()=>{win=null;});
  win.once('ready-to-show',()=>{win.show();win.focus();});
  win.loadURL(gameURL).catch(error=>{dialog.showErrorBox('Math Blaster could not open',error.message);app.quit();});
 });
 app.on('window-all-closed',()=>app.quit());
}
