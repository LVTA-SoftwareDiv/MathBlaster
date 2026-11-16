'use strict';
const path=require('node:path');
exports.resolveGameFile=(root,address)=>{
 try{
  const url=new URL(address);
  if(url.protocol!=='mathblaster:'||url.hostname!=='game'||url.username||url.password||url.port)return null;
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(!name||name.includes('\0')||name.includes('\\')||name.includes(':'))return null;
  const file=path.resolve(root,name),relative=path.relative(root,file);
  return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)?file:null;
 }catch{return null;}
};
