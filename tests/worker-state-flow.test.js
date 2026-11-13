import assert from 'node:assert/strict';
import test from 'node:test';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {defaultSelection} from '../dist/football-squads.js';
import {passOption} from '../dist/football-tactics.js';
import {createOnlineSimulation} from '../dist/online-client.js';
import {packOnlineState} from '../dist/online-protocol.js';
import {decodeOnlineDelta} from '../dist/online-state-delta.js';
import {FootballRoom} from '../multiplayer/worker.js';

function socket(team,{stateDelta=true,stateFlow=true}={}){
 return{team,readyState:1,frames:[],deserializeAttachment(){return{team,stateDelta,stateFlow};},
  send(value){const frame=JSON.parse(value);if(frame.type==='state')this.frames.push(frame);},
  close(){this.readyState=3;}};
}

async function fixture(t,{legacy=false,saved}={}){
 let now=1_000_000;
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'setInterval',callback=>({callback}));
 t.mock.method(globalThis,'clearInterval',()=>{});
 const rules={mode:'league',duration:180},opponent='madrid';
 const lineups={home:defaultSelection(),away:defaultSelection('away',opponent)};
 const simulation=createFootballSimulation({duration:180,rules,opponent,humanTeams:['home','away'],selections:lineups,seed:972});
 while(simulation.state.phase!=='playing')simulation.update(.05,{});
 const data=saved||new Map([
  ['room',{code:'ABCD2345',protocol:2,opponent,rules,lineups,intervalReady:{},seed:972,
   ready:{home:true,away:true},pauses:{home:false,away:false},expiresAt:now+1_800_000,started:true,ended:false,disconnectAt:null}],
  ['simulation',simulation.checkpoint()]
 ]);
 const home=socket('home'),away=socket('away',{stateDelta:!legacy,stateFlow:!legacy});
 const ctx={storage:{get:async key=>structuredClone(data.get(key)),
  put:async fields=>{for(const [key,value] of Object.entries(fields))data.set(key,structuredClone(value));},
  setAlarm:async()=>{},deleteAll:async()=>data.clear()},getWebSockets:()=>[home,away],
  blockConcurrencyWhile(callback){this.ready=callback();}};
 const room=new FootballRoom(ctx);await ctx.ready;
 const message=(ws,packet)=>room.webSocketMessage(ws,JSON.stringify(packet));
 const tick=()=>{now+=50;room.timer?.callback();};
 return{room,home,away,data,tick,message,
  receipt:(ws,seq)=>message(ws,{type:'snapshot-receipt',seq})};
}

const seq=frame=>frame.state?.seq??frame.delta?.seq;
function readFrames(frames){
 let snapshot=null;
 return frames.map(frame=>{
  snapshot=frame.state??decodeOnlineDelta(snapshot,frame.delta);
  assert.ok(snapshot,'every frame must decode against the preceding frame delivered to this seat');
  return snapshot;
 });
}

test('an unacknowledged seat skips routine ticks while a healthy seat continues and the authority advances',async t=>{
 const f=await fixture(t);
 for(let index=0;index<27;index++){
  f.tick();
  if(index%2===1)await f.receipt(f.away,seq(f.away.frames.at(-1)));
 }
 assert.equal(f.home.frames.length,10);
 assert.equal(f.away.frames.length,27);
 assert.ok(f.room.sim.state.elapsed>=1.25);
 const skipped=seq(f.away.frames.at(-1));
 await f.receipt(f.home,skipped);
 f.tick();
 assert.equal(f.home.frames.length,10,'another seat’s sequence cannot release this seat’s window');
 const lastHome=seq(f.home.frames.at(-1));
 await f.receipt(f.home,lastHome);
 f.tick();
 const resumed=f.home.frames.at(-1),current=f.away.frames.at(-1);
 assert.ok(seq(resumed)>lastHome+1,'obsolete states are skipped instead of queued');
 assert.equal(resumed.delta?.base,lastHome);
 assert.equal(seq(resumed),seq(current));
 const home=readFrames(f.home.frames).at(-1),away=readFrames(f.away.frames).at(-1);
 assert.deepEqual(home.ball,away.ball);
 assert.deepEqual(home.players,away.players);
});

test('an accepted kick bypasses a saturated window and an invalid kick cannot flood it',async t=>{
 const f=await fixture(t,{legacy:true});
 for(let index=0;index<10;index++)f.tick();
 await f.message(f.away,{type:'action',action:'shoot',power:.45});
 assert.equal(f.home.frames.length,10,'rejected requests do not force extra frames for the congested seat');
 assert.equal(f.away.frames.length,11,'legacy seat still receives the normal full-state response');
 const count=f.room.sim.state.eventCount;
 await f.message(f.home,{type:'action',action:'shoot',power:.45});
 assert.equal(f.home.frames.length,11);
 assert.equal(f.away.frames.length,12);
 const state=readFrames(f.home.frames).at(-1);
 assert.ok(state.events.some(event=>event.id>count&&event.team==='home'&&event.type==='shot'));
 assert.equal(seq(f.home.frames.at(-1)),seq(f.away.frames.at(-1)));
 assert.ok(f.away.frames.every(frame=>Object.hasOwn(frame,'state')));
});

test('Worker passes only aimed through hints from the seat’s current possessor to an active teammate',async t=>{
 const f=await fixture(t),simulation=f.room.sim,{state}=simulation;
 const action=t.mock.method(simulation,'action',()=>false);
 const home=state.controlledIds.home,away=state.controlledIds.away;
 const homeTarget=state.players.find(p=>p.team==='home'&&!p.keeper&&p.id!==home);
 const awayTarget=state.players.find(p=>p.team==='away'&&!p.keeper&&p.id!==away);
 const homeKeeper=state.players.find(p=>p.team==='home'&&p.keeper);
 const directed={type:'action',action:'through',direction:{x:1,z:0},fromId:home,targetId:homeTarget.id};
 async function sent(socket,packet,owner=home){
  f.tick();f.tick();
  state.ball.ownerId=owner;
  const count=action.mock.callCount();
  await f.message(socket,packet);
  assert.equal(action.mock.callCount(),count+1,'the action still reaches the simulation if its hint is discarded');
  const [type,options,team]=action.mock.calls.at(-1).arguments;
  assert.equal(type,packet.action);
  assert.equal(team,socket.team);
  return options.targetId;
 }
 assert.equal(await sent(f.home,directed),homeTarget.id);
 assert.equal(await sent(f.away,{...directed,fromId:away,targetId:awayTarget.id},away),awayTarget.id);
 for(const packet of [
  {...directed,targetId:awayTarget.id},
  {...directed,targetId:home},
  {...directed,targetId:homeKeeper.id},
  {...directed,targetId:'home-100'},
  {...directed,targetId:{id:homeTarget.id}},
  {...directed,fromId:homeTarget.id},
  {...directed,direction:{x:.15,z:0}},
  {...directed,action:'pass'},
 ])assert.equal(await sent(f.home,packet),undefined);
 assert.equal(await sent(f.home,directed,away),undefined);
 homeTarget.dismissed=true;
 assert.equal(await sent(f.home,directed),undefined);
});

test('both online seats retain an open winger who eases off during a 300 ms round trip',async t=>{
 const f=await fixture(t),{state}=f.room.sim;
 for(const team of ['home','away']){
  const passer=state.players.find(p=>p.id===state.controlledIds[team]),sign=passer.attackSign;
  const inside=state.players.find(p=>p.id===team+'-8'),winger=state.players.find(p=>p.id===team+'-9');
  for(const p of state.players)Object.assign(p,{x:-32,z:-sign*43,vx:0,vz:0});
  Object.assign(passer,{x:0,z:0});
  Object.assign(inside,{x:22,z:sign});
  Object.assign(winger,{x:24,z:sign*3.5,vx:3.7,vz:sign*2.5});
  Object.assign(state.ball,{x:.6,y:.11,z:0,vx:0,vy:0,vz:0,ownerId:passer.id,targetId:null});
  let now=0,packet,receive;
  const session={team,opponent:'madrid',connection:'connected',latency:300,room:{started:true,ended:false},
   packet:structuredClone(packOnlineState(state,1)),subscribe(listener){receive=listener;return()=>{};},sendInput:()=>1,leave(){},
   send(message){packet=message;return true;}};
  const client=createOnlineSimulation(session,{}, {now:()=>now});
  const oneWay=()=>{for(let frame=0;frame<9;frame++){now+=1000/60;client.update(1/60,{});}};
  try{
   const input={direction:{x:1,z:0},power:.85};
   assert.ok(client.action('through',input));
   assert.equal(packet.targetId,winger.id);
   oneWay();
   assert.ok(client.state.kickPresentation.x>state.ball.x+.5);
   assert.equal(client.state.ball.ownerId,passer.id);
   winger.vz=sign*.05;
   const unhinted=passOption(state.players,passer,state.ball,{...input,type:'through'});
   assert.equal(unhinted.player.id,inside.id,'choosing again after the runner slows would send it inside');
   await f.message(f[team],packet);
   assert.equal(state.ball.ownerId,null);
   assert.equal(state.ball.targetId,winger.id);
   session.packet=structuredClone(packOnlineState(state,2));
   oneWay();
   receive();
   assert.equal(client.state.kickPresentation.status,'confirmed');
   assert.equal(client.state.ball.targetId,winger.id);
  }finally{client.dispose();}
 }
});

test('recovery sends a bounded full snapshot when the client cannot decode the delta chain',async t=>{
 const f=await fixture(t,{legacy:true});
 for(let index=0;index<29;index++)f.tick();
 assert.equal(f.home.frames.length,10);
 f.tick();
 const recovery=f.home.frames.at(-1);
 assert.equal(f.home.frames.length,11);
 assert.ok(recovery.state?.teamSheets&&recovery.state?.discipline,'a fresh client can decode recovery by itself');
 assert.ok(seq(recovery)>seq(f.home.frames.at(-2))+1);
 for(let index=0;index<20;index++)f.tick();
 assert.equal(f.home.frames.length,11,'recovery is throttled if nothing can be acknowledged');
 await f.receipt(f.home,seq(recovery));
 f.tick();
 const resumed=f.home.frames.at(-1);
 assert.equal(resumed.delta?.base,seq(recovery));
 assert.ok(decodeOnlineDelta(recovery.state,resumed.delta));
 assert.equal(f.away.frames.length,51);
});

test('a replaced socket cannot acknowledge the new lane and a restored room starts from a full snapshot',async t=>{
 const f=await fixture(t);
 for(let index=0;index<10;index++)f.tick();
 const old=f.home,replacement=socket('home');
 f.room.setSocket('home',replacement,true,true);
 f.room.broadcast(true);
 for(let index=0;index<9;index++)f.tick();
 const last=seq(replacement.frames.at(-1));
 await f.receipt(old,last);
 await f.room.disconnected(old);
 f.tick();
 assert.equal(replacement.frames.length,10);
 await f.receipt(replacement,last);
 f.tick();
 assert.equal(replacement.frames.length,11);
 await f.room.persist();
 const saved=new Map([...f.data].map(([key,value])=>[key,structuredClone(value)]));
 const restored=await fixture(t,{saved});
 restored.tick();
 const frame=restored.home.frames[0];
 assert.equal(frame.state?.seq,1);
 assert.ok(frame.state?.teamSheets);
 assert.equal(restored.room.snapshotSeats.get('home').stateFlow,true);
 restored.room.sim.reset();
 restored.room.broadcast();
 assert.ok(restored.home.frames.at(-1).state?.teamSheets,'a rollback sends a full epoch reset');
});
