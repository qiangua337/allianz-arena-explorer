import {writeFileSync} from 'node:fs';
import {createFootballSimulation} from '../dist/football-simulation.js';
const results=[];
for(const difficulty of['casual','regular','challenge'])for(const distance of[8,12,18,24,30])for(const aim of[-1,0,1])for(const power of[.45,.9]){
 const row={difficulty,distance,aim,power,shots:0,goals:0,saves:0,parries:0,misses:0,woodwork:0};
 for(let seed=1;seed<=6;seed++){
  const g=createFootballSimulation({difficulty,seed:seed*733}),s=g.state;for(let i=0;i<190;i++)g.update(1/60);
  const user=s.players.find(p=>p.id===s.controlledId),keeper=s.players.find(p=>p.id==='away-0');
  for(const p of s.players)if(p.id!==user.id&&!p.keeper){p.x=p.team==='home'?28:-28;p.z=p.team==='home'?35:28;p.vx=p.vz=0;p.decisionAt=p.tackleAt=1e6;}
  Object.assign(user,{x:0,z:-52.5+distance,yaw:Math.PI,vx:0,vz:0});Object.assign(keeper,{x:(seed%3-1)*.6,z:-50,vx:0,vz:0});
  Object.assign(s.ball,{x:0,y:.11,z:user.z-.58,ownerId:user.id,vx:0,vy:0,vz:0});g.action('shoot',{power,direction:{x:aim,z:-1}});row.shots++;
  for(let i=0;i<300;i++){g.update(1/60);if(s.phase==='goal'||s.stats.away.saves>0||s.phase==='kickoff')break;}
  if(s.score.home)row.goals++;else if(s.stats.away.saves){row.saves++;if(s.events.some(e=>e.type==='parry'))row.parries++;}else row.misses++;
  if(s.events.some(e=>e.type==='woodwork'))row.woodwork++;
 }results.push(row);
}
const total=results.reduce((a,r)=>{for(const k of['shots','goals','saves','parries','misses','woodwork'])a[k]+=r[k];return a;},{shots:0,goals:0,saves:0,parries:0,misses:0,woodwork:0});
const report={note:'Controlled open-shot scenarios, six deterministic seeds per cell. Real shots and physics, no ball repositioning after release. This is not a full-match scoring probability.',total,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
for(const difficulty of['casual','regular','challenge'])for(const distance of[8,12,18,24,30]){const rows=results.filter(r=>r.difficulty===difficulty&&r.distance===distance),sum=k=>rows.reduce((a,r)=>a+r[k],0);console.log(`${difficulty.padEnd(9)} ${String(distance).padStart(2)} m | shots ${sum('shots')} goals ${sum('goals')} saves ${sum('saves')} parries ${sum('parries')} misses ${sum('misses')}`);}
console.log('Total:',total);
