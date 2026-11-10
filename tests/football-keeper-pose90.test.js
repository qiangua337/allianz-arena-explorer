import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js'),{createFootballMotion}=await import('../dist/football-motion.js'),{applyFootballAction}=await import('../dist/football-action-pose.js');
const directory=new URL('../dist/assets/players/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('footballer-850.json',directory))),motion=JSON.parse(fs.readFileSync(new URL('walk-cycle.json',directory))),file=fs.readFileSync(new URL('footballer-850.bin',directory)),binary=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),parts=data.parts.map(p=>({...p,vertices:new Float32Array(binary,p.offset,p.vertices*16)})),boots=parts.filter(p=>p.name.startsWith('boot'));
function fixture(){
 const group=new THREE.Group(),bones=data.bones.map(()=>new THREE.Bone());data.bones.forEach((b,i)=>{(b.parent<0?group:bones[b.parent]).add(bones[i]);bones[i].position.fromArray(b.head);if(b.parent>=0)bones[i].position.sub(new THREE.Vector3().fromArray(data.bones[b.parent].head));});
 const animation=createFootballMotion(data,motion,bones,group,{height:1.86,phase:0,role:'player'}),point=new THREE.Vector3(),part=new THREE.Vector3(),matrices=bones.map(()=>new THREE.Matrix4()),inverse=data.bones.map(b=>new THREE.Matrix4().makeTranslation(...b.head.map(n=>-n)));
 return{group,bones,animation,clip(name,phase){const frame=motion.clips[name].frames[Math.round(phase*60)];bones[0].position.fromArray(data.bones[0].head).add(new THREE.Vector3(...frame.slice(0,3)));bones.forEach((bone,i)=>bone.quaternion.fromArray(frame,3+i*4));},lowest(all=false){group.updateMatrixWorld(true);bones.forEach((bone,i)=>matrices[i].copy(bone.matrixWorld).multiply(inverse[i]));let low=Infinity;for(const p of all?parts:boots)for(let i=0;i<p.vertices.length;i+=16){point.set(0,0,0);for(let j=0;j<4;j++){const w=p.vertices[i+12+j];if(w)point.addScaledVector(part.fromArray(p.vertices,i).applyMatrix4(matrices[p.vertices[i+8+j]]),w);}low=Math.min(low,point.y);}return low;}};
}
test('both gloves reach the same side at chest height with a bent following arm on the real rig',()=>{
 const f=fixture(),v=()=>new THREE.Vector3();
 for(const clip of['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop'])for(let phase=0;phase<8;phase++)for(const direction of[-1,1]){
  f.clip(clip,phase/8);applyFootballAction(f.bones,{type:'dive',elapsed:.46,duration:1,direction});f.group.updateMatrixWorld(true);
  const hands=[8,14].map(i=>f.bones[i].getWorldPosition(v()));assert.ok(hands.every(p=>p.x*direction>.40),'both hands extend into the dive, rather than forming a symmetric star');assert.ok(hands.every(p=>p.y>.40&&p.y<1.10),'the following glove stays near the chest rather than above the head');assert.ok(hands[0].distanceTo(hands[1])<.50,'hands share the same reachable ball path');
  for(const [shoulder,elbow,wrist]of[[6,7,8],[12,13,14]]){const e=f.bones[elbow].getWorldPosition(v()),a=f.bones[shoulder].getWorldPosition(v()).sub(e),b=f.bones[wrist].getWorldPosition(v()).sub(e),angle=a.angleTo(b);assert.ok(angle>1.9&&angle<2.8,'the elbow remains flexed, without hyperextension');}
 }
});

test('all real body surfaces remain grounded and continuous throughout the actual normal and penalty dive durations',()=>{
 const f=fixture(),mark=[0,5,7,8,13,14];let cases=0;
 for(const duration of[.9,1.04,1.105,1.16])for(const hz of[30,12])for(const clip of['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop'])for(const phase of[0,.25,.5,.75])for(const direction of[-1,1]){
  let previous=null;
  for(let i=0;i<=Math.ceil(duration*hz);i++){
   f.clip(clip,phase);const elapsed=Math.min(duration,i/hz);applyFootballAction(f.bones,{type:'dive',elapsed,duration,direction});assert.ok(f.lowest(true)>.007,JSON.stringify({duration,hz,clip,phase,direction,elapsed}));assert.deepEqual(f.group.position.toArray(),[0,0,0]);
   const current=mark.map(j=>f.bones[j].getWorldPosition(new THREE.Vector3()));if(previous)assert.ok(Math.max(...current.map((p,j)=>p.distanceTo(previous[j])))<(hz===12?.45:.19),JSON.stringify({duration,hz,clip,phase,direction,elapsed}));previous=current;cases++;
  }
 }assert.ok(cases>5500,'actual mesh was skinned at every sampled frame');
});
