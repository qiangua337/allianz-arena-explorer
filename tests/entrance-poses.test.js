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
  for(const person of players.root.children){if(person.position.x> -46.7&&person.position.x< -39.6)continue;const feet=[];for(const name of['bootL','bootR']){const boot=person.getObjectByName(name);let bottom=Infinity;for(let i=0;i<boot.geometry.attributes.position.count;i++){boot.getVertexPosition(i,v);boot.localToWorld(v);bottom=Math.min(bottom,v.y-entranceFloor(v.x));}feet.push(bottom);}
   assert.ok(Math.min(...feet)<.085,'at least one foot is on the floor at '+t.toFixed(2));assert.ok(Math.min(...feet)>-.09,'no foot sinks through the floor at '+t.toFixed(2));
  }
 }
});
test('all final NPC poses are fixed world positions and can be replayed',()=>{
 players.update(200,200);scene.updateMatrixWorld(true);const end=players.positions;players.update(201,201);assert.equal(players.positions,end);
 players.reset();players.update(0,202);const start=players.positions;assert.notEqual(start,end);players.update(0,203);assert.equal(players.positions,start);
});
