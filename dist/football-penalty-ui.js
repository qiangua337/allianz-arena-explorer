import {penaltyCanChooseDive,penaltyCanShoot,penaltyPowerRisk,penaltyTarget,safePenaltyAim} from './football-penalty.js';
import {writeHudAttribute,writeHudData,writeHudProperty} from './hud-write.js';

export const penaltyKeeperWaiting = penalty =>
  penalty?.role === 'keeper' && penalty.stage === 'ready' && penalty.keeperReady === false;

export function renderPenaltyScore(getElement,shootout,opponent) {
  const panel = getElement('game-penalty-score');
  writeHudProperty(panel,'hidden',!shootout);
  if (!shootout) return;
  const {home,away,team,stage} = shootout;
  const attempts = Math.max(home.length,away.length);
  const complete = stage === 'result' || !!shootout.winner;
  const round = complete ? attempts : Math.min(home.length,away.length) + 1;
  const offset = Math.max(0,round - 5);
  writeHudProperty(getElement('game-penalty-round'),'textContent',`第 ${round} 轮`);
  writeHudAttribute(panel,'aria-label',`点球大战 · 第 ${round} 轮 · 拜仁 ${home.filter(Boolean).length} · ${opponent} ${away.filter(Boolean).length}`);
  for (const [side,results] of Object.entries({home,away})) {
    for (let slot=0; slot<5; slot++) {
      const attempt = offset + slot;
      const result = results[attempt];
      const status = result === true ? 'goal' : result === false ? 'miss' :
        !complete && side === team && attempt === results.length ? 'next' : '';
      writeHudData(getElement(`game-penalty-${side}-${slot}`),'result',status);
    }
  }
}

export function penaltyAimLabel(aim) {
  const side = aim.x < -.25 ? '左路' : aim.x > .25 ? '右路' : '中路';
  const height = aim.y < -.3 ? '低位' : aim.y > .3 ? '高位' : '中位';
  return side + ' · ' + height;
}

export function movePenaltyAim(aim, axis, dt, keeper) {
  if (!axis) return aim;
  const movingSide = Math.abs(axis.x) > .09, movingHeight = Math.abs(axis.y) > .09;
  if (!movingSide && !movingHeight) return aim;
  return safePenaltyAim({
    x: movingSide ? keeper ? Math.sign(axis.x) : aim.x + axis.x * dt * 2.6 : aim.x,
    y: movingHeight ? keeper ? Math.sign(axis.y) : aim.y + axis.y * dt * 2.6 : aim.y
  });
}

function penaltyPointerAim(element, event, keeper) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (event.clientX - rect.left) / rect.width * 2 - 1;
  const y = 1 - (event.clientY - rect.top) / rect.height * 2;
  const lane = value => Math.abs(value) > 1/3 ? Math.sign(value) : 0;
  return safePenaltyAim(keeper ? {x:lane(x),y:0} : {x,y});
}

export function penaltyFlick(start, end, maxDuration = 480) {
  const dx = end.clientX - start.x, dy = start.y - end.clientY;
  const distance = Math.hypot(dx,dy), elapsed = end.timeStamp - start.at;
  if (!Number.isFinite(distance) || distance < 22 || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > maxDuration) return null;
  const length = Math.max(34,Math.abs(dx),Math.abs(dy));
  const speed = distance / Math.max(65,elapsed);
  return {
    aim:safePenaltyAim({x:dx / length,y:dy / length}),
    power:Math.min(.94,.44 + speed * .35)
  };
}

function bindAimPointer(element, keeper, change, onDive, canDive) {
  let start = null;
  element.addEventListener('pointerdown', event => {
    if (start || event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    start = {id:event.pointerId,x:event.clientX,y:event.clientY,at:event.timeStamp,canDive:canDive?.()};
    element.setPointerCapture?.(start.id);
    const aim = penaltyPointerAim(element,event,keeper);
    if (aim) change(aim);
  });
  element.addEventListener('pointermove', event => {
    if (event.pointerId !== start?.id || keeper) return;
    const aim = penaltyPointerAim(element,event,false);
    if (aim) change(aim);
  });
  element.addEventListener('pointerup', event => {
    if (event.pointerId !== start?.id) return;
    const commit = start.canDive && canDive?.();
    const flick = keeper ? penaltyFlick(start,event) : null;
    const lane = value => Math.abs(value) >= .3 ? Math.sign(value) : 0;
    const aim = flick ? {x:lane(flick.aim.x),y:lane(flick.aim.y)} : penaltyPointerAim(element,event,keeper);
    start = null;
    if (!aim) return;
    change(aim);
    if (commit) onDive?.(aim,event.pointerType);
  });
  for (const name of ['pointercancel','lostpointercapture']) element.addEventListener(name, event => {
    if (event.pointerId === start?.id) start = null;
  });
}

export function buildPenaltyControls(getElement, {onDive,onQuickShot} = {}) {
  const panel = getElement('game-penalty-hint'), status = getElement('game-penalty-status');
  const instruction = getElement('game-penalty-instruction'), label = getElement('game-penalty-aim-label');
  const ready = getElement('game-penalty-ready'), target = getElement('game-penalty-target');
  const dive = getElement('game-penalty-dive-target'), shots = getElement('game-penalty-shot-choices');
  const shotDot = target.firstElementChild;
  const stageLabel = getElement('game-penalty-timing'), powerBar = getElement('game-penalty-power');
  const powerValue = getElement('game-penalty-power-value'), timing = getElement('game-penalty-runup');
  const meter = getElement('game-penalty-meter');
  const directions = ['left','center','right'];
  const diveButtons = directions.map(direction=>getElement('game-penalty-dive-'+direction));
  const shotButtons = directions.map(direction=>getElement('game-penalty-shot-'+direction));
  let aim = {x:0,y:0}, selectedDive = null, showSelectedDive = false, round = '', context = null, enabled = false;
  let swipeAim = null, reticleProjection = null;

  function updateAim(next) {
    aim = next;
    refreshAim();
  }

  function refreshAim() {
    const queued = showSelectedDive && context?.role === 'keeper' ? selectedDive : null;
    const displayedAim = swipeAim ?? aim;
    writeHudData(document.body,'gamePenaltyAim',`${displayedAim.x.toFixed(2)},${displayedAim.y.toFixed(2)}`);
    writeHudProperty(label,'textContent',penaltyAimLabel(queued ?? displayedAim));
    diveButtons.forEach((button,index)=>{
      const chosen = queued?.x === index-1;
      writeHudAttribute(button,'aria-pressed',String(chosen));
    });
    drawReticle(displayedAim);
  }

  function drawReticle(displayedAim) {
    if (!reticleProjection || !enabled || context?.role !== 'shooter') return;
    const {project,left,top} = reticleProjection;
    const landing = penaltyTarget(displayedAim,context.goalZ);
    const projectedAim = project(landing.x,landing.y,landing.z);
    writeHudProperty(shotDot.style,'left',`${Math.round(projectedAim.x-left)}px`);
    writeHudProperty(shotDot.style,'top',`${Math.round(projectedAim.y-top)}px`);
  }

  function showPowerValue(power) {
    writeHudProperty(powerBar,'value',power);
    writeHudProperty(powerValue,'textContent',`${Math.round(power * 100)}%`);
    writeHudData(meter,'tone',power > penaltyPowerRisk ? 'risk' : power >= .46 ? 'set' : 'base');
  }

  function chooseDive(next,pointerType) {
    if (!enabled || context?.role !== 'keeper' || !penaltyCanChooseDive(context)) return false;
    return onDive?.(next,pointerType) ?? false;
  }

  function quickDirection(direction,pointerType) {
    if (!enabled) return false;
    if (context.role === 'keeper') return chooseDive({x:direction,y:0},pointerType);
    if (!penaltyCanShoot(context)) return false;
    const next = {x:direction*.84,y:-.25};
    updateAim(next);
    return onQuickShot?.(next,pointerType) ?? false;
  }

  function clear() {
    context = null; enabled = false; round = ''; selectedDive = null; showSelectedDive = false;
    swipeAim = null; reticleProjection = null;
    writeHudProperty(target,'hidden',true);
    writeHudProperty(panel,'hidden',true);
    writeHudData(target,'swiping','false');
    writeHudData(document.body,'gamePenaltyAim','');
    writeHudData(document.body,'gamePenaltyStage','');
    writeHudData(document.body,'gamePenaltyReady','');
    writeHudData(document.body,'gamePenaltyCanDive','');
  }

  bindAimPointer(target,false,next => { if (enabled && context?.role === 'shooter') updateAim(next); });
  bindAimPointer(dive,true,()=>{},chooseDive,()=>enabled && context?.role === 'keeper' && penaltyCanChooseDive(context));
  diveButtons.forEach((button,index)=>{
    button.addEventListener('click',event=>{ if (event.detail===0) quickDirection(index-1); });
  });
  shotButtons.forEach((button,index)=>{
    button.addEventListener('click',event=>{
      const pointer = event.pointerType || (event.detail > 0 && event.sourceCapabilities?.firesTouchEvents ? 'touch' : null);
      quickDirection(index-1,pointer);
    });
  });

  return {
    get aim() { return aim; },
    quickDirection,
    recordDive(next) { selectedDive = next; updateAim(next); },
    clear,
    move(axis,dt) {
      if (!enabled) return;
      const next = movePenaltyAim(aim,axis,dt,context.role === 'keeper');
      if (next !== aim && (next.x !== aim.x || next.y !== aim.y)) updateAim(next);
    },
    aimFlick(next) { if (enabled && context?.role === 'shooter') updateAim(next); },
    previewSwipe(next,power) {
      const preview = enabled && context?.role === 'shooter' ? next : null;
      if (!preview && !swipeAim) return;
      swipeAim = preview?.aim ?? null;
      writeHudData(target,'swiping',!!swipeAim);
      if (Number.isFinite(power)) showPowerValue(power);
      refreshAim();
    },
    center() { if (enabled) updateAim({x:0,y:0}); },
    render(penalty,{overlay,touch,stoppageId,power=0,committed=false,pendingDive=false}) {
      if (!penalty) { if (context) clear(); return; }
      context = penalty;
      const nextRound = [penalty.kind,penalty.team,penalty.taker,penalty.role,stoppageId,
        penalty.home?.length || 0,penalty.away?.length || 0].join('|');
      if (round !== nextRound) {
        round = nextRound;
        selectedDive = null;
        swipeAim = null;
        reticleProjection = null;
        writeHudData(target,'swiping','false');
        updateAim({x:0,y:0});
      }
      const keeper = penalty.role === 'keeper', waiting = penaltyKeeperWaiting(penalty);
      const shotReady = penaltyCanShoot(penalty), canDive = keeper && penaltyCanChooseDive(penalty);
      const showAim = keeper ? canDive : !committed && penalty.stage === 'ready';
      const showPower = !keeper && !committed && penalty.stage === 'ready' && power > 0;
      const showRunup = keeper && penalty.stage === 'runup' && penalty.runupDuration > 0;
      enabled = !overlay && showAim && !committed;
      showSelectedDive = keeper && (penalty.diveQueued || pendingDive || committed);
      writeHudProperty(panel,'hidden',overlay);
      writeHudData(panel,'role',penalty.role);
      writeHudData(panel,'stage',penalty.stage);
      writeHudData(panel,'commit',String(committed));
      if (overlay || keeper || penalty.stage !== 'ready') {
        reticleProjection = null;
        writeHudProperty(target,'hidden',true);
      }
      writeHudProperty(dive,'hidden',overlay || !keeper || !showAim);
      writeHudProperty(shots,'hidden',overlay || keeper || !shotReady || committed || showPower);
      writeHudAttribute(dive,'aria-disabled',String(!enabled));
      for (const button of diveButtons) writeHudProperty(button,'disabled',!enabled || !keeper);
      for (const button of shotButtons) writeHudProperty(button,'disabled',!enabled || keeper || !shotReady || showPower);
      writeHudProperty(ready,'hidden',!waiting || overlay);
      writeHudProperty(label,'hidden',!showAim);
      refreshAim();
      writeHudProperty(meter,'hidden',!showPower);
      writeHudProperty(timing,'hidden',!showRunup);
      if (showPower) showPowerValue(power);
      if (showRunup) writeHudProperty(timing,'value',Math.min(1,penalty.time / penalty.runupDuration));
      writeHudData(document.body,'gamePenaltyStage',penalty.stage);
      writeHudData(document.body,'gamePenaltyReady',penalty.keeperReady ?? true);
      writeHudData(document.body,'gamePenaltyCanDive',canDive && !committed);
      const result = {
        goal:keeper ? '对手罚进' : '点球命中',
        saved:keeper ? '你扑出了点球' : '点球被扑出',
        parried:keeper ? '你挡出了点球' : '点球被挡出',
        woodwork:'击中门框',
        wide:'射偏'
      };
      let title = keeper ? '你守门' : '你主罚', phase = '', hint = '';
      if (penalty.stage === 'setup') phase = '双方就位';
      else if (penalty.stage === 'result') title = result[penalty.outcome] || '点球未进';
      else if (waiting) {
        phase = pendingDive ? '已选方向 · 正在确认' : '选方向即可准备';
        if (!pendingDive) hint = touch ? '选方向后，出脚时自动扑救' : '按 1 / 2 / 3 选扑救方向，或点「我准备好了」';
      } else if (penalty.stage === 'ready' && !shotReady) {
        const seconds = Math.max(1,Math.ceil((penalty.kickAllowedAt ?? 0) - (penalty.time ?? 0)));
        phase = penalty.keeperReady ? `${seconds} 秒后可射门` : '等待门将就位';
        hint = keeper ? showSelectedDive ? '已选方向 · 可以更改' : '可提前选择扑救方向' : '可以先选择落点';
      } else if (penalty.stage === 'flight' && penalty.contactOutcome) {
        phase = penalty.contactOutcome === 'woodwork' ? '击中门框 · 等待结果' : '扑到球 · 等待结果';
      } else if (keeper && canDive) {
        if (penalty.stage === 'ready') phase = showSelectedDive ? '扑救方向已选' : '等待对手助跑';
        else if (penalty.stage === 'runup') phase = committed ? '方向已锁定' : '对手助跑';
        else phase = committed ? '正在扑救' : '对手出脚';
        if (!committed) hint = touch ? '点方向扑救 · 划动可选高低' : '1 / 2 / 3 扑救 · 方向键和空格可选高低';
      } else if (penalty.stage === 'runup' || committed) phase = '主罚球员助跑';
      else if (penalty.stage === 'flight') phase = '射门已出脚';
      else if (shotReady) {
        phase = '可以射门';
        hint = showPower ? '松手射门' : touch ? '点方向射门 · 划动「射门」可瞄准' : '1 / 2 / 3 快速射门 · 方向键瞄准，K 射门';
      }
      writeHudProperty(status,'textContent',title);
      writeHudProperty(stageLabel,'textContent',phase);
      writeHudProperty(stageLabel,'hidden',!phase);
      writeHudProperty(instruction,'textContent',hint);
      writeHudProperty(instruction,'hidden',!hint);
    },
    project(project) {
      if (!enabled || context?.role !== 'shooter' || context.stage !== 'ready') {
        reticleProjection = null;
        writeHudProperty(target,'hidden',true);
        return;
      }
      const {goalZ} = context;
      const upper = penaltyTarget({x:-1,y:1},goalZ), lower = penaltyTarget({x:1,y:-1},goalZ);
      const {x,y,z} = project(upper.x,upper.y,upper.z);
      const bottomRight = project(lower.x,lower.y,lower.z);
      const width = bottomRight.x - x, height = bottomRight.y - y;
      const visible = z >= -1 && z <= 1 && width > 24 && height > 12;
      writeHudProperty(target,'hidden',!visible);
      reticleProjection = visible ? {project,left:x,top:y} : null;
      if (!visible) return;
      writeHudProperty(target.style,'left',`${Math.round(x)}px`);
      writeHudProperty(target.style,'top',`${Math.round(y)}px`);
      writeHudProperty(target.style,'width',`${Math.round(width)}px`);
      writeHudProperty(target.style,'height',`${Math.round(height)}px`);
      drawReticle(swipeAim ?? aim);
    }
  };
}
