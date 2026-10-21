import {ACCESS_BASE,ACCESS_TOP,accessStairs,accessAt,perimeterPoint} from './access-layout.js';

// A representative visitor passage connects the model's arrival hall to the
// pitch. Its position and dimensions are an explorable approximation.
export const visitorPassage={x:22,width:6.4,entryZ:103.3,backZ:104.6,rampZ:66,exitZ:59.6,steps:16,base:ACCESS_BASE,head:0.55};
export function inVisitorPassage(x,z,margin=0){const p=visitorPassage;return Math.abs(x-p.x)<p.width/2+margin&&z>=p.exitZ-.7&&z<=p.backZ;}
export function visitorFloor(x,z){
 if(!inVisitorPassage(x,z))return null;const p=visitorPassage;
 if(z>=p.rampZ)return p.base;
 const step=Math.min(p.steps,Math.max(0,Math.floor((p.rampZ-z)/((p.rampZ-p.exitZ)/p.steps))+1));
 return p.base+(0-p.base)*step/p.steps;
}
export const visitorWallOpening=(x,z)=>Math.abs(x-visitorPassage.x)<visitorPassage.width/2&&z>95;
export const visitorBowlOpening=(x,z,row=0)=>row<8&&Math.abs(x-visitorPassage.x)<visitorPassage.width/2+.35&&z>45;
export const bowlOpening=(x,z,row=0)=>row<17&&x<0&&Math.abs(z)<3||visitorBowlOpening(x,z,row);

const nodes={},links=[];
function node(id,x,y,z,label,hint,level='lower'){nodes[id]={id,x,y,z,label,hint,level};return id;}
function join(a,b){links.push([a,b]);}
node('entrance',0,-4.103,214,'南侧正门','沿正门中央开放通道前行');
node('security',0,-3.7,180,'穿过正门','沿金色地线进入大厅');
node('forecourt',0,ACCESS_BASE,132,'大厅入口','从中间的开放门进入');
node('door',0,ACCESS_BASE,122,'进入接待大厅','继续前行，参观入口在右侧');
node('reception',0,ACCESS_BASE,113,'接待大厅','右转，沿金色地线前往参观入口');
node('turn',22,ACCESS_BASE,113,'球场参观入口','右转后，从红色开放门进入');
node('visitorGate',22,ACCESS_BASE,101,'进入球场参观通道','沿灯带直行，前方通往草坪与看台');
node('passage',22,ACCESS_BASE,81,'球场参观通道','继续直行，前方是上行踏步');
node('ramp',22,ACCESS_BASE,66.2,'走上场边踏步','沿踏步向前，出口就是球场');
node('pitchExit',22,0,58.8,'走出参观通道','已进入球场，可近看草坪与三层看台');
node('pitchEdge',22,0,54,'场边','沿金色地线走向草坪');
node('pitch',0,0,13,'草坪与看台','沿地线走向草坪，也可切换目的地继续参观');
node('westField',-34,0,5,'前往球员通道','西侧红色开口通往球员区域');
node('tunnelMouth',-40.5,0,0,'球员通道入口','沿阶梯下行进入红色通道');
node('tunnelStairs',-46.5,-2.7,0,'球员通道阶梯','沿红色灯带向内走');
node('tunnel',-60,-2.7,0,'球员入场通道','继续向内可到主队更衣室');
node('corridor',-69.5,-2.7,0,'球员区走廊','前方左侧开口是主队更衣室');
node('homeDoor',-73.3,-2.7,0,'主队更衣室入口','从开放门进入红色更衣室');
node('homeRoom',-76,-2.7,0,'拜仁主队更衣室','已到达主队更衣室');
const main=['entrance','security','forecourt','door','reception','turn','visitorGate','passage','ramp','pitchExit','pitchEdge','pitch','westField','tunnelMouth','tunnelStairs','tunnel','corridor','homeDoor','homeRoom'];
for(let i=1;i<main.length;i++)join(main[i-1],main[i]);
for(const [id,z,doorX]of[['guestRoom',28,-72.5],['press',-31,-71.5]]){
 node(id,-78,-2.7,z,'球员区房间','先从东侧开放门返回走廊');node(id+'Door',doorX+.3,-2.7,z,'返回球员区走廊','沿走廊前往球员通道');node(id+'Corridor',-69.5,-2.7,z,'球员区走廊','沿走廊前往球员通道');join(id,id+'Door');join(id+'Door',id+'Corridor');join(id+'Corridor','corridor');
}
for(let i=0;i<32;i++){
 const t=i/32*Math.PI*2,p=perimeterPoint(92,110,t),q=perimeterPoint(142,160,t),lower=perimeterPoint(96,113,t);
 node('upper'+i,p.x,ACCESS_TOP,p.z,'公共大厅','沿环廊前往下楼出口','upper');node('outside'+i,q.x,ACCESS_BASE,q.z,'球场外环步道','沿外环返回南侧接待大厅');node('lower'+i,lower.x,ACCESS_BASE,lower.z,'接待层环廊','沿金色地线前往南侧球场参观入口');
 if(i){join('upper'+(i-1),'upper'+i);join('outside'+(i-1),'outside'+i);join('lower'+(i-1),'lower'+i);}
}
join('upper31','upper0');join('outside31','outside0');join('outside8','forecourt');
join('lower31','lower0');join('lower8','reception');join('lower7','turn');
for(let i=0;i<8;i++){
 const s=accessStairs[i],k=Math.round(s.t/(Math.PI*2)*32)%32;
 node(s.id+'Top',s.topX,ACCESS_TOP,s.topZ,s.id+' 下楼出口','沿楼梯下到入口层','upper');
 node(s.id+'Middle',(s.topX+s.x)/2,(ACCESS_BASE+ACCESS_TOP)/2,(s.topZ+s.z)/2,s.id+' 楼梯','沿扶手下楼后返回南侧接待大厅','stairs');
 node(s.id+'Bottom',s.x,ACCESS_BASE,s.z,s.id+' 楼梯底部','沿外环返回接待大厅');
 join('upper'+k,s.id+'Top');join(s.id+'Top',s.id+'Middle');join(s.id+'Middle',s.id+'Bottom');join(s.id+'Bottom','outside'+k);
}
node('store',0,ACCESS_TOP,111,'球迷商店','从东侧开放门返回公共大厅','upper');node('storeDoor',15.3,ACCESS_TOP,111,'球迷商店出口','前往公共大厅下楼出口','upper');node('storeOutside',23,ACCESS_TOP,111,'公共大厅','沿环廊前往下楼出口','upper');join('store','storeDoor');join('storeDoor','storeOutside');join('storeOutside','upper7');
node('museum',-94,12,58,'荣誉展厅','从东侧开放门返回公共大厅','upper');node('museumDoor',-87.8,12,58,'荣誉展厅出口','沿环廊前往下楼出口','upper');join('museum','museumDoor');join('museumDoor','upper14');

export const tourNodes=nodes;
export const tourLinks=links;
export const tourGoals={pitch:'草坪与看台',tunnel:'球员入场通道',homeRoom:'主队更衣室',entrance:'返回南侧正门'};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y-b.y)*2);
export function planTour(position,goal='pitch'){
 if(!nodes[goal])goal='pitch';
 let candidates=Object.values(nodes);const inner=(Math.abs(position.x)/86)**2.8+(Math.abs(position.z)/104)**2.8,outer=(Math.abs(position.x)/105)**2.8+(Math.abs(position.z)/120)**2.8,stair=accessAt(position.x,position.z);
 if(position.y>1&&position.y<11&&stair)candidates=candidates.filter(n=>n.id.startsWith(stair.stair.id));
 else if(position.y>9)candidates=candidates.filter(n=>n.level==='upper');
 else if(inVisitorPassage(position.x,position.z))candidates=candidates.filter(n=>['visitorGate','passage','ramp','pitchExit','pitchEdge'].includes(n.id));
 else if(position.y<2&&inner>1&&outer<1.02)candidates=candidates.filter(n=>n.id.startsWith('lower')||['reception','turn','door'].includes(n.id));
 else if(position.y<2&&outer>=1.02)candidates=candidates.filter(n=>n.id.startsWith('outside')||n.id.endsWith('Bottom')||['entrance','security','forecourt','door'].includes(n.id));
 const start=candidates.reduce((best,n)=>distance(position,n)<distance(position,best)?n:best,candidates[0]).id;
 const costs=new Map([[start,0]]),previous=new Map(),open=new Set(Object.keys(nodes));
 while(open.size){let at=null,best=Infinity;for(const id of open){const cost=costs.get(id)??Infinity;if(cost<best){at=id;best=cost;}}if(!at||at===goal)break;open.delete(at);
  for(const [a,b]of links){const next=a===at?b:b===at?a:null;if(!next||!open.has(next))continue;const cost=best+distance(nodes[at],nodes[next]);if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);previous.set(next,at);}}
 }
 const ids=[goal];while(ids[0]!==start){const p=previous.get(ids[0]);if(!p)return[];ids.unshift(p);}return ids.map(id=>nodes[id]);
}
