import {playerByNumber} from './roster.js';
export const matchdayFixture={home:'FC BAYERN',away:'DORTMUND',title:'拜仁慕尼黑 × 多特蒙德',checked:'2026-10-23',note:'演示首发与站位，非某场真实比赛名单',sources:['https://fcbayern.com/en/teams/first-team','https://shop.bvb.de/pages/shop-by-player']};
const awayNames={1:'KOBEL',3:'ANTON',4:'SCHLOTTERBECK',5:'BENSEBAINI',7:'BELLINGHAM',8:'NMECHA',9:'GUIRASSY',14:'BEIER',17:'CHUKWUEMEKA',18:'NWANERI',19:'KARETSAS',20:'SABITZER',21:'SILVA',22:'GADOU',23:'CAN',24:'SVENSSON',25:'VEERMAN',26:'RYERSON',33:'MEYER',36:'PRATES'};
const height={1:1.93,2:1.86,4:1.95,6:1.77,9:1.88,10:1.84,14:1.80,17:1.84,19:1.85,44:1.87,45:1.88};
function player(team,number,index){const home=team==='home',dark=home?[2,14,17,19].includes(number):[5,7,8,9,17,18,22,36].includes(number);return{team,role:'player',player:home?playerByNumber(number):{number,name:awayNames[number]},keeper:number===1||number===40||number===33,height:home?height[number]||1.84:1.80+(index%4)*.045,dark,hair:dark?'crop':'short02',hairColor:0x9a8476,phase:index*.61,boot:[0xd3c8b5,0x91a5a1,0xd8c5bb,0xdddcd3][index%4]};}
export const homeXI=[1,9,6,4,2,44,19,45,10,17,14].map((n,i)=>player('home',n,i));
export const awayXI=[1,9,4,3,5,26,24,7,25,8,14].map((n,i)=>player('away',n,i+11));
export const starters=Array.from({length:11},(_,i)=>[homeXI[i],awayXI[i]]).flat();
export const substitutes=['home','away'].flatMap((team,t)=>(t?[33,22,23,20,21,17,18,19,36]:[40,3,11,21,23,8,27,7,42]).map((number,i)=>({...player(team,number,i+22),role:'substitute',seated:true,x:-37.45,z:(t?18:-18)-7.1+i*1.28,yaw:Math.PI/2})));
export const teamStaff=['home','away'].flatMap((team,t)=>['coach','assistant','doctor','physio'].map((role,i)=>({team,role,player:{name:{coach:'COACH',assistant:'ASSISTANT',doctor:'MEDICAL',physio:'PHYSIO'}[role]},height:1.78+i*.035,hair:'short02',hairColor:0x78736c,phase:i*.83,seated:i===1,x:i===1?-38.6:-35.9,z:(t?18:-18)+5.4+(i===1?1.0:i*.9),yaw:Math.PI/2})));
export const officials=Array.from({length:4},(_,i)=>({team:'official',role:i===0?'referee':i===3?'fourth':'assistantReferee',player:{name:i===0?'REFEREE':i===3?'4TH OFFICIAL':'ASSISTANT'},height:1.78+i*.025,hair:'short02',hairColor:0x817263,phase:i*.7,flag:i===1||i===2}));
export const matchdayPeople=[...starters,...officials,...substitutes,...teamStaff];

// The guest dressing room uses the same exhibition squad as the optional matchday.
export const awayKitRoster=[...awayXI,...substitutes.filter(p=>p.team==='away')].map(p=>p.player);
