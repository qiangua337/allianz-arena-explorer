const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function possessionTeam(ball,players){const owner=players.find(p=>p.id===ball.ownerId&&!p.dismissed);if(owner)return owner.team;const receiver=players.find(p=>p.id===ball.targetId&&!p.dismissed);return receiver?.team||ball.shot?.team||null;}
export function passRunSeconds(role){return role==='CB'||role==='GK'?0:role==='DM'?1:role==='CM'?1.8:3.0;}
export function passOption(players,player,ball,{direction=null,type='pass',power=.45}={}){
 const strength=direction?Math.hypot(direction.x,direction.z):0,aim=strength>.18?{x:direction.x/strength,z:direction.z/strength}:{x:Math.sin(player.yaw),z:Math.cos(player.yaw)},sign=player.attackSign??(player.team==='home'?-1:1);
 let best=null;
 for(const mate of players){if(mate.dismissed||mate.team!==player.team||mate.id===player.id)continue;
  const dx=mate.x-ball.x,dz=mate.z-ball.z,d=Math.hypot(dx,dz);if(d<2.5||d>48)continue;const alignment=(dx*aim.x+dz*aim.z)/d;if(strength>.18&&alignment<.1)continue;
  let lane=8,space=12;for(const foe of players){if(foe.dismissed||foe.team===player.team)continue;space=Math.min(space,distance(foe,mate));const t=clamp(((foe.x-ball.x)*dx+(foe.z-ball.z)*dz)/(d*d),.06,.94),gap=Math.hypot(foe.x-ball.x-dx*t,foe.z-ball.z-dz*t);lane=Math.min(lane,gap);}
  const score=alignment*(strength>.18?23:11)+Math.min(space,9)*.65+Math.min(lane,5)*1.6-clamp(2-lane,0,2)*6-Math.abs(d-(type==='through'?22:13+power*9))*.23+clamp(dz*sign,-16,24)*.10-(mate.keeper?6:0);
  const lead=type==='through'?4+power*6:0,tx=clamp(mate.x+mate.vx*.22+aim.x*lead,-32.5,32.5),tz=clamp(mate.z+mate.vz*.22+(type==='through'?aim.z*lead:0),-50.4,50.4);
  if(!best||score>best.score)best={player:mate,x:tx,z:tz,score,lane,distance:d};
 }return best;
}
export const shotKinds=['drive','finesse','lob'];
export const shotLabels={drive:'劲射',finesse:'搓射',lob:'挑射'};
// Assistance chooses a useful goal target; preparation describes how reliably
// the player can actually strike it. No random state is consumed by a preview.
export function shotPreparation(player,ball,{power=.5,pressure=Infinity}={}){
 power=clamp(power,.15,1);const sign=player.attackSign??(player.team==='home'?-1:1),dx=-ball.x,dz=sign*52.5-ball.z,distance=Math.hypot(dx,dz),yaw=Number.isFinite(player.yaw)?player.yaw:Math.atan2(dx,dz),alignment=distance>.01?(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/distance:1;
 const back=clamp((Math.acos(clamp(alignment,-1,1))-.85)/1.8,0,1),speed=clamp((Math.hypot(player.vx||0,player.vz||0)-3)/5,0,1),range=clamp((distance-24)/42,0,1.6),over=clamp((power-.8)/.2,0,1),crowded=clamp((3-pressure)/3,0,1),quality=clamp(1-back*.40-speed*.25-range*.19-over*.10-crowded*.12,.08,1);
 const preparation=back>.25?'backfoot':speed>.4?'rushed':crowded>.5?'pressured':over>.6?'overpowered':range>.25?'long-range':'balanced';
 return{quality,preparation,spread:.12+distance*(range*.011+back*.040+speed*.014+over*.008+crowded*.008),heightSpread:.02+range*.35+back*.40+speed*.20+over*.60+crowded*.18,heightBias:over*(.4+back*.6+range*.25)};
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

// A blocked through-ball can travel over the defensive line. Open passing
// lanes retain a fast grounded ball; the landing still uses ordinary physics.
export function passFlight(ball,target,{type='pass',lane=8}={}){
 const dx=target.x-ball.x,dz=target.z-ball.z,d=Math.hypot(dx,dz),lofted=type==='through'&&d>12&&lane<1.7;
 if(!lofted){const speed=clamp(d*.43+8,10,22);return{vx:dx/(d||1)*speed,vz:dz/(d||1)*speed,vy:.12,lofted:false};}
 const flight=clamp(d/14.2,.85,2),travel=(1-Math.exp(-.08*flight))/.08;return{vx:dx/travel,vz:dz/travel,vy:(.11-(ball.y||.11)+4.905*flight*flight)/flight,lofted:true,flight};
}
const wideAttack=new Set(['LW','RW','LM','RM']);
const wideBack=new Set(['LB','RB','LWB','RWB']);

export function attackingShape(players,team,system,sign,ball,owner,controlledId){
 const reception=ball.targetId&&ball.receivePoint;
 const anchor=owner||{x:ball.x+clamp((reception?.x??ball.x)-ball.x,-6,6),z:ball.z+clamp((reception?.z??ball.z)-ball.z,-8,8)};
 const {x,z}=anchor,depth=z*sign,flank=Math.sign(x),wide=Math.abs(x)>8;
 let outlet=null,best=Infinity,deepest=-Infinity,line=-Infinity;
 for(const player of players){
  if(player.team!==team){const q=player.z*sign;if(q>deepest){line=deepest;deepest=q;}else if(q>line)line=q;continue;}
  const role=system.roles[player.index];
  if(player.id===controlledId||player.id===owner?.id||player.id===ball.targetId||role!=='CM'&&role!=='DM')continue;
  const cost=Math.abs(system.positions[player.index][0]-x)+Math.abs(player.z-z)*.18+(role==='DM'?2.5:0);
  if(cost<best){best=cost;outlet=player.id;}
 }
 return{anchor:{x,z},depth,flank,wide,outlet,runLine:Number.isFinite(line)?clamp(Math.max(depth+1,line-1),-48,48):48};
}

export function forwardSupportRun(players,team,system,shape,sign,owner,controlledId,ballTarget,time){
 const {anchor,depth,wide,flank,runLine}=shape;
 if(depth< -14||depth>44||owner?.keeper)return null;
 let best=null;
 for(const player of players){
  const role=system.roles[player.index],baseX=system.positions[player.index][0];
  if(player.team!==team||player.id===controlledId||player.id===owner?.id||player.id===ballTarget||player.runUntil>time||!(role==='ST'||role==='AM'||wideAttack.has(role)))continue;
  const q=player.z*sign;
  if(q<depth-12||q>depth+21)continue;
  const advance=Math.min(runLine,depth+18,q+9.5);
  if(advance-q<4.5)continue;
  const x=role==='ST'?clamp(baseX*.9+(wide?flank*4:anchor.x*.25),-14,14):role==='AM'?clamp(anchor.x*.37+(anchor.x>=0?-7:7),-14,14):Math.sign(baseX)*clamp(Math.abs(baseX)-(depth>27?8:3),13,27);
  const score=(role==='ST'?5:role==='AM'?3:2)+(wide&&Math.sign(baseX)===flank?2:0)-Math.abs(player.x-anchor.x)*.09-Math.abs(q-depth-5)*.12;
  if(!best||score>best.score)best={id:player.id,x,z:sign*advance,score};
 }
 return best;
}

export function supportPosition(player,ball,players,{base,role='CM',sign=-1,attacking=false,shape=null}={}){
 const anchor=shape?.anchor??ball,depth=anchor.z*sign,flank=Math.sign(anchor.x),wide=Math.abs(anchor.x)>8,baseX=base[0],side=Math.sign(baseX),nearSide=wide&&flank===side;
 let x=baseX+anchor.x*.20,q=-base[1]+depth*.20,speed=5.1;
 if(attacking){
  const push=-base[1]*.67+depth*.63;
  if(role==='CB'){
   x=baseX*.86+anchor.x*.23;q=Math.min(depth-13,push-1);speed=4.75;
  }else if(wideBack.has(role)){
   const wingback=role.endsWith('WB');
   x=side*(nearSide?28:Math.abs(baseX)*.72);q=nearSide?Math.max(push,depth-(wingback?8:12)):Math.min(depth-12,push+(wingback?4:0));speed=5.35;
  }else if(role==='DM'||role==='CM'){
   const outlet=shape?.outlet===player.id;
   x=outlet?anchor.x+(anchor.x>7?-8:anchor.x< -7?8:side*8||7):baseX*.85+anchor.x*.18;
   q=depth-(outlet?6:role==='DM'?14:10);speed=outlet?5.7:4.9;
  }else if(role==='ST'){
   x=baseX*.85+(depth>27&&wide?flank*5:anchor.x*.26);
   q=Math.max(push,depth+(baseX>0?13:9.5));speed=5.45;
  }else if(role==='AM'){
   x=anchor.x*.38+(wide?-flank*4.5:baseX*.7);
   q=depth+(depth>36?-3:6);speed=5.55;
  }else if(wideAttack.has(role)){
   const arriving=wide&&!nearSide&&depth>30;
   x=side*(arriving?Math.max(10,22-(depth-30)*.65):nearSide?Math.max(19,Math.abs(anchor.x)-5):27);
   q=arriving?depth+8:Math.max(push,depth+(nearSide?6:4));speed=5.6;
  }
  if(shape&&q>depth&&depth> -10)q=Math.min(q,shape.runLine+(role==='ST'?.2:0));
 }
 const z=sign*q;
 let avoidX=0,avoidZ=0;
 if(attacking)for(const other of players){if(other.id===player.id||other.dismissed||other.keeper)continue;const dx=x-other.x,dz=z-other.z,d=Math.hypot(dx,dz),radius=other.team===player.team?4.2:3.0;if(d>=radius)continue;const push=(radius-d)*(other.team===player.team?.65:.42);avoidX+=(d>.01?dx/d:player.index%2?1:-1)*push;avoidZ+=(d>.01?dz/d:0)*push*.55;}
 return{x:clamp(x+clamp(avoidX,-3,3),-30,30),z:clamp(z+clamp(avoidZ,-2,2),-48,48),speed};
}
