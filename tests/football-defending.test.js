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
   assert.ok(next.get(id).x-initial.get(id).x>11);
   assert.ok(next.get(id).z*sign<initial.get(id).z*sign-10);
   assert.ok(next.get(id).speed>6);
  }
  assert.ok(Math.abs(next.get('home-7').x-wide.x*.62)<1,'a non-pressing midfielder screens the inside lane');
  assert.ok(next.get('home-7').z*sign<wide.z*sign-5);
 }
});

test('two available defenders cover different dangerous runners on the goal side',()=>{
 for(const sign of [-1,1]){
  const players=actors(sign),carrier=opponent(1,25,-28,sign),central=opponent(7,1,-34,sign),channel=opponent(8,17,-30,sign);
  const base=defendingShape([...players,carrier],'home',system,sign,carrier,carrier,['home-4','home-6']);
  const marked=defendingShape([...players,carrier,central,channel],'home',system,sign,carrier,carrier,['home-4','home-6']);
  const first=marked.get('home-3'),second=marked.get('home-7');
  assert.ok(first.z*sign<=central.z*sign-1.25&&second.z*sign<=channel.z*sign-1.25);
  assert.ok(Math.abs(first.x-central.x)<2&&Math.abs(second.x-channel.x)<2);
  assert.ok(Math.abs(first.x-second.x)>12);
  assert.ok(Math.abs(first.z-base.get('home-3').z)>4);
 }
});

test('dismissed or training-inactive players do not influence defensive assignments',()=>{
 const players=actors(),carrier=opponent(1,22,-25),dismissed={...opponent(2,0,-39),dismissed:true},inactive={...opponent(3,18,-31),trainingInactive:true};
 const build=extra=>defendingShape([...players,carrier,...extra],'home',system,-1,carrier,carrier,[undefined,'home-6']);
 assert.deepEqual(build([dismissed,inactive]),build([]));
});
