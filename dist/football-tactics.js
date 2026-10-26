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
export function shotOption(player,ball,{direction=null,power=.5,error=0}={}){
 const sign=player.team==='home'?-1:1,goalZ=sign*52.5,dz=goalZ-ball.z,strength=direction?Math.hypot(direction.x,direction.z):0;
 // Aim assistance keeps the target in the goal mouth; sideways stick input
 // selects a corner rather than forcing an implausible 90-degree shot.
 const corner=strength>.18?clamp(direction.x,-1,1)*2.8:clamp(Math.sin(player.yaw)*1.6-player.x*.025,-2.1,2.1),x=clamp(corner+error,-4.6,4.6),distance=Math.hypot(x-ball.x,dz),speed=18+power*13;
 return{x,z:goalZ,speed,vy:1.0+Math.max(0,distance-17)*.068+power*.8,distance};
}
export function receivingPoint(player,ball){
 const target=ball.receivePoint;if(!target)return{x:ball.x+ball.vx*.18,z:ball.z+ball.vz*.18};
 const vx=ball.vx,vz=ball.vz,speed2=vx*vx+vz*vz,t=speed2>.1?clamp(((player.x-ball.x)*vx+(player.z-ball.z)*vz)/speed2,0,1.6):0;
 const along={x:ball.x+vx*t,z:ball.z+vz*t},passed=(target.x-ball.x)*vx+(target.z-ball.z)*vz<0;
 return passed?{x:ball.x,z:ball.z}:distance(player,along)<3.2?along:{x:target.x,z:target.z};
}
