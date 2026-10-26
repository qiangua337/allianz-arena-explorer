import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {cursorCandidate,tackleWindow,loadFootballSettings,saveFootballSettings,pressureTarget} from '../dist/football-assist.js';
const run=(g,t,input={})=>{for(let i=0;i<Math.round(t*60);i++)g.update(1/60,input);};
const p=(g,id=g.state.controlledId)=>g.state.players.find(p=>p.id===id);
function setup(mode='semi'){const g=createFootballSimulation({controlMode:mode});run(g,3.05);for(const q of g.state.players)if(q.id!==g.state.controlledId){q.x=q.team==='home'?28:-28;q.z=q.team==='home'?40:-40;q.decisionAt=q.tackleAt=1e6;}return g;}
test('all kick-off opponents start outside the centre circle, giving the user time to play',()=>{
 const g=createFootballSimulation();for(const q of g.state.players.filter(p=>p.team==='away'))assert.ok(Math.hypot(q.x,q.z)>=9.15,q.id);run(g,3.05);run(g,.4);assert.equal(g.state.ball.ownerId,'home-1');
});
test('manual retains the current player on reception, while semi automatically takes the receiving teammate',()=>{
 for(const mode of['manual','semi']){const g=setup(mode),receiver=p(g,'home-8');receiver.x=1;receiver.z=-10;assert.equal(g.action('pass'),true);const original=g.state.controlledId;Object.assign(g.state.ball,{x:receiver.x,z:receiver.z+.1,y:.12,vx:0,vz:0,vy:0});g.update(1/60);assert.equal(g.state.ball.ownerId,receiver.id);assert.equal(g.state.controlledId,mode==='manual'?original:receiver.id);}
});
test('assisted selects a closer defender while semi retains manual defence, with a lock after a human switch',()=>{
 for(const mode of['semi','assisted']){const g=setup(mode),user=p(g),defender=p(g,'home-2'),opponent=p(g,'away-1');user.x=0;user.z=24;defender.x=2;defender.z=-12;opponent.x=0;opponent.z=-15;opponent.yaw=0;Object.assign(g.state.ball,{ownerId:opponent.id,x:0,z:-14.4,y:.11});g.update(1/60);assert.equal(g.state.controlledId,mode==='assisted'?defender.id:user.id);}
 const g=setup('assisted');assert.equal(g.action('switch'),true);const locked=g.state.controlledId;Object.assign(g.state.ball,{ownerId:'away-1',x:-27,z:-40});run(g,.5);assert.equal(g.state.controlledId,locked);
});
test('held pressure closes toward the real ball and releasing it stops automatic movement',()=>{
 const g=setup(),user=p(g),opponent=p(g,'away-1');user.x=0;user.z=8;user.yaw=Math.PI;opponent.x=0;opponent.z=0;opponent.vx=opponent.vz=0;Object.assign(g.state.ball,{ownerId:opponent.id,x:0,z:.6,y:.11});const initial=Math.hypot(user.x-g.state.ball.x,user.z-g.state.ball.z);run(g,.7,{defend:true});assert.ok(Math.hypot(user.x-g.state.ball.x,user.z-g.state.ball.z)<initial-1.5);assert.equal(user.defending,true);run(g,.7);assert.equal(user.defending,false);assert.ok(Math.hypot(user.vx,user.vz)<.05);
});
test('shielding the ball behind the carrier rejects body-distance steals, while an exposed ball can be poked physically',()=>{
 const user={x:0,z:0,yaw:0},carrier={x:0,z:1.1};assert.equal(tackleWindow(user,carrier,{x:0,z:1.8,y:.11},{range:2.1}).sheltered,true);assert.equal(tackleWindow(user,carrier,{x:0,z:.6,y:.11},{range:2.1}).canReach,true);
 const g=setup(),u=p(g),o=p(g,'away-1');Object.assign(u,{x:0,z:0,yaw:0});Object.assign(o,{x:0,z:1.1,yaw:0});Object.assign(g.state.ball,{ownerId:o.id,x:0,z:1.7,y:.11});assert.equal(g.action('tackle'),false);assert.equal(g.state.ball.ownerId,o.id);assert.ok(g.state.message.includes('护球'));
});
test('running turns have angular limits and possession grace prevents immediate repeated body swaps',()=>{
 const g=setup(),user=p(g),before=user.yaw;run(g,.1,{x:1});assert.ok(Math.abs(Math.atan2(Math.sin(user.yaw-before),Math.cos(user.yaw-before)))<.8);
 const h=setup(),u=p(h),opponent=p(h,'away-1');Object.assign(u,{x:0,z:0,yaw:0});Object.assign(opponent,{x:0,z:.9,yaw:Math.PI});Object.assign(h.state.ball,{ownerId:null,x:0,z:.1,y:.11,vx:0,vz:0,vy:0});run(h,.03);assert.equal(h.state.ball.ownerId,u.id);const events=h.state.eventCount;run(h,.15);assert.equal(h.state.ball.ownerId,u.id);assert.ok(h.state.eventCount-events<=1);
});
test('the next-player hint excludes keepers and the current player; assistance settings persist independently of quality',()=>{
 const g=setup(),next=cursorCandidate(g.state.players,g.state.ball,{exclude:g.state.controlledId});assert.ok(next&&!next.keeper&&next.team==='home'&&next.id!==g.state.controlledId);
 const data=new Map([['arena-visitor-v1','{"quality":"low"}']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};saveFootballSettings(storage,{controlMode:'assisted'});assert.deepEqual(loadFootballSettings(storage),{controlMode:'assisted'});assert.equal(data.get('arena-visitor-v1'),'{"quality":"low"}');assert.deepEqual(loadFootballSettings({getItem:()=>'{oops'}),{controlMode:'semi'});
});


test('semi takes the recovered friendly carrier while pressure never runs after a teammate',()=>{
 const g=setup(),old=p(g),friend=p(g,'home-2');friend.x=0;friend.z=0;old.x=0;old.z=10;Object.assign(g.state.ball,{ownerId:friend.id,x:0,z:-.5,y:.11});g.update(1/60);assert.equal(g.state.controlledId,friend.id);
 const h=setup('manual'),u=p(h),f=p(h,'home-2');u.x=0;u.z=10;f.x=0;f.z=0;Object.assign(h.state.ball,{ownerId:f.id,x:0,z:-.5,y:.11});const origin={x:u.x,z:u.z};run(h,.3,{defend:true});assert.ok(Math.hypot(u.x-origin.x,u.z-origin.z)<.01);assert.equal(h.state.controlledId,u.id);
});


test('pressure steers around a shielding carrier instead of driving straight into their back',()=>{
 const defender={x:0,z:0,yaw:0},carrier={team:'away',x:0,z:1.1,vx:0,vz:0},ball={x:0,z:1.7,y:.11,vx:0,vz:0};const target=pressureTarget(defender,carrier,ball);assert.ok(Math.abs(target.x)>.9);assert.ok(target.z>carrier.z);assert.equal(target.standOff,.15);
 const exposed=pressureTarget({x:0,z:3,yaw:Math.PI},carrier,ball);assert.equal(exposed.x,ball.x);assert.equal(exposed.standOff,1.1);
});
