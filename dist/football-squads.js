import {homeXI,substitutes} from './matchday-roster.js';
import {opponentSquad} from './football-teams.js';

export const footballFormations={
 '4231':{label:'4-2-3-1',positions:[[0,48],[0,-24],[-8,12],[-11,30],[11,30],[-26,21],[26,21],[8,12],[0,-6],[23,-5],[-23,-5]],roles:['GK','ST','DM','CB','CB','LB','RB','DM','AM','RW','LW']},
 '433':{label:'4-3-3',positions:[[0,48],[0,-25],[0,16],[-11,30],[11,30],[-26,20],[26,20],[11,5],[-11,5],[24,-17],[-24,-17]],roles:['GK','ST','DM','CB','CB','LB','RB','CM','CM','RW','LW']},
 '442':{label:'4-4-2',positions:[[0,48],[-9,-22],[-8,7],[-11,30],[11,30],[-26,21],[26,21],[8,7],[9,-22],[25,5],[-25,5]],roles:['GK','ST','CM','CB','CB','LB','RB','CM','ST','RM','LM']},
 '352':{label:'3-5-2',positions:[[0,48],[-9,-21],[0,30],[-16,27],[16,27],[-27,9],[27,9],[-9,10],[9,10],[0,-4],[9,-21]],roles:['GK','ST','CB','CB','CB','LWB','RWB','CM','CM','AM','ST']}
};
export function teamSquad(team='home',opponent='dortmund'){
 if(team==='away'){const s=opponentSquad(opponent);return[...s.xi,...s.bench];}
 return[...homeXI,...substitutes.filter(p=>p.team==='home')];
}
export const squadDefinition=(team,opponent,number)=>teamSquad(team,opponent).find(p=>p.player.number===Number(number));
export function defaultSelection(team='home',opponent='dortmund'){const xi=teamSquad(team,opponent).slice(0,11).map(p=>p.player.number);if(team==='home')[xi[5],xi[6]]=[xi[6],xi[5]];if(team==='away'&&opponent==='dortmund')return{formation:'4231',xi:[1,9,25,3,4,24,26,8,7,14,18]};return{formation:'4231',xi};}
export function validateSelection(value,team='home',opponent='dortmund'){
 if(!value||!Object.hasOwn(footballFormations,value.formation))return{ok:false,error:'请选择支持的阵型'};
 if(!Array.isArray(value.xi)||value.xi.length!==11||new Set(value.xi).size!==11)return{ok:false,error:'首发需要 11 名不同球员'};
 const members=value.xi.map(n=>squadDefinition(team,opponent,n));if(members.some((p,i)=>!Number.isInteger(value.xi[i])||!p))return{ok:false,error:'阵容包含不属于本队的球员'};
 if(!members[0].keeper||members.slice(1).some(p=>p.keeper))return{ok:false,error:'门将位置必须由门将担任，场上保留一名门将'};
 return{ok:true,selection:{formation:value.formation,xi:[...value.xi]}};
}
export function normalizeSelection(value,team='home',opponent='dortmund'){const result=validateSelection(value,team,opponent);return result.ok?result.selection:defaultSelection(team,opponent);}
export function createTeamSheet(value,team,opponent){const selection=normalizeSelection(value,team,opponent);return{...selection,bench:teamSquad(team,opponent).filter(p=>!selection.xi.includes(p.player.number)).map(p=>p.player.number),used:[...selection.xi],substitutions:[],pending:[],windows:0};}
