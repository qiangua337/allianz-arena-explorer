import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
// Rendering is verified in the browser. This canvas stub lets the actual
// scene builders supply their collision geometry to the walking regression.
const context=new Proxy({measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,focus(){}}),createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener:()=>{},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');
const {buildStadium}=await import('../dist/stadium.js');
const {buildInteriors,roomSpecs}=await import('../dist/interiors.js');
const {buildWalkBuilding}=await import('../dist/walk-building.js');
const {buildWorld}=await import('../dist/world.js');
const {tourGoals,tourNodes,planTour}=await import('../dist/tour-route.js');
const {floorHeight,hitsWall}=await import('../dist/navigation.js');
const {buildInteractions}=await import('../dist/interactions.js');
await loadBrandAssets();const scene=new THREE.Scene(),world=buildWorld(scene),stadium=buildStadium(scene),interiors=buildInteriors(scene,stadium.circulation),building=buildWalkBuilding(scene),geometry={rooms:roomSpecs,tiers:stadium.tiers};
test('real room walls, fixtures and handrails leave all advertised routes clear',()=>{
 for(const goal of Object.keys(tourGoals)){
  const path=planTour(tourNodes.entrance,goal);let feet=path[0].y;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.15);
   for(let j=1;j<=steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;feet=floorHeight(x,z,feet,geometry);const eye=feet+1.7;
    const list=[...world.colliders,...stadium.circulation.colliders,...interiors.colliders,...building.colliders];
    assert.equal(hitsWall(x,z,eye,list),false,`${goal}: ${a.id} → ${b.id} blocked at ${x.toFixed(2)},${z.toFixed(2)} floor ${feet.toFixed(2)}`);
   }
  }
 }
});
test('automatic doors physically open for a nearby walker, then close after departure',()=>{
 const interactions=buildInteractions(scene,interiors,{toast(){},showInfo(){},setEye(){}});
 for(const[id,s]of Object.entries(roomSpecs)){
  const x=s.x+s.w/2,z=id==='lounge'?-10.5:s.z,near=new THREE.Vector3(x+2,s.y+1.7,z);
  for(let i=0;i<20;i++)interactions.update(near,.025,'walk');
  assert.equal(hitsWall(x,z,s.y+1.7,interactions.colliders),false,id+' opens');
  for(let i=0;i<40;i++)interactions.update(new THREE.Vector3(300,100,300),.025,'walk');
  assert.equal(hitsWall(x,z,s.y+1.7,interactions.colliders),true,id+' closes');
 }
});
