import {createFootballSimulation} from '../dist/football-simulation.js';
import {safeOnlineInput,packOnlineState,validRoomCode,ONLINE_PROTOCOL} from '../dist/online-protocol.js';
import {normalizeRules} from '../dist/football-rules.js';
import {defaultSelection,normalizeSelection,validateSelection} from '../dist/football-squads.js';
const TEAMS=['home','away'],TTL=30*60*1000,GRACE=60*1000,alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token=()=>crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(message,status=400)=>json({error:message},status);
async function body(request){if(Number(request.headers.get('Content-Length'))>1024)throw Error('请求过大');const text=await request.text();if(text.length>1024)throw Error('请求过大');const value=text?JSON.parse(text):{};if(!value||typeof value!=='object'||Array.isArray(value))throw Error('请求无效');return value;}
function allowed(request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin;}
export default {async fetch(request,env){
 if(!allowed(request))return error('请从球场网站进入联机',403);const url=new URL(request.url),path=url.pathname.replace(/^\/api\/online/,'');
 if(path==='/health')return json({ok:true,protocol:ONLINE_PROTOCOL});
 if(path==='/rooms'&&request.method==='POST'){
  let options;try{options=await body(request);}catch{return error('房间设置无效');}
  if(options.protocol!==ONLINE_PROTOCOL)return error('联机版本已更新，请刷新网页后重建房间',426);
  for(let attempt=0;attempt<3;attempt++){const bytes=crypto.getRandomValues(new Uint8Array(8)),code=[...bytes].map(v=>alphabet[v%alphabet.length]).join(''),id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id,{locationHint:'apac'}),result=await stub.fetch(new Request(url.origin+'/create',{method:'POST',body:JSON.stringify({code,opponent:options.opponent,rules:options.rules,selection:options.selection})}));if(result.status!==409)return result;}return error('暂时无法创建房间，请重试',503);
 }
 const match=path.match(/^\/rooms\/([^/]+)\/(join|socket)$/);if(!match||!validRoomCode(match[1]))return error('房间码无效或入口不存在',404);
 if(match[2]==='join'&&request.method!=='POST'||match[2]==='socket'&&request.method!=='GET')return error('请求方式无效',405);
 return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(new Request(url.origin+'/'+match[2],request));
}};

export class FootballRoom {
 constructor(ctx){this.ctx=ctx;this.meta=null;this.sim=null;this.sockets=new Map();this.inputs={};this.inputSeq={};this.appliedSeq={};this.lastInput={};this.heartbeats={};this.pauses={home:false,away:false};this.seq=0;this.timer=null;this.lastTick=0;this.lastSave=0;this.lastAction={};this.rates={};this.lastRoom='';this.lastRoster=-1;
  ctx.blockConcurrencyWhile(async()=>{this.meta=await ctx.storage.get('room')||null;const saved=await ctx.storage.get('simulation');if(this.meta?.protocol===ONLINE_PROTOCOL&&saved){this.sim=this.makeSimulation();this.sim.restore(saved);}for(const ws of ctx.getWebSockets()){const attachment=ws.deserializeAttachment();if(attachment?.team){this.sockets.set(attachment.team,ws);this.heartbeats[attachment.team]=Date.now();}}if(this.meta&&this.meta.protocol!==ONLINE_PROTOCOL){await this.end('联机版本已更新，请刷新网页后重建房间');return;}if(this.meta){this.pauses=this.meta.pauses||this.pauses;this.refresh();}});
 }
 makeSimulation(){const sim=createFootballSimulation({duration:this.meta.rules.duration,rules:this.meta.rules,selections:this.meta.lineups,seed:this.meta.seed,opponent:this.meta.opponent,difficulty:'regular',humanTeams:TEAMS});for(const team of TEAMS){const preference=this.meta.preferences?.[team];if(preference){sim.setControlMode(preference.controlMode,team);sim.setShotKind(preference.shotKind,team);}}return sim;}
 publicRoom(){return{code:this.meta.code,protocol:ONLINE_PROTOCOL,opponent:this.meta.opponent,rules:this.meta.rules,lineups:this.meta.lineups,intervalReady:this.meta.intervalReady||{},expiresAt:this.meta.expiresAt,started:!!this.meta.started,ended:!!this.meta.ended,rematch:this.meta.rematch||{},reason:this.meta.reason||'',seats:TEAMS.map(team=>({team,connected:this.sockets.has(team),ready:!!this.meta.ready[team],paused:!!this.pauses[team]}))};}
 send(ws,message){try{ws.send(typeof message==='string'?message:JSON.stringify(message));}catch{}}
 broadcast(force=false){if(!this.meta)return;const room=this.publicRoom(),roomText=JSON.stringify(room),changed=force||roomText!==this.lastRoom,details=force||this.sim?.state.rosterRevision!==this.lastRoster,message=JSON.stringify({type:'state',...(changed?{room}:{}),state:this.sim?packOnlineState(this.sim.state,++this.seq,this.appliedSeq,details):null});this.lastRoom=roomText;this.lastRoster=this.sim?.state.rosterRevision??-1;for(const ws of this.sockets.values())this.send(ws,message);}
 async persist(){if(!this.meta)return;this.meta.pauses=this.pauses;await this.ctx.storage.put({room:this.meta,...(this.sim?{simulation:this.sim.checkpoint()}:{})});}
 async fetch(request){
  const path=new URL(request.url).pathname,now=Date.now();
  if(path==='/create'){
   if(this.meta&&this.meta.expiresAt>now)return error('房间已存在',409);let b;try{b=await body(request);}catch{return error('房间设置无效');}
   const opponent=['dortmund','madrid','barcelona','city'].includes(b.opponent)?b.opponent:'dortmund';this.meta={code:b.code,opponent,protocol:ONLINE_PROTOCOL,rules:normalizeRules(b.rules),lineups:{home:normalizeSelection(b.selection,'home',opponent),away:defaultSelection('away',opponent)},intervalReady:{},seed:crypto.getRandomValues(new Uint32Array(1))[0],tokens:{home:token(),away:null},ready:{home:false,away:false},expiresAt:now+TTL,started:false,ended:false,disconnectAt:null};this.sim=null;await this.persist();await this.ctx.storage.setAlarm(this.meta.expiresAt);return json({code:b.code,team:'home',token:this.meta.tokens.home,opponent,rules:this.meta.rules,expiresAt:this.meta.expiresAt},201);
  }
  if(!this.meta||this.meta.expiresAt<=now||this.meta.ended)return error('房间已结束或过期，请重新创建',410);
  if(path==='/join'){
   let b;try{b=await body(request);}catch{return error('加入请求无效');}if(b.protocol!==ONLINE_PROTOCOL)return error('联机版本已更新，请刷新网页',426);let team=TEAMS.find(t=>b.token&&this.meta.tokens[t]===b.token);
   if(!team){if(this.meta.tokens.away)return error('房间已有两位玩家，请核对房间码',409);team='away';this.meta.tokens.away=token();}
   await this.persist();this.broadcast();return json({code:this.meta.code,team,token:this.meta.tokens[team],opponent:this.meta.opponent,rules:this.meta.rules,expiresAt:this.meta.expiresAt});
  }
  if(path!=='/socket'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return error('需要实时连接',426);
  const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(v=>v.trim()),credential=protocols.find(p=>p.startsWith('seat.'))?.slice(5),team=TEAMS.find(t=>credential&&this.meta.tokens[t]===credential);if(!team||!protocols.includes('arena-v2'))return error('房间身份已失效，请重新加入',403);
  const pair=new WebSocketPair(),client=pair[0],server=pair[1],previous=this.sockets.get(team);this.ctx.acceptWebSocket(server,[team]);server.serializeAttachment({team});this.sockets.set(team,server);if(!protocols.includes('ready-v1'))this.meta.ready[team]=false;this.heartbeats[team]=now;this.inputs[team]=safeOnlineInput();this.inputSeq[team]=this.appliedSeq[team]=0;this.lastInput[team]=now;if(previous){try{previous.close(4001,'此席位已在另一个页面连接');}catch{}}
  this.send(server,{type:'welcome',team,protocol:ONLINE_PROTOCOL,room:this.publicRoom()});this.refresh();this.broadcast(true);return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'arena-v2'}});
 }
 async webSocketMessage(ws,message){
  const team=ws.deserializeAttachment()?.team;if(!team||this.sockets.get(team)!==ws)return;if(typeof message!=='string'||message.length>1536){ws.close(1009,'消息过大');return;}let packet;try{packet=JSON.parse(message);}catch{return;}if(!packet||typeof packet!=='object'||Array.isArray(packet))return;const now=Date.now(),rate=this.rates[team];if(!rate||now-rate.at>1000)this.rates[team]={at:now,n:1};else if(++rate.n>90){ws.close(1008,'发送过于频繁，请重新加入');return;}this.heartbeats[team]=now;
  if(packet.type==='ping'){this.send(ws,{type:'pong',at:packet.at});return;}
  if(packet.type==='input'){if(packet.seq!==undefined){if(!Number.isSafeInteger(packet.seq)||packet.seq<=0||packet.seq<=(this.inputSeq[team]||0))return;this.inputSeq[team]=packet.seq;}this.inputs[team]=safeOnlineInput(packet);this.lastInput[team]=now;return;}
  const reply=result=>this.send(ws,{type:'result',id:packet.id,...result});
  if(packet.type==='lineup'){if(this.meta.started){reply({ok:false,error:'比赛已开始，请使用战术与替补'});return;}const checked=validateSelection(packet.selection,team,this.meta.opponent);if(!checked.ok){reply(checked);return;}this.meta.lineups[team]=checked.selection;this.meta.ready[team]=false;await this.persist();this.broadcast(true);reply({ok:true});return;}
  if(packet.type==='rules'){if(team!=='home'||this.meta.started){reply({ok:false,error:'只有房主能在开球前调整赛制'});return;}this.meta.rules=normalizeRules(packet.rules);this.meta.ready={home:false,away:false};await this.persist();this.broadcast(true);reply({ok:true});return;}
  if(packet.type==='continue'){if(this.sim?.state.phase!=='interval'){reply({ok:false,error:'当前不在中场休息'});return;}this.meta.intervalReady[team]=true;if(TEAMS.every(t=>this.meta.intervalReady[t]&&this.sockets.has(t))){this.meta.intervalReady={};this.pauses={home:false,away:false};this.sim.continuePeriod();this.refresh();}await this.persist();this.broadcast(true);reply({ok:true});return;}
  if(packet.type==='formation'||packet.type==='substitute'){if(!this.sim||this.sim.state.phase==='fulltime'){reply({ok:false,error:'当前不能调整比赛阵容'});return;}const result=packet.type==='formation'?this.sim.setFormation(team,packet.formation):this.sim.substitute(team,packet.outId,packet.inNumber);if(result.ok){if(this.sim.state.phase==='interval')this.meta.intervalReady[team]=false;if(packet.type==='formation')this.meta.lineups[team].formation=packet.formation;await this.persist();this.broadcast(true);}reply(result);return;}
  if(packet.type==='ready'){this.meta.ready[team]=packet.ready===true;this.refresh();await this.persist();this.broadcast();return;}
  if(packet.type==='pause'){this.pauses[team]=packet.paused===true;if(packet.paused===true&&this.sim?.state.phase==='interval')this.meta.intervalReady[team]=false;this.refresh();await this.persist();this.broadcast();return;}
  if(packet.type==='leave'){await this.end('朋友已离开房间');return;}
  if(packet.type==='rematch'&&this.sim?.state.phase==='fulltime'){this.meta.ready[team]=true;if(this.meta.rematch?.[team])return;this.meta.rematch={...this.meta.rematch,[team]:true};if(TEAMS.every(t=>this.meta.rematch[t])){this.meta.rematch={};this.meta.intervalReady={};this.lastRoster=-1;this.sim=this.makeSimulation();this.pauses={home:false,away:false};this.meta.started=true;this.refresh();}await this.persist();this.broadcast();return;}
  if(packet.type==='mode'||packet.type==='shot-kind'){
   const preference=this.meta.preferences??={};preference[team]??={controlMode:'semi',shotKind:'drive'};
   if(packet.type==='mode'){preference[team].controlMode=['manual','semi','assisted'].includes(packet.mode)?packet.mode:'semi';this.sim?.setControlMode(preference[team].controlMode,team);}
   else{preference[team].shotKind=['drive','finesse','lob'].includes(packet.kind)?packet.kind:'drive';this.sim?.setShotKind(preference[team].shotKind,team);}
   await this.persist();this.broadcast();return;
  }
  if(!this.sim||this.sim.state.paused||!this.meta.started)return;
  if(packet.type==='action'&&['pass','through','shoot','switch','tackle'].includes(packet.action)){
   if(now-(this.lastAction[team]||0)<70)return;this.lastAction[team]=now;const direction=safeOnlineInput(packet.direction);this.sim.action(packet.action,{direction,power:Number.isFinite(packet.power)?Math.max(.15,Math.min(1,packet.power)):.5,kind:this.sim.state.shotKinds[team]},team);this.broadcast();
  }
 }
 refresh(){if(!this.meta||this.meta.ended)return;const now=Date.now(),connected=TEAMS.every(t=>this.sockets.has(t)),ready=TEAMS.every(t=>this.meta.ready[t]);if(connected)this.meta.disconnectAt=null;else if(this.meta.started&&!this.meta.disconnectAt){this.meta.disconnectAt=now+GRACE;this.ctx.storage.setAlarm(Math.min(this.meta.expiresAt,this.meta.disconnectAt));}
  if(connected&&ready&&!this.meta.started){this.sim=this.makeSimulation();this.meta.started=true;}
  const run=connected&&ready&&this.meta.started&&!TEAMS.some(t=>this.pauses[t])&&!['fulltime','interval'].includes(this.sim?.state.phase);if(this.sim)this.sim.setPaused(!run);
  if(run&&!this.timer){this.lastTick=now;this.lastSave=now;this.timer=setInterval(()=>this.tick(),50);}else if(!run&&this.timer){clearInterval(this.timer);this.timer=null;}
 }
 tick(){const now=Date.now();if(now>=this.meta.expiresAt){this.end('房间已到期');return;}for(const team of TEAMS){if(now-(this.heartbeats[team]||0)>20000){const ws=this.sockets.get(team);if(ws){try{ws.close(4000,'连接超时');}catch{}this.disconnected(ws);}}if(now-(this.lastInput[team]||0)>500)this.inputs[team]=safeOnlineInput();}if(!this.timer)return;
  const dt=Math.min(.15,(now-this.lastTick)/1000);this.lastTick=now;for(const team of TEAMS){this.sim.state.chargePowers[team]=this.inputs[team]?.power||0;this.appliedSeq[team]=this.inputSeq[team]||0;}this.sim.update(dt,this.inputs);this.broadcast();if(['fulltime','interval'].includes(this.sim.state.phase)){this.refresh();this.persist();}else if(now-this.lastSave>30000){this.lastSave=now;this.persist();}
 }
 async disconnected(ws){const team=ws.deserializeAttachment()?.team;if(this.sockets.get(team)!==ws)return;this.sockets.delete(team);this.inputs[team]=safeOnlineInput();this.refresh();await this.persist();this.broadcast();}
 webSocketClose(ws){return this.disconnected(ws);}
 webSocketError(ws){try{ws.close(1011,'连接中断');}catch{}return this.disconnected(ws);}
 async end(reason){if(!this.meta)return;this.meta.ended=true;this.meta.reason=reason;if(this.timer)clearInterval(this.timer);this.timer=null;if(this.sim)this.sim.setPaused(true);this.broadcast(true);for(const ws of this.sockets.values()){try{ws.close(4004,reason);}catch{}}this.sockets.clear();await this.ctx.storage.deleteAll();}
 async alarm(){if(!this.meta)return;const now=Date.now();if(now>=this.meta.expiresAt||this.meta.disconnectAt&&now>=this.meta.disconnectAt){await this.end(this.meta.disconnectAt?'朋友未能重连，房间已结束':'房间已到期');return;}await this.ctx.storage.setAlarm(Math.min(this.meta.expiresAt,this.meta.disconnectAt||Infinity));}
}
