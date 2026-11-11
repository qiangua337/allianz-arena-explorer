import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';

registerHooks({resolve(name,context,next){
 return name==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(name,context);
}});
const {THREE}=await import('../dist/kit.js');
const {atlasGeometry}=await import('../dist/football-appearance.js');
const {simplifySkinnedGeometry}=await import('../dist/player-lod.js');

function load(version){
 const asset=extension=>new URL(`../dist/assets/players/footballer-${version}.${extension}`,import.meta.url);
 const manifest=JSON.parse(readFileSync(asset('json')));
 const binary=readFileSync(asset('bin'));
 const parts=Object.fromEntries(manifest.parts.map(part=>[part.name,{
  rows:new Float32Array(binary.buffer,binary.byteOffset+part.offset,part.vertices*16),
  indices:new Uint16Array(binary.buffer,binary.byteOffset+part.indexOffset,part.indexCount)
 }]));
 return {manifest,binary,parts};
}
const previous=load(910),current=load(960);
const vertices=part=>Array.from({length:part.rows.length/16},(_,index)=>part.rows.subarray(index*16,index*16+16));

test('the new left and right uppers retain the exact outsole, studs, rig and equipment budget',()=>{
 assert.equal(current.binary.length,previous.binary.length);
 assert.deepEqual(current.manifest,previous.manifest);
 for(const [name,part] of Object.entries(current.parts)){
  const original=previous.parts[name];
  assert.deepEqual(part.indices,original.indices);
  if(!name.startsWith('boot')){assert.deepEqual(part.rows,original.rows);continue;}
  const verticesBefore=vertices(original),verticesAfter=vertices(part);
  assert.equal(part.indices.length/3,584);
  for(let index=0;index<verticesAfter.length;index++){
   const before=verticesBefore[index],after=verticesAfter[index];
   assert.deepEqual(after.subarray(8),before.subarray(8));
   if(before[6]>.78)assert.deepEqual(after,before,'contact geometry and all its attributes are identical');
   if(before[1]<=.027001)assert.deepEqual(after.subarray(0,3),before.subarray(0,3));
  }
 }
});

test('each forefoot tapers toward the inside and every UV wrap edge lies below the outsole top',()=>{
 for(const side of ['L','R']){
  const foot=current.manifest.bones.find(bone=>bone.name===`foot.${side}`);
  const inward=-Math.sign(foot.head[0]);
  const part=current.parts[`boot${side}`],all=vertices(part);
  const section=all.filter(row=>Math.abs(row[2]-foot.head[2]-.18)<.000001&&row[6]<.78);
  const instep=section.find(row=>Math.abs(row[6]-.39)<.000001);
  assert.ok((instep[0]-foot.head[0])*inward>.0119);
  const quarters=section.filter(row=>Math.abs(row[1]-.06)<.013);
  const inner=Math.max(...quarters.filter(row=>(row[0]-foot.head[0])*inward>.018).map(row=>row[1]));
  const outer=Math.max(...quarters.filter(row=>(row[0]-foot.head[0])*inward<-.018).map(row=>row[1]));
  assert.ok(inner>outer+.004);
  let seams=0;
  for(let index=0;index<part.indices.length;index+=3){
   for(let edge=0;edge<3;edge++){
    const a=all[part.indices[index+edge]],b=all[part.indices[index+(edge+1)%3]];
    if(Math.abs(a[6]-b[6])<=.5)continue;
    assert.ok(a[1]<.026&&b[1]<.026,'the wrap must sit under the shoe');seams++;
   }
  }
  assert.ok(seams>0);
 }
});

function assemble(parts,hair,keeper){
 const raw=Object.fromEntries(Object.entries(parts).map(([name,part])=>{
  const geometry=new THREE.BufferGeometry(),all=vertices(part);
  const layout={position:[0,3],normal:[3,3],uv:[6,2],skinIndex:[8,4],skinWeight:[12,4]};
  for(const [attribute,[offset,size]] of Object.entries(layout)){
   const values=all.flatMap(row=>Array.from(row.subarray(offset,offset+size)));
   const buffer=attribute==='skinIndex'?new Uint16Array(values):new Float32Array(values);
   geometry.setAttribute(attribute,new THREE.BufferAttribute(buffer,size));
  }
  geometry.setIndex(new THREE.BufferAttribute(part.indices,1));
  return [name,geometry];
 }));
 return atlasGeometry(raw,hair,{keeper});
}

test('the active 960 model keeps the single material and the phone LOD triangle budget',t=>{
 for(const hair of ['short02','crop'])for(const keeper of [false,true]){
  const baseline=assemble(previous.parts,hair,keeper),next=assemble(current.parts,hair,keeper);
  const counts=[next.index.count/3],before=[baseline.index.count/3];
  assert.equal(next.index.count,baseline.index.count);
  assert.equal(next.groups.length,0);
  for(const cell of [.035,.085]){
   const baselineLod=simplifySkinnedGeometry(baseline,cell),nextLod=simplifySkinnedGeometry(next,cell);
   assert.ok(nextLod.index.count<=baselineLod.index.count*1.01);
   assert.equal(nextLod.groups.length,0);
   assert.ok(nextLod.userData.parts.bootL.count>0&&nextLod.userData.parts.bootR.count>0);
   counts.push(nextLod.index.count/3);
   before.push(baselineLod.index.count/3);
  }
  t.diagnostic(`${hair} ${keeper?'keeper':'outfield'} triangles at full/medium/low ${before.join('/')} → ${counts.join('/')}`);
 }
});
