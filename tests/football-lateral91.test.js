import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js'),{createFootballMotion}=await import('../dist/football-motion.js'),{applyFootballAction}=await import('../dist/football-action-pose.js');
const directory=new URL('../dist/assets/players/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('footballer-910.json',directory))),motion=JSON.parse(fs.readFileSync(new URL('walk-cycle.json',directory))),file=fs.readFileSync(new URL('footballer-910.bin',directory)),binary=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),boots=data.parts.filter(p=>p.name.startsWith('boot')).map(p=>({vertices:new Float32Array(binary,p.offset,p.vertices*16)}));
function fixture(definition={}){
 const group=new THREE.Group(),bones=data.bones.map(b=>{const bone=new THREE.Bone();bone.name=b.name;return bone;});
 data.bones.forEach((b,i)=>{(b.parent<0?group:bones[b.parent]).add(bones[i]);bones[i].position.fromArray(b.head);if(b.parent>=0)bones[i].position.sub(new THREE.Vector3().fromArray(data.bones[b.parent].head));});
 const animation=createFootballMotion(data,motion,bones,group,{height:1.86,phase:0,role:'player',...definition}),point=new THREE.Vector3(),part=new THREE.Vector3(),matrices=data.bones.map(()=>new THREE.Matrix4()),inverse=data.bones.map(b=>new THREE.Matrix4().makeTranslation(...b.head.map(n=>-n)));
 return{group,bones,animation,feet:()=>[11,17].map(i=>bones[i].getWorldPosition(new THREE.Vector3())),clip(name,phase){const frame=motion.clips[name].frames[Math.round(phase*60)];bones[0].position.fromArray(data.bones[0].head).add(new THREE.Vector3(...frame.slice(0,3)));bones.forEach((bone,i)=>bone.quaternion.fromArray(frame,3+i*4));},bootStats(ball=null){group.updateMatrixWorld(true);bones.forEach((bone,i)=>matrices[i].copy(bone.matrixWorld).multiply(inverse[i]));return boots.map(({vertices})=>{let lowest=Infinity,contact=Infinity;for(let i=0;i<vertices.length;i+=16){point.set(0,0,0);for(let j=0;j<4;j++){const weight=vertices[i+12+j];if(weight)point.addScaledVector(part.fromArray(vertices,i).applyMatrix4(matrices[vertices[i+8+j]]),weight);}lowest=Math.min(lowest,point.y);if(ball)contact=Math.min(contact,point.distanceTo(ball));}return{lowest,contact};});}};
}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];

test('actual slow side-step and diagonal soles retain support at phone pose rates and anatomical phase offsets',()=>{
 for(const hz of[60,30,12])for(const phase of[0,.7,1.9])for(const angle of[-Math.PI/2,Math.PI/2,-Math.PI/4,Math.PI/4,-3*Math.PI/4,3*Math.PI/4]){
  const f=fixture({phase}),rows=[];for(let i=0;i<hz*6;i++){const t=i/hz,x=10+Math.sin(angle)*t*2,z=Math.cos(angle)*t*2;f.animation.pose(x,z,0,t,true);const stats=f.bootStats();assert.deepEqual(f.group.position.toArray(),[x,0,z],'authoritative travel is unchanged');assert.ok(stats.every(s=>s.lowest>-.001));rows.push({feet:f.feet(),soles:stats.map(s=>s.lowest)});}
  const slip=[];for(let i=hz*2+1;i<rows.length;i++)for(let side=0;side<2;side++)if(rows[i].soles[side]<.045&&rows[i-1].soles[side]<.045)slip.push(Math.hypot(rows[i].feet[side].x-rows[i-1].feet[side].x,rows[i].feet[side].z-rows[i-1].feet[side].z)*hz);
  assert.ok(slip.length>hz/2);assert.ok(median(slip)<.02,JSON.stringify({hz,phase,angle,median:median(slip)}));assert.ok(Math.max(...slip)<(hz===12?5:10),'retains the existing landing/takeoff edge budget');
 }
});

test('side-step hips chest and head counter-turn smoothly through stops reversals and return to forward travel',()=>{
 for(const hz of[60,30,12])for(const phase of[0,.7,1.9]){
  const f=fixture({phase}),reference=fixture({phase,keeper:true});let x=10,z=0,previous=null;
  for(let i=0;i<hz*10;i++){const t=i/hz,side=t<1?0:t<3?1:t<4?-1:t<5?0:t<6?0:t<8?-1:0,forward=t<1||t>=5&&t<6||t>=8?1:0,moving=!!(side||forward);x+=side*2/hz;z+=forward*2/hz;f.animation.pose(x,z,0,t,moving);reference.animation.pose(x,z,0,t,moving);assert.ok(f.bootStats().every(s=>s.lowest>-.001));
   const current=[0,5,7,8,11,13,14,17].map(j=>f.bones[j].getWorldPosition(new THREE.Vector3()));if(previous)assert.ok(Math.max(...current.map((p,j)=>p.distanceTo(previous[j])))<(hz===12?.95:hz===30?.40:.22),'continuous actual body positions at '+JSON.stringify({hz,phase,t,moves:current.map((p,j)=>({bone:[0,5,7,8,11,13,14,17][j],d:p.distanceTo(previous[j])}))}));previous=current;
   const delta=index=>f.bones[index].getWorldQuaternion(new THREE.Quaternion()).angleTo(reference.bones[index].getWorldQuaternion(new THREE.Quaternion()));assert.ok(delta(0)<1.051,'bounded 60 degree pelvis steering');assert.ok(delta(3)<.50,'counter-turn is shared across the torso');assert.ok(delta(5)<.25,'head continues reading the ball');for(const b of f.bones){assert.ok(b.quaternion.toArray().every(Number.isFinite));assert.ok(Math.abs(b.quaternion.length()-1)<1e-5);}
  }
  f.animation.reset();f.animation.pose(0,0,0,0,false);const fresh=fixture({phase});fresh.animation.pose(0,0,0,0,false);f.bones.forEach((b,i)=>assert.deepEqual(b.quaternion.toArray(),fresh.bones[i].quaternion.toArray(),'reset clears side-step state'));
 }
});

test('physical pass and shot contact still reaches the actual released ball while side-stepping or travelling diagonally',()=>{
 for(const hz of[60,30,12])for(const heading of[0,Math.PI/2])for(const angle of[-Math.PI/2,Math.PI/2,-Math.PI/4,Math.PI/4])for(const type of['pass','shoot']){
  const f=fixture();for(let i=0;i<=hz*2;i++){const t=i/hz,travel=heading+angle;f.animation.pose(10+Math.sin(travel)*t*2,Math.cos(travel)*t*2,heading,t,true);}const p=f.group.position,ball=new THREE.Vector3(p.x+Math.sin(heading)*.65,.11,p.z+Math.cos(heading)*.65);applyFootballAction(f.bones,{type,elapsed:0,duration:.4});const stats=f.bootStats(ball);assert.ok(stats[1].contact<.24,JSON.stringify({hz,heading,angle,type,contact:stats[1].contact}));assert.ok(stats.every(s=>s.lowest>-.001));
 }
});

test('keepers preserve their ball-facing body axis and full-speed running fades back to the existing locomotion pose',()=>{
 for(const hz of[60,30,12])for(const speed of[4.5,7])for(const direction of[-1,1]){
  const f=fixture(),reference=fixture({keeper:true});for(let i=0;i<hz*4;i++){const t=i/hz,x=10+direction*t*speed;f.animation.pose(x,0,0,t,true);reference.animation.pose(x,0,0,t,true);if(t>2){for(const j of[0,1,2,3,4,5,6,7,8,12,13,14])assert.ok(Math.hypot(...f.bones[j].quaternion.toArray().map((n,k)=>n-reference.bones[j].quaternion.toArray()[k]))<1e-6,'fast locomotion body is unchanged '+JSON.stringify({hz,speed,direction,t,bone:j,angle:f.bones[j].quaternion.angleTo(reference.bones[j].quaternion)}));}}
 }
 const a=fixture({keeper:true}),b=fixture({role:'assistant'});for(let i=0;i<120;i++){const t=i/30;a.animation.pose(t*2,0,0,t,true);b.animation.pose(t*2,0,0,t,true);assert.deepEqual(a.bones[0].quaternion.toArray(),b.bones[0].quaternion.toArray(),'keeper keeps the original facing axis for a dive');}
});