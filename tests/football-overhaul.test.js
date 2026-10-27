import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {footballTeams,opponentSquad,loadMatchOptions,saveMatchOptions} from '../dist/football-teams.js';
import {footballCamera,footballInput} from '../dist/football-controls.js';
import {passOption} from '../dist/football-tactics.js';
import {radarPoint} from '../dist/football-radar.js';
const run=(g,t,input={})=>{for(let i=0;i<Math.round(t*60);i++)g.update(1/60,input);};
const player=(g,id=g.state.controlledId)=>g.state.players.find(p=>p.id===id);
function setup(){const g=createFootballSimulation();run(g,3.05);for(const p of g.state.players)if(p.id!==g.state.controlledId){p.x=p.team==='home'?29:-29;p.z=p.team==='home'?44:-44;p.vx=p.vz=0;p.decisionAt=p.tackleAt=1e6;}return g;}

test('each selectable opponent supplies eleven distinct starters, nine distinct substitutes, one starting keeper and its own identity',()=>{
 for(const club of footballTeams){const squad=opponentSquad(club.id),all=[...squad.xi,...squad.bench],g=createFootballSimulation({opponent:club.id});assert.equal(squad.xi.length,11);assert.equal(squad.bench.length,9);assert.equal(squad.xi.filter(p=>p.keeper).length,1);assert.equal(new Set(all.map(p=>p.player.number)).size,20);assert.ok(all.every(p=>p.player.name));assert.equal(g.state.fixture.id,club.id);assert.deepEqual(g.state.players.filter(p=>p.team==='away').map(p=>p.name),squad.xi.map(p=>p.player.name));}
 assert.equal(player(createFootballSimulation({opponent:'madrid'}),'away-1').name,'MBAPPÉ');assert.equal(player(createFootballSimulation({opponent:'barcelona'}),'away-9').name,'LAMINE YAMAL');assert.equal(player(createFootballSimulation({opponent:'city'}),'away-1').name,'HAALAND');
 // Returning to the original club must not reuse mutated visitor definitions.
 assert.equal(opponentSquad('dortmund').xi[1].player.name,'GUIRASSY');
});
test('match settings survive independently of visiting quality and reject invalid stored choices',()=>{
 const values=new Map([['arena-visitor-v1','{"quality":"low"}']]),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};saveMatchOptions(storage,{opponent:'barcelona',difficulty:'challenge',camera:'follow'});assert.deepEqual(loadMatchOptions(storage),{opponent:'barcelona',difficulty:'challenge',camera:'follow'});assert.equal(values.get('arena-visitor-v1'),'{"quality":"low"}');assert.deepEqual(loadMatchOptions({getItem:()=>'{oops'}),{opponent:'dortmund',difficulty:'casual',camera:'broadcast'});
});
test('stick direction selects between real passing lanes rather than the lagging body heading',()=>{
 const g=setup(),p=player(g),left=player(g,'home-8'),right=player(g,'home-9');Object.assign(left,{x:-12,z:-3});Object.assign(right,{x:12,z:-3});p.yaw=Math.PI;
 assert.equal(passOption(g.state.players,p,g.state.ball,{direction:{x:-1,z:0}}).player.id,left.id);assert.equal(passOption(g.state.players,p,g.state.ball,{direction:{x:1,z:0}}).player.id,right.id);
 assert.equal(g.action('pass',{direction:{x:1,z:0}}),true);assert.equal(g.state.ball.targetId,right.id);assert.ok(g.state.ball.vx>8);
});
test('a pass is physically received through normal simulation with no test teleport of the ball',()=>{
 for(const type of['pass','through']){const g=setup(),receiver=player(g,'home-8');Object.assign(receiver,{x:1,z:-12});assert.equal(g.action(type,{direction:{x:0,z:-1}}),true);assert.equal(g.state.ball.targetId,receiver.id);const landing={...g.state.ball.receivePoint};if(type==='through')assert.ok(landing.z<receiver.z-4);let received=false;for(let i=0;i<240;i++){g.update(1/60);if(g.state.ball.ownerId===receiver.id){received=true;break;}}assert.ok(received,type+' should reach the teammate');assert.equal(g.state.controlledId,receiver.id);}
});
test('a queued first-touch pass executes after the incoming ball reaches the feet',()=>{
 const g=setup(),p=player(g),receiver=player(g,'home-8');Object.assign(p,{x:0,z:0,yaw:Math.PI});Object.assign(receiver,{x:0,z:-12});Object.assign(g.state.ball,{ownerId:null,x:0,y:.11,z:3,vx:0,vy:0,vz:-6});assert.equal(g.action('pass'),true);assert.equal(g.state.stats.home.passes,0);run(g,.6);assert.equal(g.state.stats.home.passes,1);assert.ok(g.state.ball.vz<0);
});
test('shot power changes actual ball velocity and choosing a corner changes the flight',()=>{
 const speeds=[];for(const power of[.25,1]){const g=setup();assert.equal(g.action('shoot',{power,direction:{x:1,z:-1}}),true);speeds.push(Math.hypot(g.state.ball.vx,g.state.ball.vz));assert.ok(g.state.ball.vx>0);}assert.ok(speeds[1]>speeds[0]+8);
});

test('pressing tackle in possession does not interrupt the dribble with an unrelated lunge',()=>{
 const g=setup(),p=player(g),owner=g.state.ball.ownerId,cooldown=p.tackleAt;assert.equal(g.action('tackle'),false);assert.equal(g.state.ball.ownerId,owner);assert.equal(p.motion,null);assert.equal(p.lungeUntil,0);assert.equal(p.tackleAt,cooldown);assert.ok(g.state.message.includes('控球'));
});
test('a sustained fixture finishes with real keeper saves and goals while restart stoppages do not consume match time',()=>{
 const g=createFootballSimulation({opponent:'madrid',difficulty:'casual'});let steps=0;while(g.state.phase!=='fulltime'&&steps++<60*360)g.update(1/60);assert.equal(g.state.phase,'fulltime');assert.ok(g.state.stats.home.saves>=1);assert.ok(g.state.score.away>=1);assert.ok(g.state.stats.away.shots>=g.state.score.away);assert.ok(g.state.elapsed<=g.state.duration+1/60);
});
test('broadcast controls remain screen-relative and the portrait camera stays close enough to read the controlled player',()=>{
 const p={x:13,z:-20},b={x:14,z:-21,vx:0,vz:0},wide=footballCamera(p,{style:'broadcast',ball:b}),phone=footballCamera(p,{style:'broadcast',ball:b,aspect:390/844});const right=footballInput({side:1,yaw:wide.controlYaw}),up=footballInput({forward:1,yaw:wide.controlYaw});assert.ok(right.z<-.9&&up.x<-.9);assert.ok(phone.position[1]<wide.position[1]);assert.ok(phone.position.every(Number.isFinite));
 for(const x of[-35,35])for(const z of[-53,53]){const pose=footballCamera({x,z},{style:'broadcast',ball:{x,z},aspect:.46});assert.ok(pose.position[1]>18);assert.ok(Math.abs(pose.target[2])<=39);}
 assert.deepEqual(radarPoint(0,-52.5),{x:180,y:58});assert.deepEqual(radarPoint(0,52.5),{x:0,y:58});
});
