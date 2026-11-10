import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js'),{createFootballMotion}=await import('../dist/football-motion.js'),{applyFootballAction}=await import('../dist/football-action-pose.js');
const directory=new URL('../dist/assets/players/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('footballer-850.json',directory))),motion=JSON.parse(fs.readFileSync(new URL('walk-cycle.json',directory))),file=fs.readFileSync(new URL('footballer-850.bin',directory)),binary=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),boots=data.parts.filter(p=>p.name.startsWith('boot')).map(p=>({vertices:new Float32Array(binary,p.offset,p.vertices*16)}));
function fixture(definition={}){
 const group=new THREE.Group(),bones=data.bones.map(b=>{const bone=new THREE.Bone();bone.name=b.name;return bone;});
 data.bones.forEach((b,i)=>{(b.parent<0?group:bones[b.parent]).add(bones[i]);bones[i].position.fromArray(b.head);if(b.parent>=0)bones[i].position.sub(new THREE.Vector3().fromArray(data.bones[b.parent].head));});
 const animation=createFootballMotion(data,motion,bones,group,{height:1.86,phase:0,role:'player',...definition}),point=new THREE.Vector3(),part=new THREE.Vector3(),matrices=data.bones.map(()=>new THREE.Matrix4()),inverse=data.bones.map(b=>new THREE.Matrix4().makeTranslation(...b.head.map(n=>-n)));
 return{group,bones,animation,feet:()=>[11,17].map(i=>bones[i].getWorldPosition(new THREE.Vector3())),clip(name,phase){const frame=motion.clips[name].frames[Math.round(phase*60)];bones[0].position.fromArray(data.bones[0].head).add(new THREE.Vector3(...frame.slice(0,3)));bones.forEach((bone,i)=>bone.quaternion.fromArray(frame,3+i*4));},bootStats(ball=null){group.updateMatrixWorld(true);bones.forEach((bone,i)=>matrices[i].copy(bone.matrixWorld).multiply(inverse[i]));return boots.map(({vertices})=>{let lowest=Infinity,contact=Infinity;for(let i=0;i<vertices.length;i+=16){point.set(0,0,0);for(let j=0;j<4;j++){const weight=vertices[i+12+j];if(weight)point.addScaledVector(part.fromArray(vertices,i).applyMatrix4(matrices[vertices[i+8+j]]),weight);}lowest=Math.min(lowest,point.y);if(ball)contact=Math.min(contact,point.distanceTo(ball));}return{lowest,contact};});}};
}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
function limbStats(f){const heading=f.group.rotation.y,forward=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));return[[9,10,11],[15,16,17]].map(([a,b,c])=>{const hip=f.bones[a].getWorldPosition(new THREE.Vector3()),knee=f.bones[b].getWorldPosition(new THREE.Vector3()),ankle=f.bones[c].getWorldPosition(new THREE.Vector3()),axis=ankle.clone().sub(hip).normalize(),bend=knee.clone().sub(hip);bend.addScaledVector(axis,-bend.dot(axis));return{flex:Math.PI-Math.acos(Math.max(-1,Math.min(1,hip.sub(knee).normalize().dot(ankle.sub(knee).normalize())))),forward:bend.dot(forward)};});}

test('real retargeted walking soles stop moonwalking when defending backwards at 60, 30 and distant 12Hz poses',()=>{
 for(const hz of[60,30,12])for(const backward of[false,true]){
  const f=fixture(),rows=[];for(let frame=0;frame<hz*6;frame++){const t=frame/hz;f.animation.pose(0,(backward?-1:1)*t*2,0,t,true);rows.push(f.feet());}
  const slip=[];for(let i=hz*2+1;i<rows.length-1;i++)for(let side=0;side<2;side++)if(rows[i][side].y<.15&&Math.abs(rows[i+1][side].y-rows[i-1][side].y)*hz/60<.025)slip.push(Math.abs(rows[i+1][side].z-rows[i-1][side].z)*hz/2);
  assert.ok(slip.length>hz/2);assert.ok(median(slip)<.4,JSON.stringify({hz,backward,medianSlip:median(slip)}));
 }
});

test('actual grounded running feet retain their support across phone pose rates and phase offsets without locking the world root',()=>{
 for(const hz of[60,30,12])for(const speed of[4.5,7])for(const backward of[false,true])for(const phase of[0,.7,1.9,3.7,5.1]){
  const f=fixture({phase}),rows=[];for(let i=0;i<hz*6;i++){const t=i/hz,z=(backward?-1:1)*speed*t;f.animation.pose(0,z,0,t,true);const stats=f.bootStats();assert.deepEqual(f.group.position.toArray(),[0,0,z]);rows.push({feet:f.feet(),soles:stats.map(s=>s.lowest)});}
  // Both ends must be grounded; counting an airborne pre-landing sample as
  // planted exaggerates the remaining slip at 12Hz.
  const slip=[];for(let i=hz*2+1;i<rows.length;i++)for(let side=0;side<2;side++)if(rows[i].soles[side]<.045&&rows[i-1].soles[side]<.045)slip.push(Math.abs(rows[i].feet[side].z-rows[i-1].feet[side].z)*hz);
  assert.ok(slip.length>hz/2);assert.ok(median(slip)<(hz===12?3.5:.01),JSON.stringify({hz,speed,backward,phase,median:median(slip)}));assert.ok(Math.max(...slip)<(hz===12?5:10),'bounded landing and take-off edges');
 }
});

test('short passes and shots begin at physical contact across actual walk, jog and sprint phases and recover without boot penetration',()=>{
 const f=fixture(),ball=new THREE.Vector3(0,.11,.65);let cases=0,lowest=Infinity,worstContact=0;
 for(const name of['Walk_Loop','Jog_Fwd_Loop','Sprint_Loop'])for(let phase=0;phase<12;phase++)for(const kind of['pass','shoot'])for(let frame=0;frame<=20;frame++){
  f.clip(name,phase/12);const base=f.bones.map(b=>b.quaternion.clone()),progress=frame/20;applyFootballAction(f.bones,{type:kind,elapsed:progress*.4,duration:.4});
  const stats=f.bootStats(ball);lowest=Math.min(lowest,...stats.map(s=>s.lowest));if(frame===0)worstContact=Math.max(worstContact,stats[1].contact);
  assert.ok(stats.every(s=>s.lowest>-.001),JSON.stringify({name,phase,kind,progress,stats}));for(const bone of f.bones){assert.ok(bone.quaternion.toArray().every(Number.isFinite));assert.ok(Math.abs(bone.quaternion.length()-1)<.00001);}for(const knee of limbStats(f))assert.ok(knee.flex<2.9&&knee.forward>-.07,JSON.stringify({name,phase,kind,progress,knee}));
  if(frame===20)for(let i=0;i<f.bones.length;i++)assert.deepEqual(f.bones[i].quaternion.toArray(),base[i].toArray(),'complete recovery returns to the real locomotion pose');cases++;
 }
 assert.equal(cases,1512);assert.ok(worstContact<.24,'actual right shoe reaches the released ball: '+worstContact);assert.ok(lowest<.05,'support boots remain grounded');
});

test('charging preloads the grounded support before an immediate physical shot instead of dropping the hips on release',()=>{
 const f=fixture();for(const name of['Walk_Loop','Jog_Fwd_Loop','Sprint_Loop'])for(let phase=0;phase<12;phase++)for(const seconds of[0,.04,.12,.15,.4,.85]){
  f.clip(name,phase/12);applyFootballAction(f.bones,{type:'prepareShot',elapsed:.25+Math.min(1,seconds/.85)*.75,duration:1});const prepared=f.bones[0].position.y,stats=f.bootStats();assert.ok(stats.every(s=>s.lowest>-.001),JSON.stringify({name,phase,seconds,stats}));
  f.clip(name,phase/12);applyFootballAction(f.bones,{type:'shoot',elapsed:0,duration:.4});if(seconds>=.12)assert.ok(Math.abs(f.bones[0].position.y-prepared)<.015,'held shots preserve the prepared hip height');
 }
});

test('running turns, teleports and replay seeks release old plants while keeping boots and knee bends finite',()=>{
 for(const hz of[60,30,12])for(const initial of[0,Math.PI/2,Math.PI]){
  const f=fixture();let x=0,z=0,previous=null;for(let i=0;i<hz*5;i++){const time=i/hz,heading=initial+Math.min(Math.PI,Math.max(0,time-1)*Math.PI/2);x+=Math.sin(heading)*6.5/hz;z+=Math.cos(heading)*6.5/hz;f.animation.pose(x,z,heading,time,true);const boots=f.bootStats(),feet=f.feet();assert.ok(boots.every(b=>b.lowest>-.001),JSON.stringify({hz,time,initial,boots}));for(const knee of limbStats(f))assert.ok(knee.flex<2.95&&knee.forward>-.09,JSON.stringify({hz,time,knee}));if(previous)assert.ok(Math.max(...feet.map((p,j)=>p.distanceTo(previous[j])))<(hz===12?1.8:hz===30?.9:.55));previous=feet;}
  for(const [x,z,time]of[[15,20,6],[-12,-15,2],[4,8,2.1]]){f.animation.pose(x,z,Math.PI,time,true);for(const foot of f.feet())assert.ok(Math.hypot(foot.x-x,foot.z-z)<1.3,'no anchor survives a teleport or seek');}
 }
});

test('direction changes remain continuous and reset leaves no reverse gait in the entrance or seated staff',()=>{
 for(const hz of[60,30,12]){
  const f=fixture();let x=0,z=0,previous=null;for(let i=0;i<hz*5;i++){const time=i/hz,heading=Math.min(Math.PI,Math.max(0,time-1)*Math.PI/2),travel=time<2?0:Math.PI;x+=Math.sin(travel)*2/hz;z+=Math.cos(travel)*2/hz;f.animation.pose(x,z,heading,time,true);const feet=f.feet();if(previous)assert.ok(Math.max(...feet.map((p,j)=>p.distanceTo(previous[j])))<.95,'no phase discontinuity across 90 and 180 degree turns');previous=feet;}
  f.animation.reset();f.animation.pose(0,0,0,0,true);const fresh=fixture();fresh.animation.pose(0,0,0,0,true);f.bones.forEach((bone,i)=>assert.deepEqual(bone.quaternion.toArray(),fresh.bones[i].quaternion.toArray()));
 }
 const a=fixture({seated:true,role:'assistant'}),b=fixture({seated:true,role:'assistant'});for(let i=0;i<120;i++){const t=i/30;a.animation.pose(0,t,0,t,true,.45);b.animation.pose(0,-t,0,t,true,.45);a.bones.forEach((bone,j)=>assert.deepEqual(bone.quaternion.toArray(),b.bones[j].quaternion.toArray()));}
});
