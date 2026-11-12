import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE}=await import('../dist/kit.js'),{buildEntrancePlayers}=await import('../dist/entrance-players.js'),{createFootballSimulation}=await import('../dist/football-simulation.js');
const {footballCamera}=await import('../dist/football-controls.js');
const fetchOriginal=globalThis.fetch;globalThis.fetch=async url=>{const data=await fs.readFile(new URL(url));return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const scene=new THREE.Scene(),actors=buildEntrancePlayers(scene,{mobile:true});
const desktopScene=new THREE.Scene(),desktop=buildEntrancePlayers(desktopScene);
await Promise.all([actors.prepare(),desktop.prepare()]);globalThis.fetch=fetchOriginal;

test('phone match cameras preserve both featured profiles within the previous triangle and material budgets',()=>{
 const state=createFootballSimulation().state;
 state.phase='playing';
 const budgets={
  9:{triangles:[24372,5705,1539],vertices:[13505,3301,981]},
  10:{triangles:[24748,5640,1477],vertices:[13934,3278,936]}
 };
 const styles=['follow','close','broadcast'];
 const countPart=(geometry,name)=>{
  const {start,count}=geometry.userData.parts[name];
  let triangles=0;
  for(let i=0;i<geometry.index.count;i+=3){
   const vertex=geometry.index.getX(i);
   if(vertex>=start&&vertex<start+count)triangles++;
  }
  return triangles;
 };
 const featured=state.players.filter(p=>p.team==='home'&&budgets[p.number]);
 assert.equal(featured.length,2);
 for(const p of featured){
  const actor=actors.root.children.find(a=>a.userData.team==='home'&&a.userData.role==='player'&&a.userData.playerNumber===p.number);
  const body=actor.getObjectByName('athlete'),material=body.material,budget=budgets[p.number];
  const geometryByCamera=styles.map((style,i)=>{
   const {position}=footballCamera(p,{style,ball:p,aspect:390/844});
   actors.updateMatch(state,i/30,new THREE.Vector3(...position));
   assert.ok(actor.visible,style+' renders the featured actor');
   assert.equal(body.material,material);
   assert.equal(body.geometry.groups.length,0);
   assert.ok(body.geometry.index.count/3<=budget.triangles[i],p.number+' '+style+' triangle budget');
   assert.ok(body.geometry.attributes.position.count<=budget.vertices[i],p.number+' '+style+' vertex budget');
   assert.ok(countPart(body.geometry,'eyebrows')>0);
   return body.geometry;
  });
  const [high,medium,low]=geometryByCamera;
  assert.equal(high.userData.medium,medium);
  assert.equal(high.userData.low,low);
  assert.ok(countPart(medium,'face')>760,'close camera resolves the actual face');
  assert.ok(countPart(low,'crop')>110,'broadcast retains the custom hair silhouette');
  assert.ok(countPart(low,'face')>220,'broadcast retains more facial profile than the generic model');
 }
});

test('a moving phone match retains all 52 people while avoiding duplicate skeleton traversals and unused clip sampling',()=>{
 const state=createFootballSimulation().state,positions=state.players.map(p=>[p.x,p.z]),viewer=new THREE.Vector3(18,14,4.5);state.phase='playing';actors.reset();const update=THREE.Object3D.prototype.updateMatrixWorld,slerp=THREE.Quaternion.prototype.slerpQuaternions;let traversals=0,samples=0;
 try{THREE.Object3D.prototype.updateMatrixWorld=function(...args){traversals++;return update.apply(this,args);};THREE.Quaternion.prototype.slerpQuaternions=function(...args){samples++;return slerp.apply(this,args);};
  for(let i=0;i<300;i++){const t=i/30;for(let j=0;j<state.players.length;j++){const p=state.players[j];p.x=positions[j][0]+Math.sin(t*.5+j)*2;p.z=positions[j][1]+Math.cos(t*.4+j)*2;p.vx=Math.cos(t*.5+j);p.vz=-.8*Math.sin(t*.4+j);p.yaw=Math.atan2(p.vx,p.vz);}state.time=t;actors.updateMatch(state,t,viewer);scene.updateMatrixWorld(true);}
 }finally{THREE.Object3D.prototype.updateMatrixWorld=update;THREE.Quaternion.prototype.slerpQuaternions=slerp;}
 // The pre-optimisation fixture performed 499,727 traversals and 209,484
 // quaternion samples, while missing its intended 20/12Hz animation rates.
 // Retaining those real rates still requires less work. This is no FPS claim.
 assert.ok(traversals<470000,'world traversals '+traversals);assert.ok(samples<190000,'quaternion samples '+samples);assert.equal(actors.root.children.filter(o=>o.isGroup).length,52);assert.equal(actors.root.children.filter(o=>o.userData.role==='player'&&o.visible).length,22);
});

test('a 30Hz phone loop actually delivers 20Hz middle-distance and 12Hz distant poses without starving the controlled player',()=>{
 const state=createFootballSimulation().state;state.phase='playing';const target=state.players.find(p=>p.team==='home'&&p.index===2),controlled=state.players.find(p=>p.id===state.controlledId),viewer=new THREE.Vector3(0,14,20),groups=actors.root.children.filter(o=>o.userData.role==='player'&&o.userData.team==='home'),group=groups.find(o=>o.userData.playerNumber===target.number),own=groups.find(o=>o.userData.playerNumber===controlled.number),update=group.updateMatrixWorld,ownUpdate=own.updateMatrixWorld;let poses=0,ownPoses=0;
 group.updateMatrixWorld=function(...args){poses++;return update.apply(this,args);};own.updateMatrixWorld=function(...args){ownPoses++;return ownUpdate.apply(this,args);};
 try{for(const[distance,expected]of[[20,200],[40,120]]){actors.reset();poses=0;ownPoses=0;Object.assign(target,{x:0,z:20-distance,vx:0,vz:0});for(let i=0;i<300;i++){state.time=i/30;actors.updateMatch(state,state.time,viewer);}assert.ok(Math.abs(poses-expected)<=1,JSON.stringify({distance,poses,expected}));assert.equal(ownPoses,300);}}
 finally{group.updateMatrixWorld=update;own.updateMatrixWorld=ownUpdate;}
});

test('an off-camera phone player skips rig traversal and returns in the current pose after a turn',()=>{
 const state=createFootballSimulation().state;
 const target=state.players.find(p=>p.team==='away'&&p.index===2);
 const group=actors.root.children.find(o=>o.userData.team===target.team&&o.userData.role==='player'&&o.userData.playerNumber===target.number);
 const pelvis=group.getObjectByName('athlete').skeleton.bones[0],update=pelvis.updateMatrixWorld;
 const camera=new THREE.PerspectiveCamera(55,390/844,.1,200);
 camera.position.set(0,2.2,0);
 camera.lookAt(0,1,-25);
 state.phase='playing';actors.reset();
 let traversals=0;
 pelvis.updateMatrixWorld=function(...args){traversals++;return update.apply(this,args);};
 try{
  for(let i=0;i<15;i++){
   Object.assign(target,{x:14+i*.08,z:-8,vx:2.4,vz:0,yaw:Math.PI/2});
   actors.updateMatch(state,i/30,camera.position,{camera});
   scene.updateMatrixWorld(true);
   assert.equal(group.visible,false);
   assert.equal(group.position.x,target.x);
  }
  assert.equal(traversals,0);
  camera.lookAt(target.x,1,target.z);
  actors.updateMatch(state,.51,camera.position,{camera});
  scene.updateMatrixWorld(true);
  assert.equal(group.visible,true);
  assert.ok(traversals>0);
  assert.ok(Math.abs(pelvis.matrixWorld.elements[12]-target.x)<.25);
  camera.lookAt(0,1,-25);
  actors.updateMatch(state,.52,camera.position);
  assert.equal(group.visible,true,'the full shadow path keeps off-camera actors available');
 }finally{pelvis.updateMatrixWorld=update;actors.reset();}
});

test('combined football strokes and locomotion leave officials accessories on the animated hand',()=>{
 const state=createFootballSimulation().state;state.phase='playing';state.time=5;state.discipline.lastDecision={card:'yellow',at:4.5};actors.reset();const p=state.players[1];p.motion={type:'shoot',elapsed:.2,duration:.46};p.vz=-6;p.yaw=Math.PI;actors.updateMatch(state,5,new THREE.Vector3(0,12,0));scene.updateMatrixWorld(true);
 const referee=actors.root.children.find(o=>o.userData.role==='referee'),card=referee.children.find(o=>o.isMesh&&o.name!=='athlete'),hand=referee.getObjectByName('athlete').skeleton.bones[14].getWorldPosition(new THREE.Vector3());assert.equal(card.visible,true);assert.ok(card.getWorldPosition(new THREE.Vector3()).distanceTo(hand)<1e-9);
 for(const official of actors.root.children.filter(o=>o.userData.role==='assistantReferee')){const flag=official.children.find(o=>o.isGroup&&!o.isBone),wrist=official.getObjectByName('athlete').skeleton.bones[14].getWorldPosition(new THREE.Vector3());assert.ok(flag.getWorldPosition(new THREE.Vector3()).distanceTo(wrist)<1e-9);}
 for(const actor of actors.root.children.filter(o=>o.isGroup))for(const bone of actor.getObjectByName('athlete').skeleton.bones){assert.ok(bone.matrixWorld.elements.every(Number.isFinite));assert.ok(Math.abs(bone.quaternion.length()-1)<.00001);}
});

const renderFixtures=[['phone',scene,actors],['desktop',desktopScene,desktop]];
for(const [platform,scene,actors]of renderFixtures){
test(platform+' render traversal reuses a fresh pose and still follows later actor and parent transforms',()=>{
 const state=createFootballSimulation().state,viewer=new THREE.Vector3(0,14,0);
 state.phase='playing';actors.reset();actors.updateMatch(state,0,viewer);scene.updateMatrixWorld(true);
 const group=actors.root.children.find(o=>o.userData.role==='player'&&o.visible);
 const body=group.getObjectByName('athlete'),pelvis=body.skeleton.bones[0],original=pelvis.updateMatrixWorld;
 const initial=new THREE.Vector3().setFromMatrixPosition(pelvis.matrixWorld),reference=new THREE.Vector3();
 let traversals=0;
 pelvis.updateMatrixWorld=function(...args){traversals++;return original.apply(this,args);};
 try{
  scene.updateMatrixWorld(true);
  assert.equal(traversals,0,'the scene does not visit bones with a current world pose');
  group.position.z+=.25;scene.updateMatrixWorld(true);
  assert.equal(traversals,1,'between-pose movement still propagates to the whole rig');
  reference.copy(initial);reference.z+=.25;
  assert.ok(reference.distanceTo(new THREE.Vector3().setFromMatrixPosition(pelvis.matrixWorld))<1e-8);
  actors.root.position.x+=.5;scene.updateMatrixWorld(true);
  assert.equal(traversals,2,'an ancestor change invalidates even a stationary actor');
  reference.x+=.5;
  assert.ok(reference.distanceTo(new THREE.Vector3().setFromMatrixPosition(pelvis.matrixWorld))<1e-8);
 }finally{
  pelvis.updateMatrixWorld=original;actors.root.position.x-=.5;actors.reset();scene.updateMatrixWorld(true);
 }
});
}

test('desktop entrance stair solving, bench poses and a replay rewind all keep current world matrices',()=>{
 const state=createFootballSimulation().state,viewer=new THREE.Vector3(-43,0,0);
 const groups=desktop.root.children.filter(o=>o.isGroup);
 const starter=groups.find(o=>o.userData.role==='player');
 const pelvis=starter.getObjectByName('athlete').skeleton.bones[0],update=pelvis.updateMatrixWorld;
 let traversals=0;
 pelvis.updateMatrixWorld=function(...args){traversals++;return update.apply(this,args);};
 try{
  desktop.reset();
  desktop.update(10,10,viewer);
  assert.ok(starter.position.x> -46.4&&starter.position.x< -40.3);
  assert.ok(traversals>=3,'each stair foot-placement pass propagates its edits');
  const stairPasses=traversals;
  desktopScene.updateMatrixWorld(true);
  assert.equal(traversals,stairPasses,'rendering an already solved entrance pose needs no extra traversal');
  for(const t of [12,0]){
   desktop.reset();
   state.time=t;state.phase='playing';
   const player=state.players.find(p=>p.team===starter.userData.team&&p.number===starter.userData.playerNumber);
   player.x=t?7:-4;
   desktop.updateMatch(state,t,viewer);
   const matchPasses=traversals;
   desktopScene.updateMatrixWorld(true);
   assert.equal(traversals,matchPasses);
   assert.ok(Math.abs(pelvis.matrixWorld.elements[12]-player.x)<.25,'pose follows the current match or replay position');
   const bench=groups.find(o=>o.userData.role==='substitute'&&o.visible);
   assert.ok(bench);
   assert.ok(Math.abs(bench.getObjectByName('athlete').skeleton.bones[0].matrixWorld.elements[12]-bench.position.x)<.25);
   for(const official of groups.filter(o=>o.userData.role==='assistantReferee')){
    const flag=official.children.find(o=>o.isGroup&&!o.isBone);
    const wrist=official.getObjectByName('athlete').skeleton.bones[14];
    assert.ok(new THREE.Vector3().setFromMatrixPosition(flag.matrixWorld).distanceTo(new THREE.Vector3().setFromMatrixPosition(wrist.matrixWorld))<1e-9);
   }
  }
 }finally{pelvis.updateMatrixWorld=update;desktop.reset();}
});
