import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE}=await import('../dist/kit.js');
const {buildEntrancePlayers,matchOfficialPose}=await import('../dist/entrance-players.js');
const {buildFootballView}=await import('../dist/football-view.js');
const {homeXI,awayXI}=await import('../dist/matchday-roster.js');
const realFetch=globalThis.fetch;
globalThis.fetch=async url=>{const data=await fs.readFile(new URL(url));return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const scene=new THREE.Scene(),actors=buildEntrancePlayers(scene);await actors.prepare();globalThis.fetch=realFetch;
const makeState=()=>({players:[...homeXI,...awayXI].map((d,i)=>({id:d.team+':'+d.player.number,team:d.team,index:i%11,number:d.player.number,name:d.player.name,keeper:d.keeper,x:-22+i%11*4,z:i<11?-20:20,vx:0,vz:0,yaw:i<11?Math.PI:0})),controlledId:'home:9',ball:{x:0,y:.11,z:0,vx:0,vy:0,vz:0,ownerId:null},phase:'playing'});

test('live match actors use their own team and shirt number positions instead of the camera or entrance queue',()=>{
 const state=makeState();actors.reset();actors.updateMatch(state,0,new THREE.Vector3(0,5,0));scene.updateMatrixWorld(true);
 const starters=actors.root.children.filter(o=>o.userData.role==='player');assert.equal(starters.length,22);
 for(const actor of actors.root.children.filter(o=>o.isGroup))assert.ok(actor.position.toArray().every(Number.isFinite),actor.name+' position');assert.equal(actors.positions.split(';').length,52);
 for(const actor of starters){const p=state.players.find(p=>p.team===actor.userData.team&&p.number===actor.userData.playerNumber);assert.ok(p);assert.ok(actor.visible);assert.equal(actor.position.x,p.x);assert.equal(actor.position.z,p.z);assert.equal(actor.position.y,0);}
 const fixed=starters.map(o=>o.position.toArray());actors.updateMatch(state,.1,new THREE.Vector3(28,2,-40));assert.deepEqual(starters.map(o=>o.position.toArray()),fixed);
 actors.updateMatch(state,.2,new THREE.Vector3(0,1.7,0),{firstPerson:true});assert.equal(starters.filter(o=>o.visible).length,21);assert.equal(starters.find(o=>o.userData.team==='home'&&o.userData.playerNumber===9).visible,false);
 actors.updateMatch(state,.3,new THREE.Vector3(0,5,0));assert.equal(starters.filter(o=>o.visible).length,22);
});

test('officials track play along the touchlines without teleporting with a long pass',()=>{
 const referee={role:'referee',phase:0},assistant={role:'assistantReferee',flag:true,phase:.7};let p=matchOfficialPose(referee,{x:0,z:0},null);
 const next=matchOfficialPose(referee,{x:33,z:50},p,.1);assert.ok(Math.hypot(next.x-p.x,next.z-p.z)<=.340001);assert.ok(next.moving);assert.ok(Math.abs(next.x)<28&&Math.abs(next.z)<45);
 assert.equal(matchOfficialPose(assistant,{x:0,z:70},null).x,-35.5);assert.equal(matchOfficialPose({...assistant,phase:1.4},{x:0,z:0},null).x,35.5);assert.equal(matchOfficialPose(assistant,{x:0,z:70},null).z,49);
 const paused=matchOfficialPose(referee,{x:33,z:50},p,0);assert.equal(paused.x,p.x);assert.equal(paused.z,p.z);
 assert.deepEqual(matchOfficialPose({role:'fourth'},null,null),{x:-37.4,z:3.8,yaw:Math.PI/2,moving:false});
});

test('ball and selected-player cues follow simulation state and switching perspective reuses the same character objects',()=>{
 const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.11,1),new THREE.MeshBasicMaterial()),view=buildFootballView(scene,ball,actors),state=makeState(),childCount=actors.root.children.length;scene.add(ball);
 view.setEnabled(true);view.update(state,1,new THREE.Vector3(0,6,0));assert.equal(ball.position.y,.115);assert.equal(view.root.getObjectByName('Controlled footballer').position.x,state.players.find(p=>p.id===state.controlledId).x);
 state.ball.x=1;state.ball.z=-2;state.ball.y=2;view.update(state,1.1,new THREE.Vector3(0,6,0),{firstPerson:true});assert.equal(ball.position.x,1);assert.equal(ball.position.y,2);assert.equal(ball.position.z,-2);assert.notEqual(ball.rotation.x,0);assert.equal(view.root.getObjectByName('Game ball marker').visible,false);assert.equal(actors.root.children.length,childCount);
 const before=JSON.stringify(state);view.update(state,1.2,new THREE.Vector3(30,15,40));assert.equal(JSON.stringify(state),before);view.setEnabled(false);assert.equal(view.root.visible,false);view.update(state,1.3,new THREE.Vector3());assert.equal(view.root.visible,false);
});
