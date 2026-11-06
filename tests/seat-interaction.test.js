import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createSeatInteraction} from '../dist/seat-interaction.js';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
function documentFixture(){const elements=new Map();globalThis.document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',style:{},focus(){}});return elements.get(id);},createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};},querySelector:()=>null};return elements;}
documentFixture();
const{THREE,loadBrandAssets}=await import('../dist/kit.js'),{buildStadium}=await import('../dist/stadium.js'),{buildInteractions}=await import('../dist/interactions.js'),{buildServiceRooms}=await import('../dist/service-rooms.js'),{serviceRooms,serviceWorld}=await import('../dist/service-layout.js'),{roomSpecs}=await import('../dist/building-layout.js');await loadBrandAssets();
const stadium=buildStadium(new THREE.Scene());
const direction=(from,to)=>({x:to.x-from.x,y:to.y-from.y,z:to.z-from.z});

test('nearby real stadium seats are selected in their rendered positions and queries inspect only local buckets',()=>{
 const picker=createSeatInteraction(stadium.seatPositions);assert.ok(picker.count>70000);
 for(const index of[0,8000,22000,41000,61000,74000]){
  const seat=stadium.seatPositions[index],origin={x:seat.x-Math.sin(seat.yaw)*1.3,y:seat.y+1.2,z:seat.z-Math.cos(seat.yaw)*1.3},target={...seat,y:seat.y+.48};
  const selected=picker.pick(origin,direction(origin,target));assert.ok(selected);assert.equal(selected.seat,seat);assert.ok(picker.inspected<1200,`local query inspects ${picker.inspected} of ${picker.count} seats`);
 }
 assert.equal(picker.pick({x:500,y:1.7,z:500},{x:0,y:0,z:-1}),null);assert.equal(picker.inspected,0);
});

test('seat focus rejects chairs behind the visitor, other storeys and beyond reach, and chooses the first solid seat',()=>{
 const a={x:0,y:0,z:0,yaw:Math.PI},b={x:0,y:0,z:1,yaw:Math.PI},picker=createSeatInteraction([a,b]);
 const origin={x:0,y:1.3,z:-1.5},target={x:0,y:.5,z:0};assert.equal(picker.pick(origin,direction(origin,target)).seat,a);
 assert.equal(picker.pick(origin,{x:0,y:0,z:-1}),null);assert.equal(picker.pick({x:0,y:1.3,z:-7},direction({x:0,y:1.3,z:-7},target)),null);assert.equal(picker.pick({x:0,y:7,z:-1.5},direction({x:0,y:7,z:-1.5},target)),null);assert.equal(picker.pick(origin,{x:NaN,y:0,z:1}),null);
});

test('a seat session preserves the safe standing point, aligns with the cushion and stands exactly once',()=>{
 const seat={x:81,y:24,z:-30,yaw:1.2},position={x:83,y:25.3,z:-30},calls=[],control=createSeatInteraction([seat],{onSit:s=>calls.push(['sit',s]),onStand:s=>calls.push(['stand',s])});
 const session=control.sit({id:'seat-0',seat},position);assert.deepEqual(session.standingPosition,position);assert.notEqual(session.standingPosition,position);assert.deepEqual(session.eyePosition,{x:81,y:24.98,z:-30});assert.equal(session.feet,23.81);assert.equal(session.yaw,seat.yaw);
 position.x=81;position.y=24.98;assert.equal(session.standingPosition.x,83);assert.equal(control.sit({id:'seat-0',seat},position),null);assert.equal(control.stand(),true);assert.equal(control.session,null);assert.equal(control.stand(),false);assert.deepEqual(calls.map(c=>c[0]),['sit','stand']);assert.equal(calls[1][1],session);
});

test('real-seat interaction moves via the session callback and F always offers a safe stand even after looking away',()=>{
 const elements=documentFixture(),seat=stadium.seatPositions[41000],camera=new THREE.PerspectiveCamera(),standing=new THREE.Vector3(seat.x-Math.sin(seat.yaw)*1.3,seat.y+1.2,seat.z-Math.cos(seat.yaw)*1.3);camera.position.copy(standing);camera.lookAt(seat.x,seat.y+.48,seat.z);let ended=0;
 const interactions=buildInteractions(new THREE.Scene(),{}, {toast(){},showInfo(){},seats:stadium.seatPositions,onSit:s=>{camera.position.set(s.eyePosition.x,s.eyePosition.y,s.eyePosition.z);camera.rotation.set(0,s.yaw,0);},onStand:s=>{camera.position.set(s.standingPosition.x,s.standingPosition.y,s.standingPosition.z);ended++;}});
 interactions.update(camera.position,.016,'walk',camera);assert.equal(interactions.activate(),true);assert.equal(interactions.seated,true);assert.ok(camera.position.distanceTo(standing)>.5);assert.equal(elements.get('interact').textContent,'F · 起身继续参观');
 camera.lookAt(camera.position.x,camera.position.y+10,camera.position.z);interactions.update(camera.position,.016,'walk',camera);assert.equal(elements.get('interact').hidden,false);assert.equal(interactions.activate(),true);assert.equal(interactions.seated,false);assert.equal(ended,1);assert.ok(camera.position.distanceTo(standing)<1e-9);assert.equal(interactions.stand(),false);
});

test('a service door button immediately reflects repeated open and close actions without moving the camera',()=>{
 const elements=documentFixture(),scene=new THREE.Scene(),service=buildServiceRooms(scene),room=serviceRooms[0],p=serviceWorld(room,0,2),camera=new THREE.PerspectiveCamera();camera.position.set(p.x,13.9,p.z);camera.lookAt(room.x,13.7,room.z);
 const ray=camera.getWorldDirection(new THREE.Vector3()),seat={x:camera.position.x+ray.x*1.2,y:camera.position.y-.5,z:camera.position.z+ray.z*1.2,yaw:0};let focused=0;
 const interactions=buildInteractions(scene,{}, {toast(){},showInfo(){},serviceRooms:service,seats:[seat],onFocusSeat(){focused++;}});interactions.update(camera.position,.016,'walk',camera);
 assert.equal(elements.get('interact').textContent,'F · 打开服务间双门');assert.equal(interactions.activate(),true);assert.equal(service.doors[0].open,true);assert.equal(elements.get('interact').textContent,'F · 关闭服务间双门');
 interactions.update(camera.position,.016,'walk',camera);assert.equal(elements.get('interact').textContent,'F · 关闭服务间双门');assert.equal(interactions.activate(),true);assert.equal(service.doors[0].open,false);assert.equal(elements.get('interact').textContent,'F · 打开服务间双门');assert.equal(focused,0,'service doors take priority over nearby seats');
});

test('the actual middle-tier arrival discovers a nearby side chair, then focusing it enables strict ray selection',()=>{
 const elements=documentFixture(),camera=new THREE.PerspectiveCamera(),standing=new THREE.Vector3(82.55,25.3,-30.1),picker=createSeatInteraction(stadium.seatPositions);camera.position.copy(standing);camera.rotation.set(-.1834,1.9204,0,'YXZ');
 const initialRay=camera.getWorldDirection(new THREE.Vector3());assert.equal(picker.pick(camera.position,initialRay),null);const nearby=picker.nearest(camera.position);assert.ok(nearby&&nearby.distance<=2.6);assert.ok(picker.inspected<1200);assert.equal(picker.nearest({x:500,y:1.7,z:500}),null);assert.equal(picker.inspected,0);
 let focuses=0,sits=0;const interactions=buildInteractions(new THREE.Scene(),{}, {toast(){},showInfo(){},seats:stadium.seatPositions,onFocusSeat:({target})=>{focuses++;camera.lookAt(target.x,target.y,target.z);},onSit(){sits++;}});
 interactions.update(camera.position,.016,'walk',camera);assert.equal(elements.get('interact').textContent,'F · 附近座位 · 看过去');assert.equal(interactions.activate(),true);assert.equal(focuses,1);assert.equal(sits,0);assert.equal(interactions.seated,false);assert.ok(camera.position.distanceTo(standing)<1e-9,'discovery only turns the view');assert.equal(elements.get('interact').textContent,'F · 坐下观看球场');
 assert.ok(picker.pick(camera.position,camera.getWorldDirection(new THREE.Vector3())));assert.equal(interactions.activate(),true);assert.equal(sits,1);assert.equal(interactions.seated,true);
});

test('bowl seats behind skybox glass or any same-level room wall are unavailable even when nearby and directly aimed at',()=>{
 const actual=stadium.seatPositions.filter(s=>s.x>83&&s.x<84.5&&s.y>23.4&&s.y<24&&s.z>2&&s.z<3).sort((a,b)=>b.x-a.x)[0];assert.ok(actual);const cases=[{position:{x:85.4,y:25.3,z:actual.z},seat:actual}];
 for(const room of Object.values(roomSpecs)){const position={x:room.x-room.w/2+.4,y:room.y+1.7,z:room.z};cases.push({position,seat:{x:position.x-1.3,y:room.y+.3,z:position.z,yaw:Math.PI/2}});}
 for(const{position,seat}of cases){
  const elements=documentFixture(),camera=new THREE.PerspectiveCamera();camera.position.copy(position);camera.lookAt(seat.x,seat.y+.45,seat.z);const picker=createSeatInteraction([seat]);assert.ok(picker.pick(position,camera.getWorldDirection(new THREE.Vector3())),'fixture is close enough for an unprotected bowl selection');assert.ok(picker.nearest(position));let focused=0,sat=0;
  const interactions=buildInteractions(new THREE.Scene(),{}, {toast(){},showInfo(){},seats:[seat],onFocusSeat(){focused++;},onSit(){sat++;}});interactions.update(camera.position,.016,'walk',camera);assert.ok(!document.body.dataset.interaction.startsWith('seat-')&&!document.body.dataset.interaction.startsWith('focus-seat-'));assert.notEqual(elements.get('interact').textContent,'F · 坐下观看球场');assert.notEqual(elements.get('interact').textContent,'F · 附近座位 · 看过去');assert.equal(focused+sat,0);
 }
});
