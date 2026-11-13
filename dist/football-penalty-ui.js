import {penaltyCanShoot,penaltyPowerRisk,penaltyTarget,safePenaltyAim} from './football-penalty.js';
import {writeHudAttribute,writeHudData,writeHudProperty} from './hud-write.js';

export const penaltyKeeperWaiting = penalty =>
  penalty?.role === 'keeper' && penalty.stage === 'ready' && penalty.keeperReady === false;

export const penaltyCanDive = penalty =>
  penalty?.role === 'keeper' && ['runup','flight'].includes(penalty.stage);

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
  return safePenaltyAim(keeper ? {x:lane(x),y:lane(y)} : {x,y});
}

export function penaltyFlick(start, end) {
  const dx = end.clientX - start.x, dy = start.y - end.clientY;
  const distance = Math.hypot(dx,dy), elapsed = end.timeStamp - start.at;
  if (!Number.isFinite(distance) || distance < 22 || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 480) return null;
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
    if (commit) onDive?.(aim);
  });
  for (const name of ['pointercancel','lostpointercapture']) element.addEventListener(name, event => {
    if (event.pointerId === start?.id) start = null;
  });
}

export function buildPenaltyControls(getElement, {onDive} = {}) {
  const panel = getElement('game-penalty-hint'), status = getElement('game-penalty-status');
  const instruction = getElement('game-penalty-instruction'), label = getElement('game-penalty-aim-label');
  const ready = getElement('game-penalty-ready'), target = getElement('game-penalty-target');
  const dive = getElement('game-penalty-dive-target'), shotDot = target.firstElementChild, diveDot = dive.firstElementChild;
  const stageLabel = getElement('game-penalty-timing'), powerBar = getElement('game-penalty-power');
  const powerValue = getElement('game-penalty-power-value'), timing = getElement('game-penalty-runup');
  const meter = getElement('game-penalty-meter'), choices = dive.querySelectorAll?.('button') ?? [];
  let aim = {x:0,y:0}, round = '', context = null, enabled = false;

  function updateAim(next) {
    aim = next;
    writeHudProperty(diveDot.style,'left',(next.x < -.25 ? 16.7 : next.x > .25 ? 83.3 : 50)+'%');
    writeHudProperty(diveDot.style,'top',(next.y < -.3 ? 83.3 : next.y > .3 ? 16.7 : 50)+'%');
    writeHudProperty(label,'textContent',penaltyAimLabel(aim));
    writeHudData(document.body,'gamePenaltyAim',`${aim.x.toFixed(2)},${aim.y.toFixed(2)}`);
  }

  function clear() {
    context = null; enabled = false; round = '';
    writeHudProperty(target,'hidden',true);
    writeHudProperty(panel,'hidden',true);
    writeHudData(document.body,'gamePenaltyAim','');
    writeHudData(document.body,'gamePenaltyStage','');
    writeHudData(document.body,'gamePenaltyReady','');
    writeHudData(document.body,'gamePenaltyCanDive','');
  }

  bindAimPointer(target,false,next => { if (enabled && context?.role === 'shooter') updateAim(next); });
  bindAimPointer(dive,true,next => { if (enabled && context?.role === 'keeper') updateAim(next); },
    onDive, () => enabled && penaltyCanDive(context));
  for (const choice of choices) choice.addEventListener('click',event => {
    if (!enabled || event.detail !== 0) return;
    const [x,y] = choice.dataset.penaltyAim.split(',').map(Number);
    updateAim({x,y});
    if (penaltyCanDive(context)) onDive?.({x,y});
  });

  return {
    get aim() { return aim; },
    clear,
    move(axis,dt) {
      if (!enabled) return;
      const next = movePenaltyAim(aim,axis,dt,context.role === 'keeper');
      if (next !== aim && (next.x !== aim.x || next.y !== aim.y)) updateAim(next);
    },
    aimFlick(next) { if (enabled && context?.role === 'shooter') updateAim(next); },
    center() { if (enabled) updateAim({x:0,y:0}); },
    render(penalty,{overlay,touch,stoppageId,power=0,committed=false}) {
      if (!penalty) { if (context) clear(); return; }
      context = penalty;
      const nextRound = [penalty.kind,penalty.team,penalty.taker,penalty.role,stoppageId,
        penalty.home?.length || 0,penalty.away?.length || 0].join('|');
      if (round !== nextRound) { round = nextRound; updateAim({x:0,y:0}); }
      const keeper = penalty.role === 'keeper', waiting = penaltyKeeperWaiting(penalty);
      const shotReady = penaltyCanShoot(penalty), canDive = penaltyCanDive(penalty);
      const showAim = keeper ? penalty.stage === 'ready' || canDive : !committed && penalty.stage === 'ready';
      const showPower = !keeper && !committed && penalty.stage === 'ready';
      const showRunup = keeper && penalty.stage === 'runup' && penalty.runupDuration > 0;
      enabled = !overlay && showAim && !committed;
      writeHudProperty(panel,'hidden',overlay);
      writeHudData(panel,'role',penalty.role);
      writeHudData(panel,'stage',penalty.stage);
      writeHudData(panel,'commit',String(committed));
      if (overlay || keeper || penalty.stage !== 'ready') writeHudProperty(target,'hidden',true);
      writeHudProperty(dive,'hidden',overlay || !keeper || !showAim);
      writeHudAttribute(dive,'aria-disabled',String(!enabled));
      for (const choice of choices) writeHudProperty(choice,'disabled',!enabled || !keeper);
      writeHudProperty(ready,'hidden',!waiting || overlay);
      writeHudProperty(label,'hidden',!showAim);
      writeHudProperty(meter,'hidden',!showPower);
      writeHudProperty(timing,'hidden',!showRunup);
      if (showPower) {
        writeHudProperty(powerBar,'value',power);
        writeHudProperty(powerValue,'textContent',power > 0 ? `${Math.round(power * 100)}%` : '');
        writeHudData(meter,'tone',power > penaltyPowerRisk ? 'risk' : power >= .46 ? 'set' : 'base');
      }
      if (showRunup) writeHudProperty(timing,'value',Math.min(1,penalty.time / penalty.runupDuration));
      writeHudData(document.body,'gamePenaltyStage',penalty.stage);
      writeHudData(document.body,'gamePenaltyReady',penalty.keeperReady ?? true);
      writeHudData(document.body,'gamePenaltyCanDive',canDive && !committed);
      const result = {goal:'点球命中',saved:'门将扑救',parried:'门将挡出',woodwork:'击中门框',wide:'射偏'};
      let title = keeper ? '你守门' : '你主罚', phase = '', hint = '';
      if (penalty.stage === 'setup') phase = '双方就位';
      else if (penalty.stage === 'result') title = result[penalty.outcome] || '点球未进';
      else if (waiting) {
        phase = '等待你确认';
        hint = touch ? '左侧摇杆横移，右侧选扑救方向' : '← → 横移，↑ ↓ 选高低，空格确认';
      } else if (penalty.stage === 'ready' && !shotReady) {
        const seconds = Math.max(1,Math.ceil((penalty.kickAllowedAt ?? 0) - (penalty.time ?? 0)));
        phase = penalty.keeperReady ? `${seconds} 秒后可射门` : '等待门将就位';
        hint = keeper ? '可以先调整站位' : '可以先选择落点';
      } else if (keeper && canDive) {
        phase = committed ? '已选择扑救' : penalty.stage === 'runup' ? '对手助跑 · 可以扑救' : '已经出脚';
        if (!committed) hint = touch ? '点按或划动下方球门扑救' : '选方向后按空格，或点击下方球门';
      } else if (keeper) {
        phase = '等待对手助跑';
        hint = touch ? '左侧摇杆横移，下方球门可预选方向' : '← → 横移，↑ ↓ 选高低，X 回中';
      } else if (penalty.stage === 'runup' || committed) phase = '主罚球员助跑';
      else if (penalty.stage === 'flight') phase = '射门已出脚';
      else if (shotReady) {
        phase = '可以射门';
        hint = touch ? '点球门瞄准，点按、长按或划动「射门」' : '点击球门或用方向键瞄准，按 K 射门';
      }
      writeHudProperty(status,'textContent',title);
      writeHudProperty(stageLabel,'textContent',phase);
      writeHudProperty(stageLabel,'hidden',!phase);
      writeHudProperty(instruction,'textContent',hint);
      writeHudProperty(instruction,'hidden',!hint);
    },
    project(project) {
      if (!enabled || context?.role !== 'shooter' || context.stage !== 'ready') {
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
      if (!visible) return;
      writeHudProperty(target.style,'left',`${Math.round(x)}px`);
      writeHudProperty(target.style,'top',`${Math.round(y)}px`);
      writeHudProperty(target.style,'width',`${Math.round(width)}px`);
      writeHudProperty(target.style,'height',`${Math.round(height)}px`);
      const landing = penaltyTarget(aim,goalZ), projectedAim = project(landing.x,landing.y,landing.z);
      writeHudProperty(shotDot.style,'left',`${Math.round(projectedAim.x-x)}px`);
      writeHudProperty(shotDot.style,'top',`${Math.round(projectedAim.y-y)}px`);
    }
  };
}
