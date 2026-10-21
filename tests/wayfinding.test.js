import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeBearing,waypointReached,movementInstruction} from '../dist/wayfinding.js';

test('navigation arrows point right and left relative to the current view',()=>{
 const p={x:0,y:0,z:0};
 assert.equal(relativeBearing(p,0,{x:10,z:0}),Math.PI/2);
 assert.equal(relativeBearing(p,0,{x:-10,z:0}),-Math.PI/2);
 assert.equal(relativeBearing(p,0,{x:0,z:-10}),0);
 assert.match(movementInstruction(p,0,{id:'lower0',label:'环廊',x:10,y:0,z:0}).action,/^右转/);
 assert.match(movementInstruction(p,Math.PI/2,{id:'lower0',label:'环廊',x:10,y:0,z:0}).action,/^转身/);
});
test('a wide corridor corner or passed point does not keep sending a walker backwards',()=>{
 const a={x:0,y:0,z:20},b={id:'lower8',x:0,y:0,z:0},c={id:'lower7',x:20,y:0,z:0};
 assert.equal(waypointReached({x:2.4,y:0,z:1.1},b,a,c),true);
 assert.equal(waypointReached({x:0.5,y:0,z:-2},b,a,c),true);
 assert.equal(waypointReached({x:5,y:0,z:.6},b,a,c),true);
 assert.equal(waypointReached({x:5,y:12.2,z:0},b,a,c),false);
});
test('stair turns and door thresholds retain their required clearance',()=>{
 const a={x:0,y:0,z:10},b={id:'flight0Turn',level:'core',x:0,y:0,z:0},c={x:10,y:0,z:0};
 assert.equal(waypointReached({x:2.4,y:0,z:1.1},b,a,c),false);
 assert.equal(waypointReached({x:4,y:0,z:.6},b,a,c),false);
 assert.equal(waypointReached({x:.4,y:0,z:.4},b,a,c),true);
 assert.equal(waypointReached({x:0,y:2,z:0},b,a,c),false);
});

test('return instructions describe leaving a room and going up to the pitch',()=>{
 const p={x:-76,y:-2.7,z:0},door={id:'homeDoor',x:-73.3,y:-2.7,z:0,label:'入口',hint:'进入更衣室'};
 assert.match(movementInstruction(p,-Math.PI/2,door,{id:'corridor'}).action,/走出主队更衣室/);
 assert.match(movementInstruction(p,Math.PI/2,door,{id:'homeRoom'}).action,/进入主队更衣室/);
 const tunnel={id:'tunnel',x:-60,y:-2.7,z:0,label:'球员通道',hint:'前往更衣室'};
 assert.match(movementInstruction(p,-Math.PI/2,tunnel,{id:'tunnelStairs',x:-46.5}).hint,/上行走出/);
 assert.match(movementInstruction(p,Math.PI/2,tunnel,{id:'corridor',x:-69.5}).hint,/向内/);
 const reception={id:'reception',x:0,y:-2.9,z:113,label:'大厅',hint:'右转'};
 const exit=movementInstruction({x:22,y:-2.9,z:113},Math.PI/2,reception,{id:'door',x:0,z:122});assert.match(exit.hint,/向南离开/);assert.doesNotMatch(exit.hint,/右转/);
 const platform={id:'flight0Out',level:'core',x:100,y:5,z:0,label:'楼梯'};
 assert.match(movementInstruction({x:100,y:1,z:-2},0,platform,{id:'flight0Turn',x:103,y:5,z:0}).action,/上行/);
 assert.equal(movementInstruction({x:82,y:23.6,z:-30.1},0,{id:'upperStands',x:82,y:23.6,z:-30.1,label:'上层看台'}).action,'上层看台');
 const turn={id:'turn',x:22,y:-2.9,z:113,label:'入口',hint:'右转'};
 assert.doesNotMatch(movementInstruction({x:22,y:-2.9,z:101},Math.PI,turn,reception).hint,/左转|右转/);
 assert.match(movementInstruction({x:0,y:10.6,z:-90},Math.PI,{id:'lowerEntry',x:0,y:12.2,z:-104,label:'看台入口'},{id:'upper24'}).hint,/前往公共大厅/);
});
