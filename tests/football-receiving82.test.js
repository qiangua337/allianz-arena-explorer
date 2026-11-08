import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';
import {createOnlinePrediction} from '../dist/online-prediction.js';

function fixture({angle=0,mode='semi',type='pass',seed=73417,team='home',sprint=false}={}){
 const game=createFootballSimulation({controlMode:mode,seed,humanTeams:['home','away']});for(let i=0;i<184;i++)game.update(1/60);
 const s=game.state,passer=s.players.find(p=>p.id===team+'-1'),receiver=s.players.find(p=>p.id===team+'-8'),direction={x:Math.sin(angle*Math.PI/4),z:Math.cos(angle*Math.PI/4),sprint};
 for(const p of s.players)if(p!==passer&&p!==receiver)p.dismissed=true;
 for(const [p,distance]of[[passer,0],[receiver,12]])Object.assign(p,{x:direction.x*distance,z:direction.z*distance,vx:0,vz:0,yaw:Math.atan2(direction.x,direction.z),decisionAt:1e9,tackleAt:1e9});
 Object.assign(s.ball,{x:direction.x*.58,z:direction.z*.58,y:.11,vx:0,vy:0,vz:0,ownerId:passer.id});
 game.update(1/60,{[team]:direction});assert.equal(game.action(type,{direction},team),true);
 return{game,s,passer,receiver,direction,team};
}
function handoff(f){for(let i=0;i<120;i++){f.game.update(1/60,{[f.team]:f.direction});if(f.s.controlledIds[f.team]===f.receiver.id&&!f.s.ball.ownerId)return;}assert.fail('a real pass should hand control to its recipient before the ball arrives');}

test('holding the passer’s direction no longer runs a short-pass recipient away from a physical ball across sides, frame rates and assistance modes',()=>{
 for(const team of['home','away'])for(const mode of['semi','assisted'])for(const fps of[15,30,60])for(const seed of[17,73417])for(let angle=0;angle<8;angle++){
  const f=fixture({angle,mode,seed,team,sprint:seed===17});let received=false;
  for(let i=0;i<fps*4;i++){f.game.update(1/fps,{[team]:f.direction});if(f.s.ball.ownerId===f.receiver.id){received=true;break;}}
  assert.equal(received,true,JSON.stringify({team,mode,fps,seed,angle}));assert.equal(f.s.controlledIds[team],f.receiver.id);assert.equal(f.receiver.receiveControl,null);assert.equal(f.s.stats[team].passes,1);
 }
});
test('new joystick direction and release-then-repush take over on the very next movement step without an input lock',()=>{
 for(const operation of['turn','release','sprint']){
  const f=fixture({angle:4});handoff(f);assert.ok(f.receiver.receiveControl);const before={x:f.receiver.x,z:f.receiver.z};
  const input=operation==='turn'?{x:1,z:0}:operation==='release'?{x:0,z:0}:{...f.direction,sprint:true};
  f.game.update(1/60,{home:input});assert.equal(f.receiver.receiveControl,null,operation);
  if(operation==='turn')assert.ok(f.receiver.x>before.x+.005,'new side direction responds in the same frame');
  if(operation==='release'){f.game.update(1/60,{home:f.direction});assert.ok(f.receiver.z<before.z-.005,'repushing the old direction remains a manual movement');assert.equal(f.receiver.receiveControl,null);}
 }
 const beforeHandoff=fixture({angle:4});beforeHandoff.game.update(1/60,{home:{x:0,z:0}});handoff(beforeHandoff);assert.equal(beforeHandoff.receiver.receiveControl,null,'a release and repush before the cursor transfer is also a new intent');
});
test('manual switching and manual mode cancel pending automatic handoff, while a through pass keeps the requested run',()=>{
 for(const mode of['manual','semi']){
  const f=fixture({mode,angle:4});if(mode==='semi'){handoff(f);assert.equal(f.game.action('switch',{direction:{x:0,z:1}}),true);assert.equal(f.s.controlledIds.home,f.passer.id);}
  for(let i=0;i<45;i++)f.game.update(1/60,{home:f.direction});assert.equal(f.s.controlledIds.home,f.passer.id,mode);assert.equal(f.receiver.receiveControl,null);
 }
 const changed=fixture({angle:4});handoff(changed);changed.game.setControlMode('manual');assert.equal(changed.receiver.receiveControl,null);const at=changed.receiver.z;changed.game.update(1/60,{home:changed.direction});assert.ok(changed.receiver.z<at-.005);
 for(const fps of[15,30,60])for(let angle=0;angle<8;angle++){
  const f=fixture({type:'through',angle});let received=false,sawHandoff=false;for(let i=0;i<fps*4;i++){f.game.update(1/fps,{home:f.direction});if(f.s.controlledId===f.receiver.id&&!f.s.ball.ownerId){sawHandoff=true;assert.ok(!f.receiver.receiveControl);}if(f.s.ball.ownerId===f.receiver.id){received=true;break;}}
  assert.ok(sawHandoff);assert.ok(received,'through pass '+angle+' at '+fps+'fps');
 }
});
test('save/restore retains a pending recipient intent and produces the same physical first touch',()=>{
 for(const afterHandoff of[false,true]){
  const f=fixture({angle:3});if(afterHandoff)handoff(f);const restored=createFootballSimulation({humanTeams:['home','away']});restored.restore(f.game.checkpoint());
  for(let i=0;i<90;i++){const input={home:f.direction};f.game.update(1/60,input);restored.update(1/60,input);assert.deepEqual(restored.state,f.s);}
  assert.equal(restored.state.ball.ownerId,f.receiver.id);
 }
});
test('both network sides receive the same handoff, legacy rows remain readable and local override survives delayed snapshots',()=>{
 for(const team of['home','away']){
  const f=fixture({angle:4,team});handoff(f);const wire=packOnlineState(f.s,1),client=createFootballSimulation({humanTeams:['home','away']}).state;assert.equal(applyOnlineState(client,wire,team),true);assert.deepEqual(client.players.find(p=>p.id===f.receiver.id).receiveControl,wire.players[f.s.players.indexOf(f.receiver)][14]);
  const predictor=createOnlinePrediction(team);predictor.receive(client);const p=client.players.find(p=>p.id===f.receiver.id),before={x:p.x,z:p.z};predictor.update(client,1/60,f.direction,1);assert.ok(Math.hypot(p.x-before.x,p.z-before.z)<.05,'old held input keeps the natural receiving position');
  predictor.update(client,1/60,{x:1,z:0},2);assert.ok(p.x>before.x+.005);assert.equal(f.receiver.receiveControl.x,f.direction.x,'prediction cannot mutate the authoritative helper');
  applyOnlineState(client,{...wire,seq:2},team);predictor.receive(client,2);const x=client.players.find(p=>p.id===f.receiver.id).x;predictor.update(client,1/60,f.direction,3);assert.equal(client.players.find(p=>p.id===f.receiver.id).receiveControl,null,'a delayed packet cannot recapture a locally overridden recipient');assert.ok(client.players.find(p=>p.id===f.receiver.id).x>=x);
  const legacy=structuredClone(wire);for(const row of legacy.players)row.length=14;assert.equal(applyOnlineState(client,legacy,team),true);assert.equal(client.players.find(p=>p.id===f.receiver.id).receiveControl,null);
 }
});
test('receiving assistance expires using predicted local time even while the last server timestamp is unchanged',()=>{
 const f=fixture({angle:4});handoff(f);f.receiver.receiveControl.until=f.s.time+.08;const client=createFootballSimulation({humanTeams:['home','away']}).state;applyOnlineState(client,packOnlineState(f.s,1),'home');const fixedTime=client.time,predictor=createOnlinePrediction('home'),p=client.players.find(p=>p.id===f.receiver.id);predictor.receive(client);const z=p.z;
 for(let i=0;i<12;i++)predictor.update(client,1/60,f.direction,i+1);
 assert.equal(client.time,fixedTime);assert.equal(p.receiveControl,null);assert.ok(p.z<z-.1,'the old handoff cannot remain active because an authoritative timestamp stalled');
});
