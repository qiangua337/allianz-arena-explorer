import {getSquadEditor,buildRulesPicker,rulesSummary} from './squad-editor.js';
import {normalizeSelection,createTeamSheet,footballFormations} from './football-squads.js';
import {footballTeams,footballTeam,footballLeagues,opponentSquad,difficulties,cameraLabels,loadMatchOptions,saveMatchOptions} from './football-teams.js';

export function buildMatchSetup(storage){
 const $=id=>document.getElementById(id);
 let options=loadMatchOptions(storage),league='all';
 const leagueList=$('opponent-leagues'),opponentList=$('opponent-options');
 leagueList.innerHTML=[...footballLeagues].map(([id,label])=>`<button type="button" data-opponent-league="${id}" aria-pressed="false">${label}</button>`).join('');
 opponentList.innerHTML=footballTeams.map(t=>`<button type="button" class="opponent-card" data-opponent="${t.id}" data-pattern="${t.kit.pattern}" aria-label="选择${t.name}" aria-pressed="false"><span class="club-swatch" style="--shirt:${t.kit.shirt};--ink:${t.kit.ink};--stripe:${t.kit.stripe}">${t.code}</span><span><b>${t.name}</b><small>${t.style}</small></span><i aria-hidden="true">✓</i></button>`).join('');
 const leagueButtons=[...leagueList.querySelectorAll('button')];
 const opponentCards=footballTeams.map(team=>({team,button:opponentList.querySelector(`[data-opponent="${team.id}"]`)}));

 $('difficulty-options').innerHTML=Object.entries(difficulties).map(([id,d])=>`<button data-match-difficulty="${id}" aria-pressed="false">${d.label}</button>`).join('');
 $('camera-options').innerHTML=Object.entries(cameraLabels).map(([id,label])=>`<button data-match-camera="${id}" aria-pressed="false">${label}</button>`).join('');
 const rulesPicker=buildRulesPicker($('match-rules-picker'),rules=>{options.rules=rules;save();});
 $('match-lineup-edit').onclick=()=>getSquadEditor().open({
  team:'home',opponent:options.opponent,selection:options.selection,
  onSave:selection=>{options.selection=selection;save();return{ok:true};}
 });
 function save(){saveMatchOptions(storage,options);render();}
 function renderClubs(){
  for(const button of leagueButtons)button.setAttribute('aria-pressed',String(button.dataset.opponentLeague===league));
  for(const {team,button} of opponentCards){
   button.hidden=league!=='all'&&league!==team.league;
   button.setAttribute('aria-pressed',String(team.id===options.opponent));
  }
 }
 function render(){
  rulesPicker.set(options.rules);
  renderClubs();
  $('match-lineup-summary').textContent='拜仁 · '+footballFormations[normalizeSelection(options.selection).formation].label+' · 编辑首发与替补';
  for(const b of document.querySelectorAll('[data-match-difficulty]'))b.setAttribute('aria-pressed',String(b.dataset.matchDifficulty===options.difficulty));
  for(const b of document.querySelectorAll('[data-match-camera]'))b.setAttribute('aria-pressed',String(b.dataset.matchCamera===options.camera));
  const club=footballTeam(options.opponent),squad=opponentSquad(club.id),lineup=createTeamSheet(null,'away',club.id);
  const players=new Map([...squad.xi,...squad.bench].map(p=>[p.player.number,p.player.name]));
  const formation=footballFormations[lineup.formation].label;
  $('match-setup-summary').textContent='拜仁 × '+club.name+' · '+difficulties[options.difficulty].label+' · '+cameraLabels[options.camera]+'镜头 · '+rulesSummary(options.rules);
  $('match-setup-lineup').textContent=formation+' 首发 · '+lineup.xi.map(number=>number+' '+players.get(number)).join(' · ');
  $('match-setup-bench').textContent='替补 · '+lineup.bench.map(number=>number+' '+players.get(number)).join(' · ');
  $('match-team-source').href=club.source;
  $('match-team-checked').textContent=club.checked;
 }
 for(const button of leagueButtons)button.onclick=()=>{league=button.dataset.opponentLeague;renderClubs();};
 for(const {team,button} of opponentCards)button.onclick=()=>{options.opponent=team.id;save();};
 for(const b of document.querySelectorAll('[data-match-difficulty]'))b.onclick=()=>{options.difficulty=b.dataset.matchDifficulty;save();};
 for(const b of document.querySelectorAll('[data-match-camera]'))b.onclick=()=>{options.camera=b.dataset.matchCamera;save();};
 render();
 return{get options(){return structuredClone(options);},refresh(){options=loadMatchOptions(storage);if(league!=='all'&&league!==footballTeam(options.opponent).league)league='all';render();}};
}
