import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const elements=new Map();
function drawingContext(){const texts=[],base={texts,fillText:(text)=>texts.push(String(text)),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})};return new Proxy(base,{get:(o,k)=>k in o?o[k]:()=>{}});}
globalThis.document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',style:{},classList:{toggle(){}},focus(){}});return elements.get(id);},querySelector:()=>null,createElement:()=>{const context=drawingContext();return{width:0,height:0,getContext:()=>context};},createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets,mat}=await import('../dist/kit.js');
const {buildInteriors}=await import('../dist/interiors.js');
const {buildInteractions}=await import('../dist/interactions.js');
const {roomSpecs}=await import('../dist/building-layout.js');
const {buildTreatmentTable}=await import('../dist/facility-equipment.js');
const {tacticalBoardPlacement,tacticalBoardTarget,tacticalBoardLayout,tacticalFormations}=await import('../dist/tactical-layout.js');
const {tacticalPitchArtwork}=await import('../dist/tactical-board.js');
const {chooseInteraction}=await import('../dist/interaction-focus.js');
await loadBrandAssets();
const scene=new THREE.Scene(),interiors=buildInteriors(scene,{decorateConcourse(){}}),calls=[];
const interactions=buildInteractions(scene,interiors,{toast:text=>calls.push(text),showInfo(){}});scene.updateMatrixWorld(true);
const camera=new THREE.PerspectiveCamera();
function aim(origin,target){camera.position.set(...origin);camera.lookAt(...target);interactions.update(camera.position,.016,'walk',camera);return document.body.dataset.interaction;}
function diagram(roomId){return interiors.rooms[roomId].getObjectByName(roomId+' tactical diagram');}

test('looking at the actual oblique board surface selects the right board in both changing rooms',()=>{
 for(const roomId of ['homeRoom','guestRoom']){
  const mesh=diagram(roomId),p=tacticalBoardPlacement(roomId),bounds=new THREE.Box3().setFromObject(mesh),center=bounds.getCenter(new THREE.Vector3());
  assert.ok(center.distanceTo(new THREE.Vector3(p.x,p.y,p.z))<1e-6,'rendered surface uses the shared placement');
  for(const[dx,dy,dz]of [[-.91,-.4,-1.1],[-2.3,-.4,0],[-1.7,-.4,1.2]]){
   const selected=aim([p.x+dx,p.y+dy,p.z+dz],[p.x,p.y,p.z]),direction=new THREE.Vector3();camera.getWorldDirection(direction);
   const hit=new THREE.Raycaster(camera.position,direction).intersectObject(mesh)[0];
   assert.ok(hit&&hit.distance<2.8,'actual visible plane is in reach');assert.equal(selected,'tactics-'+roomId,'F follows the visible plane rather than the old displaced cube');
  }
 }
});
test('empty space beside the board, its rear and the corridor beyond the wall do not operate it',()=>{
 for(const roomId of ['homeRoom','guestRoom']){
  const p=tacticalBoardPlacement(roomId),target=tacticalBoardTarget(roomId),s=roomSpecs[roomId];
  for(const[dy,dz]of [[tacticalBoardLayout.height/2+.08,0],[0,tacticalBoardLayout.width/2+.08]]){
   aim([p.x-1.1,p.y-.4,p.z],[p.x,p.y+dy,p.z+dz]);const direction=new THREE.Vector3();camera.getWorldDirection(direction);
   assert.equal(new THREE.Raycaster(camera.position,direction).intersectObject(diagram(roomId)).length,0);
   assert.equal(chooseInteraction([target],camera.position,direction),null);
  }
  const selected=aim([s.x+s.w/2+.8,s.y+1.7,p.z],[p.x,p.y,p.z]),direction=new THREE.Vector3();camera.getWorldDirection(direction);
  const walls=[];interiors.shells[roomId].traverse(o=>{if(o.isMesh)walls.push(o);});
  const hit=new THREE.Raycaster(camera.position,direction).intersectObjects(walls,false)[0];
  assert.ok(hit&&hit.distance<camera.position.distanceTo(new THREE.Vector3(p.x,p.y,p.z)),'a real wall lies in front of the board');
  assert.notEqual(selected,target.id,'the board is unavailable through that wall');assert.equal(chooseInteraction([target],camera.position,direction),null);
  assert.equal(target.hitTest({x:p.x+.01,y:p.y,z:p.z},{x:-1,y:0,z:0}),null,'the rear is not a control');
 }
});
test('the two boards switch independently, keep the native aspect ratio and use eleven roles rather than fake kit numbers',()=>{
 const home=diagram('homeRoom').material.map,guest=diagram('guestRoom').material.map,b=tacticalBoardLayout;
 assert.equal(home.image.width/home.image.height,b.width/b.height);assert.equal(guest.image.width/guest.image.height,b.width/b.height);
 assert.ok(Math.abs(tacticalPitchArtwork.width/tacticalPitchArtwork.height-105/68)<1e-10,'the field itself also keeps real proportions');
 for(const formation of tacticalFormations){assert.equal(formation.roles.length,11);assert.equal(formation.roles.filter(([role])=>role==='GK').length,1);assert.ok(formation.roles.every(([role])=>/^[A-Z]+$/.test(role)));}
 assert.ok(home.image.getContext('2d').texts.includes('4–2–3–1'));assert.ok(!home.image.getContext('2d').texts.some(t=>/^\d{1,2}$/.test(t)));
 const guestVersion=guest.version,homeVersion=home.version,p=tacticalBoardPlacement('homeRoom');aim([p.x-.91,p.y-.4,p.z-1.1],[p.x,p.y,p.z]);assert.equal(interactions.activate(),true);
 assert.ok(home.version>homeVersion);assert.equal(guest.version,guestVersion);assert.ok(calls.at(-1).includes('主队更衣室 · 4–4–2'));
 interactions.update(camera.position,.016,'walk',camera);assert.equal(interactions.isAnimating(),true,'a touch activation repaints immediately even when the camera is still');
 interactions.update(camera.position,.016,'walk',camera);assert.equal(interactions.isAnimating(),false,'the repaint does not become a permanent animation');
 const lastHome=home.version,q=tacticalBoardPlacement('guestRoom');aim([q.x-1.5,q.y-.4,q.z],[q.x,q.y,q.z]);assert.equal(interactions.activate(),true);
 assert.equal(home.version,lastHome);assert.ok(guest.version>guestVersion);assert.ok(calls.at(-1).includes('客队更衣室 · 4–4–2'));
 interiors.setTactics(1,'guestRoom');const sameVersion=guest.version;interiors.setTactics(1,'guestRoom');assert.equal(guest.version,sameVersion,'a repeated state does not upload the canvas again');
});
test('all four treatment trolley wheels rest on the changing-room floor',()=>{
 const group=new THREE.Group(),table=buildTreatmentTable(group,{x:4.8,z:-6,metal:mat(0x899397),dark:mat(0x24282c),pad:mat(0x8e2338)});group.updateMatrixWorld(true);
 const wheels=table.children.filter(o=>o.name==='Treatment trolley wheel');assert.equal(wheels.length,4);
 for(const wheel of wheels){const bounds=new THREE.Box3().setFromObject(wheel);assert.ok(Math.abs(bounds.min.y)<1e-7,'caster meets floor without floating or sinking');}
});
