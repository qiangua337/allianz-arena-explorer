import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {bowlIsVisible,buildVisitorBowlView,buildFrameBudget,compactStaticMeshes,freezeArchitecture}=await import('../dist/scene-budget.js');
const {destinations,matchesDestination}=await import('../dist/destinations.js');

test('pedestrian exterior and covered arcade omit the occluded bowl while pitch and high views retain it',()=>{
 for(const p of[{x:0,y:-2.4,z:214},{x:6,y:-1.2,z:110},{x:22,y:-1.2,z:80}])assert.equal(bowlIsVisible(p,'walk'),false);
 for(const p of[{x:0,y:1.7,z:0},{x:0,y:12.2,z:-83},{x:93,y:25.3,z:0},{x:250,y:174,z:307}])assert.equal(bowlIsVisible(p,'walk'),true);
});

test('looking through the connected player tunnel retains the pitch even from the dressing room',()=>{
 for(const x of [-88,-76,-70,-67,-61,-45,-31])assert.equal(bowlIsVisible({x,y:-1,z:0},'walk'),true,'tunnel sightline at '+x);
 assert.equal(bowlIsVisible({x:-88,y:-1,z:28},'walk'),false,'the enclosed away-room wing can still omit the bowl');
});
test('the visitor passage shows the real bowl through its aperture and throughout the exposed ramp',()=>{
 const camera=new THREE.PerspectiveCamera(66,1023/871,.06,4500),facesPortal=buildVisitorBowlView();
 const visible=()=>bowlIsVisible(camera.position,'walk',facesPortal(camera));
 camera.position.set(22,-1.2,80);
 camera.lookAt(22,-.7,62);
 assert.equal(visible(),true,'pitch-facing doorway reveals the bowl from inside');
 camera.lookAt(22,-.7,102);
 assert.equal(visible(),false,'a turn in place toward reception hides the bowl behind the corridor');
 camera.position.set(36,-1.2,111);camera.lookAt(22,-1.2,64);
 assert.equal(visible(),false,'reception does not render the bowl through its opaque inner wall');
 for(const [z,y] of [[66,-1.16],[65,-.7],[63,.2],[61,.87],[59.6,1.7]]){
  camera.position.set(22,y,z);
  for(const dx of [-20,20]){
   camera.lookAt(22+dx,8,z);
   assert.equal(visible(),true,`all exposed ramp views keep the bowl at z=${z}`);
  }
 }
});
test('static batching preserves instances and independently animated children',()=>{
 const group=new THREE.Group(),material=new THREE.MeshBasicMaterial(),geo=new THREE.BoxGeometry(1,1,1),rotor=new THREE.Group(),part=new THREE.Mesh(geo,material);rotor.add(part);group.add(rotor);const inst=new THREE.InstancedMesh(geo,material,3);group.add(inst);for(let i=0;i<4;i++)group.add(new THREE.Mesh(geo,material));compactStaticMeshes(group,[rotor]);assert.equal(inst.parent,group);assert.equal(part.parent,rotor);assert.equal(group.children.filter(x=>x.isMesh&&!x.isInstancedMesh).length,1);freezeArchitecture(group,[rotor]);assert.equal(rotor.matrixAutoUpdate,true);assert.equal(inst.matrixAutoUpdate,false);
});
test('idle scenes reduce rendering but movement, door animations and setting changes redraw immediately',()=>{
 const budget=buildFrameBudget(),camera=new THREE.PerspectiveCamera();assert.equal(budget.shouldDraw(camera,0),true);assert.equal(budget.shouldDraw(camera,.016),false);camera.position.x=1;assert.equal(budget.shouldDraw(camera,.032),true);assert.equal(budget.shouldDraw(camera,.048,true),true);budget.invalidate();assert.equal(budget.shouldDraw(camera,.064),true);assert.equal(budget.shouldDraw(camera,.08),false);assert.equal(budget.shouldDraw(camera,.5),true);
});
test('the custom destination browser filters categories and Chinese place names without a native select',()=>{
 assert.equal(new Set(destinations.map(p=>p.id)).size,destinations.length);assert.ok(destinations.some(p=>p.id==='upperStands'));assert.deepEqual(destinations.filter(p=>matchesDestination(p,'荣誉','public')).map(p=>p.id),['museum']);assert.equal(destinations.filter(p=>matchesDestination(p,'更衣','outside')).length,0);assert.equal(destinations.filter(p=>matchesDestination(p,'更衣','team')).length,2);
});
test('the destination search accepts common names and full-width floor filters',()=>{
 const ids=query=>destinations.filter(place=>matchesDestination(place,query)).map(place=>place.id);
 assert.deepEqual(ids('荣誉室'),['museum']);
 assert.deepEqual(ids('球员通道'),['tunnel']);
 assert.deepEqual(ids('看台 ４ｆ'),['upperStands']);
});
