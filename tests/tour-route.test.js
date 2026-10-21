import test from 'node:test';
import assert from 'node:assert/strict';
import {visitorPassage,visitorFloor,inVisitorPassage,visitorWallOpening,visitorBowlOpening,planTour,tourNodes,tourGoals,tourLinks} from '../dist/tour-route.js';
import {floorHeight,MAX_STEP,hitsWall} from '../dist/navigation.js';
import {orientedCollider} from '../dist/access-layout.js';

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
 const home=planTour(tourNodes.reception,'homeRoom').map(n=>n.id);assert.ok(home.includes('visitorGate'));assert.ok(home.includes('tunnel'));assert.ok(home.includes('homeDoor'));
 assert.ok(planTour(tourNodes.homeRoom,'entrance').some(n=>n.id==='visitorGate'));
});

test('upper concourse routes descend a real staircase rather than crossing levels',()=>{
 const route=planTour({x:94,y:12.2,z:-47},'pitch');
 assert.ok(route.some(n=>n.level==='stairs'));assert.ok(route.some(n=>n.id.endsWith('Bottom')));assert.ok(route.some(n=>n.id==='forecourt'));assert.ok(route.some(n=>n.id==='visitorGate'));
});

test('a lost visitor in the lower hall follows the ring instead of crossing staff walls',()=>{
 const route=planTour({x:-96,y:-2.9,z:0},'pitch');
 assert.ok(route[0].id.startsWith('lower'));assert.ok(route.some(n=>n.id==='visitorGate'));assert.ok(!route.some(n=>n.id==='homeRoom'||n.id==='tunnel'));
 for(const n of route.filter(n=>n.id.startsWith('lower')))assert.ok((Math.abs(n.x)/86)**2.8+(Math.abs(n.z)/104)**2.8>1);
});
