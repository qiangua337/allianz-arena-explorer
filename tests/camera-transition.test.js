import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from '../dist/vendor/three.module.js';
import {footballCamera,advanceFootballCamera} from '../dist/football-controls.js';

function assertFramed(pose,player,aspect){
 const camera=new PerspectiveCamera(pose.fov,aspect,.1,2000);camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
 for(const height of[0,2]){const p=new Vector3(player.x,height,player.z).project(camera);assert.ok(Math.abs(p.x)<=.82001&&p.y>=-.52001&&p.y<=.65001&&p.z<1,JSON.stringify({aspect,height,projected:p.toArray()}));}
}

test('a distant cursor switch and restart keep the complete controlled player framed throughout the camera transition',()=>{
 for(const aspect of[390/844,844/390,16/9])for(const [from,to]of[[{x:0,z:30},{x:0,z:-20}],[{x:-30,z:-44},{x:30,z:44}]]){
  const ball={...to,y:.11},desired=footballCamera(to,{style:'broadcast',ball,aspect});let camera=footballCamera(from,{style:'broadcast',ball,aspect});
  for(let frame=0;frame<15;frame++){camera=advanceFootballCamera(camera,desired,{player:to,aspect,changed:frame===0,rate:7});assertFramed(camera,to,aspect);}
 }
});

test('a nearby cursor switch keeps smooth camera motion and an explicit view change cuts immediately',()=>{
 const aspect=16/9,from={x:0,z:0},to={x:1,z:1},ball={...to,y:.11},previous=footballCamera(from,{style:'broadcast',ball,aspect}),desired=footballCamera(to,{style:'broadcast',ball,aspect});
 const smooth=advanceFootballCamera(previous,desired,{player:to,aspect,changed:true});assert.equal(smooth.cut,false);assert.notDeepEqual(smooth.position,previous.position);assert.notDeepEqual(smooth.position,desired.position);assertFramed(smooth,to,aspect);
 const cut=advanceFootballCamera(previous,desired,{player:to,aspect,instant:true});assert.equal(cut.cut,true);assert.deepEqual(cut.position,desired.position);assert.deepEqual(cut.target,desired.target);
});
