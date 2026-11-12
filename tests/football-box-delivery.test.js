import test from 'node:test';
import assert from 'node:assert/strict';
import {planCpuAttack} from '../dist/football-attack.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {boxDeliveryTime,boxPassTarget,passFlight,passOption} from '../dist/football-tactics.js';

const point=(id,x,z)=>({id,team:id.split('-')[0],x,z,vx:0,vz:0});
const aim=(from,to)=>{const x=to.x-from.x,z=to.z-from.z,d=Math.hypot(x,z);return{x:x/d,z:z/d};};

test('aiming back inside from the byline offers a low cutback from either flank and in either direction',()=>{
 for(const sign of [-1,1])for(const flank of [-1,1])for(const type of ['pass','through']){
  const carrier={...point('home-1',24*flank,47*sign),yaw:sign<0?Math.PI:0,attackSign:sign};
  const ball={x:carrier.x,z:47.6*sign,y:.11};
  const trailing=point('home-8',3*flank,35*sign),near=point('home-9',5*flank,48*sign);
  const directed=passOption([carrier,trailing,near],carrier,ball,{direction:aim(ball,trailing),type});
  assert.equal(directed.delivery,'cutback');assert.equal(directed.player,trailing);
  const flight=passFlight(ball,directed,{type,lane:.9});
  assert.equal(flight.lofted,false);assert.ok(flight.vy<.1);
  assert.ok(flight.vx*flank< -16&&flight.vz*sign<0);
  const t=boxDeliveryTime(Math.hypot(directed.x-ball.x,directed.z-ball.z)),travel=(1-Math.exp(-.39*t))/.39;
  assert.ok(Math.abs(ball.x+flight.vx*travel-directed.x)<1e-8&&Math.abs(ball.z+flight.vz*travel-directed.z)<1e-8);
 }
});

test('the low ball leads a near-post runner and a clearly different direction keeps an ordinary pass',()=>{
 const carrier={...point('home-1',23,-43),yaw:Math.PI,attackSign:-1},ball={x:23,z:-43.6,y:.11};
 const runner={...point('home-8',7,-46),vx:-4,vz:-3},wide=point('home-9',28,-49),trailing=point('home-2',6,-35);
 const delivery=passOption([carrier,runner,wide,trailing],carrier,ball,{direction:aim(ball,runner),type:'through'});
 assert.equal(delivery.player,runner);assert.equal(delivery.delivery,'cross');
 assert.ok(delivery.x<runner.x-.9&&delivery.z<runner.z-.8);
 assert.ok(Math.hypot(delivery.x-runner.x,delivery.z-runner.z)<2.2,'the pass stays within a playable lead');
 const outside=passOption([carrier,runner,wide,trailing],carrier,ball,{direction:aim(ball,wide)});
 assert.equal(outside.player,wide);assert.equal(outside.delivery,undefined);
 const elsewhere={x:ball.x,z:-29,y:.11};
 assert.equal(boxPassTarget(elsewhere,runner,-1),null);
 assert.equal(boxPassTarget(ball,trailing,-1,{direction:{z:-1}}),null);
});

test('a directed low cutback arrives at the moving teammate through actual match physics',()=>{
 const g=createFootballSimulation({humanTeams:['home'],controlMode:'manual',rules:{mode:'league'}}),s=g.state;
 const carrier=s.players.find(p=>p.id==='home-1'),runner=s.players.find(p=>p.id==='home-8');
 for(const p of s.players){if(p!==carrier&&p!==runner)p.dismissed=true;p.decisionAt=p.tackleAt=1e6;}
 Object.assign(carrier,{x:24,z:-47,yaw:Math.PI});Object.assign(runner,{x:4,z:-35,vx:-2,vz:-.8});
 Object.assign(s.ball,{x:24,z:-47.6,y:.11,ownerId:carrier.id});s.phase='playing';
 assert.equal(g.action('through',{direction:aim(s.ball,runner)}),true);
 assert.equal(s.ball.targetId,runner.id);
 assert.ok(s.ball.vx< -16&&s.ball.vz>0&&s.ball.vy<.1);
 let height=0;
 for(let i=0;i<150&&!s.ball.ownerId;i++){g.update(1/60);height=Math.max(height,s.ball.y);}
 assert.ok(height<.14);assert.equal(s.ball.ownerId,runner.id);
});

test('CPU box delivery accounts for the actual lane and can use the deeper recycle when it closes',()=>{
 const carrier={...point('home-1',23,-47),attackSign:-1};
 const ball={x:23,z:-47.6,y:.11},late=point('home-8',5,-36),deep=point('home-2',25,-32);
 const front=[14,17,20,23,26,29].map((x,i)=>point('away-'+(i+1),x,-48.7));
 const clear=planCpuAttack(carrier,ball,[carrier,late,deep,...front]);
 assert.equal(clear.action?.tactic,'cutback');assert.equal(clear.action.option.player,late);assert.equal(clear.action.option.delivery,'cutback');
 const mark=point('away-7',(ball.x+late.x)/2,(ball.z+late.z)/2);
 const blocked=planCpuAttack(carrier,ball,[carrier,late,deep,mark,...front]);
 assert.equal(blocked.action?.tactic,'recycle');assert.equal(blocked.action.option.player,deep);
});
