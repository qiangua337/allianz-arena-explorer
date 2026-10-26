import {controlModes,controlLabels,controlDescriptions,loadFootballSettings,saveFootballSettings} from './football-assist.js';
import {createFootballSimulation} from './football-simulation.js';
import {buildFootballView} from './football-view.js';
import {matchTime,ballDirection} from './football-controls.js';

export function buildPlayableMatch({scene,stadium,players,audio,onCamera,onView,onPause,onRestart,onExit,mobile=false}){
 let storage;try{storage=globalThis.localStorage;}catch{}const settings=loadFootballSettings(storage);const $=id=>document.getElementById(id),simulation=createFootballSimulation(settings),pressurePointers=new Set(),view=buildFootballView(scene,stadium.matchBall,players);
 let active=false,pending=false,failed=false,perspective='third',uiTime=0,lastEvent=0,worldTime=0,aimYaw=0,helpWasPaused=false,visualTime=1;
 function render(){if(!active)return;const s=simulation.state,p=s.players.find(p=>p.id===s.controlledId),done=s.phase==='fulltime';
  $('game-score-home').textContent=s.score.home;$('game-score-away').textContent=s.score.away;$('game-clock').textContent=matchTime(s);
  $('game-player').textContent=p.number+' · '+p.name;$('game-stamina').value=p.stamina;$('game-ball-hint').textContent=s.ball.ownerId===p.id?(p.defending?'护球中 · 松开 E 可加速':'控球中 · 进攻北侧球门 ↑'):p.defending?'逼抢中 · 空格出脚':ballDirection(p,s.ball,aimYaw);
  $('game-pressure-label').textContent=s.ball.ownerId===p.id?'护球':'逼抢';$('game-pressure').setAttribute('aria-pressed',String(!s.paused&&p.defending));$('game-mute').textContent=audio.muted?'♪':'♫';$('game-mute').setAttribute('aria-pressed',String(audio.muted));$('game-mute').setAttribute('aria-label',audio.muted?'开启比赛声音':'静音比赛声音');$('game-pause').textContent=s.paused?'继续':'暂停';$('game-pause').setAttribute('aria-label',s.paused?'继续比赛':'暂停比赛');
  const overlay=pending||failed||s.paused||done;$('game-overlay').hidden=!overlay;$('game-overlay-title').textContent=failed?'球员暂未加载':pending?'正在准备双方球员':done?'全场结束':'比赛已暂停';
  $('game-overlay-description').textContent=failed?'可以重试加载，或退出返回参观。':pending?'准备好后将倒数开球。':done?`拜仁 ${s.score.home} : ${s.score.away} 多特蒙德`:'点击继续比赛，回到球场。';
  $('game-resume').hidden=pending||failed||done;$('game-restart').hidden=pending;$('game-restart').textContent=failed?'重试加载':'重新开球';
  const announcement=!overlay&&(s.phase==='kickoff'||s.phase==='goal');$('game-announcement').hidden=!announcement;$('game-announcement').textContent=s.phase==='goal'?s.message:s.restartType==='kickoff'?String(Math.max(1,Math.ceil(3-s.phaseTime))):s.message;
  for(const button of document.querySelectorAll('[data-control-mode]'))button.setAttribute('aria-pressed',String(button.dataset.controlMode===s.controlMode));$('game-control-mode').textContent=controlLabels[s.controlMode]+' ↻';$('game-control-mode').setAttribute('aria-label','切换换人辅助，当前'+controlLabels[s.controlMode]);$('game-control-description').textContent=controlDescriptions[s.controlMode];document.body.dataset.gameControlMode=s.controlMode;document.body.dataset.gamePressure=String(p.defending);$('game-event').textContent=s.message;document.body.dataset.gamePhase=s.phase;document.body.dataset.gameScore=s.score.home+':'+s.score.away;document.body.dataset.gameControlled=s.controlledId;document.body.dataset.gameBall=[s.ball.x,s.ball.y,s.ball.z].map(x=>x.toFixed(2)).join(',');document.body.dataset.gameElapsed=s.elapsed.toFixed(1);document.body.dataset.gamePaused=String(s.paused);document.body.dataset.gameOwner=s.ball.ownerId||'';
 }
 function setView(next){perspective=next==='first'?'first':'third';document.body.dataset.gameView=perspective;onView?.(perspective);}
 for(const button of document.querySelectorAll('[data-game-action]'))button.onclick=()=>{action(button.dataset.gameAction);$('scene').focus({preventScroll:true});};
 function setControlMode(value){settings.controlMode=simulation.setControlMode(value);saveFootballSettings(storage,settings);render();return settings.controlMode;}
 $('game-control-mode').onclick=()=>setControlMode(controlModes[(controlModes.indexOf(simulation.state.controlMode)+1)%controlModes.length]);
 for(const button of document.querySelectorAll('[data-control-mode]'))button.onclick=()=>setControlMode(button.dataset.controlMode);
 const pressure=$('game-pressure'),releasePressure=e=>{pressurePointers.delete(e.pointerId);pressure.setAttribute('aria-pressed',String(pressurePointers.size>0));};
 pressure.addEventListener('pointerdown',e=>{if(!active||pending||failed||simulation.state.paused)return;e.preventDefault();pressurePointers.add(e.pointerId);pressure.setPointerCapture?.(e.pointerId);pressure.setAttribute('aria-pressed','true');});
 for(const event of['pointerup','pointercancel','lostpointercapture'])pressure.addEventListener(event,releasePressure);
 function clearPressure(){pressurePointers.clear();pressure.setAttribute('aria-pressed','false');}
 $('game-mute').onclick=()=>{if(audio.state==='unavailable')audio.start();else audio.setMuted(!audio.muted);render();};$('game-pause').onclick=()=>onPause(!simulation.state.paused);$('game-resume').onclick=()=>onPause(false);$('game-restart').onclick=onRestart;$('game-exit').onclick=$('game-overlay-exit').onclick=onExit;
 $('game-help').onclick=showHelp;$('game-help-close').onclick=()=>$('game-help-dialog').close();$('game-help-dialog').addEventListener('close',()=>{if(active)onPause(helpWasPaused);});
 function showHelp(){if(!active)return;helpWasPaused=simulation.state.paused;onPause(true);document.exitPointerLock?.();$('game-help-dialog').showModal();}
 function action(type){if(!active||pending||failed||simulation.state.paused)return false;const success=simulation.action(type);if(success)render();return success;}
 return{root:view.root,get state(){return simulation.state;},get view(){return perspective;},get active(){return active;},start(){active=true;pending=true;failed=false;lastEvent=0;worldTime=0;simulation.reset();clearPressure();view.setEnabled(true);document.body.classList.add('game-active');$('game-ui').hidden=false;setView('third');render();},
  ready(){pending=false;failed=false;render();},fail(){pending=false;failed=true;render();},exit(){active=false;pending=false;clearPressure();view.setEnabled(false);$('game-ui').hidden=true;$('game-help-dialog').close();document.body.classList.remove('game-active');delete document.body.dataset.gamePhase;},
  setPaused(value){simulation.setPaused(value);if(value)clearPressure();render();},setControlMode,setView,showHelp,action,
  update(dt,input,viewer){if(!active)return;aimYaw=input.yaw??0;if(!pending&&!failed){simulation.update(dt,{...input,defend:input.defend||pressurePointers.size>0});if(!simulation.state.paused)worldTime+=Math.min(dt,.25);}
   const s=simulation.state;if(s.eventCount!==lastEvent){for(const e of s.events.filter(e=>e.id>lastEvent)){if(e.type==='goal')audio.cheer();else if(e.type==='shot'||e.type==='pass')audio.cue(1);else if(e.type==='kickoff'||e.type==='fulltime')audio.cue(0);}lastEvent=s.eventCount;}
   onCamera?.(s,perspective,dt);visualTime+=dt;if(visualTime>=(mobile?1/30:1/60)){visualTime=0;view.update(s,worldTime,viewer,{firstPerson:perspective==='first'});}uiTime+=dt;if(uiTime>.1){uiTime=0;render();}
  }
 };
}
