import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {cursorCandidate,tackleWindow} from '../dist/football-assist.js';

const run=(game,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)game.update(1/60);};
function fixture(team,period=1){
 const game=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual',rules:{mode:'league',duration:180}});run(game,3.1);
 if(period===2){for(let i=0;i<20000&&game.state.phase!=='interval';i++)game.update(1/60);assert.equal(game.state.phase,'interval');assert.equal(game.continuePeriod(),true);run(game,3.1);}
 const checkpoint=game.checkpoint();
 return angle=>{
  game.restore(checkpoint);const state=game.state,defender=state.players.find(p=>p.id===team+'-1'),owner=state.players.find(p=>p.id===(team==='home'?'away':'home')+'-1');
  for(const p of state.players)Object.assign(p,{x:p.team==='home'?28:-28,z:p.team==='home'?40:-40,vx:0,vz:0,tackleAt:0,decisionAt:1e9});
  const rotate=(x,z)=>({x:x*Math.cos(angle)+z*Math.sin(angle),z:z*Math.cos(angle)-x*Math.sin(angle)});
  Object.assign(defender,{x:0,z:0,yaw:Math.PI/4+angle+2});Object.assign(owner,{...rotate(0,1.1),yaw:Math.PI+angle,protectedUntil:0});
  Object.assign(state.ball,{...rotate(.7,.7),y:.11,vx:0,vy:0,vz:0,ownerId:owner.id});
  return{game,state,defender,owner,tackles:state.stats[team].tackles,fouls:state.discipline[team].fouls};
 };
}

test('the actual assisted tackle turn is considered before a clean exposed-ball challenge is judged a foul',()=>{
 for(const team of['home','away'])for(const period of[1,2]){const setup=fixture(team,period);for(let turn=0;turn<12;turn++){
  const {game,state,defender,owner,tackles,fouls}=setup(turn*Math.PI/6),yaw=defender.yaw;
  assert.equal(tackleWindow(defender,owner,state.ball,{range:2.05}).canReach,false,'initial side-back stance cannot yet reach');
  assert.equal(game.action('tackle',{},team),true,`${team} half ${period} rotation ${turn}`);
  assert.equal(state.ball.ownerId,null,'a clean challenge releases a physical ball instead of teleporting possession');
  assert.equal(state.stats[team].tackles,tackles+1);assert.equal(state.discipline[team].fouls,fouls);assert.equal(state.phase,'playing');
  assert.ok(Math.abs(Math.atan2(Math.sin(defender.yaw-yaw),Math.cos(defender.yaw-yaw)))<=.75+1e-10,'assistance retains its existing angular limit');
 }}
});

test('limited assistance still rejects an opposite-facing body collision and a shielded ball',()=>{
 for(const team of['home','away'])for(const shielded of[false,true]){
  const {game,state,defender,owner}=fixture(team)(0);
  if(shielded){Object.assign(owner,{x:0,z:1.1,yaw:0});Object.assign(state.ball,{x:0,z:1.68});defender.yaw=0;}
  else defender.yaw=Math.PI/4+3;
  assert.equal(game.action('tackle',{},team),false);assert.equal(state.discipline[team].fouls,1);assert.equal(state.restartType,'freeKick');assert.equal(state.stats[team].tackles,0);
 }
});

test('cursor switching has a stable equal-distance choice and respects dismissal, goalkeeper and current-player exclusions',()=>{
 const current={id:'home-1',team:'home',x:0,z:8,attackSign:-1},first={id:'home-2',team:'home',x:5,z:0},second={id:'home-3',team:'home',x:-5,z:0};
 const keeper={id:'home-0',team:'home',x:0,z:0,keeper:true},dismissed={id:'home-4',team:'home',x:0,z:0,dismissed:true},opponent={id:'away-1',team:'away',x:0,z:0};
 const players=[current,keeper,dismissed,first,second,opponent],ball={x:0,z:0,vx:0,vz:0,ownerId:null};
 for(let i=0;i<20;i++)assert.equal(cursorCandidate(players,ball,{exclude:current.id})?.id,first.id);
 assert.equal(cursorCandidate(players,ball,{exclude:current.id,direction:{x:-1,z:0}})?.id,second.id,'a deliberate directional switch can override the equal-distance choice');
 first.dismissed=true;assert.equal(cursorCandidate(players,ball,{exclude:current.id})?.id,second.id);
 second.dismissed=true;assert.equal(cursorCandidate(players,ball,{exclude:current.id}),null);
});
