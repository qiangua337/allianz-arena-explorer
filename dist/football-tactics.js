const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function passOption(players,player,ball,{direction=null,type='pass',power=.45}={}){
 const strength=direction?Math.hypot(direction.x,direction.z):0,aim=strength>.18?{x:direction.x/strength,z:direction.z/strength}:{x:Math.sin(player.yaw),z:Math.cos(player.yaw)},sign=player.team==='home'?-1:1;
 let best=null;
 for(const mate of players){if(mate.team!==player.team||mate.id===player.id)continue;
  const dx=mate.x-ball.x,dz=mate.z-ball.z,d=Math.hypot(dx,dz);if(d<2.5||d>48)continue;const alignment=(dx*aim.x+dz*aim.z)/d;if(strength>.18&&alignment<.1)continue;
  let lane=8,space=12;for(const foe of players){if(foe.team===player.team)continue;space=Math.min(space,distance(foe,mate));const t=clamp(((foe.x-ball.x)*dx+(foe.z-ball.z)*dz)/(d*d),.06,.94),gap=Math.hypot(foe.x-ball.x-dx*t,foe.z-ball.z-dz*t);lane=Math.min(lane,gap);}
  const score=alignment*(strength>.18?23:11)+Math.min(space,9)*.65+Math.min(lane,5)*1.6-clamp(2-lane,0,2)*6-Math.abs(d-(type==='through'?22:13+power*9))*.23+clamp(dz*sign,-16,24)*.10-(mate.keeper?6:0);
  const lead=type==='through'?4+power*6:0,tx=clamp(mate.x+mate.vx*.22+aim.x*lead,-32.5,32.5),tz=clamp(mate.z+mate.vz*.22+(type==='through'?aim.z*lead:0),-50.4,50.4);
  if(!best||score>best.score)best={player:mate,x:tx,z:tz,score,lane,distance:d};
 }return best;
}
export const shotKinds=['drive','finesse','lob'];
export const shotLabels={drive:'劲射',finesse:'搓射',lob:'挑射'};
export function shotOption(player,ball,{direction=null,power=.5,error=0,kind='drive',keeper=null}={}){
 kind=shotKinds.includes(kind)?kind:'drive';power=clamp(power,.15,1);
 const sign=player.team==='home'?-1:1,goalZ=sign*52.5,dz=goalZ-ball.z,strength=direction?Math.hypot(direction.x,direction.z):0,explicit=strength>.18;
 const openSide=keeper?keeper.x>ball.x*.12?-1:1:player.x>0?-1:1,corner=explicit?clamp(direction.x/strength,-1,1)*3.12:openSide*2.65,x=clamp(corner+error,-4.6,4.6),dx=x-ball.x,distance=Math.hypot(dx,dz),nominal=kind==='finesse'?17+power*10:20+power*14;
 const flight=kind==='lob'?Math.max(.72,distance/(12+power*5)):-Math.log(Math.max(.25,1-.08*distance/nominal))/.08,speed=distance*.08/(1-Math.exp(-.08*flight)),y=kind==='lob'?1.75+power*.25:kind==='finesse'?1.05+power*.55:.42+power*.62,curve=kind==='finesse'?Math.sign(corner)*(4.2+power*1.8):0;
 const travel=(1-Math.exp(-.08*flight))/.08,curveTravel=(flight-travel)/.08,vx=(dx-curve*curveTravel)/travel,vz=dz/travel,vy=(y-(ball.y||.11)+4.905*flight*flight)/flight;
 return{x,y,z:goalZ,speed,vx,vz,vy,curve,flight,distance,kind};
}
export function receivingPoint(player,ball){
 const target=ball.receivePoint;if(!target)return{x:ball.x+ball.vx*.18,z:ball.z+ball.vz*.18};
 const vx=ball.vx,vz=ball.vz,speed2=vx*vx+vz*vz,t=speed2>.1?clamp(((player.x-ball.x)*vx+(player.z-ball.z)*vz)/speed2,0,1.6):0;
 const along={x:ball.x+vx*t,z:ball.z+vz*t},passed=(target.x-ball.x)*vx+(target.z-ball.z)*vz<0;
 return passed?{x:ball.x,z:ball.z}:distance(player,along)<3.2?along:{x:target.x,z:target.z};
}
