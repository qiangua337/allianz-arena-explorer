import test from 'node:test';
import assert from 'node:assert/strict';
import {FootballRoom} from '../multiplayer/worker.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {defaultSelection} from '../dist/football-squads.js';

async function fixture(t,{saved=null,sockets=true,startTime=1_000_000}={}){
 let now=startTime;const timers=new Set();
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'setInterval',(fn,period)=>{const timer={fn,period,active:true};timers.add(timer);return timer;});
 t.mock.method(globalThis,'clearInterval',timer=>{if(timer)timer.active=false;});
 const socket=team=>({team,readyState:1,lastState:null,lastResult:null,deserializeAttachment(){return{team};},send(text){const p=JSON.parse(text);if(p.type==='state')this.lastState=p;if(p.type==='result')this.lastResult=p;},close(){this.readyState=3;}});
 const home=socket('home'),away=socket('away'),rules={mode:'league',duration:180},lineups={home:defaultSelection(),away:defaultSelection('away','madrid')};
 const initial=createFootballSimulation({duration:180,rules,opponent:'madrid',humanTeams:['home','away'],selections:lineups,seed:972});
 const data=new Map(saved||[['room',{code:'ABCD2345',protocol:2,opponent:'madrid',rules,lineups,intervalReady:{},seed:972,ready:{home:true,away:true},pauses:{home:false,away:false},expiresAt:now+1_800_000,started:true,ended:false,disconnectAt:null}],['simulation',initial.checkpoint()]]);
 const ctx={storage:{get:async k=>structuredClone(data.get(k)),put:async values=>{for(const[k,v]of Object.entries(values))data.set(k,structuredClone(v));},setAlarm:async()=>{},deleteAll:async()=>data.clear()},getWebSockets:()=>sockets?[home,away]:[],blockConcurrencyWhile(fn){this.ready=fn();}};
 const room=new FootballRoom(ctx);await ctx.ready;
 const message=(ws,p)=>room.webSocketMessage(ws,JSON.stringify(p));
 async function advance(ms,{callback=true,heartbeat=true}={}){now+=ms;if(heartbeat)for(const ws of[home,away])room.heartbeats[ws.team]=now;if(callback&&room.timer)room.timer.fn();}
 return{room,home,away,ctx,data,timers,message,advance,get now(){return now;},setNow(value){now=value;}};
}
async function interval(f){for(let i=0;i<2400&&f.room.sim.state.phase!=='interval';i++)await f.advance(50);assert.equal(f.room.sim.state.phase,'interval');assert.equal(f.room.sim.state.elapsed,90);}
async function continueBoth(f){await f.message(f.home,{type:'continue',id:1});assert.equal(f.room.sim.state.phase,'interval');await f.message(f.away,{type:'formation',formation:'442',id:2});await f.message(f.away,{type:'continue',id:3});assert.equal(f.room.sim.state.competition.period,2);assert.equal(f.room.sim.state.phase,'kickoff');assert.equal(f.room.sim.state.paused,false);}

test('real Worker second half retains delayed callback time instead of exceeding the 240 second completion deadline',async t=>{
 const f=await fixture(t);await interval(f);await continueBoth(f);const start=f.now;
 for(let i=0;i<480&&f.room.sim.state.phase!=='fulltime';i++)await f.advance(500);
 assert.equal(f.room.sim.state.phase,'fulltime',`elapsed=${f.room.sim.state.elapsed}, second-half wall=${(f.now-start)/1000}s`);
 assert.equal(f.room.sim.state.elapsed,180);assert.ok(f.now-start<100_000,'a 90s half plus kickoff stays close to actual wall time');t.diagnostic(`500ms callback second half completed in ${(f.now-start)/1000}s wall time, elapsed=${f.room.sim.state.elapsed}`);
});

test('a live heartbeat repairs a stalled callback, old queued ticks cannot double-run and catch-up work stays bounded',async t=>{
 const f=await fixture(t);for(let i=0;i<80;i++)await f.advance(50);const time=f.room.sim.state.time,old=f.room.timer;
 await f.advance(2000,{callback:false});assert.equal(f.room.sim.state.time,time);await f.message(f.home,{type:'ping',at:f.now});
 assert.notEqual(f.room.timer,old);assert.equal(old.active,false);assert.equal(f.room.tickRecoveries,1);assert.equal(f.room.pendingTick,2);old.fn();assert.equal(f.room.sim.state.time,time);
 let updateCalls=0,maxAdvance=0;const update=f.room.sim.update;f.room.sim.update=(dt,...args)=>{updateCalls++;maxAdvance=Math.max(maxAdvance,dt);return update(dt,...args);};
 await f.advance(50);assert.equal(updateCalls,2);assert.ok(maxAdvance<=.25);assert.ok(Math.abs(f.room.sim.state.time-time-.5)<1e-8);assert.ok(Math.abs(f.room.pendingTick-1.55)<1e-8);
 for(let i=0;i<4;i++)await f.advance(50);assert.ok(Math.abs(f.room.sim.state.time-time-2.25)<1e-8);assert.ok(f.room.pendingTick<1e-8);assert.deepEqual(f.home.lastState.state.serverClock,{lagMs:0,recoveries:1});
 f.room.stopTimer();assert.equal(f.room.running,true);await f.advance(1000,{callback:false});await f.message(f.away,{type:'ping',at:f.now});assert.notEqual(f.room.timer,null);assert.equal(f.room.tickRecoveries,2);
});

test('pause, disconnected time and halftime waiting never become simulation debt on resume',async t=>{
 const f=await fixture(t);for(let i=0;i<80;i++)await f.advance(50);const before=f.room.sim.state.time;
 await f.message(f.home,{type:'pause',paused:true});await f.advance(120000,{callback:false});await f.message(f.home,{type:'ping',at:f.now});assert.equal(f.room.timer,null);assert.equal(f.room.pendingTick,0);assert.equal(f.room.sim.state.time,before);
 await f.message(f.home,{type:'pause',paused:false});await f.advance(50);assert.ok(Math.abs(f.room.sim.state.time-before-.05)<1e-8);
 const beforeDisconnect=f.room.sim.state.time;await f.room.disconnected(f.away);await f.advance(20000,{callback:false});f.room.sockets.set('away',f.away);f.room.heartbeats.away=f.now;f.room.refresh();await f.advance(50);assert.ok(Math.abs(f.room.sim.state.time-beforeDisconnect-.05)<1e-8);assert.equal(f.room.pendingTick,0);
 await interval(f);const halfTime=f.room.sim.state.time;await f.advance(90000,{callback:false});await f.message(f.home,{type:'ping',at:f.now});assert.equal(f.room.timer,null);await continueBoth(f);await f.advance(50);assert.ok(Math.abs(f.room.sim.state.time-halfTime-.05)<1e-8);assert.equal(f.room.tickRecoveries,0);
});

test('Durable Object reconstruction restores the second half and starts a fresh clock without replaying unloaded time',async t=>{
 const f=await fixture(t);await interval(f);await continueBoth(f);for(let i=0;i<80;i++)await f.advance(50);await f.message(f.away,{type:'input',seq:42,x:1,z:0});await f.advance(50);assert.equal(f.away.lastState.state.ack.away,42);await f.room.persist();
 const checkpoint=f.room.sim.checkpoint(),saved=[...f.data.entries()].map(([k,v])=>[k,structuredClone(v)]),restored=await fixture(t,{saved,startTime:f.now+60000});assert.deepEqual(restored.room.sim.checkpoint(),checkpoint);assert.equal(restored.room.sim.state.competition.period,2);assert.equal(restored.room.pendingTick,0);assert.notEqual(restored.room.timer,null);
 await restored.message(restored.away,{type:'input',seq:43,x:1,z:0});await restored.advance(50);assert.equal(restored.away.lastState.state.ack.away,43);assert.ok(Math.abs(restored.room.sim.state.time-checkpoint.state.time-.05)<1e-8);assert.ok(restored.away.lastState.state.seq>0);assert.equal(restored.room.tickRecoveries,0);
});
