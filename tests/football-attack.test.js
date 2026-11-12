import test from 'node:test';
import assert from 'node:assert/strict';
import {planCpuAttack} from '../dist/football-attack.js';
import {createFootballSimulation} from '../dist/football-simulation.js';

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
