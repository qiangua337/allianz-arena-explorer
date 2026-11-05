import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
import {passFlight,supportPosition,possessionTeam,passRunSeconds} from '../dist/football-tactics.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
const {THREE}=await import('../dist/kit.js');
const {applyFootballAction}=await import('../dist/football-action-pose.js');
const run=(g,t)=>{for(let i=0;i<Math.round(t*60);i++)g.update(1/60);};
const setup=()=>{const g=createFootballSimulation();run(g,3.05);for(const p of g.state.players){if(p.id!==g.state.controlledId){p.x=p.team==='home'?29:-29;p.z=p.team==='home'?44:-44;}p.vx=p.vz=0;p.decisionAt=p.tackleAt=1e6;}return g;};

test('blocked through balls clear a defensive line and return to the intended ground point under the shared air drag',()=>{
 const ball={x:0,z:0,y:.11},target={x:3,z:-24},flight=passFlight(ball,target,{type:'through',lane:.6});assert.ok(flight.lofted);assert.ok(flight.vy>5);const travel=(1-Math.exp(-.08*flight.flight))/.08;assert.ok(Math.abs(flight.vx*travel-target.x)<1e-6&&Math.abs(flight.vz*travel-target.z)<1e-6);assert.ok(Math.abs(ball.y+flight.vy*flight.flight-4.905*flight.flight**2-.11)<1e-6);assert.equal(passFlight(ball,target,{type:'pass',lane:.6}).lofted,false);assert.equal(passFlight(ball,target,{type:'through',lane:4}).lofted,false);
});
test('a real lofted through pass crosses the marker and can be received without teleporting the ball',()=>{
 const g=setup(),receiver=g.state.players.find(p=>p.id==='home-8'),marker=g.state.players.find(p=>p.id==='away-3');Object.assign(receiver,{x:0,z:-18});Object.assign(marker,{x:0,z:-9});assert.equal(g.action('through',{direction:{x:0,z:-1}}),true);assert.ok(g.state.ball.vy>5);let height=0,received=false;for(let i=0;i<240;i++){g.update(1/60);height=Math.max(height,g.state.ball.y);if(g.state.ball.ownerId===receiver.id){received=true;break;}}assert.ok(height>1.8);assert.ok(received);assert.equal(g.state.stats.home.passes,1);
});
test('off-ball positioning follows formation roles across both ends and creates room beside a marker',()=>{
 const p={id:'home-2',team:'home',index:2},ball={x:0,z:-10};for(const sign of [-1,1]){const b={...ball,z:ball.z*-sign},cb=supportPosition(p,b,[],{base:[0,30],role:'CB',sign,attacking:true}),st=supportPosition(p,b,[],{base:[0,-24],role:'ST',sign,attacking:true}),dm=supportPosition(p,b,[],{base:[0,12],role:'DM',sign,attacking:true});assert.ok(cb.z*sign< -10);assert.ok(st.z*sign>=b.z*sign+9);assert.ok(dm.z*sign<b.z*sign);}
 const open=supportPosition(p,ball,[],{base:[12,5],role:'CM',attacking:true}),covered=supportPosition(p,ball,[{id:'away-3',team:'away',x:open.x-.4,z:open.z+.2}],{base:[12,5],role:'CM',attacking:true});assert.ok(covered.x>open.x+.5);assert.ok(Math.abs(covered.x)<=30&&Math.abs(covered.z)<=48);
});
test('teammates keep attacking during their pass flight while centre-backs do not automatically charge forward after every pass',()=>{
 const players=[{id:'a',team:'home'},{id:'b',team:'away'}];assert.equal(possessionTeam({ownerId:null,targetId:'a'},players),'home');assert.equal(possessionTeam({ownerId:'b',targetId:'a'},players),'away');assert.equal(possessionTeam({ownerId:null,shot:{team:'away'}},players),'away');players[0].dismissed=true;assert.equal(possessionTeam({ownerId:null,targetId:'a'},players),null);assert.equal(passRunSeconds('CB'),0);assert.ok(passRunSeconds('DM')<passRunSeconds('ST'));
});
test('manual player switching cancels the old player’s buffered kick instead of firing it from a new receiver',()=>{
 const g=setup(),p=g.state.players.find(p=>p.id===g.state.controlledId),mate=g.state.players.find(p=>p.id==='home-8');Object.assign(p,{x:0,z:0});Object.assign(mate,{x:0,z:-12});Object.assign(g.state.ball,{ownerId:null,x:0,y:.11,z:3,vx:0,vy:0,vz:-6});assert.equal(g.action('pass'),true);assert.equal(g.action('switch',{direction:{x:0,z:-1}}),true);run(g,.6);assert.equal(g.state.stats.home.passes,0);
});
test('a kick reaches its strike early and recovers while preparation and celebration preserve the support leg',()=>{
 const make=()=>Array.from({length:18},()=>new THREE.Bone()),strike=make(),recovery=make();applyFootballAction(strike,{type:'shoot',elapsed:.08,duration:.46});applyFootballAction(recovery,{type:'shoot',elapsed:.44,duration:.46});assert.ok(Math.abs(strike[15].rotation.x)>.7);assert.ok(Math.abs(recovery[15].rotation.x)<.1);
 for(const type of ['prepareShot','trap','celebrate']){const bones=make();applyFootballAction(bones,{type,elapsed:.6,duration:1});assert.equal(bones[9].rotation.x,0);assert.equal(bones[10].rotation.x,0);assert.equal(bones[0].position.y,0);assert.ok(bones.every(b=>b.quaternion.toArray().every(Number.isFinite)));}
});
