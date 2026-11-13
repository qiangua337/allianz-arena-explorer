import test from 'node:test';
import assert from 'node:assert/strict';
import {defendingShape} from '../dist/football-defending.js';
import {footballFormations} from '../dist/football-squads.js';

const system=footballFormations['4231'];
function actors(sign=-1){
 return system.positions.map(([x,z],index)=>({id:'home-'+index,team:'home',index,x,z:-z*sign,keeper:index===0,vx:0,vz:0}));
}
function opponent(id,x,depth,sign=-1){return{id:'away-'+id,team:'away',x,z:depth*sign,vx:0,vz:0};}

test('the far-side block tucks in and recovers as the carrier advances on the other flank',()=>{
 for(const sign of [-1,1]){
  const players=actors(sign),mid=opponent(1,0,-8,sign),wide=opponent(1,25,-28,sign);
  const initial=defendingShape([...players,mid],'home',system,sign,mid,mid,[]);
  const next=defendingShape([...players,wide],'home',system,sign,wide,wide,['home-4','home-6']);
  assert.equal(next.has('home-0'),false);
  assert.equal(next.has('home-4'),false);
  assert.equal(next.has('home-6'),false);
  for(const id of ['home-5','home-10']){
   assert.ok(next.get(id).x-initial.get(id).x>9);
   assert.ok(next.get(id).z*sign<initial.get(id).z*sign-7.5);
   assert.ok(next.get(id).speed>6);
  }
  assert.ok(Math.abs(next.get('home-7').x-wide.x*.62)<1.5,'a non-pressing midfielder screens the inside lane');
  const screenDepth=next.get('home-7').z*sign,backLineDepth=next.get('home-3').z*sign;
  assert.ok(screenDepth<=wide.z*sign-3);
  assert.ok(screenDepth-backLineDepth>9,'the screening midfielder keeps a separate line from the centre-back');
 }
});

test('two available defenders cover different dangerous runners on the goal side',()=>{
 for(const sign of [-1,1]){
  const players=actors(sign),carrier=opponent(1,25,-28,sign),central=opponent(7,1,-34,sign),channel=opponent(8,17,-30,sign);
  const base=defendingShape([...players,carrier],'home',system,sign,carrier,carrier,['home-4','home-6']);
  const marked=defendingShape([...players,carrier,central,channel],'home',system,sign,carrier,carrier,['home-4','home-6']);
  const first=marked.get('home-3'),second=marked.get('home-7');
  assert.ok(first.z*sign<=central.z*sign-1.25&&second.z*sign<=channel.z*sign-1.25);
  assert.ok(Math.abs(first.x-central.x)<3&&Math.abs(second.x-channel.x)<3);
  assert.ok(Math.abs(first.x-second.x)>12);
  assert.ok(Math.abs(first.z-base.get('home-3').z)>4);
 }
});

test('dismissed or training-inactive players do not influence defensive assignments',()=>{
 const players=actors(),carrier=opponent(1,22,-25),dismissed={...opponent(2,0,-39),dismissed:true},inactive={...opponent(3,18,-31),trainingInactive:true};
 const build=extra=>defendingShape([...players,carrier,...extra],'home',system,-1,carrier,carrier,[undefined,'home-6']);
 assert.deepEqual(build([dismissed,inactive]),build([]));
});

test('both wingers cut separate passing routes while the carrier holds still',()=>{
 for(const sign of [-1,1]){
  const players=actors(sign),carrier=opponent(1,1,-12,sign);
  const right={...opponent(7,20,-6,sign),vx:3,vz:2*sign};
  const left={...opponent(8,-20,-7,sign),vx:-3,vz:2*sign};
  const targets=runners=>defendingShape([...players,carrier,...runners],'home',system,sign,carrier,carrier,['home-2','home-7']);
  const shape=targets([]),covered=targets([right,left]);
  for(const [id,receiver] of [['home-9',right],['home-10',left]]){
   const before=shape.get(id),after=covered.get(id);
   assert.equal(after.faceBall,true);
   assert.ok(after.z*sign<before.z*sign-3,'the winger comes back toward the passing route');
   assert.equal(Math.sign(after.x),Math.sign(receiver.x),'each winger keeps their side');
   const depth=(after.z-carrier.z)*sign;
   assert.ok(depth>0,'the winger covers the outlet beyond the carrier');
  }
  for(const id of ['home-3','home-4'])assert.deepEqual(covered.get(id),shape.get(id),'the centre-backs keep their line');
 }
});

test('during a turnover the spare centre-backs retreat while the full-backs recover against separate runners',()=>{
 for(const sign of [-1,1]){
  const players=actors(sign);
  for(const index of [3,4,5,6])players[index].z+=11*sign;
  const carrier={...opponent(1,7,-8,sign),vz:-5.8*sign};
  const left={...opponent(7,-8,-17,sign),vx:-1,vz:-6.5*sign};
  const right={...opponent(8,20,-18,sign),vx:1,vz:-6.2*sign};
  const targets=counter=>defendingShape([...players,carrier,left,right],'home',system,sign,carrier,carrier,['home-2','home-7'],{counter});
  const settled=targets(false),recovering=targets(true);
  for(const id of ['home-3','home-4']){
   const before=settled.get(id),after=recovering.get(id);
   assert.equal(after.recovery,true);
   assert.ok((before.z-after.z)*sign>2);
   assert.equal(before.x,after.x,'the spare pair keeps the centre protected');
  }
  for(const [id,runner] of [['home-5',left],['home-6',right]]){
   const after=recovering.get(id);
   assert.ok(after.faceBall&&after.recovery&&after.speed>=6.35);
   assert.ok((runner.z-after.z)*sign>2.2,'the marker gets between their own goal and the sprinting runner');
   assert.equal(Math.sign(after.x),Math.sign(runner.x));
  }
  assert.equal(recovering.has('home-2'),false,'the selected pressers keep their separate jobs');
  assert.equal(recovering.has('home-7'),false);
  assert.deepEqual(recovering.get('home-1'),settled.get('home-1'),'the far forward does not join the pursuit');
 }
});
