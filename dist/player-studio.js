import {THREE} from './kit.js';

const players={
 kane:{number:'09',role:'FORWARD',name:'HARRY KANE',local:'哈里·凯恩',weight:86},
 musiala:{number:'10',role:'MIDFIELD',name:'JAMAL MUSIALA',local:'穆西亚拉',weight:75}
};
const presets={portrait:-32,front:0,side:90};

export function buildPlayerStudio(loadActor){
 const dialog=document.getElementById('player-studio'),stage=document.getElementById('player-studio-stage');
 const status=document.getElementById('player-studio-status'),measure=document.getElementById('player-studio-measure');
 const angle=document.getElementById('player-studio-angle');
 const role=document.getElementById('player-studio-role');
 const name=document.getElementById('player-studio-name'),local=document.getElementById('player-studio-local');
 const names=[...dialog.querySelectorAll('[data-studio-player]')],views=[...dialog.querySelectorAll('[data-studio-view]')];
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(28,1,.035,12);
 const key=new THREE.DirectionalLight(0xfff3e5,2.05),fill=new THREE.DirectionalLight(0xe7efff,.65),rim=new THREE.DirectionalLight(0xe3ebff,.55);
 scene.add(new THREE.HemisphereLight(0xeef0fa,0x938783,1.1),key,fill,rim);
 let identity='kane',view='portrait',renderer=null,actor=null,frame=0,request=0,width=0,height=0,drag=null,observer=null;

 function draw(){
  frame=0;
  if(!dialog.open||!renderer||!actor)return;
  const w=stage.clientWidth,h=stage.clientHeight;
  if(!w||!h)return;
  if(w!==width||h!==height){
   width=w;height=h;renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  const face=view!=='body',scale=actor.group.scale.y,center=(face?1.732:.98)*scale,z=face?.07:0;
  const distance=(face?.85:4.42)*Math.max(1,.74/camera.aspect),radians=Number(angle.value)*Math.PI/180;
  const sin=Math.sin(radians),cos=Math.cos(radians);
  camera.position.set(sin*distance,center+(face?.017:.12),z+cos*distance);
  camera.lookAt(0,center,z);
  // Studio lights orbit with the camera, keeping both profiles readable.
  key.position.set(sin*4-cos*3,4.5,cos*4+sin*3);
  fill.position.set(sin*3+cos*2,1.8,cos*3-sin*2);
  rim.position.set(-sin*3+cos*2,3,-cos*3-sin*2);
  renderer.render(scene,camera);
 }
 function queueDraw(){if(!frame)frame=requestAnimationFrame(draw);}
 function syncView(){
  const degrees=Number(angle.value);
  angle.setAttribute('aria-valuetext',degrees+'°');
  const preset=view==='body'?'body':degrees===presets.portrait?'portrait':degrees===0?'front':Math.abs(degrees)===90?'side':'';
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
  const profile=players[id];
  dialog.dataset.player=id;role.textContent=profile.number+' / '+profile.role;
  name.textContent=profile.name;local.textContent=profile.local;
  for(const button of names)button.setAttribute('aria-pressed',String(button.dataset.studioPlayer===id));
  const token=++request;
  status.hidden=false;status.textContent='正在加载球员模型…';measure.textContent='';
  if(renderer)renderer.domElement.hidden=true;
  try{
   const next=await loadActor(id);
   if(token!==request||!dialog.open){disposeActor(next);return;}
   disposeActor(actor);actor=next;scene.add(actor.group);
   measure.textContent=Math.round(actor.definition.height*100)+' cm  /  '+profile.weight+' kg';
   renderer.domElement.hidden=false;status.hidden=true;
   queueDraw();
  }catch{
   if(token===request)status.textContent='球员模型未加载，请重新打开。';
  }
 }
 document.getElementById('player-studio-open').addEventListener('click',()=>{
  dialog.showModal();
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.15:1.35));
   renderer.setClearColor(0x000000,0);
   renderer.toneMapping=THREE.NeutralToneMapping;
   renderer.toneMappingExposure=.87;
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
  if(view!=='body')angle.value=String(presets[view]);
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
