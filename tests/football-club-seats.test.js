import test from 'node:test';
import assert from 'node:assert/strict';
import {footballAbilities,playerAbilities} from '../dist/football-abilities.js';
import {defaultSelection,teamSquad,validateSelection} from '../dist/football-squads.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {defaultHomeClub,footballClubs,matchClubs} from '../dist/football-teams.js';

const league={mode:'league',duration:180};

test('either seat can field any club with that club’s own default selection and ratings',()=>{
 for(const {id} of footballClubs){
  const home=defaultSelection('home',id,id),away=defaultSelection('away',id,id);
  assert.deepEqual(home,away,id);
  assert.ok(validateSelection(home,'home',id,id).ok,id);
  assert.ok(validateSelection(away,'away',id,id).ok,id);
  const {state}=createFootballSimulation({homeClub:id,opponent:id,rules:league,humanTeams:['home','away']});
  for(const team of ['home','away']){
   assert.equal(state.teamSheets[team].formation,home.formation);
   assert.deepEqual(state.players.filter(player=>player.team===team).map(player=>player.number),home.xi);
   assert.ok(teamSquad(team,id,id).length>=20);
  }
  assert.equal(state.homeFixture.id,id);
  assert.equal(state.fixture.id,id);
  assert.notEqual(state.homeFixture.kit.shirt,state.fixture.kit.shirt);
  assert.equal(playerAbilities(state.players[1]),playerAbilities(state.players[12]));
 }
});

test('clashing shirts are separated and the original Bayern–Dortmund fixture keeps its colours',()=>{
 const original=matchClubs(defaultHomeClub,'dortmund');
 assert.equal(original.home.kit.shirt,'#bb1d32');
 assert.equal(original.away.kit.shirt,'#ebcc3d');
 const whiteClash=matchClubs('madrid','liverpool');
 assert.equal(whiteClash.away.id,'liverpool');
 assert.notEqual(whiteClash.away.kit.shirt,matchClubs('bayern','liverpool').away.kit.shirt);
});

test('the selected home club survives substitutions and a resumed competition checkpoint',()=>{
 const options={homeClub:'madrid',opponent:'inter',rules:league,humanTeams:['home','away']};
 const first=createFootballSimulation(options);
 const player=first.state.players.find(player=>player.id==='home-1');
 assert.equal(player.name,'MBAPPÉ');
 assert.equal(playerAbilities(player).pace,97);
 assert.ok(first.substitute('home',player.id,9).ok);
 assert.equal(player.name,'ENDRICK');
 assert.equal(playerAbilities(player),footballAbilities('home','inter',9,'madrid'));
 const reloaded=createFootballSimulation(options);
 reloaded.restore(first.checkpoint());
 assert.equal(reloaded.state.homeFixture.short,'皇马');
 assert.equal(reloaded.state.fixture.short,'国米');
 assert.equal(playerAbilities(reloaded.state.players.find(p=>p.id===player.id)),playerAbilities(player));
 assert.ok(reloaded.state.events.some(event=>event.type==='substitution'&&event.text.startsWith('10')));
});
