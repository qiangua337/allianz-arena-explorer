import {squadDefinition} from './football-squads.js';
export const ONLINE_PROTOCOL=2;
const detailSources=new WeakMap();
const liveScalars=['time','elapsed','phase','phaseTime','paused','restartType','restartTeam','duration','rosterRevision','eventCount','message'];
const liveObjects=['score','competition','attackDirections','ball','events','stats','lastShot','controlledIds','controlModes','shotKinds','previews','setPiece'];
export const roomCode=value=>String(value||'').toUpperCase().replace(/[\s-]/g,'');
export const validRoomCode=value=>/^[A-HJ-NP-Z2-9]{8}$/.test(value);
const rounded=v=>Number.isFinite(v)?Math.round(v*1000)/1000:0;
const compact=value=>typeof value==='number'?rounded(value):Array.isArray(value)?value.map(compact):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,compact(v)])):value;
function publicPenalty(penalty){
 if(!penalty)return null;
 // The run-up clock is visible to both seats. Neither player can see the
 // other seat's selected shot or buffered dive before it happens.
 const {eligible,aimHistory,aiKeeper,aiKickDelay,pendingKick,queuedDive,...visible}=penalty;
 return visible;
}
export function safeOnlineInput(value={}){value=value&&typeof value==='object'?value:{};const x=Number.isFinite(value.x)?Math.max(-1,Math.min(1,value.x)):0,z=Number.isFinite(value.z)?Math.max(-1,Math.min(1,value.z)):0,n=Math.max(1,Math.hypot(x,z));return{x:x/n,z:z/n,sprint:value.sprint===true,defend:value.defend===true,charging:value.charging===true,power:Number.isFinite(value.power)?Math.max(0,Math.min(1,value.power)):0};}
export function packOnlineState(s,seq=0,ack={home:0,away:0},details=true){
 const competition=s.competition?compact({...s.competition,shootout:publicPenalty(s.competition.shootout)}):null,penaltyKeeper=s.setPiece?.keeper??s.competition?.shootout?.keeper;
 return{v:ONLINE_PROTOCOL,seq,ack:{...ack},time:rounded(s.time),elapsed:rounded(s.elapsed),phase:s.phase,phaseTime:rounded(s.phaseTime),paused:s.paused,restartType:s.restartType,restartTeam:s.restartTeam,duration:s.duration,score:s.score,competition,setPiece:compact(publicPenalty(s.setPiece)),attackDirections:s.attackDirections,rosterRevision:s.rosterRevision,...(details?{teamSheets:s.teamSheets,discipline:s.discipline}:{}),ball:compact(s.ball),players:s.players.map(p=>[rounded(p.x),rounded(p.z),rounded(p.vx),rounded(p.vz),rounded(p.yaw),rounded(p.stamina),rounded(p.tackleAt),p.defending?1:0,compact(p.motion),p.keeperState?.phase||null,p.number,p.cautions||0,p.fouls||0,p.dismissed?1:0,compact(p.receiveControl)||null,compact(p.pivotUntil||0),penaltyKeeper===p.id?compact(p.keeperState):null]),controlledIds:s.controlledIds,controlModes:s.controlModes,shotKinds:s.shotKinds,previews:compact(s.previews),eventCount:s.eventCount,events:s.events.slice(-6),stats:s.stats,message:s.message,lastShot:compact(s.lastShot)};
}
export function applyOnlineState(state,packet,team){
 if(packet.v!==ONLINE_PROTOCOL||packet.players?.length!==22)return false;
 const snapshots={};
 for(const key of liveObjects)snapshots[key]=packet[key];
 // Presentation and prediction may mutate these objects. Copy only fields
 // they retain, and decode the 22 numeric player tuples directly.
 Object.assign(state,structuredClone(snapshots));
 for(const key of liveScalars)state[key]=packet[key];
 state.setPiece=state.setPiece||null;
 const previous=detailSources.get(state)||{};
 for(const key of ['teamSheets','discipline']){
  const value=packet[key];
  if(value&&previous[key]!==value){state[key]=structuredClone(value);previous[key]=value;}
 }
 detailSources.set(state,previous);
 for(let i=0;i<22;i++){
  const player=state.players[i],row=packet.players[i];
  player.x=row[0];player.z=row[1];player.vx=row[2];player.vz=row[3];
  player.yaw=row[4];player.stamina=row[5];player.tackleAt=row[6];player.defending=!!row[7];
  // The three optional records in a player tuple contain only flat fields.
  player.motion=row[8]?{...row[8]}:row[8];
  if(row[10]!==player.number){
   const member=squadDefinition(player.team,state.fixture.id,row[10]);
   if(member){player.number=member.player.number;player.name=member.player.name;player.keeper=!!member.keeper;}
  }
  player.cautions=row[11]||0;player.fouls=row[12]||0;player.dismissed=!!row[13];
  player.receiveControl=row[14]?{...row[14]}:null;
  player.pivotUntil=row[15]||0;player.attackSign=state.attackDirections?.[player.team]??(player.team==='home'?-1:1);
  if(player.keeper)player.keeperState=row[16]?{...row[16]}:{phase:row[9]};
 }
 state.controlledId=state.controlledIds[team];state.controlMode=state.controlModes[team];state.shotKind=state.shotKinds[team];Object.assign(state,state.previews[team]);return true;
}
