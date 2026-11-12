import test from 'node:test';
import assert from 'node:assert/strict';
import {attackingShape,forwardSupportRun,passFlight,passOption,supportPosition} from '../dist/football-tactics.js';
import {footballFormations} from '../dist/football-squads.js';

const passer={id:'home-1',team:'home',x:0,z:0,vx:0,vz:0,yaw:Math.PI,attackSign:-1};
const ball={x:0,y:.11,z:0};
const running={id:'home-2',team:'home',x:0,z:-17,vx:5,vz:-1.5};
const command={direction:{x:0,z:-1},type:'through',power:.55};
const opponent=(id,x,z)=>({id,team:'away',x,z,vx:0,vz:0});

test('a through ball leads the selected diagonal runner and checks the actual ball path for markers',()=>{
 const oldPathMarker=opponent('away-1',0,-9),forward=passOption([passer,running,oldPathMarker],passer,ball,command);
 assert.equal(forward.player,running);
 assert.ok(forward.x>4&&forward.z<running.z-1,'the pass meets the runner instead of continuing straight');
 assert.ok(forward.lane>1.7);
 assert.equal(passFlight(ball,forward,{type:'through',lane:forward.lane}).lofted,false);

 const newPathMarker=opponent('away-2',forward.x*.52,forward.z*.52);
 const blocked=passOption([passer,running,newPathMarker],passer,ball,command);
 assert.ok(blocked.lane<.05);
 assert.equal(passFlight(ball,blocked,{type:'through',lane:blocked.lane}).lofted,true);
});

test('through passes retain the explicit input when a target is still or moving back',()=>{
 const left={...running,x:-11,z:-9,vx:0,vz:0},right={...running,id:'home-3',x:11,z:-9,vx:0,vz:0};
 const aim={x:-1,z:0};
 const pass=passOption([passer,left,right],passer,ball,{...command,direction:aim});
 assert.equal(pass.player,left);
 assert.ok(pass.x<left.x-6);
 assert.equal(pass.z,left.z);

 const dropping={...running,vx:0,vz:4.5};
 const forward=passOption([passer,dropping],passer,ball,command);
 assert.equal(forward.player,dropping);
 assert.ok(forward.z<dropping.z-6);
});

test('a through ball can stop short of a guarded landing while still leading the runner',()=>{
 const open=passOption([passer,running],passer,ball,command);
 const farMarker=opponent('away-1',open.x,open.z);
 const safer=passOption([passer,running,farMarker],passer,ball,command);
 assert.ok(safer.x>2&&safer.x<open.x-1);
 assert.ok(safer.z<running.z&&safer.z>open.z);
 assert.ok(Math.hypot(safer.x-farMarker.x,safer.z-farMarker.z)>2);
});

test('the holding midfielder steps beside a defender cutting the lane in either attacking direction',()=>{
 const outlet={id:'home-2',team:'home',index:2,x:-8,z:6};
 for(const sign of [-1,1]){
  const shape={anchor:{x:0,z:0},outlet:outlet.id,runLine:40};
  const settings={base:[-8,10],role:'DM',sign,attacking:true,shape};
  const open=supportPosition(outlet,ball,[],settings);
  const marker=opponent('away-1',open.x/2,open.z/2);
  const guarded=supportPosition(outlet,ball,[marker],settings);
  const lineGap=Math.abs(guarded.x*marker.z-guarded.z*marker.x)/Math.hypot(guarded.x,guarded.z);
  assert.ok(lineGap>1.25,'the outlet moves into view from the carrier');
  assert.ok(guarded.z*sign<=-3,'the short option stays behind the carrier');
 }
});

test('an advanced wide attack keeps a receiver outside the box, a deeper outlet and a switch option in all formations',()=>{
 for(const system of Object.values(footballFormations))for(const sign of [-1,1]){
  const owner={id:'home-6',team:'home',x:26,z:38*sign,index:6};
  const team=system.positions.map(([x,z],index)=>index===6?owner:{id:'home-'+index,team:'home',index,x,z:sign*(21-z*.41),keeper:index===0});
  const rivals=[{...opponent('away-0',0,51*sign),keeper:true},opponent('away-3',5,45*sign),opponent('away-4',-9,44*sign)];
  const field=[...team,...rivals],context={x:owner.x,z:owner.z},shape=attackingShape(field,'home',system,sign,context,owner,owner.id);
  const position=player=>supportPosition(player,context,field,{base:system.positions[player.index],role:system.roles[player.index],sign,attacking:true,shape});
  assert.ok(shape.edgeSupport&&shape.outlet&&shape.edgeSupport!==shape.outlet);
  const edge=position(team.find(p=>p.id===shape.edgeSupport)),deeper=position(team.find(p=>p.id===shape.outlet));
  const opposite=position(team.find(p=>['LW','LM','LWB'].includes(system.roles[p.index])));
  assert.ok(edge.z*sign>=28&&edge.z*sign<35&&Math.abs(edge.x)<14);
  assert.ok(deeper.z*sign<=edge.z*sign-3);
  assert.ok(opposite.x< -22,'the far player remains available to switch the play');
  assert.notEqual(forwardSupportRun(field,'home',system,shape,sign,owner,owner.id,null,0)?.id,shape.edgeSupport);
 }
});

test('a byline run keeps a near-post option, a trailing cutback target and an edge outlet separate',()=>{
 for(const system of Object.values(footballFormations))for(const sign of [-1,1])for(const flank of [-1,1]){
  const owner={id:'home-6',team:'home',x:flank*23,z:47*sign,index:6};
  const team=system.positions.map(([x,z],index)=>index===6?owner:{id:'home-'+index,team:'home',index,x,z:sign*(32-z*.41),keeper:index===0});
  const rivals=[{...opponent('away-0',0,51*sign),keeper:true},opponent('away-3',2,48*sign),opponent('away-4',-8,46*sign)];
  const field=[...team,...rivals],context={x:owner.x,z:owner.z},shape=attackingShape(field,'home',system,sign,context,owner,owner.id);
  const {near,arriving}=shape.box;
  const position=id=>{const p=team.find(member=>member.id===id);return supportPosition(p,context,field,{base:system.positions[p.index],role:system.roles[p.index],sign,attacking:true,shape});};
  const front=position(near.id),late=position(arriving.id),edge=position(shape.edgeSupport);
  assert.equal(new Set([near.id,arriving.id,shape.edgeSupport,owner.id]).size,4);
  assert.ok(front.x*flank>=1&&late.x*flank<=-1);
  assert.ok(front.z*sign>=44&&late.z*sign>=36&&late.z*sign<=44);
  assert.ok((front.z-late.z)*sign>=3&&edge.z*sign<35);
  assert.equal(forwardSupportRun(field,'home',system,shape,sign,owner,owner.id,null,0),null);
 }
});
