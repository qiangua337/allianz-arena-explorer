import {validControlMode,turnFootballer,cursorCandidate,tackleWindow,pressureTarget} from './football-assist.js';
import {homeXI,awayXI} from './matchday-roster.js';
import {footballTeam,opponentSquad,difficulties} from './football-teams.js';
import {passOption,shotOption,receivingPoint} from './football-tactics.js';

const STEP=1/60,HALF_WIDTH=34,HALF_LENGTH=52.5,BALL_RADIUS=.11;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=v=>Number.isFinite(v)?v:0;
const other=team=>team==='home'?'away':'home';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Roles follow this exhibition formation; identities remain the shared squads.
const formation=[[0,48],[0,-13],[-9,8],[-10,29],[10,29],[-25,22],[25,22],[9,8],[-17,-3],[15,-4],[25,-11]];
// Actor meshes face local +Z: yaw PI looks toward the north (-Z) goal.
const face=(x,z)=>Math.atan2(x,z);

export function createFootballSimulation({duration=180,seed=73417,controlMode='semi',opponent='dortmund',difficulty='regular'}={}){
 const matchDuration=Number.isFinite(duration)?clamp(duration,1,3600):180,initialSeed=(seed>>>0)||73417;
 const club=footballTeam(opponent),awayDefinitions=club.id==='dortmund'?awayXI:opponentSquad(club.id).xi,tuning=difficulties[difficulty]||difficulties.regular,teamName=team=>team==='home'?'拜仁':club.short;
 let randomSeed=initialSeed,worldTime=0,accumulator=0,restartDelay=3,lastTouch='home',claimBlockId='',claimBlockUntil=0,goalRestartTeam='away',autoReceive=false,lastSwitchAt=-10,manualLockUntil=0,actionSerial=0,lastInput={x:0,z:0},queuedAction=null;
 const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
 const state={fixture:club,difficulty:Object.hasOwn(difficulties,difficulty)?difficulty:'regular',controlMode:validControlMode(controlMode),time:0,nextPlayerId:null,passTargetId:null,passPreview:null,shotPreview:null,players:[],controlledId:'home-1',ball:{x:0,y:BALL_RADIUS,z:0,vx:0,vy:0,vz:0,ownerId:null},score:{home:0,away:0},elapsed:0,duration:matchDuration,phase:'kickoff',phaseTime:0,paused:false,message:'准备开球',restartType:'kickoff',restartTeam:'home',eventCount:0,events:[],stats:{home:{shots:0,passes:0,tackles:0,saves:0},away:{shots:0,passes:0,tackles:0,saves:0}}};
 const attackSign=team=>team==='home'?-1:1;
 const byId=id=>state.players.find(p=>p.id===id),controlled=()=>byId(state.controlledId);
 function emit(type,team,text,playerId=null){state.message=text;state.eventCount++;state.events.push({id:state.eventCount,type,team,text,playerId});if(state.events.length>12)state.events.shift();}
 function selectPlayer(player,reason,manual=false){if(!player||player.id===state.controlledId)return false;state.controlledId=player.id;lastSwitchAt=worldTime;if(manual)manualLockUntil=worldTime+1.7;emit('switch','home',reason+' '+player.number+' · '+player.name,player.id);return true;}
 function setOwner(player){const b=state.ball,previous=b.ownerId;if(previous!==player.id){player.protectedUntil=worldTime+.38;player.trapUntil=worldTime+.23;}
  if(state.controlMode!=='manual'&&player.team==='home'&&!player.keeper&&(autoReceive||worldTime>=manualLockUntil)){const changed=selectPlayer(player,'控球接管');if(autoReceive||changed)emit('receive','home',player.name+'接球',player.id);}
  autoReceive=false;b.targetId=null;b.receivePoint=null;b.ownerId=player.id;b.vx=b.vy=b.vz=0;lastTouch=player.team;player.possessionSince=worldTime;
 }
 function motion(p,type,duration=.38){p.motion={id:++actionSerial,type,elapsed:0,duration};}
 function stopBall(){Object.assign(state.ball,{vx:0,vy:0,vz:0});}
 function resetPositions(kickoffTeam){
  for(const p of state.players){const f=formation[p.index],ownSide=-attackSign(p.team);p.x=f[0];p.z=p.keeper?ownSide*48:ownSide*Math.max(p.team===kickoffTeam?4:9.8,Math.abs(f[1])*.9);p.vx=p.vz=0;p.yaw=p.team==='home'?Math.PI:0;p.decisionAt=worldTime+.7+random()*.8;p.tackleAt=worldTime+.8;p.possessionSince=worldTime;p.motion=null;p.defending=false;p.runUntil=0;}
  const taker=byId(kickoffTeam+'-1');taker.x=0;taker.z=-attackSign(kickoffTeam)*.62;taker.yaw=kickoffTeam==='home'?Math.PI:0;Object.assign(state.ball,{x:0,y:BALL_RADIUS,z:0});setOwner(taker);claimBlockUntil=0;claimBlockId='';
 }
 function kickoff(team,{first=false}={}){resetPositions(team);state.phase='kickoff';state.phaseTime=0;state.restartType='kickoff';state.restartTeam=team;restartDelay=first?3:2.7;emit('kickoff',team,teamName(team)+'开球');}
 function reset(){
  randomSeed=initialSeed;worldTime=accumulator=0;lastTouch='home';claimBlockId='';claimBlockUntil=0;goalRestartTeam='away';autoReceive=false;lastSwitchAt=-10;manualLockUntil=0;actionSerial=0;lastInput={x:0,z:0};queuedAction=null;
  state.players=[['home',homeXI],['away',awayDefinitions]].flatMap(([team,xi])=>xi.map((definition,index)=>({id:team+'-'+index,team,index,keeper:definition.keeper,number:definition.player.number,name:definition.player.name,x:0,z:0,vx:0,vz:0,yaw:team==='home'?Math.PI:0,stamina:1,decisionAt:0,tackleAt:0,possessionSince:0,protectedUntil:0,trapUntil:0,motion:null,defending:false,lungeUntil:0,tackleWindowUntil:0})));
  Object.assign(state,{controlledId:'home-1',elapsed:0,duration:matchDuration,phase:'kickoff',phaseTime:0,paused:false,message:'准备开球',time:0,nextPlayerId:null,eventCount:0,events:[]});state.score={home:0,away:0};state.stats={home:{shots:0,passes:0,tackles:0,saves:0},away:{shots:0,passes:0,tackles:0,saves:0}};kickoff('home',{first:true});return state;
 }
 function carryBall(dt=STEP){const b=state.ball,p=byId(b.ownerId);if(!p){b.ownerId=null;return;}const speed=Math.hypot(p.vx,p.vz),moving=speed>.15,reach=(p.defending?.46:.58)+Math.min(.28,speed*.035)+(moving?.10*(.5+.5*Math.sin(worldTime*11)):0),x=p.x+Math.sin(p.yaw)*reach,z=p.z+Math.cos(p.yaw)*reach;
  const settle=worldTime<(p.trapUntil||0),amount=1-Math.exp(-dt*(settle?15:32));b.x+=(x-b.x)*amount;b.z+=(z-b.z)*amount;b.y=BALL_RADIUS+(moving?.008*Math.sin(worldTime*13):0);b.vx=p.vx;b.vz=p.vz;b.vy=0;
 }
 function release(player,vx,vz,vy=0){autoReceive=false;const b=state.ball;b.targetId=null;b.receivePoint=null;b.ownerId=null;b.vx=vx;b.vz=vz;b.vy=vy;b.y=Math.max(BALL_RADIUS,b.y);lastTouch=player.team;claimBlockId=player.id;claimBlockUntil=worldTime+.48;player.decisionAt=worldTime+1.2;}
 function pass(player,{direction=null,type='pass',power=.45}={}){const b=state.ball,option=passOption(state.players,player,b,{direction,type,power});if(!option){state.message='这个方向没有接应球员';return false;}const dx=option.x-b.x,dz=option.z-b.z,d=Math.hypot(dx,dz),speed=clamp(d*.43+8,10,22),human=player.id===state.controlledId&&player.team==='home';motion(player,'pass',.32);release(player,dx/d*speed,dz/d*speed,.12);autoReceive=human;player.runUntil=worldTime+3.8;player.runX=dx/(d||1);b.targetId=option.player.id;b.receivePoint={x:option.x,z:option.z,until:worldTime+4};player.yaw=face(dx,dz);state.stats[player.team].passes++;emit(type,player.team,player.name+(type==='through'?' 直塞 → ':' → ')+option.player.name,player.id);return true;}
 function shoot(player,{direction=null,power=.55}={}){
  const b=state.ball,error=(random()-.5)*(player.team==='away'?tuning.shotError:.3),aim=shotOption(player,b,{direction,power,error}),dx=aim.x-b.x,dz=aim.z-b.z,d=Math.hypot(dx,dz);
  if(d<.01)return false;motion(player,'shoot',.46);release(player,dx/d*aim.speed,dz/d*aim.speed,aim.vy);player.yaw=face(dx,dz);state.stats[player.team].shots++;emit('shot',player.team,player.name+'射门！',player.id);return true;
 }
 function nearestOutfield(team,point,exclude=null){return state.players.filter(p=>p.team===team&&!p.keeper&&p.id!==exclude).sort((a,b)=>distance(a,point)-distance(b,point))[0];}
 function restart(type,team,x,z){
  const taker=type==='goalkick'?byId(team+'-0'):nearestOutfield(team,{x,z});taker.x=clamp(x,-33.15,33.15);taker.z=clamp(z,-51.6,51.6);taker.vx=taker.vz=0;taker.yaw=team==='home'?Math.PI:0;
  Object.assign(state.ball,{x:taker.x,y:BALL_RADIUS,z:taker.z});setOwner(taker);state.phase='kickoff';state.phaseTime=0;state.restartType=type;state.restartTeam=team;restartDelay=1.8;claimBlockUntil=0;
  if(team==='home'&&!taker.keeper)selectPlayer(taker,'定位球');
  const names={throwin:'边线球',corner:'角球',goalkick:'球门球'};emit(type,team,teamName(team)+' · '+names[type],taker.id);
 }
 function boundary(previous){
  const b=state.ball,crossings=[];
  if(Math.abs(b.x)>HALF_WIDTH){const plane=Math.sign(b.x)*HALF_WIDTH;crossings.push({axis:'x',plane,t:clamp((plane-previous.x)/(b.x-previous.x||1),0,1)});}
  if(Math.abs(b.z)>HALF_LENGTH){const plane=Math.sign(b.z)*HALF_LENGTH;crossings.push({axis:'z',plane,t:clamp((plane-previous.z)/(b.z-previous.z||1),0,1)});}
  if(!crossings.length)return false;crossings.sort((a,b)=>a.t-b.t);const c=crossings[0],x=previous.x+(b.x-previous.x)*c.t,y=previous.y+(b.y-previous.y)*c.t,z=previous.z+(b.z-previous.z)*c.t;
  if(c.axis==='x'){restart('throwin',other(lastTouch),Math.sign(c.plane)*33.1,clamp(z,-49.5,49.5));return true;}
  const scoringTeam=c.plane<0?'home':'away';
  if(Math.abs(x)<=3.66&&y<=2.44-BALL_RADIUS){state.score[scoringTeam]++;state.phase='goal';state.phaseTime=0;goalRestartTeam=other(scoringTeam);b.ownerId=null;Object.assign(b,{x:clamp(x,-3.5,3.5),y:Math.max(BALL_RADIUS,y),z:Math.sign(c.plane)*53.1});stopBall();emit('goal',scoringTeam,teamName(scoringTeam)+'进球！');for(const p of state.players)p.vx=p.vz=0;return true;}
  if(lastTouch===scoringTeam)restart('goalkick',other(scoringTeam),0,Math.sign(c.plane)*47.5);
  else restart('corner',scoringTeam,x<0?-32.8:32.8,Math.sign(c.plane)*51.2);return true;
 }
 function movePlayer(p,dx,dz,speed,dt){
  const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}const factor=1-Math.exp(-dt*(length>.01?12:16));p.vx+=(dx*speed-p.vx)*factor;p.vz+=(dz*speed-p.vz)*factor;
  p.x=clamp(p.x+p.vx*dt,-35.2,35.2);p.z=clamp(p.z+p.vz*dt,-53.6,53.6);if(Math.hypot(p.vx,p.vz)>.18)p.yaw=turnFootballer(p.yaw,face(p.vx,p.vz),dt*(4.5+3.5/(1+Math.hypot(p.vx,p.vz))));
 }
 function pressureNear(p){return Math.min(...state.players.filter(q=>q.team!==p.team).map(q=>distance(p,q)));}
 function updatePlayers(dt,input){
  const b=state.ball,owner=byId(b.ownerId),possession=owner?.team,pressers={};
  for(const team of['home','away'])pressers[team]=state.players.filter(p=>p.team===team&&!p.keeper&&p.id!==state.controlledId).sort((a,b)=>distance(a,state.ball)-distance(b,state.ball)).slice(0,2).map(p=>p.id);
  for(const p of state.players){
   const sign=attackSign(p.team),isControlled=p.id===state.controlledId;
   if(isControlled){let x=input.x,z=input.z;const chasing=input.defend&&owner?.team!=='home';p.defending=!!input.defend;
    if(chasing){const target=pressureTarget(p,owner,b),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),stop=target.standOff,assist=Math.min(1,Math.max(0,(d-stop)/2));
     x=dx/(d||1)*assist*.88+input.x*.4;z=dz/(d||1)*assist*.88+input.z*.4;
    }else if(!b.ownerId&&b.targetId===p.id&&Math.hypot(x,z)<.18){const target=receivingPoint(p,b),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);x=dx/Math.max(1,d);z=dz/Math.max(1,d);
    }else if(worldTime<p.lungeUntil&&Math.hypot(x,z)<.2){const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);x=dx/(d||1)*.7;z=dz/(d||1)*.7;}
    const sprint=!!input.sprint&&p.stamina>.04,speed=(sprint?7.6:input.defend&&chasing?6.0:5.5)*(b.ownerId===p.id?(input.defend?.62:input.charging?.65:.91):1);movePlayer(p,x,z,speed,dt);
    if(input.defend&&b.ownerId!==p.id)p.yaw=turnFootballer(p.yaw,face(b.x-p.x,b.z-p.z),dt*9);
    p.stamina=clamp(p.stamina+(sprint&&Math.hypot(x,z)>.2?-.10:.085)*dt,0,1);continue;
   }
   p.defending=false;p.stamina=Math.min(1,p.stamina+.035*dt);let targetX,targetZ,speed=p.keeper?4.6:5.1;const aiFactor=p.team==='away'?tuning.speed:1;
   if(p.keeper){const ownGoal=-sign*HALF_LENGTH,goalDistance=Math.abs(b.z-ownGoal),incoming=!b.ownerId&&b.vz*sign<-.5,depth=incoming?2.4:goalDistance<17?4.2:2.8;targetZ=ownGoal+sign*depth;
    const flight=incoming?clamp((targetZ-b.z)/(b.vz||1),0,1.4):0;targetX=clamp(incoming?b.x+b.vx*flight:b.x*(goalDistance<22?.65:.28),-3.5,3.5);speed=incoming?6.2:4.6;
    if(b.ownerId===p.id){targetX=p.x;targetZ=p.z;if(worldTime>p.decisionAt&&worldTime-p.possessionSince>.75){pass(p);p.decisionAt=worldTime+1.4;}}
   }else if(!b.ownerId&&b.targetId===p.id){const target=receivingPoint(p,b);targetX=target.x;targetZ=target.z;speed=5.7;
   }else if(possession===p.team&&worldTime<(p.runUntil||0)){targetX=p.x+(p.runX||0)*5;targetZ=clamp(p.z+sign*12,-48,48);speed=6.0;
   }else if(b.ownerId===p.id){targetX=p.x*.78+Math.sin(worldTime*.7+p.index)*1.3;targetZ=sign*51;speed=5.25;
    if(worldTime>p.decisionAt){p.decisionAt=worldTime+(.9+random()*.9)*(p.team==='away'?tuning.reaction:1);const goalDistance=Math.hypot(p.x,p.z-sign*HALF_LENGTH),pressure=pressureNear(p),possessionStyle=p.team==='away'&&['barcelona','city'].includes(club.id);
     if(goalDistance<23&&Math.abs(p.x)<19)shoot(p);else if(pressure<4.2||random()<(possessionStyle?.48:.18))pass(p);
    }
   }else if(possession!==p.team&&pressers[p.team].includes(p.id)){
    const first=pressers[p.team][0]===p.id;targetX=first?b.x+b.vx*.25:b.x*.72+p.x*.28;targetZ=b.z+(first?b.vz*.25:-sign*3.1);speed=first?5.55:5.05;
   }else{
    const base=formation[p.index],ownZ=(p.team==='home'?base[1]:-base[1]),attacking=possession===p.team;
    targetX=clamp(base[0]+b.x*.20+(attacking?Math.sin(worldTime*.45+p.index)*1.8:0),-30,30);
    targetZ=clamp(ownZ+b.z*(attacking?.34:.20)+(attacking?sign*6:0),-45,45);
    if(attacking&&[1,8,9,10].includes(p.index))targetZ=clamp(sign*Math.max(sign*targetZ,sign*b.z+(p.index===1?10:6)),-48,48);
    if(attacking&&[2,7].includes(p.index))targetZ=clamp(b.z-sign*9,-39,39);
   }
   const dx=targetX-p.x,dz=targetZ-p.z,d=Math.hypot(dx,dz);movePlayer(p,d>.3?dx/Math.max(1,d):0,d>.3?dz/Math.max(1,d):0,speed*aiFactor*Math.min(1,d/1.8),dt);
  }
  // Body separation has fixed world dimensions; camera motion never moves NPCs.
  for(let i=0;i<state.players.length;i++)for(let j=i+1;j<state.players.length;j++){
   const a=state.players[i],b=state.players[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),minimum=.70;if(d>=minimum)continue;
   const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,push=(minimum-d)*.52,wa=a.id===state.controlledId?.25:b.id===state.controlledId?.75:.5;
   a.x=clamp(a.x-nx*push*wa,-35.2,35.2);a.z=clamp(a.z-nz*push*wa,-53.6,53.6);b.x=clamp(b.x+nx*push*(1-wa),-35.2,35.2);b.z=clamp(b.z+nz*push*(1-wa),-53.6,53.6);
  }
 }
 function poke(defender,owner,range){const b=state.ball,window=tackleWindow(defender,owner,b,{range});if(!window.canReach||worldTime<(owner.protectedUntil||0))return false;
  const dx=b.x-defender.x,dz=b.z-defender.z,d=Math.hypot(dx,dz)||1;release(owner,-dx/d*2.4+defender.vx*.18,-dz/d*2.4+defender.vz*.18,.28);lastTouch=defender.team;claimBlockUntil=worldTime+.18;owner.protectedUntil=worldTime+.1;
  state.stats[defender.team].tackles++;emit('tackle',defender.team,defender.name+'出脚断球',defender.id);return true;
 }
 function contestBall(){
  const b=state.ball,owner=byId(b.ownerId);
  if(owner){
   const user=controlled();if(owner.team==='away'&&distance(user,b)<.55&&worldTime>=user.tackleAt&&worldTime>=(owner.protectedUntil||0)&&b.y<.45){if(poke(user,owner,.7))user.tackleAt=worldTime+.9;return;}
   if(owner.team==='away'&&worldTime<(user.tackleWindowUntil||0)&&poke(user,owner,2.05)){user.tackleWindowUntil=0;return;}
   for(const defender of state.players){const range=defender.team==='away'?tuning.range:.9;if(defender.team===owner.team||defender.id===state.controlledId||worldTime<defender.tackleAt||distance(defender,b)>range)continue;
    if(tackleWindow(defender,owner,b,{range}).canReach&&worldTime>=(owner.protectedUntil||0)){defender.tackleAt=worldTime+1.1*(defender.team==='away'?tuning.reaction:1);motion(defender,'tackle',.32);if(poke(defender,owner,range))break;}
   }return;
  }
  const speed=Math.hypot(b.vx,b.vz),eligible=state.players.filter(p=>{const inBox=p.keeper&&Math.abs(p.x)<20&&Math.abs(p.z)>35,reach=inBox?(p.team==='home'&&state.difficulty==='casual'?1.85:1.55):p.keeper?1.05:speed>16?.48:.85;return !(p.id===claimBlockId&&worldTime<claimBlockUntil)&&b.y<(p.keeper?2.22:.72)&&distance(p,b)<reach;});eligible.sort((a,b)=>distance(a,state.ball)-distance(b,state.ball));const p=eligible[0];if(!p)return;
  if(p.keeper&&speed>5){state.stats[p.team].saves++;motion(p,'save',.65);emit('save',p.team,p.name+'扑救',p.id);}setOwner(p);p.decisionAt=worldTime+1.05;
 }
 function assistCursor(input){
  const b=state.ball,p=controlled(),next=cursorCandidate(state.players,b,{exclude:p.id});state.nextPlayerId=next?.id||null;
  const owner=byId(b.ownerId);if(owner?.team==='home'){if(state.controlMode!=='manual'&&!owner.keeper&&worldTime>=manualLockUntil&&worldTime-lastSwitchAt>.25)selectPlayer(owner,'控球接管');return;}
  const receiver=byId(b.targetId);if(!owner&&autoReceive&&receiver?.team==='home'&&state.controlMode!=='manual'&&distance(receiver,b)<7&&worldTime-lastSwitchAt>.25){selectPlayer(receiver,'接球跑位');return;}
  if(state.controlMode!=='assisted'||worldTime<manualLockUntil||worldTime-lastSwitchAt<1.0||b.targetId&&byId(b.targetId)?.team==='home')return;
  if(next&&distance(p,b)>12&&distance(next,b)+4.5<distance(p,b)&&Math.hypot(input.x,input.z)<.25)selectPlayer(next,'防守接管');
 }
 function physicsBall(dt){
  const b=state.ball,previous={x:b.x,y:b.y,z:b.z};if(b.ownerId){carryBall(dt);if(!boundary(previous))contestBall();return;}
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=9.81*dt;
  if(b.y<BALL_RADIUS){b.y=BALL_RADIUS;if(b.vy<-1)b.vy=-b.vy*.28;else b.vy=0;}
  const drag=Math.exp(-(b.y<=BALL_RADIUS+.015?.39:.08)*dt);b.vx*=drag;b.vz*=drag;if(Math.hypot(b.vx,b.vz)<.04)b.vx=b.vz=0;
  if(!boundary(previous))contestBall();
 }
 function step(dt,input){
  worldTime+=dt;state.time=worldTime;state.phaseTime+=dt;for(const p of state.players){if(p.motion){p.motion.elapsed+=dt;if(p.motion.elapsed>=p.motion.duration)p.motion=null;}}
  if(state.phase==='fulltime')return;
  if(state.phase==='goal'){if(state.phaseTime>3.6)kickoff(goalRestartTeam);return;}
  if(state.phase==='kickoff'){carryBall(dt);if(state.phaseTime>=restartDelay){state.phase='playing';state.phaseTime=0;emit('start',state.restartTeam,'比赛进行中');}return;}
  state.elapsed=Math.min(state.duration,state.elapsed+dt);if(state.elapsed>=state.duration){state.phase='fulltime';state.phaseTime=0;stopBall();for(const p of state.players)p.vx=p.vz=0;emit('fulltime',null,'全场结束 · '+state.score.home+' : '+state.score.away);return;}
  assistCursor(input);updatePlayers(dt,input);physicsBall(dt);
  if(state.ball.receivePoint&&worldTime>state.ball.receivePoint.until){state.ball.targetId=null;state.ball.receivePoint=null;autoReceive=false;}
  if(queuedAction){if(worldTime>queuedAction.until)queuedAction=null;else if(state.ball.ownerId===state.controlledId){const next=queuedAction;queuedAction=null;action(next.type,next.options);}}
 }
 function update(dt,input={}){
  if(state.paused||state.phase==='fulltime')return state;const duration=clamp(finite(dt),0,.25),x=clamp(finite(input.x),-1,1),z=clamp(finite(input.z),-1,1),length=Math.max(1,Math.hypot(x,z)),safe={x:x/length,z:z/length,sprint:!!input.sprint,defend:!!input.defend,charging:!!input.charging};lastInput=safe;accumulator+=duration;
  while(accumulator>=STEP-1e-10){step(STEP,safe);accumulator-=STEP;}preview(safe);return state;
 }
 function preview(direction=lastInput){const p=controlled(),b=state.ball,option=b.ownerId===p.id?passOption(state.players,p,b,{direction}):null;state.passTargetId=option?.player.id||null;state.passPreview=option?{x:option.x,z:option.z,name:option.player.name}:null;state.shotPreview=b.ownerId===p.id?shotOption(p,b,{direction}):null;return option;}
 function action(type,options={}){
  if(type==='restart'){reset();return true;}if(state.paused||state.phase!=='playing')return false;const p=controlled(),b=state.ball;
  if(type==='switch'){const next=cursorCandidate(state.players,b,{exclude:p.id});return selectPlayer(next,'控制',true);}
  if(type==='tackle'){
   const friendly=byId(b.ownerId);if(friendly?.team==='home'){state.message=friendly.id===p.id?'正在控球 · 选择传球、直塞或射门':'队友控球中 · 按 Q 换人';return false;}
   if(worldTime<p.tackleAt)return false;p.tackleAt=worldTime+.62;motion(p,'tackle',.34);p.lungeUntil=worldTime+.28;p.tackleWindowUntil=worldTime+.25;
   const owner=byId(b.ownerId);if(owner?.team==='away'){p.yaw=turnFootballer(p.yaw,face(b.x-p.x,b.z-p.z),.75);if(poke(p,owner,2.05))return true;state.message=tackleWindow(p,owner,b).sheltered?'对方正在护球 · 绕到球的一侧':'出脚未触球 · 按住 E 贴近逼抢';return false;}
   if(!owner&&distance(p,b)<1.6&&b.y<.7){setOwner(p);return true;}state.message='按住 E 贴近持球队员，空格出脚';return false;
  }
  if(type==='pass'||type==='through'||type==='shoot'){
   if(b.ownerId!==p.id){if(!b.ownerId&&distance(p,b)<1.1&&b.y<.8)setOwner(p);else{if(!b.ownerId&&distance(p,b)<5){queuedAction={type,options:{...options,direction:options.direction||lastInput},until:worldTime+.45};state.message='已准备接球后'+(type==='shoot'?'射门':'传球');return true;}state.message='先靠近足球；防守时按住逼抢';return false;}}
   const command={...options,direction:options.direction||lastInput,type,power:clamp(finite(options.power??.5),.15,1)};return type==='shoot'?shoot(p,command):pass(p,command);
  }return false;
 }
 reset();return{state,update,action,reset,setPaused(value){state.paused=!!value;},setControlMode(value){state.controlMode=validControlMode(value);manualLockUntil=worldTime+.7;lastSwitchAt=worldTime;return state.controlMode;},attackSign};
}
