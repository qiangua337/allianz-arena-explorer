import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainInteriorOrbit} from '../dist/interior-orbit.js';
import {roomSpecs} from '../dist/building-layout.js';
import {pressFloorRise} from '../dist/facility-layout.js';

function safe(result,id){
 const s=roomSpecs[id],ceiling=id==='lounge'?3.725:4.5;
 for(const p of [result.position,result.target]){
  assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.x>=s.x-s.w/2+.65-1e-7&&p.x<=s.x+s.w/2-.65+1e-7,id+' x envelope');
  assert.ok(p.z>=s.z-s.d/2+.65-1e-7&&p.z<=s.z+s.d/2-.65+1e-7,id+' z envelope');
  const floor=s.y+(id==='press'?pressFloorRise(p.z-s.z):0);
  assert.ok(p.y>=floor+.65-1e-7,id+' actual floor');assert.ok(p.y<=s.y+ceiling-.4+1e-7,id+' ceiling');
 }
 assert.ok(Math.hypot(result.position.x-result.target.x,result.position.y-result.target.y,result.position.z-result.target.z)>.01,'camera remains separate from its target');
}
test('all six interior orbit views remain inside the real room throughout 360 degrees and zoom extremes',()=>{
 for(const[id,s]of Object.entries(roomSpecs))for(const radius of [.05,.4,3,11,80])for(let degrees=0;degrees<360;degrees+=5){
  const angle=degrees*Math.PI/180,target={x:s.x-2,y:s.y+1.7,z:s.z};
  safe(constrainInteriorOrbit({x:target.x+Math.cos(angle)*radius,y:target.y+.1,z:target.z+Math.sin(angle)*radius},target,s),id);
 }
});
test('the reported home-room automatic orbit cannot reach or cross a red wall',()=>{
 const target={x:-85.3,y:-1,z:0},radius=Math.hypot(-75.8-target.x,5.8);
 for(let degrees=0;degrees<360;degrees++){
  const a=degrees*Math.PI/180,result=constrainInteriorOrbit({x:target.x+Math.cos(a)*radius,y:-.9,z:Math.sin(a)*radius},target,roomSpecs.homeRoom);
  safe(result,'homeRoom');assert.deepEqual(result.target,target);
 }
});
test('extreme panning and vertical orbit angles keep target and eye inside without disabling the orbit',()=>{
 for(const[id,s]of Object.entries(roomSpecs))for(const x of [-1000,s.x,1000])for(const z of [-1000,s.z,1000])for(const y of [-1000,s.y+1.7,1000]){
  const target={x,y,z},camera={x:x+17,y:y+(y>0?70:-70),z:z+9};safe(constrainInteriorOrbit(camera,target,s),id);
 }
 const s=roomSpecs.homeRoom,target={x:s.x,y:s.y+1.7,z:s.z},camera={x:s.x+2,y:s.y+2,z:s.z+3},result=constrainInteriorOrbit(camera,target,s);
 assert.deepEqual(result,{position:camera,target},'a safe orbit is untouched');
 const panned=constrainInteriorOrbit({x:1002,y:1000.3,z:1003},{x:1000,y:1000,z:1000},s),dx=panned.position.x-panned.target.x,dy=panned.position.y-panned.target.y,dz=panned.position.z-panned.target.z;
 assert.ok(Math.abs(dx/dz-2/3)<1e-6&&Math.abs(dy/dz-.3/3)<1e-6,'clamping a pan preserves the orbit ray direction');
});
test('press camera clipping honours every tread and never buries an eye below the raised rear platform',()=>{
 const s=roomSpecs.press;
 for(let z=-8.5;z<8.5;z+=.3)for(const dy of [-4,-.8,0,1])for(const dz of [-25,25]){
  const target={x:s.x,y:s.y+1.0,z:s.z+z};safe(constrainInteriorOrbit({x:s.x+3,y:target.y+dy,z:target.z+dz},target,{...s}), 'press');
 }
 // Exactly the fourth tread edge: the last interval has the lower floor,
 // whereas the endpoint itself already belongs to the next raised tread.
 const target={x:s.x,y:s.y+.95,z:s.z-1.55},camera={x:s.x,y:s.y+.95,z:s.z-1.525+4*1.05};safe(constrainInteriorOrbit(camera,target,s),'press');
});
test('degenerate input remains usable, no input object is mutated, and an explicit ceiling can be supplied',()=>{
 const spec=roomSpecs.store,target=Object.freeze({x:NaN,y:Infinity,z:undefined}),camera=Object.freeze({x:NaN,y:NaN,z:NaN});safe(constrainInteriorOrbit(camera,target,spec),'store');
 const zero={x:spec.x,y:spec.y+1.7,z:spec.z};safe(constrainInteriorOrbit(zero,zero,spec),'store');
 const result=constrainInteriorOrbit({x:spec.x+2,y:100,z:spec.z},{x:spec.x,y:spec.y+1.7,z:spec.z},spec,{ceilingHeight:3.2});assert.ok(result.position.y<=spec.y+2.8+1e-7);
});
