import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWalker} from '../dist/walk-motion.js';
import {floorHeight} from '../dist/navigation.js';
import {seatingTiers,roomSpecs} from '../dist/building-layout.js';
const geometry={tiers:seatingTiers,rooms:roomSpecs},clear=()=>false;
test('leaving the pitch cannot drop the walker under the seating bowl',()=>{
 const p={x:0,z:13};let feet=0;for(let i=0;i<150;i++){const before=feet;feet=advanceWalker(p,feet,-.3,0,geometry,clear);assert.ok(feet>=before-.8);}assert.ok(p.x>-41.6);assert.equal(feet,0);
});
test('a walker at the tunnel stair landing cannot step sideways into the void',()=>{
 const p={x:-43,z:0};let feet=floorHeight(p.x,p.z,-1.4,geometry);for(let i=0;i<80;i++){const before=feet;feet=advanceWalker(p,feet,0,.15,geometry,clear);assert.ok(Math.abs(feet-before)<=.8);}assert.ok(p.z<2.6);assert.ok(feet>-1.5);
});
