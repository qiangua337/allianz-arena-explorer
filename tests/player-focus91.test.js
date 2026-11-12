import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('../dist/vendor/three.module.js');
const {footballCamera,footballPlayerFocus,footballShotFocus,footballerInFrame,offscreenBallCue,advanceFootballCamera}=await import('../dist/football-controls.js');
const cameraFor=(pose,aspect)=>{const c=new THREE.PerspectiveCamera(pose.fov,aspect,.06,2000);c.position.fromArray(pose.position);c.lookAt(...pose.target);c.updateMatrixWorld();return c;};
test('off-ball phone close views retain a readable controlled footballer and show the real distant ball edge cue',()=>{
 let samples=0;for(const [w,h]of [[390,844],[844,390],[1280,720]])for(const x of[-33,0,33])for(const z of[-51,0,51])for(let angle=0;angle<12;angle++){
  const p={id:'home-1',x,z},ball={x:Math.max(-34,Math.min(34,x+Math.sin(angle*Math.PI/6)*80)),z:Math.max(-52.5,Math.min(52.5,z+Math.cos(angle*Math.PI/6)*80)),y:angle%2?5:.11};if(Math.hypot(p.x-ball.x,p.z-ball.z)<35)continue;
  const state={phase:'playing',players:[p],controlledId:p.id,ball},aspect=w/h,pose=footballCamera(p,{style:'close',aspect,ball,playerFocus:footballPlayerFocus(state)}),c=cameraFor(pose,aspect),foot=new THREE.Vector3(x,0,z).project(c),head=new THREE.Vector3(x,2,z).project(c),size=(head.y-foot.y)*h/2;
  assert.ok(footballerInFrame(pose,p,aspect));assert.ok(size>=(h>w?34:18),'readable player, pixels='+size);assert.ok(pose.position[1]<30);const b=new THREE.Vector3(ball.x,ball.y,ball.z).project(c);assert.ok(offscreenBallCue(b,w,h),'a distant ball remains discoverable');samples++;
 }assert.ok(samples>150);
});
test('possession, intended reception, training and dead balls do not use off-ball player focus',()=>{
 const p={id:'home-1',x:0,z:0},s={players:[p],controlledId:p.id,phase:'playing',ball:{x:0,z:50,y:.11}};
 for(const patch of[{ball:{...s.ball,ownerId:p.id}},{ball:{...s.ball,targetId:p.id}},{training:{id:'free'}},{phase:'goal'},{ball:{x:0,z:10,y:5}}])assert.equal(footballPlayerFocus({...s,...patch}),0);
 let previous;for(let z=13;z<32;z+=.05){const state={...s,ball:{x:0,z,y:.11}},pose=footballCamera(p,{style:'close',aspect:390/844,ball:state.ball,playerFocus:footballPlayerFocus(state)});if(previous)assert.ok(Math.hypot(...pose.position.map((n,i)=>n-previous[i]))<.3);previous=pose.position;}
});

test('a long reception or the selected player’s shot stays in the close portrait view',()=>{
 const w=390,h=844,aspect=w/h,style='close';
 for(const x of[-28,0,28])for(const direction of[-1,1])for(const receive of[false,true]){
  const player={id:'home-1',x,z:-15*direction};
  const ball={x,y:2.6,z:player.z+30*direction,vx:0,vz:direction*(receive?-18:20),...(receive?{targetId:player.id}:{shot:{id:12}})};
  const state={players:[player],phase:'playing',controlledId:player.id,ball,lastShot:receive?null:{id:12,playerId:player.id,outcome:'flight'}};
  const options={style,aspect,ball,playerFocus:footballPlayerFocus(state),trackShot:footballShotFocus(state)};
  const pose=footballCamera(player,options),camera=cameraFor(pose,aspect),point=new THREE.Vector3(ball.x,ball.y,ball.z).project(camera);
  assert.equal(offscreenBallCue(point,w,h),null);
  assert.ok(pose.position[1]<37,'close zoom stays below the inner roof');
  for(const height of[0,2]){
   const body=new THREE.Vector3(player.x,height,player.z).project(camera);
   assert.ok(Math.abs(body.x)<=.82001&&body.y<=.65001&&body.y>=-.52001);
  }
  assert.equal(pose.controlYaw,Math.atan2(18,4.5));
 }
});

test('only the selected player’s own active shot or its second ball requests shot framing',()=>{
 const p={id:'home-1'},state={phase:'playing',players:[p],controlledId:p.id,ball:{shot:{id:5}},lastShot:{id:5,playerId:p.id,outcome:'flight'}};
 assert.equal(footballShotFocus(state),true);
 const parried={...state,lastShot:{...state.lastShot,outcome:'parried'}};
 assert.equal(footballShotFocus(parried),false);
 assert.equal(footballShotFocus({...parried,ball:{...state.ball,rebound:{shotId:5}}}),true);
 for(const patch of[{controlledId:'home-2'},{ball:{shot:{id:4}}},{ball:{ownerId:'away-0',shot:{id:5}}},{phase:'interval'},{training:{id:'shooting'}},{setPiece:{type:'penalty'}}])assert.equal(footballShotFocus({...state,...patch}),false);
});

test('close lens returns gradually after the long pass ends and explicit camera changes can cut',()=>{
 const aspect=390/844,player={id:'home-1',x:0,z:0},normal=footballCamera(player,{style:'close',aspect});
 const tracked=footballCamera(player,{style:'close',aspect,ball:{x:0,y:.11,z:37,vz:-18,targetId:player.id}});
 assert.ok(tracked.fov>normal.fov+1);
 const next=advanceFootballCamera(tracked,normal,{player,aspect,dt:1/60,rate:7});
 assert.ok(next.fov<tracked.fov&&next.fov>normal.fov);
 assert.equal(advanceFootballCamera(tracked,normal,{player,aspect,instant:true}).fov,normal.fov);
 const special=footballCamera(player,{style:'close',aspect,penalty:'keeper'});
 assert.equal(advanceFootballCamera(tracked,special,{player,aspect}).fov,special.fov);
});
