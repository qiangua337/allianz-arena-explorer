import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineSimulation} from '../dist/online-client.js';
import {createOnlinePrediction} from '../dist/online-prediction.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState} from '../dist/online-protocol.js';
import {createFramePacer} from '../dist/frame-pacing.js';

function fixture(team='home',timing){
 const sim=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual',opponent:'madrid'});for(let i=0;i<200;i++)sim.update(1/60);
 const listeners=new Set(),sent=[];let sequence=0,packetSequence=0;
 const session={team,opponent:'madrid',connection:'connected',latency:300,room:{started:true,ended:false},packet:packOnlineState(sim.state,++packetSequence),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},sendInput(input){sent.push({...input,seq:++sequence});return sequence;},send(packet){sent.push(packet);return true;},setReady(){},leave(){}};
 const client=createOnlineSimulation(session,{controlMode:'manual'},timing);
 return{sim,session,client,sent,deliver(ack=0){session.packet=packOnlineState(sim.state,++packetSequence,{[team]:ack});for(const listener of listeners)listener();}};
}
test('touch intent is transmitted while rendering is stalled, with a bound on coalesced moves',t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});
 const {sim,client,sent,deliver}=fixture('home',{now:Date.now});
 try{
  client.flushInput({x:1});
  assert.equal(sent[0].x,1,'first touch goes out without update()');
  client.flushInput({z:-1});
  client.flushInput({z:1,sprint:true});
  client.action('pass',{direction:{z:1}});
  assert.equal(sent[1].type,'action','pass does not wait for the next input slot');
  assert.equal(sent[1].direction.z,1);
  t.mock.timers.tick(16);
  assert.equal(sent.length,2);
  t.mock.timers.tick(1);
  assert.equal(sent.length,3);
  assert.equal(sent[2].z,1,'only the newest queued direction goes out');
  assert.equal(sent[2].sprint,true);
  client.flushInput({x:-1});
  sim.setPaused(true);deliver();
  t.mock.timers.tick(20);
  assert.equal(sent.length,3,'a queued touch cannot cross a server pause');
  sim.setPaused(false);deliver();
  client.flushInput({x:-1});
  assert.equal(sent[3].x,-1);
  client.flushInput({x:1});
  client.clearInput();
  assert.equal(sent[4].x,0,'focus loss sends neutral immediately');
  t.mock.timers.tick(20);
  assert.equal(sent.length,5,'a queued touch cannot undo focus loss');
 }finally{client.dispose();}
});
test('a stopped stick sends sequenced neutral immediately while further releases obey a rate budget',t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});
 const {client,sent}=fixture('home',{now:Date.now});
 try{
  client.flushInput({x:1});
  t.mock.timers.tick(5);
  client.flushInput({});
  assert.deepEqual(sent.map(({x,seq})=>[x,seq]),[[1,1],[0,2]],'the stick release does not wait for a frame or timer');
  t.mock.timers.tick(17);
  client.flushInput({x:-1});
  t.mock.timers.tick(5);
  client.flushInput({});
  assert.equal(sent.length,3,'a second rapid release does not bypass the same budget');
  t.mock.timers.tick(12);
  assert.deepEqual(sent.map(({x,seq})=>[x,seq]),[[1,1],[0,2],[-1,3],[0,4]],'the deferred stop still replaces the last sent direction');
  const start=sent.length;
  for(let i=0;i<1000;i++){
   t.mock.timers.tick(1);
   client.flushInput(i%25<17?{x:1}:{});
  }
  assert.ok(sent.length-start<=71,'rapid movements leave room for action and heartbeat packets');
 }finally{client.dispose();}
});
test('a 30 fps client shows a short press and release on its next frame without backdating the input',()=>{
 let clock=0;
 const {client,sent}=fixture('home',{now:()=>clock});
 const player=client.state.players[1];
 try{
  clock=1000/30;client.update(1/30,{});
  const start=player.x,elapsed=client.state.elapsed;
  clock=52;client.flushInput({x:1});
  assert.ok(Math.abs(player.x-start)<.001,'a late touch cannot move the player over the already elapsed interval');
  clock=62;client.flushInput({});
  clock=2000/30;client.update(1/30,{});
  assert.deepEqual(sent.map(({x,seq})=>[x,seq]),[[0,1],[1,2],[0,3]],'both directions were sent before the next draw');
  assert.ok(player.x-start>.005&&player.x-start<.015,'the first draw includes the ten-millisecond movement pulse');
  assert.ok(player.vx>0&&player.vx<.65,'the stick was released before the frame');
  assert.equal(client.state.elapsed,elapsed,'prediction cannot advance the match clock');
 }finally{client.dispose();}
});
test('an acknowledgment cannot consume prediction sampled before its next movement packet was sent',()=>{
 const {sim,client}=fixture();
 const state=client.state,authoritative=structuredClone(state),prediction=createOnlinePrediction('home');
 try{
  prediction.receive(authoritative);
  prediction.update(state,1/60,{x:0,z:0},4);
  prediction.update(state,1/60,{x:1,z:0},Infinity);
  prediction.update(state,1/60,{x:-1,z:0},4);
  prediction.receive(authoritative,4);
  assert.ok(Math.abs(prediction.pendingSeconds-2/60)<1e-9);
  prediction.sequencePending(5);
  prediction.receive(authoritative,4);
  assert.ok(Math.abs(prediction.pendingSeconds-2/60)<1e-9);
  prediction.receive(authoritative,5);
  assert.ok(prediction.pendingSeconds<1e-9);
  assert.equal(state.ball.ownerId,sim.state.ball.ownerId);
 }finally{client.dispose();}
});
test('300 ms network latency does not hold local movement, dribbling or input submission until a server reply',()=>{
 const {sim,client,sent}=fixture(),before={...client.state.players[1]},ball={...client.state.ball},elapsed=client.state.elapsed;
 client.update(1/60,{x:1,z:0});assert.ok(client.state.players[1].x>before.x+.005);assert.equal(sent[0].seq,1);assert.equal(sent[0].x,1);assert.notDeepEqual(client.state.ball,ball);
 for(let i=0;i<17;i++)client.update(1/60,{x:1,z:0});assert.ok(client.state.players[1].x>before.x+.8);assert.equal(client.state.elapsed,elapsed);assert.equal(client.state.score.home,0);assert.equal(sim.state.players[1].x,before.x);assert.equal(client.state.ball.ownerId,sim.state.ball.ownerId);client.dispose();
});
test('acknowledged movement is removed from prediction and a correction is blended without moving remote players locally',()=>{
 const {sim,client,deliver}=fixture('away'),start=client.state.players[12].x;for(let i=0;i<18;i++)client.update(1/60,{x:-1,z:0});const before=client.state.players[12].x;
 // The first half of these commands have reached the server; the rest remain in flight.
 for(let i=0;i<9;i++)sim.update(1/60,{away:{x:-1,z:0}});deliver(3);client.update(1/60,{x:-1,z:0});assert.ok(Math.abs(client.state.players[12].x-before)<.4);assert.ok(client.state.players[12].x<start-.8);assert.ok(client.state.predictionSeconds<.21);
 const remote=client.state.players[1];assert.equal(remote.x,sim.state.players[1].x);client.dispose();
});
test('an authoritative cursor change uses the last displayed local pose for the handoff',()=>{
 const {sim,client,deliver}=fixture();
 const old=client.state.players[1],remote=client.state.players[12];
 try{
  for(let i=1;i<=6;i++){
   sim.state.time+=.05;sim.state.players[12].x=i*.25;sim.state.players[12].vx=5;
   deliver();
   for(let frame=0;frame<3;frame++)client.update(1/60,{x:1});
  }
  const localBefore=old.x,remoteBefore=remote.x;
  assert.ok(localBefore>sim.state.players[1].x+.6,'the old local actor has pending movement to reconcile');
  sim.state.controlledIds.home='home-2';
  deliver();
  client.update(1/60,{});
  assert.equal(client.state.controlledId,'home-2');
  assert.ok(Math.abs(old.x-localBefore)<1e-9,'the handoff uses the position before applying the server packet');
  assert.ok(remote.x-remoteBefore>=0&&remote.x-remoteBefore<.15,'an unrelated actor keeps its earlier render timeline');
  assert.equal(client.state.ball.ownerId,sim.state.ball.ownerId);
 }finally{client.dispose();}
});
test('a server pause or lost connection cancels pending prediction, and recovery accepts the authoritative position',()=>{
 const {sim,session,client,deliver}=fixture();for(let i=0;i<12;i++)client.update(1/60,{x:1,z:0});sim.setPaused(true);deliver(4);const frozen={...client.state.ball},x=client.state.players[1].x;for(let i=0;i<30;i++)client.update(1/60,{x:1,z:0});assert.equal(client.state.players[1].x,x);assert.deepEqual(client.state.ball,frozen);assert.equal(client.state.predictionSeconds,0);
 sim.setPaused(false);session.connection='reconnecting';deliver(4);assert.equal(client.state.paused,true);assert.equal(client.action('shoot'),false);session.connection='connected';deliver(4);client.update(1/60,{x:-1,z:0});assert.ok(client.state.players[1].x<x);client.dispose();
});
test('local kick animation gives feedback without inventing ball possession, shots or goals',()=>{
 const {client,sim,deliver}=fixture();
 const stats=structuredClone(client.state.stats),owner=client.state.ball.ownerId,elapsed=client.state.elapsed;
 client.setShotKind('finesse');assert.equal(client.action('shoot',{power:.6}),true);client.update(1/60,{});
 const pending=client.state.players[1].motion;
 assert.equal(pending.type,'shoot');assert.equal(pending.predicted,true);assert.equal(pending.stroke,'finesse');
 assert.deepEqual(client.state.stats,stats);assert.equal(client.state.ball.ownerId,owner);assert.equal(client.state.elapsed,elapsed);assert.deepEqual(client.state.score,{home:0,away:0});
 assert.ok(sim.action('shoot',{power:.6,kind:'finesse'}));deliver(1);client.update(1/60,{});
 assert.equal(client.state.players[1].motion.predicted,undefined);assert.equal(client.state.players[1].motion.stroke,'finesse');
 assert.equal(client.state.ball.ownerId,null);client.dispose();
});
test('a stalled socket cannot keep predicting a player across the pitch indefinitely',()=>{
 const {client}=fixture('away');for(let i=0;i<60;i++)client.update(1/60,{x:1,z:0});const x=client.state.players[12].x;for(let i=0;i<120;i++)client.update(1/60,{x:1,z:0});assert.equal(client.state.players[12].x,x);assert.ok(client.state.predictionSeconds<=.6);client.dispose();
});
test('a 30 fps mobile budget stays at 30 on irregular 60 Hz, 59 Hz and 120 Hz displays',()=>{
 for(const hz of [59,60,120]){const pacer=createFramePacer();let count=0;for(let i=0;i<hz*5;i++){const jitter=Math.sin(i*1.7)*.0005;if(pacer.ready(i/hz+jitter,30))count++;}assert.ok(count>=149&&count<=151,`${hz} Hz produced ${count} frames`);}
});
