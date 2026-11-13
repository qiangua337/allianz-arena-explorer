import {buildEditorialCover} from './editorial-cover.js';
import {buildExperienceHub,shouldOpenExperienceHub} from './experience-hub.js';
import {loadVisitorSettings,saveVisitorSettings} from './visitor-settings.js';

const initial=new URLSearchParams(location.search);
let storage;
try{storage=window.localStorage;}catch{}
const preferences=loadVisitorSettings(storage);
let night=initial.get('night')==='1';
let arena, loading, pendingMode;
const body=document.body;
const overlay=document.getElementById('loading');
const status=document.getElementById('load-status');
const actions=document.getElementById('load-actions');

function enter(mode){
 if(mode)pendingMode=mode;
 if(arena){
  if(pendingMode)arena.enter(pendingMode);
  pendingMode=undefined;
  return;
 }
 if(loading)return;
 body.dataset.startup='loading';
 loading=import('./app.js?v=10601')
  .then(({startArena})=>startArena({hub,initial,nightAtStart:night}))
  .then(api=>{
   arena=api;
   body.dataset.startup='ready';
   overlay.classList.add('finished');
   status.textContent='场景已就绪';
   if(pendingMode)enter();
   else if(initial.has('room'))enter('online');
   else if(initial.get('experience')==='football')enter('play');
   else if(initial.get('experience')==='training')enter('training');
  })
  .catch(error=>{
   console.error('Arena loading failed',error);
   body.dataset.startup='error';
   document.getElementById('load-title').textContent='球场暂未加载';
   status.textContent=error?.message?.startsWith('当前浏览器未能启用')?error.message:'场景加载失败。可以重新加载，或返回大厅。';
   actions.hidden=false;
  });
}

buildEditorialCover();
const hub=buildExperienceHub({
 getSettings:()=>arena?.getSettings()||{night,quality:preferences.quality},
 onOpen:()=>arena?.pauseForHub(),
 onClose:state=>{if(state)arena.resumeFromHub(state);else enter();},
 onExplore:()=>enter('explore'),
 onTraining:()=>enter('training'),
 onMatch:()=>enter('play'),
 onOnline:()=>enter('online'),
 onEntrance:()=>enter('tour'),
 onEnvironment:value=>{
  night=value;
  if(arena){arena.setEnvironment(value);return;}
  const url=new URL(location.href);
  if(night)url.searchParams.set('night','1');
  else url.searchParams.delete('night');
  history.replaceState(null,'',url);
 },
 onQuality:value=>{
  if(arena){arena.setQuality(value);return;}
  preferences.quality=value;
  saveVisitorSettings(storage,preferences);
 }
});

document.getElementById('load-home').onclick=()=>hub.open();
document.getElementById('load-retry').onclick=()=>location.reload();
if(shouldOpenExperienceHub(initial)){
 body.dataset.startup='home';
 hub.open();
}else enter();
