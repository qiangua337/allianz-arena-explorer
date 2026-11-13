import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {normalizeRules,shootoutWinner} from '../dist/football-rules.js';
import {defaultSelection,teamSquad,validateSelection} from '../dist/football-squads.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';
const run=(s,t,input={})=>{for(let i=0;i<Math.ceil(t*60);i++)s.update(1/60,input);};
const game=(mode='league',options={})=>createFootballSimulation({duration:180,rules:{mode,duration:180},...options});
function endPeriod(simulation,elapsed){
 simulation.state.elapsed=elapsed-.01;
 for(let i=0;i<900&&simulation.state.phase!=='interval'&&simulation.state.phase!=='fulltime';i++)simulation.update(1/60);
 assert.ok(['interval','fulltime'].includes(simulation.state.phase),'the added-time period must eventually end');
}
test('both sides can choose valid independent starters and formations, with one goalkeeper and no duplicate or foreign players',()=>{for(const opponent of ['dortmund','madrid','barcelona','city'])for(const team of ['home','away']){const selection=defaultSelection(team,opponent),bench=teamSquad(team,opponent).slice(11).find(p=>!p.keeper);selection.formation='433';selection.xi[1]=bench.player.number;assert.ok(validateSelection(selection,team,opponent).ok);const s=game('league',{opponent,selections:{[team]:selection}});assert.equal(s.state.teamSheets[team].formation,'433');assert.equal(s.state.players.find(p=>p.id===team+'-1').number,bench.player.number);assert.equal(s.state.players.filter(p=>p.team===team&&p.keeper).length,1);assert.equal(validateSelection({...selection,xi:[...selection.xi.slice(1),selection.xi[1]]},team,opponent).ok,false);}});
test('normal matches stop at half time, exchange ends and kickoff team, and permit a draw at full time',()=>{const s=game();run(s,3.1);endPeriod(s,90);assert.equal(s.state.phase,'interval');assert.equal(s.state.competition.next,2);assert.equal(s.state.paused,true);assert.equal(s.state.elapsed,90);run(s,3);assert.equal(s.state.elapsed,90);assert.equal(s.continuePeriod(),true);assert.equal(s.state.competition.period,2);assert.equal(s.state.attackDirections.home,1);assert.equal(s.state.players[0].attackSign,1);assert.equal(s.state.restartTeam,'away');run(s,3);endPeriod(s,180);assert.equal(s.state.phase,'fulltime');assert.equal(s.state.competition.result.winner,null);});
test('second-half goals are credited to the team attacking that end rather than to a fixed colour',()=>{const s=game();run(s,3.1);endPeriod(s,90);s.continuePeriod();run(s,3);Object.assign(s.state.ball,{ownerId:null,x:0,y:.4,z:52.4,vx:0,vy:0,vz:20});s.update(1/60);assert.equal(s.state.score.home,1);assert.equal(s.state.score.away,0);});
test('cup draws proceed through two extra-time halves and then a shootout; a leading team wins without extra time',()=>{const s=game('cup');run(s,3.1);endPeriod(s,90);s.continuePeriod();run(s,3);endPeriod(s,180);assert.equal(s.state.competition.next,3);s.continuePeriod();assert.equal(s.state.duration,240);run(s,3);endPeriod(s,210);assert.equal(s.state.competition.next,4);s.continuePeriod();run(s,3);endPeriod(s,240);assert.equal(s.state.competition.next,'shootout');s.continuePeriod();assert.equal(s.state.phase,'penalties');assert.equal(s.state.competition.shootout.stage,'ready');assert.equal(s.state.competition.shootout.eligible.home.length,11);});
test('substitutions wait for a real stoppage, change identity and stamina, and substituted players cannot return',()=>{const s=game();run(s,3.1);const out=s.state.players[1],bench=teamSquad('home').slice(11).find(p=>!p.keeper),old=out.number;out.stamina=.2;assert.deepEqual(s.substitute('home',out.id,bench.player.number),{ok:true,queued:true});assert.equal(out.number,old);Object.assign(s.state.ball,{ownerId:null,x:34.2,y:.11,z:0,vx:0,vy:0,vz:0});s.update(1/60);assert.equal(out.number,bench.player.number);assert.equal(out.stamina,1);assert.equal(s.state.teamSheets.home.substitutions.length,1);assert.equal(s.state.teamSheets.home.windows,1);assert.equal(s.substitute('home',out.id,old).ok,false);});
test('reckless contact produces a real free kick and a second yellow dismisses the player and changes the controller',()=>{const s=game();run(s,3.1);function foul(){const p=s.state.players[1],owner=s.state.players[12];Object.assign(p,{x:0,z:0,vx:5.7,vz:0,yaw:Math.PI,tackleAt:0});Object.assign(owner,{x:0,z:1,yaw:0,protectedUntil:0});Object.assign(s.state.ball,{ownerId:owner.id,x:0,y:.11,z:1.58,vx:0,vz:0});s.action('tackle');}foul();assert.equal(s.state.discipline.home.yellows,1);assert.equal(s.state.restartType,'freeKick');run(s,2);foul();assert.equal(s.state.discipline.home.yellows,2);assert.equal(s.state.discipline.home.reds,1);assert.equal(s.state.players[1].dismissed,true);assert.notEqual(s.state.controlledIds.home,'home-1');assert.equal(s.state.players.filter(p=>p.team==='home'&&!p.dismissed).length,10);});
test('shootout scoring supports early clinches and equal-attempt sudden death without altering the match score',()=>{assert.equal(shootoutWinner([true,true,true],[false,false,false]),'home');assert.equal(shootoutWinner([true,true,true,true,true,true],[true,true,true,true,true]),null);assert.equal(shootoutWinner([true,true,true,true,true,true],[true,true,true,true,true,false]),'home');const s=game('shootout');assert.equal(s.state.phase,'penalties');assert.equal(s.action('shoot',{power:.8,direction:{x:1,z:0}}),true);run(s,1.2);assert.equal(s.state.competition.shootout.home.length,1);assert.deepEqual(s.state.score,{home:0,away:0});assert.ok(['result','ready'].includes(s.state.competition.shootout.stage));});
test('an autonomous shootout completes through real kicks and keeper physics with a winner',()=>{const s=game('shootout',{humanTeams:[],seed:138});let steps=0;while(s.state.phase!=='fulltime'&&steps++<60*240)s.update(1/60);assert.equal(s.state.phase,'fulltime');assert.ok(s.state.competition.result.winner);assert.equal(s.state.competition.result.reason,'penalties');assert.deepEqual(s.state.score,{home:0,away:0});});

test('substitution limits count players and stoppage windows separately, exempt half time, and grant one additional extra-time slot',()=>{
 const g=game('cup'),sheet=g.state.teamSheets.home,bench=sheet.bench.filter(n=>!teamSquad().find(p=>p.player.number===n).keeper),replace=(slot,n)=>g.substitute('home','home-'+slot,n);
 assert.equal(replace(1,bench[0]).ok,true);assert.equal(replace(2,bench[1]).ok,true);assert.equal(sheet.windows,1,'two substitutions at one stoppage are one opportunity');
 function newStoppage(){run(g,3.1);Object.assign(g.state.ball,{ownerId:null,x:34.3,y:.11,z:0,vx:0,vy:0,vz:0});g.update(1/60);assert.equal(g.state.phase,'kickoff');}
 newStoppage();assert.equal(replace(3,bench[2]).ok,true);newStoppage();assert.equal(replace(4,bench[3]).ok,true);assert.equal(sheet.windows,3);
 run(g,2);assert.equal(replace(5,bench[4]).ok,false,'a fourth in-play window is unavailable');endPeriod(g,90);assert.equal(g.state.phase,'interval');assert.equal(replace(5,bench[4]).ok,true);assert.equal(sheet.windows,3);assert.equal(sheet.substitutions.length,5);assert.equal(replace(6,bench[5]).ok,false,'five players in regulation');
 g.continuePeriod();run(g,3);g.state.score={home:0,away:0};endPeriod(g,180);g.continuePeriod();run(g,3);assert.equal(g.state.competition.period,3);assert.equal(replace(6,bench[5]).ok,true);Object.assign(g.state.ball,{ownerId:null,x:34.3,y:.11,z:0,vx:0,vy:0,vz:0});g.update(1/60);assert.equal(sheet.substitutions.length,6);assert.equal(sheet.windows,4);assert.equal(replace(7,bench[6]).ok,false);
});

test('dangerous contact in the defending penalty area awards a penalty and an immediate red card',()=>{
 const g=game();run(g,3.1);const p=g.state.players[1],owner=g.state.players[12];Object.assign(p,{x:0,z:50,vx:7.5,vz:0,tackleAt:0});Object.assign(owner,{x:0,z:51,yaw:0,protectedUntil:0});Object.assign(g.state.ball,{ownerId:owner.id,x:0,y:.11,z:51.58,vx:0,vz:0});g.action('tackle');assert.equal(g.state.restartType,'penaltyKick');assert.equal(g.state.ball.z,41.5);assert.equal(g.state.discipline.home.reds,1);assert.equal(p.cautions,0);assert.equal(p.dismissed,true);
});

test('compact online frames preserve actual replacement identities, disciplinary cards and second-half ends without resending team sheets',()=>{
 const server=game(),client=game();const bench=server.state.teamSheets.home.bench.find(n=>!teamSquad().find(p=>p.player.number===n).keeper);server.substitute('home','home-1',bench);server.state.players[2].cautions=1;server.state.players[3].dismissed=true;server.state.attackDirections={home:1,away:-1};server.state.competition.period=2;
 assert.equal(applyOnlineState(client.state,packOnlineState(server.state,1),'away'),true);assert.equal(client.state.players[1].number,bench);assert.equal(client.state.players[1].name,teamSquad().find(p=>p.player.number===bench).player.name);assert.equal(client.state.players[2].cautions,1);assert.equal(client.state.players[3].dismissed,true);assert.equal(client.state.players[1].attackSign,1);const sheet=structuredClone(client.state.teamSheets);applyOnlineState(client.state,packOnlineState(server.state,2,{},false),'away');assert.deepEqual(client.state.teamSheets,sheet);assert.equal(client.state.competition.period,2);
 const restored=game();restored.restore(server.checkpoint());assert.deepEqual(restored.state.teamSheets,server.state.teamSheets);assert.deepEqual(restored.state.competition,server.state.competition);
});

test('the clock announces an independent minimum per half and uses actual match stoppages',()=>{
 const s=game('league',{humanTeams:['home','away']});
 run(s,3.3);
 assert.equal(s.state.competition.addedTime.lost,0,'starting whistle setup does not count');
 for(let i=0;i<3;i++){
  Object.assign(s.state.ball,{ownerId:null,x:34.3,y:.11,z:0,vx:0,vy:0,vz:0});
  run(s,.05);
  assert.equal(s.state.phase,'kickoff');
  run(s,2.1);
  assert.equal(s.state.phase,'playing');
 }
 const lost=s.state.competition.addedTime.lost;
 assert.ok(lost>5&&lost<6);
 s.setPaused(true);
 run(s,4);
 assert.equal(s.state.competition.addedTime.lost,lost);
 s.setPaused(false);
 s.state.elapsed=89.99;
 run(s,.05);
 assert.equal(s.state.elapsed,90);
 assert.equal(s.state.phase,'playing');
 assert.equal(s.state.competition.addedTime.minimum,4,'observed throw-in delays raise the minimum from one to two match minutes');
 run(s,3);
 assert.equal(s.state.phase,'playing');
 assert.equal(s.state.elapsed,90);
 endPeriod(s,90);
 assert.ok(s.state.competition.addedTime.played>=4&&s.state.competition.addedTime.played<4+1/60);
 assert.equal(s.continuePeriod(),true);
 assert.deepEqual(s.state.competition.addedTime,{lost:0,minimum:0,played:0,attackingTeam:null});
 run(s,3.1);
 s.state.elapsed=179.99;
 run(s,.05);
 assert.equal(s.state.phase,'playing');
 assert.equal(s.state.competition.addedTime.minimum,2);
 endPeriod(s,180);
 assert.equal(s.state.elapsed,180);
 assert.equal(s.state.phase,'fulltime');
});

test('at the added-time limit an imminent shot can score before the whistle, including after a checkpoint',()=>{
 const s=game('league',{humanTeams:['home','away']});
 run(s,3.2);
 s.state.elapsed=90;
 Object.assign(s.state.competition.addedTime,{minimum:2,played:2-.005});
 const goalkeeper=s.state.players.find(p=>p.team==='away'&&p.keeper);
 goalkeeper.x=7;
 Object.assign(s.state.ball,{ownerId:null,shot:{id:1,team:'home'},x:0,y:.5,z:-52.38,vx:0,vy:0,vz:-18});
 const restored=game('league',{humanTeams:['home','away']});
 restored.restore(s.checkpoint());
 for(const simulation of [s,restored]){
  simulation.update(1/60);
  assert.equal(simulation.state.score.home,1);
  assert.equal(simulation.state.phase,'goal');
  assert.equal(simulation.state.competition.addedTime.attackingTeam,'home');
  run(simulation,3.8);
  assert.equal(simulation.state.phase,'interval');
  assert.equal(simulation.state.competition.addedTime.attackingTeam,null);
 }
 assert.deepEqual(s.state.competition,restored.state.competition);
 const client=game().state;
 applyOnlineState(client,packOnlineState(s.state,50),'away');
 assert.equal(client.competition.addedTime.minimum,2);
 assert.ok(client.competition.addedTime.played>=2);
});

test('a final attack ends when the ball retreats or changes sides and cannot prolong the period indefinitely',()=>{
 function lateAttack(){
  const s=game('league',{controlMode:'manual',humanTeams:['home','away']});
  run(s,3.2);
  s.state.elapsed=90;
  Object.assign(s.state.competition.addedTime,{minimum:2,played:2});
  const player=s.state.players[1];
  Object.assign(player,{x:14,z:-45,vz:0,yaw:Math.PI,protectedUntil:100});
  Object.assign(s.state.ball,{ownerId:player.id,x:14,y:.11,z:-45.6,vx:0,vy:0,vz:0});
  s.update(1/60);
  assert.equal(s.state.competition.addedTime.attackingTeam,'home');
  assert.equal(s.state.phase,'playing');
  return s;
 }
 const retreat=lateAttack();
 retreat.state.ball.z=-26;
 retreat.update(1/60);
 assert.equal(retreat.state.phase,'interval');
 const turnover=lateAttack(),away=turnover.state.players[12];
 Object.assign(away,{x:12,z:44,vz:1});
 Object.assign(turnover.state.ball,{ownerId:away.id,x:12,z:44});
 turnover.update(1/60);
 assert.equal(turnover.state.phase,'interval');
 const hold=lateAttack();
 run(hold,2.6);
 assert.equal(hold.state.phase,'interval');
 assert.ok(hold.state.competition.addedTime.played<=4.5);
});
