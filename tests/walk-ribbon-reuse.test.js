import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {ribbonPoints} from '../dist/ribbon-path.js';
import {floorHeight} from '../dist/navigation.js';
import {roomSpecs,seatingTiers} from '../dist/building-layout.js';
import {tourNodes} from '../dist/tour-route.js';

const geometry={rooms:roomSpecs,tiers:seatingTiers};

test('ribbon reuses complete upcoming stair segments without moving their marks or extending the visible line',()=>{
 const path=['flight0Out','flight0Turn','flight0End','landing1'].map(id=>tourNodes[id]);
 const start=tourNodes.flight0Start,segments=new Map();
 for(const progress of [.05,.08,.14,.2,.26,.3]){
  const x=start.x,z=start.z+(path[0].z-start.z)*progress;
  const position={x,z,y:floorHeight(x,z,start.y+(path[0].y-start.y)*progress,geometry)};
  assert.deepEqual(ribbonPoints(position,path,geometry,14,segments),ribbonPoints(position,path,geometry,14));
  assert.deepEqual(ribbonPoints(position,path,geometry,28,segments),ribbonPoints(position,path,geometry,28));
 }
 assert.ok(segments.has(path[1]));
 const original=segments.get(path[1]);
 const z=start.z+.25,position={x:start.x,z,y:floorHeight(start.x,z,start.y,geometry)};
 assert.deepEqual(ribbonPoints(position,path,geometry,28,segments),ribbonPoints(position,path,geometry,28));
 assert.equal(segments.get(path[1]),original);
});

test('turning near a stop keeps the bearing live without sampling the same floor on every turn',async()=>{
 registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
 const {THREE}=await import('../dist/kit.js');
 const {buildWalkGuide}=await import('../dist/walk-guide.js');
 const priorDocument=globalThis.document,elements=new Map();
 globalThis.document={body:{dataset:{}},getElementById(id){
  if(!elements.has(id))elements.set(id,{style:{},setAttribute(){},classList:{toggle(){}}});
  return elements.get(id);
 }};
 try{
  let samples=0;
  const measuredGeometry={rooms:roomSpecs,get tiers(){samples++;return seatingTiers;}};
  const guide=buildWalkGuide(new THREE.Scene(),measuredGeometry);
  const start=new THREE.Vector3(0,-1.2,117);
  guide.setGoal('arcade',start);
  guide.update(start,0,.13,'walk');
  const original=elements.get('guide-arrow').style.transform;
  const initialSamples=samples;
  for(let i=1;i<25;i++)guide.update(start,i*.025,.13,'walk');
  assert.notEqual(elements.get('guide-arrow').style.transform,original);
  assert.ok(samples-initialSamples<=42,'one deferred clearance check is sufficient at a fixed point');
  guide.update(new THREE.Vector3(0,-1.2,113),0,.13,'walk');
  assert.equal(guide.isArrived(),true,'moving into the destination still completes the stop immediately');
  assert.equal(guide.isNearArrival(),true);
  guide.update(new THREE.Vector3(0,-1.2,122),0,.13,'walk');
  assert.equal(guide.isArrived(),true);
  assert.equal(guide.isNearArrival(),false,'completed stop remains available after leaving its banner area');
 }finally{globalThis.document=priorDocument;}
});
