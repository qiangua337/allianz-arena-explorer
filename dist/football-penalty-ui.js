import {penaltyCanShoot,penaltyTarget,safePenaltyAim} from './football-penalty.js';
import {writeHudData,writeHudProperty} from './hud-write.js';

export const penaltyKeeperWaiting = penalty =>
  penalty?.role === 'keeper' && penalty.stage === 'ready' && penalty.keeperReady === false;

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

function bindAimPointer(element, keeper, change) {
  let pointer = null;
  const move = event => {
    const aim = penaltyPointerAim(element, event, keeper);
    if (aim) change(aim);
  };
  element.addEventListener('pointerdown', event => {
    if (pointer !== null || event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    element.setPointerCapture?.(pointer);
    move(event);
  });
  element.addEventListener('pointermove', event => {
    if (event.pointerId === pointer) move(event);
  });
  element.addEventListener('pointerup', event => {
    if (event.pointerId !== pointer) return;
    move(event);
    pointer = null;
  });
  for (const name of ['pointercancel','lostpointercapture']) element.addEventListener(name, event => {
    if (event.pointerId === pointer) pointer = null;
  });
}

export function buildPenaltyControls(getElement) {
  const panel = getElement('game-penalty-hint'), status = getElement('game-penalty-status');
  const instruction = getElement('game-penalty-instruction'), label = getElement('game-penalty-aim-label');
  const ready = getElement('game-penalty-ready'), target = getElement('game-penalty-target');
  const dive = getElement('game-penalty-dive-target'), shotDot = target.firstElementChild, diveDot = dive.firstElementChild;
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
  }

  bindAimPointer(target,false,next => { if (enabled && context?.role === 'shooter') updateAim(next); });
  bindAimPointer(dive,true,next => { if (enabled && context?.role === 'keeper') updateAim(next); });

  return {
    get aim() { return aim; },
    clear,
    move(axis,dt) {
      if (!enabled) return;
      const next = movePenaltyAim(aim,axis,dt,context.role === 'keeper');
      if (next !== aim && (next.x !== aim.x || next.y !== aim.y)) updateAim(next);
    },
    center() { if (enabled) updateAim({x:0,y:0}); },
    render(penalty,{overlay,touch,stoppageId}) {
      if (!penalty) { if (context) clear(); return; }
      context = penalty;
      const nextRound = [penalty.kind,penalty.team,penalty.taker,penalty.role,stoppageId,
        penalty.home?.length || 0,penalty.away?.length || 0].join('|');
      if (round !== nextRound) { round = nextRound; updateAim({x:0,y:0}); }
      const keeper = penalty.role === 'keeper', waiting = penaltyKeeperWaiting(penalty);
      const shotReady = penaltyCanShoot(penalty), active = ['ready','flight'].includes(penalty.stage);
      const showAim = penalty.stage === 'ready' || keeper && penalty.stage === 'flight';
      enabled = !overlay && showAim;
      writeHudProperty(panel,'hidden',overlay);
      if (overlay || keeper || penalty.stage !== 'ready') writeHudProperty(target,'hidden',true);
      writeHudProperty(dive,'hidden',!enabled || !keeper);
      writeHudProperty(ready,'hidden',!waiting || overlay);
      writeHudProperty(label,'hidden',!showAim);
      writeHudData(document.body,'gamePenaltyStage',penalty.stage);
      writeHudData(document.body,'gamePenaltyReady',penalty.keeperReady ?? true);
      const result = {goal:'点球命中',saved:'门将扑救',parried:'门将挡出',woodwork:'击中门框',wide:'射偏'};
      let title = keeper ? '你守门' : '你主罚', hint = '';
      if (penalty.stage === 'setup') hint = '双方正在就位';
      else if (penalty.stage === 'result') title = result[penalty.outcome] || '点球未进';
      else if (keeper && waiting) hint = touch ? '可先横移或点选扑救方向' : '← → 横移，↑ ↓ 选高低；准备好后按空格';
      else if (!shotReady && penalty.stage === 'ready') hint = penalty.keeperReady
        ? `${Math.max(1,Math.ceil((penalty.kickAllowedAt ?? 0) - (penalty.time ?? 0)))} 秒后可射门`
        : '等待门将就位，可先选择落点';
      else if (keeper && active) hint = touch ? '点选方向，看准来球后点「扑救」' : '← → 横移，↑ ↓ 选高低，空格扑救 · X 回中';
      else if (penalty.stage === 'flight') hint = '射门已出脚';
      else if (active) hint = touch ? '点球门选落点，按住「射门」后松手' : '点击球门或用方向键瞄准，按住 K 蓄力 · X 回中';
      writeHudProperty(status,'textContent',title);
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
