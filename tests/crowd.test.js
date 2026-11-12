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

test('lightweight quality does not scan or sort nearby seat records when its detail budget is zero',()=>{
 let reads=0;const source=Array.from({length:20},()=>({get x(){reads++;return 42;},get y(){reads++;return 1;},get z(){reads++;return 0;},yaw:0,sector:0})),layout=createCrowdLayout(source);assert.ok(layout.count>0);reads=0;
 for(const budget of[0,-1])assert.deepEqual(layout.nearby({x:42,y:1,z:0},{budget}),[]);assert.equal(reads,0,'disabled detail performs no seat-coordinate work');assert.equal(layout.nearby({x:42,y:1,z:0},{budget:1}).length,1);assert.ok(reads>0,'the same nearby fixture is actually queried when detail is enabled');
});
test('actual near spectators replace their far counterpart and remain within the mobile draw and instance budget',()=>{
 const audience=buildMatchdayCrowd(new THREE.Group(),seats,{mobile:true});assert.equal(audience.root.visible,false);audience.setEnabled(true);audience.update(1,{x:45,y:6,z:0});const near=audience.root.getObjectByName('Seated 3D spectators · bounded near detail'),far=audience.root.children.filter(o=>o.isInstancedMesh&&o.geometry.attributes.fanDetail);
 assert.equal(near.count,128);assert.equal(audience.nearCount,128);assert.ok(!near.isSkinnedMesh);assert.ok(near.geometry.index===null);assert.ok(near.geometry.attributes.position.count/3<700);assert.equal(far.reduce((sum,o)=>sum+o.geometry.attributes.fanDetail.array.reduce((a,b)=>a+b,0),0),near.count);
 const matrix=new THREE.Matrix4();near.getMatrixAt(0,matrix);assert.ok(matrix.elements.every(Number.isFinite));const version=near.instanceMatrix.version;for(let i=0;i<200;i++)audience.update(1+i/60,{x:45,y:6,z:0});assert.equal(near.instanceMatrix.version,version,'stationary viewers do not rebuild all audience matrices');
 const flagAttributes=far.map(mesh=>mesh.geometry.attributes.fanDetail);
 const flagVersions=flagAttributes.map(attribute=>attribute.version),camera=new THREE.PerspectiveCamera(50,390/844,.1,240);
 camera.position.set(45,6,0);camera.lookAt(-30,6,0);audience.cull(camera);
 assert.equal(audience.nearCount,128);
 assert.equal(near.instanceMatrix.version,version);
 assert.deepEqual(flagAttributes.map(attribute=>attribute.version),flagVersions,'frustum changes do not upload near detail flags');
 for(const attribute of flagAttributes)attribute.clearUpdateRanges();
 audience.update(4.5,{x:45,y:6,z:1.5});
 assert.ok(near.instanceMatrix.version>version,'a different group of seats does update the near instances');
 const changed=flagAttributes.filter(attribute=>attribute.updateRanges.length);
 assert.ok(changed.length);
 assert.ok(changed.every(attribute=>attribute.updateRanges.length===1&&attribute.updateRanges[0].count<attribute.count),'a move uploads only the affected part of each sector');
 audience.update(5,{x:999,y:6,z:999});assert.equal(near.count,0);assert.equal(far.reduce((sum,o)=>sum+o.geometry.attributes.fanDetail.array.reduce((a,b)=>a+b,0),0),0);audience.setEnabled(false);assert.equal(audience.root.visible,false);
});
test('sprite batches keep all occupied seats and follow a turned camera without losing padded wave edges',()=>{
 const tiers=[1,15,30];
 const ring=Array.from({length:24*tiers.length*12},(_,i)=>{
  const sector=Math.floor(i/(12*tiers.length)),tier=Math.floor(i/12)%tiers.length,angle=(sector+(i%12)/12)*Math.PI/12,radius=45+tier*16;
  return {x:Math.cos(angle)*radius,y:tiers[tier],z:Math.sin(angle)*radius,yaw:-angle,sector,color:0xc91c36};
 });
 const scene=new THREE.Group(),parent=new THREE.Group();
 parent.position.set(19,2,27);parent.rotation.y=.38;parent.scale.set(1.1,1,.85);scene.add(parent);
 const audience=buildMatchdayCrowd(parent,ring,{mobile:true}),far=audience.root.children.filter(o=>o.geometry?.attributes.fanTile);
 const camera=new THREE.PerspectiveCamera(56,390/844,.1,240);
 camera.position.copy(parent.position).add(new THREE.Vector3(0,4,0));
 audience.setEnabled(true);
 assert.equal(far.length,72);
 assert.equal(far.reduce((n,batch)=>n+batch.count,0),audience.count);
 const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
 function look(x,z){
  camera.lookAt(parent.position.x+x,9,parent.position.z+z);
  audience.cull(camera);
  const visible=far.filter(batch=>batch.visible);
  assert.equal(audience.submittedBatches,visible.length);
  assert.equal(audience.submittedCount,visible.reduce((n,batch)=>n+batch.count,0));
  assert.ok(audience.submittedCount>0&&audience.submittedCount<audience.count/2);
  for(const batch of far){
   for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);
    for(const side of [-1,1]){
     point.set(side*.508,1.0108,0).applyMatrix4(matrix);
     assert.ok(batch.boundingBox.containsPoint(point),'bounds include the maximum sway and cheer');
     point.applyMatrix4(audience.root.matrixWorld).project(camera);
     if(Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<=1)assert.ok(batch.visible,'a visible animated corner is never rejected');
    }
   }
  }
  return visible;
 }
 const north=look(0,-60);
 const south=look(0,60);
 assert.ok(north.every(batch=>!south.includes(batch)),'a stationary camera turn refreshes the visible sectors');
 parent.visible=false;audience.cull(camera);
 assert.equal(audience.submittedCount,0);
 parent.visible=true;audience.setEnabled(false);audience.cull(camera);
 assert.equal(audience.submittedBatches,0);
 audience.setEnabled(true);
 assert.ok(far.every(batch=>batch.visible),'re-enabling clears the old view flags');
 assert.deepEqual(look(0,-60),north);
});
test('a moving camera does not re-upload detail when the same seats stay selected',()=>{
 const audience=buildMatchdayCrowd(new THREE.Group(),seats.slice(0,100),{mobile:true});
 audience.setEnabled(true);
 audience.update(1,{x:52,y:6,z:-39});
 const near=audience.root.getObjectByName('Seated 3D spectators · bounded near detail');
 assert.equal(near.count,audience.count);
 const version=near.instanceMatrix.version;
 audience.update(2,{x:54,y:6,z:-39});
 assert.equal(near.instanceMatrix.version,version);
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
 const shader=()=>({uniforms:{},vertexShader:'#include <uv_vertex>\n#include <begin_vertex>',fragmentShader:'#include <map_fragment>'});
 const a=shader(),b=shader(),sprites=normal.root.children.find(o=>o.geometry?.attributes.fanTile);
 sprites.material.onBeforeCompile(a);reduced.root.children.find(o=>o.geometry?.attributes.fanTile).material.onBeforeCompile(b);
 assert.doesNotMatch(a.vertexShader,/\bsin\s*\(/,'sprite vertices use the shared wave instead of calculating their own trig');
 assert.deepEqual(b.uniforms.fanWave.value.toArray(),[.010,0,0,0]);
 assert.equal(a.uniforms.fanFrames.value.length,8);
 const records=createCrowdLayout(seats.slice(0,100)).records,phaseTrig=sprites.geometry.attributes.fanPhaseTrig;
 for(const seconds of [11,12.3,18]){
  normal.update(seconds,{x:45,y:6,z:0});
  const {x,y,z,w}=a.uniforms.fanWave.value,height=.018*Math.max(0,1-(seconds-10)/6);
  for(let i=0;i<phaseTrig.count;i++){
   const sin=phaseTrig.getX(i),cos=phaseTrig.getY(i),phase=records[i].phase;
   assert.ok(Math.abs(sin*x+cos*y-.010*Math.sin(seconds*1.7+phase))<1e-9);
   assert.ok(Math.abs(sin*z+cos*w-height*Math.sin(seconds*2.5+phase))<1e-9);
  }
 }
});
