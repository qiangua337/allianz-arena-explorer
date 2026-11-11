import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import test from 'node:test';

registerHooks({resolve(name,context,next){
 return name==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(name,context);
}});
const {THREE}=await import('../dist/kit.js');
const {playerLikeness,likenessParts}=await import('../dist/football-likeness.js');
const {atlasGeometry}=await import('../dist/football-appearance.js');
const {simplifySkinnedGeometry}=await import('../dist/player-lod.js');
const asset=name=>new URL(`../dist/assets/players/${name}`,import.meta.url);
const manifest=JSON.parse(readFileSync(asset('footballer-960.json')));
const binary=readFileSync(asset('footballer-960.bin'));
const raw=Object.fromEntries(manifest.parts.map(part=>{
 const geometry=new THREE.BufferGeometry();
 const rows=new Float32Array(binary.buffer,binary.byteOffset+part.offset,part.vertices*16);
 const indices=new Uint16Array(binary.buffer,binary.byteOffset+part.indexOffset,part.indexCount);
 const layout={position:[0,3],normal:[3,3],uv:[6,2],skinIndex:[8,4],skinWeight:[12,4]};
 for(const [name,[offset,size]] of Object.entries(layout)){
  const Attribute=name==='skinIndex'?THREE.Uint16BufferAttribute:THREE.Float32BufferAttribute;
  const data=Array.from({length:part.vertices*size},(_,i)=>rows[Math.floor(i/size)*16+offset+i%size]);
  geometry.setAttribute(name,new Attribute(data,size));
 }
 geometry.setIndex(new THREE.BufferAttribute(indices,1));
 return [part.name,geometry];
}));
const variants=Object.fromEntries(['kane','musiala'].map(id=>[id,likenessParts(raw,id)]));

test('face variants follow the Bayern squad identity through number changes',()=>{
 assert.equal(playerLikeness({team:'home',player:{number:9}}),'kane');
 assert.equal(playerLikeness({team:'home',player:{number:10}}),'musiala');
 for(const team of ['away','official'])for(const number of [9,10])assert.equal(playerLikeness({team,player:{number}}),null);
 assert.equal(playerLikeness({team:'home',player:{number:11}}),null);
});

test('face and skin rest seams stay welded while the nose, brows and eye shape change',()=>{
 const layout=part=>raw[part].attributes.position;
 const key=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)].join(',');
 const skinVertices=new Map(Array.from({length:layout('skin').count},(_,i)=>[key(layout('skin'),i),i]));
 const faceVertices=Array.from({length:layout('face').count},(_,i)=>i).filter(i=>skinVertices.has(key(layout('face'),i)));
 assert.ok(faceVertices.length>25,'the test covers the actual shared neck and face boundary');
 for(const variant of Object.values(variants)){
  assert.equal(variant.shirt,raw.shirt);assert.equal(variant.bootL,raw.bootL);
  for(const name of ['skin','face','eyes','eyebrows']){
   const geometry=variant[name];
   assert.deepEqual(geometry.attributes.uv.array,raw[name].attributes.uv.array);
   assert.deepEqual(geometry.attributes.skinWeight.array,raw[name].attributes.skinWeight.array);
   assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
   assert.notDeepEqual(geometry.attributes.position.array,raw[name].attributes.position.array);
  }
  for(const i of faceVertices){
   const j=skinVertices.get(key(layout('face'),i));
   assert.equal(key(variant.face.attributes.position,i),key(variant.skin.attributes.position,j));
  }
 }
 assert.ok(variants.kane.face.boundingSphere.radius>0);
});

test('sculpted profile landmarks change shape rather than relying on hair and paint',()=>{
 const base=raw.face.attributes.position;
 function displacement(at,axis,id){
  let closest=0,dist=Infinity;
  for(let i=0;i<base.count;i++){
   const distance=Math.hypot(base.getX(i)-at[0],base.getY(i)-at[1],base.getZ(i)-at[2]);
   if(distance<dist){dist=distance;closest=i;}
  }
  assert.ok(dist<.004,'the landmark sits on the production head topology');
  const component=['getX','getY','getZ'][axis];
  return variants[id].face.attributes.position[component](closest)-base[component](closest);
 }
 const bridge=[0,1.732,.167],tip=[0,1.704,.189],noseWing=[.015,1.698,.169],lowerLip=[0,1.666,.167],outerLid=[.053,1.744,.142];
 assert.ok(displacement(bridge,2,'kane')>.003&&displacement(tip,2,'kane')<-.002);
 assert.ok(displacement(noseWing,0,'musiala')>.001&&displacement(lowerLip,2,'musiala')>.003);
 assert.ok(displacement(outerLid,1,'musiala')<-.001);
});

test('two likenesses keep valid skinned hair UVs and use one 512-capable material within the phone geometry budget',t=>{
 for(const [id,parts] of Object.entries(variants)){
  const hair=parts.crop;
  assert.ok(hair.index.count/3<=1000,`${id} hair triangles ${hair.index.count/3}`);
  assert.ok(hair.attributes.uv.array.every(value=>value>=0&&value<=1));
  assert.ok(hair.attributes.normal.array.every(Number.isFinite));
  const weights=hair.attributes.skinWeight;
  for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)-1)<1e-6);
  const full=atlasGeometry(parts,'crop'),medium=simplifySkinnedGeometry(full,.035),low=simplifySkinnedGeometry(full,.085);
  assert.ok(full.index.count/3<=27092&&medium.index.count/3<=5800&&low.index.count/3<=1650);
  assert.ok([full,medium,low].every(g=>g.groups.length===0&&g.userData.parts.crop.count>0));
  const texture=readFileSync(asset(`face-${id}.webp`));
  assert.equal(texture.subarray(8,12).toString(),'WEBP');
  assert.ok(texture.length<=(id==='kane'?18728:9274),'a replacement portrait must fit the previous transfer budget');
  t.diagnostic(`${id}: ${hair.index.count/3} hair triangles, ${[full,medium,low].map(g=>g.index.count/3).join('/')} player triangles, ${texture.length} texture bytes`);
 }
});
