import {createFootballSimulation} from './football-simulation.js';
import {trainingDrills,validTrainingDrill,trainingLayout,trainingGates} from './football-training-layout.js';

export {trainingDrills};
const finiteTime=dt=>Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;

// A local lesson adapter over the same flight, reception and goalkeeper simulation
// as a match. Progress comes from physical contacts / resolved shots, never rolls.
export function createFootballTraining({drill='free',...settings}={}){
 let engine,lesson,lastEvent=0,pendingPass=null,pendingShot=null,recoverAt=null,gateIndex=0;
 const preferences={...settings};
 function start(id){
  const definition=trainingDrills.find(d=>d.id===validTrainingDrill(id));
  engine=createFootballSimulation({...preferences,rules:null,practice:definition.id,humanTeams:['home'],duration:3600});
  lesson={id:definition.id,title:definition.title,instruction:definition.instruction,
   hint:definition.id==='shooting'?'移动调整角度 · 按住射门蓄力，松开出脚':definition.id==='passing'?'朝队友方向短传 · 半自动会在接球后切换控制':'移动、转向、加速 · 不设倒计时',
   feedback:'训练就绪',completed:false,attempt:1,attemptLimit:definition.attemptLimit,
   targetCount:definition.targetCount,successCount:0,elapsed:0,
   metrics:{passes:0,completedPasses:0,shots:0,onTarget:0,goals:0,gates:0,streak:0,bestStreak:0},
   targets:[],activeIds:trainingLayout(definition.id).map(p=>p.id)};
  engine.state.training=lesson;
  pendingPass=pendingShot=recoverAt=null;gateIndex=0;lastEvent=engine.state.eventCount;
  refreshTargets();return engine.state;
 }
 function feedback(message){lesson.feedback=message;engine.state.message=message;}
 function finish(message){
  lesson.completed=true;recoverAt=null;engine.state.phase='fulltime';engine.state.phaseTime=0;engine.state.paused=true;
  Object.assign(engine.state.ball,{vx:0,vy:0,vz:0});
  for(const p of engine.state.players)p.vx=p.vz=0;
  feedback(message);
 }
 function refreshTargets(){
  const s=engine.state;
  if(lesson.id==='free')lesson.targets=trainingGates.map((p,i)=>({id:'gate-'+i,kind:'gate',...p,radius:1.8,active:i===gateIndex,completed:i<gateIndex}));
  else if(lesson.id==='passing')lesson.targets=s.players.filter(p=>!p.trainingInactive).map(p=>({id:p.id,kind:'receiver',x:p.x,z:p.z,radius:1.1,active:p.id!==(s.ball.ownerId||s.controlledId),completed:false}));
  else lesson.targets=[{id:'goal',kind:'goal',x:0,z:-52.5,radius:3.66,active:!pendingShot&&!lesson.completed,completed:lesson.completed}];
 }
 function resetAttempt(){
  if(lesson.completed)return false;
  if(lesson.id==='shooting'&&pendingShot&&!pendingShot.resolved){feedback('本次足球仍在运动 · 结果落定后重试');return false;}
  const paused=engine.state.paused;
  if(pendingPass)lesson.metrics.streak=0;
  lesson.attempt=lesson.id==='shooting'?lesson.metrics.shots+1:lesson.attempt+1;
  pendingPass=pendingShot=recoverAt=null;
  engine.resetPractice(lesson.attempt);engine.setPaused(paused);lastEvent=engine.state.eventCount;
  feedback('已回到训练标记 · 继续练习');refreshTargets();return true;
 }
 function missPass(message){
  pendingPass=null;lesson.metrics.streak=0;feedback(message);
 }
 function consumeEvents(){
  const s=engine.state;
  for(const event of s.events){
   if(event.id<=lastEvent)continue;
   if(event.team==='home'&&(event.type==='pass'||event.type==='through')){
    lesson.metrics.passes++;
    if(lesson.id==='passing')pendingPass={targetId:event.targetId,until:s.time+8};
   }else if(event.type==='training-receive'&&pendingPass){
    if(event.playerId===pendingPass.targetId&&event.team==='home'){
     lesson.metrics.completedPasses++;lesson.metrics.streak++;
     lesson.metrics.bestStreak=Math.max(lesson.metrics.bestStreak,lesson.metrics.streak);
     lesson.successCount=lesson.metrics.completedPasses;pendingPass=null;
     feedback('传接成功 · '+lesson.successCount+' / '+lesson.targetCount);
     if(lesson.successCount>=lesson.targetCount)finish('传接练习完成 · '+lesson.metrics.completedPasses+' 次真实接球');
    }else missPass('未传到指定队友 · 调整方向再试');
   }else if(event.type==='shot'&&event.team==='home'){
    lesson.metrics.shots++;
    if(lesson.id==='shooting'){
     pendingShot={id:event.shotId,at:s.time,resolved:false};
     feedback('第 '+lesson.metrics.shots+' 次射门 · 观察球路');
    }
   }else if(event.type==='training-out'){
    if(pendingPass)missPass('足球出界 · 稍作调整再传');
    if(!pendingShot)recoverAt=s.time+.9;
   }
  }
  lastEvent=s.eventCount;
 }
 function observeShot(){
  if(!pendingShot||pendingShot.resolved)return;
  const s=engine.state,shot=s.lastShot;
  if(!shot||shot.id!==pendingShot.id)return;
  const terminal=['goal','saved','blocked','wide','short'].includes(shot.outcome);
  // Parried shots and woodwork remain live until a rebound is caught, goes out,
  // scores, or settles. A rebound that crosses the line is still a real goal.
  const settled=(shot.outcome==='parried'||shot.outcome==='woodwork')&&(!!s.ball.ownerId||s.phase!=='playing'||s.ball.y<.16&&Math.hypot(s.ball.vx,s.ball.vz)<.6||s.ball.z>-46&&s.ball.vz>0&&s.time-shot.updatedAt>.45);
  if(!terminal&&!settled)return;
  pendingShot.resolved=true;
  lesson.metrics.onTarget=s.stats.home.onTarget;
  if(shot.outcome==='goal')lesson.metrics.goals++;
  lesson.successCount=lesson.metrics.goals;
  const labels={goal:'进球',saved:'门将扑住',parried:'门将扑出',blocked:'被封堵',wide:'偏出',short:'未形成威胁',woodwork:'击中门框'};
  feedback((labels[shot.outcome]||'球路结束')+' · '+lesson.metrics.shots+' / '+lesson.attemptLimit+' 次起脚');
  if(lesson.metrics.shots>=lesson.attemptLimit)finish('射门练习完成 · '+lesson.metrics.goals+' 球 / '+lesson.metrics.onTarget+' 次射正');
  else recoverAt=s.time+1.05;
 }
 function update(dt,input={}){
  if(engine.state.paused||lesson.completed)return engine.state;
  const step=finiteTime(dt);engine.update(step,input);lesson.elapsed=engine.state.time;
  consumeEvents();if(lesson.completed)return engine.state;
  const s=engine.state;
  if(lesson.id==='free'){
   const marker=trainingGates[gateIndex],owner=s.players.find(p=>p.id===s.ball.ownerId);
   if(owner?.team==='home'&&s.ball.y<.7&&near(s.ball,marker,1.8)){
    lesson.metrics.gates++;lesson.successCount=lesson.metrics.gates;gateIndex=(gateIndex+1)%trainingGates.length;
    feedback('控球标记 '+lesson.metrics.gates+' · 前往下一个');
   }
   lesson.metrics.goals=s.score.home;lesson.metrics.onTarget=s.stats.home.onTarget;
  }else if(lesson.id==='passing'&&pendingPass&&s.time>pendingPass.until){
   missPass('传球未接稳 · 重新组织');recoverAt=s.time+.7;
  }else if(lesson.id==='shooting'){lesson.metrics.onTarget=s.stats.home.onTarget;observeShot();}
  if(s.phase==='goal'&&!pendingShot&&recoverAt===null){feedback('带球越过门线 · 回到标记练习起脚');recoverAt=s.time+1;}
  if(recoverAt!==null&&s.time>=recoverAt&&!lesson.completed){const result=lesson.feedback;if(resetAttempt())feedback(result+' · 下一次已就位');}
  refreshTargets();return engine.state;
 }
 function action(type,options={},team='home'){
  if(type==='restart'){start(lesson.id);return true;}
  if(type==='resetAttempt')return resetAttempt();
  if(team!=='home'||lesson.completed)return false;
  if(type==='shoot'&&lesson.id==='shooting'&&pendingShot){feedback('先观察本次射门结果');return false;}
  const result=engine.action(type,options,team);consumeEvents();refreshTargets();return result;
 }
 start(drill);
 return{
  get state(){return engine.state;},update,action,resetAttempt,
  reset(){return start(lesson.id);},setDrill(id){return start(id);},
  setPaused(value){engine.setPaused(lesson.completed||value);},
  setControlMode(value,team='home'){const mode=engine.setControlMode(value,team);if(team==='home')preferences.controlMode=mode;return mode;},
  setShotKind(value,team='home'){const kind=engine.setShotKind(value,team);if(team==='home')preferences.shotKind=kind;return kind;},
  attackSign(team){return engine.attackSign(team);},
  continuePeriod(){return false;},
  setFormation(){return{ok:false,error:'训练场不使用比赛阵型'};},
  substitute(){return{ok:false,error:'训练场不使用替补'};}
 };
}
