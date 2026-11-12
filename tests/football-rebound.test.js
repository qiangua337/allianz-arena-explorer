import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {planReboundChases} from '../dist/football-rebound.js';
import {footballFormations} from '../dist/football-squads.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';

const run=(game,steps=1)=>{for(let i=0;i<steps;i++)game.update(1/60);};
const player=(state,id)=>state.players.find(p=>p.id===id);
const shot=(blocker,ball)=>{
 const game=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual',seed:733});
 run(game,190);
 const {state}=game;
 for(const p of state.players)Object.assign(p,{x:p.index-5,z:p.team==='home'?20:25,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6});
 const kicker=player(state,'home-1');
 Object.assign(kicker,{x:0,z:-36,yaw:Math.PI});
 Object.assign(state.ball,{x:0,z:-36.58,y:.11,ownerId:kicker.id});
 assert.equal(game.action('shoot',{power:.75,direction:{x:0,z:-1}}),true);
 Object.assign(player(state,'away-1'),blocker);
 Object.assign(state.ball,{x:0,y:.31,vx:0,vy:0,vz:-25,curve:0,...ball});
 return game;
};

test('runners attack the predicted landing point with support and goal-side cover at either end',()=>{
 const system=footballFormations['433'];
 for(const flip of [-1,1]){
  const actor=(team,index,x,z)=>({id:team+'-'+index,team,index,x,z:z*flip,vx:0,vz:0});
  const field=[
   actor('home',3,0,43),actor('home',9,6.1,39.2),actor('home',8,2.4,32),
   actor('away',2,7.4,39.5),actor('away',4,1.4,44.4),actor('away',5,24,31)
  ];
  const ball={x:0,y:1.1,z:43*flip,vx:8,vz:-5*flip,vy:.65,rebound:{team:'home'}};
  const {targets,leaders}=planReboundChases(ball,field,{home:system,away:system},team=>team==='home'?flip:-flip);
  assert.deepEqual(leaders,{home:'home-9',away:'away-2'});
  assert.equal(Object.keys(targets).length,4);
  const attack=targets['home-9'],defend=targets['away-2'];
  assert.ok(attack.x>3&&attack.z*flip<42);
  assert.ok(targets['home-8'].z*flip<attack.z*flip);
  assert.ok(targets['away-4'].z*flip>defend.z*flip);
  assert.equal(targets['away-5'],undefined);
 }
});

test('a central defender block remains loose, then nearby defensive pressure prompts a clearance',()=>{
 const game=shot({x:0,z:-39},{z:-38.22}),{state}=game,{ball}=state;
 run(game);
 assert.equal(state.events.at(-1).type,'shot-blocked');
 assert.equal(ball.ownerId,null);
 assert.ok(ball.vz>4);
 assert.deepEqual(ball.rebound,{source:'block',team:'home',shotId:state.lastShot.id,until:state.time+2.15});
 Object.assign(player(state,'home-2'),{x:1.64,z:ball.z+.4});
 Object.assign(player(state,'away-2'),{x:-.05,z:ball.z+.18});
 run(game);
 assert.equal(state.events.at(-1).type,'clearance');
 assert.equal(ball.rebound,null);
 assert.equal(ball.ownerId,null);
 assert.ok(ball.vz>15&&ball.vy>3);
 assert.equal(state.lastShot.outcome,'blocked');
 assert.equal(state.stats.home.shots,1);
 assert.equal(state.stats.away.saves+state.stats.away.passes,0);
});

test('a grazing block can cross the actual line, and never adds a second shot',()=>{
 const game=shot({x:.44,z:-51.7},{z:-51.09}),{state}=game;
 run(game,2);
 assert.equal(state.ball.rebound.source,'block');
 assert.ok(state.ball.vz<0,'the grazing ball can continue towards goal');
 run(game,15);
 assert.equal(state.score.home,1);
 assert.equal(state.ball.rebound,null);
 assert.equal(state.lastShot.outcome,'goal');
 assert.equal(state.stats.home.shots,1);
 assert.equal(state.stats.home.onTarget,1);
 assert.equal(state.events.filter(e=>e.type==='shot-blocked').length,1);
});

test('a shot off the frame exposes the live contest online, and collection keeps its shot outcome',()=>{
 const game=shot({x:10,z:20},{x:3.66,z:-51.9}),{state}=game;
 run(game,2);
 const {ball}=state,client=createFootballSimulation().state;
 assert.equal(ball.rebound.source,'frame');
 assert.equal(state.stats.home.woodwork,1);
 assert.equal(applyOnlineState(client,packOnlineState(state,10),'away'),true);
 assert.equal(client.ball.rebound.team,'home');
 assert.equal(client.ball.rebound.source,'frame');
 Object.assign(player(state,'away-1'),{x:ball.x,z:ball.z+.22});
 run(game);
 assert.equal(ball.ownerId,'away-1','the manually controlled defender keeps a safe collection');
 assert.equal(ball.rebound,null);
 assert.equal(state.lastShot.outcome,'woodwork');
});

test('a genuine parry sends both teams towards the rebound and preserves the human cursor and save',()=>{
 const game=createFootballSimulation({difficulty:'regular',seed:733}),{state}=game;
 run(game,190);
 const kicker=player(state,'home-1'),keeper=player(state,'away-0'),ball=state.ball;
 for(const p of state.players){
  if(p!==kicker&&!p.keeper)Object.assign(p,{x:p.team==='home'?28:-28,z:30,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6});
 }
 Object.assign(kicker,{x:0,z:-34.5,yaw:Math.PI,vx:0,vz:0});
 Object.assign(keeper,{x:0,z:-50,vx:0,vz:0});
 Object.assign(ball,{x:0,y:.11,z:kicker.z-.58,ownerId:kicker.id,vx:0,vy:0,vz:0});
 assert.equal(game.action('shoot',{power:.55,direction:{x:0,z:-1}}),true);
 for(let i=0;i<180&&!state.stats.away.saves;i++)run(game);
 assert.equal(state.lastShot.outcome,'parried');
 assert.equal(ball.rebound.source,'parry');
 const forward=player(state,'home-9'),defender=player(state,'away-2');
 Object.assign(forward,{x:ball.x+3*Math.sign(ball.vx),z:ball.z+4,vx:0,vz:0});
 Object.assign(defender,{x:ball.x+4*Math.sign(ball.vx),z:ball.z+.6,vx:0,vz:0});
 run(game,3);
 assert.deepEqual(ball.rebound.leaders,{home:forward.id,away:defender.id});
 assert.ok(forward.vz<-1);
 assert.ok(defender.vz>1);
 assert.equal(state.controlledId,kicker.id);
 assert.equal(ball.ownerId,null);
 assert.equal(state.stats.away.saves,1);
 assert.equal(state.stats.home.onTarget,1);
});
