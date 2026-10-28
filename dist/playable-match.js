import {createOnlineSimulation} from './online-client.js';
import {copyOnlineInvite} from './online-lobby.js';
import {shotKinds,shotLabels} from './football-tactics.js';
import {createReplayRecorder,replaySample} from './football-replay.js';
import {controlModes,controlLabels,controlDescriptions,loadFootballSettings,saveFootballSettings} from './football-assist.js';
import {createFootballSimulation} from './football-simulation.js';
import {buildFootballView} from './football-view.js';
import {buildFootballRadar} from './football-radar.js';
import {difficulties,loadMatchOptions,matchOptions,saveMatchOptions} from './football-teams.js';
import {matchTime,ballDirection} from './football-controls.js';
import {createFramePacer} from './frame-pacing.js';

export function buildPlayableMatch({scene,stadium,players,audio,onCamera,onView,onPause,onRestart,onExit,onChangeMatch,onCheer,onCrowdReaction,mobile=false}){
 let storage;try{storage=globalThis.localStorage;}catch{}
 const settings=loadFootballSettings(storage),$=id=>document.getElementById(id),pressurePointers=new Set(),view=buildFootballView(scene,stadium.matchBall,players),radar=buildFootballRadar($('game-radar'));
 const recorder=createReplayRecorder(),actorFrameBudget=createFramePacer();let replay=null;
 let network=null;let config=loadMatchOptions(storage),simulation=createFootballSimulation({...settings,...config});
 let active=false,pending=false,failed=false,perspective='third',cameraMode=config.camera,uiTime=0,lastEvent=0,worldTime=0,aimYaw=0,helpWasPaused=false,visualTime=1,visualDirty=true,charge=null,lastInput={x:0,z:0};
 function render(){
  if(!active)return;const s=simulation.state,p=s.players.find(p=>p.id===s.controlledId),done=s.phase==='fulltime',owns=s.ball.ownerId===p.id;
  s.cameraMode=cameraMode;
  $('game-score-home').textContent=s.score.home;$('game-score-away').textContent=s.score.away;$('game-clock').textContent=matchTime(s);
  $('game-away-name').textContent=s.fixture.short;if($('game-away-dot').style)$('game-away-dot').style.background=s.fixture.kit.shirt;
  const fps=Number(document.body.dataset.renderfps)||0;$('game-difficulty').textContent=replay?'精彩回放':network?(network.latency||'—')+' ms'+(pending?' · 加载':s.paused?' · 暂停':fps?' · '+fps+'帧':''):difficulties[s.difficulty].label+' · 人机';$('game-difficulty').title=network?'网络往返 '+(network.latency||'—')+' 毫秒；画面 '+(fps||'测量中')+' 帧/秒。移动在本机先响应，球权和进球由服务器确认。':'';$('game-difficulty').classList.toggle('network-slow',!!network&&network.latency>180);$('game-network-help').hidden=!network;$('game-low-quality').textContent=$('quality').value==='low'?'恢复均衡画质':'切换到流畅画质 · 降低细节';$('game-fixture-title').textContent='FC BAYERN × '+s.fixture.english;
  $('game-player').textContent=p.number+' · '+p.name;$('game-stamina').value=p.stamina;
  $('game-ball-hint').textContent=owns?(p.defending?'护球中':s.passPreview?'短传 → '+s.passPreview.name:'控球中'):p.defending?'逼抢中 · 靠近后抢断':s.ball.targetId===p.id?'迎球中 · 方向可接管':ballDirection(p,s.ball,aimYaw);
  $('game-pressure-label').textContent=owns?'护球':'逼抢';$('game-pressure').setAttribute('aria-pressed',String(!s.paused&&p.defending));
  $('game-mute').textContent=audio.muted?'♪':'♫';$('game-mute').setAttribute('aria-pressed',String(audio.muted));$('game-mute').setAttribute('aria-label',audio.muted?'开启比赛声音':'静音比赛声音');
  $('game-pause').textContent=s.paused?'▷':'Ⅱ';$('game-pause').setAttribute('aria-label',s.paused?'继续比赛':'暂停比赛');
  $('game-camera').textContent={broadcast:'转播 C',follow:'跟随 C',first:'第一人称 C'}[cameraMode];$('game-camera').setAttribute('aria-label','切换比赛镜头，当前'+{broadcast:'转播',follow:'跟随',first:'第一人称'}[cameraMode]);
  $('game-cheer').disabled=s.paused||pending||failed;$('game-pause').disabled=!!replay;$('game-help').disabled=!!replay;
  const overlay=!replay&&(pending||failed||s.paused||done);
  $('game-replay-launch').hidden=!!network;$('game-replay-launch').disabled=!!network||pending||failed||!recorder.available;$('game-replay-panel').hidden=!replay;document.body.dataset.gameReplay=String(!!replay);
  $('game-overlay').hidden=!overlay;$('game-overlay-title').textContent=failed?'球员暂未加载':pending?'正在准备双方球员':done?'全场结束':'比赛已暂停';
  $('game-overlay-description').textContent=failed?'可以重试加载，或退出返回参观。':pending?'准备好后将倒数开球。':done?`拜仁 ${s.score.home} : ${s.score.away} ${s.fixture.short}`:'点击继续比赛，回到球场。';
  $('game-resume').hidden=pending||failed||done;$('game-restart').hidden=pending;$('game-change-match').hidden=pending;$('game-restart').textContent=failed?'重试加载':'重新开球';
  if(network){const waiting=!network.room?.started,closed=network.connection==='closed'||network.room?.ended,reconnecting=network.connection!=='connected',own=network.room?.seats.find(p=>p.team===network.team),remote=network.room?.seats.find(p=>p.team!==network.team);$('game-online-info').hidden=false;$('game-online-code').textContent=network.code;
   if(!failed&&!pending&&!done){$('game-overlay-title').textContent=closed?'房间已结束':reconnecting?'正在重新连接':waiting?'等待朋友准备':remote?.paused?'朋友暂停了比赛':'比赛已暂停';$('game-overlay-description').textContent=closed?network.error||'请退出后重新创建房间。':reconnecting?'比赛已冻结，连接恢复后可继续。':waiting?'邀请朋友加入，双方加载完成后自动开球。':remote?.paused&&!own?.paused?'等待朋友点击继续。':'点击继续比赛，两边都取消暂停后恢复。';}
   $('game-resume').hidden=pending||failed||done||waiting||closed||reconnecting||!own?.paused;$('game-restart').hidden=pending||closed||(!done&&!failed);$('game-change-match').hidden=true;if(done)$('game-restart').textContent=network.room?.rematch?.[network.team]?'已请求 · 等待朋友':'再来一场 · 双方确认';
  }else $('game-online-info').hidden=true;
  $('game-ui').setAttribute('aria-label',network?'好友联机足球比赛':'人机足球比赛');$('game-radar-direction').textContent=network?.team==='away'?s.fixture.short+'进攻 ←':'拜仁进攻 →';$('game-help-opponent').textContent=network?'你控制'+(network.team==='home'?'拜仁':s.fixture.short)+'，朋友控制另一队；其余队员由 AI 配合。双方共用比分与球的位置。':'控制拜仁对战 AI。金色脚环是你，浅色连线指向当前传球目标；雷达右侧是拜仁进攻方向。';document.body.dataset.onlineRoom=network?.code||'';document.body.dataset.onlineTeam=network?.team||'';document.body.dataset.onlineConnection=network?.connection||'';
  $('game-result').hidden=!done;
  if(done)$('game-result').textContent=`射门 ${s.stats.home.shots} : ${s.stats.away.shots}  ·  射正 ${s.stats.home.onTarget} : ${s.stats.away.onTarget}  ·  扑救 ${s.stats.home.saves} : ${s.stats.away.saves}  ·  传球 ${s.stats.home.passes} : ${s.stats.away.passes}  ·  抢断 ${s.stats.home.tackles} : ${s.stats.away.tackles}`;
  const announcement=!overlay&&(s.phase==='kickoff'||s.phase==='goal');$('game-announcement').hidden=!announcement;$('game-announcement').textContent=s.phase==='goal'?s.message:s.restartType==='kickoff'?String(Math.max(1,Math.ceil(3-s.phaseTime))):s.message;
  for(const button of document.querySelectorAll('[data-control-mode]'))button.setAttribute('aria-pressed',String(button.dataset.controlMode===s.controlMode));
  $('game-control-mode').textContent=controlLabels[s.controlMode]+' ↻';$('game-control-mode').setAttribute('aria-label','切换换人辅助，当前'+controlLabels[s.controlMode]);$('game-control-description').textContent=controlDescriptions[s.controlMode];
  const canReceive=!s.ball.ownerId&&Math.hypot(p.x-s.ball.x,p.z-s.ball.z)<5,canKick=owns||canReceive;
  $('game-shot-mode').textContent=shotLabels[s.shotKind]+' Z';$('game-shot-mode').setAttribute('aria-label','切换射门方式，当前'+shotLabels[s.shotKind]);$('game-charge-label').textContent=shotLabels[s.shotKind]+' · '+Math.round((s.chargePower||0)*100)+'% · 松开出脚';
  const shot=s.lastShot,recent=shot&&s.time-shot.updatedAt<3&&!overlay&&!replay,feedback={flight:'射门飞行中',goal:'破门！',saved:'门将抱住',parried:'扑救脱手 · 跟进补射',woodwork:'击中门框',wide:'偏出球门',blocked:'被防守球员挡出'};$('game-shot-feedback').hidden=!recent;if(recent){$('game-shot-feedback').textContent=shotLabels[shot.kind]+' · '+feedback[shot.outcome];$('game-shot-feedback').dataset.outcome=shot.outcome;}
  $('game-charge').hidden=!charge||overlay;$('game-power').value=s.chargePower||0;$('game-shoot').setAttribute('aria-pressed',String(!!charge));$('game-shoot').disabled=!canKick||overlay;
  for(const button of document.querySelectorAll('[data-game-action]')){const type=button.dataset.gameAction;button.disabled=overlay||(type==='pass'||type==='through')&&!canKick||type==='tackle'&&(owns||s.time<p.tackleAt);if(type==='tackle')button.setAttribute('data-cooling',String(s.time<p.tackleAt));}
  $('game-event').textContent=s.message;radar.update(s);stadium.setMatchScore?.(s);
  Object.assign(document.body.dataset,{gameShotKind:s.shotKind,gameLastShot:s.lastShot?.outcome||'',gameKeeper:s.players.filter(p=>p.keeper).map(p=>p.team+':'+p.keeperState?.phase).join(','),gameControlMode:s.controlMode,gameCamera:cameraMode,gameOpponent:s.fixture.id,gamePressure:String(p.defending),gameCharge:String(!!charge),gamePower:(s.chargePower||0).toFixed(2),gamePhase:s.phase,gameScore:s.score.home+':'+s.score.away,gameControlled:s.controlledId,gamePlayerPosition:[p.x,p.z].map(x=>x.toFixed(3)).join(','),gamePrediction:(s.predictionSeconds||0).toFixed(3),gameLatency:String(network?.latency||0),gameBall:[s.ball.x,s.ball.y,s.ball.z].map(x=>x.toFixed(2)).join(','),gameElapsed:s.elapsed.toFixed(1),gamePaused:String(s.paused),gameOwner:s.ball.ownerId||''});
 }
 function setView(next){if(replay)return;perspective=next==='first'?'first':'third';cameraMode=perspective==='first'?'first':config.camera;simulation.state.cameraMode=cameraMode;visualDirty=true;document.body.dataset.gameView=perspective;onView?.(perspective);render();}
 function setCamera(next){if(replay)return cameraMode;if(next==='first')setView('first');else{config.camera=next==='follow'?'follow':'broadcast';saveMatchOptions(storage,config);setView('third');}return cameraMode;}
 function cycleCamera(){const modes=['broadcast','follow','first'];return setCamera(modes[(modes.indexOf(cameraMode)+1)%modes.length]);}
 function cycleShotKind(){if(replay)return;cancelCharge();simulation.setShotKind(shotKinds[(shotKinds.indexOf(simulation.state.shotKind)+1)%shotKinds.length]);render();return simulation.state.shotKind;}
 function setControlMode(value){settings.controlMode=simulation.setControlMode(value);saveFootballSettings(storage,settings);render();return settings.controlMode;}
 function action(type,options={}){if(!active||pending||failed||simulation.state.paused)return false;const success=simulation.action(type,{direction:lastInput,...options});render();return success;}
 function cancelCharge(){charge=null;simulation.state.chargePower=0;$('game-charge').hidden=true;$('game-shoot').setAttribute('aria-pressed','false');}
 function beginCharge(){
  const s=simulation.state;if(!active||pending||failed||s.paused||s.phase!=='playing'||charge)return false;const p=s.players.find(p=>p.id===s.controlledId);
  if(s.ball.ownerId!==p.id&&(s.ball.ownerId||Math.hypot(p.x-s.ball.x,p.z-s.ball.z)>5)){s.message='没有控球 · 按住逼抢后择机抢断';render();return false;}
  charge={elapsed:0,playerId:p.id};s.chargePower=.25;render();return true;
 }
 function releaseCharge(){if(!charge)return false;const power=.25+Math.min(1,charge.elapsed/.85)*.75,id=charge.playerId;cancelCharge();return id===simulation.state.controlledId&&action('shoot',{power});}
 function clearPressure(){pressurePointers.clear();$('game-pressure').setAttribute('aria-pressed','false');}
 for(const button of document.querySelectorAll('[data-game-action]'))button.onclick=()=>{action(button.dataset.gameAction);$('scene').focus({preventScroll:true});};
 $('game-shot-mode').onclick=cycleShotKind;
 $('game-control-mode').onclick=()=>setControlMode(controlModes[(controlModes.indexOf(simulation.state.controlMode)+1)%controlModes.length]);
 for(const button of document.querySelectorAll('[data-control-mode]'))button.onclick=()=>setControlMode(button.dataset.controlMode);
 const pressure=$('game-pressure'),releasePressure=e=>{pressurePointers.delete(e.pointerId);pressure.setAttribute('aria-pressed',String(pressurePointers.size>0));};
 pressure.addEventListener('pointerdown',e=>{if(!active||pending||failed||simulation.state.paused)return;e.preventDefault();pressurePointers.add(e.pointerId);pressure.setPointerCapture?.(e.pointerId);pressure.setAttribute('aria-pressed','true');});
 for(const event of['pointerup','pointercancel','lostpointercapture'])pressure.addEventListener(event,releasePressure);
 const shoot=$('game-shoot');let shootPointer=null;
 shoot.addEventListener('pointerdown',e=>{if(shootPointer!==null)return;e.preventDefault();if(beginCharge()){shootPointer=e.pointerId;shoot.setPointerCapture?.(e.pointerId);}});
 shoot.addEventListener('pointerup',e=>{if(e.pointerId!==shootPointer)return;shootPointer=null;releaseCharge();$('scene').focus({preventScroll:true});});
 for(const event of['pointercancel','lostpointercapture'])shoot.addEventListener(event,e=>{if(e.pointerId===shootPointer){shootPointer=null;cancelCharge();}});
 shoot.onclick=e=>{if(e.detail===0)action('shoot',{power:.45});};
 $('game-camera').onclick=cycleCamera;$('game-fullscreen').onclick=()=>$('fullscreen').click?.();$('game-cheer').onclick=()=>{if(active&&!pending&&!failed&&!simulation.state.paused)onCheer?.();};
 $('game-mute').onclick=()=>{if(audio.state==='unavailable')audio.start();else audio.setMuted(!audio.muted);render();};$('game-pause').onclick=()=>onPause(!simulation.state.paused);$('game-resume').onclick=()=>onPause(false);$('game-restart').onclick=()=>network&&simulation.state.phase==='fulltime'?network.send({type:'rematch'}):onRestart();$('game-online-copy').onclick=()=>network&&copyOnlineInvite(network);$('game-exit').onclick=$('game-overlay-exit').onclick=onExit;$('game-change-match').onclick=onChangeMatch||onExit;
 $('game-help').onclick=showHelp;$('game-help-close').onclick=()=>$('game-help-dialog').close();$('game-help-dialog').addEventListener('close',()=>{if(active)onPause(helpWasPaused);});
 $('game-low-quality').onclick=()=>{const quality=$('quality');quality.value=quality.value==='low'?'standard':'low';quality.dispatchEvent(new Event('change',{bubbles:true}));render();};
 function showHelp(){if(!active||replay)return;helpWasPaused=simulation.state.paused;onPause(true);document.exitPointerLock?.();$('game-help-dialog').showModal();}
 function startReplay(){if(network||!active||pending||failed||replay)return false;const clip=recorder.clip();if(!clip)return false;cancelCharge();clearPressure();replay={clip,elapsed:0,speed:.5};$('game-replay-speed').textContent='慢放 0.5×';onPause(true);players.reset?.();document.body.classList.add('game-replay');onView?.('third');render();return true;}
 function endReplay(){if(!replay)return;replay=null;document.body.classList.remove('game-replay');$('game-replay-panel').hidden=true;players.reset?.();visualDirty=true;onView?.(perspective);render();}
 $('game-replay-launch').onclick=startReplay;$('game-replay-exit').onclick=endReplay;$('game-replay-restart').onclick=()=>{if(replay){replay.elapsed=0;players.reset?.();}};
 $('game-replay-speed').onclick=()=>{if(replay){replay.speed=replay.speed===.5?1:.5;$('game-replay-speed').textContent=replay.speed===.5?'慢放 0.5×':'原速 1×';}};
 return{root:view.root,get network(){return network;},get state(){return simulation.state;},get view(){return perspective;},get camera(){return cameraMode;},get active(){return active;},get replaying(){return !!replay;},startReplay,endReplay,
  start(options,session=null){network=session;replay=null;recorder.reset();document.body.classList.remove('game-replay');stadium.resetMatchEffects?.();config=matchOptions({...config,...options});saveMatchOptions(storage,config);simulation=network?createOnlineSimulation(network,{...settings,...config}):createFootballSimulation({...settings,...config,shotKind:simulation.state.shotKind});active=true;pending=true;failed=false;lastEvent=0;worldTime=0;lastInput={x:0,z:0};cancelCharge();clearPressure();shootPointer=null;view.setEnabled(true);document.body.classList.add('game-active');$('game-ui').hidden=false;setView('third');render();},
  ready(){pending=false;failed=false;simulation.ready?.();visualDirty=true;render();},fail(){pending=false;failed=true;render();},
  exit(keepNetwork=false){simulation.dispose?.({keepSession:keepNetwork});network=null;replay=null;document.body.dataset.gameReplay='false';recorder.reset();document.body.classList.remove('game-replay');$('game-replay-panel').hidden=true;active=false;pending=false;cancelCharge();clearPressure();shootPointer=null;view.setEnabled(false);$('game-ui').hidden=true;$('game-help-dialog').close();document.body.classList.remove('game-active');delete document.body.dataset.gamePhase;},
  setPaused(value){simulation.setPaused(value);if(value){clearPressure();cancelCharge();shootPointer=null;}render();},setControlMode,cycleShotKind,setView,setCamera,cycleCamera,showHelp,action,beginCharge,releaseCharge,cancelCharge,
  update(dt,input,viewer){
   if(!active)return;if(replay){replay.elapsed=Math.min(replay.clip.duration,replay.elapsed+Math.min(dt,.25)*replay.speed);const frame=replaySample(replay.clip,replay.elapsed);onCamera?.(frame,'third',dt);view.update(frame,frame.time,viewer);stadium.updateMatchEffects?.(frame,frame.time);$('game-replay-progress').value=replay.elapsed/replay.clip.duration;document.body.dataset.replayProgress=(replay.elapsed/replay.clip.duration).toFixed(3);if(replay.elapsed>=replay.clip.duration)endReplay();return;}aimYaw=input.yaw??0;lastInput={x:input.x||0,z:input.z||0};
   if(!pending&&!failed){
    if(charge&&!simulation.state.paused){charge.elapsed+=Math.min(dt,.25);simulation.state.chargePower=.25+Math.min(1,charge.elapsed/.85)*.75;}
    simulation.update(dt,{...input,defend:input.defend||pressurePointers.size>0,charging:!!charge});
    if(charge&&(simulation.state.controlledId!==charge.playerId||simulation.state.ball.ownerId&&simulation.state.ball.ownerId!==charge.playerId||simulation.state.phase!=='playing'))cancelCharge();
    if(!simulation.state.paused)worldTime+=Math.min(dt,.25);
   }
   const s=simulation.state;if(!network)recorder.record(s);if(network){if(worldTime>s.time+1)worldTime=s.time;else worldTime=Math.max(worldTime,s.time);}
   if(s.eventCount<lastEvent)lastEvent=0;if(s.eventCount!==lastEvent){for(const e of s.events.filter(e=>e.id>lastEvent)){if(e.type==='goal'){recorder.goal(s);audio.cheer();onCrowdReaction?.(1);}else if(['shot','pass','through','tackle','woodwork'].includes(e.type)){audio.kick?.(e.type==='shot'?1:.6);if(e.team==='home'&&['shot','tackle'].includes(e.type))onCrowdReaction?.(.3);}else if(['save','parry'].includes(e.type)&&e.team==='home')onCrowdReaction?.(.5);else if(e.type==='start'||e.type==='fulltime')audio.whistle?.();}lastEvent=s.eventCount;}
   s.cameraMode=cameraMode;onCamera?.(s,perspective,dt);visualTime+=dt;if((!s.paused||visualDirty||network)&&actorFrameBudget.ready(visualTime,mobile?30:60)){visualDirty=false;view.update(s,worldTime,viewer,{firstPerson:perspective==='first'});stadium.updateMatchEffects?.(s,worldTime);}uiTime+=dt;if(uiTime>.1){uiTime=0;if(!s.paused||network)render();}
  }
 };
}
