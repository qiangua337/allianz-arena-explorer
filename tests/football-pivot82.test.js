import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';
import {createOnlinePrediction} from '../dist/online-prediction.js';
const difference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function fixture(team='home'){
 const game=createFootballSimulation({humanTeams:['home','away']});for(let i=0;i<184;i++)game.update(1/60);const s=game.state,p=s.players.find(p=>p.id===team+'-1');for(const q of s.players)if(q!==p)Object.assign(q,{dismissed:true,x:30,z:45});
 Object.assign(p,{x:0,z:0,vx:0,vz:6.916,yaw:0});Object.assign(s.ball,{x:0,z:.83,y:.11,ownerId:p.id});return{game,s,p,team,input:{x:0,z:-1,sprint:true}};
}
test('a running human reversal brakes and turns within a bounded arc rather than dragging the ball backwards at sprint speed',()=>{
 const f=fixture(),start=f.s.time;let aheadAt=null,backwardsTravel=0;const previous={x:f.p.x,z:f.p.z,yaw:f.p.yaw,bx:f.s.ball.x,bz:f.s.ball.z};
 for(let i=0;i<36;i++){
  f.game.update(1/60,{home:f.input});const speed=Math.hypot(f.p.vx,f.p.vz),reach=Math.hypot(f.s.ball.x-f.p.x,f.s.ball.z-f.p.z),ahead=-(f.s.ball.z-f.p.z);
  assert.ok(speed<=6.916001);assert.ok(difference(f.p.yaw,previous.yaw)<=9/60+1e-8,'finite yaw speed');assert.ok(Math.hypot(f.p.x-previous.x,f.p.z-previous.z)<=6.916/60+1e-8,'no player teleport');assert.ok(Math.hypot(f.s.ball.x-previous.bx,f.s.ball.z-previous.bz)<.20,'no ball teleport');assert.ok(reach>.5&&reach<1.05,'ball remains within an ordinary dribbling touch');
  if(aheadAt===null&&ahead>0)aheadAt=f.s.time-start;if(ahead<0)backwardsTravel+=speed/60;Object.assign(previous,{x:f.p.x,z:f.p.z,yaw:f.p.yaw,bx:f.s.ball.x,bz:f.s.ball.z});
 }
 assert.ok(aheadAt<=.23);assert.ok(backwardsTravel<.45);assert.ok(difference(f.p.yaw,Math.PI)<.001);
});
test('the reversal is unchanged by 15, 30 or 60 fps rendering and a new direction responds inside the pivot',()=>{
 const samples=[];for(const fps of[15,30,60]){const f=fixture();for(let i=0;i<fps*.6;i++)f.game.update(1/fps,{home:f.input});samples.push([f.p.x,f.p.z,f.p.yaw,f.p.vx,f.p.vz,f.s.ball.x,f.s.ball.z]);}
 for(const sample of samples)for(let i=0;i<sample.length;i++)assert.ok(Math.abs(sample[i]-samples[0][i])<1e-8);
 const f=fixture();for(let i=0;i<6;i++)f.game.update(1/60,{home:f.input});const x=f.p.x;f.game.update(1/60,{home:{x:1,z:0,sprint:true}});assert.ok(f.p.x>x+.01,'new direction takes over in the same movement frame');
});
test('ordinary ninety-degree turns do not trigger a reversal pivot and losing the ball cancels a dribble pivot',()=>{
 const f=fixture();for(let i=0;i<6;i++)f.game.update(1/60,{home:{x:1,z:0,sprint:true}});assert.ok(!f.p.pivotUntil);assert.ok(f.p.yaw>0&&f.p.yaw<=9*.1+1e-8);assert.ok(Math.hypot(f.p.vx,f.p.vz)>4,'ordinary cuts keep forward momentum');
 const reversing=fixture();reversing.game.update(1/60,{home:reversing.input});assert.ok(reversing.p.pivotUntil>reversing.s.time);reversing.s.ball.ownerId=null;reversing.game.update(1/60,{home:reversing.input});assert.equal(reversing.p.pivotUntil,0);
});
test('both network sides predict the same bounded pivot and checkpoint restoration retains its remaining movement',()=>{
 for(const team of['home','away']){
  const f=fixture(team);f.game.update(1/60,{[team]:f.input});const saved=f.game.checkpoint(),restored=createFootballSimulation({humanTeams:['home','away']}),client=createFootballSimulation({humanTeams:['home','away']}).state;restored.restore(saved);const packet=packOnlineState(f.s,1);assert.equal(applyOnlineState(client,packet,team),true);const cp=client.players.find(p=>p.id===f.p.id),predictor=createOnlinePrediction(team);assert.ok(cp.pivotUntil>client.time);predictor.receive(client);
  for(let i=0;i<12;i++){f.game.update(1/60,{[team]:f.input});restored.update(1/60,{[team]:f.input});predictor.update(client,1/60,f.input,i+1);assert.deepEqual(restored.state,f.s);assert.ok(Math.hypot(cp.x-f.p.x,cp.z-f.p.z)<.01);assert.ok(difference(cp.yaw,f.p.yaw)<.01);}
  const legacy=structuredClone(packet);for(const row of legacy.players)row.length=14;applyOnlineState(client,legacy,team);assert.equal(client.players.find(p=>p.id===f.p.id).pivotUntil,0);
 }
});
