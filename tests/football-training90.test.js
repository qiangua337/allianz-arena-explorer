import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballTraining,trainingDrills} from '../dist/football-training.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {createTrainingRecords} from '../dist/training-records.js';

const tick=(game,seconds,input={})=>{for(let i=0;i<Math.round(seconds*60);i++)game.update(1/60,input);};
function until(game,condition,seconds=12){
 for(let i=0;i<seconds*60&&!condition();i++)game.update(1/60);
 assert.ok(condition(),'physical event should settle within '+seconds+' seconds');
}
function passToMate(game,number=0){
 const s=game.state,owner=s.players.find(p=>p.id===s.ball.ownerId),mate=s.players.filter(p=>p.team==='home'&&!p.trainingInactive&&p.id!==owner.id)[number%2];
 assert.equal(game.action('pass',{direction:{x:mate.x-owner.x,z:mate.z-owner.z},power:.45}),true);
 return mate;
}
function storageFixture(initial){
 let content=initial,writes=0;
 return {get writes(){return writes;},getItem:()=>content,setItem(_key,value){content=value;writes++;}};
}
function driveToNextGate(game){
 const before=game.state.training.metrics.gates;
 for(let i=0;i<900&&game.state.training.metrics.gates===before;i++){
  const marker=game.state.training.targets.find(target=>target.active),ball=game.state.ball;
  const x=marker.x-ball.x,z=marker.z-ball.z,n=Math.hypot(x,z)||1;
  game.update(1/60,{x:x/n,z:z/n,sprint:true});
 }
 assert.equal(game.state.training.metrics.gates,before+1);
}

test('lessons use explicitly inactive actors, not red cards or an abandoned competition',()=>{
 assert.deepEqual(trainingDrills.map(d=>d.id),['free','passing','shooting']);
 for(const [drill,count] of [['free',1],['passing',3],['shooting',2]]){
  const game=createFootballTraining({drill,rules:{mode:'cup',duration:1}}),s=game.state;
  assert.equal(s.players.length,22);assert.equal(s.players.filter(p=>!p.trainingInactive).length,count);
  assert.ok(s.players.every(p=>!p.dismissed));assert.equal(s.competition,null);
  assert.equal(s.phase,'playing');assert.equal(s.controlledId,'home-1');assert.equal(s.ball.ownerId,'home-1');
  assert.equal(game.continuePeriod(),false);assert.equal(game.substitute().ok,false);
 }
 const match=createFootballSimulation();assert.equal(match.state.phase,'kickoff');
 assert.ok(match.state.players.every(p=>!Object.hasOwn(p,'trainingInactive')));
 assert.equal(match.state.training,undefined,'normal and online matches have no training state');
});

test('free warmup registers an actual dribbled ball crossing a marker and has no match timer',()=>{
 const game=createFootballTraining({drill:'free',duration:1});tick(game,3,{z:-1});
 assert.equal(game.state.training.metrics.gates,1);assert.equal(game.state.training.targets[1].active,true);
 assert.ok(game.state.ball.z<20);assert.equal(game.state.ball.ownerId,'home-1');
 tick(game,4);assert.equal(game.state.phase,'playing');assert.equal(game.state.training.completed,false);
 assert.equal(game.state.score.home,0);assert.ok(game.state.training.elapsed>6.9);
});

test('five passes finish only after five physical teammate receptions',()=>{
 const storage=storageFixture(),records=createTrainingRecords(storage),game=createFootballTraining({drill:'passing',records});
 for(let index=0;index<5;index++){
  const receiver=passToMate(game,index),s=game.state;
  assert.equal(s.ball.ownerId,null);assert.ok(Math.hypot(s.ball.vx,s.ball.vz)>10);
  assert.equal(s.training.metrics.completedPasses,index,'starting a pass awards no completion');
  assert.equal(storage.writes,0,'incomplete pass rounds do not save a result');
  tick(game,.1);assert.equal(s.training.metrics.completedPasses,index,'a ball in flight has not been received');
  until(game,()=>s.training.metrics.completedPasses===index+1);
  assert.equal(s.ball.ownerId,receiver.id);assert.equal(s.training.metrics.passes,index+1);
 }
 assert.equal(game.state.training.successCount,5);assert.equal(game.state.training.completed,true);
 assert.equal(game.state.phase,'fulltime');assert.equal(game.state.paused,true);
 assert.deepEqual(game.state.score,{home:0,away:0});assert.equal(game.state.competition,null);
 assert.deepEqual(createTrainingRecords(storage).get('passing'),game.state.training.record);
 assert.equal(game.state.training.record.attempts,5);assert.ok(game.state.training.record.seconds>0);
 assert.equal(storage.writes,1);assert.equal(game.state.training.newRecord,true);
 game.reset();assert.equal(game.state.training.newRecord,false);assert.equal(game.state.training.record.attempts,5);
});

test('an unreceived pass does not award progress and reset preserves earned progress',()=>{
 const game=createFootballTraining({drill:'passing'});passToMate(game);
 until(game,()=>game.state.training.metrics.completedPasses===1);
 passToMate(game,1);assert.equal(game.state.training.metrics.completedPasses,1);
 assert.equal(game.resetAttempt(),true);
 assert.equal(game.state.training.metrics.passes,2);assert.equal(game.state.training.metrics.completedPasses,1);
 assert.equal(game.state.ball.ownerId,'home-1');assert.equal(game.state.ball.vx,0);
 tick(game,3);assert.equal(game.state.training.metrics.completedPasses,1,'the abandoned flight cannot count later');
 for(let i=0;i<10;i++){game.action('switch',{direction:{x:Math.sin(i),z:Math.cos(i)}});assert.ok(game.state.training.activeIds.includes(game.state.controlledId));}
});

test('shots are real flights: a central attempt is saved and a well struck corner can score',()=>{
 for(const [direction,power,goal] of [[{x:0,z:-1},.6,false],[{x:1,z:-.2},.75,true]]){
  const game=createFootballTraining({drill:'shooting'});
  assert.equal(game.action('shoot',{direction,power}),true);
  assert.equal(game.state.ball.ownerId,null);assert.equal(game.state.training.metrics.shots,1);
  assert.equal(game.state.training.metrics.goals,0,'pressing shoot never awards a goal');
  assert.equal(game.resetAttempt(),false,'a live shot cannot be erased before its result');
  let outcome=null;
  for(let i=0;i<360&&game.state.training.attempt===1;i++){game.update(1/60);if(game.state.lastShot)outcome=game.state.lastShot.outcome;}
  assert.equal(game.state.training.attempt,2);assert.equal(outcome,goal?'goal':'parried');
  assert.equal(game.state.training.metrics.goals,goal?1:0);assert.equal(game.state.score.home,goal?1:0);
  assert.equal(game.state.training.metrics.onTarget,1);
  assert.equal(game.state.training.metrics.shots,1,'automatic reset does not fabricate another shot');
 }
});

test('eight resolved physical shots complete a lesson without a half or artificial match score',()=>{
 const storage=storageFixture(),records=createTrainingRecords(storage),game=createFootballTraining({drill:'shooting',records});
 for(let i=0;i<8;i++){
  assert.equal(game.action('shoot',{direction:{x:i%2?-.9:.9,z:-.2},power:.75}),true);
  assert.equal(storage.writes,0,'the shot must settle before saving the round');
  until(game,()=>game.state.training.completed||game.state.training.attempt>i+1);
 }
 const s=game.state;assert.equal(s.training.metrics.shots,8);assert.equal(s.stats.home.shots,8);
 assert.equal(s.training.completed,true);assert.equal(s.phase,'fulltime');assert.equal(s.competition,null);
 assert.equal(s.training.metrics.goals,s.score.home);assert.equal(s.training.metrics.onTarget,s.stats.home.onTarget);
 assert.ok(s.training.metrics.goals>0);assert.ok(s.training.metrics.goals<=8);
 assert.deepEqual(createTrainingRecords(storage).get('shooting'),{goals:s.training.metrics.goals,onTarget:s.training.metrics.onTarget});
 const finished=structuredClone(s);game.setPaused(false);tick(game,3,{z:-1});assert.deepEqual(s,finished);
});

test('the dribbling record needs four actual markers on one unbroken lap and survives a reload',()=>{
 const storage=storageFixture(),records=createTrainingRecords(storage),game=createFootballTraining({drill:'free',records});
 driveToNextGate(game);game.resetAttempt();
 for(let i=0;i<3;i++)driveToNextGate(game);
 assert.equal(storage.writes,0,'resetting the ball invalidates the current lap');
 for(let i=0;i<4;i++)driveToNextGate(game);
 assert.equal(storage.writes,1);
 assert.ok(game.state.training.record.seconds>1);
 assert.deepEqual(createFootballTraining({drill:'free',records:createTrainingRecords(storage)}).state.training.record,game.state.training.record);
});

test('training record storage rejects damaged values, keeps stronger scores and tolerates unavailable storage',()=>{
 const storage=storageFixture(JSON.stringify({free:{seconds:-1},passing:{seconds:1,attempts:4},shooting:{goals:9,onTarget:9}}));
 const records=createTrainingRecords(storage);
 for(const id of ['free','passing','shooting'])assert.equal(records.get(id),null);
 assert.equal(records.submit('free',{seconds:8}),true);
 assert.equal(records.submit('free',{seconds:9}),false);
 assert.equal(records.submit('passing',{attempts:6,seconds:9}),true);
 assert.equal(records.submit('passing',{attempts:5,seconds:12}),true,'efficiency wins before time');
 assert.equal(records.submit('passing',{attempts:5,seconds:11}),true);
 assert.equal(records.submit('shooting',{goals:3,onTarget:6}),true);
 assert.equal(records.submit('shooting',{goals:2,onTarget:8}),false);
 assert.equal(records.submit('shooting',{goals:3,onTarget:7}),true);
 const otherTab=createTrainingRecords(storage);
 assert.equal(otherTab.submit('free',{seconds:7}),true);
 assert.equal(records.submit('free',{seconds:7.5}),false,'an older tab cannot overwrite the newer record');
 assert.deepEqual(otherTab.get('shooting'),{goals:3,onTarget:7});
 const denied=createTrainingRecords({getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}});
 assert.equal(denied.submit('free',{seconds:8}),true);
 assert.deepEqual(denied.get('free'),{seconds:8});
});

test('pausing freezes the lesson, invalid deltas do not advance it, and restart clears all progress',()=>{
 const game=createFootballTraining({drill:'free'});tick(game,3,{z:-1});
 game.setPaused(true);const paused=structuredClone(game.state);tick(game,2,{z:-1});assert.deepEqual(game.state,paused);
 game.setPaused(false);const elapsed=game.state.time;for(const value of [NaN,Infinity,-1])game.update(value);
 assert.equal(game.state.time,elapsed);
 game.setControlMode('manual');game.setShotKind('finesse');game.setDrill('passing');
 assert.equal(game.state.controlMode,'manual');assert.equal(game.state.shotKind,'finesse');
 assert.equal(game.state.training.metrics.gates,0);assert.equal(game.state.training.elapsed,0);
 assert.equal(game.state.training.id,'passing');assert.equal(game.state.paused,false);
 game.action('restart');assert.equal(game.state.training.attempt,1);assert.equal(game.state.training.successCount,0);
});

test('manual reception awards a real reception even without automatic cursor takeover',()=>{
 const game=createFootballTraining({drill:'passing',controlMode:'manual'}),mate=passToMate(game);
 until(game,()=>game.state.training.metrics.completedPasses===1);
 assert.equal(game.state.ball.ownerId,mate.id);assert.equal(game.state.controlledId,'home-1');
 assert.ok(game.state.events.some(e=>e.type==='training-receive'&&e.playerId===mate.id));
});

test('dribbling out resets to the training spot without giving an inactive opponent a restart',()=>{
 const game=createFootballTraining({drill:'free'});
 for(let i=0;i<600&&game.state.phase==='playing';i++)game.update(1/60,{x:1,z:.15,sprint:true});
 assert.equal(game.state.phase,'kickoff');assert.ok(game.state.events.some(e=>e.type==='training-out'));
 until(game,()=>game.state.phase==='playing');
 assert.equal(game.state.ball.ownerId,'home-1');assert.equal(game.state.training.attempt,2);
 assert.equal(game.state.training.successCount,0);assert.equal(game.state.training.metrics.goals,0);
 assert.ok(game.state.players.filter(p=>p.team==='away').every(p=>p.trainingInactive));
});

test('phone frame rates preserve the real first shot outcome and finite training actors',()=>{
 const results=[];
 for(const fps of [15,30,60]){
  const game=createFootballTraining({drill:'shooting'});game.action('shoot',{power:.75,direction:{x:.9,z:-.2}});
  for(let i=0;i<fps*8&&game.state.training.attempt===1;i++)game.update(1/fps);
  results.push({...game.state.training.metrics});
  assert.ok(game.state.players.every(p=>[p.x,p.z,p.vx,p.vz,p.yaw].every(Number.isFinite)));
  assert.equal(game.state.training.attempt,2);
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
