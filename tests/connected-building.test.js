import test from 'node:test';
import assert from 'node:assert/strict';
import {planTour,tourNodes,tourGoals} from '../dist/tour-route.js';
import {roomSpecs,coreFlights,coreLevels,buildingFloors} from '../dist/building-layout.js';
import {floorHeight,MAX_STEP} from '../dist/navigation.js';
const geometry={rooms:roomSpecs,tiers:[{a:43,b:61,y:.7,rows:30,depth:.76,angle:24},{a:66,b:84,y:13.2,rows:24,depth:.76,angle:30},{a:85,b:103,y:27.1,rows:26,depth:.73,angle:34}]};
function walk(route){let feet=route[0].y;
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.06);for(let j=1;j<=steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=floorHeight(x,z,feet,geometry);assert.ok(Math.abs(y-feet)<=MAX_STEP+.002,`${a.id} → ${b.id} floor jump at ${x.toFixed(2)},${z.toFixed(2)}: ${feet} → ${y}`);feet=y;}assert.ok(Math.abs(feet-b.y)<.85,`wrong floor at ${b.id}: ${feet} instead of ${b.y}`);}
 return feet;
}
test('each destination has an actual continuous floor from reception and back',()=>{
 for(const goal of Object.keys(tourGoals)){walk(planTour(tourNodes.reception,goal));walk(planTour(tourNodes[goal],'entrance'));}
});
test('the complete indoor staircase ascends and descends all four levels',()=>{
 const route=planTour(tourNodes.landing0,'upperStands');assert.ok(route.some(n=>n.id==='landing1'));assert.ok(route.some(n=>n.id==='landing2'));assert.ok(route.some(n=>n.id==='landing3'));walk(route);walk(planTour(tourNodes.upperStands,'entrance'));
 assert.equal(coreFlights.length,6);assert.equal(coreLevels.length,4);
});
test('going to lounge, gallery and shop no longer requires entering the pitch',()=>{
 for(const goal of ['lounge','museum','store','stands','upperStands','lowerStands']){const route=planTour(tourNodes.reception,goal);assert.ok(!route.some(n=>n.id==='pitch'||n.id==='visitorGate'),goal);assert.ok(route.some(n=>n.id==='landing1'||n.id.endsWith('Top')),goal);}
});
test('walkers who descend seating aisles can return through their tier exit',()=>{
 for(let ti=0;ti<3;ti++)for(const aisle of [0,12,24,36,47]){const start=tourNodes[`seat${ti}-${aisle}-front`],route=planTour(start,'entrance');assert.ok(route.some(n=>n.id===['lowerStands','stands','upperStands'][ti]));walk([start,...route]);}
});
