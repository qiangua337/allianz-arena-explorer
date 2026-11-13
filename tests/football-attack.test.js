import test from 'node:test';
import assert from 'node:assert/strict';
import {planCpuAttack} from '../dist/football-attack.js';
import {createFootballSimulation} from '../dist/football-simulation.js';

function fixturePoints(sign){
 const point=(id,team,x,depth,vx=0,forwardSpeed=0)=>({id,team,x,z:depth*sign,vx,vz:forwardSpeed*sign,
  keeper:id.endsWith('-0'),attackSign:team==='home'?sign:-sign});
 return{
  home:(index,...position)=>point('home-'+index,'home',...position),
  away:(index,...position)=>point('away-'+index,'away',...position),
  ball:player=>({x:player.x,z:player.z+.55*sign,y:.11})
 };
}

function attackGame(sign,field,carrier,ball,{regain=false}={}){
 const game=createFootballSimulation({humanTeams:[],rules:{mode:'league',duration:180},seed:12});
 const saved=game.checkpoint(),state=saved.state;
 state.phase='playing';state.elapsed=sign<0?18:108;
 state.attackDirections={home:sign,away:-sign};
 state.competition.period=sign<0?1:2;
 state.competition.periodStart=sign<0?0:90;
 if(regain)saved.controllers.home.regainedAt=saved.worldTime;
 for(const player of state.players){
  const setup=field.find(point=>point.id===player.id);
  if(setup)Object.assign(player,setup,{decisionAt:player.id===carrier.id?0:1e6,tackleAt:1e6});
  else player.dismissed=true;
 }
 Object.assign(state.ball,ball,{ownerId:carrier.id,targetId:null,receivePoint:null,shot:null,vx:0,vz:0,vy:0});
 game.restore(saved);
 game.update(1/60);
 return game;
}

function receive(game,expected){
 for(let frame=0;frame<120&&!game.state.ball.ownerId;frame++)game.update(1/60);
 assert.equal(game.state.ball.ownerId,expected.id);
}

function wingScenario(sign,markFar=false){
 const point=(id,team,x,depth)=>({id,team,x,z:sign*depth,attackSign:team==='home'?sign:-sign,vx:0,vz:0});
 const carrier=point('home-1','home',15,30),back=point('home-2','home',12,22),far=point('home-10','home',-14,29);
 const blockers=[10.5,13,15,17.5,20].map((x,i)=>point('away-'+(i+1),'away',x,34));
 if(markFar)blockers.push(point('away-6','away',-13,29));
 return{carrier,back,far,field:[carrier,back,far,...blockers],ball:{x:carrier.x,z:carrier.z+sign*.6,y:.11}};
}

test('a blocked winger switches to the unmarked far outlet and recycles if that outlet is closed',()=>{
 for(const sign of [-1,1])for(const markFar of [false,true]){
  const {carrier,field,ball,back,far}=wingScenario(sign,markFar),decision=planCpuAttack(carrier,ball,field);
  assert.equal(decision.carry.blocked,true);
  assert.equal(decision.action?.type,'pass');
  assert.equal(decision.action.tactic,markFar?'recycle':'switch');
  assert.equal(decision.action.option.player,markFar?back:far);
  assert.ok(decision.action.option.lane>1.45);
 }
});

test('an open carrier continues forward even with a close trailing marker and shoots through an open goal-side lane',()=>{
 for(const sign of [-1,1]){
  const carrier={id:'home-1',team:'home',x:1,z:sign*27,attackSign:sign};
  const trailer={id:'away-1',team:'away',x:1,z:sign*25};
  const ball={x:1,z:sign*27.6,y:.11};
  const plan=planCpuAttack(carrier,ball,[carrier,trailer]);
  assert.equal(plan.carry.blocked,false);
  assert.equal(plan.action,null);
  assert.ok((plan.carry.z-carrier.z)*sign>=7);
  const closer={...carrier,z:sign*42};
  const shot=planCpuAttack(closer,{...ball,z:sign*42.6},[closer,trailer]);
  assert.equal(shot.action?.type,'shoot');
  assert.equal(Math.sign(shot.action.direction.z),sign);
 }
});

test('an AI switch and recycle use the real pass flight and the exact vetted teammate',()=>{
 for(const markFar of [false,true]){
  const g=createFootballSimulation({humanTeams:[],rules:{mode:'league',duration:180}}),{field,carrier,back,far,ball}=wingScenario(-1,markFar);
  for(const p of g.state.players){
   const point=field.find(item=>item.id===p.id);
   if(point)Object.assign(p,point,{decisionAt:0,tackleAt:1e6});
   else p.dismissed=true;
  }
  g.state.phase='playing';Object.assign(g.state.ball,ball,{ownerId:carrier.id});
  g.update(1/60);
  assert.equal(g.state.ball.ownerId,null);
  assert.equal(g.state.ball.targetId,markFar?back.id:far.id);
  assert.equal(g.state.events.at(-1).type,'pass');
  assert.equal(g.state.events.at(-1).tactic,markFar?'recycle':'switch');
  assert.ok(markFar?g.state.ball.vz>0:g.state.ball.vx<0);
  assert.equal(g.state.stats.home.passes,1);
 }
});

test('after a turnover the AI leads a diagonal runner or recycles if defenders close the lane',()=>{
 for(const sign of [-1,1]){
  const {home,away,ball}=fixturePoints(sign);
  const carrier=home(2,8,7,0,3.9),runner=home(9,19,13,-2.2,5.5),outlet=home(3,4,2),origin=ball(carrier);
  const field=[carrier,runner,outlet,away(3,6,13),away(1,10,5),away(4,-4,17)];
  const game=attackGame(sign,field,carrier,origin,{regain:true});
  assert.equal(game.state.events.at(-1).type,'through');
  assert.equal(game.state.events.at(-1).tactic,'counter');
  assert.equal(game.state.ball.targetId,runner.id);
  assert.equal(game.state.ball.receivePoint.directed,true);
  assert.ok((game.state.ball.receivePoint.z-runner.z)*sign>2);
  assert.ok(game.state.ball.receivePoint.x<runner.x-.8);
  receive(game,runner);

  const blocked=[...field,away(6,12.5,12),away(7,17,16)];
  const next=planCpuAttack(carrier,origin,blocked,{transition:true});
  assert.equal(next.carry.blocked,true);
  assert.equal(next.action.tactic,'recycle');
  assert.equal(next.action.option.player,outlet);
 }
});

test('the AI plays a central teammate into a better shooting position when that teammate is free',()=>{
 for(const sign of [-1,1]){
  const {home,away,ball}=fixturePoints(sign);
  const carrier=home(2,9,38),receiver=home(9,-1,45),origin=ball(carrier);
  const field=[carrier,receiver,away(0,0,51),away(5,-5,48)];
  const game=attackGame(sign,field,carrier,origin);
  assert.equal(game.state.events.at(-1).tactic,'combine');
  assert.equal(game.state.ball.targetId,receiver.id);
  receive(game,receiver);

  const marked=attackGame(sign,[...field,away(2,-2,45)],carrier,origin);
  assert.equal(marked.state.events.at(-1).type,'shot');
 }
});

test('a byline carrier cuts the ball back to the late runner when the near post is crowded',()=>{
 for(const sign of [-1,1]){
  const {home,away,ball}=fixturePoints(sign);
  const carrier=home(9,21,43),receiver=home(8,-5,36),nearPost=home(1,4,46),origin=ball(carrier);
  const field=[carrier,receiver,nearPost,away(0,1,50),away(1,14,45.5),away(2,2,44),away(4,-3,47)];
  const game=attackGame(sign,field,carrier,origin);
  assert.equal(game.state.events.at(-1).delivery,'cutback');
  assert.equal(game.state.ball.targetId,receiver.id);
  assert.equal(game.state.ball.receivePoint.directed,undefined);
  receive(game,receiver);
 }
});
