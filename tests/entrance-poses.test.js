import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({getContext:()=>ctx}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE}=await import('../dist/kit.js');
const {buildEntrancePlayers}=await import('../dist/entrance-players.js');
const {entranceFloor}=await import('../dist/matchday-route.js');
const realFetch=globalThis.fetch;
globalThis.fetch=async url=>{const data=await fs.readFile(new URL(url));return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const scene=new THREE.Scene(),players=buildEntrancePlayers(scene);
await players.prepare();globalThis.fetch=realFetch;

test('the real skinned boots stay grounded during the independent level walk',()=>{
 const v=new THREE.Vector3();
 for(let t=0;t<=36;t+=.05){players.update(t,t);scene.updateMatrixWorld(true);
  for(const person of players.root.children.filter(p=>p.userData.role==='player')){if(person.position.x> -46.7&&person.position.x< -39.6)continue;const feet=[],body=person.getObjectByName('athlete');for(const name of['bootL','bootR']){const range=body.geometry.userData.parts[name];let bottom=Infinity;for(let i=range.start;i<range.start+range.count;i++){body.getVertexPosition(i,v);body.localToWorld(v);bottom=Math.min(bottom,v.y-entranceFloor(v.x));}feet.push(bottom);}
   assert.ok(Math.min(...feet)<.085,'at least one foot is on the floor at '+t.toFixed(2));assert.ok(Math.min(...feet)>-.09,'no foot sinks through the floor at '+t.toFixed(2));
  }
 }
});
test('all final NPC poses are fixed world positions and can be replayed',()=>{
 players.update(200,200);scene.updateMatrixWorld(true);const end=players.positions;players.update(201,201);assert.equal(players.positions,end);
 players.reset();players.update(0,202);const start=players.positions;assert.notEqual(start,end);players.update(0,203);assert.equal(players.positions,start);
});
test('seated substitutes align their hips with the actual cushion heights',()=>{
 players.update(200,200);scene.updateMatrixWorld(true);const v=new THREE.Vector3();
 for(const person of players.root.children.filter(p=>p.userData.role==='substitute'||p.userData.role==='assistant')){person.getObjectByName('upperleg01.L').getWorldPosition(v);const cushion=person.userData.role==='assistant'?1.05:.60;assert.ok(Math.abs(v.y-cushion)<.14,person.name+' hip aligns with cushion');const body=person.getObjectByName('athlete');let bottom=Infinity;for(const name of['bootL','bootR']){const range=body.geometry.userData.parts[name];for(let i=range.start;i<range.start+range.count;i++){body.getVertexPosition(i,v);body.localToWorld(v);bottom=Math.min(bottom,v.y);}}const floor=person.userData.role==='assistant'?.49:.04;assert.ok(bottom>floor-.14&&bottom<floor+.22,person.name+' feet align with platform');}
});
