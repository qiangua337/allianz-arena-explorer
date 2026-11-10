import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,style:{},classList:{toggle(){}},focus(){}}),createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');await loadBrandAssets();
const {footballCamera,advanceFootballCamera,footballControlYaw,footballInput}=await import('../dist/football-controls.js');
const {buildStadium}=await import('../dist/stadium.js');
const {matchOptions,loadMatchOptions,saveMatchOptions}=await import('../dist/football-teams.js');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function cameraFor(pose,aspect){const c=new THREE.PerspectiveCamera(pose.fov,aspect,.1,2000);c.position.fromArray(pose.position);c.lookAt(...pose.target);c.updateMatrixWorld();return c;}
function framed(point,c){const p=new THREE.Vector3(...point).project(c);assert.ok(Math.abs(p.x)<=.82001&&p.y>=-.52001&&p.y<=.65001&&p.z<1,JSON.stringify({point,projected:p.toArray(),camera:c.position.toArray()}));}

const {trainingLayout}=await import('../dist/football-training-layout.js');
const spots=Array.from({length:4},(_,i)=>trainingLayout('shooting',i+1)[0]);

test('phone shooting training places a readable full shooter below the centred complete goal at every actual starting spot',()=>{
 for(const[width,height]of[[390,844],[844,390],[1280,720]])for(const player of spots){
  const aspect=width/height,ball={x:player.x,y:.11,z:player.z-.6},pose=footballCamera(player,{style:'close',ball,aspect,training:{id:'shooting'}}),camera=cameraFor(pose,aspect),foot=new THREE.Vector3(player.x,0,player.z).project(camera),head=new THREE.Vector3(player.x,2,player.z).project(camera),goal=new THREE.Vector3(0,1.22,-52.5).project(camera);
  framed([player.x,0,player.z],camera);framed([player.x,2,player.z],camera);for(const x of[-3.66,3.66])for(const y of[0,2.44])framed([x,y,-52.5],camera);
  assert.ok(Math.abs(foot.x)<1e-6&&Math.abs(goal.x)<1e-6,'shooter and goal share the screen centre');assert.ok(foot.y<-.25&&goal.y>.1,'shooter is below the goal');assert.ok((head.y-foot.y)*height/2>(width<height?110:70),'the phone shooter is large enough to read');
  for(const flight of[{x:-3.5,y:2.3,z:-52.5},{x:3.5,y:.5,z:-52.5},{x:0,y:5,z:-44}]){const live=cameraFor(footballCamera(player,{style:'close',ball:flight,aspect,training:{id:'shooting'}}),aspect);framed([flight.x,flight.y,flight.z],live);framed([player.x,0,player.z],live);framed([player.x,2,player.z],live);}
 }
});

test('shooting camera input follows the player-to-goal axis and stays continuous when crossing the goal line',()=>{
 for(const player of spots){
  const state={players:[player],controlledId:player.id,ball:player,training:{id:'shooting'}},pose=footballCamera(player,{style:'close',training:state.training}),yaw=footballControlYaw(state,{cameraMode:'close'}),forward=footballInput({forward:1,yaw}),side=footballInput({side:1,yaw}),delta=pose.target.map((n,i)=>n-pose.position[i]),horizontal=Math.hypot(delta[0],delta[2]),right=[-delta[2]/horizontal,0,delta[0]/horizontal],goalDirection=[-player.x,-52.5-player.z],length=Math.hypot(...goalDirection);
  assert.ok((forward.x*goalDirection[0]+forward.z*goalDirection[1])/length>.99999,'forward points toward the actual goal');assert.ok(side.x*right[0]+side.z*right[2]>.99999,'right moves right on screen');assert.ok(Math.abs(yaw-pose.controlYaw)<1e-12);
 }
 let previous=null;for(let z=-51;z>=-54;z-=.05){const player={x:0,z},pose=footballCamera(player,{style:'close',training:{id:'shooting'}});assert.ok(pose.position.every(Number.isFinite));if(previous)assert.ok(Math.hypot(...pose.position.map((v,i)=>v-previous[i]))<.3,'no camera flip at the goal centre');previous=pose.position;}
});

test('the shooting training views have unobstructed actual stadium rays from all lesson and approach positions',()=>{
 const scene=new THREE.Scene(),stadium=buildStadium(scene),obstacles=[];scene.updateMatrixWorld(true);stadium.root.traverse(o=>{if(o.isMesh&&!o.material.transparent)obstacles.push(o);});
 for(const aspect of[390/844,844/390,16/9])for(const player of[...spots,{x:-20,z:-20},{x:20,z:-20},{x:-15,z:-45},{x:15,z:-45}]){
  const pose=footballCamera(player,{style:'close',aspect,training:{id:'shooting'}}),camera=cameraFor(pose,aspect);
  for(const target of[[player.x,1,player.z],[0,1,-50.7]]){const point=new THREE.Vector3(...target),direction=point.clone().sub(camera.position),distance=direction.length(),hit=new THREE.Raycaster(camera.position,direction.normalize(),0,distance-.5).intersectObjects(obstacles,false)[0];assert.equal(hit,undefined,JSON.stringify({player,aspect,target,camera:pose.position,hit:hit?.object.name}));}
 }
});
