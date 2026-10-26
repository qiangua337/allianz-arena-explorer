import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../dist/vendor/three.module.js';
const directory=process.argv[2];
if(!directory)throw Error('Pass the directory containing Quaternius-Standard.glb');
const file=fs.readFileSync(path.join(directory,'Quaternius-Standard.glb')),jsonLength=file.readUInt32LE(12),source=JSON.parse(file.subarray(20,20+jsonLength)),binary=file.subarray(28+jsonLength);
function accessor(id){const a=source.accessors[id],b=source.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type];return new Float32Array(binary.buffer,binary.byteOffset+(b.byteOffset||0)+(a.byteOffset||0),a.count*size);}
const root=new THREE.Group(),nodes=source.nodes.map(n=>{const o=new THREE.Object3D();o.name=n.name;if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
source.nodes.forEach((n,i)=>n.children?.forEach(j=>nodes[i].add(nodes[j])));source.scenes[0].nodes.forEach(i=>root.add(nodes[i]));
const clips={};let tracks=[],duration=0;
function select(name){const animation=source.animations.find(a=>a.name===name);tracks=animation.channels.map(c=>{const sampler=animation.samplers[c.sampler],times=accessor(sampler.input),values=accessor(sampler.output);return{node:nodes[c.target.node],property:c.target.path,times,values,size:values.length/times.length};});duration=Math.max(...tracks.map(t=>t.times.at(-1)));}
select('Walk_Loop');
const v=new THREE.Vector3(),a=new THREE.Quaternion(),b=new THREE.Quaternion();
function sample(time){for(const t of tracks){let k=0;while(k<t.times.length-2&&t.times[k+1]<time)k++;const f=THREE.MathUtils.clamp((time-t.times[k])/(t.times[k+1]-t.times[k]||1),0,1),offset=k*t.size;if(t.property==='rotation'){a.fromArray(t.values,offset);b.fromArray(t.values,offset+t.size);t.node.quaternion.slerpQuaternions(a,b,f);}else{const target=t.property==='translation'?t.node.position:t.node.scale;target.fromArray(t.values,offset);v.fromArray(t.values,offset+t.size);target.lerp(v,f);}}root.updateMatrixWorld(true);return nodes.map(n=>n.getWorldPosition(new THREE.Vector3()));}
if(process.argv.includes('--inspect')){console.log({duration});for(let t=0;t<=duration;t+=duration/4){const p=sample(t);console.log(t.toFixed(3),[51,46,45,44,43,50,49,48,47,19,18,17,38,37,36,40,1,0].map(i=>[source.nodes[i].name,...p[i].toArray().map(x=>+x.toFixed(3))]));}process.exit();}
// Sample world transforms, then adapt the source bind axes to the target rig.
const used=[51,42,41,40,1,0,19,18,17,46,45,44,38,37,36,50,49,48,43,47,2,21];
const rest=used.map(i=>({name:nodes[i].name,position:nodes[i].getWorldPosition(new THREE.Vector3()).toArray(),quaternion:nodes[i].getWorldQuaternion(new THREE.Quaternion()).toArray()}));
for(const name of ['Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Idle_Loop','Sitting_Idle_Loop','Idle_Talking_Loop']){select(name);const frames=Array.from({length:61},(_,i)=>{sample(i/60*duration);return used.map(j=>[...nodes[j].getWorldPosition(new THREE.Vector3()).toArray(),...nodes[j].getWorldQuaternion(new THREE.Quaternion()).toArray()].map(x=>+x.toFixed(6)));});clips[name]={duration,frames};}
const output={version:1,source:'Quaternius / Universal Animation Library Standard / CC0',rest,clips};
const manifest=JSON.parse(fs.readFileSync(new URL('../dist/assets/players/footballer.json',import.meta.url))),meshData=fs.readFileSync(new URL('../dist/assets/players/footballer.bin',import.meta.url));
const target=manifest.bones.map(b=>{const o=new THREE.Object3D();o.position.fromArray(b.head);if(b.parent>=0)o.position.sub(new THREE.Vector3().fromArray(manifest.bones[b.parent].head));return o;});
manifest.bones.forEach((b,i)=>{if(b.parent>=0)target[b.parent].add(target[i]);});
const sourceAt=Object.fromEntries(rest.map((b,i)=>[b.name,i]));
const names=['DEF-hips','DEF-spine.001','DEF-spine.002','DEF-spine.003','DEF-neck','DEF-head','DEF-upper_arm.L','DEF-forearm.L','DEF-hand.L','DEF-thigh.L','DEF-shin.L','DEF-foot.L','DEF-upper_arm.R','DEF-forearm.R','DEF-hand.R','DEF-thigh.R','DEF-shin.R','DEF-foot.R'];
const ends=['DEF-spine.001','DEF-spine.002','DEF-spine.003','DEF-neck','DEF-head',null,'DEF-forearm.L','DEF-hand.L','DEF-f_index.03.L','DEF-shin.L','DEF-foot.L','DEF-toe.L','DEF-forearm.R','DEF-hand.R','DEF-f_index.03.R','DEF-shin.R','DEF-foot.R','DEF-toe.R'];
const corrections=names.map((name,i)=>{if(i===0)return new THREE.Quaternion();const start=rest[sourceAt[name]].position,end=ends[i]?rest[sourceAt[ends[i]]].position:null,child=manifest.bones.find(b=>b.parent===i),targetEnd=child?.head||manifest.bones[i].tail;if(!end)return new THREE.Quaternion();return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3().fromArray(targetEnd).sub(new THREE.Vector3().fromArray(manifest.bones[i].head)).normalize(),new THREE.Vector3().fromArray(end).sub(new THREE.Vector3().fromArray(start)).normalize());});
const sourceInverse=names.map(name=>new THREE.Quaternion().fromArray(rest[sourceAt[name]].quaternion).invert());
const boots=manifest.parts.filter(p=>p.name.startsWith('boot')).map(p=>({part:p,vertices:new Float32Array(meshData.buffer,meshData.byteOffset+p.offset,p.vertices*16),bone:p.name==='bootL'?11:17}));
const result={version:1,source:output.source,bones:manifest.bones.map(b=>b.name),stride:1.55,clips:{}};
for(const[name,clip]of Object.entries(clips)){
 const frames=[];
 for(const sourceFrame of clip.frames){
  const world=names.map((bone,i)=>new THREE.Quaternion().fromArray(sourceFrame[sourceAt[bone]],3).multiply(sourceInverse[i]).multiply(corrections[i]));
  for(let i=0;i<target.length;i++){target[i].quaternion.copy(world[i]);if(manifest.bones[i].parent>=0)target[i].quaternion.premultiply(world[manifest.bones[i].parent].clone().invert());}
  target[0].position.fromArray(manifest.bones[0].head);target[0].position.x+=(sourceFrame[0][0]-rest[0].position[0])*1.1;target[0].updateMatrixWorld(true);
  let minimum=Infinity;
  for(const boot of boots){const matrix=target[boot.bone].matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(...manifest.bones[boot.bone].head.map(x=>-x)));for(let j=0;j<boot.part.vertices;j++){v.fromArray(boot.vertices,j*16).applyMatrix4(matrix);minimum=Math.min(minimum,v.y);}}
  const root=[target[0].position.x-manifest.bones[0].head[0],.022-minimum,0];
  if(name.startsWith('Sitting'))root[1]=-.39;
  frames.push([...root,...target.flatMap(n=>n.quaternion.toArray())].map(x=>+x.toFixed(6)));
 }
 result.clips[name]={duration:clip.duration,stride:name==='Sprint_Loop'?3.1:name==='Jog_Fwd_Loop'?2.25:1.55,frames};
}
fs.writeFileSync(new URL('../dist/assets/players/walk-cycle.json',import.meta.url),JSON.stringify(result));
console.log('Exported retargeted walk, jog, sprint, idle, seated and talking clips.');
