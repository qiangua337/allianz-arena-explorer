import {THREE} from './kit.js';

const weights={kane:86,musiala:75};

export function buildPlayerStudio(loadActor){
 const dialog=document.getElementById('player-studio'),stage=document.getElementById('player-studio-stage');
 const status=document.getElementById('player-studio-status'),measure=document.getElementById('player-studio-measure');
 const angle=document.getElementById('player-studio-angle');
 const names=[...dialog.querySelectorAll('[data-studio-player]')],views=[...dialog.querySelectorAll('[data-studio-view]')];
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.015,12);
 const key=new THREE.DirectionalLight(0xfff5ea,1.55),fill=new THREE.DirectionalLight(0xebf2ff,1.05),rim=new THREE.DirectionalLight(0xe4ebff,.7);
 key.position.set(-3,3.2,4.5);fill.position.set(3,.85,4);rim.position.set(1,2.8,-3);
 scene.background=new THREE.Color(0x1d2127);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8c8795,1.2),key,fill,rim);
 let identity='kane',view='front',renderer=null,actor=null,frame=0,request=0,width=0,height=0,drag=null,observer=null;

 function draw(){
  frame=0;
  if(!dialog.open||!renderer||!actor)return;
  const w=stage.clientWidth,h=stage.clientHeight;
  if(!w||!h)return;
  if(w!==width||h!==height){
   width=w;height=h;renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  const face=view!=='body',scale=actor.group.scale.y,center=(face?1.738:.96)*scale,z=face?.078:0;
  const distance=(face?.66:3.82)*Math.max(1,.63/camera.aspect),radians=Number(angle.value)*Math.PI/180;
  camera.position.set(Math.sin(radians)*distance,center+(face?.009:.16),z+Math.cos(radians)*distance);
  camera.lookAt(0,center,z);
  renderer.render(scene,camera);
 }
 function queueDraw(){if(!frame)frame=requestAnimationFrame(draw);}
 function syncView(){
  const degrees=Number(angle.value);
  angle.setAttribute('aria-valuetext',degrees+'°');
  const preset=view==='body'?'body':degrees===0?'front':Math.abs(degrees)===90?'side':'';
  for(const button of views)button.setAttribute('aria-pressed',String(button.dataset.studioView===preset));
  queueDraw();
 }
 function disposeActor(value){
  if(!value)return;
  scene.remove(value.group);
  value.body.material.map.dispose();value.body.material.dispose();value.body.skeleton.dispose();
 }
 async function select(id){
  identity=id;
  for(const button of names)button.setAttribute('aria-pressed',String(button.dataset.studioPlayer===id));
  const token=++request;
  status.hidden=false;status.textContent='正在加载球员模型…';measure.textContent='';
  if(renderer)renderer.domElement.hidden=true;
  try{
   const next=await loadActor(id);
   if(token!==request||!dialog.open){disposeActor(next);return;}
   disposeActor(actor);actor=next;scene.add(actor.group);
   measure.textContent=Math.round(actor.definition.height*100)+' cm · '+weights[id]+' kg';
   renderer.domElement.hidden=false;status.hidden=true;
   queueDraw();
  }catch{
   if(token===request)status.textContent='球员模型未加载，请重新打开。';
  }
 }
 document.getElementById('player-studio-open').addEventListener('click',()=>{
  dialog.showModal();
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
   renderer.toneMapping=THREE.ACESFilmicToneMapping;
   renderer.domElement.setAttribute('aria-label','球员三维模型');
   stage.prepend(renderer.domElement);
   observer=new ResizeObserver(queueDraw);observer.observe(stage);
   select(identity);
  }catch{
   status.hidden=false;status.textContent='球员模型未加载，请重新打开。';
  }
 });
 document.getElementById('player-studio-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  request++;drag=null;
  if(frame)cancelAnimationFrame(frame);frame=0;
  observer?.disconnect();observer=null;
  disposeActor(actor);actor=null;
  if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}
  width=height=0;
 });
 for(const button of names)button.addEventListener('click',()=>{
  if(renderer&&(identity!==button.dataset.studioPlayer||status.hidden===false))select(button.dataset.studioPlayer);
 });
 for(const button of views)button.addEventListener('click',()=>{
  view=button.dataset.studioView;
  if(view!=='body')angle.value=view==='front'?'0':'90';
  syncView();
 });
 angle.addEventListener('input',syncView);
 stage.addEventListener('pointerdown',event=>{
  if(!actor||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,angle:Number(angle.value)};
  stage.setPointerCapture(event.pointerId);
 });
 stage.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  const rotation=drag.angle+(event.clientX-drag.x)*.55;
  angle.value=String(((rotation+180)%360+360)%360-180);
  syncView();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,()=>{drag=null;});
}
