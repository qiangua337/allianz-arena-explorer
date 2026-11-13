import test from 'node:test';
import assert from 'node:assert/strict';
import {footballInput,footballCamera,matchTime,ballDirection,penaltyContext,footballControlYaw} from '../dist/football-controls.js';
import {movePenaltyAim,penaltyKeeperWaiting} from '../dist/football-penalty-ui.js';

test('penalty directions retain the selected height and side when the movement input is released',()=>{
 let aim=movePenaltyAim({x:0,y:0},{x:-1,y:1},.25,false);
 assert.deepEqual(aim,{x:-.65,y:.65});
 assert.equal(movePenaltyAim(aim,{x:0,y:0},1,false),aim);
 aim=movePenaltyAim(aim,{x:0,y:-1},1,false);
 assert.deepEqual(aim,{x:-.65,y:-1});
 const dive=movePenaltyAim({x:0,y:0},{x:1,y:-1},.016,true);
 assert.deepEqual(dive,{x:1,y:-1});
 assert.equal(movePenaltyAim(dive,{x:0,y:0},1,true),dive);
 assert.equal(penaltyKeeperWaiting({role:'keeper',stage:'ready',keeperReady:false}),true);
 assert.equal(penaltyKeeperWaiting({role:'shooter',stage:'ready',keeperReady:false}),false);
});

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

test('portrait penalty cameras keep the goal posts and full keeper movement inside the horizontal view',()=>{
 for(const penalty of ['shooter','keeper']){const pose=footballCamera({x:0,z:-41.5},{style:'broadcast',aspect:390/844,penalty}),[cx,cy,cz]=pose.position,[tx,ty,tz]=pose.target,dy=ty-cy,dz=tz-cz,d=Math.hypot(dy,dz),depth=((.8-cy)*dy+(-52.5-cz)*dz)/d,half=depth*Math.tan(pose.fov*Math.PI/360)*390/844;assert.ok(half>3.66,'both posts remain visible: '+penalty);assert.equal(pose.controlYaw,0);}
 const state={elapsed:90,competition:{stage:'regulation',regulationDuration:180}};assert.equal(matchTime(state),'45:00');state.elapsed=240;assert.equal(matchTime(state),'120:00');
});

test('ordinary penalties frame the actual goal at either end, keep camera-relative controls and preserve first person',()=>{
 for(const goalZ of[-52.5,52.5])for(const team of['home','away'])for(const role of['shooter','keeper']){
  const player={id:'selected',team:role==='shooter'?team:team==='home'?'away':'home',keeper:role==='keeper',x:1,z:role==='keeper'?goalZ:goalZ-Math.sign(goalZ)*11.58},state={players:[player],controlledId:player.id,phase:'playing',setPiece:{type:'penalty',team,goalZ,stage:'ready'}},penalty=penaltyContext(state);
  assert.equal(penalty.role,role);assert.equal(penalty.kind,'match');
  for(const aspect of[390/844,844/390,16/9]){const pose=footballCamera(player,{penalty,aspect}),delta=pose.target.map((v,i)=>v-pose.position[i]),length=Math.hypot(...delta),horizontal=Math.hypot(delta[0],delta[2]),forward=delta.map(v=>v/length),right=[-delta[2]/horizontal,0,delta[0]/horizontal],tan=Math.tan(pose.fov*Math.PI/360);
   for(const x of[-3.66,3.66]){const q=[x-pose.position[0],1.22-pose.position[1],goalZ-pose.position[2]],depth=q.reduce((a,v,i)=>a+v*forward[i],0),screen=q.reduce((a,v,i)=>a+v*right[i],0)/(depth*tan*aspect);assert.ok(depth>0&&Math.abs(screen)<.95,'goal post must remain inside the actual penalty view');}
   const inputYaw=footballControlYaw(state,{cameraMode:'close'}),input=footballInput({side:1,yaw:inputYaw});assert.ok(input.x*right[0]+input.z*right[2]>.99,'right control moves right on screen');
  }
  assert.equal(footballControlYaw(state,{cameraMode:'first',yaw:.71}),.71);const eye=footballCamera(player,{view:'first',penalty,yaw:.71});assert.equal(eye.target,null);assert.equal(eye.yaw,.71);assert.deepEqual(eye.position,[player.x,1.68,player.z]);
 }
 const live={players:[{id:'p',team:'home'}],controlledId:'p',phase:'playing'};assert.equal(penaltyContext(live),null);assert.equal(footballControlYaw(live,{cameraMode:'follow',yaw:1.1}),1.1);
});
