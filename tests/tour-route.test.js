import test from 'node:test';
import assert from 'node:assert/strict';
import {visitorPassage,visitorFloor,inVisitorPassage,visitorWallOpening,visitorBowlOpening,planTour,tourNodes,tourGoals,tourLinks} from '../dist/tour-route.js';
import {floorHeight,MAX_STEP,hitsWall} from '../dist/navigation.js';
import {orientedCollider} from '../dist/access-layout.js';
import {planWalkPath,walkSegmentClear} from '../dist/walk-path.js';
import {roomSpecs} from '../dist/building-layout.js';
import {movementInstruction,waypointReached} from '../dist/wayfinding.js';

const geometry={tiers:[{a:43,b:61,y:.7,rows:30,depth:.76,angle:24},{a:66,b:84,y:13.2,rows:24,depth:.76,angle:30},{a:85,b:103,y:27.1,rows:26,depth:.73,angle:34}]};

test('the reception route enters the visitor passage and reaches the pitch on foot',()=>{
 const route=planTour({x:0,y:-2.9,z:113},'pitch');
 assert.deepEqual(route.map(n=>n.id),['reception','turn','visitorGate','passage','ramp','pitchExit','pitchEdge','pitch']);
 let feet=-2.9;
 for(let z=114;z>=54;z-=.04){const floor=floorHeight(visitorPassage.x,z,feet,geometry);assert.ok(Math.abs(floor-feet)<=MAX_STEP+.001,`unwalkable height at z ${z}`);feet=floor;}
 assert.equal(feet,0);
 for(let z=54;z<=114;z+=.04){const floor=floorHeight(visitorPassage.x,z,feet,geometry);assert.ok(Math.abs(floor-feet)<=MAX_STEP+.001,`return height at z ${z}`);feet=floor;}
 assert.equal(feet,-2.9);
});

test('the visitor doorway is open while adjacent enclosure remains closed',()=>{
 assert.equal(visitorWallOpening(22,103.2),true);assert.equal(visitorWallOpening(10,104),false);
 const lintel=orientedCollider(22,103.3,6.4,.2,visitorPassage.head,5.4);
 assert.equal(hitsWall(22,103.3,-1.2,[lintel]),false);
 assert.equal(inVisitorPassage(22,82),true);assert.equal(inVisitorPassage(30,82),false);
 assert.equal(visitorBowlOpening(22,62,0),true);assert.equal(visitorBowlOpening(22,62,12),false);
 assert.equal(visitorFloor(22,59.7),0);
});

test('all advertised walking destinations connect to reception and back',()=>{
 for(const goal of Object.keys(tourGoals)){
  const route=planTour(tourNodes.reception,goal);assert.ok(route.length>1);assert.equal(route.at(-1).id,goal);
  for(let i=1;i<route.length;i++)assert.ok(tourLinks.some(([a,b])=>a===route[i-1].id&&b===route[i].id||b===route[i-1].id&&a===route[i].id));
 }
 const home=planTour(tourNodes.reception,'homeRoom').map(n=>n.id);assert.ok(home.some(id=>id==='playerSouthLobby'||id==='playerNorthLobby'));assert.ok(home.includes('homeDoor'));assert.ok(!home.includes('pitch'));
 assert.ok(planTour(tourNodes.homeRoom,'entrance').some(n=>n.id==='playerSouthLobby'||n.id==='playerNorthLobby'));
});

test('upper concourse routes descend a real staircase rather than crossing levels',()=>{
 const route=planTour({x:94,y:12.2,z:-47},'pitch');
 assert.ok(route.some(n=>n.level==='stairs'||n.level==='core'));assert.ok(route.some(n=>n.id.endsWith('Bottom')||n.id==='landing0'));assert.ok(route.some(n=>n.id==='visitorGate'));
});

test('upper stand route describes level hairpins in both directions',()=>{
 for(let flight=0;flight<3;flight++){
  const out=tourNodes[`flight${flight}Out`],turn=tourNodes[`flight${flight}Turn`];
  for(const [start,end,next] of [[out,turn,tourNodes[`flight${flight}End`]],[turn,out,tourNodes[`flight${flight}Start`]]]){
   const yaw=Math.atan2(start.x-end.x,start.z-end.z);
   assert.equal(movementInstruction(start,yaw,end,next).action,'前往楼梯平台');
  }
 }
});

test('the return to the south gate distinguishes passing a landing from leaving the stairwell',()=>{
 const action=(from,at,next)=>{
  const start=tourNodes[from],target=tourNodes[at];
  return movementInstruction(start,Math.atan2(start.x-target.x,start.z-target.z),target,tourNodes[next]).action;
 };
 assert.equal(action('flight2Start','landing2','flight1End'),'到平台后右转');
 assert.equal(action('landing0','coreFront','coreApproach'),'走出楼梯间');
 assert.equal(action('coreFront','coreApproach','lower0'),'返回入口环廊');
 assert.equal(action('coreApproach','coreFront','landing0'),'公共楼梯入口');
});

test('upper seating and its bridge use the right-angle landing in both directions',()=>{
 const {upperBridgeStart,upperGalleryOuter,upperStands,upperThreshold,upperThresholdFoot,upperAisleEntry}=tourNodes;
 const outbound=planWalkPath(upperGalleryOuter,'upperStands',geometry);
 assert.equal(outbound.blocked,false);
 assert.deepEqual(outbound.path.slice(-4),[upperThreshold,upperThresholdFoot,upperAisleEntry,upperStands]);
 const via=planWalkPath(upperStands,'entrance',geometry);
 assert.equal(via.blocked,false);
 assert.deepEqual(via.path.slice(0,5),[upperStands,upperAisleEntry,upperThresholdFoot,upperThreshold,upperBridgeStart]);
 for(const [from,to] of [[upperStands,upperThreshold],[upperAisleEntry,upperThreshold],[upperStands,upperThresholdFoot]]){
  assert.equal(walkSegmentClear(from,to,geometry,[]),false);
  assert.equal(walkSegmentClear(to,from,geometry,[]),false);
 }
 assert.equal(waypointReached({...upperThresholdFoot,z:upperThresholdFoot.z+.46},upperThresholdFoot,upperAisleEntry,upperThreshold),false);
 assert.equal(waypointReached(upperThresholdFoot,upperThresholdFoot,upperAisleEntry,upperThreshold),true);
});

test('returning from the fast upper-seat stop climbs the radial aisle before turning',()=>{
 const {upperThresholdFoot,upperAisleEntry,upperThreshold}=tourNodes;
 const x=100.683,z=-35.287,position={x,y:floorHeight(x,z,37.93,geometry),z};
 assert.equal(walkSegmentClear(position,upperThresholdFoot,geometry,[]),false);
 const returning=planWalkPath(position,'entrance',geometry);
 assert.equal(returning.blocked,false);
 assert.deepEqual(returning.path.slice(0,3),[upperAisleEntry,upperThresholdFoot,upperThreshold]);
 assert.equal(walkSegmentClear({...upperAisleEntry,z:upperAisleEntry.z-.12},upperThresholdFoot,geometry,[]),true,'an aligned visitor on the landing can continue from their actual location');
});

test('touch guidance retains the doorway waypoint while the visitor is on threshold steps',()=>{
 const {upperThresholdFoot,upperThreshold,upperBridgeStart}=tourNodes;
 const x=102.301,z=-36.546,position={x,y:floorHeight(x,z,39.36,geometry),z};
 assert.equal(waypointReached(position,upperThreshold,upperThresholdFoot,upperBridgeStart),false);
 const restarting=planWalkPath(position,'entrance',geometry);
 assert.equal(restarting.blocked,false);
 assert.deepEqual(restarting.path.slice(0,2),[upperThreshold,upperBridgeStart]);
 const inbound=planWalkPath(position,'upperStands',geometry);
 assert.equal(inbound.blocked,false);
 assert.equal(inbound.path[0],upperThresholdFoot);
 const past={...upperThreshold,x:upperThreshold.x+.86,z:upperThreshold.z+.12};
 assert.equal(waypointReached(past,upperThreshold,upperThresholdFoot,upperBridgeStart),true);
});

test('a lost visitor in the lower hall follows the ring instead of crossing staff walls',()=>{
 const route=planTour({x:-96,y:-2.9,z:0},'pitch');
 assert.ok(route[0].id.startsWith('lower'));assert.ok(route.some(n=>n.id==='visitorGate'||n.id==='playerSouthLobby'||n.id==='playerNorthLobby'));assert.ok(!route.some(n=>n.id==='homeRoom'));
 for(const n of route.filter(n=>n.id.startsWith('lower')))assert.ok((Math.abs(n.x)/86)**2.8+(Math.abs(n.z)/104)**2.8>1);
});

test('walkers on a connector head towards the exit that shortens the rest of the route',()=>{
 const middle={x:102,y:23.6,z:-20};
 const northRamp={x:0,y:floorHeight(0,-94,11.4,geometry),z:-94};
 const cases=[
  [middle,'stands','middleBridgeStart'],
  [middle,'lounge','landing2'],
  [northRamp,'lowerStands','lowerStands'],
  [{x:0,y:floorHeight(0,-87,10.9,geometry),z:-87},'concourse','lowerEntry'],
 ];
 for(const [position,destination,first] of cases){
  const walkGeometry={...geometry,rooms:roomSpecs};
  const result=planWalkPath(position,destination,walkGeometry);
  assert.equal(result.blocked,false,destination);
  assert.equal(result.path[0].id,first,destination);
  assert.equal(result.path.at(-1).id,destination);
  assert.ok(walkSegmentClear(position,result.path[0],walkGeometry,[]));
 }
});
