import {goalkeeperState,planGoalkeeper,goalkeeperContact,goalkeeperProfile} from './goalkeeper.js';
import {validControlMode,turnFootballer,cursorCandidate,tackleWindow,pressureTarget,sweptBallContact} from './football-assist.js';
import {homeXI,awayXI} from './matchday-roster.js';
import {footballTeam,opponentSquad,difficulties} from './football-teams.js';
import {attackingShape,forwardSupportRun,passOption,shotOption,shotPreparation,receivingPoint,shotKinds,passFlight,supportPosition,possessionTeam,passRunSeconds} from './football-tactics.js';
import {goalFrameCollision} from './goal-frame.js';
import {footballFormations,squadDefinition} from './football-squads.js';
import {createFootballRegulations} from './football-regulations.js';
import {penaltyFlight} from './football-penalty.js';
import {defendingShape} from './football-defending.js';
import {moveFootballer as movePlayer,moveControlledFootballer,carryFootball,continuesReceiveIntent} from './football-movement.js';
import {trainingLayout} from './football-training-layout.js';

const STEP=1/60,HALF_WIDTH=34,HALF_LENGTH=52.5,BALL_RADIUS=.11;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=v=>Number.isFinite(v)?v:0;
const other=team=>team==='home'?'away':'home';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Roles follow this exhibition formation; identities remain the shared squads.
const formation=[[0,48],[0,-13],[-9,8],[-10,29],[10,29],[-25,22],[25,22],[9,8],[-17,-3],[15,-4],[25,-11]];
// Actor meshes face local +Z: yaw PI looks toward the north (-Z) goal.
const face=(x,z)=>Math.atan2(x,z);

export function createFootballSimulation({duration=180,seed=73417,controlMode='semi',opponent='dortmund',difficulty='regular',shotKind='drive',humanTeams=['home'],rules=null,selections={},practice=null}={}){
 practice=['free','passing','shooting'].includes(practice)?practice:null;
 const matchDuration=Number.isFinite(duration)?clamp(duration,1,3600):180,initialSeed=(seed>>>0)||73417;
 const club=footballTeam(opponent),awayDefinitions=club.id==='dortmund'?awayXI:opponentSquad(club.id).xi,tuning=difficulties[difficulty]||difficulties.regular,teamName=team=>team==='home'?'拜仁':club.short;
 const humans=new Set(humanTeams.filter(t=>t==='home'||t==='away')),controllers={};
 for(const team of ['home','away'])controllers[team]={autoReceive:false,receiveIntent:null,lastSwitchAt:-10,manualLockUntil:0,queuedAction:null,lastInput:{x:0,z:0}};
 let randomSeed=initialSeed,worldTime=0,accumulator=0,restartDelay=3,lastTouch='home',claimBlockId='',claimBlockUntil=0,goalRestartTeam='away',actionSerial=0,lastSavedShotId=null;
 const previousPositions=new WeakMap(),random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
 const state={preparedAction:null,receiveTarget:null,shotKind:shotKinds.includes(shotKind)?shotKind:'drive',lastShot:null,fixture:club,difficulty:Object.hasOwn(difficulties,difficulty)?difficulty:'regular',controlMode:validControlMode(controlMode),time:0,nextPlayerId:null,passTargetId:null,passPreview:null,shotPreview:null,players:[],controlledId:'home-1',ball:{x:0,y:BALL_RADIUS,z:0,vx:0,vy:0,vz:0,ownerId:null},score:{home:0,away:0},elapsed:0,duration:matchDuration,phase:'kickoff',phaseTime:0,paused:false,message:'准备开球',restartType:'kickoff',restartTeam:'home',eventCount:0,events:[],stats:{home:{shots:0,passes:0,tackles:0,saves:0,onTarget:0,woodwork:0},away:{shots:0,passes:0,tackles:0,saves:0,onTarget:0,woodwork:0}}};
 state.controlledIds={home:'home-1',away:'away-1'};state.controlModes={home:state.controlMode,away:state.controlMode};state.shotKinds={home:state.shotKind,away:state.shotKind};state.previews={home:{},away:{}};state.chargePowers={home:0,away:0};
 const attackSign=team=>state.attackDirections?.[team]??(team==='home'?-1:1);
 const onField=()=>state.players.filter(p=>!p.dismissed&&!p.trainingInactive),available=()=>practice?onField():state.players;
 const byId=id=>state.players.find(p=>p.id===id),controlled=(team='home')=>byId(state.controlledIds[team]),isHuman=p=>!!p&&humans.has(p.team)&&p.id===state.controlledIds[p.team];
 function emit(type,team,text,playerId=null,details=null){state.message=text;state.eventCount++;const event={id:state.eventCount,type,team,text,playerId};if(details)Object.assign(event,details);state.events.push(event);if(state.events.length>12)state.events.shift();}
 function selectPlayer(player,reason,manual=false){if(!player||player.dismissed||!humans.has(player.team)||player.id===state.controlledIds[player.team])return false;const team=player.team,c=controllers[team];state.controlledIds[team]=player.id;if(team==='home')state.controlledId=player.id;c.lastSwitchAt=worldTime;if(manual){c.manualLockUntil=worldTime+1.7;c.autoReceive=false;c.receiveIntent=null;for(const p of state.players)if(p.team===team)p.receiveControl=null;}emit('switch',team,reason+' '+player.number+' · '+player.name,player.id);return true;}
 function finishShot(outcome){const shot=state.lastShot;if(!shot||state.ball.shot?.id!==shot.id)return;if(['goal','saved','blocked','wide','short'].includes(shot.outcome))return;shot.outcome=outcome;shot.updatedAt=worldTime;if(['goal','saved','parried'].includes(outcome)&&!shot.onTarget){state.stats[shot.team].onTarget++;shot.onTarget=true;}}
 function setOwner(player){const b=state.ball,previous=b.ownerId;player.receiveControl=null;if(previous!==player.id){player.protectedUntil=worldTime+(player.motion?.type==='tackle'?.50:.38);player.trapUntil=worldTime+.23;if(!player.keeper&&state.phase==='playing'&&!player.motion)motion(player,'trap',.26);}
  const c=controllers[player.team];if(humans.has(player.team)&&state.controlModes[player.team]!=='manual'&&!player.keeper&&(c.autoReceive||worldTime>=c.manualLockUntil)){const changed=selectPlayer(player,'控球接管');if(c.autoReceive||changed)emit('receive',player.team,player.name+'接球',player.id);}
  if(practice&&previous!==player.id)emit('training-receive',player.team,player.name+'触球',player.id);
  if(b.shot&&!player.keeper&&(player.team!==b.shot.team||state.lastShot?.outcome==='flight'))finishShot(player.team!==b.shot.team?'blocked':'short');for(const c of Object.values(controllers)){c.autoReceive=false;c.receiveIntent=null;}b.shot=null;b.curve=0;b.targetId=null;b.receivePoint=null;b.ownerId=player.id;b.vx=b.vy=b.vz=0;lastTouch=player.team;player.possessionSince=worldTime;
 }
 function motion(p,type,duration=.38,details){p.motion={id:++actionSerial,type,elapsed:0,duration,...details};}
 function stopBall(){Object.assign(state.ball,{vx:0,vy:0,vz:0});}
 function resetPositions(kickoffTeam){
  for(const c of Object.values(controllers)){c.queuedAction=null;c.receiveIntent=null;c.offBall=null;}
  for(const p of onField()){const f=(state.competition?footballFormations[state.teamSheets[p.team].formation].positions:formation)[p.index],ownSide=-attackSign(p.team);p.x=f[0];p.z=p.keeper?ownSide*48:ownSide*Math.max(p.team===kickoffTeam?4:9.8,Math.abs(f[1])*.9);p.vx=p.vz=0;p.yaw=attackSign(p.team)<0?Math.PI:0;p.decisionAt=worldTime+.7+random()*.8;p.tackleAt=worldTime+.8;p.possessionSince=worldTime;p.motion=null;p.receiveControl=null;p.pivotUntil=0;p.defending=false;p.runUntil=0;if(p.keeper)p.keeperState=goalkeeperState();}
  const taker=onField().find(p=>p.id===kickoffTeam+'-1')||onField().find(p=>p.team===kickoffTeam&&!p.keeper);taker.x=0;taker.z=-attackSign(kickoffTeam)*.62;taker.yaw=attackSign(kickoffTeam)<0?Math.PI:0;Object.assign(state.ball,{x:0,y:BALL_RADIUS,z:0});setOwner(taker);claimBlockUntil=0;claimBlockId='';
 }
 function clearControlIntents(){for(const c of Object.values(controllers)){c.queuedAction=null;c.receiveIntent=null;c.autoReceive=false;c.manualLockUntil=0;c.offBall=null;}for(const p of state.players)p.receiveControl=null;}
 function kickoff(team,{first=false}={}){regulations.clearMatchPenalty();if(state.phase!=='goal')state.stoppageId++;regulations.applyPending(state.phase==='interval');resetPositions(team);state.phase='kickoff';state.phaseTime=0;state.restartType='kickoff';state.restartTeam=team;restartDelay=first?3:2.7;emit('kickoff',team,teamName(team)+'开球');}
 function reset(){
  randomSeed=initialSeed;worldTime=accumulator=0;lastTouch='home';claimBlockId='';claimBlockUntil=0;goalRestartTeam='away';actionSerial=0;lastSavedShotId=null;
  state.stoppageId=0;regulations.reset();state.players=['home','away'].flatMap(team=>state.teamSheets[team].xi.map((number,index)=>{const definition=squadDefinition(team,club.id,number);return({id:team+'-'+index,team,index,keeper:definition.keeper,number:definition.player.number,name:definition.player.name,x:0,z:0,vx:0,vz:0,yaw:team==='home'?Math.PI:0,stamina:1,decisionAt:0,tackleAt:0,possessionSince:0,protectedUntil:0,trapUntil:0,motion:null,defending:false,lungeUntil:0,tackleWindowUntil:0,cautions:0,fouls:0,dismissed:false,attackSign:team==='home'?-1:1});}));
  for(const team of ['home','away']){Object.assign(controllers[team],{autoReceive:false,receiveIntent:null,lastSwitchAt:-10,manualLockUntil:0,queuedAction:null,lastInput:{x:0,z:0}});state.controlledIds[team]=team+'-1';state.previews[team]={};state.chargePowers[team]=0;}state.lastShot=null;Object.assign(state,{controlledId:'home-1',elapsed:0,duration:matchDuration,phase:'kickoff',phaseTime:0,paused:false,message:'准备开球',time:0,nextPlayerId:null,preparedAction:null,receiveTarget:null,eventCount:0,events:[]});state.score={home:0,away:0};state.stats={home:{shots:0,passes:0,tackles:0,saves:0,onTarget:0,woodwork:0},away:{shots:0,passes:0,tackles:0,saves:0,onTarget:0,woodwork:0}};if(practice)resetPractice();else kickoff('home',{first:true});regulations.afterReset();return state;
 }
 function resetPractice(attempt=1){
  if(!practice)return false;regulations.clearMatchPenalty();clearControlIntents();const layout=trainingLayout(practice,attempt),participants=new Map(layout.map(p=>[p.id,p]));
  for(const p of state.players){p.trainingInactive=!participants.has(p.id);p.vx=p.vz=0;p.motion=null;p.defending=false;p.lungeUntil=p.tackleWindowUntil=p.pivotUntil=0;p.tackleAt=worldTime;p.trapUntil=p.protectedUntil=0;p.stamina=1;p.decisionAt=worldTime+1000000;if(p.keeper)p.keeperState=goalkeeperState();const at=participants.get(p.id);if(at)Object.assign(p,at);}
  for(const [team,c] of Object.entries(controllers)){c.lastInput={x:0,z:0};state.chargePowers[team]=0;}state.chargePower=0;
  state.controlledIds.home=state.controlledId='home-1';state.controlledIds.away='away-0';state.phase='playing';state.phaseTime=0;state.restartType='training';state.restartTeam='home';state.lastShot=null;state.nextPlayerId=state.passTargetId=null;state.passPreview=state.shotPreview=state.preparedAction=state.receiveTarget=null;for(const preview of Object.values(state.previews)){preview.preparedAction=null;preview.receiveTarget=null;}state.stoppageId++;claimBlockId='';claimBlockUntil=0;lastSavedShotId=null;
  const taker=byId('home-1');Object.assign(state.ball,{x:taker.x+Math.sin(taker.yaw)*.6,y:BALL_RADIUS,z:taker.z+Math.cos(taker.yaw)*.6,vx:0,vy:0,vz:0,ownerId:null,shot:null,curve:0,targetId:null,receivePoint:null});setOwner(taker);state.message='训练就绪';return true;
 }
 function carryBall(dt=STEP){const b=state.ball,p=byId(b.ownerId);if(!p){b.ownerId=null;return;}carryFootball(p,b,dt,worldTime);}
 function release(player,vx,vz,vy=0){controllers[player.team].autoReceive=false;controllers[player.team].receiveIntent=null;const b=state.ball;b.shot=null;b.curve=0;b.targetId=null;b.receivePoint=null;b.ownerId=null;b.vx=vx;b.vz=vz;b.vy=vy;b.y=Math.max(BALL_RADIUS,b.y);lastTouch=player.team;claimBlockId=player.id;claimBlockUntil=worldTime+.48;player.decisionAt=worldTime+1.2;}
 function strikeDetails(player,stroke,power){
  const ball=state.ball,details={stroke,power,contactX:ball.x,contactY:Math.max(BALL_RADIUS,ball.y),contactZ:ball.z,approachSpeed:Math.hypot(player.vx,player.vz)};
  if(player.motion?.type==='trap'&&player.motion.elapsed<=.17)details.firstTime=true;
  return details;
 }
 function pass(player,{direction=null,type='pass',power=.45}={}){
  const b=state.ball,option=passOption(available(),player,b,{direction,type,power});
  if(!option){state.message='这个方向没有接应球员';return false;}
  const dx=option.x-b.x,dz=option.z-b.z,d=Math.hypot(dx,dz),flight=passFlight(b,option,{type,lane:option.lane}),human=isHuman(player);
  const stroke=flight.lofted?'lofted':type==='through'?'through':'short';
  motion(player,'pass',.32,{...strikeDetails(player,stroke,power),lofted:flight.lofted});
  release(player,flight.vx,flight.vz,flight.vy);
  controllers[player.team].autoReceive=human;
  const intent=direction||controllers[player.team].lastInput;
  controllers[player.team].receiveIntent=human&&type==='pass'&&Math.hypot(intent.x,intent.z)>.18?{x:intent.x,z:intent.z,sprint:!!controllers[player.team].lastInput.sprint,passId:actionSerial}:null;
  player.runUntil=worldTime+passRunSeconds(footballFormations[state.teamSheets[player.team].formation].roles[player.index]);
  player.runX=dx/(d||1);
  b.targetId=option.player.id;b.receivePoint={x:option.x,z:option.z,until:worldTime+4};
  player.yaw=face(dx,dz);state.stats[player.team].passes++;
  emit(type,player.team,player.name+(flight.lofted?' 挑传直塞 → ':type==='through'?' 直塞 → ':' → ')+option.player.name,player.id,practice?{targetId:option.player.id}:null);
  return true;
 }
 function shoot(player,{direction=null,power=.55,kind,penalty=null}={}){
  const b=state.ball;let aim;
  if(penalty){
   const flight=penaltyFlight(b,penalty.goalZ,penalty.aim,power,random);
   aim={...flight,curve:0,kind:'drive',quality:power>.76?'risky':'clean',preparation:power>.76?'overpowered':'set',limited:power>.76};
  }else{
   const human=isHuman(player),mode=kind||(human?state.shotKinds[player.team]:'drive'),keeper=onField().find(p=>p.keeper&&p.team!==player.team),pressure=pressureNear(player),preparation=shotPreparation(player,b,{power,pressure}),error=(random()*2-1)*(preparation.spread+(!human&&player.team==='away'?tuning.shotError*.5:0)),heightError=(random()*2-1)*preparation.heightSpread+preparation.heightBias;
   aim=shotOption(player,b,{direction,power,error,heightError,kind:mode,keeper,pressure});
  }
  if(aim.distance<.01)return false;
  motion(player,'shoot',.46,strikeDetails(player,aim.kind,power));
  release(player,aim.vx,aim.vz,aim.vy);
  b.curve=aim.curve;b.shot={id:actionSerial,team:player.team,kind:aim.kind,at:worldTime};state.lastShot={...b.shot,updatedAt:worldTime,playerId:player.id,name:player.name,power,distance:aim.distance,quality:aim.quality,preparation:aim.preparation,spread:aim.spread,heightSpread:aim.heightSpread,limited:aim.limited,outcome:'flight',onTarget:false};player.yaw=face(aim.x-b.x,aim.z-b.z);state.stats[player.team].shots++;const reasons={backfoot:'背身调整起脚',rushed:'跑动起脚',pressured:'贴身受压',overpowered:'蓄力过满','long-range':'远距离起脚'};emit('shot',player.team,player.name+'射门！'+(reasons[aim.preparation]?' · '+reasons[aim.preparation]:''),player.id,practice?{shotId:state.lastShot.id}:null);return true;
 }
 function nearestOutfield(team,point,exclude=null){let nearest,best=Infinity;for(const p of state.players){if(p.dismissed||p.team!==team||p.keeper||p.id===exclude)continue;const gap=distance(p,point);if(gap<best){best=gap;nearest=p;}}return nearest;}
 function restart(type,team,x,z){
  regulations.clearMatchPenalty();state.stoppageId++;regulations.applyPending();const taker=type==='goalkick'?byId(team+'-0'):nearestOutfield(team,{x,z});taker.x=clamp(x,-33.15,33.15);taker.z=clamp(z,-51.6,51.6);taker.vx=taker.vz=0;taker.yaw=attackSign(team)<0?Math.PI:0;
  Object.assign(state.ball,{x:taker.x,y:BALL_RADIUS,z:taker.z});setOwner(taker);state.phase='kickoff';state.phaseTime=0;state.restartType=type;state.restartTeam=team;restartDelay=1.8;claimBlockUntil=0;
  if(humans.has(team)&&!taker.keeper)selectPlayer(taker,'定位球');
  const names={throwin:'边线球',corner:'角球',goalkick:'球门球',freeKick:'直接任意球',penaltyKick:'点球'};emit(type,team,teamName(team)+' · '+names[type],taker.id);
 }
 function boundary(previous){
  const b=state.ball,crossings=[];
  if(Math.abs(b.x)>HALF_WIDTH){const plane=Math.sign(b.x)*HALF_WIDTH;crossings.push({axis:'x',plane,t:clamp((plane-previous.x)/(b.x-previous.x||1),0,1)});}
  if(Math.abs(b.z)>HALF_LENGTH){const plane=Math.sign(b.z)*HALF_LENGTH;crossings.push({axis:'z',plane,t:clamp((plane-previous.z)/(b.z-previous.z||1),0,1)});}
  if(!crossings.length)return false;crossings.sort((a,b)=>a.t-b.t);const c=crossings[0],x=previous.x+(b.x-previous.x)*c.t,y=previous.y+(b.y-previous.y)*c.t,z=previous.z+(b.z-previous.z)*c.t;
  if(regulations.penaltyBoundary(c.axis==='z'&&c.plane<0&&Math.abs(x)<=3.66&&y<=2.44-BALL_RADIUS))return true;
  if(c.axis==='x'){finishShot('wide');if(practice){practiceOut(x,y,z);return true;}restart('throwin',other(lastTouch),Math.sign(c.plane)*33.1,clamp(z,-49.5,49.5));return true;}
  const scoringTeam=Math.sign(c.plane)===attackSign('home')?'home':'away';
  if(Math.abs(x)<=3.66&&y<=2.44-BALL_RADIUS){finishShot('goal');regulations.clearMatchPenalty();state.score[scoringTeam]++;state.stoppageId++;state.phase='goal';state.phaseTime=0;goalRestartTeam=other(scoringTeam);b.ownerId=null;Object.assign(b,{x:clamp(x,-3.5,3.5),y:Math.max(BALL_RADIUS,y),z:Math.sign(c.plane)*53.1});stopBall();emit('goal',scoringTeam,teamName(scoringTeam)+'进球！');for(const p of onField())p.vx=p.vz=0;return true;}
  finishShot('wide');if(practice){practiceOut(x,y,z);return true;}if(lastTouch===scoringTeam)restart('goalkick',other(scoringTeam),0,Math.sign(c.plane)*47.5);
  else restart('corner',scoringTeam,x<0?-32.8:32.8,Math.sign(c.plane)*51.2);return true;
 }
 function practiceOut(x,y,z){state.stoppageId++;state.phase='kickoff';state.phaseTime=0;state.restartType='training';state.restartTeam='home';restartDelay=1000000;Object.assign(state.ball,{x,y:Math.max(BALL_RADIUS,y),z,ownerId:null,targetId:null,receivePoint:null});stopBall();emit('training-out','home','足球出界 · 准备下一次');}
 function pressureNear(p){let nearest=Infinity;for(const q of state.players)if(!q.dismissed&&!q.trainingInactive&&q.team!==p.team)nearest=Math.min(nearest,distance(p,q));return nearest;}
 function attackingRun(team,field,system,shape,sign,owner,b){
  const controller=controllers[team],selection=state.teamSheets[team].formation,control=humans.has(team)?state.controlledIds[team]:null;
  let plan=controller.offBall;
  if(plan?.formation!==selection)controller.offBall=plan={formation:selection,run:null,anchor:null,nextAt:0};
  const id=plan.run?.id;
  if(id&&(worldTime>=plan.run.until||id===control||id===owner?.id||id===b.targetId||!field.some(p=>p.id===id)))plan.run=null;
  if(b.shot){plan.run=null;return null;}
  // Commit to one run so players do not alternate directions as a marker moves.
  if(!plan.run&&worldTime>=plan.nextAt&&(!plan.anchor||distance(shape.anchor,plan.anchor)>=4.5)){
   const run=forwardSupportRun(field,team,system,shape,sign,owner,control,b.targetId,worldTime);
   plan.nextAt=worldTime+(run?2.65:.24);
   if(run){plan.run={id:run.id,x:run.x,z:run.z,until:worldTime+1.65};plan.anchor=shape.anchor;}
  }
  return plan.run;
 }
 function updatePlayers(dt,inputs){
  const b=state.ball,owner=byId(b.ownerId),possession=possessionTeam(b,state.players),field=onField(),pressers={},systems={},attacks={},runs={},defences={};
  const openPlay=!practice&&!state.setPiece;
  // Only the closest two AI pressers are needed. A stable minimum scan keeps
  // the same tie order without sorting two teams or repeatedly making lists.
  for(const team of['home','away']){
   const sign=attackSign(team),selected=footballFormations[state.teamSheets[team].formation],controlledId=humans.has(team)?state.controlledIds[team]:null;
   const system=systems[team]=state.competition?selected:{positions:formation,roles:selected.roles};
   let first=null,second=null,near=Infinity,next=Infinity;
   if(possession!==team){
    for(const p of field){if(p.team!==team||p.keeper||isHuman(p))continue;const gap=distance(p,b);if(gap<near){second=first;next=near;first=p;near=gap;}else if(gap<next){second=p;next=gap;}}
   }
   pressers[team]=[(!openPlay||near<24)?first?.id:undefined,(!openPlay||next<18)?second?.id:undefined];
   if(openPlay&&possession===team){
    const shape=attacks[team]=attackingShape(field,team,system,sign,b,owner,controlledId);
    runs[team]=attackingRun(team,field,system,shape,sign,owner,b);
   }else{
    controllers[team].offBall=null;
    if(openPlay)defences[team]=defendingShape(field,team,system,sign,b,owner,[...pressers[team],controlledId]);
   }
  }
  for(const p of field){
   if(state.setPiece?.keeper===p.id)continue;
   const sign=attackSign(p.team),isControlled=isHuman(p),input=inputs[p.team];
   if(isControlled){moveControlledFootballer(p,b,owner,input,dt,worldTime);continue;}
   if(practice&&p.team==='home'&&!p.keeper&&b.targetId!==p.id){p.vx=p.vz=0;if(owner?.id!==p.id)p.yaw=face(b.x-p.x,b.z-p.z);continue;}
   p.defending=false;p.stamina=Math.min(1,p.stamina+.035*dt);let targetX,targetZ,speed=p.keeper?4.6:5.1;const aiFactor=p.team==='away'?tuning.speed:1;
   const system=systems[p.team],role=system.roles[p.index],base=system.positions[p.index],shape=attacks[p.team],run=runs[p.team];
   if(possession!==p.team)p.runUntil=0;
   if(p.keeper){const plan=planGoalkeeper(p,b,owner,worldTime,state.difficulty,{openPlay:true});targetX=plan.x;targetZ=plan.z;speed=plan.speed;
    if(plan.commit){motion(p,'dive',goalkeeperProfile(state.difficulty).window+goalkeeperProfile(state.difficulty).recovery);p.motion.direction=plan.direction*attackSign(p.team);p.motion.height=plan.height;}
    if(b.ownerId===p.id&&worldTime>p.decisionAt&&worldTime-p.possessionSince>.75){pass(p);p.decisionAt=worldTime+1.4;}
   }else if(!b.ownerId&&b.targetId===p.id){const target=receivingPoint(p,b);targetX=target.x;targetZ=target.z;speed=5.7;
   }else if(b.ownerId===p.id){targetX=p.x*.78+Math.sin(worldTime*.7+p.index)*1.3;targetZ=sign*51;speed=5.25;
    if(worldTime>p.decisionAt){p.decisionAt=worldTime+(.9+random()*.9)*(p.team==='away'?tuning.reaction:1);const goalDistance=Math.hypot(p.x,p.z-sign*HALF_LENGTH),pressure=pressureNear(p),possessionStyle=p.team==='away'&&['barcelona','city'].includes(club.id);
     if(goalDistance<(p.team==='away'&&state.difficulty==='casual'?20:23)&&Math.abs(p.x)<19)shoot(p,{power:.4+random()*.38,direction:{x:(random()-.5)*1.7,z:sign}});else if(pressure<4.2||random()<(possessionStyle?.48:.18))pass(p);
    }
   }else if(run?.id===p.id){targetX=run.x;targetZ=sign*Math.min(run.z*sign,shape.runLine);speed=6.65;
   }else if(possession===p.team&&worldTime<(p.runUntil||0)){
    targetX=clamp(p.x+(p.runX||0)*5,-29,29);targetZ=sign*Math.min(p.z*sign+12,shape?.runLine??48);speed=6.0;
   }else if(possession!==p.team&&pressers[p.team].includes(p.id)){
    const first=pressers[p.team][0]===p.id,target=first?pressureTarget(p,owner,b):null;
    targetX=first?target.x:b.x*.72+p.x*.18;targetZ=first?target.z:b.z-sign*(openPlay?5.0:3.1);speed=first?5.55:5.05;
   }else{
    const target=defences[p.team]?.get(p.id)??supportPosition(p,b,field,{base,role,sign,attacking:possession===p.team,shape});targetX=target.x;targetZ=target.z;speed=target.speed;
   }
   const dx=targetX-p.x,dz=targetZ-p.z,d=Math.hypot(dx,dz);
   if(p.keeper){
    const dive=p.keeperState?.phase==='dive',set=p.keeperState?.closeShot||p.keeperState?.phase==='smother',heading=face(b.x-p.x,b.z-p.z);
    const arrival=dive?.6:set?1.1:1.8,normalizer=Math.max(set?.32:1,d);
    movePlayer(p,d>.06?dx/normalizer:0,d>.06?dz/normalizer:0,speed*Math.min(1,d/arrival),dt,{heading,rate:8,response:dive&&set?21:16});
   }else movePlayer(p,d>.3?dx/Math.max(1,d):0,d>.3?dz/Math.max(1,d):0,speed*aiFactor*Math.min(1,d/1.8),dt);
  }
  // Body separation has fixed world dimensions; camera motion never moves NPCs.
  for(let i=0;i<field.length;i++)for(let j=i+1;j<field.length;j++){
   const a=field[i],b=field[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),minimum=.70;if(d>=minimum)continue;
   const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,push=(minimum-d)*.52,wa=isHuman(a)&&!isHuman(b)?.25:isHuman(b)&&!isHuman(a)?.75:.5;
   a.x=clamp(a.x-nx*push*wa,-35.2,35.2);a.z=clamp(a.z-nz*push*wa,-53.6,53.6);b.x=clamp(b.x+nx*push*(1-wa),-35.2,35.2);b.z=clamp(b.z+nz*push*(1-wa),-53.6,53.6);
  }
 }
 function poke(defender,owner,range){const b=state.ball,window=tackleWindow(defender,owner,b,{range});if(!window.canReach||worldTime<(owner.protectedUntil||0))return false;
  // The displaced carrier needs to recover their feet before another challenge;
  // covering teammates remain free to contest the same physically loose ball.
  const dx=b.x-defender.x,dz=b.z-defender.z,d=Math.hypot(dx,dz)||1;if(defender.motion?.type!=='tackle')motion(defender,'tackle',.32);release(owner,-dx/d*2.4+defender.vx*.18,-dz/d*2.4+defender.vz*.18,.28);lastTouch=defender.team;claimBlockUntil=worldTime+.18;owner.protectedUntil=worldTime+.1;owner.tackleAt=Math.max(owner.tackleAt,worldTime+.85);
  state.stats[defender.team].tackles++;emit('tackle',defender.team,defender.name+'出脚断球',defender.id);return true;
 }
 function keeperSave(previous){
  const b=state.ball,owner=byId(b.ownerId);for(const p of onField()){if(!p.keeper||owner?.team===p.team)continue;const contact=goalkeeperContact(p,b,previous,worldTime,state.difficulty,{openPlay:!state.setPiece&&state.phase!=='penalties'});if(!contact)continue;const speed=Math.hypot(b.vx,b.vz),k=p.keeperState;
   const shot=b.shot,isShot=shot&&shot.team!==p.team&&state.lastShot?.id===shot.id;
   if(isShot&&lastSavedShotId!==shot.id){state.stats[p.team].saves++;lastSavedShotId=shot.id;}
   if(speed>5&&!p.motion)motion(p,'save',.65);
   if(contact.kind==='catch'){finishShot('saved');setOwner(p);p.decisionAt=worldTime+.9;emit(isShot?'save':'receive',p.team,p.name+(isShot?'稳稳接住':'接住来球'),p.id);}
   else{finishShot('parried');const sign=attackSign(p.team),side=Math.sign(contact.point.x-p.x)||k.direction||1;b.ownerId=null;b.targetId=null;b.receivePoint=null;b.curve=0;b.x=contact.point.x;b.y=Math.max(BALL_RADIUS,contact.point.y);b.z=contact.point.z;b.vx=side*Math.max(4,speed*.29);b.vz=sign*(3+speed*.13);b.vy=contact.point.y>1.4?2.0:.8;k.blockedUntil=worldTime+.52;k.recoverUntil=Math.max(k.recoverUntil,worldTime+.6);k.phase='recover';claimBlockId=p.id;claimBlockUntil=worldTime+.52;lastTouch=p.team;emit(isShot?'parry':'intercept',p.team,p.name+(isShot?'扑救脱手 · 可以补射':'挡下来球'),p.id);}
   regulations.clearMatchPenalty({rebound:!b.ownerId});return true;
  }return false;
 }
 function contestBall(previous=state.ball){
  const b=state.ball,owner=byId(b.ownerId);
  if(owner){
   if(keeperSave(previous))return;for(const team of humans){const user=controlled(team);if(!user||user.dismissed||user.trainingInactive)continue;if(owner.team!==team&&distance(user,b)<.55&&worldTime>=user.tackleAt&&worldTime>=(owner.protectedUntil||0)&&b.y<.45){if(poke(user,owner,.7))user.tackleAt=worldTime+.9;return;}if(owner.team!==team&&worldTime<(user.tackleWindowUntil||0)&&poke(user,owner,2.05)){user.tackleWindowUntil=0;return;}}
   for(const defender of onField()){const range=defender.team==='away'?tuning.range:.9;if(defender.team===owner.team||isHuman(defender)||worldTime<defender.tackleAt||distance(defender,b)>range)continue;
    if(tackleWindow(defender,owner,b,{range}).canReach&&worldTime>=(owner.protectedUntil||0)){defender.tackleAt=worldTime+1.1*(defender.team==='away'?tuning.reaction:1);motion(defender,'tackle',.32);if(poke(defender,owner,range))break;}
   }return;
  }
  if(keeperSave(previous))return;
 const speed=Math.hypot(b.vx,b.vz),eligible=[];
 for(const p of onField()){if(p.keeper||p.id===claimBlockId&&worldTime<claimBlockUntil)continue;const contact=sweptBallContact(p,b,previous,{range:speed>16?.48:.85,playerPrevious:previousPositions.get(p)});if(contact)eligible.push({p,t:contact.t});}
 eligible.sort((a,b)=>a.t-b.t||distance(a.p,b)-distance(b.p,b));const p=eligible[0]?.p;if(p){setOwner(p);p.decisionAt=worldTime+1.05;}
 }
 function assistCursor(input,team='home'){
  const c=controllers[team],b=state.ball,p=controlled(team),mode=state.controlModes[team],next=cursorCandidate(available(),b,{exclude:p.id,team});state.previews[team].nextPlayerId=next?.id||null;if(team==='home')state.nextPlayerId=next?.id||null;
  if(c.receiveIntent&&!continuesReceiveIntent(input,c.receiveIntent))c.receiveIntent=null;
  const owner=byId(b.ownerId);if(owner?.team===team){if(mode!=='manual'&&!owner.keeper&&worldTime>=c.manualLockUntil&&worldTime-c.lastSwitchAt>.25)selectPlayer(owner,'控球接管');return;}
  const receiver=byId(b.targetId);if(!owner&&c.autoReceive&&receiver?.team===team&&mode!=='manual'&&distance(receiver,b)<7&&worldTime-c.lastSwitchAt>.25){if(selectPlayer(receiver,'接球跑位')){const intent=c.receiveIntent;receiver.receiveControl=intent?{...intent,until:b.receivePoint?.until||worldTime+2}:null;}return;}
  if(mode!=='assisted'||worldTime<c.manualLockUntil||worldTime-c.lastSwitchAt<1.0||b.targetId&&byId(b.targetId)?.team===team)return;
  if(next&&distance(p,b)>12&&distance(next,b)+4.5<distance(p,b)&&Math.hypot(input.x,input.z)<.25)selectPlayer(next,'防守接管');
 }
 function hitGoalFrame(previous,dt){const b=state.ball,hit=goalFrameCollision(previous,b,{x:b.vx,y:b.vy,z:b.vz});if(!hit)return false;const owner=b.ownerId;b.ownerId=null;const remainder=dt*(1-hit.t);for(const key of['x','y','z'])b[key]=hit.point[key]+hit.normal[key]*.003+hit.velocity[key]*remainder;Object.assign(b,{vx:hit.velocity.x,vy:hit.velocity.y,vz:hit.velocity.z});if(owner){claimBlockId=owner;claimBlockUntil=worldTime+.18;}finishShot('woodwork');regulations.clearMatchPenalty({rebound:true});state.stats[lastTouch].woodwork++;emit('woodwork',lastTouch,'击中'+hit.name+'！');return true;}
 function physicsBall(dt){
  const b=state.ball,previous={x:b.x,y:b.y,z:b.z};if(b.ownerId){carryBall(dt);hitGoalFrame(previous,dt);if(!boundary(previous))contestBall(previous);return;}
  b.vx+=(b.curve||0)*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=9.81*dt;
  if(b.y<BALL_RADIUS){b.y=BALL_RADIUS;if(b.vy<-1)b.vy=-b.vy*.28;else b.vy=0;}
  const drag=Math.exp(-(b.y<=BALL_RADIUS+.015?.39:.08)*dt);b.vx*=drag;b.vz*=drag;if(Math.hypot(b.vx,b.vz)<.04)b.vx=b.vz=0;
  hitGoalFrame(previous,dt);if(!boundary(previous)){contestBall(previous);if(b.shot&&state.lastShot?.outcome==='flight'&&!b.ownerId&&b.y<=BALL_RADIUS+.015&&Math.hypot(b.vx,b.vz)<.75&&worldTime-b.shot.at>1){finishShot('short');b.shot=null;b.curve=0;emit('shot-short',lastTouch,'射门力量未到门前 · 可以追球');}}
 }
 function step(dt,inputs){
  worldTime+=dt;state.time=worldTime;state.phaseTime+=dt;for(const p of onField()){let previous=previousPositions.get(p);if(!previous){previous={x:p.x,z:p.z};previousPositions.set(p,previous);}else{previous.x=p.x;previous.z=p.z;}if(p.motion){p.motion.elapsed+=dt;if(p.motion.elapsed>=p.motion.duration)p.motion=null;}}
  if(state.phase==='fulltime')return;if(regulations.step(dt,inputs))return;
  if(state.phase==='goal'){if(state.phaseTime>3.6&&!regulations.periodEnd())kickoff(goalRestartTeam);return;}
  if(state.phase==='kickoff'){carryBall(dt);if(state.phaseTime>=restartDelay){state.phase='playing';state.phaseTime=0;emit('start',state.restartTeam,'比赛进行中');}return;}
  state.elapsed=practice?state.elapsed+dt:Math.min(state.duration,state.elapsed+dt);if(regulations.periodEnd())return;if(!practice&&state.elapsed>=state.duration&&!state.setPiece){state.phase='fulltime';state.phaseTime=0;stopBall();for(const p of onField())p.vx=p.vz=0;emit('fulltime',null,'全场结束 · '+state.score.home+' : '+state.score.away);return;}
  if(!state.setPiece)for(const team of humans)assistCursor(inputs[team],team);updatePlayers(dt,inputs);physicsBall(dt);
  if(state.ball.receivePoint&&worldTime>state.ball.receivePoint.until){state.ball.targetId=null;state.ball.receivePoint=null;for(const c of Object.values(controllers))c.autoReceive=false;}
  for(const team of humans){const c=controllers[team],q=c.queuedAction;if(q){const awaiting=q.awaitReceiver&&c.autoReceive&&state.ball.targetId===q.playerId;if(worldTime>q.until||state.controlledIds[team]!==q.playerId&&!awaiting||state.phase!=='playing'||state.ball.ownerId&&state.ball.ownerId!==q.playerId)c.queuedAction=null;else if(state.ball.ownerId===q.playerId){c.queuedAction=null;action(q.type,q.options,team);}}}
 }
 function update(dt,input={}){
  if(state.paused||state.phase==='fulltime')return state;const duration=clamp(finite(dt),0,.25),inputs={};
  for(const team of ['home','away']){const i=input[team]||(team==='home'?input:{}),x=clamp(finite(i.x),-1,1),z=clamp(finite(i.z),-1,1),length=Math.max(1,Math.hypot(x,z));inputs[team]={x:x/length,z:z/length,sprint:!!i.sprint,defend:!!i.defend,charging:!!i.charging};controllers[team].lastInput=inputs[team];}accumulator+=duration;
  while(accumulator>=STEP-1e-10){step(STEP,inputs);accumulator-=STEP;}for(const team of humans)preview(inputs[team],team);return state;
 }
 function receivingOpportunity(team='home'){
  const c=controllers[team],b=state.ball,receiver=byId(b.targetId);
  if(state.phase!=='playing'||state.controlModes[team]==='manual'||!c.autoReceive||b.ownerId||!receiver||receiver.team!==team||receiver.keeper||receiver.dismissed||receiver.trainingInactive)return null;
  const dx=receiver.x-b.x,dz=receiver.z-b.z,gap=Math.hypot(dx,dz),closing=(dx*(b.vx-receiver.vx)+dz*(b.vz-receiver.vz))/Math.max(.01,gap);
  if(closing<.5)return null;
  const drag=b.y<=BALL_RADIUS+.015?.39:.08,fraction=drag*Math.max(0,gap-.85)/closing;
  if(fraction>=1)return null;
  const flight=-Math.log1p(-fraction)/drag,landing=b.y>.72?(b.vy+Math.sqrt(b.vy*b.vy+19.62*(b.y-.72)))/9.81:0,arrivalIn=Math.max(flight,landing);
  return arrivalIn<=1.5?{playerId:receiver.id,name:receiver.name,arrivalIn}:null;
 }
 function preview(direction=controllers.home.lastInput,team='home'){const p=controlled(team),b=state.ball,option=b.ownerId===p.id?passOption(available(),p,b,{direction}):null,next=state.previews[team];const q=controllers[team].queuedAction,prepared=q?{type:q.type,playerId:q.playerId,name:byId(q.playerId)?.name,expiresAt:q.until,receiving:!!q.awaitReceiver}:null;next.preparedAction=prepared;next.receiveTarget=receivingOpportunity(team);next.passTargetId=option?.player.id||null;next.passPreview=option?{x:option.x,z:option.z,name:option.player.name}:null;next.shotPreview=b.ownerId===p.id?shotOption(p,b,{direction,kind:state.shotKinds[team],power:state.chargePowers[team]||(team==='home'?state.chargePower:0)||.55,keeper:available().find(k=>!k.dismissed&&k.keeper&&k.team!==p.team),pressure:pressureNear(p)}):null;if(team==='home'){state.preparedAction=prepared;state.receiveTarget=next.receiveTarget;state.passTargetId=next.passTargetId;state.passPreview=next.passPreview;state.shotPreview=next.shotPreview;}return option;}
 function action(type,options={},team='home'){
  if(type==='restart'){reset();return true;}const regulationResult=regulations.action(type,options,team);if(regulationResult!==null)return regulationResult;if(state.paused||state.phase!=='playing')return false;const p=controlled(team),b=state.ball,c=controllers[team];
  if(type==='switch'){c.queuedAction=null;state.previews[team].preparedAction=null;if(team==='home')state.preparedAction=null;const next=cursorCandidate(available(),b,{exclude:p.id,team,direction:options.direction,from:p});return selectPlayer(next,'控制',true);}
  if(type==='tackle'){
   const friendly=byId(b.ownerId);if(friendly?.team===team){state.message=friendly.id===p.id?'正在控球 · 选择传球、直塞或射门':'队友控球中 · 按 Q 换人';return false;}
   if(worldTime<p.tackleAt)return false;p.tackleAt=worldTime+.62;motion(p,'tackle',.34);p.lungeUntil=worldTime+.28;p.tackleWindowUntil=worldTime+.25;
   const owner=byId(b.ownerId);if(owner?.team!==team&&owner){p.yaw=turnFootballer(p.yaw,face(b.x-p.x,b.z-p.z),.75);const window=tackleWindow(p,owner,b,{range:2.05});if(worldTime>=(owner.protectedUntil||0)&&regulations.foul(p,owner,b,window.canReach))return false;if(poke(p,owner,2.05))return true;state.message=window.sheltered?'对方正在护球 · 绕到球的一侧':'出脚未触球 · 按住 E 贴近逼抢';return false;}
   if(!owner&&distance(p,b)<1.6&&b.y<.7){p.yaw=turnFootballer(p.yaw,face(b.x-p.x,b.z-p.z),.75);state.message='出脚争球 · 触球后控制';return true;}state.message='按住 E 贴近持球队员，空格出脚';return false;
  }
  if(type==='pass'||type==='through'||type==='shoot'){
   if(b.ownerId!==p.id){
    const opportunity=receivingOpportunity(team),receiver=opportunity?byId(opportunity.playerId):null,awaitReceiver=!!opportunity,target=receiver||p,gap=distance(target,b);
    if(!b.ownerId&&(awaitReceiver||gap<5&&!(p.id===claimBlockId&&worldTime<claimBlockUntil))){
     const window=awaitReceiver?Math.max(.45,opportunity.arrivalIn+.35):.45;
     c.queuedAction={type,playerId:target.id,awaitReceiver:!!awaitReceiver,options:{...options,direction:options.direction||c.lastInput},until:worldTime+window};
     state.message='已准备 '+target.name+' 接球后'+(type==='shoot'?'射门':'传球');preview(c.lastInput,team);return true;
    }
    state.message='先靠近足球；防守时按住逼抢';return false;
   }
   const command={...options,direction:options.direction||c.lastInput,type,power:clamp(finite(options.power??.5),.15,1)};const result=type==='shoot'?shoot(p,command):pass(p,command);preview(c.lastInput,team);return result;
  }return false;
 }
 const regulations=createFootballRegulations(state,{humans,random,emit,kickoff,restart,setOwner,shoot,finishShot,physicsBall,movePlayer,motion,clearControlIntents},{rules:practice?null:rules,duration:matchDuration,opponent:club.id,selections:rules?selections:{home:{formation:'4231',xi:homeXI.map(p=>p.player.number)},away:{formation:'4231',xi:awayDefinitions.map(p=>p.player.number)},...selections}});
 reset();return{state,update,action,reset,resetPractice,continuePeriod:regulations.continuePeriod,setFormation:regulations.setFormation,substitute:regulations.substitute,setPaused(value){state.paused=!!value;},setControlMode(value,team='home'){state.controlModes[team]=validControlMode(value);if(state.controlModes[team]==='manual'){controllers[team].autoReceive=false;controllers[team].receiveIntent=null;for(const p of state.players)if(p.team===team)p.receiveControl=null;}if(team==='home')state.controlMode=state.controlModes.home;const q=controllers[team].queuedAction;if(state.controlModes[team]==='manual'&&q?.awaitReceiver&&q.playerId!==state.controlledIds[team])controllers[team].queuedAction=null;controllers[team].manualLockUntil=worldTime+.7;controllers[team].lastSwitchAt=worldTime;preview(controllers[team].lastInput,team);return state.controlModes[team];},setShotKind(kind,team='home'){state.shotKinds[team]=shotKinds.includes(kind)?kind:'drive';if(team==='home')state.shotKind=state.shotKinds.home;preview(controllers[team].lastInput,team);return state.shotKinds[team];},attackSign,
  checkpoint(){return structuredClone({state,randomSeed,worldTime,accumulator,restartDelay,lastTouch,claimBlockId,claimBlockUntil,goalRestartTeam,actionSerial,lastSavedShotId,controllers});},
  restore(saved){Object.assign(state,structuredClone(saved.state));({randomSeed,worldTime,accumulator,restartDelay,lastTouch,claimBlockId,claimBlockUntil,goalRestartTeam,actionSerial}=saved);lastSavedShotId=saved.lastSavedShotId??(['saved','parried'].includes(saved.state.lastShot?.outcome)?saved.state.lastShot.id:null);for(const team of ['home','away'])Object.assign(controllers[team],{receiveIntent:null,offBall:null},structuredClone(saved.controllers[team]));return state;}
 };
}
