import assert from 'node:assert/strict';
import test from 'node:test';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {createOnlineSimulation} from '../dist/online-client.js';
import {packOnlineState} from '../dist/online-protocol.js';

const direction={x:.8,z:-.6};
const displacement=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

function fixture(team='home'){
 const game=createFootballSimulation({humanTeams:['home','away'],opponent:'madrid',seed:972,controlMode:'manual'});
 for(let i=0;i<200;i++)game.update(1/60);
 const server=game.state,player=server.players.find(p=>p.id===server.controlledIds[team]),sign=player.attackSign;
 for(const p of server.players)if(p.team!==team)Object.assign(p,{x:-18,z:sign*34,vx:0,vz:0});
 Object.assign(player,{x:0,z:sign*18,vx:0,vz:0,yaw:sign<0?Math.PI:0});
 Object.assign(server.ball,{x:0,y:.11,z:sign*18.5,vx:0,vy:0,vz:0,ownerId:player.id,targetId:null});
 let clock=0,packetSequence=0,inputSequence=0,listener;
 const snapshot=()=>JSON.parse(JSON.stringify(packOnlineState(server,++packetSequence)));
 const sent=[],session={team,opponent:'madrid',connection:'connected',latency:300,room:{started:true,ended:false},packet:snapshot(),
  subscribe(fn){listener=fn;return()=>{};},sendInput(){return ++inputSequence;},send(packet){sent.push(packet);return true;},leave(){}};
 const client=createOnlineSimulation(session,{controlMode:'manual'},{now:()=>clock});
 const local=client.state,actor=local.players.find(p=>p.id===player.id);
 return{game,server,player,client,local,actor,session,sent,
  arrive(){session.packet=snapshot();listener();},
  setClock(at){clock=at;},
  frame(ms=1000/60){clock+=ms;client.update(ms/1000,{});},
  disconnect(){session.connection='reconnecting';listener();}};
}

for(const type of ['pass','through','shoot'])for(const team of ['home','away']){
 test(`${team} ${type} shows a separate ball launch on the next frame while its result stays server-owned`,()=>{
  const f=fixture(team),{client,local,actor,server}=f,initial={...local.ball};
  const stats=structuredClone(local.stats),elapsed=local.elapsed,events=local.eventCount;
  try{
   assert.equal(client.action(type,{direction,power:.67}),true);
   const display=local.kickPresentation;
   assert.equal(display?.status,'pending');
   assert.equal(display.type,type);
   assert.equal(display.playerId,actor.id);
   assert.deepEqual(local.ball,initial);
   assert.deepEqual([actor.motion.contactX,actor.motion.contactY,actor.motion.contactZ],[display.x,display.y,display.z]);
   f.frame();
   assert.ok(displacement(display,initial)>.08);
   assert.equal(local.ball.ownerId,server.ball.ownerId);
   assert.equal(local.eventCount,events);
   assert.equal(local.elapsed,elapsed);
   assert.deepEqual(local.stats,stats);
   assert.deepEqual(local.score,server.score);
   assert.equal(local.lastShot,server.lastShot);
   assert.deepEqual(local.kickAudioEventIds,[]);
  }finally{client.dispose();}
 });
}

test('online wide through balls use the latest runner and velocity before render interpolation catches up',()=>{
 for(const team of ['home','away']){
  const f=fixture(team),{game,server,client,local,player}=f,sign=player.attackSign;
  const nearId=team+'-8',wideId=team+'-9';
  const actor=(state,id)=>state.players.find(p=>p.id===id);
  try{
   for(const p of server.players)Object.assign(p,{x:-32,z:-sign*43,vx:0,vz:0});
   Object.assign(player,{x:0,z:0});
   Object.assign(server.ball,{x:.6,y:.11,z:0});
   Object.assign(actor(server,nearId),{x:5,z:sign*5});
   Object.assign(actor(server,wideId),{x:20,z:sign*3,vx:3.7,vz:2.5*sign});
   f.arrive();
   // The render buffer can still be showing the wingers before they switched lanes.
   Object.assign(actor(local,nearId),{x:9,z:-sign*2});
   Object.assign(actor(local,wideId),{x:10,z:sign*16,vx:0,vz:0});
   const right={x:1,z:0},power=.85;
   assert.ok(client.action('through',{direction:right,power}));
   assert.ok(game.action('through',{direction:right,power},team));
   const display=local.kickPresentation;
   assert.equal(server.ball.targetId,wideId);
   assert.ok(display.vx>10&&display.vz*sign>2,'display leads the current winger in the running direction');
   for(const key of ['vx','vy','vz'])assert.ok(Math.abs(display[key]-server.ball[key])<.005,key);
   assert.equal(local.ball.ownerId,player.id,'visual launch does not change possession');
  }finally{client.dispose();}
 }
});

test('confirmation preserves contact progress even after the control cursor changes and deduplicates only its exact event',()=>{
 const f=fixture(),{game,client,local,actor,server}=f;
 try{
  assert.equal(client.action('shoot',{direction,power:.68}),true);
  const display=local.kickPresentation,id=actor.motion.id;
  for(let frame=0;frame<17;frame++)f.frame();
  const progress=actor.motion.elapsed,point={...display};
  assert.equal(game.action('shoot',{direction,power:.68}),true);
  server.controlledIds.home='home-2';
  f.setClock(300);f.arrive();
  const event=server.events.findLast(e=>e.type==='shot');
  assert.equal(local.kickPresentation.status,'confirmed');
  assert.equal(local.kickPresentation.id,display.id);
  assert.deepEqual(local.kickAudioEventIds,[event.id]);
  assert.equal(local.controlledId,'home-2');
  assert.equal(local.ball.ownerId,null);
  assert.equal(local.stats.home.shots,1);
  f.frame();
  assert.equal(actor.motion.id,id);
  assert.ok(actor.motion.elapsed>=progress);
  assert.equal(actor.motion.predicted,undefined);
  assert.ok(displacement(local.kickPresentation,point)<.5);
  f.arrive();
  assert.deepEqual(local.kickAudioEventIds,[event.id]);
  for(let frame=0;frame<26;frame++){
   game.update(1/60);
   if(frame%3===0)f.arrive();
   f.frame();
  }
  assert.equal(local.kickPresentation,null);
  assert.ok(!actor.motion||actor.motion.id!==id);
 }finally{client.dispose();}
});

test('late confirmation still deduplicates audio after an unconfirmed launch has expired',()=>{
 const f=fixture(),{client,local,game,server,sent}=f;
 try{
  client.action('pass',{direction});
  for(let frame=0;frame<29;frame++)f.frame();
  assert.equal(local.kickPresentation,null);
  assert.equal(local.ball.ownerId,f.player.id);
  f.arrive();
  client.action('pass',{direction});
  assert.equal(local.kickPresentation,null,'the earlier action still awaits confirmation');
  assert.equal(sent.filter(packet=>packet.type==='action').length,2,'a repeated action is still sent to the server');
  assert.equal(game.action('pass',{direction}),true);
  f.arrive();
  assert.equal(local.kickPresentation,null,'an expired visual must not be restarted');
  assert.deepEqual(local.kickAudioEventIds,[server.events.findLast(e=>e.type==='pass').id]);
  assert.equal(local.stats.home.passes,1);
 }finally{client.dispose();}
});

test('an acknowledgment before the first draw joins the authoritative ball immediately',()=>{
 const f=fixture(),{client,local,game,server,actor}=f;
 try{
  f.session.latency=10;
  client.action('pass',{direction});
  const id=actor.motion.id;
  assert.equal(game.action('pass',{direction}),true);
  f.setClock(10);f.arrive();
  assert.equal(local.kickPresentation,null);
  assert.equal(local.ball.ownerId,null);
  assert.deepEqual(local.kickAudioEventIds,[server.events.findLast(e=>e.type==='pass').id]);
  f.frame();
  assert.equal(actor.motion.id,id);
  assert.equal(actor.motion.predicted,undefined);
 }finally{client.dispose();}
});

test('authoritative possession change without a kick event rejects the predicted flight',()=>{
 const f=fixture(),{client,local,server}=f;
 try{
  client.action('pass',{direction});
  f.frame(80);
  server.ball.ownerId='away-1';
  f.arrive();
  assert.equal(local.kickPresentation.status,'rejected');
  assert.equal(local.ball.ownerId,'away-1');
  f.frame(100);
  assert.equal(local.kickPresentation,null);
  assert.deepEqual(local.kickAudioEventIds,[]);
  assert.equal(local.stats.home.passes,0);
 }finally{client.dispose();}
});

test('stale authority, a close defender, a penalty or an unowned ball cannot create contact presentation',()=>{
 for(const setup of [
  f=>f.setClock(320),
  f=>{Object.assign(f.server.players[12],{x:.5,z:f.player.z});f.arrive();},
  f=>{f.server.setPiece={type:'penalty',keeper:'away-0',taker:f.player.id,stage:'ready',goalZ:-52.5};f.arrive();},
  f=>{f.server.ball.ownerId=null;f.server.ball.targetId=f.player.id;f.arrive();}
 ]){
  const f=fixture();
  try{
   setup(f);
   assert.equal(f.client.action('shoot',{direction,power:.6}),true);
   assert.equal(f.local.kickPresentation,null);
   assert.ok(!Number.isFinite(f.actor.motion?.contactX));
   assert.deepEqual(f.local.kickAudioEventIds,[]);
  }finally{f.client.dispose();}
 }
});

test('local pause, halftime and a lost link all clear the provisional ball and stroke immediately',()=>{
 for(const stop of [
  f=>f.client.setPaused(true),
  f=>{f.server.phase='interval';f.server.paused=true;f.arrive();},
  f=>f.disconnect()
 ]){
  const f=fixture();
  try{
   f.client.action('pass',{direction});f.frame();
   assert.equal(f.local.kickPresentation.status,'pending');
   assert.equal(f.actor.motion.predicted,true);
   stop(f);
   assert.equal(f.local.kickPresentation,null);
   assert.equal(f.actor.motion?.predicted,undefined);
   assert.deepEqual(f.local.kickAudioEventIds,[]);
  }finally{f.client.dispose();}
 }
});
