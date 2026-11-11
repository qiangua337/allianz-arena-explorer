import assert from 'node:assert/strict';
import test from 'node:test';
import {createMatchFrameRate} from '../dist/match-frame-rate.js';
import {createFramePacer} from '../dist/frame-pacing.js';

function sample(controller, rafFps, renderFps, frameMs, windows = 1) {
 for (let i = 0; i < windows; i++) controller.update({rafFps, renderFps, frameMs});
 return controller.state;
}

test('a 120 FPS preference runs at the available 60 or 90 Hz without blurring a cheap scene', () => {
 for (const refresh of [59, 60, 75, 89, 90]) {
  const pace = createMatchFrameRate({cap:120});
  assert.deepEqual(pace.state, {rate:120, scale:1});
  assert.equal(sample(pace, refresh, refresh, 3).rate, 120, 'one sample is not enough');
  const expected = {rate:refresh < 70 ? 60 : refresh < 80 ? 75 : 90, scale:1};
  assert.deepEqual(sample(pace, refresh, refresh, 3), expected);
  assert.deepEqual(sample(pace, refresh, refresh, 3, 12), expected);
 }
});

test('a mobile high refresh session starts with headroom and ignores a single missed-frame burst',()=>{
 const pace=createMatchFrameRate({cap:120,mobile:true});
 assert.equal(pace.state.scale,.9);
 const good={rafFps:120,renderFps:120,frameMs:4,gap95:9,rafGap95:9};
 const spike={...good,renderFps:104,gap95:17};
 assert.deepEqual(pace.update(spike),{rate:120,scale:.9});
 assert.deepEqual(pace.update(good),{rate:120,scale:.9});
 assert.deepEqual(pace.update(spike),{rate:120,scale:.9});
 assert.equal(pace.update(spike).scale,.82);
});

test('confirmed 120 Hz falls back to a uniform 60 cadence instead of alternating short and long frames',()=>{
 const pace=createMatchFrameRate({cap:120,quality:'high',mobile:true});
 const sample={rafFps:120,renderFps:103,frameMs:8,gap95:17,rafGap95:9};
 assert.equal(pace.update(sample).rate,120);
 assert.equal(pace.update(sample).rate,60);
 const draw=createFramePacer(),times=[];
 for(let i=0;i<120;i++)if(draw.ready(i/120,pace.state.rate,.0007))times.push(i);
 assert.equal(times.length,60);
 assert.ok(times.slice(1).every((frame,i)=>frame-times[i]===2));
});

test('slow rendering sheds pixels before stepping down, then regains speed before sharpness', () => {
 const pace = createMatchFrameRate({cap:120});
 assert.deepEqual(sample(pace, 118, 75, 10), {rate:120, scale:.87});
 assert.deepEqual(sample(pace, 117, 74, 10, 2), {rate:120, scale:.68});
 assert.deepEqual(sample(pace, 117, 77, 10), {rate:90, scale:.68});
 assert.deepEqual(sample(pace, 120, 90, 4, 4), {rate:90, scale:.68});
 assert.deepEqual(sample(pace, 120, 90, 4), {rate:120, scale:.68});
 assert.deepEqual(sample(pace, 120, 120, 4, 4), {rate:120, scale:.68});
 assert.deepEqual(sample(pace, 120, 120, 4), {rate:120, scale:.73});
});

test('the 60 FPS cap, quality settings and pause windows bound the adaptive controller', () => {
 const pace = createMatchFrameRate({cap:60, quality:'high'});
 assert.deepEqual(sample(pace, 144, 60, 4, 9), {rate:60, scale:1});
 assert.deepEqual(pace.update({rafFps:2, renderFps:1, frameMs:500, active:false}), {rate:60, scale:1});
 assert.deepEqual(sample(pace, 45, 45, 15), {rate:45, scale:1}, 'high detail retains native scale');
 assert.deepEqual(pace.reset({cap:120, quality:'low'}), {rate:120, scale:1});
 assert.deepEqual(sample(pace, 30, 30, 20, 2), {rate:120, scale:.78});
 assert.deepEqual(sample(pace, 30, 30, 20), {rate:30, scale:.78});
 assert.deepEqual(pace.update({rafFps:0, renderFps:0}), {rate:30, scale:.78});
});

test('rate recovery waits longer after a repeated failed probe', () => {
 const pace = createMatchFrameRate({cap:120, quality:'high'});
 assert.equal(sample(pace, 120, 87, 10).rate, 90);
 assert.equal(sample(pace, 120, 90, 4, 5).rate, 120);
 assert.equal(sample(pace, 120, 87, 10).rate, 90);
 assert.equal(sample(pace, 120, 90, 4, 6).rate, 90);
 assert.equal(sample(pace, 120, 90, 4).rate, 120);
});

test('real draw deadlines sustain the selected ceiling on 60 and 120 Hz callback streams', () => {
 for (const [refresh, cap, expected] of [[60,120,60], [120,120,120], [120,60,60]]) {
  const pace = createMatchFrameRate({cap});
  const draw = createFramePacer();
  let lastDrawCount = 0;
  for (let window = 0; window < 6; window++) {
   let rendered = 0;
   const frames = refresh * 2;
   for (let frame = 1; frame <= frames; frame++) {
    const callback = window * 2 + frame / refresh + (frame % 4 === 1 ? .0002 : 0);
    if (draw.ready(callback, pace.state.rate, .0007)) rendered++;
   }
   lastDrawCount = rendered;
   pace.update({rafFps:refresh, renderFps:rendered / 2, frameMs:2});
  }
  assert.equal(pace.state.rate, expected);
  assert.ok(Math.abs(lastDrawCount - expected * 2) <= 1, `${refresh} Hz, cap ${cap}: ${lastDrawCount} draws`);
 }
});
