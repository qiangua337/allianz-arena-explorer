import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
import {entranceSample,entranceFloor,matchdayAcoustics,ENTRANCE_DURATION} from '../dist/matchday-route.js';
import {sampleQueuePlayer} from '../dist/entrance-choreography.js';
import {homeXI,awayXI,substitutes,officials,teamStaff,matchdayPeople} from '../dist/matchday-roster.js';

test('entry starts with a countdown and ends on the actual pitch floor',()=>{
 assert.equal(entranceSample(-1).x,-67.4);assert.equal(entranceSample(0).countdown,4);assert.equal(entranceSample(3.9).x,-67.4);
 let previous=-67.4;const phases=new Set();for(let t=0;t<=ENTRANCE_DURATION;t+=.03){const s=entranceSample(t);assert.ok(s.x>=previous);assert.equal(s.feet,entranceFloor(s.x));previous=s.x;phases.add(s.phase);}
 for(const p of['lineup','tunnel','stairs','emerge','reveal'])assert.ok(phases.has(p));
 const end=entranceSample(500);assert.equal(end.finished,true);assert.equal(end.x,-31);assert.equal(end.feet,0);assert.equal(end.phase,'free');
});
test('reduced motion keeps the route but removes camera bob',()=>{
 for(let t=5;t<28;t+=.17){const a=entranceSample(t),b=entranceSample(t,{reducedMotion:true});assert.equal(a.x,b.x);assert.equal(a.feet,b.feet);assert.equal(b.bob,0);}
});
test('crowd sound opens gradually from the enclosed tunnel onto the field',()=>{
 const tunnel=matchdayAcoustics({x:-62,y:-1,z:0}),steps=matchdayAcoustics({x:-45,y:0,z:0}),pitch=matchdayAcoustics({x:-30,y:1.7,z:0});
 assert.ok(tunnel.cutoff<steps.cutoff&&steps.cutoff<pitch.cutoff);assert.ok(tunnel.gain<pitch.gain);assert.ok(tunnel.reverb>pitch.reverb);
 assert.ok(matchdayAcoustics({x:180,y:1.7,z:180}).gain<pitch.gain);
});
test('NPCs leave on their own timeline and take distinct pitch positions',()=>{
 for(let i=0;i<25;i++){
  const start=sampleQueuePlayer(0,i),later=sampleQueuePlayer(10,i),end=sampleQueuePlayer(200,i);
  assert.equal(start.moving,false);assert.ok(later.x>start.x);assert.equal(end.moving,false);assert.equal(sampleQueuePlayer(201,i).x,end.x);
  // Queue widths stay inside the tunnel before branching on the pitch.
  for(let t=0;t<22;t+=.05){const p=sampleQueuePlayer(t,i);if(p.x<-30)assert.ok(Math.abs(p.z)<1);const next=sampleQueuePlayer(t+.01,i);assert.ok(Math.hypot(next.x-p.x,next.z-p.z)<.04);}
 }
 assert.equal(new Set(Array.from({length:25},(_,i)=>JSON.stringify(sampleQueuePlayer(200,i)))).size,25);
});
test('the full matchday population has correct roles and distinct numbered squads',()=>{
 assert.equal(homeXI.length,11);assert.equal(awayXI.length,11);assert.equal(officials.length,4);assert.equal(teamStaff.length,8);assert.equal(substitutes.length,18);assert.equal(matchdayPeople.length,52);
 for(const [team,xi]of [['home',homeXI],['away',awayXI]]){assert.equal(xi.filter(p=>p.keeper).length,1);const squad=[...xi,...substitutes.filter(p=>p.team===team)];assert.equal(new Set(squad.map(p=>p.player.number)).size,20);assert.ok(squad.every(p=>p.player.name));}
});
test('authored motion loops retain unit quaternions and a seamless gait seam',()=>{
 const motion=JSON.parse(fs.readFileSync(new URL('../dist/assets/players/walk-cycle.json',import.meta.url)));
 for(const clip of Object.values(motion.clips)){assert.ok(clip.duration>0);assert.equal(clip.frames.length,61);for(const frame of clip.frames){assert.equal(frame.length,75);assert.ok(frame.every(Number.isFinite));for(let i=3;i<frame.length;i+=4)assert.ok(Math.abs(Math.hypot(...frame.slice(i,i+4))-1)<.00001);}}
 const walk=motion.clips.Walk_Loop;for(let i=3;i<75;i++)assert.ok(Math.abs(walk.frames[0][i]-walk.frames[60][i])<.002);
});

const directory=new URL('../dist/assets/players/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('footballer.json',directory))),file=fs.readFileSync(new URL('footballer.bin',directory));
function part(name){const p=manifest.parts.find(p=>p.name===name),a=new Float32Array(file.buffer,file.byteOffset+p.offset,p.vertices*16),ix=new Uint16Array(file.buffer,file.byteOffset+p.indexOffset,p.indexCount);return{...p,a,ix};}
function bounds(name){const p=part(name),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.vertices;i++)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p.a[i*16+j]);max[j]=Math.max(max[j],p.a[i*16+j]);}return{min,max};}
test('all shared character vertices have finite geometry and normalized bone weights',()=>{
 for(const p of manifest.parts){const {a,ix}=part(p.name);assert.ok(ix.every(i=>i<p.vertices),p.name);for(let i=0;i<p.vertices;i++){assert.ok(a.slice(i*16,i*16+16).every(Number.isFinite),p.name);let total=0;for(let j=0;j<4;j++){assert.ok(a[i*16+8+j]<manifest.bones.length);total+=a[i*16+12+j];}assert.ok(Math.abs(total-1)<.00001,p.name+' weights');}}
});
test('cloth hem overlaps the waist and the fitted hair and collar follow the head',()=>{
 const shirt=bounds('shirt'),shorts=bounds('shorts'),hair=bounds('short02');assert.ok(shirt.min[1]<shorts.max[1]-.025,'a closed waist overlap');assert.ok(shirt.max[1]<1.64,'collar cannot rise into the face');assert.ok(hair.max[1]<1.90,'hair cannot float above the skull');assert.ok(hair.min[1]>1.65,'nape is clear');
});
test('the heel and toe caps face outwards and close the shoe mesh',()=>{
 for(const name of['bootL','bootR']){const p=part(name),b=bounds(name),edges=new Map();let heel=0,toe=0;
  const point=i=>Array.from(p.a.slice(i*16,i*16+3)),key=v=>v.map(x=>x.toFixed(5)).join(',');
  for(let i=0;i<p.ix.length;i+=3){const a=point(p.ix[i]),c=point(p.ix[i+1]),d=point(p.ix[i+2]),nz=(c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]);if([a,c,d].every(v=>Math.abs(v[2]-b.min[2])<1e-6)){assert.ok(nz<0);heel++;}if([a,c,d].every(v=>Math.abs(v[2]-b.max[2])<1e-6)){assert.ok(nz>0);toe++;}
   for(const[u,v]of[[a,c],[c,d],[d,a]]){const k=[key(u),key(v)].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}
  }
  assert.ok(heel>=20&&toe>=20);for(const count of edges.values())assert.equal(count,2,'every shoe edge joins two faces');
 }
});
