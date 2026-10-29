export const competitionModes={league:{label:'常规赛',description:'上下半场 · 可平局',extraTime:false,penalties:false},cup:{label:'加时＋点球',description:'平局先加时，再踢点球',extraTime:true,penalties:true},decider:{label:'平局直接点球',description:'不踢加时赛',extraTime:false,penalties:true},shootout:{label:'点球大战',description:'直接进行五轮点球',extraTime:false,penalties:true,standalone:true}};
export const matchDurations=[{value:180,label:'3 分钟',description:'每半场 90 秒'},{value:360,label:'6 分钟',description:'每半场 3 分钟'},{value:600,label:'10 分钟',description:'每半场 5 分钟'}];
export function normalizeRules(value={}){return{mode:Object.hasOwn(competitionModes,value?.mode)?value.mode:'league',duration:matchDurations.some(d=>d.value===value?.duration)?value.duration:180,substitutions:5,subWindows:3,extraSubstitution:true,extraWindow:true};}
export function createCompetition(rules,duration){return{...normalizeRules(rules),regulationDuration:duration,period:1,stage:'regulation',periodStart:0,periodLength:duration/2,next:null,result:null,shootout:null};}
export function periodLabel(state){const c=state?.competition;if(!c)return'体验赛';if(c.stage==='shootout')return'点球大战';return{1:'上半场',2:'下半场',3:'加时上半场',4:'加时下半场'}[c.period]||'比赛';}
export function intervalLabel(c){return c?.next==='shootout'?'准备点球大战':c?.next===3?'准备加时赛':c?.next===4?'加时中场休息':'中场休息';}
export function nextPeriod(c,score){if(c.period===1)return 2;if(c.period===3)return 4;if(score.home!==score.away)return null;const mode=competitionModes[c.mode];if(c.period===2&&mode.extraTime)return 3;return mode.penalties?'shootout':null;}
export function shootoutWinner(home,away){const h=home.filter(Boolean).length,a=away.filter(Boolean).length;if(home.length<=5&&away.length<=5){if(h>a+5-away.length)return'home';if(a>h+5-home.length)return'away';}if(home.length>=5&&home.length===away.length&&h!==a)return h>a?'home':'away';return null;}
// Contact and a failure to play the exposed ball are required. A fair tackle
// from behind is not, by itself, a foul or a card.
export function assessChallenge(defender,owner,ball,clean=false){if(clean||!owner||owner.team===defender.team)return null;const d=Math.hypot(defender.x-owner.x,defender.z-owner.z),gap=Math.hypot(defender.x-ball.x,defender.z-ball.z);if(d>1.15||gap<.72||ball.y>.85)return null;const speed=Math.hypot(defender.vx||0,defender.vz||0),dx=defender.x-owner.x,dz=defender.z-owner.z,behind=(Math.sin(owner.yaw)*dx+Math.cos(owner.yaw)*dz)/(d||1)<-.35;
 return{card:speed>7.1&&behind&&gap>1.3?'red':speed>4.7&&gap>1.0||defender.fouls>=2?'yellow':null,reason:speed>7.1&&behind&&gap>1.3?'危险冲撞':speed>4.7?'鲁莽抢断':'未触球的身体接触'};
}
