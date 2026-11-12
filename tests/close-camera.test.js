import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,style:{},classList:{toggle(){}},focus(){}}),createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');await loadBrandAssets();
const {footballCamera,advanceFootballCamera}=await import('../dist/football-controls.js');
const {buildStadium}=await import('../dist/stadium.js');
const {matchOptions,loadMatchOptions,saveMatchOptions}=await import('../dist/football-teams.js');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function cameraFor(pose,aspect){const c=new THREE.PerspectiveCamera(pose.fov,aspect,.1,2000);c.position.fromArray(pose.position);c.lookAt(...pose.target);c.updateMatrixWorld();return c;}
function framed(point,c){const p=new THREE.Vector3(...point).project(c);assert.ok(Math.abs(p.x)<=.82001&&p.y>=-.52001&&p.y<=.65001&&p.z<1,JSON.stringify({point,projected:p.toArray(),camera:c.position.toArray()}));}

test('close broadcast doubles a nearby player’s readable size and preserves explicit camera preferences',()=>{
 for(const[w,h]of[[844,390],[390,844],[1280,720]]){const aspect=w/h,p={x:0,z:0},heights=['broadcast','close'].map(style=>{const c=cameraFor(footballCamera(p,{style,aspect}),aspect),foot=new THREE.Vector3(0,0,0).project(c),head=new THREE.Vector3(0,2,0).project(c);return(head.y-foot.y)*h/2;});assert.ok(heights[1]>heights[0]*2);}
 assert.equal(matchOptions().camera,'close');for(const camera of['broadcast','follow','close']){const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};saveMatchOptions(storage,{camera});assert.equal(loadMatchOptions(storage).camera,camera);}
});

test('close framing retains the full footballer and nearby ball across phone aspects and field edges',()=>{
 for(const aspect of[844/390,390/844,16/9])for(const x of[-33,0,33])for(const z of[-51,0,51])for(const distance of[0,10,24])for(let angle=0;angle<8;angle++)for(const y of[.11,5])for(const speed of[0,18]){
  const player={x,z},ball={x:clamp(x+Math.sin(angle*Math.PI/4)*distance,-34,34),z:clamp(z+Math.cos(angle*Math.PI/4)*distance,-52.5,52.5),y,vx:Math.sin(angle*Math.PI/4)*speed,vz:Math.cos(angle*Math.PI/4)*speed},pose=footballCamera(player,{style:'close',ball,aspect}),camera=cameraFor(pose,aspect);
  framed([x,0,z],camera);framed([x,2,z],camera);framed([ball.x,ball.y,ball.z],camera);assert.ok(camera.position.y<45,'the camera remains below the inner canopy');
  if(aspect===844/390){const foot=new THREE.Vector3(x,0,z).project(camera),px=(foot.x+1)*844/2,py=(1-foot.y)*390/2;assert.ok(py<=190||px>=180&&px<=664,'the footballer stays clear of the lower phone control zones');}
 }
});

test('close cursor changes reframe immediately when needed and do not look through seating decks or the canopy',()=>{
 const scene=new THREE.Scene(),stadium=buildStadium(scene),obstacles=[];scene.updateMatrixWorld(true);
 stadium.root.traverse(o=>{if(o.isMesh&&!o.material.transparent)obstacles.push(o);});
 for(const aspect of[844/390,390/844,16/9])for(const x of[-33,0,33])for(const z of[-51,0,51])for(const playerFocus of[0,1]){
  const player={x,z},previous=footballCamera({x:-x,z:-z},{style:'close',aspect}),desired=footballCamera(player,{style:'close',aspect,playerFocus,ball:{x:-x,z:-z,y:.11}}),pose=advanceFootballCamera(previous,desired,{player,aspect,changed:true}),camera=cameraFor(pose,aspect);
  framed([x,0,z],camera);framed([x,2,z],camera);const point=new THREE.Vector3(x,1,z),direction=point.clone().sub(camera.position),distance=direction.length(),hit=new THREE.Raycaster(camera.position,direction.normalize(),0,distance-.5).intersectObjects(obstacles,false)[0];assert.equal(hit,undefined,`unobstructed view from ${x},${z}`);
 }
});

test('active long-ball views have clear stadium sightlines to both player and ball',()=>{
 const scene=new THREE.Scene(),stadium=buildStadium(scene),obstacles=[];scene.updateMatrixWorld(true);
 stadium.root.traverse(o=>{if(o.isMesh&&!o.material.transparent&&!o.isInstancedMesh)obstacles.push(o);});
 for(const aspect of[390/844,844/390,16/9])for(const style of['close','broadcast'])for(const x of[-28,28])for(const end of[-1,1]){
  const player={id:'home-1',x,z:13*end},ball={x,y:1,z:44*end,vz:18*end};
  for(const action of['receive','shot']){
   const tracked=action==='receive'?{...ball,targetId:player.id,vz:-ball.vz}:ball;
   const pose=footballCamera(player,{style,aspect,ball:tracked,trackShot:action==='shot'}),camera=cameraFor(pose,aspect);
   for(const target of[[player.x,1,player.z],[ball.x,ball.y,ball.z]]){
    const direction=new THREE.Vector3(...target).sub(camera.position),distance=direction.length();
    const hit=new THREE.Raycaster(camera.position,direction.normalize(),0,distance-.5).intersectObjects(obstacles,false)[0];
    assert.equal(hit,undefined,JSON.stringify({style,aspect,target,camera:pose.position,hit:hit?.object.name}));
   }
  }
 }
});
