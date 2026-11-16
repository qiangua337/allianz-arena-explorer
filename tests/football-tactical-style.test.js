import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {footballFormations} from '../dist/football-squads.js';

const localMatch=()=>createFootballSimulation({allowTacticalStyles:true,controlMode:'manual',rules:{mode:'league'}});
const player=(game,id)=>game.state.players.find(p=>p.id===id);
const advance=(game,frames,input)=>{for(let i=0;i<frames;i++)game.update(1/60,input);};

function setStationaryPossession(game,id){
 const holder=player(game,id);
 Object.assign(holder,{vx:0,vz:0,decisionAt:1e6,cpuCarry:{x:holder.x,z:holder.z,speed:0,possession:holder.possessionSince,until:1e6}});
 if(holder.team==='home')game.state.controlledIds.home=game.state.controlledId=id;
 Object.assign(game.state.ball,{x:holder.x,z:holder.z-.57,y:.11,ownerId:id,targetId:null,receivePoint:null,shot:null,rebound:null,vx:0,vz:0,vy:0});
}

function prepareDefending(style){
 const game=localMatch();
 game.state.phase='playing';
 game.setTacticalStyle(style);
 for(const p of game.state.players){
  const side=p.index%2===0?1:-1;
  Object.assign(p,{x:side*(26+p.index%4*2),z:p.team==='home'?31+p.index*.77:-29-p.index*.74,vx:0,vz:0,tackleAt:1e6,decisionAt:1e6});
 }
 Object.assign(player(game,'away-8'),{x:0,z:0});
 Object.assign(player(game,'home-3'),{x:13,z:0});
 Object.assign(player(game,'home-5'),{x:-24,z:26});
 Object.assign(player(game,'home-9'),{x:9,z:-18});
 setStationaryPossession(game,'away-8');
 return game;
}

function prepareAttacking(style){
 const game=localMatch(),sign=game.attackSign('home');
 game.state.phase='playing';
 game.setTacticalStyle(style);
 const home=[[0,-46],[0,21],[-8,1],[-11,-13],[11,-13],[-24,-3],[24,-3],[7,1],[16,16],[24,17],[-22,16]];
 const away=[[0,48],[0,3],[-9,22],[-11,34],[11,34],[-23,30],[23,30],[9,22],[0,13],[23,12],[-23,12]];
 for(const p of game.state.players){
  const [x,q]=(p.team==='home'?home:away)[p.index];
  Object.assign(p,{x,z:q*sign,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6,yaw:Math.PI});
 }
 setStationaryPossession(game,'home-8');
 return game;
}

function prepareRegain(style){
 const game=localMatch(),sign=game.attackSign('home'),formation=footballFormations['4231'];
 const home={GK:[0,-44],DM:[-6,-5],CB:[-12,-21],RB:[25,-7],LB:[-24,-7],AM:[-2,5],ST:[0,11],RW:[22,8],LW:[-22,8]};
 const away=[[0,50],[0,-12],[-4,-2],[-10,13],[10,13],[-22,11],[22,11],[7,0],[0,-3],[23,-3],[-23,-3]];
 const saved=game.checkpoint(),runnerIndex=formation.roles.indexOf('DM'),id='home-'+runnerIndex;
 saved.state.phase='playing';
 saved.state.elapsed=12;
 saved.lastTouch=saved.lastPossessionTeam='away';
 saved.state.controlledIds.home=saved.state.controlledId=id;
 for(const p of saved.state.players){
  const role=formation.roles[p.index],[x,q]=p.team==='home'?home[role]:away[p.index];
  const opposite=p.team==='home'&&(role==='CB'&&p.index===4||role==='DM'&&p.index===7);
  Object.assign(p,{x:opposite?Math.abs(x):x,z:(p.keeper?q:1+q)*sign,vx:0,vz:0,tackleAt:1e6,decisionAt:1e6});
 }
 Object.assign(saved.state.players.find(p=>p.id===id),{x:14,z:sign,vx:.45,vz:4.8*sign,yaw:Math.atan2(.45,sign*4.8)});
 Object.assign(saved.state.ball,{x:14,z:1.41*sign,y:.11,ownerId:null,targetId:null,receivePoint:null,shot:null,rebound:null,vx:.45,vz:sign*4.8,vy:0});
 game.restore(saved);
 game.setTacticalStyle(style);
 const motion={x:.08,z:sign*.82,sprint:true};
 for(let frame=0;frame<20&&!game.state.ball.ownerId;frame++)advance(game,1,motion);
 assert.equal(game.state.ball.ownerId,id);
 return {game,sign,motion};
}

test('balanced preserves seeded match behavior and tactics are unavailable to training and the online authority',()=>{
 const standard=createFootballSimulation({controlMode:'manual',rules:{mode:'league'}}),local=localMatch();
 advance(standard,360);advance(local,360);
 const {tacticalStyle,...localState}=local.state;
 assert.equal(tacticalStyle,'balanced');
 assert.deepEqual(localState,standard.state);
 const online=createFootballSimulation({humanTeams:['home','away'],allowTacticalStyles:true});
 const practice=createFootballSimulation({practice:'free',allowTacticalStyles:true});
 for(const game of [standard,online,practice]){assert.equal(game.setTacticalStyle('press'),false);assert.equal(game.state.tacticalStyle,undefined);}
});

test('high press engages an off-ball challenger sooner and low block keeps the midfield behind the ball',()=>{
 const balanced=prepareDefending('balanced'),press=prepareDefending('press'),counter=prepareDefending('counter');
 for(const game of [balanced,press,counter])advance(game,75);
 assert.ok(Math.abs(player(press,'home-9').x)<Math.abs(player(balanced,'home-9').x)-2,'high press adds a second challenger');
 assert.ok(player(counter,'home-5').z>player(press,'home-5').z+3,'low block holds a deeper defensive line');
 assert.ok(Math.abs(player(counter,'home-5').x)<Math.abs(player(press,'home-5').x),'low block covers a narrower space');
});

test('wide buildup gives the carrier a wider real far-side outlet',()=>{
 const balanced=prepareAttacking('balanced'),wide=prepareAttacking('wide');
 advance(balanced,90);advance(wide,90);
 assert.ok(player(wide,'home-10').x<player(balanced,'home-10').x-1.3);
 assert.equal(wide.state.ball.ownerId,'home-8');
});

test('after an actual loose-ball regain the counter preset accelerates the same forward runner',()=>{
 const neutral=prepareRegain('balanced'),counter=prepareRegain('counter');
 for(const {game,motion} of [neutral,counter])advance(game,1,motion);
 const forward=({game})=>game.checkpoint().controllers.home.offBall.routes.find(route=>route.kind==='channel');
 const runner=forward(neutral);
 assert.ok(runner);
 assert.equal(forward(counter).id,runner.id);
 for(const {game,motion} of [neutral,counter])advance(game,33,motion);
 assert.ok((player(counter.game,runner.id).z-player(neutral.game,runner.id).z)*counter.sign>.15);
});

test('applying a style at halftime keeps the score, clock, player roster and upcoming half',()=>{
 const game=localMatch();
 advance(game,210);
 game.state.elapsed=game.state.duration/2;
 for(let i=0;i<300&&game.state.phase!=='interval';i++)advance(game,1);
 assert.equal(game.state.phase,'interval');
 const before=game.checkpoint();
 assert.equal(game.setTacticalStyle('press'),true);
 assert.equal(game.setTacticalStyle('invalid'),false);
 assert.deepEqual(game.state.score,before.state.score);
 assert.equal(game.state.elapsed,before.state.elapsed);
 assert.deepEqual(game.state.teamSheets,before.state.teamSheets);
 assert.equal(game.continuePeriod(),true);
 assert.equal(game.state.competition.period,2);
 assert.equal(game.state.tacticalStyle,'press');
});
