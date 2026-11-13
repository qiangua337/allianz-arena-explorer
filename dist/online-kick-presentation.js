import {passFlight,passOption,shotOption} from './football-tactics.js';
import {sampleShotGuide} from './shot-feedback.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
const openPlay=state=>state.phase==='playing'&&!state.paused&&!state.setPiece;
const kickEvent={pass:'pass',through:'through',shoot:'shot'};

function launchFor(state,player,ball,type,direction,power,pressure){
 if(type==='shoot'){
  const keeper=state.players.find(p=>p.keeper&&!p.dismissed&&p.team!==player.team);
  const shot=shotOption(player,ball,{direction,power,kind:state.shotKind,keeper,pressure});
  return shot.distance>.01?{...shot,stroke:shot.kind}:null;
 }
 const option=passOption(state.players,player,ball,{direction,type,power});
 if(!option)return null;
 const flight=passFlight(ball,option,{type,lane:option.lane,player});
 return{...flight,stroke:flight.lofted?'lofted':type==='through'&&!option.delivery?'through':'short'};
}

// This is a short presentation lead, not another simulation. It uses the
// actual launch calculators and never writes to the authoritative ball.
export function createOnlineKickPresentation(team){
 let latest=null,latestAt=-Infinity,serial=0,active=null;
 const candidates=[],localMotions=[],playedMotions=[];

 function clear(state,{resetEventIds=false}={}){
  for(const attempt of localMotions){
   const actor=state.players[attempt.index];
   if(actor?.motion?.id===attempt.motion.id)actor.motion=null;
  }
  active=null;candidates.length=localMotions.length=0;
  state.kickPresentation=null;
  if(resetEventIds){state.kickAudioEventIds=[];playedMotions.length=0;}
 }

 function begin(state,type,direction,power,at,latency){
  if(!Object.hasOwn(kickEvent,type)||active||!openPlay(state)||!latest||!openPlay(latest)||at-latestAt>300)return false;
  const player=state.players.find(p=>p.id===state.controlledId);
  if(!player||player.dismissed||latest.controlledIds?.[team]!==player.id||
     latest.ball.ownerId!==player.id||state.ball.ownerId!==player.id)return false;
  if(candidates.some(attempt=>attempt.playerId===player.id&&attempt.eventType===kickEvent[type]&&at<=attempt.soundUntil))return false;
  const ball=state.ball,origin={x:ball.x,y:Math.max(.11,ball.y),z:ball.z};
  const controlledIndex=state.players.indexOf(player),wirePlayer=latest.players[controlledIndex];
  let pressure=Infinity;
  for(let i=0;i<state.players.length;i++){
   const foe=state.players[i],wireFoe=latest.players[i];
   if(foe.team===team||foe.dismissed)continue;
   pressure=Math.min(pressure,Math.hypot(foe.x-player.x,foe.z-player.z),Math.hypot(wireFoe[0]-wirePlayer[0],wireFoe[1]-wirePlayer[1]));
  }
  if(pressure<1.45||Math.hypot(origin.x-player.x,origin.z-player.z)>1.35)return false;
  const flight=launchFor(state,player,origin,type,direction,power,pressure);
  const speed=flight&&Math.hypot(flight.vx,flight.vz);
  if(!Number.isFinite(speed)||speed<1)return false;
  const id=++serial,shot=type==='shoot',rtt=Number.isFinite(latency)&&latency>0?latency:220;
  const display={id,type,playerId:player.id,status:'pending',...origin,vx:flight.vx,vy:flight.vy,vz:flight.vz};
  const motion={id:-id-1,type:shot?'shoot':'pass',elapsed:0,duration:shot ? .46 : .32,predicted:true,
   stroke:flight.stroke,power,lofted:flight.lofted,contactX:origin.x,contactY:origin.y,contactZ:origin.z,approachSpeed:Math.hypot(player.vx,player.vz)};
  const attempt={display,motion,origin,flight,index:controlledIndex,playerId:player.id,eventType:kickEvent[type],baseline:state.eventCount,
   startedAt:at,deadline:at+clamp(rtt+70,180,400),soundUntil:at+clamp(rtt+450,650,1050),
   slowTime:Math.min((shot?2.35:1.8)/speed,.16),unitX:flight.vx/speed,unitZ:flight.vz/speed};
  active=attempt;candidates.push(attempt);localMotions.push(attempt);
  state.kickPresentation=display;player.motion=motion;
  return true;
 }

 function blend(attempt,at){
  attempt.blendAt=at;
  attempt.from={x:attempt.display.x,y:attempt.display.y,z:attempt.display.z};
 }

 function reject(attempt,at){
  attempt.display.status='rejected';
  blend(attempt,at);
  attempt.motion.duration=Math.min(attempt.motion.duration,(at-attempt.startedAt)/1000+.09);
 }

 function receive(state,packet,at){
  if(latest&&(packet.time<latest.time||packet.eventCount<latest.eventCount))clear(state,{resetEventIds:true});
  latest=packet;latestAt=at;
  for(let i=candidates.length-1;i>=0;i--)if(at>candidates[i].soundUntil)candidates.splice(i,1);
  for(const event of state.events){
   if(event.team!==team||state.kickAudioEventIds.includes(event.id))continue;
   const i=candidates.findIndex(attempt=>event.id>attempt.baseline&&event.playerId===attempt.playerId&&event.type===attempt.eventType);
   if(i===-1)continue;
   const [attempt]=candidates.splice(i,1);
   state.kickAudioEventIds=[...state.kickAudioEventIds.slice(-5),event.id];
   delete attempt.motion.predicted;
   const actor=state.players[attempt.index];
   const id=actor?.motion?.type===attempt.motion.type?actor.motion.id:null;
   if(Number.isFinite(id)){
    playedMotions.push({index:attempt.index,id});
    if(playedMotions.length>6)playedMotions.shift();
   }
   if(active!==attempt||attempt.display.status!=='pending')continue;
   attempt.display.status='confirmed';
   const b=state.ball,travel=b.vx*attempt.unitX+b.vz*attempt.unitZ;
   const lead=Math.hypot(attempt.display.x-attempt.origin.x,attempt.display.z-attempt.origin.z);
   // An acknowledgment before the first displayed launch needs no blend.
   if(lead<.08){state.kickPresentation=null;active=null;continue;}
   // Let the authoritative free ball catch a small visual lead before
   // joining it. A deflection or unexpected launch reconciles immediately.
   if(!b.ownerId&&!b.rebound&&travel>4&&travel>Math.hypot(b.vx,b.vz)*.7)attempt.catchUntil=at+Math.min(130,25+1000*lead/travel);
   else blend(attempt,at);
  }
  if(!openPlay(state)){clear(state);return;}
  if(active?.display.status==='pending'&&(state.ball.ownerId!==active.playerId||state.controlledId!==active.playerId)){
   const i=candidates.indexOf(active);
   if(i!==-1)candidates.splice(i,1);
   reject(active,at);
  }
 }

 function samplePending(attempt,at){
  const {display,origin,flight,slowTime}=attempt;
  const elapsed=Math.max(0,(at-attempt.startedAt)/1000),weight=Math.exp(-elapsed/slowTime),time=slowTime*(1-weight);
  if(flight.vy>.24)sampleShotGuide(origin,flight,time,display);
  else{
   const travel=-Math.expm1(-.39*time)/.39;
   display.x=origin.x+flight.vx*travel+(flight.curve||0)*(time-travel)/.39;
   display.y=origin.y;
   display.z=origin.z+flight.vz*travel;
  }
  display.x=clamp(display.x,-33.98,33.98);
  display.y=Math.max(.11,display.y);
  display.z=clamp(display.z,-52.48,52.48);
  display.vx=flight.vx*weight;display.vy=flight.vy*weight;display.vz=flight.vz*weight;
 }

 function update(state,at){
  if(!openPlay(state)){clear(state);return;}
  // A locally presented stroke keeps its progress through confirmation,
  // including a pass that moves the control cursor to the receiving player.
  for(const record of playedMotions){
   const actor=state.players[record.index];
   if(actor?.motion?.id===record.id)actor.motion=null;
  }
  for(let i=localMotions.length-1;i>=0;i--){
   const attempt=localMotions[i],actor=state.players[attempt.index];
   const elapsed=(at-attempt.startedAt)/1000;
   if(!actor||actor.dismissed||elapsed>=attempt.motion.duration){
    if(actor?.motion?.id===attempt.motion.id)actor.motion=null;
    localMotions.splice(i,1);
   }else{attempt.motion.elapsed=elapsed;actor.motion=attempt.motion;}
  }
  if(!active)return;
  const {display}=active;
  if(display.status==='pending'){
   samplePending(active,Math.min(at,active.deadline));
   if(at<active.deadline)return;
   reject(active,active.deadline);
  }
  const b=state.ball;
  if(active.blendAt===undefined){
   const dx=b.x-display.x,dz=b.z-display.z,remaining=dx*active.unitX+dz*active.unitZ;
   if(at<active.catchUntil&&!b.ownerId&&!b.rebound&&remaining<-.15&&Math.hypot(dx,dz)<4)return;
   blend(active,at);
  }
  const fraction=clamp((at-active.blendAt)/(display.status==='confirmed'?140:95),0,1);
  if(fraction===1){state.kickPresentation=null;active=null;return;}
  const weight=fraction*fraction*(3-2*fraction);
  for(const axis of ['x','y','z'])display[axis]=active.from[axis]+(b[axis]-active.from[axis])*weight;
  display.vx=b.vx;display.vy=b.vy;display.vz=b.vz;
 }

 return{begin,receive,update,clear};
}
