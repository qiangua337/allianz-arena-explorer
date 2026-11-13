import {createCompetition,nextPeriod,shootoutWinner,assessChallenge,competitionModes,intervalLabel} from './football-rules.js';
import {createTeamSheet,footballFormations,squadDefinition} from './football-squads.js';
import {goalkeeperState,goalkeeperProfile} from './goalkeeper.js';
import {moveHumanPenaltyKeeper,penaltyCanShoot,penaltyDiveDirection,penaltyDiveHeight,penaltyDiveLead,penaltyKeeperSpeed,penaltyStandardPower,penaltyTarget,safePenaltyAim} from './football-penalty.js';
const other=t=>t==='home'?'away':'home',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const LAST_ATTACK_SECONDS=2.5,MAX_ADDED_MINUTES=3,CLOCK_EPSILON=1e-8;
const newAddedTime=()=>({lost:0,minimum:0,played:0,attackingTeam:null});
export function createFootballRegulations(s,ctx,{rules=null,duration=180,opponent='dortmund',selections={}}={}){
 const active=()=>s.players.filter(p=>!p.dismissed),byId=id=>s.players.find(p=>p.id===id),name=t=>t==='home'?'拜仁':s.fixture.short;
 const control=(team,p)=>{s.controlledIds[team]=p.id;if(team==='home')s.controlledId=p.id;};
 function reset(){s.setPiece=null;s.competition=rules?createCompetition(rules,duration):null;if(s.competition)s.competition.addedTime=newAddedTime();s.attackDirections={home:-1,away:1};s.teamSheets={home:createTeamSheet(selections.home,'home',opponent),away:createTeamSheet(selections.away,'away',opponent)};s.discipline={home:{fouls:0,yellows:0,reds:0},away:{fouls:0,yellows:0,reds:0},cards:[],lastDecision:null};s.rosterRevision=0;}
 function synchronizeEnds(){for(const p of s.players)p.attackSign=s.attackDirections[p.team];}
 function stop(){for(const p of s.players)p.vx=p.vz=0;Object.assign(s.ball,{vx:0,vy:0,vz:0});}
 function finish(reason='regular',winner){stop();s.phase='fulltime';s.phaseTime=0;s.paused=false;if(s.competition)s.competition.result={reason,winner:winner??(s.score.home===s.score.away?null:s.score.home>s.score.away?'home':'away')};ctx.emit('fulltime',winner||null,reason==='penalties'?name(winner)+'赢得点球大战':reason==='abandoned'?'球员不足七人，比赛终止':'全场结束 · '+s.score.home+' : '+s.score.away);}
 function interval(next){s.stoppageId++;stop();s.phase='interval';s.phaseTime=0;s.paused=true;s.competition.next=next;applyPending(true);ctx.emit('interval',null,intervalLabel(s.competition));}
 function nominalEnd(){const c=s.competition;return c?c.periodStart+c.periodLength:s.duration;}
 function finalAttack(){
  if(s.phase!=='playing')return null;
  const b=s.ball,owner=byId(b.ownerId);
  if(owner){
   const sign=s.attackDirections[owner.team],depth=b.z*sign;
   return !owner.keeper&&Math.abs(b.x)<=20.16&&depth>=36&&
    (owner.vz*sign>.8||depth>=43&&owner.vz*sign>=-.6)?owner.team:null;
  }
  const target=byId(b.targetId),shot=b.shot?.team,team=shot||target?.team,sign=s.attackDirections[team];
  if(!sign||Math.abs(b.x)>25||b.z*sign<27||b.vz*sign<=2)return null;
  if(shot){
   const seconds=(52.5-b.z*sign)/(b.vz*sign);
   return seconds>=0&&seconds<=1.7&&Math.abs(b.x+b.vx*seconds)<=9?team:null;
  }
  return target&&!target.keeper&&Math.abs(target.x)<=21&&target.z*sign>=36?team:null;
 }
 function periodEnd(dt=0){
  const c=s.competition,end=nominalEnd();
  if(!c||c.stage==='shootout'||s.elapsed<end-CLOCK_EPSILON)return false;
  s.elapsed=end;
  const added=c.addedTime??=newAddedTime();
  if(!added.minimum){
   const minute=c.periodLength/(c.period>2?15:45);
   // Dead balls already pause the compressed match clock. Count a bounded
   // share toward the playable minimum, with at least one match minute.
   const minutes=clamp(Math.ceil(added.lost*.5/minute-CLOCK_EPSILON),1,MAX_ADDED_MINUTES);
   added.minimum=minute*minutes;
  }
  added.played=Math.min(added.minimum+LAST_ATTACK_SECONDS,added.played+dt);
  if(s.setPiece||added.played<added.minimum-CLOCK_EPSILON)return false;
  const team=finalAttack();
  if(team&&(!added.attackingTeam||added.attackingTeam===team)&&added.played<added.minimum+LAST_ATTACK_SECONDS-CLOCK_EPSILON){
   added.attackingTeam=team;
   return false;
  }
  added.attackingTeam=null;
  const next=nextPeriod(c,s.score);
  if(next)interval(next);else finish(c.period>2?'extraTime':'regular');
  return true;
 }
 function continuePeriod(){const c=s.competition;if(!c||s.phase!=='interval')return false;const next=c.next;c.next=null;s.paused=false;applyPending(true);if(next==='shootout'){beginShootout();return true;}c.period=next;c.stage=next>2?'extraTime':'regulation';c.periodStart=s.elapsed;c.periodLength=next>2?c.regulationDuration/6:c.regulationDuration/2;c.addedTime=newAddedTime();if(next===3)s.duration=c.regulationDuration*4/3;s.attackDirections={home:next%2?-1:1,away:next%2?1:-1};synchronizeEnds();for(const p of active())p.stamina=Math.min(1,p.stamina+(next===2?.16:.09));ctx.kickoff(next%2?'home':'away');return true;}
 function setFormation(team,formation){if(!Object.hasOwn(footballFormations,formation))return{ok:false,error:'请选择支持的阵型'};s.teamSheets[team].formation=formation;s.rosterRevision++;ctx.emit('formation',team,name(team)+'调整为 '+footballFormations[formation].label);return{ok:true};}
 function substitute(team,outId,inNumber){const sheet=s.teamSheets[team],out=byId(outId),member=squadDefinition(team,opponent,inNumber),extra=s.competition?.period>2&&s.competition.extraSubstitution?1:0;
  if(s.phase==='fulltime'||s.competition?.stage==='shootout')return{ok:false,error:'当前阶段不能换人'};
  if(!out||out.team!==team||out.dismissed||!member||!sheet.bench.includes(inNumber)||sheet.used.includes(inNumber))return{ok:false,error:'请选择在场球员与尚未登场的本队替补'};
  if(!!out.keeper!==!!member.keeper)return{ok:false,error:'请保持场上一名门将，门将与门将互换'};
  if(sheet.pending.some(p=>p.outId===outId||p.inNumber===inNumber))return{ok:false,error:'这名球员已有待执行换人'};
  if(sheet.substitutions.length+sheet.pending.length>=5+extra)return{ok:false,error:'本队换人名额已用完'};
  const free=s.phase==='interval',windows=3+(extra?1:0);if(!free&&sheet.windows>=windows&&(!['kickoff','goal'].includes(s.phase)||sheet.lastWindow!==s.stoppageId))return{ok:false,error:'三个换人窗口已用完，可在中场休息调整'};
  sheet.pending.push({outId,inNumber});s.rosterRevision++;if(['interval','kickoff','goal'].includes(s.phase))applyPending(free);else ctx.emit('sub-request',team,name(team)+'已请求换人，下一次死球执行');return{ok:true,queued:sheet.pending.length>0};
 }
 function applyPending(free=false){for(const team of ['home','away']){const sheet=s.teamSheets?.[team];if(!sheet?.pending.length)continue;const windows=3+(s.competition?.period>2&&s.competition.extraWindow?1:0);if(!free&&sheet.windows>=windows&&sheet.lastWindow!==s.stoppageId)continue;let count=0;for(const request of sheet.pending){const p=byId(request.outId),member=squadDefinition(team,opponent,request.inNumber);if(!p||p.dismissed||!member||sheet.used.includes(request.inNumber))continue;const old=p.number;sheet.xi[p.index]=request.inNumber;sheet.bench=sheet.bench.filter(n=>n!==request.inNumber);sheet.bench.push(old);sheet.used.push(request.inNumber);sheet.substitutions.push({out:old,in:request.inNumber,at:s.elapsed,period:s.competition?.period||1});Object.assign(p,{number:request.inNumber,name:member.player.name,stamina:1,cautions:0,fouls:0,motion:null,lungeUntil:0,tackleWindowUntil:0});count++;ctx.emit('substitution',team,old+' ↓  '+request.inNumber+' '+p.name+' ↑',p.id);}sheet.pending=[];if(count&&!free&&sheet.lastWindow!==s.stoppageId){sheet.windows++;sheet.lastWindow=s.stoppageId;}s.rosterRevision++;}}
 function foul(defender,owner,ball,clean=false){if(!s.competition||s.phase!=='playing'||s.setPiece)return false;const verdict=assessChallenge(defender,owner,ball,clean);if(!verdict)return false;const previousControlledIds={...s.controlledIds};defender.fouls=(defender.fouls||0)+1;s.discipline[defender.team].fouls++;let card=verdict.card;
  if(card==='yellow'){defender.cautions=(defender.cautions||0)+1;s.discipline[defender.team].yellows++;if(defender.cautions>=2)card='second-yellow';}
  if(card){s.discipline.cards.push({team:defender.team,number:defender.number,name:defender.name,card,at:s.elapsed});if(s.discipline.cards.length>30)s.discipline.cards.shift();ctx.emit('card',defender.team,defender.name+' · '+({yellow:'黄牌',red:'红牌','second-yellow':'两黄变一红'}[card]),defender.id);}
  if(card==='red'||card==='second-yellow'){defender.dismissed=true;defender.vx=defender.vz=0;s.discipline[defender.team].reds++;const replacement=active().find(p=>p.team===defender.team&&!p.keeper);if(replacement&&s.controlledIds[defender.team]===defender.id)control(defender.team,replacement);}
  s.discipline.lastDecision={at:s.time,x:owner.x,z:owner.z,card,playerId:defender.id,reason:verdict.reason};s.rosterRevision++;
  if(active().filter(p=>p.team===defender.team).length<7){finish('abandoned',owner.team);return true;}
  const goal=-s.attackDirections[defender.team]*52.5,penalty=Math.abs(owner.x)<=20.16&&Math.abs(owner.z-goal)<=16.5;
  ctx.restart(penalty?'penaltyKick':'freeKick',owner.team,penalty?0:owner.x,penalty?goal-Math.sign(goal)*11:owner.z);
  const taker=byId(s.ball.ownerId),spot={x:s.ball.x,z:s.ball.z};for(const p of active()){if(p.id===taker.id||p.keeper)continue;const dx=p.x-spot.x,dz=p.z-spot.z,d=Math.hypot(dx,dz);if(d<9.15){p.x=clamp(spot.x+(dx/(d||1))*9.3,-33,33);p.z=clamp(spot.z+(d?dz/d:1)*9.3,-51,51);}if(penalty)p.z=clamp(p.z,-34,34);p.vx=p.vz=0;}
  if(penalty)prepareMatchPenalty(owner.team,previousControlledIds);
  ctx.emit('foul',owner.team,name(owner.team)+' · '+(penalty?'点球':'直接任意球')+' · '+verdict.reason,defender.id);return true;
 }
 // An in-match penalty uses the ordinary score and ball physics. Its temporary
 // controls end on a save, rebound or stoppage; shootout attempts stay separate.
 function prepareMatchPenalty(team,previousControlledIds){const defending=other(team),taker=byId(s.ball.ownerId),keeper=active().find(p=>p.team===defending&&p.keeper),attackSign=s.attackDirections[team],goalZ=attackSign*52.5,spotZ=goalZ-attackSign*11;
  if(!taker||!keeper)return;ctx.clearControlIntents();s.setPiece={type:'penalty',team,defending,taker:taker.id,keeper:keeper.id,stage:'setup',time:0,goalZ,attackSign,previousControlledIds};initializePenalty(s.setPiece);
  for(const p of active()){p.vx=p.vz=0;p.motion=null;p.receiveControl=null;p.lungeUntil=p.tackleWindowUntil=0;}
  Object.assign(keeper,{x:0,z:goalZ-attackSign*.12,yaw:attackSign<0?0:Math.PI,keeperState:goalkeeperState()});
  Object.assign(s.ball,{x:0,y:.11,z:spotZ,vx:0,vy:0,vz:0,shot:null,curve:0,targetId:null,receivePoint:null});
  positionPenaltyTaker(s.setPiece,taker);ctx.setOwner(taker);control(team,taker);control(defending,keeper);s.lastShot=null;
 }
 const penaltyPeriodDue=()=>s.elapsed>=nominalEnd()-CLOCK_EPSILON&&
  (!s.competition||!!s.competition.addedTime?.minimum&&s.competition.addedTime.played>=s.competition.addedTime.minimum-CLOCK_EPSILON);
 function clearMatchPenalty({rebound=false}={}){const k=s.setPiece;if(!k)return;if(rebound&&(k.extended||penaltyPeriodDue())){k.extended=true;return;}const owner=byId(s.ball.ownerId);s.setPiece=null;ctx.clearControlIntents();for(const team of ['home','away']){const current=s.controlledIds[team];if(current!==k.taker&&current!==k.keeper)continue;const previous=byId(k.previousControlledIds?.[team]),fallback=active().filter(p=>p.team===team&&!p.keeper).sort((a,b)=>Math.hypot(a.x-s.ball.x,a.z-s.ball.z)-Math.hypot(b.x-s.ball.x,b.z-s.ball.z))[0],next=owner?.team===team&&!owner.keeper&&s.controlModes[team]!=='manual'?owner:previous&&!previous.dismissed&&!previous.keeper?previous:fallback;if(next)control(team,next);}}
 function initializePenalty(k){
  const humanKeeper=ctx.humans.has(k.defending),humanShooter=ctx.humans.has(k.team);
  k.keeperReady=!humanKeeper;k.kickAllowedAt=humanShooter?0:1.25;k.aiKickDelay=.30+ctx.random()*.26;
  k.pendingKick=null;k.queuedDive=null;k.diveQueued=false;k.runupDuration=0;
  if(!humanKeeper){
   const recent=k.aimHistory?.[k.team]||[],last=recent.at(-1),repeated=!!last&&recent.filter(aim=>Math.abs(aim.x-last.x)<.22&&Math.abs(aim.y-last.y)<.32).length>=2;
   const profile=goalkeeperProfile(s.difficulty),guess=repeated&&ctx.random()<.85,anticipated=guess?penaltyTarget(last,k.goalZ):null;
   // Pick a possible side before the kick. The keeper never reads the queued shot.
   const choice=ctx.random(),confidence=s.difficulty==='challenge'?.60:s.difficulty==='casual'?.28:.44;
   const lean=Math.abs(choice-.5)<confidence*.5?0:Math.sign(choice-.5);
   k.aiKeeper={readAt:profile.reaction*.61+ctx.random()*.055,bias:(ctx.random()*2-1)*profile.error*2.6,anticipated,lean:lean*.70};
  }else k.aiKeeper=null;
 }
 function restorePenaltyFields(k){
  if(k.keeperReady!==undefined)return;
  if(k.type!=='penalty')Object.assign(k,{defending:other(k.team),goalZ:-52.5,attackSign:-1,aimHistory:{home:[],away:[]}});
  initializePenalty(k);
 }
 function confirmPenaltyKeeper(k,team){
  if(k.stage!=='ready'||team!==k.defending||k.keeperReady!==false)return false;
  k.keeperReady=true;k.kickAllowedAt=k.time+2.5;return true;
 }
 function positionPenaltyTaker(k,taker){
  // The same starting stance is visible to both teams, independent of aim.
  const offset=taker.number%2?.74:-.74;
  Object.assign(taker,{x:offset,z:s.ball.z-k.attackSign*2.65,
   yaw:Math.atan2(-offset,k.attackSign*2.65),vx:0,vz:0,motion:null,protectedUntil:s.time+24});
 }
 function movePenaltyKeeper(k,dt,inputs){
  const keeper=byId(k.keeper),g=keeper.keeperState,ai=k.aiKeeper;
  if(ctx.humans.has(k.defending)){moveHumanPenaltyKeeper(keeper,k.goalZ,s.time,inputs[k.defending],dt,ctx.movePlayer);return;}
  const bias=ai?.bias||0,prior=ai?.anticipated,lean=ai?.lean||0;
  const x=prior?prior.x*.48:bias*.6+lean;
  if(k.stage==='ready'||k.stage==='runup'){
   moveHumanPenaltyKeeper(keeper,k.goalZ,s.time,{x:clamp((x-keeper.x)*3,-.65,.65)},dt,ctx.movePlayer);return;
  }
  if(g.phase==='dive'&&s.time>=g.diveUntil)g.phase='recover';
  const readAt=prior ? .08 : (ai?.readAt??.17);
  if(k.stage==='flight'&&!g.committed&&k.time>=readAt){
   const b=s.ball,remaining=clamp((k.goalZ-k.attackSign*.38-b.z)/(b.vz||1),0,.72),targetX=prior?.x??b.x+b.vx*remaining+bias,targetY=prior?.y??b.y+b.vy*remaining-4.905*remaining**2;
   const side=targetX-keeper.x;
   if(Math.abs(side)>.83)divePenaltyKeeper(k,{direction:{x:side},penaltyAim:{y:(targetY-1.16)/.81}});
   else Object.assign(g,{phase:'set',committed:true,direction:0,targetY:clamp(targetY,.35,1.97)});
   g.targetX=clamp(targetX,-3.52,3.52);
  }
  const tracking=g.phase==='dive'||g.phase==='set',reached=(g.targetX-keeper.x)*g.direction<.48,drive=tracking&&(g.phase==='set'||reached)?clamp((g.targetX-keeper.x)*2,-1,1):tracking?g.direction:0;
  ctx.movePlayer(keeper,drive,0,g.phase==='dive'?penaltyKeeperSpeed:3.6,dt);
  keeper.x=clamp(keeper.x,-3.55,3.55);keeper.z=k.goalZ-k.attackSign*.12;keeper.vz=0;keeper.yaw=k.attackSign<0?0:Math.PI;
 }
 function maybeStartPenalty(k){
  if(!penaltyCanShoot(k))return;
  const wait=k.time-(k.kickAllowedAt??0);
  if(ctx.humans.has(k.team)?k.type!=='penalty'||wait<20:wait<(k.aiKickDelay??.4))return;
  const side=ctx.random()<.5?-1:1,x=ctx.random()<.16?side*ctx.random()*.24:side*(.39+ctx.random()*.59);
  startPenaltyRunup(k,{power:.40+ctx.random()*.49,penaltyAim:{x,y:ctx.random()*1.85-.95}});
 }
 function stepMatchPenalty(dt,inputs){const k=s.setPiece;restorePenaltyFields(k);k.time+=dt;
  if(k.stage==='flight'){k.extended=k.extended||penaltyPeriodDue();const stopped=Math.hypot(s.ball.vx,s.ball.vz)<.1&&s.ball.y<=.12&&Math.abs(s.ball.vy)<.2;if(s.phase!=='playing'||s.ball.ownerId||stopped||!k.extended&&(s.lastShot?.outcome!=='flight'||k.time>2.5)){clearMatchPenalty();return false;}}
  if(k.stage==='setup'){if(k.time>=1.8){k.stage='ready';k.time=0;s.phase='playing';s.phaseTime=0;ctx.emit('penalty-ready',k.team,name(k.team)+' · '+byId(k.taker).name+' 主罚',k.taker);}return true;}
  movePenaltyKeeper(k,dt,inputs);
  if(k.stage==='ready'){maybeStartPenalty(k);return true;}
  if(k.stage==='runup'){advancePenaltyRunup(k,dt);return true;}
  return false;
 }
 function divePenaltyKeeper(k,options){
  const keeper=byId(k.keeper),g=keeper.keeperState;if(s.time<g.recoverUntil)return false;
  const direction=penaltyDiveDirection(options.direction?.x,keeper.vx),targetY=penaltyDiveHeight(options.penaltyAim?.y),profile=goalkeeperProfile(s.difficulty);
  const saveWindow=profile.window+penaltyDiveLead;
  Object.assign(g,{phase:direction?'dive':'set',committed:true,penaltyDive:true,direction,diveAt:s.time,diveUntil:s.time+saveWindow,recoverUntil:s.time+saveWindow+profile.recovery,blockedUntil:0,targetY,targetX:clamp(keeper.x+direction*2,-3.7,3.7),holdZ:keeper.z});
  ctx.motion(keeper,direction?'dive':'save',direction?saveWindow+profile.recovery:.55,{direction:direction*keeper.attackSign,height:targetY});return true;
 }
 function startPenaltyRunup(k,options){
  if(!penaltyCanShoot(k))return false;
  const power=Number.isFinite(options.power)?clamp(options.power,.15,1):penaltyStandardPower;
  const aim=safePenaltyAim(options.penaltyAim??{x:(options.direction?.x||0)*.68*-k.attackSign,y:-.17});
  const taker=byId(k.taker);
  k.pendingKick={power,aim,startX:taker.x,startZ:taker.z};
  k.runupDuration=.78+(taker.number%4)*.035;
  k.stage='runup';k.time=0;
  ctx.emit('penalty-start',k.team,taker.name+' · 开始助跑',taker.id);
  return true;
 }
 function advancePenaltyRunup(k,dt){
  const {power,aim,startX,startZ}=k.pendingKick;
  const taker=byId(k.taker),ball=s.ball;
  const progress=clamp(k.time/k.runupDuration,0,1);
  const stride=progress*progress*(2-progress);
  const nextX=startX+(ball.x-startX)*stride;
  const nextZ=startZ+(ball.z-k.attackSign*.53-startZ)*stride;
  taker.vx=(nextX-taker.x)/dt;taker.vz=(nextZ-taker.z)/dt;
  taker.x=nextX;taker.z=nextZ;
  if(k.queuedDive&&k.time+1e-6>=k.runupDuration-penaltyDiveLead){
   divePenaltyKeeper(k,k.queuedDive);k.queuedDive=null;k.diveQueued=false;
  }
  if(progress<1)return;
  ctx.shoot(taker,{power,penalty:{aim,goalZ:k.goalZ}});
  taker.vx=taker.vz=0;
  if(k.aimHistory){const history=k.aimHistory[k.team];history.push(aim);if(history.length>4)history.shift();}
  k.pendingKick=null;k.stage='flight';k.time=0;taker.protectedUntil=s.time+.1;
 }
 function penaltyAction(k,type,options,team){
  if(s.paused||!['ready','runup','flight'].includes(k.stage))return false;
  restorePenaltyFields(k);
  if(type==='penalty-ready')return confirmPenaltyKeeper(k,team);
  if(team===k.team)return type==='shoot'&&startPenaltyRunup(k,options);
  if(team!==k.defending||type!=='tackle')return false;
  if(k.stage==='flight')return divePenaltyKeeper(k,options);
  if(k.stage!=='runup'||k.queuedDive||byId(k.keeper).keeperState.committed)return false;
  if(k.time+1e-6>=k.runupDuration-penaltyDiveLead)return divePenaltyKeeper(k,options);
  k.queuedDive={direction:{x:options.direction?.x},penaltyAim:safePenaltyAim(options.penaltyAim)};
  k.diveQueued=true;
  return true;
 }
 function preparePenalty(){const c=s.competition,k=c.shootout,team=(k.home.length+k.away.length)%2?'away':'home',defending=other(team),list=k.eligible[team],taker=byId(list[k[team].length%list.length]),keeper=active().find(p=>p.team===defending&&p.keeper);Object.assign(k,{team,defending,stage:'ready',time:0,outcome:null,taker:taker.id,keeper:keeper.id,goalZ:-52.5,attackSign:-1});initializePenalty(k);s.attackDirections={[team]:-1,[defending]:1};synchronizeEnds();
  for(const p of active()){p.x=-12+p.index*2.1;p.z=p.team==='home'?4:8;p.vx=p.vz=0;p.motion=null;}
  Object.assign(keeper,{x:0,z:-52.38,yaw:0,keeperState:goalkeeperState()});Object.assign(s.ball,{x:0,y:.11,z:-41.5,vx:0,vy:0,vz:0,shot:null});positionPenaltyTaker(k,taker);ctx.setOwner(taker);control(team,taker);control(defending,keeper);s.phase='penalties';s.paused=false;s.phaseTime=0;s.restartType='shootout';s.restartTeam=team;s.lastShot=null;ctx.emit('penalty-ready',team,name(team)+' · '+taker.name+' 主罚',taker.id);
 }
 function beginShootout(){const c=s.competition;c.stage='shootout';c.next=null;const count=Math.min(...['home','away'].map(t=>active().filter(p=>p.team===t).length)),eligible={};for(const team of ['home','away']){const list=active().filter(p=>p.team===team);eligible[team]=[...list.filter(p=>!p.keeper).slice(0,count-1),...list.filter(p=>p.keeper)].map(p=>p.id);}c.shootout={home:[],away:[],eligible,aimHistory:{home:[],away:[]},winner:null};preparePenalty();}
 function finishPenalty(goal,outcome=goal?'goal':'wide'){const k=s.competition?.shootout;if(!k||k.stage!=='flight')return false;k[k.team].push(!!goal);k.outcome=outcome;k.stage='result';k.time=0;k.winner=shootoutWinner(k.home,k.away);ctx.finishShot(outcome);stop();ctx.emit('penalty-result',k.team,name(k.team)+(goal?' · 点球命中':' · 点球未进'));return true;}
 function penaltyBoundary(goal){if(s.phase!=='penalties'||s.competition?.shootout?.stage!=='flight')return false;finishPenalty(goal);return true;}
 function stepPenalties(dt,inputs){const k=s.competition.shootout;
  restorePenaltyFields(k);k.time+=dt;
  if(k.stage==='result'){if(k.time>2){if(k.winner)finish('penalties',k.winner);else preparePenalty();}return true;}
  movePenaltyKeeper(k,dt,inputs);
  if(k.stage==='ready'){maybeStartPenalty(k);return true;}
  if(k.stage==='runup'){advancePenaltyRunup(k,dt);return true;}
  ctx.physicsBall(dt);
  if(k.stage==='flight'&&['saved','parried','woodwork'].includes(s.lastShot?.outcome)){
   if(s.lastShot.outcome==='saved'||s.lastShot.outcome==='parried')finishPenalty(false,'saved');
   else if(s.ball.vz*k.attackSign<=0)finishPenalty(false,'woodwork');
  }
  if(k.stage==='flight'&&(k.time>5.5||Math.abs(s.ball.x)>34||Math.abs(s.ball.z)>54))finishPenalty(false,'wide');return true;
 }
 function step(dt,inputs){
  if(s.phase==='interval')return true;
  const c=s.competition;
  if(c&&c.stage!=='shootout'&&s.elapsed<nominalEnd()-CLOCK_EPSILON&&
   (s.setPiece&&s.setPiece.stage!=='flight'||s.phase==='goal'||s.phase==='kickoff'&&s.elapsed>c.periodStart+CLOCK_EPSILON)){
   const added=c.addedTime??=newAddedTime();
   added.lost+=dt;
  }
  if(s.setPiece)return stepMatchPenalty(dt,inputs);
  if(s.phase==='penalties')return stepPenalties(dt,inputs);
  return false;
 }
 return{reset,synchronizeEnds,nominalEnd,periodEnd,continuePeriod,setFormation,substitute,applyPending,foul,clearMatchPenalty,finishPenalty,penaltyBoundary,beginShootout,afterReset(){if(s.competition&&competitionModes[s.competition.mode].standalone)beginShootout();},step,action(type,options,team){if(type==='continue')return continuePeriod();const k=s.setPiece||(s.phase==='penalties'?s.competition.shootout:null);return k?penaltyAction(k,type,options,team):null;}};
}
