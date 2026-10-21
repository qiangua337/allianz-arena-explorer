import {ACCESS_BASE,ACCESS_TOP,accessStairs,accessAt,perimeterPoint} from './access-layout.js';
import {coreFlights,coreLevels,inCoreShaft,seatingTiers,onBridge,bridges} from './building-layout.js';

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
node('door',0,ACCESS_BASE,122,'进入接待大厅','进入接待大厅，跟随所选目的地的路线');
node('reception',0,ACCESS_BASE,113,'接待大厅','沿金色路线右转，前往对应入口或公共楼梯');
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
node('homeDoor',-73.3,-2.7,0,'主队更衣室入口','靠近感应门，步行进入红色更衣室');
node('homeRoom',-76,-2.7,0,'拜仁主队更衣室','已到达主队更衣室');
const main=['entrance','security','forecourt','door','reception','turn','visitorGate','passage','ramp','pitchExit','pitchEdge','pitch','westField','tunnelMouth','tunnelStairs','tunnel','corridor','homeDoor','homeRoom'];
for(let i=1;i<main.length;i++)join(main[i-1],main[i]);
for(const [id,z,doorX]of[['guestRoom',28,-72.5],['press',-31,-71.5]]){
 node(id,-78,-2.7,z,'球员区房间','先从东侧开放门返回走廊');node(id+'Door',doorX+.3,-2.7,z,'返回球员区走廊','沿走廊前往球员通道');node(id+'Corridor',-69.5,-2.7,z,'球员区走廊','沿走廊前往球员通道');join(id,id+'Door');join(id+'Door',id+'Corridor');join(id+'Corridor','corridor');
}
for(let i=0;i<32;i++){
 const t=i/32*Math.PI*2,p=perimeterPoint(92,110,t),q=perimeterPoint(142,160,t),lower=perimeterPoint(96,113,t);
 node('upper'+i,p.x,ACCESS_TOP,p.z,'公共大厅','沿环形大厅前往目的地','upper');node('outside'+i,q.x,ACCESS_BASE,q.z,'球场外环步道','沿外环返回南侧接待大厅');node('lower'+i,lower.x,ACCESS_BASE,lower.z,'接待层环廊','沿环廊前往目的地，东侧室内楼梯可逐层上下');
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
node('store',12,ACCESS_TOP,118,'球迷商店','从东侧开放门返回公共大厅','upper');node('storeDoor',15.3,ACCESS_TOP,118,'球迷商店出口','前往公共大厅下楼出口','upper');node('storeOutside',23,ACCESS_TOP,118,'公共大厅','沿环形大厅前往目的地','upper');join('store','storeDoor');join('storeDoor','storeOutside');join('storeOutside','upper7');
node('museum',-94,12,58,'荣誉展厅','从东侧开放门返回公共大厅','upper');node('museumDoor',-87.8,12,58,'荣誉展厅出口','沿环形大厅前往目的地','upper');join('museum','museumDoor');join('museumDoor','upper14');

// Route nodes follow the same flights and landings as the visible building.
node('coreApproach',96,ACCESS_BASE,-15,'室内公共楼梯','沿环廊走到楼梯前方');
node('coreFront',101.5,ACCESS_BASE,-15,'公共楼梯入口','进入前方开放楼梯间');join('lower0','coreApproach');join('lower31','coreApproach');join('coreApproach','coreFront');
for(let i=0;i<coreLevels.length;i++){
 const y=coreLevels[i],level=i===0?'lower':i===1?'upper':'gallery';
 node('landing'+i,101.5,y,-10.5,['入口层楼梯大厅','公共大厅楼梯出口','包厢与中层看台','上层看台楼梯出口'][i],'按地线走，楼梯可逐级上下',level);
 if(i===0)join('coreFront','landing0');
 if(i===1){node('corePublicFront',101.5,y,-15,'公共大厅','从开放楼梯出口进入环形大厅','upper');node('corePublicApproach',95,y,-15,'公共大厅环廊','商店与展厅沿环廊可达','upper');join('landing1','corePublicFront');join('corePublicFront','corePublicApproach');join('corePublicApproach','upper0');join('corePublicApproach','upper31');}
 if(i<3){const a=coreFlights[i*2],b=coreFlights[i*2+1];
  for(const [id,x,yy,z]of[[`flight${i}Start`,a.x,a.base,a.z-.1],[`flight${i}Out`,a.x,a.top,a.z+a.run+.8],[`flight${i}Turn`,b.x,b.base,b.z+.8],[`flight${i}End`,b.x,b.top,b.z-b.run-.1]])node(id,x,yy,z,'室内楼梯 · '+Math.round(yy)+' m','走到平台后转弯，继续下一段楼梯','core');
  const ids=['landing'+i,`flight${i}Start`,`flight${i}Out`,`flight${i}Turn`,`flight${i}End`,'landing'+(i+1)];for(let j=1;j<ids.length;j++)join(ids[j-1],ids[j]);
 }
}
node('loungeDoor',95.5,23.6,-10.5,'贵宾包厢入口','靠近自动门后步行进入','gallery');node('lounge',92,23.6,-10.5,'贵宾包厢','可以沿窗边欣赏球场','gallery');join('landing2','loungeDoor');join('loungeDoor','lounge');
node('middleBridgeStart',101.5,23.6,-30.1,'中层看台连廊','沿带扶手的连廊前往看台','gallery');node('stands',82.55,23.6,-30.1,'中层看台','沿座椅间过道上下，也可按 F 坐下','gallery');join('landing2','middleBridgeStart');join('middleBridgeStart','stands');
node('upperBridgeStart',104,40,-36.5,'上层看台连廊','沿连廊进入上层看台','gallery');node('upperStands',102.75,40,-36.5,'上层看台','沿过道自由探索','gallery');join('landing3','upperBridgeStart');join('upperBridgeStart','upperStands');
node('lowerEntry',0,12.2,-104,'下层看台入口','沿缓坡步行进入下层看台','upper');node('lowerStands',0,10.512,-83.2,'下层看台','沿阶梯过道上下探索','stands');join('upper24','lowerEntry');join('lowerEntry','lowerStands');
for(const[id,from,x,y,z,label]of[['arcade','reception',36,-2.9,110,'接待大厅'],['visitorEntry','turn',22,-2.9,111,'参观通道入口'],['concourse','upper31',94,12.2,-47,'公共大厅'],['access','coreFront',101.5,-2.9,-14,'室内公共楼梯'],['esplanade','entrance',-32,-5.14,280,'南侧广场']]){node(id,x,y,z,label,'沿地线继续步行',y>9?'upper':'lower');join(id,from);}
node('exterior',0,-4.103,214,'南侧正门','正门外的出发位置');join('exterior','entrance');
const bypass=links.findIndex(([a,b])=>a==='upper14'&&b==='upper15');links.splice(bypass,1);node('museumBypass',-85.5,12.2,43.5,'展厅外侧环廊','沿展厅外侧绕行','upper');join('upper15','museumBypass');join('museumBypass','upper14');
// Once a visitor walks down an aisle, returning to the public corridor must
// lead back up that tier, rather than straight through the seating structure.
seatingTiers.forEach((tier,ti)=>{
 for(let aisle=0;aisle<48;aisle++)for(const [part,row]of[['front',0],['mid',Math.floor(tier.rows/2)],['rear',tier.rows-1]]){
  const p=perimeterPoint(tier.a+row*tier.depth+.25,tier.b+row*tier.depth+.25,aisle/48*Math.PI*2,3.35),id=`seat${ti}-${aisle}-${part}`;
  if(ti===2&&inCoreShaft(p.x,p.z,.4))continue;
  node(id,p.x,tier.y+row*tier.depth*Math.tan(tier.angle*Math.PI/180),p.z,['下层','中层','上层'][ti]+'看台过道','沿过道返回本层出口',`seat${ti}`);
 }
 for(let aisle=0;aisle<48;aisle++){const prefix=`seat${ti}-${aisle}-`;for(const [a,b]of[['front','mid'],['mid','rear']])if(nodes[prefix+a]&&nodes[prefix+b])join(prefix+a,prefix+b);for(const part of['rear','mid']){const a=prefix+part,b=`seat${ti}-${(aisle+1)%48}-${part}`;if(nodes[a]&&nodes[b])join(a,b);}}
 join(['lowerStands','stands','upperStands'][ti],`seat${ti}-${ti===0?36:47}-rear`);
});
export const tourNodes=nodes;
export const tourLinks=links;
const neighbours=new Map(Object.keys(nodes).map(id=>[id,[]]));for(const[a,b]of links){neighbours.get(a).push(b);neighbours.get(b).push(a);}
export const tourGoals={arcade:'接待大厅',concourse:'公共大厅',access:'室内公共楼梯',store:'球迷商店',museum:'荣誉展厅',lowerStands:'下层看台',stands:'中层看台',upperStands:'上层看台',lounge:'贵宾包厢',visitorEntry:'草坪参观入口',pitch:'草坪',tunnel:'球员入场通道',homeRoom:'主队更衣室',guestRoom:'客队更衣室',press:'新闻发布厅',esplanade:'南侧广场',entrance:'返回南侧正门',exterior:'南侧正门'};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y-b.y)*2);
export function planTour(position,goal='pitch'){
 if(!nodes[goal])goal='pitch';
 let candidates=Object.values(nodes);const inner=(Math.abs(position.x)/86)**2.8+(Math.abs(position.z)/104)**2.8,outer=(Math.abs(position.x)/105)**2.8+(Math.abs(position.z)/120)**2.8,stair=accessAt(position.x,position.z);
 if(inCoreShaft(position.x,position.z)||position.x>97&&Math.abs(position.z+10.5)<4)candidates=candidates.filter(n=>n.id.startsWith('flight')||n.id.startsWith('landing')).filter(n=>Math.abs(n.y-position.y)<10);
 else if(seatingTiers.some(t=>position.y>=t.y-.15&&position.y<t.y+(t.rows-1)*t.depth*Math.tan(t.angle*Math.PI/180)+.85&&(Math.abs(position.x)/(t.a+t.rows*t.depth+.3))**3.35+(Math.abs(position.z)/(t.b+t.rows*t.depth+.3))**3.35<1&&(Math.abs(position.x)/(t.a-.2))**3.35+(Math.abs(position.z)/(t.b-.2))**3.35>1)){
  const ti=seatingTiers.findIndex(t=>position.y>=t.y-.15&&position.y<t.y+(t.rows-1)*t.depth*Math.tan(t.angle*Math.PI/180)+.85&&(Math.abs(position.x)/(t.a+t.rows*t.depth+.3))**3.35+(Math.abs(position.z)/(t.b+t.rows*t.depth+.3))**3.35<1&&(Math.abs(position.x)/(t.a-.2))**3.35+(Math.abs(position.z)/(t.b-.2))**3.35>1);candidates=candidates.filter(n=>n.level===`seat${ti}`||n.id===['lowerStands','stands','upperStands'][ti]);
 }
 else if(onBridge(position.x,position.z,bridges.at(-1))!==null&&position.y>9)candidates=candidates.filter(n=>n.id==='lowerEntry'||n.id==='lowerStands');
 else if(position.y>30)candidates=candidates.filter(n=>n.y>35);
 else if(position.y>19)candidates=candidates.filter(n=>n.level==='gallery'&&n.y<30);
 else if(position.y>1&&position.y<11&&stair)candidates=candidates.filter(n=>n.id.startsWith(stair.stair.id));
 else if(position.y>9)candidates=candidates.filter(n=>n.level==='upper');
 else if(inVisitorPassage(position.x,position.z))candidates=candidates.filter(n=>['visitorGate','passage','ramp','pitchExit','pitchEdge'].includes(n.id));
 else if(position.y<2&&inner>1&&outer<1.02)candidates=candidates.filter(n=>n.id.startsWith('lower')||['reception','turn','door'].includes(n.id));
 else if(position.y<2&&outer>=1.02)candidates=candidates.filter(n=>n.id.startsWith('outside')||n.id.endsWith('Bottom')||['entrance','security','forecourt','door'].includes(n.id));
 const start=candidates.reduce((best,n)=>distance(position,n)<distance(position,best)?n:best,candidates[0]).id;
 const costs=new Map([[start,0]]),previous=new Map(),open=[{id:start,cost:0,score:distance(nodes[start],nodes[goal])}];
 function enqueue(item){let lo=0,hi=open.length;while(lo<hi){const mid=(lo+hi)>>1;if(open[mid].score<item.score)lo=mid+1;else hi=mid;}open.splice(lo,0,item);}
 while(open.length){const current=open.shift(),at=current.id,best=current.cost;if(best!==costs.get(at))continue;if(at===goal)break;
  for(const next of neighbours.get(at)){const outdoorDetour=!stair&&(at.startsWith('outside')||next.startsWith('outside')||/^T\d/.test(at)||/^T\d/.test(next))?500:0,cost=best+distance(nodes[at],nodes[next])+outdoorDetour;if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);previous.set(next,at);enqueue({id:next,cost,score:cost+distance(nodes[next],nodes[goal])});}}
 }
 const ids=[goal];while(ids[0]!==start){const p=previous.get(ids[0]);if(!p)return[];ids.unshift(p);}return ids.map(id=>nodes[id]);
}
