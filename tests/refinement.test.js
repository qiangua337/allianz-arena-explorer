import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
import {goalFrameCollision} from '../dist/goal-frame.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {createReplayRecorder,replaySample,replayCamera} from '../dist/football-replay.js';
import {joystickAxes} from '../dist/touch-control.js';
const {arenaMapView,mapProject,mapUnproject,mapDestinationAt,drawArenaFloorMap}=await import('../dist/arena-floor-map.js');
const {tourNodes}=await import('../dist/tour-route.js');
const {createGoalNetMaterial,goalFeedbackController}=await import('../dist/goal-feedback.js');

test('fast balls hit both goal posts and crossbars through a swept physical test while clear goal-mouth shots pass',()=>{
 for(const s of[-1,1]){
  for(const x of[-3.66,3.66]){const hit=goalFrameCollision({x,y:1,z:s*51.9},{x,y:1,z:s*53.2},{x:0,y:0,z:s*35});assert.ok(hit&&hit.t>0&&hit.t<1);assert.ok(hit.velocity.z*s<0);assert.equal(hit.name,'门柱');}
  const bar=goalFrameCollision({x:0,y:2.44,z:s*51.9},{x:0,y:2.44,z:s*53.2},{x:0,y:0,z:s*35});assert.equal(bar.name,'横梁');assert.ok(bar.velocity.z*s<0);
  assert.equal(goalFrameCollision({x:0,y:.9,z:s*51.9},{x:0,y:.9,z:s*53.2},{x:0,y:0,z:s*35}),null);
  assert.equal(goalFrameCollision({x:4.5,y:.9,z:s*51.9},{x:4.5,y:.9,z:s*53.2},{x:0,y:0,z:s*35}),null);
 }
});
test('an actual post rebound stays live rather than being counted as a goal or a goal kick',()=>{
 const g=createFootballSimulation();for(let i=0;i<190;i++)g.update(1/60);for(const p of g.state.players){p.x=25;p.z=30;p.decisionAt=p.tackleAt=1e6;}Object.assign(g.state.ball,{ownerId:null,x:3.66,y:1,z:-51.9,vx:0,vy:0,vz:-35});for(let i=0;i<6;i++)g.update(1/60);assert.equal(g.state.phase,'playing');assert.equal(g.state.score.home,0);assert.ok(g.state.ball.vz>0);assert.ok(g.state.events.some(e=>e.type==='woodwork'));
});
test('replay memory remains bounded and saved goals are isolated from later live mutations',()=>{
 const r=createReplayRecorder(),g=createFootballSimulation();for(let i=0;i<1800;i++){g.update(1/60);r.record(g.state);}assert.ok(r.count<=r.capacity&&r.count>=3);g.state.phase='goal';g.state.score.home=1;r.goal(g.state);const clip=r.clip(),copy=JSON.stringify(clip),last=clip.frames.at(-1);assert.equal(last.score.home,1);g.state.ball.x=99;g.state.players[0].x=99;g.state.score.home=5;assert.equal(JSON.stringify(clip),copy);assert.equal(r.clip().frames.at(-1).score.home,1);assert.ok(clip.duration<=8);r.reset();assert.equal(r.clip(),null);assert.equal(r.available,false);
});
test('replay samples interpolate position and the shortest heading arc without touching the live match',()=>{
 const g=createFootballSimulation(),a=g.state,b={...a,time:1,ball:{...a.ball,x:8},players:a.players.map(p=>({...p,x:p.x+4,yaw:-Math.PI+.1})),score:{home:1,away:0}};a.time=0;for(const p of a.players)p.yaw=Math.PI-.1;const before=JSON.stringify(a),clip={frames:[a,b],duration:1},frame=replaySample(clip,.5);assert.equal(frame.ball.x,4);assert.ok(Math.abs(Math.abs(frame.players[0].yaw)-Math.PI)<1e-8);assert.equal(JSON.stringify(a),before);const camera=replayCamera(frame);assert.ok(camera.position.every(Number.isFinite)&&camera.position[1]>5);assert.ok(Math.abs(camera.position[0])<36&&Math.abs(camera.position[2])<60);
});
test('the net pulses only for a new goal, pauses with its clock and never reallocates the material program',()=>{
 const nets=[createGoalNetMaterial(),createGoalNetMaterial()],feedback=goalFeedbackController(nets),shader={uniforms:{},vertexShader:'#include <begin_vertex>'};nets[0].material.onBeforeCompile(shader);feedback.reset();const state={score:{home:1,away:0},phase:'goal',ball:{x:1,y:.6,z:-53.1}};feedback.update(state,2);assert.equal(shader.uniforms.netTime.value,0);assert.equal(shader.uniforms.netHit.value.x,-1);feedback.update(state,2.1);assert.ok(shader.uniforms.netTime.value>.09);feedback.update(state,2.1);assert.ok(shader.uniforms.netTime.value>.09);const key=nets[0].material.customProgramCacheKey();feedback.reset();assert.equal(shader.uniforms.netPower.value,0);assert.equal(key,nets[0].material.customProgramCacheKey());
});
test('the floor map projects room geometry and selects only destinations on the displayed level',()=>{
 for(const p of[{x:-82,y:-1,z:0},{x:0,y:13.9,z:118},{x:90,y:25.3,z:0},{x:105,y:41.7,z:-20}]){const view=arenaMapView(p,p.y-1.7);assert.ok(view.level!==null);const q=mapUnproject(view,mapProject(view,p));assert.ok(Math.hypot(q.x-p.x,q.z-p.z)<1e-8);}
 const view=arenaMapView({x:-82,y:-1,z:0},-2.7),node=tourNodes.homeRoom,hit=mapDestinationAt(view,mapProject(view,node));assert.equal(hit,'homeRoom');assert.equal(mapDestinationAt(view,mapProject(view,tourNodes.store)),null);
 const context=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{}});assert.doesNotThrow(()=>drawArenaFloorMap(context,{position:{x:-82,y:-1,z:0},feetY:-2.7,goal:'homeRoom',route:[tourNodes.homeRoom]}));
});
test('analog touch control has a radial dead zone, never exceeds unit speed and preserves diagonal direction',()=>{
 assert.equal(joystickAxes(1,1).x,0);const full=joystickAxes(100,-100);assert.ok(Math.abs(Math.hypot(full.x,full.y)-1)<1e-10);assert.ok(Math.abs(full.x-full.y)<1e-10);assert.ok(joystickAxes(12,0).x<joystickAxes(24,0).x);assert.deepEqual(joystickAxes(NaN,1),{x:0,y:0,thumbX:0,thumbY:0});assert.equal(joystickAxes(25,0).y,0);
});
