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
export function shotOption(player,ball,{direction=null,power=.5,error=0,kind='drive',keeper=null}={}){
 kind=shotKinds.includes(kind)?kind:'drive';power=clamp(power,.15,1);
 const sign=player.attackSign??(player.team==='home'?-1:1),goalZ=sign*52.5,dz=goalZ-ball.z,strength=direction?Math.hypot(direction.x,direction.z):0,explicit=strength>.18;
 const openSide=keeper?keeper.x>ball.x*.12?-1:1:player.x>0?-1:1,corner=explicit?clamp(direction.x/strength,-1,1)*3.12:openSide*2.65,x=clamp(corner+error,-4.6,4.6),dx=x-ball.x,distance=Math.hypot(dx,dz),nominal=kind==='finesse'?17+power*10:20+power*14;
 const flight=kind==='lob'?Math.max(.72,distance/(12+power*5)):-Math.log(Math.max(.25,1-.08*distance/nominal))/.08,speed=distance*.08/(1-Math.exp(-.08*flight)),y=kind==='lob'?1.75+power*.25:kind==='finesse'?1.05+power*.55:.42+power*.62,curve=kind==='finesse'?Math.sign(corner)*(4.2+power*1.8):0;
 const travel=(1-Math.exp(-.08*flight))/.08,curveTravel=(flight-travel)/.08,vx=(dx-curve*curveTravel)/travel,vz=dz/travel,vy=(y-(ball.y||.11)+4.905*flight*flight)/flight;
 return{x,y,z:goalZ,speed,vx,vz,vy,curve,flight,distance,kind};
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
export function supportPosition(player,ball,players,{base,role='CM',sign=-1,attacking=false,time=0}={}){
 let x=base[0]+ball.x*.20+(attacking?Math.sin(time*.45+player.index)*1.8:0),z=-sign*base[1]+ball.z*(attacking?.34:.20)+(attacking?sign*6:0);
 if(attacking&&['ST','AM','RW','LW','RM','LM'].includes(role))z=sign*Math.max(sign*z,sign*ball.z+(role==='ST'?10:role==='AM'?4:6));
 if(attacking&&['DM','CM'].includes(role))z=z*.35+(ball.z-sign*(role==='DM'?11:7))*.65;
 let avoidX=0,avoidZ=0;
 if(attacking)for(const other of players){if(other.id===player.id||other.dismissed||other.keeper)continue;const dx=x-other.x,dz=z-other.z,d=Math.hypot(dx,dz),radius=other.team===player.team?4.2:3.0;if(d>=radius)continue;const push=(radius-d)*(other.team===player.team?.65:.42);avoidX+=(d>.01?dx/d:player.index%2?1:-1)*push;avoidZ+=(d>.01?dz/d:0)*push*.55;}
 return{x:clamp(x+clamp(avoidX,-3,3),-30,30),z:clamp(z+clamp(avoidZ,-2,2),-48,48)};
}
