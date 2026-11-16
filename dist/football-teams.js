import {awayXI,homeXI,homeReserves,substitutes} from './matchday-roster.js';
import {normalizeRules} from './football-rules.js';
import {englandClubs} from './football-clubs-england.js';
import {europeanClubs} from './football-clubs-europe.js';

// Club identities and squad numbers are reference data; these are exhibition
// selections, generic athletes and independently drawn club-colour kits.
const team=(id,name,short,code,english,shirt,shorts,ink,pattern,xi,bench,source,style)=>({
 id,name,short,code,english,kit:{shirt,shorts,ink,socks:shirt,pattern,stripe:pattern==='stripes'?'#a62848':shirt},xi,bench,source,style,checked:'2026-10-26',
 league:id==='dortmund'?'germany':id==='city'?'england':'spain',
 possessionStyle:id==='barcelona'||id==='city'
});
function addedClub({shirt,shorts,ink,socks=shirt,pattern='plain',stripe=shirt,...club}){
 return {...club,kit:{shirt,shorts,ink,socks,pattern,stripe}};
}
export const footballTeams=[
 team('dortmund','多特蒙德','多特','BVB','BORUSSIA DORTMUND','#ebcc3d','#222c31','#222c31','plain',null,null,'https://shop.bvb.de/pages/shop-by-player','积极逼抢 · 纵向推进'),
 team('madrid','皇家马德里','皇马','RMA','REAL MADRID','#efeee7','#efeee7','#293258','plain',[[1,'COURTOIS'],[10,'MBAPPÉ'],[14,'TCHOUAMENI'],[4,'HUIJSEN'],[22,'RÜDIGER'],[18,'CARRERAS'],[12,'TRENT'],[8,'VALVERDE'],[5,'BELLINGHAM'],[11,'RODRYGO'],[7,'VINI JR.']],[[13,'LUNIN'],[3,'MILITÃO'],[2,'ASENCIO'],[23,'MENDY'],[6,'CAMAVINGA'],[15,'ARDA GÜLER'],[9,'ENDRICK'],[21,'BRAHIM'],[25,'DIOMANDE']],'https://www.realmadrid.com/en-US/news/football/first-team/latest-news/dorsales-del-real-madrid-para-la-temporada-2026-27-10-08-2026','快速反击 · 边路前插'),
 team('barcelona','巴塞罗那','巴萨','BAR','FC BARCELONA','#163c82','#172c65','#efce72','stripes',[[1,'JOAN GARCIA'],[9,'GABRIEL JESUS'],[21,'DE JONG'],[5,'CUBARSÍ'],[15,'CHRISTENSEN'],[3,'BALDE'],[23,'KOUNDÉ'],[8,'PEDRI'],[20,'DANI OLMO'],[10,'LAMINE YAMAL'],[11,'RAPHINHA']],[[13,'SZCZĘSNY'],[24,'ERIC GARCIA'],[18,'GERARD MARTÍN'],[22,'MARC BERNAL'],[6,'GAVI'],[7,'FERMÍN'],[14,'ADEYEMI'],[17,'GORDON'],[19,'BARDGHJI']],'https://www.fcbarcelona.com/en/football/first-team/news/4570894/202627-first-team-jersey-numbers-confirmed','短传接应 · 中场控球'),
 team('city','曼彻斯特城','曼城','MCI','MANCHESTER CITY','#79bddc','#e6e8e4','#183346','plain',[[1,'DONNARUMMA'],[9,'HAALAND'],[5,'ANDERSON'],[3,'RÚBEN DIAS'],[6,'GUÉHI'],[21,'AÏT-NOURI'],[27,'MATHEUS NUNES'],[8,'KOVAČIĆ'],[10,'CHERKI'],[47,'FODEN'],[11,'DOKU']],[[28,'RULLI'],[24,'GVARDIOL'],[45,'KHUSANOV'],[82,'RICO LEWIS'],[33,"O'REILLY"],[17,'ENZO FERNÁNDEZ'],[32,'BOUADDI'],[7,'NDIAYE'],[42,'SEMENYO']],'https://www.mancity.com/players','耐心传递 · 拉开宽度')
];
footballTeams.push(...englandClubs.map(club=>addedClub({...club,league:'england'})),...europeanClubs.map(addedClub));
export const defaultHomeClub='bayern';
const bayern=addedClub({
 id:defaultHomeClub,name:'拜仁慕尼黑',short:'拜仁',code:'FCB',english:'FC BAYERN MÜNCHEN',
 shirt:'#bb1d32',shorts:'#ab182c',ink:'#f4f1e8',socks:'#dfdfd6',league:'germany',formation:'4231',
 source:'https://fcbayern.com/en/teams/first-team',style:'前场接应',checked:'2026-11-11',possessionStyle:false
});
export const footballClubs=[bayern,...footballTeams];
export const footballLeagues=new Map([
 ['all','全部'],['germany','德甲'],['spain','西甲'],['england','英超'],['italy','意甲'],['france','法甲']
]);
export const footballTeam=id=>footballClubs.find(t=>t.id===id)||footballTeams[0];
const homeFootballTeam=id=>footballClubs.find(t=>t.id===id)||bayern;
export const teamClub=(team,opponent,homeClub=defaultHomeClub)=>team==='home'?homeFootballTeam(homeClub):footballTeam(opponent);
const contrastKit=(shirt,ink)=>({shirt,shorts:shirt,ink,socks:shirt,pattern:'plain',stripe:shirt});
const lightKit=contrastKit('#f2e1a5','#26283d'),darkKit=contrastKit('#251f3c','#f5f1e6');
const channels=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
const luminance=([r,g,b])=>.2126*r+.7152*g+.0722*b;
export function matchClubs(homeClub=defaultHomeClub,opponent='dortmund'){
 const home=homeFootballTeam(homeClub),away=footballTeam(opponent);
 const kit=away.id===defaultHomeClub?lightKit:away.kit;
 const homeColor=channels(home.kit.shirt),awayColor=channels(kit.shirt);
 const distance=homeColor.reduce((sum,n,index)=>sum+(n-awayColor[index])**2,0);
 const awayKit=distance<12000?(luminance(homeColor)>144?darkKit:lightKit):kit;
 return{home,away:awayKit===away.kit?away:{...away,kit:awayKit}};
}
export function opponentSquad(id,team='away',otherClub){
 const club=team==='home'?matchClubs(id,otherClub).home:matchClubs(otherClub,id).away;
 const placement=(index)=>({seated:true,x:-37.45,z:(team==='away'?10.9:-25.1)+index*1.28,yaw:Math.PI/2});
 if(club.id===defaultHomeClub||club.id==='dortmund'){
  const isBayern=club.id===defaultHomeClub,originalTeam=isBayern?'home':'away';
  const xi=(isBayern?homeXI:awayXI).map(p=>({...p,team,club,kit:club.kit}));
  const bench=substitutes.filter(p=>p.team===originalTeam).map((p,index)=>({...p,team,club,kit:club.kit,...placement(index)}));
  const reserves=isBayern?homeReserves.map(p=>({...p,team,club,kit:club.kit})):[];
  return{club,xi,bench,reserves};
 }
 const make=([number,name],index,bench=false)=>({team,club,kit:club.kit,role:bench?'substitute':'player',player:{number,name},keeper:index===0,height:index===0?1.93:1.78+(index%5)*.035,dark:[1,4,6,10].includes(index),hair:[1,4,6,10].includes(index)?'crop':'short02',hairColor:0x81776d,phase:index*.61,boot:[0xc3cdbe,0xd5a393,0x8aa0bd][index%3],...(bench?placement(index):{})});
 return{club,xi:club.xi.map((p,i)=>make(p,i)),bench:club.bench.map((p,i)=>make(p,i,true))};
}
export const difficulties={casual:{label:'轻松',speed:.89,reaction:1.45,range:.67,shotError:1.4},regular:{label:'标准',speed:1,reaction:1,range:.85,shotError:.65},challenge:{label:'挑战',speed:1.04,reaction:.78,range:.95,shotError:.3}};
export const cameraLabels={close:'近景转播',broadcast:'广角转播',follow:'跟随'};
export function matchOptions(value={}){return{opponent:footballTeam(value.opponent).id,difficulty:Object.hasOwn(difficulties,value.difficulty)?value.difficulty:'casual',camera:Object.hasOwn(cameraLabels,value.camera)?value.camera:'close',rules:normalizeRules(value.rules),selection:value.selection?.xi?{formation:value.selection.formation,xi:[...value.selection.xi]}:null};}
export function loadMatchOptions(storage){try{return matchOptions(JSON.parse(storage?.getItem('arena-match-options')||'{}'));}catch{return matchOptions();}}
export function saveMatchOptions(storage,options){try{storage?.setItem('arena-match-options',JSON.stringify(matchOptions(options)));}catch{}}
