import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE}=await import('../dist/kit.js'),{buildEntrancePlayers}=await import('../dist/entrance-players.js'),{buildFootballView}=await import('../dist/football-view.js'),{createFootballTraining}=await import('../dist/football-training.js'),{createFootballSimulation}=await import('../dist/football-simulation.js'),{footballCamera,footballControlYaw,footballInput}=await import('../dist/football-controls.js');
const realFetch=globalThis.fetch;globalThis.fetch=async url=>{const data=await fs.readFile(new URL(url));return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const actors=buildEntrancePlayers(new THREE.Scene(),{mobile:true});await actors.prepare();globalThis.fetch=realFetch;
const cameraFor=(pose,aspect)=>{const c=new THREE.PerspectiveCamera(pose.fov,aspect,.06,2000);c.position.fromArray(pose.position);c.lookAt(...pose.target);c.updateMatrixWorld(true);return c;};
const framed=(camera,point)=>{const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<=.82001&&p.y>=-.52001&&p.y<=.65001&&p.z<1,JSON.stringify({point,projected:p.toArray(),camera:camera.position.toArray()}));};

test('lessons show only their real participants and clear every inactive actor contact shadow, then restore a full match',()=>{
 const children=actors.root.children.filter(o=>o.userData.role),count=actors.root.children.length;
 for(const drill of['free','passing','shooting']){
  const state=createFootballTraining({drill}).state;actors.reset();actors.updateMatch(state,0,new THREE.Vector3(0,10,0));
  const visible=children.filter(o=>o.visible);assert.equal(visible.length,state.training.activeIds.length);assert.ok(visible.every(o=>o.userData.role==='player'));
  const opacity=actors.root.userData.shadows.geometry.attributes.contactOpacity;
  children.forEach((actor,index)=>{if(!actor.visible)for(let j=0;j<3;j++)assert.equal(opacity.getX(index*3+j),0,actor.name+' has no ghost shadow');});
  assert.equal(actors.root.children.length,count,'lessons reuse the shared player pool');
 }
 const normal=createFootballSimulation().state;actors.reset();actors.updateMatch(normal,0,new THREE.Vector3(0,10,0));assert.equal(children.filter(o=>o.userData.role==='player'&&o.visible).length,22);assert.ok(children.find(o=>o.userData.role==='referee').visible);assert.ok(children.find(o=>o.userData.role==='substitute').visible);
});

test('trainingInactive actors never retain control or next-player cues when a lesson replaces an existing match',()=>{
 const state=createFootballSimulation().state,controlled=state.players.find(p=>p.id===state.controlledId),next=state.players.find(p=>p.id!==controlled.id);state.nextPlayerId=next.id;
 const view=buildFootballView(new THREE.Scene(),null,actors);view.setEnabled(true);view.update(state,0,new THREE.Vector3());const ring=view.root.getObjectByName('Controlled footballer'),cursor=view.root.getObjectByName('Next controllable player');assert.ok(ring.visible&&cursor.visible);
 controlled.trainingInactive=next.trainingInactive=true;view.update(state,.1,new THREE.Vector3());assert.equal(ring.visible,false);assert.equal(cursor.visible,false);
 controlled.trainingInactive=next.trainingInactive=false;view.update(state,.2,new THREE.Vector3());assert.ok(ring.visible&&cursor.visible);
});

test('the free training camera makes the actual player larger while shooting and passing retain the complete drill on phone screens',()=>{
 for(const [width,height]of[[390,844],[844,390],[1280,720]]){
  const aspect=width/height;
  for(const drill of['free','passing','shooting']){
   const state=createFootballTraining({drill}).state,p=state.players.find(p=>p.id===state.controlledId),pose=footballCamera(p,{style:'close',ball:state.ball,aspect,training:state.training}),camera=cameraFor(pose,aspect);
   framed(camera,[p.x,0,p.z]);framed(camera,[p.x,2,p.z]);framed(camera,[state.ball.x,.11,state.ball.z]);
   if(drill==='shooting'){for(const x of[-3.66,3.66])for(const y of[0,2.44])framed(camera,[x,y,-52.5]);const keeper=state.players.find(p=>!p.trainingInactive&&p.keeper);framed(camera,[keeper.x,2,keeper.z]);}
   if(drill==='passing')for(const receiver of state.training.targets){framed(camera,[receiver.x,0,receiver.z]);framed(camera,[receiver.x,2,receiver.z]);}
   const delta=pose.target.map((n,i)=>n-pose.position[i]),horizontal=Math.hypot(delta[0],delta[2]),right=[-delta[2]/horizontal,0,delta[0]/horizontal],input=footballInput({side:1,yaw:footballControlYaw(state,{cameraMode:'close'})});assert.ok(input.x*right[0]+input.z*right[2]>.999,'training controls stay aligned with the actual view');
   if(drill==='free'){
    const ordinary=cameraFor(footballCamera(p,{style:'close',ball:state.ball,aspect}),aspect),size=c=>new THREE.Vector3(p.x,2,p.z).project(c).y-new THREE.Vector3(p.x,0,p.z).project(c).y;assert.ok(size(camera)>size(ordinary)*1.35,'warm-up player is clearly larger');
   }
   const eye=footballCamera(p,{view:'first',style:'close',training:state.training,yaw:.7,pitch:-.2});assert.equal(eye.target,null);assert.equal(eye.yaw,.7);assert.deepEqual(eye.position,[p.x,1.68,p.z]);
  }
 }
});
