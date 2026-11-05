import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,style:{},classList:{toggle(){}},focus(){}}),createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');await loadBrandAssets();
const {buildInteriors,roomSpecs}=await import('../dist/interiors.js'),{buildStadium}=await import('../dist/stadium.js'),{buildWalkBuilding}=await import('../dist/walk-building.js'),{buildWorld}=await import('../dist/world.js');
const {hospitalityTables,hospitalityChairs,hospitalityBar}=await import('../dist/hospitality-layout.js');
const {advanceWalker}=await import('../dist/walk-motion.js'),{hitsWall}=await import('../dist/navigation.js'),{destinationArrival}=await import('../dist/arrivals.js');
const {planWalkPath,navigationObstacles,walkSegmentClear}=await import('../dist/walk-path.js');
const scene=new THREE.Scene(),stadium=buildStadium(scene),world=buildWorld(scene),interiors=buildInteriors(scene,stadium.circulation),building=buildWalkBuilding(scene),geometry={rooms:roomSpecs,tiers:stadium.tiers},groups={interiors:interiors.colliders,world:world.colliders,circulation:stadium.circulation.colliders,building:building.colliders},spec=roomSpecs.lounge;
const walls=navigationObstacles({x:93,y:spec.y,z:-10.5},groups),blocked=(x,z,y)=>hitsWall(x,z,y,walls);
scene.updateMatrixWorld(true);

test('all skybox tables and chairs have solid walking clearance at their actual rendered positions',()=>{
 for(const table of hospitalityTables){
  const x=spec.x+table.x,z=spec.z+table.z,hit=new THREE.Raycaster(new THREE.Vector3(x,spec.y+1.5,z),new THREE.Vector3(0,-1,0),0,1.5).intersectObject(interiors.rooms.lounge,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-spec.y-table.height)<.002,'visible tabletop follows the shared layout');
  const p={x,z:z-2};advanceWalker(p,spec.y,0,4,geometry,blocked);assert.ok(p.z>z-1.8&&p.z<z-table.radius,'the body stops before the tabletop');
 }
 for(const chair of hospitalityChairs){const x=spec.x+chair.x,z=spec.z+chair.z,p={x,z:z-2};const hit=new THREE.Raycaster(new THREE.Vector3(x,spec.y+.5,z-2),new THREE.Vector3(0,0,1),0,4).intersectObject(interiors.rooms.lounge,true)[0];assert.ok(hit&&hit.distance<2,'chair has actual rendered geometry in the walking path');advanceWalker(p,spec.y,0,4,geometry,blocked);assert.ok(p.z>z-1.7&&p.z<z-chair.d/2,'the body cannot walk through a dining chair');}
 const p={x:94.5,z:0};advanceWalker(p,spec.y,-3.5,0,geometry,blocked);assert.ok(p.x>spec.x+hospitalityBar.x+hospitalityBar.w/2&&p.x<94.5,'the serving counter blocks the body');
});

test('skybox windows and end walls keep the walking camera outside their solid surfaces',()=>{
 for(const side of[-1,1]){const p={x:90,z:side*12.5};advanceWalker(p,spec.y,0,side*3,geometry,blocked);assert.ok(Math.abs(p.z)<13.7&&Math.abs(p.z)>13,'end walls retain body clearance');}
 const p={x:86,z:-12.5};advanceWalker(p,spec.y,-3,0,geometry,blocked);assert.ok(p.x>85.25&&p.x<85.6,'the window retains body clearance');
});

test('the skybox arrival and routes from window-side and serving aisles can return through the real doorway',()=>{
 const arrival=destinationArrival('lounge',geometry);assert.equal(blocked(arrival.position[0],arrival.position[2],arrival.position[1]),false);
 let checked=0;for(const x of[86,87,89.5,91.5,94.5])for(const z of[-12.5,-7.5,-2.5,2.5,7.5,12.5]){const origin={x,y:spec.y,z};if(blocked(x,z,spec.y+1.7))continue;const route=planWalkPath(origin,'concourse',geometry,groups);assert.equal(route.blocked,false,`return from ${x},${z}`);let throughDoor=false,p=origin;for(const next of route.path){if(p.x<95&&next.x>=95){const t=(95-p.x)/(next.x-p.x),crossing=p.z+(next.z-p.z)*t;throughDoor=Math.abs(crossing+10.5)<1.2;}assert.equal(walkSegmentClear(p,next,geometry,walls),true,`clear return segment from ${x},${z}`);p=next;}assert.equal(throughDoor,true,'return crosses the actual doorway');checked++;}assert.ok(checked>=20);
 for(const[x,z]of[[86,12.5],[87,-7.5],[89.5,2.5],[91.5,7.5],[94.5,0],[94.5,12.5]]){
  const p={x,z},route=planWalkPath({...p,y:spec.y},'concourse',geometry,groups);let feet=spec.y,outside=false;
  for(const next of route.path){for(let step=0;step<500;step++){const dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);if(d<.02)break;const stride=Math.min(.2,d),before={...p};feet=advanceWalker(p,feet,dx/d*stride,dz/d*stride,geometry,blocked);assert.ok(Math.hypot(p.x-before.x,p.z-before.z)>.001,`actual return keeps moving from ${x},${z}`);if(p.x>95.3){outside=true;break;}}if(outside)break;}
  assert.equal(outside,true,`actual walking can leave the skybox from ${x},${z}`);assert.equal(feet,spec.y);
 }
});
