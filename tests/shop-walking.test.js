import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
const elements=new Map();globalThis.document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',style:{},classList:{toggle(){}},focus(){}});return elements.get(id);},querySelector:()=>null,createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');await loadBrandAssets();
const {buildInteriors,roomSpecs}=await import('../dist/interiors.js'),{buildInteractions}=await import('../dist/interactions.js');
const {shopWallDisplays,shopFeature,shopWorld}=await import('../dist/shop-layout.js');
const {advanceWalker}=await import('../dist/walk-motion.js'),{hitsWall}=await import('../dist/navigation.js');
const {navigationObstacles,walkSegmentClear,planWalkPath}=await import('../dist/walk-path.js');
const scene=new THREE.Scene(),interiors=buildInteriors(scene,{decorateConcourse(){}}),interactions=buildInteractions(scene,interiors,{toast(){},showInfo(){},setEye(){}}),spec=roomSpecs.store,geometry={rooms:roomSpecs},groups={interiors:interiors.colliders},walls=navigationObstacles({x:12,y:spec.y,z:118},groups),blocked=(x,z,y)=>hitsWall(x,z,y,walls);
scene.updateMatrixWorld(true);

test('all eleven shop bays have actual shallow shelves and stop the walking body before the garments',()=>{
 assert.equal(shopWallDisplays.length,11);
 for(const fixture of shopWallDisplays){
  const p=shopWorld(fixture.x,0,fixture.z+.31),origin={x:p.x-fixture.side*1.4,z:p.z},end={x:p.x+fixture.side*.25,y:spec.y,z:p.z};
  const hit=new THREE.Raycaster(new THREE.Vector3(origin.x,spec.y+1.7,origin.z),new THREE.Vector3(fixture.side,0,0),0,2).intersectObject(interiors.rooms.store,true)[0];assert.ok(hit&&hit.distance<1.5,'rendered storage in the path '+fixture.id);
  assert.equal(walkSegmentClear({...origin,y:spec.y},end,geometry,walls),false,'guidance cannot cross '+fixture.id);
  advanceWalker(origin,spec.y,fixture.side*2.8,0,geometry,blocked);assert.ok((p.x-origin.x)*fixture.side>fixture.w/2,'the body stops before the actual bay '+fixture.id);assert.equal(blocked(origin.x,origin.z,spec.y+1.7),false);
 }
});

test('the rotating shirt plinth touches the floor and remains solid before and after browsing',()=>{
 const base=scene.getObjectByName('Grounded rotating shirt plinth'),root=scene.getObjectByName('Browse Bayern player shirts'),before=new THREE.Box3().setFromObject(base),p=shopWorld(shopFeature.x,0,shopFeature.z);
 assert.ok(Math.abs(before.min.y-spec.y)<1e-6,'no 19cm floating base');
 const visitor={x:p.x,z:p.z-1.5};advanceWalker(visitor,spec.y,0,3,geometry,blocked);assert.ok(visitor.z<p.z-shopFeature.radius,'cannot walk through the displayed shirt and stand');
 const camera=new THREE.PerspectiveCamera();camera.position.set(p.x+2,spec.y+1.7,p.z);camera.lookAt(p.x,spec.y+shopFeature.y,p.z);interactions.update(camera.position,.016,'walk',camera);
 assert.equal(document.body.dataset.interaction,'shirt');assert.ok(elements.get('interact').textContent.includes('9 KANE'));assert.equal(root.userData.playerNumber,9);
 interactions.activate();scene.updateMatrixWorld(true);assert.equal(root.userData.playerNumber,10);assert.ok(elements.get('interact').textContent.includes('10 MUSIALA'));const after=new THREE.Box3().setFromObject(base);assert.ok(after.min.distanceTo(before.min)<1e-6&&after.max.distanceTo(before.max)<1e-6,'only the shirt turns, never a rectangular footprint through visitors');
});

test('free shop aisles retain clear routes around the feature display and return through the actual exit',()=>{
 let checked=0;
 for(const x of[-12.5,-10.1,0,10.4,12])for(const z of[112.5,116.55,119.65,122.8]){
  if(blocked(x,z,spec.y+1.7))continue;const origin={x,y:spec.y,z},route=planWalkPath(origin,'concourse',geometry,groups);assert.equal(route.blocked,false,'a return route from '+x+','+z);let previous=origin,throughDoor=false;for(const next of route.path){assert.equal(walkSegmentClear(previous,next,geometry,walls),true,'actual clearance on '+previous.id+' to '+next.id);const east=spec.x+spec.w/2;if(previous.x<east&&next.x>=east){const t=(east-previous.x)/(next.x-previous.x),crossing=previous.z+(next.z-previous.z)*t;throughDoor=Math.abs(crossing-spec.z)<1.2;}previous=next;}assert.equal(throughDoor,true,'crosses the actual east-side door opening');checked++;
 }
 assert.ok(checked>=15);
});

test('all six rendered automatic leaves stay solid at their current position throughout opening and closing',()=>{
 for(const[id,s]of Object.entries(roomSpecs)){
  const x=s.x+s.w/2,z=id==='lounge'?-10.5:s.z,visitor=new THREE.Vector3(x+2,s.y+1.7,z),leaf=scene.getObjectByName(id+' automatic door').getObjectByName('Solid moving door leaf'),collider=interactions.colliders.find(c=>c.owner===id);
  for(let i=0;i<30;i++){interactions.update(visitor,.025,'walk');scene.updateMatrixWorld(true);const centre=leaf.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(centre.x-collider.cx)<1e-6&&Math.abs(centre.z-collider.cz)<1e-6,id+' physics follows actual rendered geometry');assert.equal(hitsWall(centre.x,centre.z,s.y+1.7,[collider]),true,id+' panel never loses its solid body');}
  assert.equal(hitsWall(x,z,s.y+1.7,[collider]),false,id+' threshold is clear');
  for(let i=0;i<50;i++)interactions.update(new THREE.Vector3(300,100,300),.025,'walk');assert.equal(hitsWall(x,z,s.y+1.7,[collider]),true,id+' closes');
 }
});
