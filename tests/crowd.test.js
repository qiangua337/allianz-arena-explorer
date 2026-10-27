import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{}});let imageFails=false;
globalThis.document={createElement:()=>({getContext:()=>context}),createElementNS:()=>{const events={},image={width:1254,height:1254,addEventListener:(k,f)=>events[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>imageFails?events.error?.(new Error('network')):events.load?.call(image));}};return image;}};
const {THREE}=await import('../dist/kit.js');
const {buildMatchdayCrowd}=await import('../dist/matchday-crowd.js');
const {createCrowdLayout,supporterAtlas,crowdDetailBudget}=await import('../dist/crowd-layout.js');
const {supporterGeometry}=await import('../dist/supporter-model.js');
const seats=Array.from({length:8000},(_,i)=>({x:42+(i%40)*.5,z:-40+Math.floor(i/40)*.4,y:.7+(i%40)*.34,yaw:Math.PI/2,color:0xc91c36,sector:Math.floor(i%200/200*24)}));

test('the generated atlas has real transparency and eight complete readable frames with a consistent physical pixel scale',()=>{
 const file=fs.readFileSync(new URL('../dist/assets/crowd/supporters-atlas-3100.png',import.meta.url));assert.equal(file.readUInt32BE(16),supporterAtlas.width);assert.equal(file.readUInt32BE(20),supporterAtlas.height);assert.equal(file[25],6,'PNG RGBA source');assert.equal(supporterAtlas.frames.length,8);
 for(const[x,y,w,h]of supporterAtlas.frames){assert.ok(x>=0&&y>=0&&w>170&&h>580);assert.ok(x+w<=supporterAtlas.width&&y+h<=supporterAtlas.height);assert.ok(w/h*1.5>.45,'a broad enough adult, not the old stick-sized sprite');}
});
test('audience occupancy is deterministic and phone budgets do not remove whole seating patterns',()=>{
 const a=createCrowdLayout(seats),b=createCrowdLayout(seats);assert.ok(a.count>seats.length*.90&&a.count<seats.length*.97);assert.deepEqual(a.records.map(r=>[r.id,r.frame]),b.records.map(r=>[r.id,r.frame]));assert.equal(new Set(a.records.map(r=>r.frame)).size,8);assert.equal(new Set(a.records.map(r=>r.seat)).size,a.count);assert.ok(a.records.every(r=>seats.includes(r.seat)));
 const phone=a.nearby({x:45,y:6,z:0},{mobile:true}),desktop=a.nearby({x:45,y:6,z:0});assert.equal(phone.length,crowdDetailBudget(true));assert.equal(desktop.length,crowdDetailBudget(false));assert.equal(new Set(phone.map(r=>r.id)).size,phone.length);
});
test('actual near spectators replace their far counterpart and remain within the mobile draw and instance budget',()=>{
 const audience=buildMatchdayCrowd(new THREE.Group(),seats,{mobile:true});assert.equal(audience.root.visible,false);audience.setEnabled(true);audience.update(1,{x:45,y:6,z:0});const near=audience.root.getObjectByName('Seated 3D spectators · bounded near detail'),far=audience.root.children.filter(o=>o.isInstancedMesh&&o.geometry.attributes.fanDetail);
 assert.equal(near.count,128);assert.equal(audience.nearCount,128);assert.ok(!near.isSkinnedMesh);assert.ok(near.geometry.index===null);assert.ok(near.geometry.attributes.position.count/3<700);assert.equal(far.reduce((sum,o)=>sum+o.geometry.attributes.fanDetail.array.reduce((a,b)=>a+b,0),0),near.count);
 const matrix=new THREE.Matrix4();near.getMatrixAt(0,matrix);assert.ok(matrix.elements.every(Number.isFinite));const version=near.instanceMatrix.version;for(let i=0;i<200;i++)audience.update(1+i/60,{x:45,y:6,z:0});assert.equal(near.instanceMatrix.version,version,'stationary viewers do not rebuild all audience matrices');
 audience.update(5,{x:999,y:6,z:999});assert.equal(near.count,0);assert.equal(far.reduce((sum,o)=>sum+o.geometry.attributes.fanDetail.array.reduce((a,b)=>a+b,0),0),0);audience.setEnabled(false);assert.equal(audience.root.visible,false);
});
test('missing photo downloads keep a visible fallback crowd and can be retried',async()=>{
 const audience=buildMatchdayCrowd(new THREE.Group(),seats.slice(0,800),{mobile:true});audience.setEnabled(true);imageFails=true;assert.equal(await audience.prepare(),false);assert.equal(audience.assetState,'unavailable');assert.ok(audience.count>700);assert.ok(audience.root.visible);imageFails=false;assert.equal(await audience.prepare(),true);assert.equal(audience.assetState,'ready');const sprites=audience.root.children.find(o=>o.geometry?.attributes.fanTile);assert.equal(sprites.material.map.name,'Generated supporters photo atlas 3.1');
});

test('lightweight quality removes near mesh work while keeping occupied seats and restores detail without duplication',()=>{
 const audience=buildMatchdayCrowd(new THREE.Group(),seats,{mobile:true});audience.setEnabled(true);audience.update(1,{x:45,y:6,z:0});const count=audience.count;assert.equal(audience.nearCount,128);audience.setQuality('low');audience.update(2,{x:45,y:6,z:0});assert.equal(audience.nearCount,0);assert.equal(audience.count,count);audience.setQuality('standard',.7);audience.update(3,{x:45,y:6,z:0});assert.equal(audience.nearCount,Math.round(128*.7));audience.setQuality('high');audience.update(4,{x:45,y:6,z:0});assert.equal(audience.nearCount,128);
});
test('supporters have grounded seated geometry, independent gestures and an explicit reduced-motion path',()=>{
 const g=supporterGeometry();g.computeBoundingBox();assert.ok(g.boundingBox.min.y>=.01&&g.boundingBox.max.y<1.5);assert.ok(g.attributes.fanArm.array.some(x=>x<0)&&g.attributes.fanArm.array.some(x=>x>0));assert.equal(g.attributes.color.count,g.attributes.position.count);
 const normal=buildMatchdayCrowd(new THREE.Group(),seats.slice(0,100)),reduced=buildMatchdayCrowd(new THREE.Group(),seats.slice(0,100),{reducedMotion:true});
 for(const audience of[normal,reduced]){audience.setEnabled(true);audience.react(10,1);audience.update(11,{x:45,y:6,z:0});}
 const shader=()=>({uniforms:{},vertexShader:'#include <uv_vertex>\n#include <begin_vertex>',fragmentShader:'#include <map_fragment>'});const a=shader(),b=shader();normal.root.children.find(o=>o.geometry?.attributes.fanTile).material.onBeforeCompile(a);reduced.root.children.find(o=>o.geometry?.attributes.fanTile).material.onBeforeCompile(b);assert.ok(a.uniforms.fanExcitement.value>0);assert.equal(b.uniforms.fanTime.value,0);assert.equal(b.uniforms.fanExcitement.value,0);assert.equal(a.uniforms.fanFrames.value.length,8);normal.update(18,{x:45,y:6,z:0});assert.equal(a.uniforms.fanExcitement.value,0);
});
