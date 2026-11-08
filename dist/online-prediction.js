import {moveControlledFootballer,moveFootballer,carryFootball} from './football-movement.js';
import {goalkeeperProfile} from './goalkeeper.js';
// Predict only the local avatar and its carried ball. Possession, tackles,
// free-ball physics, goals, events and the match clock stay server-owned.
export function createOnlinePrediction(team){
 let player=null,ball=null,owner=null,history=[],time=0,age=0,phase='',errorX=0,errorZ=0,motion=null,receiveOverride=null,setPiece=null;
 const penaltyKey=k=>k?[k.type,k.stage,k.taker,k.keeper].join(':'):'';
 function step(input,dt,players){for(let left=dt;left>1e-8;){const h=Math.min(1/60,left);time+=h;
   if(setPiece){if(player.id===setPiece.keeper&&setPiece.stage!=='setup'){const g=player.keeperState||(player.keeperState={phase:'ready'});if(g.phase==='dive'&&time>=g.diveUntil)g.phase='recover';if(g.phase==='recover'&&time>=g.recoverUntil)g.phase='ready';const dive=g.phase==='dive',recover=g.phase==='recover';moveFootballer(player,dive?g.direction:recover?0:input.x||0,0,dive?5.6:3.6,h);player.x=Math.max(-3.65,Math.min(3.65,player.x));player.z=setPiece.goalZ-setPiece.attackSign*.12;player.vz=0;player.yaw=setPiece.attackSign<0?0:Math.PI;}left-=h;continue;}
   const receiving=player.receiveControl;moveControlledFootballer(player,ball,ball.ownerId===player.id?player:owner,input,h,time);if(receiving&&!player.receiveControl&&ball.targetId===player.id&&!ball.ownerId)receiveOverride=receiving.passId;
   for(const other of players){if(other.id===player.id||other.dismissed)continue;const dx=player.x-other.x,dz=player.z-other.z,d=Math.hypot(dx,dz);if(d<.70){const push=(.70-d)*.26;player.x+=(d>.001?dx/d:1)*push;player.z+=(d>.001?dz/d:0)*push;}}
   player.x=Math.max(-35.2,Math.min(35.2,player.x));player.z=Math.max(-53.6,Math.min(53.6,player.z));if(ball.ownerId===player.id)carryFootball(player,ball,h,time);left-=h;}}
 function clear(){player=null;ball=null;history=[];motion=null;receiveOverride=null;setPiece=null;errorX=errorZ=0;age=0;}
 function receive(state,ack=0){const p=state.players.find(p=>p.id===state.controlledId),reset=!player||player.id!==p?.id||state.paused||state.phase!=='playing'||phase!==state.phase||ball?.ownerId!==state.ball.ownerId||penaltyKey(setPiece)!==penaltyKey(state.setPiece);
  const oldX=player?.x+errorX,oldZ=player?.z+errorZ;history=reset?[]:history.filter(record=>record.seq>ack);player={...p,keeperState:p?.keeperState?{...p.keeperState}:null};ball={...state.ball};owner=state.players.find(p=>p.id===ball.ownerId);time=state.time;age=0;phase=state.phase;setPiece=state.setPiece?{...state.setPiece}:null;
  if(reset){motion=null;receiveOverride=null;}else if(player.motion?.type===motion?.type)motion=null;
  if(player.receiveControl?.passId===receiveOverride)player.receiveControl=null;
  for(const record of history)step(record.input,record.dt,state.players);
  const dx=oldX-player.x,dz=oldZ-player.z;errorX=!reset&&Math.hypot(dx,dz)<2.5?dx:0;errorZ=!reset&&Math.hypot(dx,dz)<2.5?dz:0;
 }
 function update(state,dt,input,sequence){if(state.paused||state.phase!=='playing'){clear();return;}if(!player)return;age+=dt;if(age>.6){motion=null;return;}dt=Math.min(.1,Math.max(0,dt));
  if(sequence>0){history.push({seq:sequence,dt,input});while(history.length>90||history.reduce((sum,p)=>sum+p.dt,0)>.6)history.shift();step(input,dt,state.players);}
  errorX*=Math.exp(-dt*16);errorZ*=Math.exp(-dt*16);const p=state.players.find(p=>p.id===player.id);if(!p)return;Object.assign(p,{x:player.x+errorX,z:player.z+errorZ,vx:player.vx,vz:player.vz,yaw:player.yaw,stamina:player.stamina,defending:player.defending,receiveControl:player.receiveControl,pivotUntil:player.pivotUntil});
  if(ball.ownerId===p.id&&state.ball.ownerId===p.id)Object.assign(state.ball,{x:ball.x+errorX,z:ball.z+errorZ,y:ball.y,vx:ball.vx,vz:ball.vz});
  if(motion){motion.elapsed+=dt;if(motion.elapsed<motion.duration)p.motion={...motion};else motion=null;}
 }
  return{receive,update,clear,animate(type,latency=0,options={}){if(!player)return;if(setPiece&&type==='tackle'&&player.id===setPiece.keeper&&setPiece.stage!=='setup'){const g=player.keeperState,profile=goalkeeperProfile(),direction=Math.sign(options.direction?.x||player.vx||1);if(time<(g.recoverUntil||0))return;Object.assign(g,{phase:'dive',direction,diveAt:time,diveUntil:time+profile.window,recoverUntil:time+profile.window+profile.recovery});motion={id:-1,type:'dive',elapsed:0,duration:profile.window+profile.recovery,direction:direction*player.attackSign,height:1};return;}if(['pass','through','shoot','tackle'].includes(type))motion={id:-1,type:type==='through'?'pass':type,elapsed:0,duration:Math.min(.48,Math.max(.24,latency/1000+.08))};},get pendingSeconds(){return history.reduce((sum,p)=>sum+p.dt,0);}};
}
