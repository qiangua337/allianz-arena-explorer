import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {shotPreparation,shotOption} from '../dist/football-tactics.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';

const run=(g,n=1)=>{for(let i=0;i<n;i++)g.update(1/60);};
function isolated({distance=18,power=.8,yaw=Math.PI,speed=0,seed=733}={}){
 const g=createFootballSimulation({duration:900,seed}),s=g.state;run(g,190);const p=s.players.find(q=>q.id===s.controlledId);for(const q of s.players)if(q!==p)q.dismissed=true;
 Object.assign(p,{x:0,z:-52.5+distance,yaw,vx:0,vz:-speed,decisionAt:1e6,tackleAt:0});Object.assign(s.ball,{x:0,y:.11,z:p.z-.58,ownerId:p.id,vx:0,vy:0,vz:0});return{g,s,p,power};
}
function strike(options){const{g,s,power}=isolated(options),restartTaker=s.players.find(p=>p.team==='away'&&!p.keeper);Object.assign(restartTaker,{dismissed:false,x:32,z:45,vx:0,vz:0,decisionAt:1e6,tackleAt:1e6});assert.equal(g.action('shoot',{power,direction:{x:1,z:0}}),true);for(let i=0;i<900&&s.phase==='playing'&&s.lastShot.outcome!=='short';i++){g.update(1/60);if(s.ball.ownerId||!s.ball.shot)break;}return s;}

test('shot preparation makes a balanced nearby strike reliable and explains body, speed, power and pressure risks',()=>{
 const p={team:'home',x:0,z:-34.5,yaw:Math.PI,vx:0,vz:0},ball={x:0,y:.11,z:-35.08},steady=shotPreparation(p,ball,{power:.65});assert.equal(steady.preparation,'balanced');assert.equal(steady.quality,1);
 for(const [player,options,reason]of[[{...p,yaw:0},{power:.65},'backfoot'],[{...p,vz:-7.6},{power:.65},'rushed'],[p,{power:1},'overpowered'],[p,{power:.65,pressure:.4},'pressured']]){const result=shotPreparation(player,ball,options);assert.equal(result.preparation,reason);assert.ok(result.quality<steady.quality);assert.ok(result.spread>steady.spread);}
 const long=shotPreparation({...p,z:10},{...ball,z:9.42},{power:.55});assert.equal(long.preparation,'long-range');assert.ok(long.spread>steady.spread);
});

test('charging previews expose the same deterministic preparation as the eventual kick without consuming randomness',()=>{
 const{g,s,p}=isolated({distance:40,power:1,speed:7.6});s.chargePowers.home=1;const before=g.checkpoint().randomSeed;g.update(0);assert.equal(g.checkpoint().randomSeed,before);const preview=s.shotPreview;
 assert.equal(preview.preparation,'rushed');assert.ok(preview.quality<.7);assert.ok(Number.isFinite(preview.spread));assert.ok(preview.y>1.4,'the preview includes the same upward overcharge bias as the actual kick');g.action('shoot',{power:1,direction:{x:1,z:0}});assert.equal(s.lastShot.preparation,preview.preparation);assert.equal(s.lastShot.quality,preview.quality);assert.ok(s.message.includes('跑动起脚'));assert.equal(p.motion.type,'shoot');
});

test('actual shot flight keeps settled 18 and 24 metre corners accessible while back-foot strikes have real misses',()=>{
 let balanced=0,backfoot=0,backMisses=0;
 for(let seed=1;seed<=24;seed++)for(const distance of[18,24]){const good=strike({distance,seed:seed*733});balanced+=good.score.home;const bad=strike({distance,seed:seed*733,yaw:0,power:1});backfoot+=bad.score.home;if(['wide','woodwork'].includes(bad.lastShot.outcome))backMisses++;}
 assert.equal(balanced,48,'standing nearby corners retain assistance');assert.ok(backfoot>0&&backfoot<balanced,'adjusting the body is useful without making back-foot shots impossible');assert.ok(backMisses>10,'poor preparation changes actual flight, not only a UI number');
});

test('a 90 metre light tap cannot acquire an automatic giant arc and settles as a short shot without scoring',()=>{
 const{g,s,p}=isolated({distance:90,power:.15}),option=shotOption(p,s.ball,{power:.15,direction:{x:1,z:0}});assert.equal(option.limited,true);assert.ok(option.vy<6);
 g.action('shoot',{power:.15,direction:{x:1,z:0}});let peak=0;for(let i=0;i<900&&s.lastShot.outcome==='flight';i++){g.update(1/60);peak=Math.max(peak,s.ball.y);}assert.equal(s.lastShot.outcome,'short');assert.equal(s.score.home,0);assert.ok(s.ball.z>-40);assert.ok(peak<2);assert.equal(s.stats.home.onTarget,0);assert.equal(s.events.at(-1).type,'shot-short');
});

test('loose-ball tackles respond with a physical approach and never claim or teleport a ball behind the player',()=>{
 const{g,s,p}=isolated();Object.assign(p,{x:0,z:0,yaw:0,vx:0,vz:0});Object.assign(s.ball,{x:0,y:.11,z:-1.59,ownerId:null,vx:0,vy:0,vz:0,shot:null});const original={x:s.ball.x,z:s.ball.z};
 assert.equal(g.action('tackle'),true);assert.equal(p.motion.type,'tackle');assert.equal(s.ball.ownerId,null);assert.deepEqual({x:s.ball.x,z:s.ball.z},original);run(g);assert.equal(s.ball.ownerId,null);assert.deepEqual({x:s.ball.x,z:s.ball.z},original);
 for(let i=0;i<30&&!s.ball.ownerId;i++)run(g);assert.equal(s.ball.ownerId,p.id);assert.ok(Math.hypot(p.x,p.z)>.7,'the player actually covers the gap before collecting');assert.deepEqual({x:s.ball.x,z:s.ball.z},original,'collection itself does not move the ball');
});

test('a nearer opposing player can win a loose ball while the user is still lunging toward it',()=>{
 const{g,s,p}=isolated(),foe=s.players.find(q=>q.team==='away'&&!q.keeper);foe.dismissed=false;Object.assign(foe,{x:0,z:-.4,vx:0,vz:0,yaw:0,decisionAt:1e6,tackleAt:1e6});Object.assign(p,{x:0,z:1.5,yaw:Math.PI,vx:0,vz:0});Object.assign(s.ball,{x:0,y:.11,z:0,ownerId:null,vx:0,vy:0,vz:0,shot:null});
 assert.equal(g.action('tackle'),true);assert.equal(s.ball.ownerId,null);run(g);assert.equal(s.ball.ownerId,foe.id,'an action button does not beat the physically nearer receiver');
});

test('both online viewpoints retain their own live preparation preview and the shared shot feedback fields',()=>{
 for(const team of['home','away']){const g=createFootballSimulation({humanTeams:['home','away']}),s=g.state;run(g,190);const p=s.players.find(q=>q.id===s.controlledIds[team]),sign=g.attackSign(team);Object.assign(p,{x:0,z:sign*(52.5-90),yaw:sign<0?Math.PI:0,vx:0,vz:0});Object.assign(s.ball,{x:0,y:.11,z:p.z,ownerId:p.id,vx:0,vy:0,vz:0});s.chargePowers[team]=.15;g.update(0);
  const preview=packOnlineState(s).previews[team].shotPreview;assert.equal(preview.limited,true);for(const field of['quality','spread','heightSpread'])assert.equal(typeof preview[field],'number');assert.equal(preview.preparation,'long-range');
  for(const viewer of['home','away']){const client=createFootballSimulation().state,packet=packOnlineState(s);assert.equal(applyOnlineState(client,packet,viewer),true);assert.deepEqual(client.shotPreview,packet.previews[viewer].shotPreview);}
  g.action('shoot',{power:.15,direction:{x:1,z:0}},team);const packet=packOnlineState(s),client=createFootballSimulation().state;assert.equal(applyOnlineState(client,packet,team),true);assert.equal(client.lastShot.preparation,'long-range');assert.equal(client.lastShot.limited,true);for(const field of['quality','spread','heightSpread'])assert.equal(typeof client.lastShot[field],'number');
 }
});
