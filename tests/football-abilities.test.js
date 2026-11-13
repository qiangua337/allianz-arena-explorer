import test from 'node:test';
import assert from 'node:assert/strict';
import {footballAbilities,playerAbilities,playerSpecialties} from '../dist/football-abilities.js';
import {teamSquad} from '../dist/football-squads.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {beginFootballTouch,moveControlledFootballer} from '../dist/football-movement.js';
import {passFlight,shotPreparation} from '../dist/football-tactics.js';
import {packOnlineState,applyOnlineState} from '../dist/online-protocol.js';

test('ability profiles cover every selectable roster and distinguish player strengths',()=>{
 const profiles=new Set();
 for(const opponent of ['dortmund','madrid','barcelona','city']){
  for(const team of ['home','away'])for(const member of teamSquad(team,opponent)){
   const profile=footballAbilities(team,opponent,member.player.number);
   assert.ok(profile.pace>0&&profile.dribbling>0&&profile.passing>0&&profile.finishing>0);
   assert.equal(profile.goalkeeping>0,!!member.keeper);
   profiles.add(profile);
  }
 }
 assert.equal(profiles.size,teamSquad('home').length+['dortmund','madrid','barcelona','city'].reduce((sum,id)=>sum+teamSquad('away',id).length,0));
 assert.match(playerSpecialties('home','madrid',19),/速度/);
 assert.match(playerSpecialties('home','madrid',9),/射门/);
 assert.match(playerSpecialties('home','madrid',6),/传球/);
});

test('individual abilities affect movement, first touch, delivery speed and finishing',()=>{
 const player=number=>({id:'player',team:'home',number,x:0,z:0,vx:0,vz:0,yaw:Math.PI,stamina:1,attackSign:-1});
 const davies=player(19),kane=player(9),musiala=player(10),tah=player(4),kimmich=player(6);
 const loose={x:0,y:.11,z:0,vx:0,vz:0,ownerId:null};
 for(let i=0;i<120;i++)for(const p of [davies,kane])moveControlledFootballer(p,loose,null,{x:0,z:-1,sprint:true},1/60,i/60);
 assert.ok(davies.z<kane.z-1.5);
 const ballA={...loose},ballB={...loose};
 beginFootballTouch(musiala,ballA,{x:0,z:-1},0);beginFootballTouch(tah,ballB,{x:0,z:-1},0);
 assert.ok(Math.hypot(ballA.firstTouch.x,ballA.firstTouch.z)<Math.hypot(ballB.firstTouch.x,ballB.firstTouch.z));
 const target={x:12,z:-10};
 const pace=player=>{const {vx,vz}=passFlight(loose,target,{player});return Math.hypot(vx,vz);};
 assert.ok(pace(kimmich)>pace(tah));
 const shootingSpot={...loose,z:-30};
 assert.ok(shotPreparation(player(9),shootingSpot).spread<shotPreparation(tah,shootingSpot).spread);
});

test('substitutes and the network client use shirt identity instead of formation slot',()=>{
 const options={opponent:'madrid',rules:{mode:'league',duration:180}};
 const server=createFootballSimulation(options),client=createFootballSimulation(options);
 const bayernSlot=server.state.players.find(p=>p.id==='home-1');
 assert.equal(bayernSlot.number,9);
 assert.ok(server.substitute('home',bayernSlot.id,7).ok);
 assert.equal(bayernSlot.number,7);
 assert.equal(playerAbilities(bayernSlot),footballAbilities('home','madrid',7));
 const packet=packOnlineState(server.state,1);
 assert.equal(packet.players[0].length,17);
 assert.ok(applyOnlineState(client.state,packet,'away'));
 assert.equal(playerAbilities(client.state.players.find(p=>p.id===bayernSlot.id)),playerAbilities(bayernSlot));
 assert.equal(playerAbilities(client.state.players.find(p=>p.team==='away'&&p.number===10)).pace,97);
});
