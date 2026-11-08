import test from 'node:test';
import assert from 'node:assert/strict';
import {shotOption} from '../dist/football-tactics.js';
import {shotReadout,shotOutcomeText,shotGuideTiming,sampleShotGuide} from '../dist/shot-feedback.js';

test('the aiming line reaches the actual assisted target and ends at first contact for an underpowered long shot',()=>{
 for(const sign of[-1,1])for(const kind of['drive','finesse','lob']){
  const ball={x:2,y:.11,z:sign*34.5},p={x:2,z:ball.z,yaw:Math.atan2(-2,sign*18),attackSign:sign};
  const shot=shotOption(p,ball,{power:.55,kind}),timing=shotGuideTiming(ball,shot),end=sampleShotGuide(ball,shot,timing.duration);
  assert.equal(timing.lands,false);assert.ok(Math.abs(end.x-shot.x)<1e-8);assert.ok(Math.abs(end.z-shot.z)<1e-8);assert.ok(Math.abs(end.y-shot.y)<1e-8);
  const longBall={x:0,y:.11,z:-sign*37.5},weak=shotOption({...p,x:0,z:longBall.z},longBall,{power:.15,kind:'drive'}),cut=shotGuideTiming(longBall,weak),landing=sampleShotGuide(longBall,weak,cut.duration);
  assert.equal(weak.limited,true);assert.equal(cut.lands,true);assert.ok(cut.duration<weak.flight);assert.ok(Math.abs(landing.y-.11)<1e-8);assert.ok(Math.abs(landing.z-longBall.z)<90);
  let previous=0;const scratch={};for(let i=0;i<=32;i++){assert.equal(sampleShotGuide(longBall,weak,cut.duration*i/32,scratch),scratch);assert.ok(Object.values(scratch).every(Number.isFinite));assert.ok(scratch.y>=.11-1e-8);const distance=Math.abs(scratch.z-longBall.z);assert.ok(distance>=previous);previous=distance;}
 }
});
test('preparation advice explains conditions without claiming a chance of scoring, including ordinary and future outcomes',()=>{
 assert.equal(shotReadout({quality:1,preparation:'balanced'}).tone,'steady');
 assert.equal(shotReadout({quality:.7,preparation:'rushed'}).tone,'caution');
 assert.equal(shotReadout({quality:.4,preparation:'backfoot'}).tone,'risk');
 assert.match(shotReadout({quality:1,preparation:'balanced',limited:true}).advice,/力量/);
 assert.match(shotOutcomeText({outcome:'short',preparation:'long-range'}),/未到门前.*远距离/);
 assert.equal(shotOutcomeText({outcome:'goal',preparation:'backfoot'}),'破门！');
 assert.ok(!shotOutcomeText({outcome:'unknown'}).includes('undefined'));
 assert.ok(!JSON.stringify(shotReadout({quality:.4,preparation:'backfoot'})).includes('%'));
});
