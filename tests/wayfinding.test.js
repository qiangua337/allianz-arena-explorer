import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeBearing,waypointReached,movementInstruction} from '../dist/wayfinding.js';
import {tourNodes} from '../dist/tour-route.js';

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

test('a hurried visitor can pass a stair or corridor corner only on its actual approach',()=>{
 const {flight2Start,flight2Out,flight2Turn,upperGalleryOuter,upperBridgeStart,upperThreshold,upperAisleEntry,upperThresholdFoot}=tourNodes;
 const belowStairCorner={...flight2Out,y:flight2Out.y-.492};
 assert.equal(waypointReached({...flight2Out,z:flight2Out.z+.82},flight2Out,flight2Start,flight2Turn),true);
 assert.equal(waypointReached({...belowStairCorner,z:flight2Out.z+.82},flight2Out,flight2Start,flight2Turn),false);
 assert.equal(waypointReached(belowStairCorner,flight2Out,flight2Start,flight2Turn),false,'being within the horizontal radius does not advance a turn before the landing');
 assert.equal(waypointReached({...upperBridgeStart,x:upperBridgeStart.x-.9},upperBridgeStart,upperGalleryOuter,upperThreshold),false);
 assert.equal(waypointReached({...upperBridgeStart,z:upperBridgeStart.z-.8},upperBridgeStart,upperGalleryOuter,upperThreshold),true);
 assert.equal(waypointReached({...upperThresholdFoot,z:upperThresholdFoot.z-.33},upperThresholdFoot,upperAisleEntry,upperThreshold),true);
 assert.equal(waypointReached({...upperThresholdFoot,x:upperThresholdFoot.x-.26,z:upperThresholdFoot.z-.33},upperThresholdFoot,upperAisleEntry,upperThreshold),false);
});

test('arms the next turn from the current stair or gallery approach without redirecting the arrow',()=>{
 const {flight2Out,flight2Turn,upperBridgeStart,upperThreshold,upperAisleEntry,upperThresholdFoot}=tourNodes;
 const core=movementInstruction({...flight2Out,z:flight2Out.z-1.8,y:flight2Out.y-.7},Math.PI,flight2Out,flight2Turn);
 assert.equal(core.action,'到平台后左转');assert.ok(Math.abs(core.angle)<.01);
 assert.equal(core.hint,'沿扶手与踏步到平台，再左转。');
 const gallery=movementInstruction({...upperBridgeStart,z:upperBridgeStart.z+2},0,upperBridgeStart,upperThreshold);
 assert.equal(gallery.action,'到连廊转角后左转');assert.equal(gallery.angle,0);
 assert.equal(gallery.hint,'沿地线走到转角，再左转。');
 const landing=movementInstruction({...upperThresholdFoot,z:upperThresholdFoot.z+.31},0,upperThresholdFoot,upperThreshold);
 assert.equal(landing.action,'到平台后右转');assert.equal(landing.angle,0);
 const offAxis=movementInstruction({...upperAisleEntry,z:upperAisleEntry.z+.68},Math.PI/2,upperAisleEntry,upperThresholdFoot);
 assert.match(offAxis.action,/^右转，沿座席台阶上行$/);
});

test('a final destination cannot be reached by projecting an old path across the stadium',()=>{
 assert.equal(waypointReached({x:0,y:0,z:-80},{id:'pitch',x:0,y:0,z:0},{x:0,y:0,z:20},null,true),false);
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

test('museum and store instructions name the exhibit aisle and east exit by walking direction',()=>{
 const {museumDoor,museum,store}=tourNodes;
 const museumAisle=tourNodes['museumWalk2-2'],storeAisle=tourNodes['storeWalk2-2'];
 const outward=movementInstruction(museum,0,museumAisle,museumDoor,'store');
 const atEntrance=movementInstruction(museumDoor,Math.PI/2,museumAisle,museum,'museum');
 const inward=movementInstruction(museumAisle,Math.PI/2,museum,null,'museum');
 assert.match(outward.hint,/东侧感应门/);
 assert.equal(atEntrance.action,'穿过荣誉展厅感应门');
 assert.match(inward.action,/荣誉展厅中央展区/);
 assert.match(inward.hint,/两排奖杯展柜/);
 assert.match(movementInstruction(museumAisle,0,museumDoor,tourNodes.upper14,'store').hint,/回到公共大厅/);
 assert.match(movementInstruction(storeAisle,0,store,null,'store').action,/球迷商店展示区/);
 assert.match(movementInstruction(store,0,storeAisle,tourNodes.storeDoor,'museum').action,/货架间通道前往出口/);
});

test('the stairs and gallery tell the visitor what is around the actual corner',()=>{
 const {corePublicApproach,corePublicFront,landing1,upperGalleryOuter,upperBridgeStart,upperThreshold}=tourNodes;
 const look=(from,to)=>Math.atan2(from.x-to.x,from.z-to.z);
 const beforeDoor={...corePublicFront,x:corePublicFront.x-2};
 const enter=movementInstruction(beforeDoor,look(beforeDoor,corePublicFront),corePublicFront,landing1);
 assert.equal(enter.action,'过门口后右转');
 assert.equal(enter.landmark,'门口');
 assert.equal(enter.hint,'沿地线穿过门洞，再右转。');
 assert.equal(waypointReached(beforeDoor,corePublicFront,corePublicApproach,landing1),false);
 const fromGallery=movementInstruction(upperGalleryOuter,look(upperGalleryOuter,upperBridgeStart),upperBridgeStart,upperThreshold);
 assert.equal(fromGallery.action,'走到上层连廊转角');
 assert.match(fromGallery.hint,/转向看台门洞/);
});

test('upper gallery return and south exit instructions follow the direction of travel',()=>{
 const {upperThreshold,upperBridgeStart,upperGalleryOuter,upperGalleryFront,landing3,forecourt,security,entrance}=tourNodes;
 const facing=(from,to)=>Math.atan2(from.x-to.x,from.z-to.z);
 const returnLegs=[
  [{...upperThreshold,x:upperThreshold.x-1},upperBridgeStart,upperGalleryOuter],
  [upperBridgeStart,upperGalleryOuter,upperGalleryFront],
  [upperGalleryOuter,upperGalleryFront,landing3]
 ];
 for(const [position,target,next] of returnLegs){
  const instruction=movementInstruction(position,facing(position,target),target,next,'entrance');
  assert.equal(instruction.action,'沿连廊返回楼梯间');
  assert.doesNotMatch(instruction.hint,/前往看台入口/);
  assert.equal(instruction.landmark,'转角');
 }
 const towardSeats=movementInstruction(landing3,facing(landing3,upperGalleryFront),upperGalleryFront,upperGalleryOuter,'upperStands');
 assert.match(towardSeats.hint,/前往看台入口/);
 const outside=movementInstruction(forecourt,facing(forecourt,security),security,entrance,'entrance');
 assert.match(outside.hint,/沿南广场中央步道穿过验票通道/);
 assert.doesNotMatch(outside.hint,/离开大厅/);
});

test('outdoor stair directions match the physical number on the rail sign and the travel direction',()=>{
 const {T3Bottom,T3Middle,T3Top,forecourt,outside9}=tourNodes;
 assert.match(movementInstruction(T3Bottom,0,T3Middle,T3Top).action,/沿 T3 楼梯上行/);
 assert.match(movementInstruction(T3Top,0,T3Middle,T3Bottom).action,/沿 T3 楼梯下行/);
 assert.match(movementInstruction(T3Middle,0,T3Bottom,null).hint,/沿扶手与踏步/);
 assert.match(movementInstruction(forecourt,0,forecourt,outside9).action,/前往球场外环步道/);
});
