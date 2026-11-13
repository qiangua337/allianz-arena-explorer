import {moveControlledFootballer,moveFootballer,carryFootball} from './football-movement.js';
import {goalkeeperProfile,goalkeeperState} from './goalkeeper.js';
import {moveHumanPenaltyKeeper,penaltyDiveDirection,penaltyDiveHeight,penaltyDiveLead} from './football-penalty.js';
const collisionRadius=.70,collisionRadiusSquared=collisionRadius*collisionRadius;
const penaltyFor=state=>state.setPiece||(state.phase==='penalties'?state.competition?.shootout:null);
const canPredict=state=>!state.paused&&(state.phase==='playing'||state.phase==='penalties')&&penaltyFor(state)?.stage!=='result';
const canInterpolate=state=>!state.paused&&state.phase==='playing'&&!state.setPiece;
const shortestTurn=angle=>Math.abs(angle)<=Math.PI?angle:Math.atan2(Math.sin(angle),Math.cos(angle));
// A small render-only history, never a second simulation: scores, ownership,
// phase, discipline and the match clock are applied immediately from the wire.
// Advancing one server-time playhead avoids restarting a short tween on every
// packet, which otherwise turns 20 Hz snapshots into stop/start mobile motion.
export function createOnlineInterpolation(){
 const capacity=8,stride=113,frames=Array.from({length:capacity},()=>({time:0,owner:null,ownerIndex:-1,pose:new Float64Array(stride),motions:new Array(22)}));
 const displayedMotions=new Array(22),handoffs=new Array(22);
 let head=0,length=0,playhead=0,phase='',controlledId=null,controlledIndex=-1;
 function clear(){
  for(let i=0;i<length;i++)frames[(head+i)%capacity].motions.fill(null);
  displayedMotions.fill(null);handoffs.fill(null);head=length=0;phase='';controlledId=null;controlledIndex=-1;
 }
 function receive(state,former=null){
  if(!canInterpolate(state)||!Number.isFinite(state.time)){clear();return;}
  const latest=length?frames[(head+length-1)%capacity]:null;
  if(phase!==state.phase||latest&&state.time<latest.time)clear();
  if(controlledId!==state.controlledId){
   // Both players' authoritative poses already exist in the history. Only
   // the departing local prediction needs to blend back into that history.
   if(former&&former.id===controlledId&&controlledIndex>=0){
    handoffs[controlledIndex]={...former,elapsed:0,offset:null};
   }
   controlledId=state.controlledId;
   controlledIndex=state.players.findIndex(player=>player.id===controlledId);
   if(controlledIndex>=0)handoffs[controlledIndex]=null;
  }
  phase=state.phase;
  const initial=length===0;
  let frame;
  if(length&&frames[(head+length-1)%capacity].time===state.time)frame=frames[(head+length-1)%capacity];
  else{if(length===capacity){head=(head+1)%capacity;length--;}frame=frames[(head+length)%capacity];length++;}
  frame.time=state.time;frame.owner=state.ball.ownerId;frame.ownerIndex=-1;
  for(let i=0;i<22;i++){const p=state.players[i],at=i*5;frame.pose[at]=p.x;frame.pose[at+1]=p.z;frame.pose[at+2]=p.yaw;frame.pose[at+3]=p.vx;frame.pose[at+4]=p.vz;frame.motions[i]=p.motion;if(p.id===frame.owner)frame.ownerIndex=i;}
  frame.pose[110]=state.ball.x;frame.pose[111]=state.ball.y;frame.pose[112]=state.ball.z;
  if(initial)playhead=frame.time-.1;
 }
 function update(state,dt,jitter=0){
  if(!length||!canInterpolate(state))return;
  const advance=Math.min(.1,Math.max(0,dt));
  const oldest=frames[head],latest=frames[(head+length-1)%capacity],delay=Math.min(.22,Math.max(.1,.075+Math.max(0,jitter)*.0025));
  const rate=Math.max(.85,Math.min(1.15,1+(latest.time-delay-playhead)*3));playhead=Math.min(latest.time,playhead+advance*rate);
  // Once a very old frame leaves the bounded queue, resume from its successor.
  // No extrapolation is allowed to move remote players through a stalled link.
  const time=Math.max(oldest.time,playhead);let a=oldest,b=oldest;
  for(let i=1;i<length;i++){b=frames[(head+i)%capacity];if(b.time>=time)break;a=b;}
  const t=b.time>a.time?Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time))):1;
  const from=a.pose,to=b.pose;
  const carrier=a.owner&&a.owner===b.owner&&a.owner===state.ball.ownerId?a.ownerIndex:-1;
  let ballCorrectionX=0,ballCorrectionZ=0;
  for(let i=0;i<22;i++){
   if(i===controlledIndex)continue;
   const p=state.players[i];
   const at=i*5,yaw=from[at+2],turn=to[at+2]-yaw;
   // Ordinary turns already represent the shortest path. Wrap only across
   // the angle boundary, including yaws that have accumulated past one lap.
   p.x=from[at]+(to[at]-from[at])*t;p.z=from[at+1]+(to[at+1]-from[at+1])*t;
   p.yaw=yaw+shortestTurn(turn)*t;
   p.vx=from[at+3]+(to[at+3]-from[at+3])*t;p.vz=from[at+4]+(to[at+4]-from[at+4])*t;
   const handoff=handoffs[i];
   if(handoff){
    const offset=handoff.offset??={x:handoff.x-p.x,z:handoff.z-p.z,yaw:shortestTurn(handoff.yaw-p.yaw),vx:handoff.vx-p.vx,vz:handoff.vz-p.vz};
    const fraction=handoff.elapsed/.14,weight=1-fraction*fraction*(3-2*fraction);
    const dx=offset.x*weight,dz=offset.z*weight;
    p.x+=dx;p.z+=dz;p.yaw+=offset.yaw*weight;p.vx+=offset.vx*weight;p.vz+=offset.vz*weight;
    if(i===carrier){ballCorrectionX=dx;ballCorrectionZ=dz;}
    handoff.elapsed+=advance;
    if(handoff.elapsed>=.14)handoffs[i]=null;
   }
   const later=b.motions[i],laterStarted=later&&time+1e-6>=b.time-later.elapsed;
   const stroke=laterStarted?later:a.motions[i];
   const elapsed=stroke?Math.max(0,time-(laterStarted?b.time:a.time)+stroke.elapsed):0;
   if(stroke&&elapsed<stroke.duration){
    let display=displayedMotions[i];
    if(!display||display.id!==stroke.id||display.type!==stroke.type)display=displayedMotions[i]={...stroke};
    display.elapsed=elapsed;p.motion=display;
   }else{displayedMotions[i]=null;p.motion=null;}
  }
  // Keep the ball with the remote strike through possession changes. Local
  // touches still use their immediate prediction/authoritative position.
  const local=state.controlledId,dx=from[110]-to[110],dz=from[112]-to[112];
  if(state.ball.ownerId!==local&&latest.owner!==local&&a.owner!==local&&b.owner!==local&&dx*dx+dz*dz<36){
   const kick=a.owner&&!b.owner?b.motions[a.ownerIndex]:null;
   const strikeAt=kick?b.time-kick.elapsed:0;
   let x0=from[110],y0=from[111],z0=from[112],x1=to[110],y1=to[111],z1=to[112],blend=t;
   if(kick&&strikeAt>a.time&&strikeAt<b.time&&Number.isFinite(kick.contactX)&&Number.isFinite(kick.contactY)&&Number.isFinite(kick.contactZ)){
    if(time<strikeAt){x1=kick.contactX;y1=kick.contactY;z1=kick.contactZ;blend=(time-a.time)/(strikeAt-a.time);}
    else{x0=kick.contactX;y0=kick.contactY;z0=kick.contactZ;blend=(time-strikeAt)/(b.time-strikeAt);}
   }
   state.ball.x=x0+(x1-x0)*blend+ballCorrectionX;state.ball.y=y0+(y1-y0)*blend;state.ball.z=z0+(z1-z0)*blend+ballCorrectionZ;
  }
 }
 return{receive,update,clear,get bufferedFrames(){return length;},get playhead(){return playhead;},get capacity(){return capacity;},get bytes(){return capacity*stride*Float64Array.BYTES_PER_ELEMENT;}};
}
// Predict only the local avatar and its carried ball. Possession, tackles,
// free-ball physics, goals, events and the match clock stay server-owned.
export function createOnlinePrediction(team){
 const history=Array.from({length:90},()=>({seq:0,dt:0,input:null})),actors=Array.from({length:22},()=>({dismissed:true}));let head=0,length=0,pending=0,player=null,playerIndex=-1,ball=null,owner=null,time=0,age=0,phase='',errorX=0,errorZ=0,motion=null,receiveOverride=null,setPiece=null,penaltyGesture=null,difficulty='regular';
 const penaltyKey=k=>k?[k.taker,k.keeper,k.home?.length,k.away?.length].join(':'):'';
 function step(input,dt,players){for(let left=dt;left>1e-8;){const h=Math.min(1/60,left);time+=h;
   if(setPiece){if(player.id===setPiece.keeper&&setPiece.stage!=='setup'){
    const keeper=player.keeperState;
    if(penaltyGesture&&time>=penaltyGesture.state.diveAt&&!(keeper.diveAt>=penaltyGesture.state.diveAt))Object.assign(keeper,penaltyGesture.state);
    moveHumanPenaltyKeeper(player,setPiece.goalZ,time,input,h,moveFootballer);
   }left-=h;continue;}
   const receiving=player.receiveControl;moveControlledFootballer(player,ball,ball.ownerId===player.id?player:owner,input,h,time);if(receiving&&!player.receiveControl&&ball.targetId===player.id&&!ball.ownerId)receiveOverride=receiving.passId;
   for(const other of players){
    if(other.id===player.id||other.dismissed)continue;
    const dx=player.x-other.x,dz=player.z-other.z,distanceSquared=dx*dx+dz*dz;
    if(!(distanceSquared<collisionRadiusSquared))continue;
    const d=Math.sqrt(distanceSquared),push=(collisionRadius-d)*.26;
    player.x+=(d>.001?dx/d:1)*push;player.z+=(d>.001?dz/d:0)*push;
   }
   player.x=Math.max(-35.2,Math.min(35.2,player.x));player.z=Math.max(-53.6,Math.min(53.6,player.z));if(ball.ownerId===player.id)carryFootball(player,ball,h,time);left-=h;}}
 function drop(){const record=history[head];pending=Math.max(0,pending-record.dt);record.input=null;head=(head+1)%history.length;length--;}
 function sequencePending(sequence){
  for(let i=length-1;i>=0;i--){
   const record=history[(head+i)%history.length];
   if(record.seq!==Infinity)break;
   record.seq=sequence;
  }
 }
 function clear(){player=null;playerIndex=-1;ball=null;while(length)drop();pending=0;motion=null;receiveOverride=null;setPiece=penaltyGesture=null;errorX=errorZ=0;age=0;}
 function receive(state,ack=0){
  const penalty=penaltyFor(state);playerIndex=state.players.findIndex(p=>p.id===state.controlledId);
  const p=state.players[playerIndex],reset=!player||player.id!==p?.id||!canPredict(state)||phase!==state.phase||!penalty&&ball?.ownerId!==state.ball.ownerId||penaltyKey(setPiece)!==penaltyKey(penalty);
  const oldX=player?.x+errorX,oldZ=player?.z+errorZ;if(reset){while(length)drop();}else while(length&&history[head].seq<=ack)drop();player={...p,keeperState:p&&penalty?.keeper===p.id?{...goalkeeperState(),...p.keeperState}:null};ball={...state.ball};
  // Interpolated render poses must never become collision or pressure inputs.
  // Keep these tiny authority records separate from the displayed players.
  for(let i=0;i<actors.length;i++){const p=state.players[i],a=actors[i];if(p){a.id=p.id;a.team=p.team;a.x=p.x;a.z=p.z;a.vx=p.vx;a.vz=p.vz;a.yaw=p.yaw;a.dismissed=p.dismissed;}else{a.id=null;a.dismissed=true;}}
  owner=ball.ownerId?actors.find(p=>p.id===ball.ownerId):null;time=state.time;age=0;phase=state.phase;difficulty=state.difficulty;
  setPiece=penalty?{goalZ:-52.5,...penalty,runupStartedAt:state.time-(penalty.time??0)}:null;
  if(reset){motion=penaltyGesture=null;receiveOverride=null;}
  else if(penaltyGesture){
   const serverDive=player.motion?.id>=0&&['dive','set'].includes(player.keeperState?.phase);
   if(serverDive||time>=penaltyGesture.expiresAt)motion=penaltyGesture=null;
  }else if(player.motion?.type===motion?.type)motion=null;
  if(player.receiveControl?.passId===receiveOverride)player.receiveControl=null;
  for(let i=0;i<length;i++){const record=history[(head+i)%history.length];step(record.input,record.dt,actors);}
  const dx=oldX-player.x,dz=oldZ-player.z,blend=!reset&&dx*dx+dz*dz<6.25;
  errorX=blend?dx:0;errorZ=blend?dz:0;
 }
 function update(state,dt,input,sequence){
  if(!canPredict(state)){clear();return;}
  if(!player)return;
  const p=state.players[playerIndex];
  if(!p||p.id!==player.id)return;
  age+=dt;if(age>.6){if(p.motion?.id===-1)p.motion=null;motion=null;return;}
  dt=Math.min(.1,Math.max(0,dt));
  if(sequence>0&&dt>0){
   if(length===history.length)drop();
   const record=history[(head+length)%history.length];
   // Until the next send assigns a sequence, an old acknowledgment cannot
   // remove input sampled after its packet. Keep the whole unsent suffix ordered.
   record.seq=length&&history[(head+length-1)%history.length].seq===Infinity?Infinity:sequence;
   record.dt=dt;record.input=input;length++;pending+=dt;
   while(pending>.6)drop();
   step(input,dt,actors);
  }
  const decay=Math.exp(-dt*16);errorX*=decay;errorZ*=decay;
  p.x=player.x+errorX;p.z=player.z+errorZ;p.vx=player.vx;p.vz=player.vz;p.yaw=player.yaw;p.stamina=player.stamina;
  p.defending=player.defending;p.receiveControl=player.receiveControl;p.pivotUntil=player.pivotUntil;
  if(setPiece?.keeper===p.id)Object.assign(p.keeperState??={},player.keeperState);
  const displayBall=state.ball;
  if(ball.ownerId===p.id&&displayBall.ownerId===p.id){
   displayBall.x=ball.x+errorX;displayBall.z=ball.z+errorZ;displayBall.y=ball.y;
   displayBall.vx=ball.vx;displayBall.vz=ball.vz;
  }
  if(motion){
   motion.elapsed+=dt;
   if(motion.elapsed<motion.duration)p.motion={...motion};
   else{if(p.motion?.id===-1)p.motion=null;motion=null;}
  }
 }
 function animate(type,latency=0,options={},shotKind='drive'){
  if(!player)return;
  if(setPiece){
   // The referee starts the approach and controls when the ball is struck.
   // An early keeper input can be sent to the server without playing a dive.
   if(type!=='tackle'||player.id!==setPiece.keeper)return;
   const diveOnRunup=setPiece.stage==='runup'&&time>=setPiece.runupStartedAt+setPiece.runupDuration-penaltyDiveLead;
   if(setPiece.stage!=='flight'&&!diveOnRunup)return;
   const g=player.keeperState,profile=goalkeeperProfile(difficulty),direction=penaltyDiveDirection(options.direction?.x,player.vx),height=penaltyDiveHeight(options.penaltyAim?.y);
   if(penaltyGesture||time<(g.recoverUntil||0))return;
   const saveWindow=profile.window+penaltyDiveLead;
   const targetX=Math.max(-3.7,Math.min(3.7,player.x+direction*2));
   const gesture={phase:direction?'dive':'set',committed:true,direction,diveAt:time,diveUntil:time+saveWindow,recoverUntil:time+saveWindow+profile.recovery,targetX,targetY:height};
   penaltyGesture={state:gesture,expiresAt:time+Math.min(.75,Math.max(.24,latency/1000+.16))};
   Object.assign(g,gesture);
   motion={id:-1,type:direction?'dive':'save',elapsed:0,duration:direction?saveWindow+profile.recovery:.55,direction:direction*player.attackSign,height};
   return;
  }
  const duration=Math.min(.48,Math.max(.24,latency/1000+.08));
  if(type==='tackle'){motion={id:-1,type,elapsed:0,duration};return;}
  if(!['pass','through','shoot'].includes(type))return;
  // A queued one-touch pass is still sent immediately. Its strike is
  // presented only when the authoritative player reaches the ball.
  const reachable=!ball.ownerId&&!ball.targetId&&ball.y<.4&&Math.hypot(player.x-ball.x,player.z-ball.z)<.9;
  if(ball.ownerId!==player.id&&!reachable)return;
  const stroke=type==='shoot'?shotKind:type==='through'?'through':'short';
  motion={id:-1,type:type==='through'?'pass':type,elapsed:0,duration,predicted:true,stroke,power:options.power,approachSpeed:Math.hypot(player.vx,player.vz)};
 }
 return{receive,update,clear,animate,sequencePending,get pendingSeconds(){return pending;}};
}
