import {footballTeams,footballTeam,opponentSquad,difficulties,cameraLabels,loadMatchOptions,saveMatchOptions} from './football-teams.js';
export function buildMatchSetup(storage){
 const $=id=>document.getElementById(id);let options=loadMatchOptions(storage);
 $('opponent-options').innerHTML=footballTeams.map(t=>`<button class="opponent-card" data-opponent="${t.id}" aria-label="选择${t.name}" aria-pressed="false"><span class="club-swatch" style="--shirt:${t.kit.shirt};--ink:${t.kit.ink};--stripe:${t.id==='barcelona'?'#a62848':t.kit.shirt}">${t.code}</span><span><b>${t.name}</b><small>${t.style}</small></span><i>✓</i></button>`).join('');
 $('difficulty-options').innerHTML=Object.entries(difficulties).map(([id,d])=>`<button data-match-difficulty="${id}" aria-pressed="false">${d.label}</button>`).join('');
 $('camera-options').innerHTML=Object.entries(cameraLabels).map(([id,label])=>`<button data-match-camera="${id}" aria-pressed="false">${label}</button>`).join('');
 function render(){for(const b of document.querySelectorAll('[data-opponent]'))b.setAttribute('aria-pressed',String(b.dataset.opponent===options.opponent));for(const b of document.querySelectorAll('[data-match-difficulty]'))b.setAttribute('aria-pressed',String(b.dataset.matchDifficulty===options.difficulty));for(const b of document.querySelectorAll('[data-match-camera]'))b.setAttribute('aria-pressed',String(b.dataset.matchCamera===options.camera));const team=footballTeam(options.opponent);$('match-setup-summary').textContent='拜仁 × '+team.name+' · '+difficulties[options.difficulty].label+' · '+cameraLabels[options.camera]+'镜头';$('match-setup-lineup').textContent=opponentSquad(team.id).xi.map(p=>p.player.number+' '+p.player.name).join(' · ');$('match-team-source').href=team.source;}
 for(const b of document.querySelectorAll('[data-opponent]'))b.onclick=()=>{options.opponent=b.dataset.opponent;saveMatchOptions(storage,options);render();};
 for(const b of document.querySelectorAll('[data-match-difficulty]'))b.onclick=()=>{options.difficulty=b.dataset.matchDifficulty;saveMatchOptions(storage,options);render();};
 for(const b of document.querySelectorAll('[data-match-camera]'))b.onclick=()=>{options.camera=b.dataset.matchCamera;saveMatchOptions(storage,options);render();};
 render();return{get options(){return{...options};},refresh(){options=loadMatchOptions(storage);render();}};
}
