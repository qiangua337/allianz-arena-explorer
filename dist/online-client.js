import {ONLINE_PROTOCOL,roomCode,validRoomCode,safeOnlineInput,applyOnlineState} from './online-protocol.js';
import {safePenaltyAim} from './football-penalty.js';
import {createFootballSimulation} from './football-simulation.js';
import {createOnlinePrediction,createOnlineInterpolation} from './online-prediction.js';
import {createOnlineKickPresentation} from './online-kick-presentation.js';
export async function requestOnlineSeat(code,options={},fetcher=globalThis.fetch){const cleaned=roomCode(code);if(code&&!validRoomCode(cleaned))throw Error('请输入 8 位房间码');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetcher('/api/online/rooms'+(code?'/'+cleaned+'/join':''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...options,protocol:ONLINE_PROTOCOL}),signal:controller.signal});}catch{throw Error('连接失败或超时，请检查网络后重试');}finally{clearTimeout(timer);}let data;try{data=await response.json();}catch{throw Error('联机服务暂未就绪，请稍后重试');}if(!response.ok)throw Error(data.error||'房间连接失败');return data;}
export function createOnlineSession(seat,{origin=globalThis.location?.origin,WebSocketClass=globalThis.WebSocket}={}){
 let socket=null,stopped=false,retry=null,heartbeat=null,socketTimer=null,attempt=0,firstResolve,firstReject,firstTimer,disconnectSince=null,desiredReady=false,inputSequence=0,lastSnapshotAt=0,lastMessageAt=0,lastPingAt=0,requestSequence=0;const listeners=new Set(),pendingRequests=new Map();
 let timedSnapshotAt=null,timedServerTime=0;
 const session={...seat,connection:'connecting',error:'',room:null,packet:null,latency:0,jitter:0,request(message){if(session.connection!=='connected')return Promise.reject(Error('连接尚未就绪'));const id=++requestSequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingRequests.delete(id);reject(Error('请求超时，请重试'));},8000);pendingRequests.set(id,{resolve,reject,timer});if(!session.send({...message,id})){clearTimeout(timer);pendingRequests.delete(id);reject(Error('连接中断'));}});},setReady(value){desiredReady=!!value;session.send({type:'ready',ready:desiredReady});},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},send(message){if(socket?.readyState!==1)return false;try{socket.send(JSON.stringify(message));return true;}catch{recover('连接中断，正在重连');return false;}},sendInput(input){const seq=++inputSequence;return session.send({type:'input',...safeOnlineInput(input),seq})?seq:0;},connect(){const promise=new Promise((resolve,reject)=>{firstResolve=resolve;firstReject=reject;});firstTimer=setTimeout(()=>{firstReject?.(Error('实时连接超时，请检查网络后重试'));session.close();},12000);open();return promise;},close(){stopped=true;const previous=socket;socket=null;clearTimeout(firstTimer);clearTimeout(socketTimer);clearTimeout(retry);clearInterval(heartbeat);firstTimer=socketTimer=retry=heartbeat=null;rejectPending('连接已关闭');try{previous?.close(1000,'离开页面');}catch{}session.connection='closed';firstReject?.(Error(session.error||'连接已关闭'));firstResolve=firstReject=null;emit();},leave(){session.send({type:'leave'});session.close();}};
 function emit(){for(const fn of listeners)fn(session);}
 function rejectPending(message){for(const request of pendingRequests.values()){clearTimeout(request.timer);request.reject(Error(message));}pendingRequests.clear();}
 function queueReconnect(message){if(stopped)return;clearInterval(heartbeat);clearTimeout(socketTimer);clearTimeout(retry);heartbeat=socketTimer=retry=null;socket=null;rejectPending('同步中断，请在恢复后核对设置');session.connection='reconnecting';session.error=message;emit();if(stopped)return;if(disconnectSince===null)disconnectSince=Date.now();if(Date.now()-disconnectSince>55000){session.error='未能重新连接，请退出后重新创建房间';session.close();return;}clearTimeout(retry);retry=setTimeout(open,Math.min(5000,500*2**attempt++));}
 function recover(message){const previous=socket;queueReconnect(message);try{previous?.close(4002,'同步中断，重新连接');}catch{}}
 function sampleJitter(snapshot,now){
  if(snapshot?.phase!=='playing'||snapshot.paused||!Number.isFinite(snapshot.time)){timedSnapshotAt=null;return;}
  if(timedSnapshotAt!==null){
   const serverDelta=snapshot.time-timedServerTime;
   // A pass or player switch can broadcast again between scheduled ticks
   // without moving the server clock. It updates play immediately, but
   // neither the packet nor its arrival belongs in the timing sample.
   if(serverDelta===0)return;
   if(serverDelta>0&&now>=timedSnapshotAt){
    const variation=Math.min(150,Math.abs(now-timedSnapshotAt-serverDelta*1000));
    session.jitter+=.15*(variation-session.jitter);
   }
  }
  timedSnapshotAt=now;timedServerTime=snapshot.time;
 }
 function maintain(){if(stopped||session.connection!=='connected')return;const now=Date.now(),packet=session.packet,active=session.room?.started&&!session.room.ended&&packet&&!packet.paused&&!['interval','fulltime'].includes(packet.phase);
  // Some transports enter CLOSING/CLOSED without delivering close. Paused
  // snapshots must not hide a known dead socket behind the silence deadline.
  if(socket?.readyState!==1){if(session.room?.ended){session.error=session.room.reason||'房间已结束';session.close();}else recover('连接中断，正在恢复连接');return;}
  // A WebSocket can remain OPEN after snapshots stop. A normal halftime or
  // shared pause deliberately has no state stream, so only active play uses
  // the snapshot deadline; pong traffic still proves a paused link is alive.
  if(now-lastMessageAt>=12000||active&&now-lastSnapshotAt>=6000){recover('比赛同步中断，正在恢复连接');return;}
  if(now-lastPingAt>=4000){lastPingAt=now;session.send({type:'ping',at:now});}
 }
 function open(){retry=null;if(stopped)return;lastSnapshotAt=0;timedSnapshotAt=null;session.connection=attempt?'reconnecting':'connecting';emit();const url=new URL('/api/online/rooms/'+seat.code+'/socket',origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';socket=new WebSocketClass(url.href,['arena-v2','seat.'+seat.token,...(desiredReady?['ready-v1']:[])]);const current=socket;socketTimer=setTimeout(()=>{if(current===socket&&!stopped)recover('实时连接未响应，正在重试');},8000);
  socket.onmessage=event=>{if(current!==socket)return;let p;try{p=JSON.parse(event.data);}catch{return;}if(!p||typeof p!=='object'||Array.isArray(p))return;lastMessageAt=Date.now();
   if(p.type==='welcome'){if(p.protocol!==ONLINE_PROTOCOL){session.error='联机版本已更新，请刷新网页';session.close();return;}clearTimeout(firstTimer);clearTimeout(socketTimer);firstTimer=socketTimer=null;attempt=0;disconnectSince=null;session.connection='connected';session.error='';session.room=p.room;firstResolve?.(session);firstResolve=firstReject=null;clearInterval(heartbeat);heartbeat=setInterval(maintain,1000);lastPingAt=Date.now();session.send({type:'ping',at:lastPingAt});session.send({type:'ready',ready:desiredReady});}
   if(p.type==='state'){const now=Date.now(),previous=session.packet;sampleJitter(p.state,now);lastSnapshotAt=now;if(p.room)session.room=p.room;session.packet=p.state?{...p.state,teamSheets:p.state.teamSheets??previous?.teamSheets,discipline:p.state.discipline??previous?.discipline}:null;if(session.room?.ended)session.error=session.room.reason||'房间已结束';}
   if(p.type==='result'){const request=pendingRequests.get(p.id);if(request){pendingRequests.delete(p.id);clearTimeout(request.timer);if(p.ok)request.resolve(p);else request.reject(Error(p.error||'设置未能保存'));}}
   if(p.type==='pong'&&Number.isFinite(p.at))session.latency=Math.max(0,Math.round(Date.now()-p.at));emit();
  };
  socket.onerror=()=>{};
  socket.onclose=event=>{if(current!==socket||stopped)return;if([4001,4004,1008].includes(event.code)||session.room?.ended){session.error=event.reason||session.error||'房间已结束';session.close();return;}queueReconnect('连接中断，正在重连');};
 }
 return session;
}
export function createOnlineSimulation(session,settings={}, {now=()=>performance.now()}={}){
 const roomRules=session.room?.rules||session.rules||settings.rules,simulation=createFootballSimulation({...settings,opponent:session.opponent,rules:roomRules,duration:roomRules?.duration||180,selections:session.room?.lineups||settings.selections,humanTeams:['home','away']}),state=simulation.state,team=session.team,prediction=createOnlinePrediction(team),interpolation=createOnlineInterpolation(),kick=createOnlineKickPresentation(team);state.controlledId=state.controlledIds[team];state.localTeam=team;state.paused=true;state.online=true;state.kickPresentation=null;state.kickAudioEventIds=[];
 const idleInput=safeOnlineInput();
 let frameClock=now(),lastInputAt=-Infinity,lastInput=null,closed=false,lastPacket=null,lastSequence=0,rawInput=null,normalizedInput=null;
 let predictionClock=frameClock,localInput=idleInput,hasInputBoundary=false;
 let pendingInput=null,inputTimer=null,lastUrgentStopAt=-Infinity;
 const changedInputInterval=1000/60;
 function canSendIntent(){return !closed&&!state.paused&&session.connection==='connected'&&session.room?.started&&!session.room.ended&&['playing','penalties'].includes(state.phase);}
 function discardPendingInput(){clearTimeout(inputTimer);inputTimer=null;pendingInput=null;}
 function receive(){
  const packet=session.packet;
  if(packet&&packet!==lastPacket){
   lastPacket=packet;
   const prior=packet.controlledIds?.[team]!==state.controlledId&&state.players.find(p=>p.id===state.controlledId);
   const former=prior?{id:prior.id,x:prior.x,z:prior.z,yaw:prior.yaw,vx:prior.vx,vz:prior.vz}:null;
   if(applyOnlineState(state,packet,team)){
    kick.receive(state,packet,Math.max(frameClock,now()));
    prediction.receive(state,packet.ack?.[team]||0);
    interpolation.receive(state,former);
   }
  }
  if(session.connection!=='connected'||!session.room?.started||session.room?.ended){
   state.paused=true;prediction.clear();interpolation.clear();kick.clear(state);state.predictionSeconds=0;
  }
  if(!canSendIntent()){discardPendingInput();resetLocalInput();}
  state.onlineStatus=session.connection;
 }
 const unsubscribe=session.subscribe(receive);receive();
 function sameMovement(a,b){return a===b||!!a&&!!b&&a.x===b.x&&a.z===b.z&&a.sprint===b.sprint&&a.defend===b.defend&&a.charging===b.charging;}
 function sameInput(a,b){return sameMovement(a,b)&&a?.power===b?.power;}
 function resetLocalInput(){
  predictionClock=Math.max(frameClock,now());
  localInput=idleInput;
  hasInputBoundary=false;
 }
 function advanceLocal(at,input){
  const elapsed=Math.max(0,(at-predictionClock)/1000);
  predictionClock=Math.max(predictionClock,at);
  const sequence=lastSequence>0&&!sameMovement(input,lastInput)?Infinity:lastSequence;
  prediction.update(state,elapsed,input,sequence);
 }
 function normalize(input){
  if(state.paused)return idleInput;
  const {x,z,sprint,defend,charging}=input??idleInput,power=state.chargePower;
  // Prediction retains prior input objects, so only replace a snapshot on change.
  if(!rawInput||x!==rawInput.x||z!==rawInput.z||sprint!==rawInput.sprint||defend!==rawInput.defend||charging!==rawInput.charging||power!==rawInput.power){
   rawInput={x,z,sprint,defend,charging,power};
   normalizedInput=safeOnlineInput(rawInput);
  }
  return normalizedInput;
 }
 function sendControl(safe,at){
  discardPendingInput();
  lastSequence=session.sendInput(safe)||0;
  if(lastSequence>0)prediction.sequencePending(lastSequence);
  lastInputAt=at;
  lastInput=safe;
 }
 function submitPendingInput(){
  inputTimer=null;
  if(!pendingInput||!canSendIntent()||sameInput(pendingInput,lastInput)){discardPendingInput();return;}
  const at=Math.max(frameClock,now()),remaining=changedInputInterval-(at-lastInputAt);
  if(remaining<=.001)sendControl(pendingInput,at);
  else inputTimer=setTimeout(submitPendingInput,Math.ceil(remaining));
 }
 function flushInput(input){
  if(!canSendIntent())return;
  pendingInput=normalize(input);
  const at=Math.max(frameClock,now());
  if(!sameMovement(pendingInput,localInput)){
   // Integrate the previous direction until the event. A press and release
   // between frames still produces a small movement on the next paint.
   advanceLocal(at,localInput);
   localInput=pendingInput;
   hasInputBoundary=true;
  }
  if(sameInput(pendingInput,lastInput)){discardPendingInput();return;}
  // Releasing the stick must stop held direction even during a slow draw.
  // Bound bypasses to ten per second in addition to the normal 60 Hz cap.
  if((lastInput?.x||lastInput?.z)&&!pendingInput.x&&!pendingInput.z&&
     at-lastInputAt<changedInputInterval&&at-lastUrgentStopAt>=100){
   lastUrgentStopAt=at;
   sendControl(pendingInput,at);
   return;
  }
  // Coalesce touch events when the render loop or another input has just sent.
  if(inputTimer===null)submitPendingInput();
 }
 function clearInput(){
  discardPendingInput();
  resetLocalInput();
  kick.clear(state);
  if(!closed&&session.connection==='connected'&&!sameInput(lastInput,idleInput))sendControl(idleInput,Math.max(frameClock,now()));
 }
 function update(dt,input={}){
  if(closed)return state;
  frameClock=Math.max(frameClock+Math.min(dt,.1)*1000,now());
  const safe=normalize(input),sinceSent=frameClock-lastInputAt,interval=state.paused?200:50;
  interpolation.update(state,dt,session.jitter||0);
  if(hasInputBoundary)advanceLocal(frameClock,localInput);
  const changed=!sameInput(safe,lastInput);
  if(sinceSent>=interval-.001||changed&&sinceSent>=changedInputInterval-.001)sendControl(safe,frameClock);
  else if(pendingInput){
   if(!changed)discardPendingInput();
   else pendingInput=safe;
  }
  if(!hasInputBoundary)advanceLocal(frameClock,safe);
  localInput=safe;
  hasInputBoundary=false;
  state.predictionSeconds=prediction.pendingSeconds;
  kick.update(state,frameClock);
  return state;
 }
 function action(type,options={}){
  if(!canSendIntent())return false;
  const direction=safeOnlineInput(options.direction),penaltyAim=options.penaltyAim&&safePenaltyAim(options.penaltyAim);
  const sent=session.send({type:'action',action:type,direction,power:options.power,...(penaltyAim?{penaltyAim}:{})});
  const power=Number.isFinite(options.power)?Math.max(.15,Math.min(1,options.power)):.5;
  if(sent&&!kick.begin(state,type,direction,power,Math.max(frameClock,now()),session.latency)){
   prediction.animate(type,session.latency,{...options,direction,penaltyAim},state.shotKind);
  }
  return sent;
 }
 return{state,network:session,continuePeriod(){return session.request({type:'continue'});},setFormation(team,formation){return session.request({type:'formation',formation});},substitute(team,outId,inNumber){return session.request({type:'substitute',outId,inNumber});},ready(){session.send({type:'mode',mode:settings.controlMode||'semi'});session.send({type:'shot-kind',kind:settings.shotKind||'drive'});session.setReady(true);},dispose({keepSession=false}={}){if(closed)return;closed=true;discardPendingInput();unsubscribe();prediction.clear();interpolation.clear();kick.clear(state);if(!keepSession)session.leave();},update,flushInput,clearInput,action,setPaused(value){discardPendingInput();resetLocalInput();sendControl(idleInput,Math.max(frameClock,now()));session.send({type:'pause',paused:!!value});if(value){state.paused=true;prediction.clear();interpolation.clear();kick.clear(state);}},setControlMode(mode){state.controlMode=mode;session.send({type:'mode',mode});return mode;},setShotKind(kind){state.shotKind=kind;session.send({type:'shot-kind',kind});return kind;}};
}
