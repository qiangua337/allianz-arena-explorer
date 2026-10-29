import {squadDefinition} from './football-squads.js';
export const ONLINE_PROTOCOL=2;
const detailSources=new WeakMap();
export const roomCode=value=>String(value||'').toUpperCase().replace(/[\s-]/g,'');
export const validRoomCode=value=>/^[A-HJ-NP-Z2-9]{8}$/.test(value);
const rounded=v=>Number.isFinite(v)?Math.round(v*1000)/1000:0;
const compact=value=>typeof value==='number'?rounded(value):Array.isArray(value)?value.map(compact):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,compact(v)])):value;
export function safeOnlineInput(value={}){value=value&&typeof value==='object'?value:{};const x=Number.isFinite(value.x)?Math.max(-1,Math.min(1,value.x)):0,z=Number.isFinite(value.z)?Math.max(-1,Math.min(1,value.z)):0,n=Math.max(1,Math.hypot(x,z));return{x:x/n,z:z/n,sprint:value.sprint===true,defend:value.defend===true,charging:value.charging===true,power:Number.isFinite(value.power)?Math.max(0,Math.min(1,value.power)):0};}
export function packOnlineState(s,seq=0,ack={home:0,away:0},details=true){
 const competition=s.competition?compact({...s.competition,shootout:s.competition.shootout?Object.fromEntries(Object.entries(s.competition.shootout).filter(([key])=>key!=='eligible')):null}):null;
 return{v:ONLINE_PROTOCOL,seq,ack:{...ack},time:rounded(s.time),elapsed:rounded(s.elapsed),phase:s.phase,phaseTime:rounded(s.phaseTime),paused:s.paused,restartType:s.restartType,restartTeam:s.restartTeam,duration:s.duration,score:s.score,competition,attackDirections:s.attackDirections,rosterRevision:s.rosterRevision,...(details?{teamSheets:s.teamSheets,discipline:s.discipline}:{}),ball:compact(s.ball),players:s.players.map(p=>[rounded(p.x),rounded(p.z),rounded(p.vx),rounded(p.vz),rounded(p.yaw),rounded(p.stamina),rounded(p.tackleAt),p.defending?1:0,compact(p.motion),p.keeperState?.phase||null,p.number,p.cautions||0,p.fouls||0,p.dismissed?1:0]),controlledIds:s.controlledIds,controlModes:s.controlModes,shotKinds:s.shotKinds,previews:compact(s.previews),eventCount:s.eventCount,events:s.events.slice(-6),stats:s.stats,message:s.message,lastShot:compact(s.lastShot)};
}
export function applyOnlineState(state,packet,team){
 if(packet.v!==ONLINE_PROTOCOL||packet.players?.length!==22)return false;const{teamSheets,discipline,...dynamic}=packet,copy=structuredClone(dynamic),previous=detailSources.get(state)||{};
 for(const key of ['time','elapsed','phase','phaseTime','paused','restartType','restartTeam','duration','score','competition','attackDirections','rosterRevision','ball','eventCount','events','stats','message','lastShot','controlledIds','controlModes','shotKinds','previews'])state[key]=copy[key];
 for(const[key,value]of Object.entries({teamSheets,discipline})){if(value&&previous[key]!==value){state[key]=structuredClone(value);previous[key]=value;}}detailSources.set(state,previous);
 for(let i=0;i<22;i++){const p=state.players[i],a=copy.players[i];[p.x,p.z,p.vx,p.vz,p.yaw,p.stamina,p.tackleAt]=a;p.defending=!!a[7];p.motion=a[8];if(a[10]!==p.number){const member=squadDefinition(p.team,state.fixture.id,a[10]);if(member){p.number=member.player.number;p.name=member.player.name;p.keeper=!!member.keeper;}}p.cautions=a[11]||0;p.fouls=a[12]||0;p.dismissed=!!a[13];p.attackSign=state.attackDirections?.[p.team]??(p.team==='home'?-1:1);if(p.keeper)p.keeperState={phase:a[9]};}
 state.controlledId=state.controlledIds[team];state.controlMode=state.controlModes[team];state.shotKind=state.shotKinds[team];Object.assign(state,state.previews[team]);return true;
}
