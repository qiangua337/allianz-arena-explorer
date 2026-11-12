const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

function spaceAt(point,opponents,lookAhead=0){
 let room=8;
 for(const defender of opponents){
  const x=defender.x+clamp((defender.vx||0)*lookAhead,-1.2,1.2),z=defender.z+clamp((defender.vz||0)*lookAhead,-1.2,1.2);
  room=Math.min(room,Math.hypot(x-point.x,z-point.z));
 }
 return room;
}

function laneSpace(origin,target,opponents,travelTime=0){
 const dx=target.x-origin.x,dz=target.z-origin.z,length2=dx*dx+dz*dz;
 if(length2<.04)return 0;
 let room=6;
 for(const defender of opponents){
  if(defender.keeper)continue;
  let x=defender.x-origin.x,z=defender.z-origin.z,t=(x*dx+z*dz)/length2;
  const at=clamp(t,0,1)*travelTime;
  x+=clamp((defender.vx||0)*at,-1.2,1.2);z+=clamp((defender.vz||0)*at,-1.2,1.2);
  t=(x*dx+z*dz)/length2;
  if(t<.04||t>1.06)continue;
  room=Math.min(room,Math.hypot(x-dx*Math.min(1,t),z-dz*Math.min(1,t)));
 }
 return room;
}

function dribbleLane(player,opponents,sign){
 const depth=player.z*sign,advance=clamp(depth+9,-50,49),inside=player.x*(depth>40?.58:.86);
 const direct={x:inside,z:sign*advance},left={x:clamp(player.x-6,-30,30),z:sign*advance},right={x:clamp(player.x+6,-30,30),z:sign*advance};
 const straight=laneSpace(player,direct,opponents,.65);let point=direct,best=straight;
 for(const option of [left,right]){
  const room=laneSpace(player,option,opponents,.65);
  if(room>best+1.35&&straight<3.5){point=option;best=room;}
 }
 const pressure=spaceAt(player,opponents),noProgress=advance-depth<1.1&&Math.abs(player.x-inside)<2.8;
 const goalSidePressure=opponents.some(p=>(p.z-player.z)*sign>.22&&distance(player,p)<2.65);
 const blocked=best<1.75||straight<1.4&&best<2.6||goalSidePressure&&best<3.3||noProgress;
 if(best<1.45||noProgress){
  const z=clamp(depth-1.8,-49,49)*sign;
  const exits=[{x:clamp(player.x-4,-30,30),z},{x:clamp(player.x+4,-30,30),z}];
  point=spaceAt(exits[0],opponents,.4)>spaceAt(exits[1],opponents,.4)?exits[0]:exits[1];
 }
 return{...point,speed:blocked?4.55:5.55,shield:blocked&&pressure<1.75,blocked,pressure};
}

function shootingLane(player,ball,opponents,sign,pressure,shotRange){
 const goalZ=52.5*sign,range=Math.hypot(ball.x,ball.z-goalZ);
 if(range>shotRange||Math.abs(player.x)>17||pressure<1.4||range<2.5)return null;
 const keeper=opponents.find(defender=>defender.keeper);let best=null,bestScore=-Infinity;
 for(const side of [-1,1]){
  const target={x:side*2.72,z:goalZ},room=laneSpace(ball,target,opponents,.26),keeperGap=Math.min(4,Math.abs((keeper?.x??0)-target.x));
  const score=room+keeperGap*.20;
  const required=range<13?.80:range<17?1.22:2.35;
  if(room>required&&score>bestScore){best={type:'shoot',direction:{x:side*.87,z:sign*.49}};bestScore=score;}
 }
 return best;
}

function passOutlet(player,ball,teammates,opponents,sign,carry,avoidId,possessionStyle){
 let best=null,bestScore=-Infinity;
 for(const mate of teammates){
  if(mate.id===player.id||mate.team!==player.team||mate.dismissed||mate.trainingInactive)continue;
  const target={x:clamp(mate.x+(mate.vx||0)*.18,-32.5,32.5),z:clamp(mate.z+(mate.vz||0)*.18,-50.4,50.4)},length=distance(ball,target),progress=(target.z-ball.z)*sign;
  if(length<2.8||length>44)continue;
  const switchSide=Math.abs(target.x-ball.x)>21&&Math.abs(target.x)>13&&Math.abs(ball.x)>6&&target.x*ball.x<0&&progress>-11;
  const type=switchSide?'switch':progress< -3.4?'recycle':progress>5?'forward':'support';
  if(!carry.blocked&&type!=='forward')continue;
  const travel=length/Math.min(22,9+length*.40),room=spaceAt(target,opponents,travel),lane=laneSpace(ball,target,opponents,travel);
  if(room<(switchSide?2.9:2.05)||lane<(switchSide?1.45:1.15))continue;
  const preference=carry.blocked?(switchSide?5.6:type==='recycle'?4.2:type==='support'?1.75:0):0;
  const score=Math.min(4,lane)*1.16+Math.min(7,room)*.48+clamp(progress,-11,16)*.43+preference-Math.max(0,length-22)*.14-(mate.keeper?5.5:0)-(mate.id===avoidId?4.5:0);
  if(score>bestScore){best={type:'pass',tactic:type,option:{player:mate,...target,lane,distance:length}};bestScore=score;}
 }
 const threshold=carry.blocked?3.7:possessionStyle?10.6:11.8;
 return bestScore>=threshold?best:null;
}

export function planCpuAttack(player,ball,field,{sign=player.attackSign??(player.team==='home'?-1:1),decide=true,avoidId=null,possessionStyle=false,shotRange=22.5}={}){
 const opponents=field.filter(p=>p.team!==player.team&&!p.dismissed&&!p.trainingInactive),carry=dribbleLane(player,opponents,sign);
 if(!decide)return{carry,action:null};
 const shot=shootingLane(player,ball,opponents,sign,carry.pressure,shotRange);
 return{carry,action:shot||passOutlet(player,ball,field,opponents,sign,carry,avoidId,possessionStyle)};
}
