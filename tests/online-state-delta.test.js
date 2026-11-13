import assert from 'node:assert/strict';
import test from 'node:test';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {applyOnlineState,packOnlineState} from '../dist/online-protocol.js';
import {decodeOnlineDelta,encodeOnlineDelta,ONLINE_DELTA_CAPABILITY} from '../dist/online-state-delta.js';

const fixture=()=>createFootballSimulation({
 duration:180,rules:{mode:'league',duration:180},opponent:'madrid',humanTeams:['home','away'],seed:972
});
const roundTrip=value=>JSON.parse(JSON.stringify(value));
const wire=(simulation,seq,details=true)=>roundTrip(packOnlineState(simulation.state,seq,{home:seq,away:seq},details));
const advance=(simulation,seconds,input={})=>{
 for(let tick=0;tick<Math.round(seconds*60);tick++)simulation.update(1/60,input);
};

test('live compact frames reconstruct the same authoritative sequence with less serialized traffic',t=>{
 assert.equal(ONLINE_DELTA_CAPABILITY,'state-delta-v1');
 const game=fixture();
 advance(game,3.1);
 let previous=wire(game,1),decoded=previous,fullBytes=0,compactBytes=0;
 const actionEvents=new Set();
 for(let seq=2;seq<=600;seq++){
  const input={home:{x:Math.sin(seq*.021),z:Math.cos(seq*.021)},away:{x:Math.cos(seq*.031),z:Math.sin(seq*.031)}};
  advance(game,.05,input);
  const id=game.state.ball.ownerId,team=id?.split('-')[0];
  if(seq%13===0&&id&&game.state.controlledIds[team]===id){
   const type=seq%3===0?'shoot':'pass',eventCount=game.state.eventCount;
   game.action(type,{direction:input[team],power:.5},team);
   const event=game.state.events.find(candidate=>candidate.id>eventCount&&candidate.type===(type==='shoot'?'shot':'pass'));
   if(event)actionEvents.add(event.type);
  }
  const keyframe=(seq-1)%20===0;
  const current=wire(game,seq,keyframe);
  fullBytes+=Buffer.byteLength(JSON.stringify({type:'state',state:keyframe?wire(game,seq,false):current}));
  if(keyframe){
   // A periodic full frame is independent of the preceding delta.
   const full=JSON.stringify({type:'state',state:current});
   decoded=JSON.parse(full).state;
   compactBytes+=Buffer.byteLength(full);
  }else{
   const delta=encodeOnlineDelta(previous,current);
   assert.equal(delta.base,previous.seq);
   assert.equal(delta.seq,current.seq);
   const payload=JSON.stringify({type:'state',delta});
   compactBytes+=Buffer.byteLength(payload);
   decoded=decodeOnlineDelta(decoded,JSON.parse(payload).delta);
  }
  assert.deepEqual(decoded,current,`snapshot ${seq}`);
  previous=current;
 }
 assert.deepEqual([...actionEvents].sort(),['pass','shot']);
 assert.ok(compactBytes<fullBytes*.75,`compact ${compactBytes} B vs full ${fullBytes} B`);
 t.diagnostic(`599 serialized snapshots including periodic keyframes: ${fullBytes} B full, ${compactBytes} B compact`);
});

test('a compact penalty snapshot keeps goalkeeper state and explicitly clears it at the transition',()=>{
 const game=fixture();
 advance(game,3.1);
 const state=game.state,keeper=state.players[11],taker=state.players[1],baseline=wire(game,1);
 Object.assign(state,{
  setPiece:{team:'home',keeper:keeper.id,taker:taker.id,stage:'flight'},
  lastShot:{outcome:'flight',playerId:taker.id}
 });
 Object.assign(keeper,{keeperState:{phase:'dive',direction:1,height:.75},motion:{id:3,type:'save',elapsed:.15,duration:.6},vx:-.8,cautions:1});
 const flight=wire(game,2),delta=roundTrip(encodeOnlineDelta(baseline,flight));
 const prior=structuredClone(baseline),decoded=decodeOnlineDelta(baseline,delta);
 assert.deepEqual(decoded,flight);
 assert.deepEqual(baseline,prior);
 const home=fixture().state,away=fixture().state;
 assert.ok(applyOnlineState(home,decoded,'home'));
 assert.ok(applyOnlineState(away,decoded,'away'));
 assert.equal(away.players[11].keeperState.direction,1);
 assert.equal(home.players[11].motion.id,3);
 assert.equal(home.players[11].cautions,1);
 assert.equal(home.setPiece.stage,'flight');

 Object.assign(state,{setPiece:null,lastShot:null,message:'',phase:'interval',elapsed:90,paused:true});
 Object.assign(keeper,{keeperState:{phase:'ready'},motion:null,vx:0,cautions:0});
 const interval=wire(game,3),clearDelta=roundTrip(encodeOnlineDelta(flight,interval));
 assert.equal(clearDelta.fields.setPiece,null);
 assert.equal(clearDelta.fields.lastShot,null);
 assert.equal(clearDelta.fields.message,'');
 const cleared=decodeOnlineDelta(decoded,clearDelta);
 assert.deepEqual(cleared,interval);
 assert.ok(applyOnlineState(away,cleared,'away'));
 assert.equal(away.phase,'interval');
 assert.equal(away.setPiece,null);
 assert.equal(away.players[11].motion,null);
 assert.equal(away.players[11].vx,0);
 assert.equal(away.players[11].cautions,0);
 assert.deepEqual(away.players[11].keeperState,{phase:'ready'});
});

test('the penalty run-up clock is public but committed shot and dive inputs stay private',()=>{
 const game=fixture(),state=game.state;
 const runup={
  stage:'runup',time:.3,runupDuration:.8,
  pendingKick:{aim:{x:.91,y:-.77},power:.82},queuedDive:{direction:{x:-1}}
 };
 state.setPiece={type:'penalty',...runup};
 state.competition.shootout={...runup,home:[],away:[]};
 const packet=wire(game,1);
 for(const penalty of [packet.setPiece,packet.competition.shootout]){
  assert.equal(penalty.stage,'runup');
  assert.equal(penalty.time,.3);
  assert.equal(penalty.runupDuration,.8);
  assert.equal(Object.hasOwn(penalty,'pendingKick'),false);
  assert.equal(Object.hasOwn(penalty,'queuedDive'),false);
 }
});

test('optional team details can be omitted and later supplied without keeping stale raw fields',()=>{
 const game=fixture();
 const initial=wire(game,3);
 const live=wire(game,4,false);
 assert.ok(initial.teamSheets&&initial.discipline);
 assert.equal(Object.hasOwn(live,'teamSheets'),false);
 assert.equal(Object.hasOwn(live,'discipline'),false);
 const delta=roundTrip(encodeOnlineDelta(initial,live));
 const decoded=decodeOnlineDelta(initial,delta);
 assert.deepEqual(decoded,live);
 assert.ok(initial.teamSheets&&initial.discipline);
 const later=wire(game,5);
 assert.deepEqual(decodeOnlineDelta(decoded,roundTrip(encodeOnlineDelta(live,later))),later);
});

test('compact frames reject a missing baseline, stale base or malformed player mask atomically',()=>{
 const game=fixture();
 advance(game,3.1);
 const prior=wire(game,20);
 advance(game,.1,{home:{x:1,z:0}});
 const current=wire(game,21),valid=roundTrip(encodeOnlineDelta(prior,current)),before=structuredClone(prior);
 assert.deepEqual(decodeOnlineDelta(prior,valid),current);
 assert.equal(decodeOnlineDelta(null,valid),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,base:19}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,fields:[]}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,players:null}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,players:[[22,1,9]]}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,players:[[1,1<<17,9]]}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,players:[[1,3,9]]}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,players:[[1,1,9],[1,2,9]]}),null);
 assert.equal(decodeOnlineDelta(prior,{...valid,fields:{players:[]}}),null);
 assert.deepEqual(prior,before);
});
