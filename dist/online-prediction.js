import {moveControlledFootballer,carryFootball} from './football-movement.js';
// Predict only the local avatar and its carried ball. Possession, tackles,
// free-ball physics, goals, events and the match clock stay server-owned.
export function createOnlinePrediction(team){
 let player=null,ball=null,owner=null,history=[],time=0,age=0,phase='',errorX=0,errorZ=0,motion=null;
 function step(input,dt,players){for(let left=dt;left>1e-8;){const h=Math.min(1/60,left);time+=h;moveControlledFootballer(player,ball,ball.ownerId===player.id?player:owner,input,h,time);
   for(const other of players){if(other.id===player.id)continue;const dx=player.x-other.x,dz=player.z-other.z,d=Math.hypot(dx,dz);if(d<.70){const push=(.70-d)*.26;player.x+=(d>.001?dx/d:1)*push;player.z+=(d>.001?dz/d:0)*push;}}
   player.x=Math.max(-35.2,Math.min(35.2,player.x));player.z=Math.max(-53.6,Math.min(53.6,player.z));if(ball.ownerId===player.id)carryFootball(player,ball,h,time);left-=h;}}
 function clear(){player=null;ball=null;history=[];motion=null;errorX=errorZ=0;age=0;}
 function receive(state,ack=0){const p=state.players.find(p=>p.id===state.controlledId),reset=!player||player.id!==p?.id||state.paused||state.phase!=='playing'||phase!==state.phase||ball?.ownerId!==state.ball.ownerId;
  const oldX=player?.x+errorX,oldZ=player?.z+errorZ;history=reset?[]:history.filter(record=>record.seq>ack);player={...p};ball={...state.ball};owner=state.players.find(p=>p.id===ball.ownerId);time=state.time;age=0;phase=state.phase;
  if(reset)motion=null;else if(player.motion?.type===motion?.type)motion=null;
  for(const record of history)step(record.input,record.dt,state.players);
  const dx=oldX-player.x,dz=oldZ-player.z;errorX=!reset&&Math.hypot(dx,dz)<2.5?dx:0;errorZ=!reset&&Math.hypot(dx,dz)<2.5?dz:0;
 }
 function update(state,dt,input,sequence){if(state.paused||state.phase!=='playing'){clear();return;}if(!player)return;age+=dt;if(age>.6){motion=null;return;}dt=Math.min(.1,Math.max(0,dt));
  if(sequence>0){history.push({seq:sequence,dt,input});while(history.length>90||history.reduce((sum,p)=>sum+p.dt,0)>.6)history.shift();step(input,dt,state.players);}
  errorX*=Math.exp(-dt*16);errorZ*=Math.exp(-dt*16);const p=state.players.find(p=>p.id===player.id);if(!p)return;Object.assign(p,{x:player.x+errorX,z:player.z+errorZ,vx:player.vx,vz:player.vz,yaw:player.yaw,stamina:player.stamina,defending:player.defending});
  if(ball.ownerId===p.id&&state.ball.ownerId===p.id)Object.assign(state.ball,{x:ball.x+errorX,z:ball.z+errorZ,y:ball.y,vx:ball.vx,vz:ball.vz});
  if(motion){motion.elapsed+=dt;if(motion.elapsed<motion.duration)p.motion={...motion};else motion=null;}
 }
 return{receive,update,clear,animate(type,latency=0){if(player&&['pass','through','shoot','tackle'].includes(type))motion={id:-1,type:type==='through'?'pass':type,elapsed:0,duration:Math.min(.48,Math.max(.24,latency/1000+.08))};},get pendingSeconds(){return history.reduce((sum,p)=>sum+p.dt,0);}};
}
