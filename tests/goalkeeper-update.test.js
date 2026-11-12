import test from 'node:test';
import assert from 'node:assert/strict';
import {goalkeeperState,planGoalkeeper,goalkeeperContact} from '../dist/goalkeeper.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {shotOption} from '../dist/football-tactics.js';
import {createReplayRecorder} from '../dist/football-replay.js';
const run=(g,n=1)=>{for(let i=0;i<n;i++)g.update(1/60);};
const keeper=()=>({id:'away-0',index:0,team:'away',keeper:true,x:0,z:-50,keeperState:goalkeeperState()});
function scenario(distance=18,seed=733,sign=-1){
 const g=createFootballSimulation({difficulty:'regular',seed});run(g,190);const s=g.state,p=s.players.find(p=>p.id===s.controlledId);
 s.attackDirections={home:sign,away:-sign};
 for(const q of s.players){q.attackSign=s.attackDirections[q.team];if(q.id!==p.id&&!q.keeper)Object.assign(q,{x:q.team==='home'?28:-28,z:-sign*30,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6});}
 Object.assign(p,{x:0,z:sign*(52.5-distance),yaw:sign<0?Math.PI:0,vx:0,vz:0});Object.assign(s.players.find(q=>q.id==='away-0'),{x:0,z:sign*50,vx:0,vz:0});Object.assign(s.ball,{x:0,y:.11,z:p.z+sign*.58,ownerId:p.id,vx:0,vy:0,vz:0});return g;
}
test('a keeper has a reaction delay and cannot reverse an already committed dive',()=>{
 const p=keeper(),b={x:0,y:.3,z:-35,vx:5,vy:3,vz:-28,shot:{id:5,team:'home'}};
 assert.deepEqual(planGoalkeeper(p,b,null,1,'regular'),{x:0,z:-50,speed:0});planGoalkeeper(p,b,null,1.20,'regular');assert.equal(p.keeperState.committed,false);
 Object.assign(b,{x:2.3,z:-46});const dive=planGoalkeeper(p,b,null,1.3,'regular');assert.equal(dive.commit,true);const x=dive.x,direction=dive.direction;Object.assign(b,{x:-3,vx:-30});const later=planGoalkeeper(p,b,null,1.4,'regular');assert.equal(later.x,x);assert.equal(p.keeperState.direction,direction);
});
test('saves need a physical swept hand or body hit, and a parry leaves a recovery window',()=>{
 const p=keeper();Object.assign(p.keeperState,{committed:true,targetY:.8,phase:'set'});const b={x:1.35,y:.8,z:-49.8,vx:0,vy:0,vz:-28,ownerId:null,shot:{id:1,team:'home'}};
 assert.equal(goalkeeperContact(p,b,{...b,z:-49.4},1,'regular'),null,'nearby is not the same as contact');b.x=0;assert.equal(goalkeeperContact(p,b,{...b,z:-49.4},1,'regular').kind,'parry');p.keeperState.blockedUntil=1.52;assert.equal(goalkeeperContact(p,b,b,1.3,'regular'),null);b.y=3;assert.equal(goalkeeperContact(p,b,b,2,'regular'),null);
});
test('angle positioning stays inside the posts, and a keeper comes out to challenge close dribbling',()=>{
 const p=keeper(),owner={id:'home-1',team:'home'},wide=planGoalkeeper(p,{x:30,z:-28,vx:0,vz:0},owner,0,'regular');assert.ok(Math.abs(wide.x)<=2.4);
 const close=planGoalkeeper(p,{x:1,z:-46,vx:0,vz:0},owner,.1,'regular');assert.equal(p.keeperState.phase,'smother');assert.ok(close.z>-50);assert.ok(close.speed>4);
});
test('an open-play keeper can block a close low shot while still reacting, with no reach outside the set stance',()=>{
 const p=keeper(),ball={x:.56,y:.43,z:-49.86,vx:0,vy:0,vz:-29,ownerId:null,shot:{id:3,team:'home',at:1}},openPlay={openPlay:true};
 planGoalkeeper(p,ball,null,1.01,'regular',openPlay);
 assert.ok(p.keeperState.readAt>1.18);
 assert.equal(p.keeperState.committed,false);
 assert.equal(goalkeeperContact(p,ball,{...ball,z:-49.3},1.03,'regular',openPlay)?.kind,'parry');
 for(const point of [{x:1.6},{y:1.86}]){
  const shot={...ball,...point};
  assert.equal(goalkeeperContact(p,shot,{...shot,z:-49.3},1.03,'regular',openPlay),null);
 }
});
test('a near-range centre drive is harder to score than a clean corner at either end',()=>{
 for(const sign of [-1,1]){
  let centreSaves=0,cornerGoals=0;
  for(let seed=1;seed<=6;seed++){
   for(const aim of [0,seed%2?-1:1]){
    const g=scenario(8,seed*733,sign),s=g.state;
    s.players.find(p=>p.id==='away-0').x=(seed%3-1)*.6;
    assert.equal(g.action('shoot',{power:aim?.9:.45,direction:{x:aim,z:sign}}),true);
    for(let i=0;i<90&&!s.score.home&&!s.stats.away.saves;i++)run(g);
    if(aim)cornerGoals+=s.score.home;
    else centreSaves+=s.stats.away.saves;
   }
  }
  assert.ok(centreSaves>=5, 'a set keeper must be able to cover the centre');
  assert.ok(cornerGoals>=4, 'a close, well-placed drive can still beat the keeper');
 }
});
test('normal open shots can score from 18 and 24 metres through actual flight while central shots can be parried',()=>{
 for(const distance of[18,24]){let goals=0,saves=0;for(let seed=1;seed<=6;seed++){const g=scenario(distance,seed*733);g.action('shoot',{power:.9,direction:{x:1,z:0}});for(let i=0;i<180;i++){g.update(1/60);if(g.state.phase==='goal'||g.state.stats.away.saves)break;}goals+=g.state.score.home;saves+=g.state.stats.away.saves;}assert.ok(goals>0,distance+' m shots must not all be auto-saved');assert.ok(goals<=6&&saves<=6);}
 const g=scenario();g.action('shoot',{power:.55,direction:{x:0,z:-1}});for(let i=0;i<180&&!g.state.stats.away.saves;i++)g.update(1/60);assert.ok(g.state.stats.away.saves>0);assert.equal(g.state.lastShot.outcome,'parried');assert.equal(g.state.ball.ownerId,null);assert.equal(g.state.stats.home.onTarget,1);const saves=g.state.stats.away.saves;run(g,10);assert.equal(g.state.stats.away.saves,saves,'same keeper cannot instantly recollect its own deflection');assert.equal(g.state.ball.ownerId,null);
});
test('drive, finesse and lob use different real trajectories and invalid modes fall back safely',()=>{
 const p={team:'home',x:0,z:-30},b={x:0,y:.11,z:-30},options={direction:{x:1,z:-1},power:.7},drive=shotOption(p,b,options),finesse=shotOption(p,b,{...options,kind:'finesse'}),lob=shotOption(p,b,{...options,kind:'lob'});assert.equal(drive.curve,0);assert.ok(finesse.curve>0);assert.ok(lob.flight>drive.flight);assert.ok(lob.vy>drive.vy);assert.ok(drive.speed>finesse.speed);for(const shot of[drive,finesse,lob])assert.ok(Object.values(shot).filter(x=>typeof x==='number').every(Number.isFinite));
 const g=scenario();assert.equal(g.setShotKind('finesse'),'finesse');assert.equal(g.setShotKind('bad'),'drive');g.setShotKind('lob');g.action('shoot');assert.equal(g.state.ball.shot.kind,'lob');
});
test('replay keeper decisions and shot records are detached from the live game',()=>{
 const g=scenario(),r=createReplayRecorder();g.action('shoot',{power:.7});for(let i=0;i<30;i++){g.update(1/60);r.record(g.state);}const clip=r.clip(),before=JSON.stringify(clip);assert.ok(clip);g.state.players[0].keeperState.targetX=99;g.state.lastShot.outcome='other';if(g.state.ball.shot)g.state.ball.shot.id=999;assert.equal(JSON.stringify(clip),before);assert.notEqual(r.clip().frames[0].players[0].keeperState.targetX,99);
});

function keeperCollection(g,{speed=8,shot=null}={}){
 const s=g.state;for(const p of s.players)Object.assign(p,{x:25,z:p.team==='home'?40:-30,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6});
 const k=s.players.find(p=>p.keeper&&p.team==='away');Object.assign(k,{x:0,z:-48,keeperState:goalkeeperState()});
 Object.assign(s.ball,{ownerId:null,x:0,y:speed<5?.3:.9,z:speed<5?-47.7:-47.3,vx:0,vz:-speed,vy:0,shot,targetId:null,receivePoint:null});
 for(let i=0;i<20&&s.ball.ownerId!==k.id;i++)g.update(1/60);assert.equal(s.ball.ownerId,k.id);return s;
}

test('ordinary keeper collections are not saves, while a slow real shot counts once even after a parry',()=>{
 const ordinary=scenario(),plain=keeperCollection(ordinary);assert.equal(plain.stats.away.saves,0);assert.equal(plain.stats.home.shots,0);assert.equal(plain.stats.home.onTarget,0);assert.equal(plain.events.at(-1).type,'receive');
 const game=scenario();game.action('shoot',{power:.55,direction:{x:0,z:-1}});for(let i=0;i<180&&!game.state.stats.away.saves;i++)game.update(1/60);
 assert.equal(game.state.lastShot.outcome,'parried');assert.equal(game.state.stats.away.saves,1);const shot={...game.state.ball.shot};run(game,40);
 const resumed=createFootballSimulation(),legacy=createFootballSimulation(),oldSnapshot=game.checkpoint();delete oldSnapshot.lastSavedShotId;resumed.restore(game.checkpoint());legacy.restore(oldSnapshot);
 const again=keeperCollection(game,{speed:3,shot}),restored=keeperCollection(resumed,{speed:3,shot}),oldRestored=keeperCollection(legacy,{speed:3,shot});assert.equal(again.stats.away.saves,1,'a second contact with the same shot does not add another save');assert.equal(again.stats.home.onTarget,1);assert.equal(restored.stats.away.saves,1,'server checkpoint recovery preserves save deduplication');assert.equal(oldRestored.stats.away.saves,1,'existing server checkpoints migrate their saved-shot identity');assert.deepEqual(resumed.checkpoint(),game.checkpoint());assert.deepEqual(legacy.checkpoint(),game.checkpoint());
 const fresh=scenario();fresh.action('shoot',{power:.55});const slow=keeperCollection(fresh,{speed:3,shot:{...fresh.state.ball.shot}});assert.equal(slow.stats.away.saves,1,'a genuine slow shot still counts');assert.equal(slow.stats.home.onTarget,1);
});
