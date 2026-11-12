import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';
import {createOnlinePrediction} from '../dist/online-prediction.js';

function fixture(team='home'){
 const game=createFootballSimulation({controlMode:'manual',humanTeams:['home','away']});
 for(let i=0;i<184;i++)game.update(1/60);
 const state=game.state,player=state.players.find(p=>p.id===team+'-1');
 for(const p of state.players)if(p!==player)p.dismissed=true;
 Object.assign(player,{x:0,z:0,vx:0,vz:0,yaw:team==='home'?Math.PI:0});
 Object.assign(state.ball,{x:0,y:.11,z:0,vx:0,vy:0,vz:0,ownerId:null,targetId:null,shot:null,curve:0});
 return{game,state,player,ball:state.ball,team};
}

function bringBallIn(fixture,height=.11){
 Object.assign(fixture.ball,{x:-.55,z:-.12,y:height,vx:9,vy:-.5,vz:1.1});
}

const reach=f=>Math.hypot(f.ball.x-f.player.x,f.ball.z-f.player.z);

test('the directional first touch starts on real contact and can take the same incoming pass either side',()=>{
 for(const team of ['home','away']){
  const departures=[];
  for(const side of [-1,1]){
   const f=fixture(team),input={[team]:{x:side,z:0}};
   bringBallIn(f);f.game.update(1/60,input);
   assert.equal(f.ball.ownerId,f.player.id);assert.ok(f.ball.x<-.35,'first contact does not jump the ball across the player');
   assert.equal(Math.sign(f.ball.firstTouch.x),side);
   const contactX=f.ball.x;
   for(let i=0;i<8;i++)f.game.update(1/60,input);
   departures.push(f.ball.x-contactX);
   assert.ok(reach(f)<1.02);
   for(let i=0;i<13;i++)f.game.update(1/60,input);
   assert.equal(f.ball.firstTouch,null,'after the contact the ball follows live motion');
  }
  assert.ok(departures[0]<0&&departures[1]>.3,JSON.stringify(departures));
 }
});

test('a stationary player cushions on the incoming side and lowers a bouncing pass over time',()=>{
 const f=fixture();bringBallIn(f,.47);f.game.update(1/60);
 assert.equal(f.ball.ownerId,f.player.id);assert.ok(f.ball.firstTouch.x<0);
 assert.ok(f.ball.y>.40);
 const contactHeight=f.ball.y;
 f.game.update(1/60);
 assert.ok(f.ball.y>.19&&f.ball.y<contactHeight,'height settles rather than snapping to the turf');
 assert.ok(f.ball.x<0);
 for(let i=0;i<17;i++)f.game.update(1/60);
 assert.ok(f.ball.y<.13);assert.ok(reach(f)<.6);
});

test('walking, pushing into a sprint, and stopping use different contact distances at any render rate',()=>{
 const results=[];
 for(const fps of [15,30,60]){
  const f=fixture();Object.assign(f.ball,{z:-.44,ownerId:f.player.id});
  const phase=(seconds,input)=>{const sample=[];for(let i=0;i<fps*seconds;i++){f.game.update(1/fps,input);if(i>=fps*seconds/2)sample.push(reach(f));}return sample.reduce((sum,value)=>sum+value,0)/sample.length;};
  const walking=phase(1,{z:-1}),sprinting=phase(1,{z:-1,sprint:true}),stopped=phase(1,{x:0,z:0});
  assert.ok(sprinting>walking+.18,JSON.stringify({walking,sprinting}));
  assert.ok(stopped<walking-.12,JSON.stringify({walking,stopped}));
  results.push([f.player.x,f.player.z,f.ball.x,f.ball.z]);
 }
 for(const sample of results)for(let i=0;i<sample.length;i++)assert.ok(Math.abs(sample[i]-results[0][i])<1e-8);
});

test('an online client predicts the authoritative first touch and a restored match can continue it',()=>{
 for(const team of ['home','away']){
  const f=fixture(team),input={x:1,z:.1,sprint:true};
  bringBallIn(f);f.game.update(1/60,{[team]:input});assert.ok(f.ball.firstTouch);
  const copy=createFootballSimulation({controlMode:'manual',humanTeams:['home','away']});copy.restore(f.game.checkpoint());
  const client=createFootballSimulation({humanTeams:['home','away']}).state;
  assert.equal(applyOnlineState(client,packOnlineState(f.state,1),team),true);assert.ok(client.ball.firstTouch);
  const predictor=createOnlinePrediction(team);predictor.receive(client);
  for(let i=0;i<14;i++){
   f.game.update(1/60,{[team]:input});copy.update(1/60,{[team]:input});predictor.update(client,1/60,input,i+1);
   assert.deepEqual(copy.state,f.state);
   assert.ok(Math.hypot(client.ball.x-f.ball.x,client.ball.z-f.ball.z)<.015);
  }
  assert.equal(f.game.action('shoot',{},team),true);assert.equal(f.ball.firstTouch,null);assert.equal(f.ball.touchPhase,0);
 }
});
