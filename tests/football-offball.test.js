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
