import test from 'node:test';
import assert from 'node:assert/strict';
import {footballInput,footballCamera,matchTime,ballDirection} from '../dist/football-controls.js';

test('camera-relative football movement rotates correctly without diagonal speed gain',()=>{
 assert.deepEqual(footballInput({forward:1}),{x:0,z:-1,sprint:false,defend:false});
 const west=footballInput({forward:1,yaw:Math.PI/2});assert.ok(Math.abs(west.x+1)<1e-8&&Math.abs(west.z)<1e-8);
 const diagonal=footballInput({forward:1,side:1,sprint:true});assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-8);assert.equal(diagonal.sprint,true);
 const partial=footballInput({forward:.25,side:.1});assert.ok(Math.abs(Math.hypot(partial.x,partial.z)-Math.hypot(.25,.1))<1e-8);
});
test('first-person stays at player eye height while the third-person camera follows the player rather than the ball',()=>{
 const p={x:20,z:-30},first=footballCamera(p,{view:'first',yaw:1.2,pitch:-.3}),third=footballCamera(p,{view:'third',yaw:0});assert.deepEqual(first.position,[20,1.68,-30]);assert.equal(first.yaw,1.2);assert.equal(first.pitch,-.3);assert.equal(first.target,null);
 assert.ok(third.position[1]>4&&third.position[1]<9);assert.equal(third.position[0],p.x);assert.ok(third.position[2]>p.z);assert.ok(third.target[2]<p.z);
 const moved=footballCamera({x:p.x+5,z:p.z-7},{view:'third',yaw:0});assert.ok(Math.abs(moved.position[0]-third.position[0]-5)<1e-8);assert.ok(Math.abs(moved.position[2]-third.position[2]+7)<1e-8);
 for(const yaw of[-9,0,4,99])for(const pitch of[-20,0,20]){const pose=footballCamera(p,{view:'third',yaw,pitch});assert.ok(pose.position.every(Number.isFinite));assert.ok(pose.position[1]>=3.5);}
});
test('the match clock clamps at full time and the ball compass is relative to the current camera',()=>{
 assert.equal(matchTime({duration:180,elapsed:0}),'03:00');assert.equal(matchTime({duration:180,elapsed:120.2}),'01:00');assert.equal(matchTime({duration:180,elapsed:181}),'00:00');
 const p={x:0,z:0};assert.equal(ballDirection(p,{x:0,z:-10},0),'前方 ↑ 10 m');assert.equal(ballDirection(p,{x:0,z:10},0),'后方 ↓ 10 m');assert.equal(ballDirection(p,{x:10,z:0},0),'右侧 → 10 m');assert.equal(ballDirection(p,{x:10,z:0},Math.PI),'← 左侧 10 m');
});
