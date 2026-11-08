import test from 'node:test';
import assert from 'node:assert/strict';
import {doorCollider,updateAutomaticDoor} from '../dist/automatic-door.js';
import {hitsWall} from '../dist/navigation.js';
function door(){return{id:'door',x:0,z:0,y:0,opening:0,hold:false,collider:doorCollider(0,0,0),hinge:{position:{set(x,y,z){Object.assign(this,{x,y,z});}}}};}

test('a sliding automatic door always keeps its collision on the visible leaf and clears both doorway approaches',()=>{
 for(const side of[-1,1]){
  const d=door(),p={x:side*2,y:1.7,z:0};for(let i=0;i<35;i++){updateAutomaticDoor(d,p,.025);assert.equal(hitsWall(d.collider.cx,d.collider.cz,1.7,[d.collider]),true,'the moving panel never becomes non-solid');assert.ok(Math.abs(d.hinge.position.x-d.collider.cx)<1e-9);assert.ok(Math.abs(d.hinge.position.z+1.15-d.collider.cz)<1e-9);}
  assert.ok(d.opening>.99);assert.equal(hitsWall(0,0,1.7,[d.collider]),false,'the actual threshold opens');assert.equal(hitsWall(-1.3,-.8,1.7,[d.collider]),false,'a retracted leaf cannot block the press-room side aisle');
  for(let i=0;i<60;i++)updateAutomaticDoor(d,{x:20,y:1.7,z:20},.025);assert.equal(hitsWall(0,0,1.7,[d.collider]),true,'closes on departure');
 }
});

test('a low-frame-rate opening checks the entire swept leaf and does not slide it into a visitor',()=>{
 const d=door();d.hold=true;const visitor={x:.16,y:1.7,z:-3.0};assert.equal(hitsWall(visitor.x,visitor.z,visitor.y,[d.collider]),false);
 updateAutomaticDoor(d,visitor,2);assert.ok(d.opening>0&&d.opening<.8,'a body in the receiving pocket stops the sweep');assert.equal(hitsWall(visitor.x,visitor.z,visitor.y,[d.collider]),false,'not teleported through the visitor at 0.5fps');
 for(let i=0;i<10;i++)updateAutomaticDoor(d,visitor,.1);assert.equal(hitsWall(visitor.x,visitor.z,visitor.y,[d.collider]),false);
 updateAutomaticDoor(d,{x:2,y:1.7,z:0},1);assert.ok(d.opening>.99,'resumes after the visitor steps clear');
});

test('a held door can return to sensing without closing on a visitor in the opening',()=>{
 const d=door();d.hold=true;updateAutomaticDoor(d,{x:2,y:1.7,z:0},1);d.hold=false;
 for(let i=0;i<50;i++)updateAutomaticDoor(d,{x:.16,y:1.7,z:0},.025);
 assert.ok(d.opening>.99);assert.equal(hitsWall(.16,0,1.7,[d.collider]),false);
});
