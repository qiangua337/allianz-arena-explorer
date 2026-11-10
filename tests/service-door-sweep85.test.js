import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const {THREE}=await import('../dist/kit.js');
const {buildServiceRooms}=await import('../dist/service-rooms.js');
const {serviceWorld}=await import('../dist/service-layout.js');
const {hitsWall}=await import('../dist/navigation.js');

const model=buildServiceRooms(new THREE.Scene()),outside=door=>({...serviceWorld(door,0,3),y:door.y+1.7}),visitor=(door,side,y=door.y+1.7)=>({...serviceWorld(door,side,-1.2),y});
const occupied=(door,p)=>hitsWall(p.x,p.z,p.y,door.leaves.map(leaf=>leaf.collider));
function reset(door,opened=false){door.open=opened;for(let i=0;i<80;i++)model.update(outside(door),.05);assert.ok(opened?door.angle>1.5:door.angle<.001);}
function renderedLeafMatchesCollider(door){
 door.front.updateWorldMatrix(true,true);
 for(const leaf of door.leaves){
  const center=leaf.hinge.localToWorld(new THREE.Vector3(-leaf.side*.93,1.615,0));assert.ok(Math.abs(center.x-leaf.collider.cx)<1e-8);assert.ok(Math.abs(center.z-leaf.collider.cz)<1e-8);
  const normal=new THREE.Vector3(Math.sin(leaf.collider.yaw),0,Math.cos(leaf.collider.yaw)),hit=new THREE.Raycaster(center.clone().addScaledVector(normal,2),normal.negate(),0,3).intersectObject(leaf.hinge,true)[0];
  assert.ok(hit&&hit.distance>1.9&&hit.distance<2,door.id+' visible solid leaf follows collider');
 }
}

test('all service-door orientations stop the opening sweep before a visitor, including a 0.5 fps frame',()=>{
 for(const door of model.doors)for(const side of[-1,1])for(const dt of[.025,.2,2]){
  reset(door);const p=visitor(door,side);assert.equal(occupied(door,p),false);door.open=true;
  for(let frame=0;frame<20;frame++){model.update(p,dt);assert.equal(occupied(door,p),false,`${door.id}, ${side}, ${dt}, ${frame}`);renderedLeafMatchesCollider(door);}
  assert.ok(door.angle>.1&&door.angle<1.4,'stops at the body, even when the unobstructed final angle would be clear');
  model.update(outside(door),2);assert.ok(door.angle>1.5,'resumes when the visitor steps clear');
 }
});

test('a closing sweep also stops on a visitor inside the room and resumes without changing the requested state',()=>{
 for(const door of model.doors)for(const side of[-1,1])for(const dt of[.025,.2,2]){
  reset(door,true);const p=visitor(door,side);assert.equal(occupied(door,p),false);door.open=false;
  for(let frame=0;frame<20;frame++){model.update(p,dt);assert.equal(occupied(door,p),false);}
  assert.ok(door.angle>.7&&door.angle<1.5);assert.equal(door.open,false);renderedLeafMatchesCollider(door);
  model.update(outside(door),2);assert.ok(door.angle<.001);
 }
});

test('standing on a different storey does not block the service door and existing overlap may escape',()=>{
 for(const door of model.doors){
  reset(door);door.open=true;model.update(visitor(door,1,door.y+5),2);assert.ok(door.angle>1.5,'the floor above is not an obstacle');
  reset(door);const p={...serviceWorld(door,.95,0),y:door.y+1.7};assert.equal(occupied(door,p),true);door.open=true;
  for(let i=0;i<60;i++)model.update(p,.05);assert.ok(door.angle>1.5);assert.equal(occupied(door,p),false,'a pre-existing overlap can move out instead of deadlocking');
 }
});
