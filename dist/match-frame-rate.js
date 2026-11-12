const rates = [120, 90, 75, 60, 45, 30];
const minScale = {standard: .68, low: .78, high: 1};
const snapScale = value => Math.round(value * 100) / 100;
const SCALE_RETRY_WINDOWS = 16;

function availableRate(cap, rafFps) {
 return rates.find(rate => rate <= cap && rafFps >= rate * .94) ?? 30;
}

// Samples come from the active match, not from the fixed-step simulation.
// The browser's callback rate may be the display ceiling or a busy main
// thread. Use render work to distinguish an inexpensive display limit from
// a scene that first needs fewer pixels, then let spare callbacks reopen it.
export function createMatchFrameRate(options = {}) {
 let cap, quality, current, goodSamples, limitedSamples, slowSamples, hold, retryDelay, mobile, native120, observedRate;
 let trialScale, scaleRetry, settleSamples, quickRecoveryAvailable, quickRecoverySamples;

 function publish(rate, scale) {
  if(current&&current.rate!==rate){trialScale=null;quickRecoverySamples=0;}
  if (!current || rate !== current.rate || scale !== current.scale) {
   current = Object.freeze({rate, scale});
  }
  return current;
 }

 function reset({cap: requestedCap = cap ?? 120, quality: requestedQuality = quality ?? 'standard', mobile: small = mobile ?? false, online = false} = {}) {
  cap = requestedCap === 120 ? 120 : 60;
  quality = Object.hasOwn(minScale, requestedQuality) ? requestedQuality : 'standard';
  mobile=small;native120=false;observedRate=0;goodSamples = limitedSamples = slowSamples = hold = 0;
  retryDelay = 3;
  quickRecoveryAvailable = small && online;
  quickRecoverySamples = 0;
  trialScale = null;
  scaleRetry = settleSamples = 0;
  return publish(cap, mobile&&cap===120&&quality!=='high'?.90:1);
 }

 function interrupt(){
  goodSamples = limitedSamples = slowSamples = quickRecoverySamples = 0;
  settleSamples = 1;
 }

 function update({rafFps, renderFps, frameMs, gap95, rafGap95, active = true} = {}) {
  if (!active || !Number.isFinite(rafFps) || !Number.isFinite(renderFps) || rafFps <= 0 || renderFps <= 0) {
   goodSamples = limitedSamples = slowSamples = quickRecoverySamples = 0;
   return current;
  }
  if(settleSamples>0){settleSamples--;return current;}
  const {rate, scale} = current;
  if(rafFps>=117&&rafFps<=123&&rafGap95<=10)native120=true;
  const possible = availableRate(cap, rafFps);
  const steadyCallbacks = Number.isFinite(rafGap95) ? rafGap95 <= 1000 / possible * 1.3 : Math.abs(rafFps - possible) <= 4;
  if (rafFps >= possible * .96 && steadyCallbacks) {
   observedRate = Math.max(observedRate, possible);
  }
  const hasTiming = Number.isFinite(frameMs) && frameMs >= 0;
  const cheap = hasTiming && frameMs < 1000 / rate * .66;
  // GPU backpressure can halve the callback rate while CPU submission is
  // still cheap. Only treat it as a display limit if we have not measured a
  // faster cadence during this match.
  const displayLimited = possible < rate && possible >= observedRate && (!native120||possible===60||possible===30) && cheap && Math.abs(rafFps - renderFps) <= 3 && Math.abs(rafFps - possible) <= 4;
  limitedSamples = displayLimited ? limitedSamples + 1 : 0;
  if (hold > 0) hold--;
  if (scaleRetry > 0) scaleRetry--;

  if (displayLimited) {
   goodSamples = slowSamples = quickRecoverySamples = 0;
   if (limitedSamples < 2) return current;
   limitedSamples = 0;
   hold = 2;
   return publish(possible, scale);
  }

  const uneven=Number.isFinite(gap95)&&gap95>1000/rate*1.65;
  if (renderFps < rate * .89 || uneven&&renderFps<rate*.97) {
   goodSamples = quickRecoverySamples = 0;
   if(++slowSamples<2&&renderFps>=rate*.78)return current;
   slowSamples=0;
   const floor = minScale[quality];
   if (scale > floor) {
    if(trialScale?.rate===rate){
     const safeScale=trialScale.previous;
     trialScale=null;
     scaleRetry=SCALE_RETRY_WINDOWS;
     return publish(rate,safeScale);
    }
    const drop = renderFps < rate * .75 ? .13 : .08;
    return publish(rate, snapScale(Math.max(floor, scale - drop)));
   }
   // A confirmed 120 Hz source can pace evenly at 60/30. At 90 it
   // alternates 8 and 17 ms intervals, which looks like periodic hitching.
   const lower = native120&&rate>60?60:native120&&rate===60?30:rates[rates.indexOf(rate) + 1];
   if (lower === undefined) return current;
   retryDelay = Math.min(10, retryDelay + 2);
   hold = retryDelay;
   return publish(native120?lower:Math.min(lower, possible), scale);
  }

  slowSamples=0;
  const stable = !uneven&&renderFps >= rate * .95 && (!hasTiming || frameMs < 1000 / rate * .82);
  goodSamples = stable ? goodSamples + 1 : 0;
  if(trialScale?.rate===rate&&goodSamples>=4)trialScale=null;

  // A temporary main-thread stall can lower the draw cap even after display
  // callbacks recover. Give mobile online play one early 60 Hz probe if two
  // windows have both steady callbacks and enough CPU time for a 60 Hz draw.
  const recoveredCallbacks = possible >= 60 && observedRate >= 60 && steadyCallbacks;
  const canRecoverQuickly = quickRecoveryAvailable && rate < 60 && recoveredCallbacks && stable && hasTiming && frameMs <= 8.5;
  quickRecoverySamples = canRecoverQuickly ? quickRecoverySamples + 1 : 0;
  if (quickRecoverySamples >= 2) {
   quickRecoveryAvailable = false;
   hold = 0;
   goodSamples = 0;
   return publish(60, scale);
  }
  if (hold || !stable) return current;

  // Faster modes get the first opportunity to spend the regained headroom.
  // Probe one cadence at a time after a fall, with a longer hold on retries.
  if (possible > rate && goodSamples >= 3) {
   goodSamples = 0;
   const next=native120?(rate<60?60:120):rates[rates.indexOf(rate) - 1];
   if(possible>=next)return publish(next, scale);
   if(native120)return current;
   return publish(possible,scale);
  }
  if (possible <= rate && scale < 1 && !scaleRetry && goodSamples >= 5) {
   goodSamples = 0;
   trialScale={rate,previous:scale};
   return publish(rate, snapScale(Math.min(1, scale + .05)));
  }
  return current;
 }

 reset(options);
 return {reset, interrupt, update, get state() { return current; }};
}
