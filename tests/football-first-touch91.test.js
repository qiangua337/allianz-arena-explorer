import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';

function fixture({team='home',mode='semi',seed=73417}={}){
 const game=createFootballSimulation({seed,controlMode:mode,humanTeams:['home','away']});
 for(let i=0;i<190;i++)game.update(1/60);
 const s=game.state,sign=team==='home'?1:-1;
 for(const p of s.players)Object.assign(p,{x:30,z:40,vx:0,vz:0,motion:null,decisionAt:1e9,tackleAt:1e9,protectedUntil:0});
 const passer=s.players.find(p=>p.id===team+'-1'),receiver=s.players.find(p=>p.id===team+'-8'),third=s.players.find(p=>p.id===team+'-9');
 for(const[p,x,z]of[[passer,0,18],[receiver,-9,5],[third,9,5]])Object.assign(p,{x:x*sign,z:z*sign,yaw:Math.PI*sign});
 Object.assign(s.ball,{x:0,z:17.4*sign,y:.11,vx:0,vy:0,vz:0,ownerId:passer.id,shot:null,targetId:null,receivePoint:null});
 const first={x:-.6*sign,z:-sign},next={x:sign,z:0};
 assert.equal(game.action('pass',{direction:first,power:.45},team),true);game.update(1/60);
 assert.equal(s.ball.targetId,receiver.id);return{game,s,passer,receiver,third,next,team};
}

test('a second pass input never recalls the released ball and semi assistance buffers the actual recipient',()=>{
 for(const team of['home','away'])for(const mode of['semi','assisted'])for(const fps of[15,30,60]){
  const f=fixture({team,mode}),before=structuredClone(f.s.ball);
  assert.equal(f.game.action('pass',{direction:f.next,power:.45},team),true);
  assert.deepEqual(f.s.ball,before,'an action button cannot take the ball from its physical flight');
  assert.equal(f.s.stats[team].passes,1);assert.equal(f.s.previews[team].preparedAction.playerId,f.receiver.id);
  for(let i=0;i<fps*3&&f.s.stats[team].passes===1;i++)f.game.update(1/fps);
  assert.equal(f.s.stats[team].passes,2);const passes=f.s.events.filter(e=>e.type==='pass'&&e.team===team);
  assert.equal(passes[0].playerId,f.passer.id);assert.equal(passes[1].playerId,f.receiver.id);
  const reception=f.s.events.find(e=>e.type==='receive'&&e.playerId===f.receiver.id);
  assert.ok(reception&&reception.id<passes[1].id,'the real first touch must precede the second kick');
  assert.equal(f.s.previews[team].preparedAction,null);
 }
});

test('manual passing never auto-switches or recollects a just-released pass',()=>{
 const f=fixture({mode:'manual'}),before=structuredClone(f.s.ball);
 assert.equal(f.game.action('pass',{direction:f.next}),false);assert.deepEqual(f.s.ball,before);
 assert.equal(f.s.receiveTarget,null);for(let i=0;i<180;i++)f.game.update(1/60);
 assert.equal(f.s.ball.ownerId,f.receiver.id);assert.equal(f.s.controlledId,f.passer.id);assert.equal(f.s.stats.home.passes,1);
});

test('buffered first-touch shots preserve the requested power, direction and receiver identity',()=>{
 for(const team of['home','away']){
  const speeds=[];
  for(const direction of[{x:-1,z:-.2},{x:1,z:-.2}]){
   const f=fixture({team});assert.equal(f.game.action('shoot',{direction,power:.73},team),true);
   assert.equal(f.s.stats[team].shots,0);assert.equal(f.s.previews[team].preparedAction.type,'shoot');
   for(let i=0;i<180&&f.s.stats[team].shots===0;i++)f.game.update(1/60);
   assert.equal(f.s.stats[team].shots,1);assert.equal(f.s.lastShot.playerId,f.receiver.id);assert.equal(f.s.lastShot.power,.73);
   assert.equal(f.s.ball.ownerId,null);assert.equal(f.s.lastShot.outcome,'flight');
   assert.equal(Math.sign(f.s.ball.vz),team==='home'?-1:1);speeds.push(f.s.ball.vx);
  }
  assert.ok(speeds[1]>speeds[0]+3,'the two queued directions must produce different actual flight to the corners');
 }
});

test('a manually selected receiver can still prepare a nearby loose-ball action until real contact',()=>{
 const f=fixture({mode:'manual'});assert.equal(f.game.action('switch',{direction:{x:-1,z:-1}}),true);
 assert.equal(f.s.controlledId,f.receiver.id);
 for(let i=0;i<120&&Math.hypot(f.s.ball.x-f.receiver.x,f.s.ball.z-f.receiver.z)>3;i++)f.game.update(1/60);
 const before=structuredClone(f.s.ball);assert.equal(f.game.action('shoot',{direction:{x:1,z:-.2},power:.66}),true);
 assert.deepEqual(f.s.ball,before);assert.equal(f.s.stats.home.shots,0);
 for(let i=0;i<90&&f.s.stats.home.shots===0;i++)f.game.update(1/60);
 assert.equal(f.s.stats.home.shots,1);assert.equal(f.s.lastShot.playerId,f.receiver.id);assert.equal(f.s.lastShot.power,.66);
});

test('manual switching and a physically intercepted pass cancel a prepared recipient action',()=>{
 const manual=fixture();manual.game.action('pass',{direction:manual.next});manual.game.action('switch',{direction:{x:0,z:1}});
 assert.equal(manual.s.preparedAction,null);for(let i=0;i<150;i++)manual.game.update(1/60);assert.equal(manual.s.stats.home.passes,1);
 const intercepted=fixture(),defender=intercepted.s.players.find(p=>p.id==='away-2');
 intercepted.game.action('pass',{direction:intercepted.next});
 Object.assign(defender,{x:-4.5,z:11.2,vx:0,vz:0});
 for(let i=0;i<150&&!intercepted.s.ball.ownerId;i++)intercepted.game.update(1/60);
 assert.equal(intercepted.s.ball.ownerId,defender.id);assert.equal(intercepted.s.preparedAction,null);assert.equal(intercepted.s.stats.home.passes,1);
 const modeChange=fixture();modeChange.game.action('pass',{direction:modeChange.next});modeChange.game.setControlMode('manual');
 assert.equal(modeChange.s.preparedAction,null);assert.equal(modeChange.s.receiveTarget,null);
});

test('unreachable or already departing reception targets do not offer a named prepared action',()=>{
 const f=fixture();f.s.ball.vx=-f.s.ball.vx;f.s.ball.vz=-f.s.ball.vz;f.game.update(0);
 assert.equal(f.s.receiveTarget,null);assert.equal(f.game.action('pass',{direction:f.next}),false);
 assert.equal(f.s.preparedAction,null);assert.equal(f.s.stats.home.passes,1);
 const escaping=fixture();escaping.receiver.vx=escaping.s.ball.vx*2;escaping.receiver.vz=escaping.s.ball.vz*2;escaping.game.update(0);
 assert.equal(escaping.s.receiveTarget,null,'a named receiver running away faster than the ball is not a reachable handoff');
});

test('prepared recipient actions survive checkpoint recovery and both network preview viewpoints',()=>{
 for(const team of['home','away']){
  const f=fixture({team});f.game.action('shoot',{direction:{x:.9,z:-.2},power:.71},team);
  const restored=createFootballSimulation({humanTeams:['home','away']});restored.restore(f.game.checkpoint());
  const client=createFootballSimulation({humanTeams:['home','away']}).state;
  assert.equal(applyOnlineState(client,packOnlineState(f.s,1),team),true);
  assert.equal(client.preparedAction.playerId,f.receiver.id);assert.equal(client.receiveTarget.playerId,f.receiver.id);
  assert.ok(client.receiveTarget.arrivalIn<=1.5);
  for(let i=0;i<120;i++){f.game.update(1/60);restored.update(1/60);assert.deepEqual(restored.state,f.s);}
  assert.equal(restored.state.stats[team].shots,1);
 }
});

test('fast low balls register actual swept grazing contacts across directions and render rates without a wider radius',()=>{
 for(let turn=0;turn<8;turn++)for(const offset of[.46,.49])for(const fps of[15,30,60]){
  const game=createFootballSimulation({practice:'free',controlMode:'manual'}),s=game.state,p=s.players.find(p=>p.id==='home-1'),angle=turn*Math.PI/4;
  const rotate=(x,z)=>({x:x*Math.cos(angle)+z*Math.sin(angle),z:z*Math.cos(angle)-x*Math.sin(angle)});
  Object.assign(p,{x:0,z:0,vx:0,vz:0});const start=rotate(-.3,offset),velocity=rotate(36,0);
  Object.assign(s.ball,{...start,y:.11,vx:velocity.x,vz:velocity.z,vy:0,ownerId:null,targetId:null});
  game.update(1/fps);assert.equal(s.ball.ownerId,offset<.48?p.id:null,JSON.stringify({turn,offset,fps}));
 }
});

test('swept contacts respect height and the earliest physical touch rather than the nearest frame endpoint',()=>{
 const game=createFootballSimulation({practice:'passing',controlMode:'manual'}),s=game.state,first=s.players.find(p=>p.id==='home-1'),later=s.players.find(p=>p.id==='home-8');
 Object.assign(first,{x:-.35,z:0,vx:0,vz:0});Object.assign(later,{x:.35,z:0,vx:0,vz:0});
 Object.assign(s.ball,{x:-.3,z:.46,y:.11,vx:36,vz:0,vy:0,ownerId:null,targetId:null});game.update(1/60);
 assert.equal(s.ball.ownerId,first.id,'the ball first passes within the earlier player’s foot radius');
 const high=createFootballSimulation({practice:'free',controlMode:'manual'}),player=high.state.players.find(p=>p.id==='home-1');Object.assign(player,{x:0,z:0});
 Object.assign(high.state.ball,{x:-.3,z:0,y:1.5,vx:36,vz:0,vy:0,ownerId:null,targetId:null});high.update(1/60);
 assert.equal(high.state.ball.ownerId,null,'an overhead ball cannot be collected by the outfielder’s ground-contact sweep');
});

test('nearby loose-ball input stays responsive but waits for the player to actually reach the ball',()=>{
 const game=createFootballSimulation({practice:'free',controlMode:'manual'}),s=game.state,p=s.players.find(p=>p.id==='home-1');
 Object.assign(p,{x:0,z:0,vx:0,vz:0});Object.assign(s.ball,{x:.98,z:0,y:.11,vx:0,vz:0,vy:0,ownerId:null,targetId:null});
 const before=structuredClone(s.ball);assert.equal(game.action('shoot',{direction:{x:1,z:-.2},power:.62}),true);
 assert.deepEqual(s.ball,before);assert.equal(s.preparedAction.type,'shoot');game.update(1/60);
 assert.equal(s.stats.home.shots,0);assert.equal(s.ball.ownerId,null,'0.98m exceeds the unchanged 0.85m contact radius');
 for(let i=0;i<20&&s.stats.home.shots===0;i++)game.update(1/60,{x:1,z:0});
 assert.equal(s.stats.home.shots,1);assert.equal(s.lastShot.power,.62);assert.ok(p.x>.1);
});

test('a dismissed stale controller cannot poke the ball while its on-field replacement is being selected',()=>{
 const game=createFootballSimulation({humanTeams:['home','away'],controlMode:'manual'});for(let i=0;i<190;i++)game.update(1/60);
 const s=game.state,user=s.players.find(p=>p.id==='home-1'),owner=s.players.find(p=>p.id==='away-1');
 for(const p of s.players)Object.assign(p,{x:30,z:40,vx:0,vz:0,decisionAt:1e9,tackleAt:1e9});
 Object.assign(user,{x:0,z:0,yaw:0,dismissed:true,tackleAt:0});Object.assign(owner,{x:0,z:.9,yaw:Math.PI,protectedUntil:0});
 Object.assign(s.ball,{x:0,z:.32,y:.11,ownerId:owner.id,vx:0,vy:0,vz:0});game.update(1/60);
 assert.equal(s.stats.home.tackles,0);assert.equal(s.ball.ownerId,owner.id);
});
