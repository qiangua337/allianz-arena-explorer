import {writeHudProperty,writeHudAttribute,writeHudData,writeHudDataset} from './hud-write.js';
import {createFootballTraining} from './football-training.js';
import {buildTrainingView} from './training-view.js';
import {buildMatchReport} from './football-report.js';
import {getSquadEditor} from './squad-editor.js';
import {periodLabel,intervalLabel} from './football-rules.js';
import {createOnlineSimulation} from './online-client.js';
import {copyOnlineInvite} from './online-lobby.js';
import {deliveryLabels,shotKinds,shotLabels} from './football-tactics.js';
import {shotReadout,shotOutcomeText} from './shot-feedback.js';
import {createReplayRecorder,replaySample} from './football-replay.js';
import {controlModes,controlLabels,controlDescriptions,loadFootballSettings,saveFootballSettings} from './football-assist.js';
import {createFootballSimulation} from './football-simulation.js';
import {buildFootballView} from './football-view.js';
import {buildFootballRadar} from './football-radar.js';
import {difficulties,loadMatchOptions,matchOptions,saveMatchOptions} from './football-teams.js';
import {matchTime,ballDirection,penaltyContext} from './football-controls.js';
import {penaltyCanShoot} from './football-penalty.js';
import {buildPenaltyControls,penaltyAimLabel,penaltyKeeperWaiting} from './football-penalty-ui.js';
import {bindInstantAction} from './instant-action.js';

const actionBits={pass:32,through:64,shoot:128};
function leavingPass(state,player){
 const ball=state.ball,id=ball.targetId;
 if(ball.ownerId||!id||id===player.id)return false;
 return state.players.find(p=>p.id===id)?.team===player.team;
}
function looseKickAvailable(state,player){
 const ball=state.ball;
 if(ball.ownerId)return false;
 const x=player.x-ball.x,z=player.z-ball.z;
 return x*x+z*z<25&&!leavingPass(state,player);
}

export function buildPlayableMatch({scene,stadium,players,audio,onCamera,onView,onPause,onRestart,onExit,onChangeMatch,onCheer,onCrowdReaction,onReadGameInput,getRenderCamera,toast,mobile=false,now=()=>performance.now()}){
 let storage;try{storage=globalThis.localStorage;}catch{}
 const elements=Object.create(null),$=id=>elements[id]??=(document.getElementById(id));
 const penaltyControls=buildPenaltyControls($);
 const settings=loadFootballSettings(storage),pressurePointers=new Set(),view=buildFootballView(scene,stadium.matchBall,players,{getRenderCamera}),radar=buildFootballRadar($('game-radar'));
 const actionButtons=[...document.querySelectorAll('[data-game-action]')];
 const modeButtons=[...document.querySelectorAll('[data-control-mode]')];
 const write=(id,key,value)=>writeHudProperty($(id),key,value);
 const trainingView=buildTrainingView(scene);view.root.add(trainingView.root);
 const report=buildMatchReport($('game-result'));let more=false,radarChoice=null;try{const display=JSON.parse(storage?.getItem('arena-match-display')||'{}');if(typeof display.radar==='boolean')radarChoice=display.radar;}catch{}
 const recorder=createReplayRecorder();let replay=null;
 let network=null;let config=loadMatchOptions(storage),simulation=createFootballSimulation({...settings,...config});
 let active=false,pending=false,failed=false,perspective='third',cameraMode=config.camera,trainingCameraChoice='close',uiTime=0,lastEvent=0,worldTime=0,aimYaw=0,helpWasPaused=false,cameraTime=0,visualDirty=true,charge=null,lastInput={x:0,z:0},squadEditing=false,lastRenderedPhase='',lastRenderedPaused=null;
 let lastNetworkPacket=null,pausedVisualKey='',networkStatusKey='',awayKit='';
 const lastActions={player:null,owner:null,flags:-1,penaltyTeam:null,penaltyStage:null};
 function controlsChanged(s,remember=false){
  const p=s.players.find(p=>p.id===s.controlledId),penalty=s.setPiece?.type==='penalty'?s.setPiece:s.phase==='penalties'?s.competition?.shootout:null;
  const flags=(s.paused?1:0)|(looseKickAvailable(s,p)?2:0)|(s.time>=p.tackleAt?4:0)|(charge?8:0)|(s.receiveTarget?16:0)|(actionBits[s.preparedAction?.type]||0),team=penalty?.team,stage=penalty?.stage;
  const changed=lastActions.player!==s.controlledId||lastActions.owner!==s.ball.ownerId||lastActions.flags!==flags||lastActions.penaltyTeam!==team||lastActions.penaltyStage!==stage;
  if(remember){lastActions.player=s.controlledId;lastActions.owner=s.ball.ownerId;lastActions.flags=flags;lastActions.penaltyTeam=team;lastActions.penaltyStage=stage;}return changed;
 }
 function refreshPausedNetwork(s){
  if(!network||!s.paused)return false;let changed=false;
  if(network.packet!==lastNetworkPacket){lastNetworkPacket=network.packet;
   // Paused snapshots still arrive for room readiness and acknowledgements.
   // Only a changed authoritative pose needs another skeleton/geometry upload.
   const key=JSON.stringify([s.time,s.phase,s.rosterRevision,s.ball,network.packet?.players,s.controlledId,s.nextPlayerId,s.passPreview,s.shotPreview,s.chargePower,s.attackDirections]);
   if(key!==pausedVisualKey){pausedVisualKey=key;visualDirty=true;changed=true;}
  }
  const room=network.room,key=JSON.stringify([network.connection,network.error,network.latency,room?.started,room?.ended,room?.reason,room?.seats?.map(p=>[p.team,p.ready,p.paused]),room?.intervalReady,room?.rematch]);
  if(key!==networkStatusKey){networkStatusKey=key;changed=true;}return changed;
 }
 function render(){
  if(!active)return;const s=simulation.state,receiving=s.receiveTarget||null,prepared=s.preparedAction||null,p=s.players.find(p=>p.id===s.controlledId),done=s.phase==='fulltime',owner=s.players.find(o=>o.id===s.ball.ownerId),owns=owner?.id===p.id,friendly=!!owner&&owner.team===p.team&&!owns;controlsChanged(s,true);
  s.cameraMode=cameraMode;lastRenderedPhase=s.phase;lastRenderedPaused=s.paused;const localTeam=network?.team||'home',shootout=s.competition?.shootout,penalty=penaltyContext(s,localTeam),interval=s.phase==='interval';write('game-period','textContent',periodLabel(s)+(shootout?' '+shootout.home.filter(Boolean).length+'–'+shootout.away.filter(Boolean).length:''));write('game-team','disabled',!!s.training||!!replay||pending||done||!!penalty);write('game-overlay-team','disabled',$('game-team').disabled);write('game-overlay-team','hidden',!!s.training||pending||failed||done||!!penalty);const showRadar=!s.training&&(radarChoice??!(mobile||typeof innerWidth==='number'&&innerWidth<=1024));writeHudData(document.body,'gameRadar',String(showRadar));writeHudAttribute($('game-radar-toggle'),'aria-pressed',String(showRadar));
  write('game-score-home','textContent',s.score.home);write('game-score-away','textContent',s.score.away);write('game-clock','textContent',matchTime(s));
  write('game-away-name','textContent',s.fixture.short);if(awayKit!==s.fixture.kit.shirt){awayKit=s.fixture.kit.shirt;writeHudProperty($('game-away-dot').style,'backgroundColor',awayKit);}
  const fps=Number(document.body.dataset.renderfps)||0;write('game-difficulty','textContent',replay?'精彩回放':network?(network.latency||'—')+' ms'+(pending?' · 加载':s.paused?' · 暂停':fps?' · '+fps+'帧':''):difficulties[s.difficulty].label+' · 人机');write('game-difficulty','title',network?'网络往返 '+(network.latency||'—')+' 毫秒；画面 '+(fps||'测量中')+' 帧/秒。移动在本机先响应，球权和进球由服务器确认。':'');$('game-difficulty').classList.toggle('network-slow',!!network&&network.latency>180);write('game-network-help','hidden',!network);write('game-low-quality','textContent',$('quality').value==='low'?'恢复均衡画质':'切换到流畅画质 · 降低细节');if(!s.training)write('game-fixture-title','textContent','FC BAYERN × '+s.fixture.english);
  write('game-player','textContent',p.number+' · '+p.name);write('game-stamina','value',Math.round(p.stamina*100)*.01);
  const passHint=s.passPreview?(deliveryLabels[s.passPreview.delivery]??'短传')+' → '+s.passPreview.name:'控球中';
  write('game-ball-hint','textContent',penalty?'点球 · '+(penalty.role==='shooter'?'主罚':'守门'):prepared?'已预备 · '+prepared.name+' 接球后'+(prepared.type==='shoot'?'射门':'传球'):receiving?'接应 '+receiving.name+' · 可预备传射':leavingPass(s,p)?'传球已出脚 · 换控接应':friendly?'队友控球 · 换控接管':owns?(p.defending?'护球中':passHint):!owner&&s.ball.rebound?'争第二落点 · '+ballDirection(p,s.ball,aimYaw):p.defending?'逼抢中 · 靠近后抢断':s.ball.targetId===p.id?'迎球中 · 方向可接管':Math.hypot(p.x-s.ball.x,p.z-s.ball.z)>25?'离球较远 · 换控接近足球':ballDirection(p,s.ball,aimYaw));
  write('game-pressure-label','textContent',owns?'护球':'逼抢');writeHudAttribute($('game-pressure'),'aria-pressed',String(!s.paused&&p.defending));
  write('game-mute','textContent',audio.muted?'♪':'♫');writeHudAttribute($('game-mute'),'aria-pressed',String(audio.muted));writeHudAttribute($('game-mute'),'aria-label',audio.muted?'开启比赛声音':'静音比赛声音');
  write('game-pause','textContent',s.paused?'▷':'Ⅱ');writeHudAttribute($('game-pause'),'aria-label',s.paused?'继续比赛':'暂停比赛');
  write('game-camera','textContent',{close:'近景 C',broadcast:'广角 C',follow:'跟随 C',first:'第一人称 C'}[cameraMode]);writeHudAttribute($('game-camera'),'aria-label','切换比赛镜头，当前'+{close:'近景转播',broadcast:'广角转播',follow:'跟随',first:'第一人称'}[cameraMode]);
  write('game-cheer','disabled',!!s.training||s.paused||pending||failed);write('game-pause','disabled',!!replay);write('game-help','disabled',!!replay);
  const overlay=!replay&&(pending||failed||s.paused||interval||done);
  write('game-replay-launch','hidden',!!s.training||!!network);write('game-replay-launch','disabled',!!network||pending||failed||!recorder.available);write('game-replay-panel','hidden',!replay);writeHudData(document.body,'gameReplay',String(!!replay));
  write('game-overlay-settings','hidden',pending||failed||done);if(overlay&&more){more=false;$('game-ui').dataset.more='false';writeHudAttribute($('game-more'),'aria-expanded','false');writeHudAttribute($('game-more'),'aria-label','展开比赛设置');}write('game-overlay','hidden',!overlay);if(!s.training)write('game-overlay-title','textContent',failed?'球员暂未加载':pending?'正在准备双方球员':done?'全场结束':'比赛已暂停');
  if(!s.training)write('game-overlay-description','textContent',failed?'可以重试加载，或退出返回参观。':pending?'准备好后将倒数开球。':done?`拜仁 ${s.score.home} : ${s.score.away} ${s.fixture.short}`:'点击继续比赛，回到球场。');
  write('game-resume','hidden',pending||failed||done);write('game-restart','hidden',pending);write('game-change-match','hidden',pending);if(!s.training)write('game-restart','textContent',failed?'重试加载':'重新开球');if(!s.training)write('game-change-match','textContent','更换对手与难度 →');
  if(network){const waiting=!network.room?.started,closed=network.connection==='closed'||network.room?.ended,reconnecting=network.connection!=='connected',own=network.room?.seats.find(p=>p.team===network.team),remote=network.room?.seats.find(p=>p.team!==network.team);write('game-online-info','hidden',false);write('game-online-code','textContent',network.code);
   if(!failed&&!pending&&!done){if(!s.training)write('game-overlay-title','textContent',closed?'房间已结束':reconnecting?'正在重新连接':waiting?'等待朋友准备':remote?.paused?'朋友暂停了比赛':'比赛已暂停');if(!s.training)write('game-overlay-description','textContent',closed?network.error||'请退出后重新创建房间。':reconnecting?'比赛已冻结，连接恢复后可继续。':waiting?'邀请朋友加入，双方加载完成后自动开球。':remote?.paused&&!own?.paused?'等待朋友点击继续。':'点击继续比赛，两边都取消暂停后恢复。');}
   write('game-resume','hidden',pending||failed||done||waiting||closed||reconnecting||!own?.paused);write('game-restart','hidden',pending||closed||(!done&&!failed));write('game-change-match','hidden',true);if(done)if(!s.training)write('game-restart','textContent',network.room?.rematch?.[network.team]?'已请求 · 等待朋友':'再来一场 · 双方确认');
  }else write('game-online-info','hidden',true);
  if(interval&&!pending&&!failed&&(!network||network.connection==='connected'&&!network.room?.ended)){const ready=network?.room?.intervalReady?.[localTeam];if(!s.training)write('game-overlay-title','textContent',intervalLabel(s.competition));if(!s.training)write('game-overlay-description','textContent',network?'可先调整阵型与替补；双方确认后继续。':'可先调整阵型与替补，准备好后继续。');write('game-resume','hidden',false);write('game-resume','disabled',!!ready);if(!s.training)write('game-resume','textContent',ready?'已准备 · 等待朋友':s.competition.next==='shootout'?'开始点球大战':s.competition.next===3?'开始加时赛':s.competition.next===4?'开始加时下半场':'开始下半场');write('game-restart','hidden',true);}
  else{write('game-resume','disabled',false);if(!s.training)write('game-resume','textContent','继续比赛');}
  if(network&&!pending&&!failed&&!network.room?.started&&network.connection==='connected'){const own=network.room?.seats.find(p=>p.team===localTeam);if(!own?.ready){write('game-resume','hidden',false);if(!s.training)write('game-resume','textContent','确认阵容并准备');}}
  if(done&&s.competition?.result){const result=s.competition.result,winner=result.winner==='home'?'拜仁':result.winner?s.fixture.short:null;if(!s.training)write('game-overlay-description','textContent',result.reason==='abandoned'?'球员不足七人，比赛终止':winner?winner+'获胜':'双方战平');if(shootout)$('game-overlay-description').textContent+=' · 点球 '+shootout.home.filter(Boolean).length+' : '+shootout.away.filter(Boolean).length;}
  const decision=s.discipline?.lastDecision,showDecision=decision&&s.time-decision.at<3.2&&!overlay;write('game-referee-note','hidden',!showDecision);if(showDecision)write('game-referee-note','textContent',(decision.card?{yellow:'黄牌',red:'红牌','second-yellow':'两黄变一红'}[decision.card]+' · ':'裁判哨响 · ')+decision.reason);
  penaltyControls.render(penalty,{overlay:overlay||!!replay,touch:document.body.dataset.touch==='true',stoppageId:s.stoppageId});
  write('game-camera','disabled',!!penalty);
  if(!s.training)writeHudAttribute($('game-ui'),'aria-label',network?'好友联机足球比赛':'人机足球比赛');write('game-radar-direction','textContent',(localTeam==='home'?'拜仁':s.fixture.short)+'进攻 '+((s.attackDirections?.[localTeam]??-1)<0?'→':'←'));if(!s.training)write('game-help-opponent','textContent',network?'你控制'+(network.team==='home'?'拜仁':s.fixture.short)+'，朋友控制另一队；其余队员由 AI 配合。双方共用比分与球的位置。':'控制拜仁对战 AI。金色脚环是你，浅色连线指向当前传球目标；雷达上方的箭头显示当前进攻方向，中场后换边。');writeHudData(document.body,'onlineRoom',network?.code||'');writeHudData(document.body,'onlineTeam',network?.team||'');writeHudData(document.body,'onlineConnection',network?.connection||'');
  if(!s.training)report.update(s,!pending&&!failed&&(done||interval||s.paused)&&(!network||network.room?.started));else write('game-result','hidden',true);
  const announcement=!overlay&&(s.phase==='kickoff'||s.phase==='goal');write('game-announcement','hidden',!announcement);write('game-announcement','textContent',s.phase==='goal'?s.message:s.restartType==='kickoff'?String(Math.max(1,Math.ceil(3-s.phaseTime))):s.message);
  for(const button of modeButtons)writeHudAttribute(button,'aria-pressed',String(button.dataset.controlMode===s.controlMode));
  write('game-overlay-assist','textContent','换控：'+controlLabels[s.controlMode]+' ↻');writeHudAttribute($('game-overlay-assist'),'aria-label','暂停设置：切换换人辅助，当前'+controlLabels[s.controlMode]);write('game-assist-toggle','textContent',controlLabels[s.controlMode]+' ↻');writeHudAttribute($('game-assist-toggle'),'aria-label','切换换人辅助，当前'+controlLabels[s.controlMode]);write('game-assist-toggle','title',controlDescriptions[s.controlMode]);write('game-control-mode','textContent',controlLabels[s.controlMode]+' ↻');writeHudAttribute($('game-control-mode'),'aria-label','切换换人辅助，当前'+controlLabels[s.controlMode]);write('game-control-description','textContent',controlDescriptions[s.controlMode]);
  const actionPlay=s.phase==='playing'&&!penalty,canReceive=looseKickAvailable(s,p),canKick=penalty?penalty.role==='shooter'&&penaltyCanShoot(penalty):(owns||canReceive||!!receiving)&&actionPlay;
  const preparation=shotReadout(s.shotPreview),waitingCharge=charge?.receiving&&s.ball.ownerId!==charge.playerId;write('game-overlay-shot','textContent','射门：'+shotLabels[s.shotKind]+' ↻');writeHudAttribute($('game-overlay-shot'),'aria-label','暂停设置：切换射门方式，当前'+shotLabels[s.shotKind]);write('game-shot-toggle','textContent',shotLabels[s.shotKind]+' ↻');writeHudAttribute($('game-shot-toggle'),'aria-label','切换射门方式，当前'+shotLabels[s.shotKind]);write('game-shot-mode','textContent',shotLabels[s.shotKind]+' Z');writeHudAttribute($('game-shot-mode'),'aria-label','切换射门方式，当前'+shotLabels[s.shotKind]);write('game-charge-label','textContent',(waitingCharge?'预备接球射门':shotLabels[s.shotKind])+' · '+Math.round((s.chargePower||0)*100)+'% · '+preparation.label);write('game-charge-advice','textContent',waitingCharge?'松手预备 · 真实接球后起脚':preparation.advice+' · 松开出脚');writeHudData($('game-charge'),'tone',preparation.tone);
  const shot=s.lastShot,recent=shot&&s.time-shot.updatedAt<3&&s.phase!=='goal'&&!overlay&&!replay;write('game-shot-feedback','hidden',!recent);if(recent){write('game-shot-feedback','textContent',(shot.team===localTeam?'本队':shot.team==='home'?'拜仁':s.fixture.short)+' · '+(penalty?'点球':shotLabels[shot.kind])+' · '+shotOutcomeText(shot));writeHudData($('game-shot-feedback'),'outcome',shot.outcome);}
  write('game-charge','hidden',!charge||overlay);write('game-power','value',s.chargePower||0);writeHudAttribute($('game-shoot'),'aria-pressed',String(!!charge));write('game-shoot','disabled',!canKick||overlay);
  if(penalty&&charge){
   const risky=s.chargePower>.76;
   write('game-charge-label','textContent','点球力度 · '+Math.round((s.chargePower||0)*100)+'%');
   write('game-charge-advice','textContent',(risky?'大力射门偏差更大':'松手射门')+' · '+penaltyAimLabel(penaltyControls.aim));
   writeHudData($('game-charge'),'tone',risky?'risk':'steady');
  }
  const cooling=s.time<p.tackleAt;
  for(const button of actionButtons){
   const type=button.dataset.gameAction;
   const disabled=type==='tackle'&&penalty
    ?penalty.role==='shooter'||penalty.stage!=='flight'&&!penaltyCanShoot(penalty)||['dive','set','recover'].includes(p.keeperState?.phase)
    :!actionPlay||(type==='pass'||type==='through')&&!canKick||type==='tackle'&&(owns||friendly||!!receiving||cooling);
   writeHudProperty(button,'disabled',overlay||disabled);
   if(type==='tackle')writeHudAttribute(button,'data-cooling',cooling);
  }
  write('game-pressure','disabled',overlay||!actionPlay||friendly||!!receiving);
  const loose=!penalty&&!s.ball.ownerId&&canKick,tackleLabel=penalty?'扑救':loose?'争球':'抢断';
  write('game-tackle-label','textContent',tackleLabel);
  writeHudAttribute($('game-tackle'),'aria-label',(penalty?'门将':'出脚')+tackleLabel);
  writeHudData(document.body,'controlContext',penalty?(penalty.role==='shooter'?'penalty-shooter':'penalty-keeper'):canKick?(owns?'attack':'loose'):'defend');write('game-event','textContent',s.message);if(showRadar&&!penalty&&!overlay)radar.update(s);if(!s.training)stadium.setMatchScore?.(s);
  writeHudData(document.body,'gameReceiving',String(!!receiving));renderTraining(s,{pending,failed,done});
  writeHudDataset(document.body,{gameShotKind:s.shotKind,gameLastShot:s.lastShot?.outcome||'',gameKeeper:s.players.filter(p=>p.keeper).map(p=>p.team+':'+p.keeperState?.phase).join(','),gameControlMode:s.controlMode,gameCamera:cameraMode,gameOpponent:s.fixture.id,gamePressure:String(p.defending),gameCharge:String(!!charge),gamePower:(s.chargePower||0).toFixed(2),gamePeriod:String(s.competition?.period||1),gameMode:s.competition?.mode||'legacy',gamePhase:s.phase,gameScore:s.score.home+':'+s.score.away,gameControlled:s.controlledId,gamePlayerPosition:[p.x,p.z].map(x=>x.toFixed(3)).join(','),gamePrediction:(s.predictionSeconds||0).toFixed(3),gameLatency:String(network?.latency||0),gameBall:[s.ball.x,s.ball.y,s.ball.z].map(x=>x.toFixed(2)).join(','),gameElapsed:s.elapsed.toFixed(1),gamePaused:String(s.paused),gameOwner:s.ball.ownerId||''});
 }
 function renderTraining(s,{pending,failed,done}){
  const lesson=s.training;write('training-hud','hidden',!lesson);write('training-result','hidden',!lesson||!done);writeHudData(document.body,'gameTraining',lesson?.id||'');if(!lesson)return;
  const m=lesson.metrics;write('training-title','textContent',lesson.title);write('training-progress','textContent',lesson.id==='free'?m.gates+' 标记':lesson.id==='passing'?lesson.successCount+' / '+lesson.targetCount:Math.min(lesson.attempt,lesson.attemptLimit)+' / '+lesson.attemptLimit);
  const target=lesson.id==='free'?lesson.targets.find(t=>t.active&&!t.completed):null,player=s.players.find(p=>p.id===s.controlledId);write('training-instruction','textContent',target?'下一标记 · '+ballDirection(player,target,aimYaw):lesson.instruction);write('training-feedback','textContent',lesson.feedback);write('game-training-reset','disabled',pending||failed||done);
  write('training-pause','textContent',s.paused?'继续':'暂停');write('training-pause','disabled',pending||failed||done);write('game-overlay-team','hidden',true);write('game-cheer','disabled',true);writeHudAttribute($('game-ui'),'aria-label','球场训练');write('game-help-opponent','textContent',lesson.title+'：'+lesson.instruction+' '+lesson.hint);
  write('game-fixture-title','textContent','FC BAYERN · TRAINING CENTRE');write('game-overlay-title','textContent',failed?'训练暂未就绪':pending?'正在准备训练球场':done?'训练完成':'训练已暂停');write('game-overlay-description','textContent',failed?'请重试加载球员，或返回选择其他体验。':pending?'准备球员与训练标记，即刻开始。':done?lesson.feedback:lesson.hint);
  write('game-restart','textContent',failed?'重试加载':'重新开始本课');write('game-change-match','textContent','选择其他训练');write('game-resume','textContent','继续训练');write('game-replay-launch','hidden',true);
  if(done){const rows=lesson.id==='passing'?[[m.completedPasses,'成功传接'],[m.passes,'尝试传球'],[m.bestStreak,'最佳连续']]:[[m.goals,'进球'],[m.onTarget,'射正'],[m.shots,'射门']];$('training-result').innerHTML=rows.map(([value,label])=>'<div><b>'+value+'</b><small>'+label+'</small></div>').join('');}
 }
 function setView(next){if(replay)return;perspective=next==='first'?'first':'third';cameraMode=perspective==='first'?'first':simulation.state.training?trainingCameraChoice:config.camera;simulation.state.cameraMode=cameraMode;visualDirty=true;writeHudData(document.body,'gameView',perspective);onView?.(perspective);render();}
 function setCamera(next){if(replay)return cameraMode;if(next==='first')setView('first');else{const choice=['close','broadcast','follow'].includes(next)?next:'close';if(simulation.state.training)trainingCameraChoice=choice;else{config.camera=choice;saveMatchOptions(storage,config);}setView('third');}return cameraMode;}
 function cycleCamera(){if(penaltyContext(simulation.state,network?.team||'home'))return cameraMode;const modes=['close','broadcast','follow','first'];return setCamera(modes[(modes.indexOf(cameraMode)+1)%modes.length]);}
 function cycleShotKind(){if(replay||penaltyContext(simulation.state,network?.team||'home'))return;cancelCharge();simulation.setShotKind(shotKinds[(shotKinds.indexOf(simulation.state.shotKind)+1)%shotKinds.length]);render();return simulation.state.shotKind;}
 function setControlMode(value){settings.controlMode=simulation.setControlMode(value);saveFootballSettings(storage,settings);render();return settings.controlMode;}
 function currentInput(){return onReadGameInput?.()??lastInput;}
 function flushInput(input){
  if(!network||!active||pending||failed||simulation.state.paused)return;
  const sampled=input??currentInput();
  simulation.flushInput({...sampled,defend:sampled.defend||pressurePointers.size>0,charging:!!charge});
 }
 function action(type,options={}){
  if(!active||pending||failed||simulation.state.paused)return false;
  const sampled=currentInput();
  const penalty=penaltyContext(simulation.state,network?.team||'home');
  if(penalty?.role==='keeper'&&type==='tackle'&&penaltyKeeperWaiting(penalty))type='penalty-ready';
  const command={direction:sampled,...options};
  if(penalty&&type==='shoot')command.penaltyAim=penaltyControls.aim;
  if(penalty?.role==='keeper'&&type==='tackle'){
   if(penalty.stage!=='flight'&&!penaltyCanShoot(penalty))return false;
   const facing=penalty.goalZ<0?-1:1, aim=penaltyControls.aim;
   command.direction={x:aim.x*facing,z:0};command.penaltyAim=aim;
  }
  flushInput(sampled);
  // Keep aim on the action packet even when the movement packet is throttled.
  const success=simulation.action(type,command);
  render();return success;
 }
 function cancelCharge(){charge=null;shootPointer=null;simulation.state.chargePower=0;write('game-charge','hidden',true);writeHudAttribute($('game-shoot'),'aria-pressed','false');}
 function beginCharge(){
  const s=simulation.state,penalty=penaltyContext(s,network?.team||'home');if(!active||pending||failed||s.paused||!['playing','penalties'].includes(s.phase)||charge||penalty&&(penalty.role!=='shooter'||!penaltyCanShoot(penalty)))return false;const receiving=s.receiveTarget,p=s.players.find(p=>p.id===(receiving?.playerId||s.controlledId));
  if(!receiving&&s.ball.ownerId!==p.id&&!looseKickAvailable(s,p)){s.message='没有控球 · 按住逼抢后择机抢断';render();return false;}
  charge={elapsed:0,startedAt:now(),playerId:p.id,receiving:!!receiving};s.chargePower=.25;flushInput();render();return true;
 }
 function shotPower(){
  // A missed rendering frame cannot shorten the time a player held the button.
  const elapsed=network?Math.max(charge.elapsed,(now()-charge.startedAt)/1000):charge.elapsed;
  return .25+Math.min(1,elapsed/.85)*.75;
 }
 function releaseCharge(){if(!charge)return false;const power=shotPower(),id=charge.playerId,valid=id===simulation.state.controlledId||charge.receiving&&simulation.state.receiveTarget?.playerId===id;cancelCharge();if(!valid){flushInput();return false;}return action('shoot',{power});}
 function clearPressure(){pressurePointers.clear();writeHudAttribute($('game-pressure'),'aria-pressed','false');}
 function clearInput(){cancelCharge();clearPressure();for(const binding of instantActions)binding.clear();shootPointer=null;lastInput={x:0,z:0};if(active&&!pending&&network)simulation.clearInput();}
 const instantActions=actionButtons.map(button=>bindInstantAction(button,()=>{action(button.dataset.gameAction);$('scene').focus({preventScroll:true});}));
 $('game-penalty-ready').onclick=()=>{action('penalty-ready');$('scene').focus({preventScroll:true});};
 $('game-training-reset').onclick=()=>{if(!active||pending||failed||!simulation.state.training)return;clearInput();simulation.resetAttempt();visualDirty=true;render();};$('training-pause').onclick=()=>onPause(!simulation.state.paused);$('training-exit').onclick=onExit;
 $('game-shot-mode').onclick=$('game-shot-toggle').onclick=$('game-overlay-shot').onclick=cycleShotKind;
 $('game-control-mode').onclick=$('game-assist-toggle').onclick=$('game-overlay-assist').onclick=()=>setControlMode(controlModes[(controlModes.indexOf(simulation.state.controlMode)+1)%controlModes.length]);
 for(const button of modeButtons)button.onclick=()=>setControlMode(button.dataset.controlMode);
 const pressure=$('game-pressure'),releasePressure=e=>{if(!pressurePointers.delete(e.pointerId))return;pressure.setAttribute('aria-pressed',String(pressurePointers.size>0));flushInput();};
 pressure.addEventListener('pointerdown',e=>{if(!active||pending||failed||simulation.state.paused)return;e.preventDefault();pressurePointers.add(e.pointerId);pressure.setPointerCapture?.(e.pointerId);pressure.setAttribute('aria-pressed','true');flushInput();});
 for(const event of['pointerup','pointercancel','lostpointercapture'])pressure.addEventListener(event,releasePressure);
 const shoot=$('game-shoot');let shootPointer=null;
 shoot.addEventListener('pointerdown',e=>{if(shootPointer!==null)return;e.preventDefault();if(beginCharge()){shootPointer=e.pointerId;shoot.setPointerCapture?.(e.pointerId);}});
 shoot.addEventListener('pointerup',e=>{if(e.pointerId!==shootPointer)return;shootPointer=null;releaseCharge();$('scene').focus({preventScroll:true});});
 for(const event of['pointercancel','lostpointercapture'])shoot.addEventListener(event,e=>{if(e.pointerId===shootPointer){shootPointer=null;cancelCharge();}});
 shoot.onclick=e=>{if(e.detail===0)action('shoot',{power:.45});};
 $('game-camera').onclick=cycleCamera;$('game-fullscreen').onclick=()=>$('fullscreen').click?.();$('game-cheer').onclick=()=>{if(active&&!pending&&!failed&&!simulation.state.paused)onCheer?.();};
 $('game-mute').onclick=()=>{if(audio.state==='unavailable')audio.start({ambience:!simulation.state.training});else audio.setMuted(!audio.muted);render();};$('game-pause').onclick=()=>onPause(!simulation.state.paused);$('game-resume').onclick=async()=>{try{if(network&&!network.room?.started){network.setReady(true);return;}if(simulation.state.phase==='interval'){await simulation.continuePeriod();if(!network)onPause(false);render();return;}onPause(false);}catch(error){toast?.(error.message);}};$('game-restart').onclick=()=>network&&simulation.state.phase==='fulltime'?network.send({type:'rematch'}):onRestart();$('game-online-copy').onclick=()=>network&&copyOnlineInvite(network);$('game-exit').onclick=$('game-overlay-exit').onclick=onExit;$('game-change-match').onclick=onChangeMatch||onExit;
 $('game-more').onclick=()=>{more=!more;$('game-ui').dataset.more=String(more);writeHudAttribute($('game-more'),'aria-expanded',String(more));writeHudAttribute($('game-more'),'aria-label',more?'收起比赛设置':'展开比赛设置');};$('game-radar-toggle').onclick=()=>{const visible=document.body.dataset.gameRadar==='true';radarChoice=!visible;try{storage?.setItem('arena-match-display',JSON.stringify({radar:radarChoice}));}catch{}render();};$('game-overlay-team').onclick=showTeam;$('game-team').onclick=showTeam;$('game-help').onclick=showHelp;$('game-help-close').onclick=()=>$('game-help-dialog').close();$('game-help-dialog').addEventListener('close',()=>{if(active)onPause(helpWasPaused);});
 $('game-low-quality').onclick=()=>{const quality=$('quality');quality.value=quality.value==='low'?'standard':'low';quality.dispatchEvent(new Event('change',{bubbles:true}));render();};
 function showTeam(){if(!active||pending||failed||replay||simulation.state.training||simulation.state.phase==='fulltime')return;const wasPaused=simulation.state.paused,team=network?.team||'home',s=simulation.state,waiting=network&&!network.room?.started;onPause(true);document.exitPointerLock?.();squadEditing=true;getSquadEditor().open({team,opponent:s.fixture.id,selection:waiting?network.room?.lineups?.[team]:{formation:s.teamSheets[team].formation,xi:s.teamSheets[team].xi},sheet:s.teamSheets[team],extraTime:s.competition?.period>2,players:s.players,live:!waiting,onClose:()=>{squadEditing=false;if(active)onPause(wasPaused);},onSave:async(selection,change)=>{if(waiting)return network.request({type:'lineup',selection});let result={ok:true};if(change){result=await simulation.substitute(team,change.outId,change.inNumber);if(result?.ok===false)return result;}if(selection.formation!==s.teamSheets[team].formation){const changed=await simulation.setFormation(team,selection.formation);if(changed?.ok===false)return changed;}toast?.(result.queued?'换人已登记，下次死球执行':'阵容调整已保存');render();return result;}});}
 function showHelp(){if(!active||replay)return;helpWasPaused=simulation.state.paused;onPause(true);document.exitPointerLock?.();$('game-help-dialog').showModal();}
 function startReplay(){if(network||simulation.state.training||!active||pending||failed||replay)return false;const clip=recorder.clip();if(!clip)return false;cancelCharge();clearPressure();replay={clip,elapsed:0,speed:.5};write('game-replay-speed','textContent','慢放 0.5×');onPause(true);players.reset?.();document.body.classList.add('game-replay');onView?.('third');render();return true;}
 function endReplay(){if(!replay)return;replay=null;document.body.classList.remove('game-replay');write('game-replay-panel','hidden',true);players.reset?.();visualDirty=true;onView?.(perspective);render();}
 $('game-replay-launch').onclick=startReplay;$('game-replay-exit').onclick=endReplay;$('game-replay-restart').onclick=()=>{if(replay){replay.elapsed=0;players.reset?.();}};
 $('game-replay-speed').onclick=()=>{if(replay){replay.speed=replay.speed===.5?1:.5;write('game-replay-speed','textContent',replay.speed===.5?'慢放 0.5×':'原速 1×');}};
 return{root:view.root,get training(){return simulation.state.training?.id||null;},get network(){return network;},get state(){return simulation.state;},get view(){return perspective;},get camera(){return cameraMode;},get active(){return active;},get replaying(){return !!replay;},startReplay,endReplay,
  start(options={},session=null){more=false;$('game-ui').dataset.more='false';writeHudAttribute($('game-more'),'aria-expanded','false');writeHudAttribute($('game-more'),'aria-label','展开比赛设置');network=session;trainingCameraChoice='close';lastNetworkPacket=null;pausedVisualKey='';networkStatusKey='';uiTime=0;replay=null;recorder.reset();document.body.classList.remove('game-replay');stadium.resetMatchEffects?.();config=matchOptions({...config,...options});saveMatchOptions(storage,config);simulation=network?createOnlineSimulation(network,{...settings,...config}):options.training?createFootballTraining({...settings,...config,drill:options.training,shotKind:simulation.state.shotKind}):createFootballSimulation({...settings,...config,duration:config.rules.duration,selections:{home:config.selection},shotKind:simulation.state.shotKind});active=true;pending=true;failed=false;lastEvent=0;worldTime=0;cameraTime=0;penaltyControls.clear();clearInput();view.setEnabled(true);document.body.classList.add('game-active');write('game-ui','hidden',false);setView('third');render();},
  ready(){pending=false;failed=false;simulation.ready?.();visualDirty=true;render();},fail(){pending=false;failed=true;render();},
  exit(keepNetwork=false){simulation.dispose?.({keepSession:keepNetwork});network=null;replay=null;writeHudData(document.body,'gameReplay','false');recorder.reset();document.body.classList.remove('game-replay');write('game-replay-panel','hidden',true);active=false;pending=false;if(squadEditing)getSquadEditor().close();penaltyControls.clear();clearInput();view.setEnabled(false);trainingView.setEnabled(false);writeHudData(document.body,'gameTraining','');write('game-ui','hidden',true);$('game-help-dialog').close();document.body.classList.remove('game-active');delete document.body.dataset.gamePhase;},
  showTeam,clearInput,flushInput,setPaused(value){simulation.setPaused(value);if(value)clearInput();render();},setControlMode,cycleShotKind,setView,setCamera,cycleCamera,showHelp,action,beginCharge,releaseCharge,cancelCharge,
  projectPenalty:penaltyControls.project,
  nudgePenaltyAim(){penaltyControls.move(currentInput().penaltyAimAxis,.07);},
  centerPenaltyAim:penaltyControls.center,
  update(dt,input,viewer,visualFrame=true){
   if(!active)return;
   cameraTime=Math.min(.25,cameraTime+dt);
   if(replay){
    replay.elapsed=Math.min(replay.clip.duration,replay.elapsed+Math.min(dt,.25)*replay.speed);
    if(visualFrame){
     const frame=replaySample(replay.clip,replay.elapsed);
     onCamera?.(frame,'third',cameraTime);cameraTime=0;
     view.update(frame,frame.time,viewer);stadium.updateMatchEffects?.(frame,frame.time);
     write('game-replay-progress','value',replay.elapsed/replay.clip.duration);writeHudData(document.body,'replayProgress',(replay.elapsed/replay.clip.duration).toFixed(3));
     if(replay.elapsed>=replay.clip.duration)endReplay();
    }
    return;
   }
   aimYaw=input.yaw??0;lastInput=input;
   if(!pending&&!failed){
    if(!simulation.state.paused)penaltyControls.move(input.penaltyAimAxis,Math.min(dt,.04));
    if(charge&&!simulation.state.paused){charge.elapsed+=Math.min(dt,.25);simulation.state.chargePower=shotPower();}
    simulation.update(dt,{...input,defend:input.defend||pressurePointers.size>0,charging:!!charge});
    if(charge){const state=simulation.state,player=state.players.find(p=>p.id===charge.playerId);const awaiting=charge.receiving&&state.receiveTarget?.playerId===charge.playerId&&!state.ball.ownerId;if(!awaiting&&(state.controlledId!==charge.playerId||state.ball.ownerId&&state.ball.ownerId!==charge.playerId||!state.ball.ownerId&&(!player||Math.hypot(player.x-state.ball.x,player.z-state.ball.z)>5))||!['playing','penalties'].includes(state.phase))cancelCharge();}
    if(!simulation.state.paused)worldTime+=Math.min(dt,.25);
   }
   const s=simulation.state,networkChanged=refreshPausedNetwork(s);if(s.phase!==lastRenderedPhase||s.paused!==lastRenderedPaused||networkChanged&&s.paused||controlsChanged(s))render();if(!network&&!s.training)recorder.record(s);if(network){if(worldTime>s.time+1)worldTime=s.time;else worldTime=Math.max(worldTime,s.time);}
   if(s.eventCount<lastEvent)lastEvent=0;if(s.eventCount!==lastEvent){for(const e of s.events.filter(e=>e.id>lastEvent)){if(e.type==='goal'&&!s.training){recorder.goal(s);audio.cheer();onCrowdReaction?.(1);}else if(['shot','pass','through','tackle','woodwork'].includes(e.type)){audio.kick?.(e.type==='shot'?1:.6);if(e.team==='home'&&['shot','tackle'].includes(e.type))onCrowdReaction?.(.3);}else if(['save','parry'].includes(e.type)&&e.team==='home')onCrowdReaction?.(.5);else if(e.type==='start'||e.type==='fulltime')audio.whistle?.();}lastEvent=s.eventCount;}
   // Sample the camera, ball and bones from the same state just before a
   // draw. Input and network prediction still run on every animation tick.
   if(visualFrame){
    trainingView.update(s.training);s.cameraMode=cameraMode;
    onCamera?.(s,perspective,cameraTime);cameraTime=0;
    if(!s.paused||visualDirty||view.cameraChanged()){visualDirty=false;view.update(s,worldTime,viewer,{firstPerson:perspective==='first'&&!penaltyContext(s)});stadium.updateMatchEffects?.(s,worldTime);}
   }
   uiTime+=dt;if(uiTime>(s.paused?1:.1)){uiTime=0;if(!s.paused||network)render();}
  }
 };
}
