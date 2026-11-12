import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {createOnlineSimulation} from '../dist/online-client.js';
import {createOnlineInterpolation} from '../dist/online-prediction.js';
import {packOnlineState} from '../dist/online-protocol.js';

const advance=(game,steps,input={})=>{
 for(let frame=0;frame<steps;frame++)game.update(1/60,input);
};

function delayedSeat(game,team){
 const listeners=new Set();let seq=0,packet=0;
 const session={team,opponent:'dortmund',connection:'connected',latency:300,
  room:{started:true,ended:false,rules:{mode:'shootout',duration:180}},
  packet:packOnlineState(game.state,++packet),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  sendInput(){return++seq;},send(){return true;},leave(){}};
 const client=createOnlineSimulation(session);
 return{client,deliver(){session.packet=packOnlineState(game.state,++packet);for(const fn of listeners)fn();}};
}

test('the shootout keeper moves immediately along the line while waiting, and the shootout taker remains planted',()=>{
 const game=createFootballSimulation({humanTeams:['home','away'],rules:{mode:'shootout'}}),{client:keeper}=delayedSeat(game,'away'),{client:taker}=delayedSeat(game,'home');
 const p=keeper.state.players[11],startX=p.x,startZ=p.z,takerStart=taker.state.players[1].x,ball={...taker.state.ball};
 try{
  advance(keeper,12,{x:-1,z:1});advance(taker,12,{x:1,z:1});
  assert.ok(p.x<startX-.24);
  assert.equal(p.z,startZ);
  assert.equal(taker.state.players[1].x,takerStart);
  assert.deepEqual(taker.state.ball,ball);
  assert.equal(keeper.state.competition.shootout.keeperReady,false);
 }finally{keeper.dispose();taker.dispose();}
});

test('a high directional dive remains visible through pre-action snapshots and the change to ball flight',()=>{
 const game=createFootballSimulation({humanTeams:['home','away'],rules:{mode:'shootout'}});
 assert.ok(game.action('penalty-ready',{},'away'));
 advance(game,154);
 const {client,deliver}=delayedSeat(game,'away'),keeper=client.state.players[11];
 const input={direction:{x:-1},penaltyAim:{y:1}};
 try{
  assert.ok(client.action('tackle',input));advance(client,4);
  assert.equal(keeper.motion.type,'dive');assert.equal(keeper.motion.direction,-1);assert.ok(keeper.motion.height>1.9);
  assert.ok(keeper.x<-.015);
  advance(game,3);deliver();advance(client,2);
  assert.equal(keeper.motion.id,-1);assert.equal(keeper.keeperState.phase,'dive');
  assert.ok(game.action('shoot',{power:.6,penaltyAim:{x:-.7,y:1}},'home'));
  advance(game,2);deliver();advance(client,2);
  assert.equal(keeper.motion.id,-1);assert.equal(keeper.keeperState.direction,-1);
  assert.ok(game.action('tackle',input,'away'));advance(game,2);deliver();advance(client,2);
  assert.ok(keeper.motion.id>=0);
  assert.equal(keeper.keeperState.direction,-1);
  assert.equal(keeper.z,-52.38);
 }finally{client.dispose();}
});

test('a live penalty clears the delayed render buffer so the keeper sees the current ball position',()=>{
 const game=createFootballSimulation(),state=game.state,buffer=createOnlineInterpolation();
 Object.assign(state,{phase:'playing',time:2});buffer.receive(state);
 state.time+=.05;state.ball.z=-40;buffer.receive(state);assert.equal(buffer.bufferedFrames,2);
 Object.assign(state,{setPiece:{type:'penalty',stage:'flight'},time:state.time+.05});state.ball.z=-44;
 buffer.receive(state);buffer.update(state,1/60,70);
 assert.equal(buffer.bufferedFrames,0);assert.equal(state.ball.z,-44);
});
