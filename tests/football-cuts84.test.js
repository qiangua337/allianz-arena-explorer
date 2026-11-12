import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';
import {createOnlinePrediction} from '../dist/online-prediction.js';

const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))),run=(g,n,input={})=>{for(let i=0;i<n;i++)g.update(1/60,input);};
function fixture({seed=1,team='home',sprint=false}={}){const g=createFootballSimulation({seed,humanTeams:['home','away'],controlMode:'manual'});run(g,190);const s=g.state,p=s.players.find(p=>p.id===team+'-1'),sign=g.attackSign(team),x=0;Object.assign(p,{x,z:-sign*40,vx:0,vz:0,yaw:sign<0?Math.PI:0});Object.assign(s.ball,{x,z:p.z+sign*.58,y:.11,vx:0,vy:0,vz:0,ownerId:p.id});run(g,48,{[team]:{x:0,z:sign,sprint}});assert.equal(s.ball.ownerId,p.id);return{g,s,p,sign,team,sprint};}

test('ordinary 90 degree dribble cuts keep body, real travel and ball coherent across 32 seeds and both network sides',()=>{
 for(let seed=1;seed<=32;seed++)for(const team of ['home','away'])for(const sprint of [false,true])for(const side of [-1,1]){const f=fixture({seed,team,sprint}),speed=Math.hypot(f.p.vx,f.p.vz);let minSpeed=speed,previous={x:f.p.x,z:f.p.z,yaw:f.p.yaw,bx:f.s.ball.x,bz:f.s.ball.z};
  for(let frame=0;frame<30;frame++){f.g.update(1/60,{[team]:{x:side,z:0,sprint}});const now=Math.hypot(f.p.vx,f.p.vz),slip=angle(f.p.yaw,Math.atan2(f.p.vx,f.p.vz)),bx=f.s.ball.x-f.p.x,bz=f.s.ball.z-f.p.z,reach=Math.hypot(bx,bz);minSpeed=Math.min(minSpeed,now);
   assert.equal(f.s.ball.ownerId,f.p.id);assert.ok(!f.p.pivotUntil,'a normal cut does not invoke the reversal lock');assert.ok(slip<.27,'the body follows the actual path within 15 degrees');assert.ok(angle(f.p.yaw,previous.yaw)<=9/60+1e-8,'body rotation is finite');assert.ok(Math.hypot(f.p.x-previous.x,f.p.z-previous.z)<=speed/60+1e-8,'no player teleport');assert.ok(Math.hypot(f.s.ball.x-previous.bx,f.s.ball.z-previous.bz)<.20,'a dribbling touch does not teleport');assert.ok(reach>.48&&reach<(sprint&&now>speed*.95?1.08:1),'extra reach is reserved for recovered sprint pace');assert.ok((bx*f.p.vx+bz*f.p.vz)/now>.45,'the ball remains in front of actual travel');
   if(frame===7)assert.ok(reach<.75,'the cut pulls the ball in as the player plants');
   if(frame===0){assert.ok(f.p.vz*f.sign>speed*.8,'the old forward momentum survives the first input frame');assert.ok(f.p.vx*side>.1,'the new direction already responds in that frame');}Object.assign(previous,{x:f.p.x,z:f.p.z,yaw:f.p.yaw,bx:f.s.ball.x,bz:f.s.ball.z});
  }
  assert.ok(minSpeed>speed*.69&&minSpeed<speed*.76,'the cut plants and loses a little speed without an artificial stop');assert.ok(angle(f.p.yaw,Math.atan2(side,0))<.02);assert.ok(Math.hypot(f.p.vx,f.p.vz)>speed*.98,'pace returns after completing the cut');
 }
});

test('ordinary cutting is deterministic at mobile and desktop render rates and releasing the stick stops the player',()=>{
 const samples=[];for(const fps of [15,30,60]){const f=fixture({sprint:true});for(let i=0;i<fps*.6;i++)f.g.update(1/fps,{home:{x:1,z:0,sprint:true}});samples.push([f.p.x,f.p.z,f.p.vx,f.p.vz,f.p.yaw,f.s.ball.x,f.s.ball.z]);run(f.g,30);assert.ok(Math.hypot(f.p.vx,f.p.vz)<.005);}
 for(const sample of samples)for(let i=0;i<sample.length;i++)assert.ok(Math.abs(sample[i]-samples[0][i])<1e-8);
});

test('the shared physical cut remains authoritative through checkpoint restore and delayed local prediction',()=>{
 for(const team of ['home','away'])for(const sprint of [false,true]){const f=fixture({team,sprint}),restored=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual'}),client=createFootballSimulation({humanTeams:['home','away']}).state;restored.restore(f.g.checkpoint());const packet=packOnlineState(f.s,1);applyOnlineState(client,packet,team);const local=client.players.find(p=>p.id===f.p.id),prediction=createOnlinePrediction(team);prediction.receive(client);
  for(let frame=0;frame<24;frame++){const input={x:1,z:0,sprint};f.g.update(1/60,{[team]:input});restored.update(1/60,{[team]:input});prediction.update(client,1/60,input,frame+1);assert.deepEqual(restored.state,f.s);assert.ok(Math.hypot(local.x-f.p.x,local.z-f.p.z)<.01);assert.ok(angle(local.yaw,f.p.yaw)<.01);assert.ok(Math.hypot(client.ball.x-f.s.ball.x,client.ball.z-f.s.ball.z)<.01);assert.equal(client.elapsed,packet.elapsed,'the client does not advance the match clock');assert.deepEqual(client.score,packet.score,'the client never predicts a goal');}
 }
});
