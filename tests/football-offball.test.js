import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';

const makeMatch=()=>createFootballSimulation({humanTeams:['home','away'],controlMode:'manual',rules:{mode:'league'}});
const player=(game,id)=>game.state.players.find(p=>p.id===id);
const run=(game,frames)=>{for(let i=0;i<frames;i++)game.update(1/60);};

function possession(game,team,x,z){
 const state=game.state,id=team+'-8',sign=game.attackSign(team),carrier=player(game,id);
 Object.assign(carrier,{x,z,yaw:sign<0?Math.PI:0,vx:0,vz:0});
 state.controlledIds[team]=id;if(team==='home')state.controlledId=id;
 Object.assign(state.ball,{x,z:z+sign*.57,ownerId:id,targetId:null,shot:null,vx:0,vy:0,vz:0});
}

function wideAttack(team){
 const game=makeMatch(),state=game.state,opponent=team==='home'?'away':'home',sign=game.attackSign(team);
 state.phase='playing';
 const attackPositions=[[0,-46],[0,21],[-8,1],[-11,-13],[11,-13],[-24,-3],[24,-3],[7,1],[16,16],[24,17],[-22,16]];
 const defendPositions=[[0,48],[0,3],[-9,22],[-11,34],[11,34],[-23,30],[23,30],[9,22],[0,13],[23,12],[-23,12]];
 for(const p of state.players){const [x,q]=(p.team===team?attackPositions:defendPositions)[p.index];Object.assign(p,{x,z:q*sign,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6});}
 possession(game,team,16,16*sign);return{game,opponent,sign};
}

test('wide possession gives the ball carrier a short outlet, width on the other wing and a committed run in either direction',()=>{
 for(const team of ['home','away']){
  const {game,sign}=wideAttack(team);run(game,1);
  const plan=game.checkpoint().controllers[team].offBall,runner=player(game,plan.run.id),start=runner.z*sign;
  const holding=player(game,team+'-7'),weakSide=player(game,team+'-10'),centreBack=player(game,team+'-3');
  run(game,54);
  assert.equal(game.state.ball.ownerId,team+'-8','off-ball help works for a stationary carrier');
  assert.ok(runner.z*sign>start+3.6,'the runner attacks space ahead');
  assert.ok(holding.z*sign>4&&holding.z*sign<16,'a midfielder moves into a short pass behind the carrier');
  assert.ok(weakSide.x<-24,'the far winger stretches the other flank');
  assert.ok(centreBack.z*sign<4,'a centre-back remains behind the attack');
 }
});

test('an active run survives server checkpoint recovery and is cancelled on loss of possession',()=>{
 const {game,opponent,sign}=wideAttack('home');run(game,24);
 const saved=game.checkpoint(),previousRun=saved.controllers.home.offBall.run,backup=makeMatch();
 assert.ok(previousRun);
 backup.restore(saved);run(game,16);run(backup,16);assert.deepEqual(backup.state,game.state);
 const weakBack=player(game,'home-5'),start=weakBack.z*sign;
 possession(game,opponent,16,16*sign);run(game,70);
 assert.equal(game.checkpoint().controllers.home.offBall,null);
 assert.ok(weakBack.z*sign<start-3,'the far-side defender recovers even though the ball changes hands on the other flank');
});

test('a stationary carrier gets a short option and a separate runner without sending the centre-backs forward',()=>{
 for(const team of ['home','away']){
  const {game,sign}=wideAttack(team);
  run(game,1);
  const first=game.checkpoint().controllers[team].offBall;
  assert.ok(first.run&&first.support&&first.run.id!==first.support.id);
  const helper=player(game,first.support.id),start={x:helper.x,z:helper.z};
  const plannedGap=Math.hypot(first.support.x-start.x,first.support.z-start.z);
  run(game,66);
  assert.ok(Math.hypot(first.support.x-helper.x,first.support.z-helper.z)<plannedGap-2.5);
  assert.ok(first.support.z*sign<first.run.z*sign,'the two players offer separate passing depths');
  assert.equal(game.state.ball.ownerId,team+'-8');
  for(const id of [team+'-3',team+'-4'])assert.ok(player(game,id).z*sign<8);
  const ids=new Set([first.run.id]);
  for(let i=0;i<270;i++){
   game.update(1/60);
   if(i%15===0){const {run}=game.checkpoint().controllers[team].offBall;if(run)ids.add(run.id);}
  }
  assert.ok(ids.size>1,'the forward run rotates when the carrier keeps the ball');
 }
});

test('a sprint short pass in semi-assisted play hands off the cursor and the original passer runs diagonally',()=>{
 const {game,sign}=wideAttack('home');game.setControlMode('semi');
 const passer=player(game,'home-8'),start={x:passer.x,z:passer.z};
 assert.equal(game.action('pass',{direction:{x:1,z:0,sprint:true}}),true);
 const receiver=game.state.ball.targetId;
 assert.equal(receiver,'home-9');assert.equal(game.state.controlledId,receiver);
 assert.match(game.state.events.at(-1).text,/斜插接应/);
 run(game,52);
 assert.equal(game.state.controlledId,receiver);
 assert.ok((passer.z-start.z)*sign>3,'the passer keeps running while the receiver is controlled');
 assert.ok(Math.abs(passer.x-start.x)>1.8,'the movement leaves the passing lane laterally');
});

test('ordinary short passes keep the usual handoff timing and manual control respects the cursor',()=>{
 for(const mode of ['semi','manual']){
  const {game}=wideAttack('home');game.setControlMode(mode);
  assert.equal(game.action('pass',{direction:{x:1,z:0,sprint:mode==='manual'}}),true);
  assert.equal(game.state.controlledId,'home-8');
  assert.doesNotMatch(game.state.events.at(-1).text,/斜插接应/);
  if(mode==='manual'){run(game,55);assert.equal(game.state.controlledId,'home-8');}
 }
});
