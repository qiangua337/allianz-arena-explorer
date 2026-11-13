import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';
import {createOnlineSimulation} from '../dist/online-client.js';
import {penaltyTarget} from '../dist/football-penalty.js';

const run=(g,frames,input={})=>{for(let i=0;i<frames;i++)g.update(1/60,input);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
function award({seed=1,team='home',period=1,humanTeams=['home','away']}={}){
 const g=createFootballSimulation({seed,humanTeams,controlMode:'manual',rules:{mode:'league',duration:180}});run(g,190);
 if(period===2){g.state.elapsed=89.99;run(g,150);assert.equal(g.continuePeriod(),true);run(g,170);}
 const sign=g.attackSign(team),defending=team==='home'?'away':'home',a=g.state.players.find(p=>p.id===team+'-1'),d=g.state.players.find(p=>p.id===defending+'-1');
 // Trigger the real foul adjudication; keep the naturally simulated goalkeeper.
 Object.assign(a,{x:0,z:sign*42,yaw:sign<0?Math.PI:0,vx:0,vz:0,protectedUntil:0,tackleAt:0});Object.assign(d,{x:0,z:sign*41,yaw:a.yaw,vx:0,vz:sign*5.4,tackleAt:0});Object.assign(g.state.ball,{x:0,y:.11,z:sign*42.6,vx:0,vy:0,vz:0,ownerId:a.id,shot:null});g.action('tackle',{},defending);
 assert.equal(g.state.restartType,'penaltyKick');assert.equal(g.state.setPiece?.team,team);return{g,sign,team,defending};
}
function confirm(f){assert.equal(f.g.action('penalty-ready',{},f.defending),true);run(f.g,150);}
function ready(options){const f=award(options);run(f.g,115);assert.equal(f.g.state.setPiece.stage,'ready');confirm(f);return f;}
function strike(g){const k=g.state.setPiece||g.state.competition.shootout;assert.equal(k.stage,'runup');run(g,Math.ceil(k.runupDuration*60));assert.equal(k.stage,'flight');}
function shoot(f,side=.8,power=.7){assert.equal(f.g.action('shoot',{power,direction:{x:side,z:f.sign}},f.team),true);strike(f.g);}
function online(g,team){const listeners=new Set();let seq=0,packetSeq=0;const session={team,opponent:'dortmund',connection:'connected',latency:300,room:{started:true,ended:false,rules:{mode:'league',duration:180}},packet:packOnlineState(g.state,++packetSeq),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},sendInput(){return++seq;},send(){return true;},leave(){}};const client=createOnlineSimulation(session,{controlMode:'manual'});return{client,deliver(){session.packet=packOnlineState(g.state,++packetSeq,{[team]:seq});for(const fn of listeners)fn();}};}

test('real penalties at either end in both halves put the ball on 11m and give each human the correct role',()=>{
 for(const team of ['home','away'])for(const period of [1,2]){const{g,sign,defending}=award({team,period}),k=g.state.setPiece,p=g.state.players.find(p=>p.id===k.taker),keeper=g.state.players.find(p=>p.id===k.keeper),spot=sign*41.5;
  assert.equal(g.state.phase,'kickoff');assert.equal(k.stage,'setup');close(g.state.ball.z,spot);close(p.z,spot-sign*2.65);close(keeper.z,sign*52.38);assert.equal(g.state.controlledIds[team],p.id);assert.equal(g.state.controlledIds[defending],keeper.id);assert.equal(g.action('shoot',{},team),false);
  const elapsed=g.state.elapsed;run(g,115,{[team]:{x:1,z:1},[defending]:{x:1,z:-sign}});assert.equal(g.state.phase,'playing');assert.equal(k.stage,'ready');close(g.state.ball.z,spot);close(p.x,p.number%2?.74:-.74);close(p.z,spot-sign*2.65);close(keeper.z,sign*52.38);assert.ok(keeper.x>0);close(g.state.elapsed,elapsed);assert.equal(g.action('pass',{},team),false);assert.equal(g.action('switch',{},defending),false);
 }
});

test('penalty direction and charge affect the real flight, while pause prevents a kick',()=>{
 const f=ready(),saved=f.g.checkpoint(),flights=[];for(const [side,power]of [[-.8,.3],[.8,.3],[.8,.85]]){f.g.restore(saved);shoot(f,side,power);flights.push({...f.g.state.ball});assert.equal(f.g.state.lastShot.power,power);}
 assert.ok(flights[0].vx<0&&flights[1].vx>0);assert.ok(Math.abs(flights[2].vz)>Math.abs(flights[1].vz)+6);f.g.restore(saved);f.g.setPaused(true);assert.equal(f.g.action('shoot',{power:.8},'home'),false);run(f.g,60);assert.equal(f.g.state.setPiece.stage,'ready');f.g.setPaused(false);shoot(f);
});

test('32 seeded physical penalties reward the correct dive and punish the wrong one, without changing shootout counters',()=>{
 for(let seed=1;seed<=32;seed++)for(const team of ['home','away'])for(const dive of [1,-1]){const f=ready({seed,team});shoot(f);run(f.g,3);assert.equal(f.g.action('tackle',{direction:{x:dive}},f.defending),true);assert.equal(f.g.action('tackle',{direction:{x:-dive}},f.defending),false,'a committed dive cannot reverse');run(f.g,60);
  assert.equal(f.g.state.setPiece,null);assert.equal(f.g.state.competition.shootout,null);if(dive===1){assert.equal(f.g.state.score[team],0);assert.equal(f.g.state.stats[f.defending].saves,1);assert.ok(['saved','parried'].includes(f.g.state.lastShot.outcome));assert.equal(f.g.state.phase,'playing');}else{assert.equal(f.g.state.score[team],1);assert.equal(f.g.state.lastShot.outcome,'goal');}assert.equal(f.g.state.controlledIds[f.defending],f.defending+'-1');
 }
});

test('a save or post rebound resumes ordinary live play and cursor switching; a goal returns to normal kickoff',()=>{
 const f=ready();shoot(f);run(f.g,3);f.g.action('tackle',{direction:{x:1}},f.defending);run(f.g,27);assert.equal(f.g.state.setPiece,null);assert.equal(f.g.state.phase,'playing');assert.equal(f.g.action('switch',{},f.defending),true);const elapsed=f.g.state.elapsed;run(f.g,10);assert.ok(f.g.state.elapsed>elapsed);
 const post=ready();shoot(post);Object.assign(post.g.state.ball,{x:3.66,y:.9,z:post.sign*52.2,vx:0,vy:0,vz:post.sign*25});post.g.update(1/60);assert.equal(post.g.state.lastShot.outcome,'woodwork');assert.equal(post.g.state.setPiece,null);assert.equal(post.g.state.phase,'playing');assert.equal(post.g.state.ball.ownerId,null);
 const goal=ready();shoot(goal);run(goal.g,280);assert.equal(goal.g.state.setPiece,null);assert.equal(goal.g.state.restartType,'kickoff');assert.equal(goal.g.state.restartTeam,goal.defending);assert.equal(goal.g.state.score.home,1);
});

test('ordinary penalty misses use the real goal-kick restart and restore the outfield cursor',()=>{
 const f=ready();shoot(f);Object.assign(f.g.state.ball,{x:7,y:1,z:f.sign*52.4,vx:0,vy:0,vz:f.sign*25});f.g.update(1/60);assert.equal(f.g.state.restartType,'goalkick');assert.equal(f.g.state.restartTeam,f.defending);assert.equal(f.g.state.setPiece,null);assert.equal(f.g.state.score.home,0);assert.equal(f.g.state.controlledIds[f.defending],f.defending+'-1');run(f.g,120);assert.equal(f.g.state.phase,'playing');
});

function setPenaltyAtWhistle(f,period=1){
 f.g.state.elapsed=period*90;
 Object.assign(f.g.state.competition.addedTime,{minimum:2,played:2});
}

test('a penalty awarded at the period limit completes before halftime or full time',()=>{
 for(const period of [1,2]){const f=ready({period});setPenaltyAtWhistle(f,period);shoot(f);run(f.g,20);assert.equal(f.g.state.phase,'playing');assert.equal(f.g.state.setPiece.stage,'flight');run(f.g,270);assert.equal(f.g.state.score.home,1);assert.equal(f.g.state.setPiece,null);assert.equal(f.g.state.phase,period===1?'interval':'fulltime');assert.equal(f.g.state.elapsed,period*90);}
});

test('an extended penalty can physically strike the post and then enter either goal before the whistle',()=>{
 for(const team of ['home','away'])for(const period of [1,2]){const f=ready({team,period});setPenaltyAtWhistle(f,period);shoot(f);Object.assign(f.g.state.ball,{x:3.35,y:.9,z:f.sign*52.15,vx:10,vy:0,vz:f.sign*20});f.g.update(1/60);assert.equal(f.g.state.lastShot.outcome,'woodwork');assert.equal(f.g.state.score[team],0);assert.equal(f.g.state.setPiece.extended,true);assert.equal(f.g.state.phase,'playing');run(f.g,3);assert.equal(f.g.state.score[team],1);assert.equal(f.g.state.lastShot.outcome,'goal');run(f.g,240);assert.equal(f.g.state.phase,period===1?'interval':'fulltime');}
});

test('a goalkeeper parry during an extended penalty does not stop the still-moving ball',()=>{
 const f=ready();setPenaltyAtWhistle(f);shoot(f);run(f.g,3);f.g.action('tackle',{direction:{x:1}},f.defending);let steps=0;while(f.g.state.lastShot.outcome==='flight'&&steps++<60)f.g.update(1/60);assert.equal(f.g.state.lastShot.outcome,'parried');assert.equal(f.g.state.phase,'playing');assert.equal(f.g.state.setPiece.extended,true);assert.ok(Math.hypot(f.g.state.ball.vx,f.g.state.ball.vz)>1);run(f.g,600);assert.equal(f.g.state.setPiece,null);assert.equal(f.g.state.phase,'interval');
});

test('AI penalties resolve into live play, and the shot timeout begins only after a human keeper confirms',()=>{
 for(let seed=1;seed<=12;seed++){const f=award({seed,humanTeams:[]});run(f.g,600);assert.equal(f.g.state.setPiece,null);assert.ok(f.g.state.stats.home.shots>0);assert.ok(f.g.state.elapsed>.2);}
 const f=award();run(f.g,1450);assert.equal(f.g.state.setPiece.stage,'ready');assert.equal(f.g.state.stats.home.shots,0);assert.equal(f.g.action('penalty-ready',{},f.team),false);confirm(f);run(f.g,1280);assert.equal(f.g.state.setPiece,null);assert.equal(f.g.state.stats.home.shots,1);assert.ok(f.g.state.elapsed>0);
});

test('checkpoint recovery preserves setup, ready and mid-dive penalty authority and deterministic outcomes',()=>{
 const f=award();for(const stage of ['setup','ready','runup','flight']){if(stage==='ready')run(f.g,115);if(stage==='runup'){confirm(f);assert.ok(f.g.action('shoot',{power:.7},f.team));run(f.g,7);}
 if(stage==='flight'){const k=f.g.state.setPiece;run(f.g,Math.ceil((k.runupDuration-k.time)*60));run(f.g,3);f.g.action('tackle',{direction:{x:1}},f.defending);run(f.g,4);}assert.equal(f.g.state.setPiece.stage,stage);const recovered=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual',rules:{mode:'league',duration:180}});recovered.restore(f.g.checkpoint());run(f.g,stage==='flight'?35:3);run(recovered,stage==='flight'?35:3);assert.deepEqual(recovered.state,f.g.state);}
});

test('online role packets preserve ordinary penalties and keeper dives with backward-compatible optional fields',()=>{
 const f=ready(),home=createFootballSimulation().state,away=createFootballSimulation().state;shoot(f);run(f.g,3);f.g.action('tackle',{direction:{x:1}},f.defending);const packet=packOnlineState(f.g.state,10);assert.equal(applyOnlineState(home,packet,'home'),true);assert.equal(applyOnlineState(away,packet,'away'),true);assert.equal(home.controlledId,f.g.state.setPiece.taker);assert.equal(away.controlledId,f.g.state.setPiece.keeper);assert.equal(away.players[11].keeperState.direction,1);assert.equal(away.setPiece.stage,'flight');assert.deepEqual(home.score,away.score);
 const legacy=structuredClone(packet);delete legacy.setPiece;legacy.players.forEach(a=>a.length=16);assert.equal(applyOnlineState(away,legacy,'away'),true);assert.equal(away.setPiece,null);assert.equal(away.players[11].keeperState.phase,'dive');
});

test('300ms online prediction freezes the taker and ball, keeps the goalie on the line, and predicts the selected dive',()=>{
 for(const team of ['home','away']){const f=ready({team}),a=online(f.g,team),b=online(f.g,f.defending),taker=a.client.state.players.find(p=>p.id===a.client.state.controlledId),keeper=b.client.state.players.find(p=>p.id===b.client.state.controlledId),original={x:taker.x,z:taker.z,ball:{...a.client.state.ball}},line=keeper.z;
  for(let i=0;i<12;i++){a.client.update(1/60,{x:1,z:f.sign});b.client.update(1/60,{x:1,z:-f.sign});}close(taker.x,original.x);close(taker.z,original.z);assert.deepEqual(a.client.state.ball,original.ball);assert.ok(keeper.x>.15);close(keeper.z,line);shoot(f);a.deliver();b.deliver();assert.equal(b.client.action('tackle',{direction:{x:-1}}),true);b.client.update(1/60,{});assert.equal(keeper.motion.type,'dive');assert.equal(keeper.motion.direction,-keeper.attackSign);run(f.g,3);a.deliver();b.deliver();for(let i=0;i<6;i++)b.client.update(1/60,{x:1,z:f.sign});close(keeper.z,line);a.client.dispose();b.client.dispose();
 }
});

test('a human keeper can prepare as long as needed and gets a full countdown after confirming',()=>{
 const g=createFootballSimulation({rules:{mode:'shootout'}}),k=g.state.competition.shootout;
 assert.equal(g.action('shoot',{power:.66,penaltyAim:{x:.9,y:.9}},'home'),true);run(g,225);
 assert.equal(k.team,'away');assert.equal(k.keeperReady,false);run(g,1800);
 assert.equal(k.stage,'ready');assert.equal(g.state.stats.away.shots,0);
 assert.equal(g.action('penalty-ready',{},'away'),false);assert.equal(g.action('tackle',{direction:{x:1}},'home'),false);
 assert.equal(g.action('penalty-ready',{},'home'),true);assert.equal(g.action('penalty-ready',{},'home'),false);
 run(g,149);assert.equal(k.stage,'ready');assert.equal(g.action('shoot',{power:.5},'away'),false);
 run(g,45);assert.equal(k.stage,'runup');assert.equal(g.state.stats.away.shots,0);run(g,65);assert.equal(g.state.stats.away.shots,1);
});

test('retained two-axis aim places shots low or high at either end regardless of ordinary shot style',()=>{
 for(const team of ['home','away'])for(const x of [-.84,.84])for(const y of [-.83,.83]){
  const f=ready({team}),target=penaltyTarget({x,y},f.sign*52.5);
  f.g.setShotKind('lob',team);
  assert.equal(f.g.action('shoot',{power:.68,penaltyAim:{x,y}},team),true);
  strike(f.g);run(f.g,3);f.g.action('tackle',{direction:{x:-Math.sign(target.x)}},f.defending);
  for(let step=0;step<65&&f.g.state.lastShot.outcome==='flight';step++)run(f.g,1);
  assert.equal(f.g.state.lastShot.outcome,'goal');
  assert.ok(Math.abs(f.g.state.ball.x-target.x)<.12);
  assert.ok(Math.abs(f.g.state.ball.y-target.y)<.15);
 }
});

test('a timed goalkeeper dive must cover the shot height and neutral input holds the centre',()=>{
 const f=ready(),saved=f.g.checkpoint();
 for(const [aimHeight,diveHeight,expected] of [[.82,.82,'parried'],[.82,-.82,'goal'],[-.82,-.82,'parried'],[-.82,.82,'goal']]){
  f.g.restore(saved);
  assert.equal(f.g.action('shoot',{power:.68,penaltyAim:{x:.68,y:aimHeight}},f.team),true);strike(f.g);run(f.g,3);
  assert.equal(f.g.action('tackle',{direction:{x:1},penaltyAim:{y:diveHeight}},f.defending),true);
  run(f.g,35);assert.equal(f.g.state.lastShot.outcome,expected);
 }
 f.g.restore(saved);shoot(f);
 assert.equal(f.g.action('tackle',{direction:{x:0},penaltyAim:{y:0}},f.defending),true);
 const keeper=f.g.state.players.find(p=>p.id===f.g.state.setPiece.keeper);run(f.g,8);
 assert.equal(keeper.keeperState.phase,'set');close(keeper.x,0);
});

test('CPU penalty keeper covers the middle and learns repeated corners while varied attempts can still score',()=>{
 function trial(seed,aims){
  const g=createFootballSimulation({rules:{mode:'shootout'},seed}),k=g.state.competition.shootout,outcomes=[];
  for(const penaltyAim of aims){
   assert.equal(k.team,'home');assert.equal(g.action('shoot',{power:.70,penaltyAim}),true);strike(g);
   for(let i=0;i<95&&k.stage==='flight';i++)run(g,1);
   assert.equal(k.stage,'result');outcomes.push(k.outcome);if(outcomes.length===aims.length)break;
   run(g,122);assert.equal(g.action('penalty-ready',{},'home'),true);
   for(let frame=0;frame<440&&k.team==='away';frame++)run(g,1);
  }
  return outcomes;
 }
 const highRight={x:.95,y:.95};
 let centerSaved=0,firstScored=0,firstSaved=0,predictableSaved=0,variedScored=0;
 for(let seed=1;seed<=24;seed++){
  centerSaved+=Number(trial(seed,[{x:0,y:0}])[0]==='saved');
  const same=trial(seed,[highRight,highRight,highRight]);
  const varied=trial(seed,[highRight,{x:-.9,y:-.8},{x:-.96,y:.91}]);
  firstScored+=Number(same[0]==='goal');firstSaved+=Number(same[0]==='saved');
  predictableSaved+=Number(same[2]==='saved');variedScored+=Number(varied[2]==='goal');
 }
 assert.ok(centerSaved>=17&&centerSaved>firstSaved,`central attempts: ${centerSaved} saves`);
 assert.ok(firstScored>=10&&firstSaved>=1,`first corner: ${firstScored} goals, ${firstSaved} saves`);
 assert.ok(predictableSaved>firstSaved,`learned corner: ${predictableSaved} saves`);
 assert.ok(variedScored>=10,`varied third shot: ${variedScored} goals`);
});

test('the kick cue leaves the ball on the spot and one queued dive commits near contact',()=>{
 const f=ready(),g=f.g,k=g.state.setPiece,ball={...g.state.ball};
 const keeper=g.state.players.find(p=>p.id===k.keeper);
 const taker=g.state.players.find(p=>p.id===k.taker),start=taker.z;
 assert.equal(g.action('tackle',{direction:{x:1}},f.defending),false);
 assert.ok(g.action('shoot',{power:.62,penaltyAim:{x:.68,y:.82}},f.team));
 assert.equal(k.stage,'runup');
 assert.equal(g.action('shoot',{power:1},f.team),false);
 assert.ok(g.action('tackle',{direction:{x:1},penaltyAim:{y:.82}},f.defending));
 assert.equal(k.diveQueued,true);
 assert.equal(g.action('tackle',{direction:{x:-1}},f.defending),false);
 run(g,20);
 assert.deepEqual(g.state.ball,ball);
 assert.ok((taker.z-start)*f.sign>.2);
 assert.equal(keeper.keeperState.phase,'ready');
 run(g,Math.ceil((k.runupDuration-k.time)*60));
 assert.equal(k.stage,'flight');
 assert.equal(k.diveQueued,false);
 assert.equal(keeper.keeperState.direction,1);
 assert.equal(g.state.lastShot.power,.62);
 run(g,45);
 assert.ok(['parried','saved'].includes(g.state.lastShot.outcome));
});
