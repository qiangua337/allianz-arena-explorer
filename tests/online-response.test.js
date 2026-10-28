import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineSimulation} from '../dist/online-client.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState} from '../dist/online-protocol.js';
import {createFramePacer} from '../dist/frame-pacing.js';

function fixture(team='home'){
 const sim=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual',opponent:'madrid'});for(let i=0;i<200;i++)sim.update(1/60);
 const listeners=new Set(),sent=[];let sequence=0,packetSequence=0;
 const session={team,opponent:'madrid',connection:'connected',latency:300,room:{started:true,ended:false},packet:packOnlineState(sim.state,++packetSequence),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},sendInput(input){sent.push({...input,seq:++sequence});return sequence;},send(packet){sent.push(packet);return true;},setReady(){},leave(){}};
 const client=createOnlineSimulation(session,{controlMode:'manual'});
 return{sim,session,client,sent,deliver(ack=0){session.packet=packOnlineState(sim.state,++packetSequence,{[team]:ack});for(const listener of listeners)listener();}};
}
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
test('a server pause or lost connection cancels pending prediction, and recovery accepts the authoritative position',()=>{
 const {sim,session,client,deliver}=fixture();for(let i=0;i<12;i++)client.update(1/60,{x:1,z:0});sim.setPaused(true);deliver(4);const frozen={...client.state.ball},x=client.state.players[1].x;for(let i=0;i<30;i++)client.update(1/60,{x:1,z:0});assert.equal(client.state.players[1].x,x);assert.deepEqual(client.state.ball,frozen);assert.equal(client.state.predictionSeconds,0);
 sim.setPaused(false);session.connection='reconnecting';deliver(4);assert.equal(client.state.paused,true);assert.equal(client.action('shoot'),false);session.connection='connected';deliver(4);client.update(1/60,{x:-1,z:0});assert.ok(client.state.players[1].x<x);client.dispose();
});
test('local kick animation gives feedback without inventing ball possession, shots or goals',()=>{
 const {client}=fixture();const stats=structuredClone(client.state.stats),owner=client.state.ball.ownerId,elapsed=client.state.elapsed;assert.equal(client.action('shoot',{power:.6}),true);client.update(1/60,{});assert.equal(client.state.players[1].motion.type,'shoot');assert.deepEqual(client.state.stats,stats);assert.equal(client.state.ball.ownerId,owner);assert.equal(client.state.elapsed,elapsed);assert.deepEqual(client.state.score,{home:0,away:0});client.dispose();
});
test('a stalled socket cannot keep predicting a player across the pitch indefinitely',()=>{
 const {client}=fixture('away');for(let i=0;i<60;i++)client.update(1/60,{x:1,z:0});const x=client.state.players[12].x;for(let i=0;i<120;i++)client.update(1/60,{x:1,z:0});assert.equal(client.state.players[12].x,x);assert.ok(client.state.predictionSeconds<=.6);client.dispose();
});
test('a 30 fps mobile budget stays at 30 on irregular 60 Hz, 59 Hz and 120 Hz displays',()=>{
 for(const hz of [59,60,120]){const pacer=createFramePacer();let count=0;for(let i=0;i<hz*5;i++){const jitter=Math.sin(i*1.7)*.0005;if(pacer.ready(i/hz+jitter,30))count++;}assert.ok(count>=149&&count<=151,`${hz} Hz produced ${count} frames`);}
});
