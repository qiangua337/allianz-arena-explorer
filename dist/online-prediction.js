import {moveControlledFootballer,moveFootballer,carryFootball} from './football-movement.js';
import {goalkeeperProfile} from './goalkeeper.js';
// A small render-only history, never a second simulation: scores, ownership,
// phase, discipline and the match clock are applied immediately from the wire.
// Advancing one server-time playhead avoids restarting a short tween on every
// packet, which otherwise turns 20 Hz snapshots into stop/start mobile motion.
export function createOnlineInterpolation(){
 const capacity=8,stride=113,frames=Array.from({length:capacity},()=>({time:0,owner:null,pose:new Float64Array(stride),motions:new Array(22)}));
 const displayedMotions=new Array(22);let head=0,length=0,playhead=0,phase='',controlledId=null;
 function clear(){
  for(let i=0;i<length;i++)frames[(head+i)%capacity].motions.fill(null);
  displayedMotions.fill(null);head=length=0;phase='';controlledId=null;
 }
 function receive(state){
  if(state.paused||state.phase!=='playing'||!Number.isFinite(state.time)){clear();return;}
  const latest=length?frames[(head+length-1)%capacity]:null;
  if(phase!==state.phase||controlledId!==state.controlledId||latest&&state.time<latest.time){clear();}
  phase=state.phase;controlledId=state.controlledId;let frame;
  if(length&&frames[(head+length-1)%capacity].time===state.time)frame=frames[(head+length-1)%capacity];
  else{if(length===capacity){head=(head+1)%capacity;length--;}frame=frames[(head+length)%capacity];length++;}
  frame.time=state.time;frame.owner=state.ball.ownerId;
  for(let i=0;i<22;i++){const p=state.players[i],at=i*5;frame.pose[at]=p.x;frame.pose[at+1]=p.z;frame.pose[at+2]=p.yaw;frame.pose[at+3]=p.vx;frame.pose[at+4]=p.vz;frame.motions[i]=p.motion;}
  frame.pose[110]=state.ball.x;frame.pose[111]=state.ball.y;frame.pose[112]=state.ball.z;
  if(length===1)playhead=frame.time-.1;
 }
 function update(state,dt,jitter=0){
  if(!length||state.paused||state.phase!=='playing')return;
  const oldest=frames[head],latest=frames[(head+length-1)%capacity],delay=Math.min(.22,Math.max(.1,.075+Math.max(0,jitter)*.0025));
  const rate=Math.max(.85,Math.min(1.15,1+(latest.time-delay-playhead)*3));playhead=Math.min(latest.time,playhead+Math.min(.1,Math.max(0,dt))*rate);
  // Once a very old frame leaves the bounded queue, resume from its successor.
  // No extrapolation is allowed to move remote players through a stalled link.
  const time=Math.max(oldest.time,playhead);let a=oldest,b=oldest;
  for(let i=1;i<length;i++){b=frames[(head+i)%capacity];if(b.time>=time)break;a=b;}
  const t=b.time>a.time?Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time))):1;
  for(let i=0;i<22;i++){
   const p=state.players[i];if(p.id===state.controlledId)continue;
   const at=i*5,yaw=a.pose[at+2],turn=b.pose[at+2]-yaw;
   p.x=a.pose[at]+(b.pose[at]-a.pose[at])*t;p.z=a.pose[at+1]+(b.pose[at+1]-a.pose[at+1])*t;
   p.yaw=yaw+Math.atan2(Math.sin(turn),Math.cos(turn))*t;
   p.vx=a.pose[at+3]+(b.pose[at+3]-a.pose[at+3])*t;p.vz=a.pose[at+4]+(b.pose[at+4]-a.pose[at+4])*t;
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
  const local=state.controlledId;
  if(state.ball.ownerId!==local&&latest.owner!==local&&a.owner!==local&&b.owner!==local&&Math.hypot(a.pose[110]-b.pose[110],a.pose[112]-b.pose[112])<6){
   const kick=a.owner&&!b.owner?b.motions[state.players.findIndex(p=>p.id===a.owner)]:null;
   const strikeAt=kick?b.time-kick.elapsed:0;
   let x0=a.pose[110],y0=a.pose[111],z0=a.pose[112],x1=b.pose[110],y1=b.pose[111],z1=b.pose[112],blend=t;
   if(kick&&strikeAt>a.time&&strikeAt<b.time&&Number.isFinite(kick.contactX)&&Number.isFinite(kick.contactY)&&Number.isFinite(kick.contactZ)){
    if(time<strikeAt){x1=kick.contactX;y1=kick.contactY;z1=kick.contactZ;blend=(time-a.time)/(strikeAt-a.time);}
    else{x0=kick.contactX;y0=kick.contactY;z0=kick.contactZ;blend=(time-strikeAt)/(b.time-strikeAt);}
   }
   state.ball.x=x0+(x1-x0)*blend;state.ball.y=y0+(y1-y0)*blend;state.ball.z=z0+(z1-z0)*blend;
  }
 }
 return{receive,update,clear,get bufferedFrames(){return length;},get playhead(){return playhead;},get capacity(){return capacity;},get bytes(){return capacity*stride*Float64Array.BYTES_PER_ELEMENT;}};
}
// Predict only the local avatar and its carried ball. Possession, tackles,
// free-ball physics, goals, events and the match clock stay server-owned.
export function createOnlinePrediction(team){
 const history=Array.from({length:90},()=>({seq:0,dt:0,input:null})),actors=Array.from({length:22},()=>({dismissed:true}));let head=0,length=0,pending=0,player=null,ball=null,owner=null,time=0,age=0,phase='',errorX=0,errorZ=0,motion=null,receiveOverride=null,setPiece=null;
 const penaltyKey=k=>k?[k.type,k.stage,k.taker,k.keeper].join(':'):'';
 function step(input,dt,players){for(let left=dt;left>1e-8;){const h=Math.min(1/60,left);time+=h;
   if(setPiece){if(player.id===setPiece.keeper&&setPiece.stage!=='setup'){const g=player.keeperState||(player.keeperState={phase:'ready'});if(g.phase==='dive'&&time>=g.diveUntil)g.phase='recover';if(g.phase==='recover'&&time>=g.recoverUntil)g.phase='ready';const dive=g.phase==='dive',recover=g.phase==='recover';moveFootballer(player,dive?g.direction:recover?0:input.x||0,0,dive?5.6:3.6,h);player.x=Math.max(-3.65,Math.min(3.65,player.x));player.z=setPiece.goalZ-setPiece.attackSign*.12;player.vz=0;player.yaw=setPiece.attackSign<0?0:Math.PI;}left-=h;continue;}
   const receiving=player.receiveControl;moveControlledFootballer(player,ball,ball.ownerId===player.id?player:owner,input,h,time);if(receiving&&!player.receiveControl&&ball.targetId===player.id&&!ball.ownerId)receiveOverride=receiving.passId;
   for(const other of players){if(other.id===player.id||other.dismissed)continue;const dx=player.x-other.x,dz=player.z-other.z,d=Math.hypot(dx,dz);if(d<.70){const push=(.70-d)*.26;player.x+=(d>.001?dx/d:1)*push;player.z+=(d>.001?dz/d:0)*push;}}
   player.x=Math.max(-35.2,Math.min(35.2,player.x));player.z=Math.max(-53.6,Math.min(53.6,player.z));if(ball.ownerId===player.id)carryFootball(player,ball,h,time);left-=h;}}
 function drop(){const record=history[head];pending=Math.max(0,pending-record.dt);record.input=null;head=(head+1)%history.length;length--;}
 function clear(){player=null;ball=null;while(length)drop();pending=0;motion=null;receiveOverride=null;setPiece=null;errorX=errorZ=0;age=0;}
 function receive(state,ack=0){const p=state.players.find(p=>p.id===state.controlledId),reset=!player||player.id!==p?.id||state.paused||state.phase!=='playing'||phase!==state.phase||ball?.ownerId!==state.ball.ownerId||penaltyKey(setPiece)!==penaltyKey(state.setPiece);
  const oldX=player?.x+errorX,oldZ=player?.z+errorZ;if(reset){while(length)drop();}else while(length&&history[head].seq<=ack)drop();player={...p,keeperState:p?.keeperState?{...p.keeperState}:null};ball={...state.ball};
  // Interpolated render poses must never become collision or pressure inputs.
  // Keep these tiny authority records separate from the displayed players.
  for(let i=0;i<actors.length;i++){const p=state.players[i],a=actors[i];if(p){a.id=p.id;a.team=p.team;a.x=p.x;a.z=p.z;a.vx=p.vx;a.vz=p.vz;a.yaw=p.yaw;a.dismissed=p.dismissed;}else{a.id=null;a.dismissed=true;}}
  owner=ball.ownerId?actors.find(p=>p.id===ball.ownerId):null;time=state.time;age=0;phase=state.phase;setPiece=state.setPiece?{...state.setPiece}:null;
  if(reset){motion=null;receiveOverride=null;}else if(player.motion?.type===motion?.type)motion=null;
  if(player.receiveControl?.passId===receiveOverride)player.receiveControl=null;
  for(let i=0;i<length;i++){const record=history[(head+i)%history.length];step(record.input,record.dt,actors);}
  const dx=oldX-player.x,dz=oldZ-player.z;errorX=!reset&&Math.hypot(dx,dz)<2.5?dx:0;errorZ=!reset&&Math.hypot(dx,dz)<2.5?dz:0;
 }
 function update(state,dt,input,sequence){
  if(state.paused||state.phase!=='playing'){clear();return;}
  if(!player)return;
  const p=state.players.find(p=>p.id===player.id);
  if(!p)return;
  age+=dt;if(age>.6){if(p.motion?.id===-1)p.motion=null;motion=null;return;}
  dt=Math.min(.1,Math.max(0,dt));
  if(sequence>0){if(length===history.length)drop();const record=history[(head+length)%history.length];record.seq=sequence;record.dt=dt;record.input=input;length++;pending+=dt;while(pending>.6)drop();step(input,dt,actors);}
  errorX*=Math.exp(-dt*16);errorZ*=Math.exp(-dt*16);Object.assign(p,{x:player.x+errorX,z:player.z+errorZ,vx:player.vx,vz:player.vz,yaw:player.yaw,stamina:player.stamina,defending:player.defending,receiveControl:player.receiveControl,pivotUntil:player.pivotUntil});
  if(ball.ownerId===p.id&&state.ball.ownerId===p.id)Object.assign(state.ball,{x:ball.x+errorX,z:ball.z+errorZ,y:ball.y,vx:ball.vx,vz:ball.vz});
  if(motion){
   motion.elapsed+=dt;
   if(motion.elapsed<motion.duration)p.motion={...motion};
   else{if(p.motion?.id===-1)p.motion=null;motion=null;}
  }
 }
 function animate(type,latency=0,options={},shotKind='drive'){
  if(!player)return;
  if(setPiece&&type==='tackle'&&player.id===setPiece.keeper&&setPiece.stage!=='setup'){
   const g=player.keeperState,profile=goalkeeperProfile(),direction=Math.sign(options.direction?.x||player.vx||1);
   if(time<(g.recoverUntil||0))return;
   Object.assign(g,{phase:'dive',direction,diveAt:time,diveUntil:time+profile.window,recoverUntil:time+profile.window+profile.recovery});
   motion={id:-1,type:'dive',elapsed:0,duration:profile.window+profile.recovery,direction:direction*player.attackSign,height:1};
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
  motion={id:-1,type:type==='through'?'pass':type,elapsed:0,duration,predicted:true,stroke,power:options.power};
 }
 return{receive,update,clear,animate,get pendingSeconds(){return pending;}};
}
