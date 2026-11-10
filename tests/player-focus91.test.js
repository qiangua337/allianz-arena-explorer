import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('../dist/vendor/three.module.js');
const {footballCamera,footballPlayerFocus,footballerInFrame,offscreenBallCue}=await import('../dist/football-controls.js');
const cameraFor=(pose,aspect)=>{const c=new THREE.PerspectiveCamera(pose.fov,aspect,.06,2000);c.position.fromArray(pose.position);c.lookAt(...pose.target);c.updateMatrixWorld();return c;};
test('off-ball phone close views retain a readable controlled footballer and show the real distant ball edge cue',()=>{
 let samples=0;for(const [w,h]of [[390,844],[844,390],[1280,720]])for(const x of[-33,0,33])for(const z of[-51,0,51])for(let angle=0;angle<12;angle++){
  const p={id:'home-1',x,z},ball={x:Math.max(-34,Math.min(34,x+Math.sin(angle*Math.PI/6)*80)),z:Math.max(-52.5,Math.min(52.5,z+Math.cos(angle*Math.PI/6)*80)),y:angle%2?5:.11};if(Math.hypot(p.x-ball.x,p.z-ball.z)<35)continue;
  const state={phase:'playing',players:[p],controlledId:p.id,ball},aspect=w/h,pose=footballCamera(p,{style:'close',aspect,ball,playerFocus:footballPlayerFocus(state)}),c=cameraFor(pose,aspect),foot=new THREE.Vector3(x,0,z).project(c),head=new THREE.Vector3(x,2,z).project(c),size=(head.y-foot.y)*h/2;
  assert.ok(footballerInFrame(pose,p,aspect));assert.ok(size>=(h>w?34:18),'readable player, pixels='+size);assert.ok(pose.position[1]<30);const b=new THREE.Vector3(ball.x,ball.y,ball.z).project(c);assert.ok(offscreenBallCue(b,w,h),'a distant ball remains discoverable');samples++;
 }assert.ok(samples>150);
});
test('possession, intended reception, training and dead balls preserve their existing framing; distance changes do not snap',()=>{
 const p={id:'home-1',x:0,z:0},s={players:[p],controlledId:p.id,phase:'playing',ball:{x:0,z:50,y:.11}};
 for(const patch of[{ball:{...s.ball,ownerId:p.id}},{ball:{...s.ball,targetId:p.id}},{training:{id:'free'}},{phase:'goal'},{ball:{x:0,z:10,y:5}}])assert.equal(footballPlayerFocus({...s,...patch}),0);
 let previous;for(let z=13;z<32;z+=.05){const state={...s,ball:{x:0,z,y:.11}},pose=footballCamera(p,{style:'close',aspect:390/844,ball:state.ball,playerFocus:footballPlayerFocus(state)});if(previous)assert.ok(Math.hypot(...pose.position.map((n,i)=>n-previous[i]))<.3);previous=pose.position;}
});
