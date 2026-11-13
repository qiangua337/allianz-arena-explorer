import {abilityFactor,playerAbilities} from './football-abilities.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function possessionTeam(ball,players){const owner=players.find(p=>p.id===ball.ownerId&&!p.dismissed);if(owner)return owner.team;const receiver=players.find(p=>p.id===ball.targetId&&!p.dismissed);return receiver?.team||ball.shot?.team||null;}
export function passRunSeconds(role){return role==='CB'||role==='GK'?0:role==='DM'?1:role==='CM'?1.8:3.0;}

function throughTarget(mate,ball,aim,distance,power,sign){
 const vx=mate.vx||0,vz=mate.vz||0,speed=Math.hypot(vx,vz),runX=vx/(speed||1),runZ=vz/(speed||1);
 const aligned=runX*aim.x+runZ*aim.z;
 const leadingRun=speed>=1.55&&aligned>-.28&&!(aim.z*sign>.35&&runZ*sign<-.34);
 const blend=leadingRun?clamp((speed-.9)/3,.30,.82):0;
 const lx=aim.x*(1-blend)+runX*blend,lz=aim.z*(1-blend)+runZ*blend,norm=Math.hypot(lx,lz)||1;
 const lead=leadingRun?Math.min(4+power*6,2+distance*.43):4+power*6;
 const landing=scale=>({x:clamp(mate.x+(vx*.16+lx/norm*lead)*scale,-32.5,32.5),z:clamp(mate.z+(vz*.16+lz/norm*lead)*scale,-50.4,50.4)});
 const target=landing(1),along=(target.x-ball.x)*aim.x+(target.z-ball.z)*aim.z;
 if(leadingRun&&along<.12*Math.hypot(target.x-ball.x,target.z-ball.z)){
  return{target:{x:clamp(mate.x+aim.x*lead,-32.5,32.5),z:clamp(mate.z+aim.z*lead,-50.4,50.4)},shorter:null};
 }
 return{target,shorter:leadingRun?landing(.62):null};
}

function passLane(players,team,from,to){
 const dx=to.x-from.x,dz=to.z-from.z,length2=dx*dx+dz*dz||1;
 let lane=8,space=12;
 for(const foe of players){
  if(foe.dismissed||foe.team===team)continue;
  const x=foe.x-from.x,z=foe.z-from.z,t=clamp((x*dx+z*dz)/length2,.06,.94);
  lane=Math.min(lane,Math.hypot(x-dx*t,z-dz*t));
  space=Math.min(space,Math.hypot(foe.x-to.x,foe.z-to.z));
 }
 return{lane,space};
}

export function boxPassTarget(ball,mate,sign,{direction=null,type='pass'}={}){
 const fromDepth=ball.z*sign,side=Math.sign(ball.x),toDepth=mate.z*sign,inward=(ball.x-mate.x)*side;
 if(fromDepth<39||Math.abs(ball.x)<16.5||mate.keeper||mate.dismissed||mate.trainingInactive||Math.abs(mate.x)>16||inward<6.5)return null;
 const change=toDepth-fromDepth,delivery=change<=-3.4?'cutback':'cross';
 if(delivery==='cutback'?(toDepth<29.5||change< -17):(toDepth<36||toDepth>50.2||change>8))return null;
 const lead=delivery==='cutback'?.18:type==='through'?.35:.24;
 const x=clamp(mate.x+clamp((mate.vx||0)*lead,-1.65,1.65),-16,16);
 const depth=clamp(toDepth+clamp((mate.vz||0)*sign*lead,-1.65,1.65),delivery==='cutback'?29.5:36,delivery==='cutback'?fromDepth-3:50.2),z=depth*sign;
 const dx=x-ball.x,dz=z-ball.z,length=Math.hypot(dx,dz),aimX=direction?.x||0,aimZ=direction?.z||0,aimLength=Math.hypot(aimX,aimZ);
 if(length>32||dx*side> -5.5)return null;
 if(aimLength>.18&&((dx*aimX+dz*aimZ)/(length*aimLength)<.58||aimX*side> -aimLength*.20||delivery==='cutback'&&aimZ*sign>aimLength*.24))return null;
 return{x,z,delivery};
}

export function passOption(players,player,ball,{direction=null,type='pass',power=.45}={}){
 const strength=direction?Math.hypot(direction.x,direction.z):0,aim=strength>.18?{x:direction.x/strength,z:direction.z/strength}:{x:Math.sin(player.yaw),z:Math.cos(player.yaw)},sign=player.attackSign??(player.team==='home'?-1:1);
 let best=null;
 const vision=abilityFactor(playerAbilities(player).passing,.012);
 for(const mate of players){if(mate.dismissed||mate.team!==player.team||mate.id===player.id)continue;
  const dx=mate.x-ball.x,dz=mate.z-ball.z,d=Math.hypot(dx,dz);if(d<2.5||d>48)continue;const alignment=(dx*aim.x+dz*aim.z)/d;if(strength>.18&&alignment<.1)continue;
  let target=boxPassTarget(ball,mate,sign,{direction:aim,type}),coverage;
  if(target)coverage=passLane(players,player.team,ball,target);
  else if(type==='through'){
   const lead=throughTarget(mate,ball,aim,d,power,sign);
   target=lead.target;coverage=passLane(players,player.team,ball,target);
   if(lead.shorter&&coverage.space<2.3){
    const shorter=passLane(players,player.team,ball,lead.shorter);
    if(shorter.space>coverage.space+1&&shorter.lane>=coverage.lane-.25){target=lead.shorter;coverage=shorter;}
   }
  }else{
   target={x:clamp(mate.x+(mate.vx||0)*.22,-32.5,32.5),z:clamp(mate.z+(mate.vz||0)*.22,-50.4,50.4)};
   coverage=passLane(players,player.team,ball,mate);
  }
  const {lane,space}=coverage;
  const score=alignment*(strength>.18?23:11)+(Math.min(space,9)*.65+Math.min(lane,5)*1.6)*vision-clamp(2-lane,0,2)*6-Math.abs(d-(type==='through'?22:13+power*9))*.23+clamp(dz*sign,-16,24)*.10-(mate.keeper?6:0)+(target.delivery?2.2:0);
  if(!best||score>best.score)best={player:mate,...target,score,lane,distance:d};
 }return best;
}
export const shotKinds=['drive','finesse','lob'];
export const shotLabels={drive:'劲射',finesse:'搓射',lob:'挑射'};
export const deliveryLabels={cutback:'倒三角',cross:'低平横传'};
// Assistance chooses a useful goal target; preparation describes how reliably
// the player can actually strike it. No random state is consumed by a preview.
export function shotPreparation(player,ball,{power=.5,pressure=Infinity}={}){
 power=clamp(power,.15,1);const sign=player.attackSign??(player.team==='home'?-1:1),dx=-ball.x,dz=sign*52.5-ball.z,distance=Math.hypot(dx,dz),yaw=Number.isFinite(player.yaw)?player.yaw:Math.atan2(dx,dz),alignment=distance>.01?(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/distance:1;
 const back=clamp((Math.acos(clamp(alignment,-1,1))-.85)/1.8,0,1),speed=clamp((Math.hypot(player.vx||0,player.vz||0)-3)/5,0,1),range=clamp((distance-24)/42,0,1.6),over=clamp((power-.8)/.2,0,1),crowded=clamp((3-pressure)/3,0,1),quality=clamp(1-back*.40-speed*.25-range*.19-over*.10-crowded*.12,.08,1);
 const preparation=back>.25?'backfoot':speed>.4?'rushed':crowded>.5?'pressured':over>.6?'overpowered':range>.25?'long-range':'balanced';
 const control=abilityFactor(playerAbilities(player).finishing,.018);
 return{quality:clamp(quality+(control-1)*.16,.08,1),preparation,spread:(.12+distance*(range*.011+back*.040+speed*.014+over*.008+crowded*.008))/control,heightSpread:(.02+range*.35+back*.40+speed*.20+over*.60+crowded*.18)/control,heightBias:over*(.4+back*.6+range*.25)};
}
export function shotOption(player,ball,{direction=null,power=.5,error=0,heightError=null,kind='drive',keeper=null,pressure=Infinity}={}){
 kind=shotKinds.includes(kind)?kind:'drive';power=clamp(power,.15,1);const preparation=shotPreparation(player,ball,{power,pressure});
 const sign=player.attackSign??(player.team==='home'?-1:1),goalZ=sign*52.5,dz=goalZ-ball.z,strength=direction?Math.hypot(direction.x,direction.z):0,explicit=strength>.18;
 const openSide=keeper?keeper.x>ball.x*.12?-1:1:player.x>0?-1:1,corner=explicit?clamp(direction.x/strength,-1,1)*3.12:openSide*2.65,x=clamp(corner+error,-9,9),dx=x-ball.x,distance=Math.hypot(dx,dz),nominal=kind==='finesse'?17+power*10:16+power*19;
 const flight=kind==='lob'?Math.max(.72,distance/(12+power*5)):-Math.log(Math.max(.25,1-.08*distance/nominal))/.08,speed=distance*.08/(1-Math.exp(-.08*flight)),y=clamp((kind==='lob'?1.75+power*.25:kind==='finesse'?1.05+power*.55:.42+power*.62)+(heightError??preparation.heightBias),.08,4.6),curve=kind==='finesse'?Math.sign(corner)*(4.2+power*1.8):0;
 const travel=(1-Math.exp(-.08*flight))/.08,curveTravel=(flight-travel)/.08,vx=(dx-curve*curveTravel)/travel,vz=dz/travel,requiredLift=(y-(ball.y||.11)+4.905*flight*flight)/flight,maxLift=kind==='lob'?9+power*5:nominal*(kind==='finesse'?.30+power*.12:.25+power*.13),vy=Math.min(requiredLift,maxLift);
 return{x,y,z:goalZ,speed,vx,vz,vy,curve,flight,distance,kind,quality:preparation.quality,preparation:preparation.preparation,spread:preparation.spread,heightSpread:preparation.heightSpread,limited:requiredLift>maxLift};
}
export function receivingPoint(player,ball){
 if(ball.y>.72||ball.vy>1.2){const vy=ball.vy||0,t=clamp((vy+Math.sqrt(Math.max(0,vy*vy+19.62*(ball.y-.55))))/9.81,0,2.2),travel=(1-Math.exp(-.08*t))/.08;return{x:clamp(ball.x+(ball.vx||0)*travel,-33,33),z:clamp(ball.z+(ball.vz||0)*travel,-51.3,51.3)};}
 const target=ball.receivePoint;if(!target)return{x:ball.x+ball.vx*.18,z:ball.z+ball.vz*.18};
 const vx=ball.vx,vz=ball.vz,speed2=vx*vx+vz*vz,t=speed2>.1?clamp(((player.x-ball.x)*vx+(player.z-ball.z)*vz)/speed2,0,1.6):0;
 const along={x:ball.x+vx*t,z:ball.z+vz*t},passed=(target.x-ball.x)*vx+(target.z-ball.z)*vz<0;
 return passed?{x:ball.x,z:ball.z}:distance(player,along)<3.2?along:{x:target.x,z:target.z};
}

const boxDeliverySpeed=distance=>clamp(11.8+distance*.60,14,26);
export const boxDeliveryTime=distance=>-Math.log1p(-.39*distance/boxDeliverySpeed(distance))/.39;

// A blocked through-ball can travel over the defensive line. Open passing
// lanes retain a fast grounded ball; the landing still uses ordinary physics.
export function passFlight(ball,target,{type='pass',lane=8,delivery=target.delivery,player}={}){
 const dx=target.x-ball.x,dz=target.z-ball.z,d=Math.hypot(dx,dz),lofted=type==='through'&&d>12&&lane<1.7;
 const pace=abilityFactor(playerAbilities(player).passing,.004);
 if(delivery==='cutback'||delivery==='cross'){
  const speed=boxDeliverySpeed(d)*pace;
  return{vx:dx/(d||1)*speed,vz:dz/(d||1)*speed,vy:.06,lofted:false};
 }
 if(!lofted){const speed=clamp(d*.43+8,10,22)*pace;return{vx:dx/(d||1)*speed,vz:dz/(d||1)*speed,vy:.12,lofted:false};}
 const flight=clamp(d/(14.2*pace),.85,2),travel=(1-Math.exp(-.08*flight))/.08;return{vx:dx/travel,vz:dz/travel,vy:(.11-(ball.y||.11)+4.905*flight*flight)/flight,lofted:true,flight};
}
const wideAttack=new Set(['LW','RW','LM','RM']);
const wideBack=new Set(['LB','RB','LWB','RWB']);

function boxSupport(players,team,system,sign,depth,flank,excluded){
 const front={x:flank*4.6,z:sign*clamp(depth+4.5,44,47.5)};
 const late={x:-flank*5.8,z:sign*clamp(depth-5.8,38.6,42.5)};
 let near=null,nearCost=Infinity,arriving=null,lateCost=Infinity;
 const available=p=>p.team===team&&!p.dismissed&&!p.trainingInactive&&!p.passRun&&!excluded.includes(p.id);
 const forwards=players.filter(p=>available(p)&&(system.roles[p.index]==='ST'||system.roles[p.index]==='AM'||wideAttack.has(system.roles[p.index])));
 for(const player of forwards){
  const role=system.roles[player.index],side=Math.sign(system.positions[player.index][0]);
  const cost=distance(player,front)+(role==='ST'?-8:side===flank?-2:3);
  if(cost<nearCost){near={id:player.id,...front};nearCost=cost;}
 }
 for(const player of forwards){
  if(player.id===near?.id)continue;
  const role=system.roles[player.index],side=Math.sign(system.positions[player.index][0]);
  const cost=distance(player,late)+(wideAttack.has(role)&&side===-flank?-5:role==='ST'?-3:1);
  if(cost<lateCost){arriving={id:player.id,...late};lateCost=cost;}
 }
 return{near,arriving};
}

export function attackingShape(players,team,system,sign,ball,owner,controlledId){
 const reception=ball.targetId&&ball.receivePoint;
 const anchor=owner||{x:ball.x+clamp((reception?.x??ball.x)-ball.x,-6,6),z:ball.z+clamp((reception?.z??ball.z)-ball.z,-8,8)};
 const {x,z}=anchor,depth=z*sign,flank=Math.sign(x),wide=Math.abs(x)>8;
 const edgeDepth=clamp(depth-7.5,24,33.8),edgeX=clamp(x*.33,-10,10);
 let outlet=null,secondOutlet=null,best=Infinity,secondBest=Infinity,edgeSupport=null,edgeCost=Infinity,deepest=-Infinity,line=-Infinity;
 for(const player of players){
  if(player.team!==team){const q=player.z*sign;if(q>deepest){line=deepest;deepest=q;}else if(q>line)line=q;continue;}
  if(player.id===controlledId||player.id===owner?.id||player.id===ball.targetId||player.passRun)continue;
  const role=system.roles[player.index],central=role==='CM'||role==='DM';
  if(depth>=27&&(central||role==='AM')){
   const cost=Math.abs(player.x-edgeX)*.42+Math.abs(player.z*sign-edgeDepth)*.76+(role==='AM'?-5:role==='DM'?3:0);
   if(cost<edgeCost){edgeCost=cost;edgeSupport=player.id;}
  }
  if(central){
   const cost=Math.abs(system.positions[player.index][0]-x)+Math.abs(player.z-z)*.18+(role==='DM'?2.5:0);
   if(cost<best){secondBest=best;secondOutlet=outlet;best=cost;outlet=player.id;}
   else if(cost<secondBest){secondBest=cost;secondOutlet=player.id;}
  }
 }
 if(outlet===edgeSupport)outlet=secondOutlet;
 const box=Math.abs(x)>=15&&(depth>=41||depth>=39.5&&(owner?.vz||0)*sign>2)
  ?boxSupport(players,team,system,sign,depth,flank,[controlledId,owner?.id,ball.targetId,edgeSupport]):null;
 return{anchor:{x,z},depth,flank,wide,outlet,edgeSupport,edgeDepth,edgeX,box,runLine:Number.isFinite(line)?clamp(Math.max(depth+1,line-1),-48,48):48};
}

export function forwardSupportRun(players,team,system,shape,sign,owner,controlledId,ballTarget,time,previousRunner){
 const {anchor,depth,wide,flank,runLine}=shape;
 if(depth< -14||depth>44||owner?.keeper||shape.box?.near&&shape.box?.arriving)return null;
 let best=null;
 for(const player of players){
  if(player.team!==team||player.id===controlledId||player.id===owner?.id||player.id===ballTarget||player.id===shape.edgeSupport||player.id===shape.box?.near?.id||player.id===shape.box?.arriving?.id||player.passRun?.until>time)continue;
  const role=system.roles[player.index],baseX=system.positions[player.index][0];
  if(role!=='ST'&&role!=='AM'&&!wideAttack.has(role))continue;
  const q=player.z*sign;
  if(q<depth-12||q>depth+21)continue;
  const advance=Math.min(runLine,depth+18,q+9.5);
  if(advance-q<4.5)continue;
  const farFlank=wide&&Math.sign(baseX)!==flank&&depth<42;
  const x=role==='ST'?clamp(baseX*.9+(wide?flank*4:anchor.x*.25),-14,14):role==='AM'?clamp(anchor.x*.37+(anchor.x>=0?-7:7),-14,14):Math.sign(baseX)*(farFlank?25:clamp(Math.abs(baseX)-(depth>27?8:3),13,27));
  const space=runLaneClearance(players,team,player,{x,z:sign*advance});
  if(space<1.5)continue;
  const score=(role==='ST'?5:role==='AM'?3:2)+(wide&&Math.sign(baseX)===flank?2:0)-Math.abs(player.x-anchor.x)*.09-Math.abs(q-depth-5)*.12+space*.85-(player.id===previousRunner?3.6:0);
  if(!best||score>best.score)best={id:player.id,x,z:sign*advance,score};
 }
 return best;
}

function runLaneClearance(players,team,origin,target){
 const dx=target.x-origin.x,dz=target.z-origin.z,length=dx*dx+dz*dz;let space=5;
 for(const p of players){if(p.team===team||p.dismissed||p.trainingInactive||p.keeper)continue;
  const offsetX=p.x-origin.x,offsetZ=p.z-origin.z,t=clamp((offsetX*dx+offsetZ*dz)/(length||1),.35,1);
  space=Math.min(space,Math.hypot(offsetX-dx*t,offsetZ-dz*t));
 }
 return space;
}

export function passSupportRun(player,target,players,role,explicit,time){
 const sign=player.attackSign,depth=player.z*sign,receiverDepth=target.z*sign;
 if(role==='GK'||!explicit&&(passRunSeconds(role)<1.8||receiverDepth<depth-4))return null;
 let deepest=-Infinity,line=-Infinity;
 for(const p of players){if(p.team===player.team||p.dismissed||p.trainingInactive)continue;
  const q=p.z*sign;if(q>deepest){line=deepest;deepest=q;}else if(q>line)line=q;
 }
 const q=Math.min(47,depth+(explicit?12:7.5),Number.isFinite(line)?Math.max(depth,line-1):47);
 if(q-depth<3.8)return null;
 const width=explicit?6.5:4.5;
 let best=null,bestScore=-Infinity;
 for(const offset of [-width,width]){
  const x=clamp(player.x+offset,-30,30),z=q*sign,clearance=runLaneClearance(players,player.team,player,{x,z});
  const score=clearance+Math.min(10,Math.abs(x-target.x))*.28-Math.abs(offset-(x-player.x))*.42;
  if(clearance>=(explicit?1.15:2.6)&&score>bestScore){best={x,z,until:time+(explicit?2.5:1.6)};bestScore=score;}
 }
 return best;
}

function supportLaneScore(players,player,anchor,target){
 const dx=target.x-anchor.x,dz=target.z-anchor.z,length2=dx*dx+dz*dz||1;
 let lane=6.25,room=9;
 for(const other of players){
  if(other.id===player.id||other.dismissed||other.keeper||other.id===anchor.id)continue;
  const x=other.x-anchor.x,z=other.z-anchor.z;
  const gapX=x-dx,gapZ=z-dz;
  room=Math.min(room,gapX*gapX+gapZ*gapZ);
  if(other.team===player.team)continue;
  const t=(x*dx+z*dz)/length2;
  if(t<.17||t>.90)continue;
  const px=x-dx*t,pz=z-dz*t;
  lane=Math.min(lane,px*px+pz*pz);
 }
 const travel=Number.isFinite(player.x)&&Number.isFinite(player.z)?Math.min(12,distance(player,target))*.08:0;
 return{lane,score:lane+room*.18-travel};
}

function supportPassingLane(player,players,anchor,point,maxDepth,sign){
 const dx=point.x-anchor.x,dz=point.z-anchor.z,length=Math.hypot(dx,dz);
 if(length<4||length>27)return point;
 const direct=supportLaneScore(players,player,anchor,point);
 if(direct.lane>=1.5**2)return point;
 const stepX=-dz/length*3.8,stepZ=clamp(dx/length*3.8,-2,2);
 let best=point,bestScore=direct.score+.32;
 for(const side of [-1,1]){
  const x=clamp(point.x+stepX*side,-30,30),depth=clamp((point.z+stepZ*side)*sign,-48,maxDepth);
  const candidate={x,z:sign*depth},quality=supportLaneScore(players,player,anchor,candidate);
  if(quality.score>bestScore){best=candidate;bestScore=quality.score;}
 }
 return best;
}

export function supportPosition(player,ball,players,{base,role='CM',sign=-1,attacking=false,shape=null}={}){
 const anchor=shape?.anchor??ball,depth=anchor.z*sign,flank=Math.sign(anchor.x),wide=Math.abs(anchor.x)>8,baseX=base[0],side=Math.sign(baseX),nearSide=wide&&flank===side;
 let x=baseX+anchor.x*.20,q=-base[1]+depth*.20,speed=5.1;
 const edge=attacking&&shape&&shape.edgeSupport===player.id;
 const box=attacking&&shape?.box;
 const arriving=box?.arriving&&box.arriving.id===player.id;
 const boxPosition=arriving?box.arriving:box?.near&&box.near.id===player.id?box.near:null;
 if(attacking){
  const push=-base[1]*.67+depth*.63;
  if(boxPosition){
   x=boxPosition.x;q=boxPosition.z*sign;speed=6.15;
  }else if(edge){
   x=shape.edgeX;q=shape.edgeDepth;speed=5.65;
  }else if(role==='CB'){
   x=baseX*.86+anchor.x*.23;q=Math.min(depth-13,push-1);speed=4.75;
  }else if(wideBack.has(role)){
   const wingback=role.endsWith('WB');
   x=side*(nearSide?28:wingback?25:Math.abs(baseX)*.72);q=nearSide?Math.max(push,depth-(wingback?8:12)):Math.min(depth-12,push+(wingback?4:0));speed=5.35;
  }else if(role==='DM'||role==='CM'){
   const outlet=shape?.outlet===player.id;
   x=outlet?anchor.x+(anchor.x>7?-8:anchor.x< -7?8:side*8||7):baseX*.85+anchor.x*.18;
   q=depth-(outlet?6:role==='DM'?14:10);if(shape?.edgeSupport&&outlet)q=Math.min(q,shape.edgeDepth-6);speed=outlet?5.7:4.9;
  }else if(role==='ST'){
   x=baseX*.85+(depth>27&&wide?flank*5:anchor.x*.26);
   q=Math.max(push,depth+(baseX>0?13:9.5));speed=5.45;
  }else if(role==='AM'){
   x=anchor.x*.38+(wide?-flank*4.5:baseX*.7);
   q=depth+(depth>36?-3:6);speed=5.55;
  }else if(wideAttack.has(role)){
   const crossing=!shape?.box&&!nearSide&&Math.abs(anchor.x)>16&&depth>=42;
   x=side*(crossing?Math.max(10,22-(depth-30)*.65):nearSide?Math.max(19,Math.abs(anchor.x)-5):27);
   q=crossing?depth+8:Math.max(push,depth+(nearSide?6:4));speed=5.6;
  }
  if(shape&&q>depth&&depth> -10)q=Math.min(q,shape.runLine+(role==='ST'?.2:0));
 }
 const z=sign*q;
 let avoidX=0,avoidZ=0;
 if(attacking)for(const other of players){if(other.id===player.id||other.dismissed||other.keeper)continue;const dx=x-other.x,dz=z-other.z,d=Math.hypot(dx,dz),radius=other.team===player.team?4.2:3.0;if(d>=radius)continue;const push=(radius-d)*(other.team===player.team?.65:.42);avoidX+=(d>.01?dx/d:player.index%2?1:-1)*push;avoidZ+=(d>.01?dz/d:0)*push*.55;}
 const edgeCeiling=edge?Math.min(34.3,depth-3):48;
 const point={x:clamp(x+clamp(avoidX,-3,3),-30,30),z:sign*clamp((z+clamp(avoidZ,-2,2))*sign,-48,edgeCeiling)};
 if(attacking&&shape&&(arriving||edge||shape.outlet===player.id||!boxPosition&&role==='AM')){
  const maxDepth=arriving?Math.min(43.5,depth-1):edge?edgeCeiling:shape.outlet===player.id?Math.min(48,depth-3,shape.edgeSupport?shape.edgeDepth-4:48):Math.min(48,shape.runLine??48);
  return{...supportPassingLane(player,players,anchor,point,maxDepth,sign),speed};
 }
 return{...point,speed};
}
