import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineSession,createOnlineSimulation} from '../dist/online-client.js';
import {createOnlineInterpolation,createOnlinePrediction} from '../dist/online-prediction.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState} from '../dist/online-protocol.js';
import {runOnlineLink} from './helpers/online-link91.mjs';

test('same-tick action broadcasts and a paused interval do not manufacture network jitter',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:1000});let socket;
 class Socket{constructor(){socket=this;this.readyState=1;}send(){}close(){this.readyState=3;}message(p){this.onmessage({data:JSON.stringify(p)});}}
 const session=createOnlineSession({code:'ABCD2345',token:'test-only',team:'home'},{origin:'https://arena.example',WebSocketClass:Socket}),ready=session.connect(),room={started:true,ended:false};
 try{socket.message({type:'welcome',protocol:2,room});await ready;let time=1;const state=()=>({type:'state',state:{phase:'playing',paused:false,time}});socket.message(state());
  for(let i=0;i<30;i++){t.mock.timers.tick(50);time+=.05;socket.message(state());socket.message(state());socket.message(state());}assert.ok(session.jitter<.001,'an action snapshot at the same server timestamp is not a late 20Hz tick');
  socket.message({type:'state',state:{phase:'interval',paused:true,time}});t.mock.timers.tick(5000);socket.message(state());assert.ok(session.jitter<.001,'waiting at half time is not transport jitter');
  t.mock.timers.tick(110);time+=.05;socket.message(state());assert.ok(session.jitter>5,'actual 60ms delivery variation still contributes to the buffer estimate');
 }finally{session.close();}
});

for(const scenario of [{fps:30},{fps:30,jitter:.065},{fps:30,jitter:.065,loss:.1},{fps:60,jitter:.065}])test(`300ms RTT keeps remote motion continuous with ${scenario.fps}fps, ${scenario.jitter||0}s jitter and ${scenario.loss||0} missing snapshots`,()=>{
 const result=runOnlineLink(createOnlineSimulation,scenario);assert.equal(result.remote.zeroOrBackward,0);assert.ok(result.remote.stdStep<.025);assert.ok(result.remote.maxStep<.22);assert.ok(result.predictionPeak<=.6);assert.ok(result.meanSnapshotBytes<5000);assert.equal(result.updates,scenario.fps*6);
});
function renderState(){const state=createFootballSimulation({humanTeams:['home','away']}).state;state.phase='playing';state.paused=false;state.time=1;state.controlledId='home-1';state.ball.ownerId='away-1';return state;}
function pose(state,time){state.time=time;for(const p of state.players){p.x=time*5;p.z=0;p.yaw=Math.PI-.03;p.vx=5;p.vz=0;}state.ball.x=time*5;state.ball.y=.11;state.ball.z=0;}

test('adaptive remote playback remains monotonic and bounded through sustained jitter, buffer changes and a stalled stream',()=>{
 const s=renderState(),buffer=createOnlineInterpolation(),pending=[];let next=.05,delivered=0,lastDelivery=0,lastX=-Infinity,maxLag=0;
 for(let i=0;i<3600;i++){const now=i/30;while(next<=now+.00001){const delay=now<30?.15:now<90?.15+.065*Math.sin(next*31):.15;lastDelivery=Math.max(lastDelivery,next+delay);pending.push({at:lastDelivery,time:1+next});next+=.05;}
  while(pending[0]?.at<=now){const frame=pending.shift();pose(s,frame.time);buffer.receive(s);delivered=frame.time;}
  buffer.update(s,1/30,now>=30&&now<90?55:0);if(delivered){assert.ok(s.players[12].x>=lastX-1e-9,'arrival bursts and delay changes cannot rewind the render clock');lastX=s.players[12].x;maxLag=Math.max(maxLag,delivered-buffer.playhead);}assert.ok(buffer.bufferedFrames<=8);
 }
 assert.ok(maxLag<.4);assert.ok(delivered-buffer.playhead<.15,'the remote clock does not accumulate delay after jitter recovers');assert.equal(buffer.bytes,7232);assert.equal(buffer.capacity,8);
 for(let i=0;i<100;i++)buffer.update(s,1/30,0);const x=s.players[12].x;for(let i=0;i<100;i++)buffer.update(s,1/30,0);assert.equal(s.players[12].x,x,'a stale stream cannot extrapolate indefinitely');assert.ok(buffer.playhead<=delivered);
});

test('pause, interval, goals, control switches and time resets clear old poses while local poses and ownership stay authoritative',()=>{
 const s=renderState(),buffer=createOnlineInterpolation();pose(s,1);buffer.receive(s);pose(s,1.05);buffer.receive(s);const local=s.players[1];local.x=999;buffer.update(s,1/30,65);assert.equal(local.x,999);
 s.ball.ownerId='home-1';s.ball.x=123;buffer.update(s,1/30,65);assert.equal(s.ball.x,123);
 for(const phase of ['goal','interval']){s.phase=phase;s.players[12].x=50;buffer.receive(s);buffer.update(s,1/30,65);assert.equal(buffer.bufferedFrames,0);assert.equal(s.players[12].x,50);s.phase='playing';pose(s,s.time+.1);buffer.receive(s);}
 s.paused=true;buffer.receive(s);assert.equal(buffer.bufferedFrames,0);s.paused=false;pose(s,2);buffer.receive(s);pose(s,2.05);buffer.receive(s);s.controlledId='away-1';pose(s,2.1);buffer.receive(s);assert.equal(buffer.bufferedFrames,1);pose(s,.1);buffer.receive(s);assert.equal(buffer.bufferedFrames,1);buffer.clear();assert.equal(buffer.bufferedFrames,0);
});

test('remote render interpolation cannot perturb predicted collisions or pressure assistance',()=>{
 const a=renderState();for(const p of a.players)Object.assign(p,{x:20,z:30,vx:0,vz:0});Object.assign(a.players[1],{x:0,z:0,yaw:Math.PI/2,stamina:1});Object.assign(a.players[12],{x:.5,z:0,yaw:Math.PI/2,stamina:1});Object.assign(a.ball,{x:1,y:.11,z:0,ownerId:'away-1',vx:1,vz:0});const b=structuredClone(a),pa=createOnlinePrediction('home'),pb=createOnlinePrediction('home');pa.receive(a);pb.receive(b);
 for(let i=0;i<12;i++){Object.assign(b.players[12],{x:-10-i,z:10+i});pa.update(a,1/60,{x:0,z:0,defend:true},i+1);pb.update(b,1/60,{x:0,z:0,defend:true},i+1);assert.deepEqual([a.players[1].x,a.players[1].z],[b.players[1].x,b.players[1].z]);}
});

test('remote stopping and reversing interpolate animation velocity on the same timeline as their pose',()=>{
 for(const nextSpeed of [0,-5]){
  const s=renderState(),buffer=createOnlineInterpolation(),remote=s.players[12];
  pose(s,1);Object.assign(remote,{x:0,vx:5,vz:2});buffer.receive(s);
  pose(s,1.1);Object.assign(remote,{x:.5,vx:5,vz:2});buffer.receive(s);
  pose(s,1.2);Object.assign(remote,{x:.75,vx:nextSpeed,vz:0});buffer.receive(s);
  let checkedPast=false,checkedTransition=false;
  for(let i=0;i<20;i++){
   const local=s.players[1];Object.assign(local,{vx:19,vz:-17});buffer.update(s,1/60,55);const time=Math.max(1,buffer.playhead);
   if(time<1.1){checkedPast=true;assert.equal(remote.vx,5,'latest stop/reversal cannot cancel an earlier running pose');assert.equal(remote.vz,2);}
   else if(time<1.2){checkedTransition=true;const t=(time-1.1)/.1;assert.ok(Math.abs(remote.x-(.5+.25*t))<1e-9);assert.ok(Math.abs(remote.vx-(5+(nextSpeed-5)*t))<1e-9);assert.ok(Math.abs(remote.vz-(2-2*t))<1e-9);}
   assert.equal(local.vx,19);assert.equal(local.vz,-17,'local control velocities are never buffered');
  }
  assert.ok(checkedPast&&checkedTransition);assert.equal(buffer.bytes,7232);
 }
});

test('a remote shot uses the same delayed contact time for the ball and striking pose',()=>{
 const state=renderState(),buffer=createOnlineInterpolation(),actor=state.players[12];
 pose(state,1);state.ball.x=1;actor.motion=null;buffer.receive(state);
 pose(state,1.1);state.ball.x=2.6;state.ball.ownerId=null;
 actor.motion={id:17,type:'shoot',stroke:'finesse',elapsed:.06,duration:.46,contactX:1,contactY:.11,contactZ:0};
 buffer.receive(state);
 let before=false,after=false;
 for(let i=0;i<26;i++){
  buffer.update(state,1/120);
  const t=Math.max(1,buffer.playhead);
  assert.equal(state.ball.ownerId,null,'possession is still applied on packet arrival');
  if(t<1.04){before=true;assert.equal(actor.motion,null);assert.equal(state.ball.x,1);}
  else{
   after=true;assert.equal(actor.motion.stroke,'finesse');
   assert.ok(Math.abs(actor.motion.elapsed-(t-1.04))<1e-6);
   assert.ok(Math.abs(state.ball.x-(1+1.6*(t-1.04)/.06))<1e-6);
  }
 }
 assert.ok(before&&after);
});

test('receiving snapshots no longer allocates two per-player pose arrays, while new preparation previews remain intact',()=>{
 const game=createFootballSimulation({humanTeams:['home','away']});for(let i=0;i<210;i++)game.update(1/60);const listeners=new Set(),session={team:'home',opponent:'dortmund',connection:'connected',room:{started:true,ended:false},packet:packOnlineState(game.state,1),subscribe(f){listeners.add(f);return()=>listeners.delete(f);},sendInput(){return 1;},send(){return true;},leave(){}};const client=createOnlineSimulation(session),original=Array.prototype.map;let poseMaps=0;
 try{Array.prototype.map=function(...args){if(this===client.state.players)poseMaps++;return original.apply(this,args);};for(let i=0;i<20;i++){game.update(.05,{home:{x:1,z:0}});session.packet=packOnlineState(game.state,i+2);session.packet.previews.home.preparedAction={type:'pass',remaining:.12};for(const f of listeners)f();assert.deepEqual(client.state.preparedAction,{type:'pass',remaining:.12});assert.deepEqual(client.state.score,session.packet.score);assert.equal(client.state.elapsed,session.packet.elapsed);}}finally{Array.prototype.map=original;client.dispose();}
 assert.equal(poseMaps,0);
});
