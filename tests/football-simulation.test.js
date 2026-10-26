import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';

function run(game,seconds,input={}){for(let i=0;i<Math.round(seconds*60);i++)game.update(1/60,input);}
function start(options){const game=createFootballSimulation(options);run(game,3.05);assert.equal(game.state.phase,'playing');return game;}
function clearOthers(game){for(const p of game.state.players)if(p.id!==game.state.controlledId){p.x=p.team==='home'?27:-27;p.z=p.team==='home'?40:-40;p.vx=p.vz=0;p.decisionAt=1e6;p.tackleAt=1e6;}}
const player=(game,id=game.state.controlledId)=>game.state.players.find(p=>p.id===id);

test('the playable fixture uses two distinct squads of eleven, two keepers and the shared current names',()=>{
 const game=createFootballSimulation(),s=game.state;assert.equal(s.players.length,22);assert.equal(new Set(s.players.map(p=>p.id)).size,22);
 for(const team of['home','away']){const squad=s.players.filter(p=>p.team===team);assert.equal(squad.length,11);assert.equal(squad.filter(p=>p.keeper).length,1);assert.equal(new Set(squad.map(p=>p.number)).size,11);assert.ok(squad.every(p=>p.name));}
 assert.equal(player(game).name,'KANE');assert.equal(player(game).number,9);assert.equal(s.ball.ownerId,s.controlledId);assert.equal(game.attackSign('home'),-1);assert.equal(game.attackSign('away'),1);assert.equal(player(game).yaw,Math.PI);
});
test('player movement is world-relative, diagonals do not run faster, and sprint drains then recovers stamina',()=>{
 const straight=start(),diagonal=start();clearOthers(straight);clearOthers(diagonal);const a=player(straight),b=player(diagonal),az=a.z,bx=b.x,bz=b.z;
 run(straight,1,{x:0,z:-1});run(diagonal,1,{x:1,z:-1});assert.ok(a.z<az-3.8);assert.ok(Math.abs(Math.hypot(b.x-bx,b.z-bz)-Math.abs(a.z-az))<.05);assert.equal(a.yaw,Math.PI);
 const sprint=start();clearOthers(sprint);const p=player(sprint);run(sprint,1,{z:-1,sprint:true});assert.ok(Math.abs(p.z-bz)>Math.abs(a.z-az));assert.ok(p.stamina<.91);const tired=p.stamina;run(sprint,1,{x:0,z:0});assert.ok(p.stamina>tired);assert.ok(Math.hypot(p.vx,p.vz)<.03);
});
test('pass and shot release an actual moving ball instead of moving it with the player',()=>{
 const game=start();clearOthers(game);const s=game.state,p=player(game),origin={x:p.x,z:p.z},target=player(game,'home-8');target.x=2;target.z=-12;
 assert.equal(game.action('pass'),true);assert.equal(s.ball.ownerId,null);assert.equal(s.stats.home.passes,1);assert.ok(Math.hypot(s.ball.vx,s.ball.vz)>8);const before={x:s.ball.x,z:s.ball.z};run(game,.15);assert.ok(Math.hypot(s.ball.x-before.x,s.ball.z-before.z)>1);assert.ok(Math.hypot(p.x-origin.x,p.z-origin.z)<.03);
 const shot=start();clearOthers(shot);const oldZ=shot.state.ball.z;assert.equal(shot.action('shoot'),true);assert.equal(shot.state.ball.ownerId,null);assert.equal(shot.state.stats.home.shots,1);assert.ok(shot.state.ball.vz<-18);assert.ok(shot.state.ball.vy>0);run(shot,.2);assert.ok(shot.state.ball.z<oldZ-3);assert.ok(shot.state.ball.y>.11);
});
test('an exposed manual poke knocks the ball loose before collection, and has a cooldown',()=>{
 const game=start();clearOthers(game);const p=player(game),opponent=player(game,'away-1');p.x=0;p.z=0;p.yaw=0;opponent.x=0;opponent.z=1.3;opponent.yaw=Math.PI;Object.assign(game.state.ball,{ownerId:opponent.id,x:0,y:.11,z:.65});
 assert.equal(game.action('tackle'),true);assert.equal(game.state.ball.ownerId,null);assert.ok(game.state.ball.vz<0);assert.equal(game.state.stats.home.tackles,1);assert.equal(game.action('tackle'),false);
 run(game,.12,{defend:true});assert.equal(game.state.ball.ownerId,p.id);const before=game.state.controlledId;assert.equal(game.action('switch'),true);assert.notEqual(game.state.controlledId,before);assert.ok(player(game).team==='home'&&!player(game).keeper);
});

test('a completed human pass transfers control to its receiver, and approaching a dribbled ball can recover it naturally',()=>{
 const game=start();clearOthers(game);const receiver=player(game,'home-8');receiver.x=2;receiver.z=-12;assert.equal(game.action('pass'),true);assert.equal(game.state.ball.targetId,receiver.id);
 Object.assign(game.state.ball,{x:receiver.x,z:receiver.z+.2,y:.12,vx:0,vz:-3,vy:0});game.update(1/60);assert.equal(game.state.ball.ownerId,receiver.id);assert.equal(game.state.controlledId,receiver.id);assert.equal(game.state.events.at(-1).type,'receive');
 const interception=start();clearOthers(interception);const user=player(interception),opponent=player(interception,'away-1');user.x=0;user.z=1.6;opponent.x=0;opponent.z=.6;opponent.yaw=0;Object.assign(interception.state.ball,{ownerId:opponent.id,x:0,z:1.2,y:.11});run(interception,.08);assert.equal(interception.state.ball.ownerId,user.id);assert.equal(interception.state.stats.home.tackles,1);
});
test('uncontrolled opponents can win possession and keep acting without user movement',()=>{
 const game=start(),s=game.state;const initial=s.players.filter(p=>p.team==='away').map(p=>({id:p.id,x:p.x,z:p.z}));run(game,20);
 assert.ok(initial.some(a=>Math.hypot(player(game,a.id).x-a.x,player(game,a.id).z-a.z)>5));assert.ok(s.stats.away.tackles+s.stats.away.shots+s.stats.away.passes>0);assert.ok(new Set(s.players.map(p=>Math.round(p.x)+','+Math.round(p.z))).size>15);assert.ok(s.events.some(e=>e.team==='away'));
});
test('a low ball crossing the actual goal plane scores exactly once then restarts for the conceding side',()=>{
 const game=start();clearOthers(game);Object.assign(game.state.ball,{ownerId:null,x:1,y:.4,z:-52.4,vx:0,vy:0,vz:-18});game.update(1/60);
 assert.equal(game.state.phase,'goal');assert.deepEqual(game.state.score,{home:1,away:0});assert.equal(game.state.events.at(-1).type,'goal');assert.ok(game.state.ball.z<-52.5);
 run(game,2);assert.equal(game.state.score.home,1);run(game,2);assert.equal(game.state.phase,'kickoff');assert.equal(game.state.restartTeam,'away');assert.equal(game.state.ball.ownerId,'away-1');assert.equal(game.state.score.home,1);
});
test('shots wide or over the bar and touchline exits produce real restarts instead of invisible-wall rebounds',()=>{
 const touch=start();clearOthers(touch);Object.assign(touch.state.ball,{ownerId:null,x:33.99,y:.11,z:12,vx:10,vy:0,vz:0});touch.update(1/60);assert.equal(touch.state.restartType,'throwin');assert.equal(touch.state.restartTeam,'away');assert.equal(touch.state.phase,'kickoff');assert.equal(touch.state.ball.vx,0);
 const wide=start();clearOthers(wide);Object.assign(wide.state.ball,{ownerId:null,x:8,y:.11,z:-52.4,vx:0,vy:0,vz:-18});wide.update(1/60);assert.equal(wide.state.restartType,'goalkick');assert.equal(wide.state.restartTeam,'away');assert.deepEqual(wide.state.score,{home:0,away:0});
 const corner=start();clearOthers(corner);Object.assign(corner.state.ball,{ownerId:null,x:12,y:.11,z:52.4,vx:0,vy:0,vz:18});corner.update(1/60);assert.equal(corner.state.restartType,'corner');assert.equal(corner.state.restartTeam,'away');
 const high=start();clearOthers(high);Object.assign(high.state.ball,{ownerId:null,x:0,y:3.1,z:-52.4,vx:0,vy:0,vz:-18});high.update(1/60);assert.equal(high.state.restartType,'goalkick');assert.deepEqual(high.state.score,{home:0,away:0});
});
test('a visitor can dribble over the touchline and receive an opponent throw-in rather than an invisible field wall',()=>{
 const game=start();clearOthers(game);const p=player(game);p.x=33;p.z=8;Object.assign(game.state.ball,{x:33,y:.11,z:7.3});run(game,.6,{x:1,z:0});assert.equal(game.state.phase,'kickoff');assert.equal(game.state.restartType,'throwin');assert.equal(game.state.restartTeam,'away');assert.ok(game.state.ball.ownerId.startsWith('away-'));
});
test('goalkeepers intercept reachable shots and record saves without teleporting to the ball',()=>{
 const game=start();clearOthers(game);const keeper=player(game,'away-0');keeper.x=0;keeper.z=-48;Object.assign(game.state.ball,{ownerId:null,x:0,y:.5,z:-47.90,vx:0,vy:0,vz:-10});game.update(1/60);
 assert.equal(game.state.ball.ownerId,keeper.id);assert.equal(game.state.stats.away.saves,1);assert.ok(Math.abs(keeper.z+48)<.1);assert.equal(game.state.events.at(-1).type,'save');
});
test('pause, finite capped updates and full time freeze the live simulation; restart clears score and clock',()=>{
 const game=start({duration:1});clearOthers(game);game.setPaused(true);const snapshot=JSON.stringify(game.state);game.update(100,{x:1,z:-1});assert.equal(JSON.stringify(game.state),snapshot);assert.equal(game.action('shoot'),false);game.setPaused(false);
 const before=game.state.elapsed;game.update(Infinity);game.update(NaN);game.update(-10);assert.equal(game.state.elapsed,before);game.update(100);assert.ok(game.state.elapsed-before<.251);run(game,1);assert.equal(game.state.phase,'fulltime');const end=JSON.stringify(game.state);game.update(1,{z:1});assert.equal(JSON.stringify(game.state),end);
 assert.equal(game.action('restart'),true);assert.equal(game.state.elapsed,0);assert.equal(game.state.phase,'kickoff');assert.deepEqual(game.state.score,{home:0,away:0});
});
test('fixed substeps are deterministic and a complete autonomous fixture retains finite bounded actors',()=>{
 const a=start({duration:18,seed:19}),b=start({duration:18,seed:19});for(let i=0;i<1200;i++){const input={x:i%300<80?.6:0,z:i%300<150?-.8:0,sprint:i%120<20};if(i%185===0){a.action('pass');b.action('pass');}a.update(1/60,input);b.update(1/60,input);}
 assert.deepEqual(a.state,b.state);for(const p of a.state.players){for(const k of['x','z','vx','vz','yaw','stamina'])assert.ok(Number.isFinite(p[k]),p.id+' '+k);assert.ok(Math.abs(p.x)<=35.3&&Math.abs(p.z)<=54);assert.ok(p.stamina>=0&&p.stamina<=1);}for(const k of['x','y','z','vx','vy','vz'])assert.ok(Number.isFinite(a.state.ball[k]));assert.ok(a.state.events.length<=12);
});
