import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,style:{},classList:{toggle(){}},focus(){}}),createElement:()=>({getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');await loadBrandAssets();
const {createReplayRecorder,replaySample,replayCamera}=await import('../dist/football-replay.js');
const {advanceFootballCamera}=await import('../dist/football-controls.js');
const {buildStadium}=await import('../dist/stadium.js');
const state=(x=0,z=0,y=.11)=>({time:0,phase:'playing',paused:false,ball:{x,y,z,vx:0,vy:0,vz:0,ownerId:null},players:[],score:{home:0,away:0}});
function cameraFor(pose,aspect){const camera=new THREE.PerspectiveCamera(pose.fov,aspect,.06,2000);camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();return camera;}
function framed(point,camera){const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<=.80001&&p.y>=-.50001&&p.y<=.60001&&p.z<1,JSON.stringify({point,projection:p.toArray(),position:camera.position.toArray()}));}

test('one recorded replay keeps a stable side through centre-line crossings and seeking without changing the live state',()=>{
 for(const start of[-1,1]){
  const recorder=createReplayRecorder(),s=state(start*.01),before=JSON.stringify(s);for(let i=0;i<5;i++){s.time=i*.1;s.ball.x=start*(.01-i*.005);recorder.record(s);}const live=JSON.stringify(s),clip=recorder.clip();assert.equal(clip.cameraSide,start>0?-1:1);
  const left=replaySample(clip,.199),right=replaySample(clip,.201),a=replayCamera(left),b=replayCamera(right);assert.equal(left.replayCameraSide,right.replayCameraSide);assert.ok(Math.hypot(...a.position.map((n,i)=>n-b.position[i]))<.01,'not a 26m cross-field camera flip');
  for(const t of[clip.duration,0,.2,clip.duration/2])assert.equal(replaySample(clip,t).replayCameraSide,clip.cameraSide);assert.equal(JSON.stringify(s),live);assert.ok(!before.includes('replayCameraSide'));assert.equal(s.replayCameraSide,undefined);
  const legacy={frames:clip.frames,duration:clip.duration};assert.equal(replaySample(legacy,.201).replayCameraSide,clip.cameraSide,'clips without optional metadata still choose the first frame side');
 }
});

test('recorded penalty stages and sampled set-piece objects stay detached from the live match and saved clip',()=>{
 const recorder=createReplayRecorder(),s=state();s.setPiece={type:'penalty',stage:'ready',time:0,team:'home'};
 for(let i=0;i<5;i++){s.time=i*.1;s.setPiece.time=s.time;recorder.record(s);}const clip=recorder.clip();
 s.setPiece.stage='shot';s.setPiece.time=3;assert.equal(clip.frames[0].setPiece.stage,'ready');assert.equal(clip.frames[0].setPiece.time,0);assert.equal(clip.frames.at(-1).setPiece.time,.4);
 const frame=replaySample(clip,.2);frame.setPiece.stage='result';frame.setPiece.time=9;assert.equal(clip.frames[2].setPiece.stage,'ready');assert.equal(clip.frames[2].setPiece.time,.2);assert.equal(s.setPiece.stage,'shot');assert.equal(recorder.clip().frames[2].setPiece.stage,'ready');
});

test('actual replay perspective retains the ball, high balls and a nearby complete owner at both field ends on phones',()=>{
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let cases=0;
 for(const aspect of[390/844,844/390,16/9])for(const x of[-34,-17,0,17,34])for(const z of[-53,-26,0,26,53])for(const side of[-1,1]){
  for(const y of[.11,2,8,12]){const s={...state(x,z,y),replayCameraSide:side},pose=replayCamera(s,aspect),camera=cameraFor(pose,aspect);framed([x,y,z],camera);assert.ok(Math.abs(pose.position[0])<=31&&Math.abs(pose.position[2])<=49&&pose.position[1]<=30);cases++;}
  for(let angle=0;angle<8;angle++){const p={id:'owner',x:clamp(x+Math.sin(angle*Math.PI/4)*.75,-34,34),z:clamp(z+Math.cos(angle*Math.PI/4)*.75,-53,53)},s={...state(x,z),players:[p],replayCameraSide:side};s.ball.ownerId=p.id;const pose=replayCamera(s,aspect),camera=cameraFor(pose,aspect);for(const point of[[x,.11,z],[p.x,0,p.z],[p.x,2,p.z]])framed(point,camera);cases++;}
 }
 assert.equal(cases,1800);
});

test('the replay cameras stay inside the actual seating envelope with clear architectural rays to field action',()=>{
 const scene=new THREE.Scene(),stadium=buildStadium(scene),obstacles=[];scene.updateMatrixWorld(true);stadium.root.traverse(o=>{if(o.isMesh&&!o.material.transparent)obstacles.push(o);});
 for(const aspect of[390/844,844/390,16/9])for(const x of[-33,0,33])for(const z of[-50,0,50])for(const side of[-1,1]){
  const s={...state(x,z,2),replayCameraSide:side},pose=replayCamera(s,aspect),camera=cameraFor(pose,aspect),point=new THREE.Vector3(x,2,z),direction=point.clone().sub(camera.position),distance=direction.length(),hit=new THREE.Raycaster(camera.position,direction.normalize(),0,distance-.4).intersectObjects(obstacles,false)[0];assert.equal(hit,undefined,JSON.stringify({x,z,side,camera:pose.position,hit:hit?.object.name}));
 }
});

test('crossing the centre line remains continuous through the actual camera smoothing helper',()=>{
 const recorder=createReplayRecorder(),s=state(-.5);for(let i=0;i<=10;i++){s.time=i*.1;s.ball.x=-.5+i*.1;recorder.record(s);}const clip=recorder.clip();let previous=replayCamera(replaySample(clip,0));
 for(let i=1;i<=60;i++){const frame=replaySample(clip,i/60),desired=replayCamera(frame),next=advanceFootballCamera(previous,desired,{player:{x:frame.ball.x,z:frame.ball.z},dt:1/60,changed:false,rate:7});assert.ok(Math.hypot(...next.position.map((n,k)=>n-previous.position[k]))<.1);previous=next;}
});
