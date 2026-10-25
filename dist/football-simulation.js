import {homeXI,awayXI} from './matchday-roster.js';

const STEP=1/60,HALF_WIDTH=34,HALF_LENGTH=52.5,BALL_RADIUS=.11;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=v=>Number.isFinite(v)?v:0;
const other=team=>team==='home'?'away':'home',teamName=team=>team==='home'?'拜仁':'多特蒙德';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Roles follow this exhibition formation; identities remain the shared squads.
const formation=[[0,48],[0,-13],[-9,8],[-10,29],[10,29],[-25,22],[25,22],[9,8],[-17,-3],[15,-4],[25,-11]];
// Actor meshes face local +Z: yaw PI looks toward the north (-Z) goal.
const face=(x,z)=>Math.atan2(x,z);

export function createFootballSimulation({duration=180,seed=73417}={}){
 const matchDuration=Number.isFinite(duration)?clamp(duration,1,3600):180,initialSeed=(seed>>>0)||73417;
 let randomSeed=initialSeed,worldTime=0,accumulator=0,restartDelay=3,lastTouch='home',claimBlockId='',claimBlockUntil=0,goalRestartTeam='away',autoReceive=false;
 const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
 const state={players:[],controlledId:'home-1',ball:{x:0,y:BALL_RADIUS,z:0,vx:0,vy:0,vz:0,ownerId:null},score:{home:0,away:0},elapsed:0,duration:matchDuration,phase:'kickoff',phaseTime:0,paused:false,message:'准备开球',restartType:'kickoff',restartTeam:'home',eventCount:0,events:[],stats:{home:{shots:0,passes:0,tackles:0,saves:0},away:{shots:0,passes:0,tackles:0,saves:0}}};
 const attackSign=team=>team==='home'?-1:1;
 const byId=id=>state.players.find(p=>p.id===id),controlled=()=>byId(state.controlledId);
 function emit(type,team,text,playerId=null){state.message=text;state.eventCount++;state.events.push({id:state.eventCount,type,team,text,playerId});if(state.events.length>12)state.events.shift();}
 function setOwner(player){const b=state.ball;if(autoReceive&&player.team==='home'&&!player.keeper){state.controlledId=player.id;emit('receive','home',player.name+'接球',player.id);}autoReceive=false;b.targetId=null;b.ownerId=player.id;b.vx=b.vy=b.vz=0;lastTouch=player.team;player.possessionSince=worldTime;}
 function stopBall(){Object.assign(state.ball,{vx:0,vy:0,vz:0});}
 function resetPositions(kickoffTeam){
  for(const p of state.players){const f=formation[p.index],ownSide=-attackSign(p.team);p.x=f[0];p.z=p.keeper?ownSide*48:ownSide*Math.max(4,Math.abs(f[1])*.9);p.vx=p.vz=0;p.yaw=p.team==='home'?Math.PI:0;p.decisionAt=worldTime+.7+random()*.8;p.tackleAt=worldTime+.8;p.possessionSince=worldTime;}
  const taker=byId(kickoffTeam+'-1');taker.x=0;taker.z=-attackSign(kickoffTeam)*.9;taker.yaw=kickoffTeam==='home'?Math.PI:0;Object.assign(state.ball,{x:0,y:BALL_RADIUS,z:0});setOwner(taker);claimBlockUntil=0;claimBlockId='';
 }
 function kickoff(team,{first=false}={}){resetPositions(team);state.phase='kickoff';state.phaseTime=0;state.restartType='kickoff';state.restartTeam=team;restartDelay=first?3:2.7;emit('kickoff',team,teamName(team)+'开球');}
 function reset(){
  randomSeed=initialSeed;worldTime=accumulator=0;lastTouch='home';claimBlockId='';claimBlockUntil=0;goalRestartTeam='away';autoReceive=false;
  state.players=[['home',homeXI],['away',awayXI]].flatMap(([team,xi])=>xi.map((definition,index)=>({id:team+'-'+index,team,index,keeper:definition.keeper,number:definition.player.number,name:definition.player.name,x:0,z:0,vx:0,vz:0,yaw:team==='home'?Math.PI:0,stamina:1,decisionAt:0,tackleAt:0,possessionSince:0})));
  Object.assign(state,{controlledId:'home-1',elapsed:0,duration:matchDuration,phase:'kickoff',phaseTime:0,paused:false,message:'准备开球',eventCount:0,events:[]});state.score={home:0,away:0};state.stats={home:{shots:0,passes:0,tackles:0,saves:0},away:{shots:0,passes:0,tackles:0,saves:0}};kickoff('home',{first:true});return state;
 }
 function carryBall(){const b=state.ball,p=byId(b.ownerId);if(!p){b.ownerId=null;return;}const moving=Math.hypot(p.vx,p.vz)>.15,reach=moving?.78:.66;b.x=p.x+Math.sin(p.yaw)*reach;b.z=p.z+Math.cos(p.yaw)*reach;b.y=BALL_RADIUS+(moving?.012*Math.sin(worldTime*13):0);b.vx=p.vx;b.vz=p.vz;b.vy=0;}
 function release(player,vx,vz,vy=0){autoReceive=false;const b=state.ball;b.targetId=null;b.ownerId=null;b.vx=vx;b.vz=vz;b.vy=vy;b.y=Math.max(BALL_RADIUS,b.y);lastTouch=player.team;claimBlockId=player.id;claimBlockUntil=worldTime+.48;player.decisionAt=worldTime+1.2;}
 function choosePass(player){
  const direction={x:Math.sin(player.yaw),z:Math.cos(player.yaw)},attack=attackSign(player.team);let best=null,bestScore=-Infinity;
  for(const teammate of state.players){if(teammate.team!==player.team||teammate.id===player.id)continue;const dx=teammate.x-player.x,dz=teammate.z-player.z,d=Math.hypot(dx,dz);if(d<3||d>46)continue;
   const pressure=Math.min(...state.players.filter(p=>p.team!==player.team).map(p=>distance(p,teammate))),alignment=(dx*direction.x+dz*direction.z)/d,progress=dz*attack;
   const score=alignment*10+Math.min(pressure,10)*.9+clamp(progress,-15,22)*.16-Math.abs(d-13)*.18-(teammate.keeper?5:0);if(score>bestScore){bestScore=score;best=teammate;}
  }return best;
 }
 function pass(player){const target=choosePass(player);if(!target)return false;const b=state.ball,dx=target.x+target.vx*.28-b.x,dz=target.z+target.vz*.28-b.z,d=Math.hypot(dx,dz),speed=clamp(d*.65+6,10,19);const human=player.id===state.controlledId&&player.team==='home';release(player,dx/d*speed,dz/d*speed,.32);autoReceive=human;b.targetId=target.id;player.yaw=face(dx,dz);state.stats[player.team].passes++;emit('pass',player.team,player.name+' → '+target.name,player.id);return true;}
 function shoot(player){
  const b=state.ball,sign=attackSign(player.team),goalZ=sign*HALF_LENGTH,aim=clamp(Math.sin(player.yaw)*2.1-player.x*.02+(random()-.5)*.55,-2.9,2.9),dx=aim-b.x,dz=goalZ-b.z,d=Math.hypot(dx,dz),speed=clamp(19+d*.12,20,27);
  if(d<.01)return false;release(player,dx/d*speed,dz/d*speed,d>23?3.4:1.8);player.yaw=face(dx,dz);state.stats[player.team].shots++;emit('shot',player.team,player.name+'射门！',player.id);return true;
 }
 function nearestOutfield(team,point,exclude=null){return state.players.filter(p=>p.team===team&&!p.keeper&&p.id!==exclude).sort((a,b)=>distance(a,point)-distance(b,point))[0];}
 function restart(type,team,x,z){
  const taker=type==='goalkick'?byId(team+'-0'):nearestOutfield(team,{x,z});taker.x=clamp(x,-33.15,33.15);taker.z=clamp(z,-51.6,51.6);taker.vx=taker.vz=0;taker.yaw=team==='home'?Math.PI:0;
  Object.assign(state.ball,{x:taker.x,y:BALL_RADIUS,z:taker.z});setOwner(taker);state.phase='kickoff';state.phaseTime=0;state.restartType=type;state.restartTeam=team;restartDelay=1.8;claimBlockUntil=0;
  if(team==='home'&&!taker.keeper)state.controlledId=taker.id;
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
  const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}const factor=1-Math.exp(-dt*(length>.01?10:16));p.vx+=(dx*speed-p.vx)*factor;p.vz+=(dz*speed-p.vz)*factor;
  p.x=clamp(p.x+p.vx*dt,-35.2,35.2);p.z=clamp(p.z+p.vz*dt,-53.6,53.6);if(Math.hypot(p.vx,p.vz)>.18)p.yaw=face(p.vx,p.vz);
 }
 function pressureNear(p){return Math.min(...state.players.filter(q=>q.team!==p.team).map(q=>distance(p,q)));}
 function updatePlayers(dt,input){
  const b=state.ball,owner=byId(b.ownerId),possession=owner?.team,pressers={};
  for(const team of['home','away'])pressers[team]=state.players.filter(p=>p.team===team&&!p.keeper&&p.id!==state.controlledId).sort((a,b)=>distance(a,state.ball)-distance(b,state.ball)).slice(0,2).map(p=>p.id);
  for(const p of state.players){
   const sign=attackSign(p.team),isControlled=p.id===state.controlledId;
   if(isControlled){const sprint=!!input.sprint&&p.stamina>.04,speed=(sprint?7.45:5.25)*(b.ownerId===p.id?.88:1);movePlayer(p,input.x,input.z,speed,dt);p.stamina=clamp(p.stamina+(sprint&&Math.hypot(input.x,input.z)>.2?-.11:.08)*dt,0,1);continue;}
   p.stamina=Math.min(1,p.stamina+.035*dt);let targetX,targetZ,speed=p.keeper?4.6:5.1;
   if(p.keeper){const ownGoal=-sign*HALF_LENGTH;targetX=clamp(b.x*.24,-3.1,3.1);targetZ=ownGoal+sign*(Math.abs(b.z-ownGoal)<20?5:3);
    if(b.ownerId===p.id){targetX=p.x;targetZ=p.z;if(worldTime>p.decisionAt&&worldTime-p.possessionSince>.75){pass(p);p.decisionAt=worldTime+1.4;}}
   }else if(b.ownerId===p.id){targetX=p.x*.78+Math.sin(worldTime*.7+p.index)*1.3;targetZ=sign*51;speed=5.45;
    if(worldTime>p.decisionAt){p.decisionAt=worldTime+.7+random()*.8;const goalDistance=Math.hypot(p.x,p.z-sign*HALF_LENGTH),pressure=pressureNear(p);
     if(goalDistance<25&&Math.abs(p.x)<23)shoot(p);else if(pressure<4.2||random()<.18)pass(p);
    }
   }else if(possession!==p.team&&pressers[p.team].includes(p.id)){
    const first=pressers[p.team][0]===p.id;targetX=b.x+(first?b.vx*.13:(p.x>b.x?3:-3));targetZ=b.z+(first?b.vz*.13:-sign*3.4);speed=first?5.55:5.05;
   }else{
    const base=formation[p.index],ownZ=(p.team==='home'?base[1]:-base[1]),attacking=possession===p.team;
    targetX=clamp(base[0]+b.x*.20+(attacking?Math.sin(worldTime*.45+p.index)*1.8:0),-30,30);
    targetZ=clamp(ownZ+b.z*(attacking?.34:.20)+(attacking?sign*6:0),-45,45);
   }
   const dx=targetX-p.x,dz=targetZ-p.z,d=Math.hypot(dx,dz);movePlayer(p,d>.3?dx/Math.max(1,d):0,d>.3?dz/Math.max(1,d):0,speed*Math.min(1,d/1.8),dt);
  }
  // Body separation has fixed world dimensions; camera motion never moves NPCs.
  for(let i=0;i<state.players.length;i++)for(let j=i+1;j<state.players.length;j++){
   const a=state.players[i],b=state.players[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),minimum=.70;if(d>=minimum)continue;
   const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,push=(minimum-d)*.52,wa=a.id===state.controlledId?.25:b.id===state.controlledId?.75:.5;
   a.x=clamp(a.x-nx*push*wa,-35.2,35.2);a.z=clamp(a.z-nz*push*wa,-53.6,53.6);b.x=clamp(b.x+nx*push*(1-wa),-35.2,35.2);b.z=clamp(b.z+nz*push*(1-wa),-53.6,53.6);
  }
 }
 function contestBall(){
  const b=state.ball,owner=byId(b.ownerId);
  if(owner){
   const user=controlled();if(owner.team==='away'&&distance(user,b)<.85&&b.y<.45&&worldTime>=user.tackleAt){user.tackleAt=worldTime+1.0;setOwner(user);state.stats.home.tackles++;emit('tackle','home',user.name+'截下足球',user.id);return;}
   for(const defender of state.players){if(defender.team===owner.team||defender.id===state.controlledId||worldTime<defender.tackleAt||distance(defender,owner)>1.05)continue;defender.tackleAt=worldTime+1.2;
    if(distance(defender,owner)<.77||random()<.31){setOwner(defender);state.stats[defender.team].tackles++;emit('tackle',defender.team,defender.name+'抢断',defender.id);break;}
   }return;
  }
  const speed=Math.hypot(b.vx,b.vz),eligible=state.players.filter(p=>!(p.id===claimBlockId&&worldTime<claimBlockUntil)&&b.y<(p.keeper?2.22:.85)&&distance(p,b)<(p.keeper?1.13:speed>16?.48:1.02));eligible.sort((a,b)=>distance(a,state.ball)-distance(b,state.ball));const p=eligible[0];if(!p)return;
  if(p.keeper&&speed>5){state.stats[p.team].saves++;emit('save',p.team,p.name+'扑救',p.id);}setOwner(p);p.decisionAt=worldTime+.75;
 }
 function physicsBall(dt){
  const b=state.ball,previous={x:b.x,y:b.y,z:b.z};if(b.ownerId){carryBall();if(!boundary(previous))contestBall();return;}
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=9.81*dt;
  if(b.y<BALL_RADIUS){b.y=BALL_RADIUS;if(b.vy<-1)b.vy=-b.vy*.28;else b.vy=0;}
  const drag=Math.exp(-(b.y<=BALL_RADIUS+.015?.39:.08)*dt);b.vx*=drag;b.vz*=drag;if(Math.hypot(b.vx,b.vz)<.04)b.vx=b.vz=0;
  if(!boundary(previous))contestBall();
 }
 function step(dt,input){
  worldTime+=dt;state.phaseTime+=dt;
  if(state.phase==='fulltime')return;
  if(state.phase==='goal'){if(state.phaseTime>3.6)kickoff(goalRestartTeam);return;}
  if(state.phase==='kickoff'){carryBall();if(state.phaseTime>=restartDelay){state.phase='playing';state.phaseTime=0;emit('start',state.restartTeam,'比赛进行中');}return;}
  state.elapsed=Math.min(state.duration,state.elapsed+dt);if(state.elapsed>=state.duration){state.phase='fulltime';state.phaseTime=0;stopBall();for(const p of state.players)p.vx=p.vz=0;emit('fulltime',null,'全场结束 · '+state.score.home+' : '+state.score.away);return;}
  updatePlayers(dt,input);physicsBall(dt);
 }
 function update(dt,input={}){
  if(state.paused||state.phase==='fulltime')return state;const duration=clamp(finite(dt),0,.25),x=clamp(finite(input.x),-1,1),z=clamp(finite(input.z),-1,1),length=Math.max(1,Math.hypot(x,z)),safe={x:x/length,z:z/length,sprint:!!input.sprint};accumulator+=duration;
  while(accumulator>=STEP-1e-10){step(STEP,safe);accumulator-=STEP;}return state;
 }
 function action(type){
  if(type==='restart'){reset();return true;}if(state.paused||state.phase!=='playing')return false;const p=controlled(),b=state.ball;
  if(type==='switch'){const owner=byId(b.ownerId),next=owner?.team==='home'&&!owner.keeper&&owner.id!==p.id?owner:nearestOutfield('home',b,p.id);if(!next)return false;state.controlledId=next.id;emit('switch','home','控制 '+next.number+' · '+next.name,next.id);return true;}
  if(type==='tackle'){
   if(worldTime<p.tackleAt)return false;p.tackleAt=worldTime+1.0;const owner=byId(b.ownerId);
   if(owner?.team==='away'&&distance(p,owner)<2.0){setOwner(p);state.stats.home.tackles++;emit('tackle','home',p.name+'抢断成功',p.id);return true;}
   if(!owner&&distance(p,b)<2.0&&b.y<1){setOwner(p);return true;}state.message='靠近持球队员再抢断';return false;
  }
  if(type==='pass'||type==='shoot'){
   if(b.ownerId!==p.id){if(!b.ownerId&&distance(p,b)<1.5&&b.y<.8)setOwner(p);else{state.message='控球后'+(type==='pass'?'传球':'射门');return false;}}
   return type==='pass'?pass(p):shoot(p);
  }return false;
 }
 reset();return{state,update,action,reset,setPaused(value){state.paused=!!value;},attackSign};
}
