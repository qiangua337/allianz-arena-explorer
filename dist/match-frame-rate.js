const rates = [120, 90, 75, 60, 45, 30];
const minScale = {standard: .68, low: .78, high: 1};
const snapScale = value => Math.round(value * 100) / 100;

function availableRate(cap, rafFps) {
 return rates.find(rate => rate <= cap && rafFps >= rate * .94) ?? 30;
}

// Samples come from the active match, not from the fixed-step simulation.
// The browser's callback rate may be the display ceiling or a busy main
// thread. Use render work to distinguish an inexpensive display limit from
// a scene that first needs fewer pixels, then let spare callbacks reopen it.
export function createMatchFrameRate(options = {}) {
 let cap, quality, current, goodSamples, limitedSamples, slowSamples, hold, retryDelay, mobile, native120;

 function publish(rate, scale) {
  if (!current || rate !== current.rate || scale !== current.scale) {
   current = Object.freeze({rate, scale});
  }
  return current;
 }

 function reset({cap: requestedCap = cap ?? 120, quality: requestedQuality = quality ?? 'standard', mobile: small = mobile ?? false} = {}) {
  cap = requestedCap === 120 ? 120 : 60;
  quality = Object.hasOwn(minScale, requestedQuality) ? requestedQuality : 'standard';
  mobile=small;native120=false;goodSamples = limitedSamples = slowSamples = hold = 0;
  retryDelay = 3;
  return publish(cap, mobile&&cap===120&&quality!=='high'?.90:1);
 }

 function update({rafFps, renderFps, frameMs, gap95, rafGap95, active = true} = {}) {
  if (!active || !Number.isFinite(rafFps) || !Number.isFinite(renderFps) || rafFps <= 0 || renderFps <= 0) {
   goodSamples = limitedSamples = slowSamples = 0;
   return current;
  }
  const {rate, scale} = current;
  if(rafFps>=117&&rafFps<=123&&rafGap95<=10)native120=true;
  const possible = availableRate(cap, rafFps);
  const hasTiming = Number.isFinite(frameMs) && frameMs >= 0;
  const cheap = hasTiming && frameMs < 1000 / rate * .66;
  const displayLimited = possible < rate && (!native120||possible===60||possible===30) && cheap && Math.abs(rafFps - renderFps) <= 3 && Math.abs(rafFps - possible) <= 4;
  limitedSamples = displayLimited ? limitedSamples + 1 : 0;
  if (hold > 0) hold--;

  if (displayLimited) {
   goodSamples = slowSamples = 0;
   if (limitedSamples < 2) return current;
   limitedSamples = 0;
   hold = 2;
   return publish(possible, scale);
  }

  const uneven=Number.isFinite(gap95)&&gap95>1000/rate*1.65;
  if (renderFps < rate * .89 || uneven&&renderFps<rate*.97) {
   goodSamples = 0;
   if(++slowSamples<2&&renderFps>=rate*.78)return current;
   slowSamples=0;
   const floor = minScale[quality];
   if (scale > floor) {
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
  if (possible <= rate && scale < 1 && goodSamples >= 5) {
   goodSamples = 0;
   return publish(rate, snapScale(Math.min(1, scale + .05)));
  }
  return current;
 }

 reset(options);
 return {reset, update, get state() { return current; }};
}
