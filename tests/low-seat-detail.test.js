import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');await loadBrandAssets();
const {buildStadium}=await import('../dist/stadium.js');
const scene=new THREE.Scene(),stadium=buildStadium(scene),camera=new THREE.PerspectiveCamera(),patch=[stadium.bowl.getObjectByName('Nearby moulded seating shells'),stadium.bowl.getObjectByName('Nearby seat mounting frames')],base=stadium.bowl.children.filter(o=>o.isInstancedMesh&&o.instanceColor&&o.count>384);
const triangles=mesh=>(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*mesh.count;

test('low-quality walkers and seated visitors retain a bounded solid seat patch while distant seating stays cheap',()=>{
 assert.equal(base.length,24);const nodes=stadium.bowl.children.length;
 for(const index of[8000,22000,41000,61000])for(const eye of[1.7,.98]){
  const seat=stadium.seatPositions[index];camera.position.set(seat.x,seat.y+eye,seat.z);stadium.update(camera,'walk',false,true,false);
  assert.ok(stadium.detailSeatCount>0&&stadium.detailSeatCount<=32);assert.equal(patch.filter(m=>m.visible&&m.count>0).length,2,'detail costs only the existing two instanced draws');
  assert.ok(patch.reduce((sum,m)=>sum+triangles(m),0)<=14208,'32 detailed seats add no more than 14,208 triangles');
  assert.ok(base.every(m=>m.geometry.type==='PlaneGeometry'&&triangles(m)===m.count*2),'low-quality far seats remain the two-triangle fallback');assert.equal(stadium.bowl.children.length,nodes);
 }
});

test('playing or low-quality orbit disables the patch and restoring quality restores its larger phone budget',()=>{
 const saved=globalThis.innerWidth;globalThis.innerWidth=390;
 try{const seat=stadium.seatPositions[41000];camera.position.set(seat.x,seat.y+.98,seat.z);
  stadium.update(camera,'walk',false,true,false);assert.ok(stadium.detailSeatCount>0&&stadium.detailSeatCount<=32);
  stadium.update(camera,'walk',false,true,true);assert.equal(stadium.detailSeatCount,0);assert.ok(patch.every(m=>!m.visible&&m.count===0));
  stadium.update(camera,'orbit',false,true,false);assert.equal(stadium.detailSeatCount,0);
  stadium.update(camera,'walk',false,false,false);const standard=stadium.detailSeatCount;assert.ok(standard>32&&standard<=128);
  stadium.update(camera,'walk',true,false,false);assert.ok(stadium.detailSeatCount>=standard&&stadium.detailSeatCount<=384);
  stadium.update(camera,'walk',false,true,false);assert.ok(stadium.detailSeatCount>0&&stadium.detailSeatCount<=32);assert.equal(stadium.bowl.getObjectByName('Nearby moulded seating shells'),patch[0]);
 }finally{if(saved===undefined)delete globalThis.innerWidth;else globalThis.innerWidth=saved;}
});
