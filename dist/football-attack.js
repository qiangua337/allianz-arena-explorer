import {boxPassTarget,passFlight} from './football-tactics.js';

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

function laneSpace(origin,target,opponents,travelTime=0,includeKeeper=false){
 const dx=target.x-origin.x,dz=target.z-origin.z,length2=dx*dx+dz*dz;
 if(length2<.04)return 0;
 let room=6;
 for(const defender of opponents){
  if(defender.keeper&&!includeKeeper)continue;
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
 const opening=point=>Math.min(laneSpace(player,point,opponents,.65),spaceAt(point,opponents,.65));
 const straight=opening(direct);let point=direct,best=straight;
 for(const option of [left,right]){
  const room=opening(option);
  if(room>best+1.35&&straight<3.5){point=option;best=room;}
 }
 const pressure=spaceAt(player,opponents),noProgress=advance-depth<1.1&&Math.abs(player.x-inside)<2.8;
 const goalSidePressure=opponents.some(p=>!p.keeper&&(p.z-player.z)*sign>.22&&distance(player,p)<2.65);
 const trap=pressure<2.35&&opponents.filter(p=>!p.keeper&&distance(player,p)<3.3).length>=2;
 const blocked=best<1.75||straight<1.4&&best<2.6||goalSidePressure&&best<3.3||trap||noProgress;
 if(best<1.45||noProgress){
  const z=clamp(depth-1.8,-49,49)*sign;
  const exits=[{x:clamp(player.x-4,-30,30),z},{x:clamp(player.x+4,-30,30),z}];
  const escape=point=>spaceAt(point,opponents,.4)+laneSpace(player,point,opponents,.4)*.6;
  point=escape(exits[0])>escape(exits[1])?exits[0]:exits[1];
 }
 return{...point,speed:blocked?4.55:5.55,shield:blocked&&pressure<1.75,blocked,pressure};
}

function shootingLane(player,ball,opponents,sign,pressure,shotRange){
 const goalZ=52.5*sign,range=Math.hypot(ball.x,ball.z-goalZ);
 if(range>shotRange||Math.abs(player.x)>17||pressure<1.4||range<2.5)return null;
 const keeper=opponents.find(defender=>defender.keeper);let best=null,bestScore=-Infinity;
 for(const side of [-1,1]){
  const target={x:side*2.72,z:goalZ},room=laneSpace(ball,target,opponents,.26),keeperGap=Math.min(4,Math.abs((keeper?.x??0)-target.x));
  const score=Math.min(4.5,room)+keeperGap*.20;
  const required=range<13?.80:range<17?1.22:2.35;
  if(room>required&&score>bestScore){
   best={type:'shoot',direction:{x:side*.87,z:sign*.49},quality:score+
    clamp((19-range)*.42,-1.5,4.5)+Math.min(pressure,4)*.24-Math.abs(player.x)*.12};
   bestScore=score;
  }
 }
 return best;
}

function runTarget(mate,ball,sign,transition){
 const forward=(mate.vz||0)*sign,progress=(mate.z-ball.z)*sign;
 if(mate.keeper||forward<(transition?2.15:2.85)||progress<(transition?-1.4:2.5))return null;
 const lead=clamp(distance(ball,mate)/24,.36,.95);
 const point={x:clamp(mate.x+clamp((mate.vx||0)*lead,-5,5),-31.5,31.5),
  z:sign*clamp(mate.z*sign+forward*lead,-48,47.2)};
 return (point.z-mate.z)*sign>1.1?point:null;
}

function deliveryTime(ball,target,player,stroke){
 const flight=passFlight(ball,target,{type:stroke,lane:6,player});
 if(flight.lofted)return flight.flight;
 const speed=Math.hypot(flight.vx,flight.vz),fraction=.39*distance(ball,target)/Math.max(speed,.01);
 return fraction>=.94?Infinity:-Math.log1p(-fraction)/.39;
}

function passOutlet(player,ball,teammates,opponents,sign,carry,avoidId,possessionStyle,transition){
 let best=null,bestScore=-Infinity;
 const attackDepth=ball.z*sign;
 for(const mate of teammates){
  if(mate.id===player.id||mate.team!==player.team||mate.dismissed||mate.trainingInactive)continue;
  const delivery=boxPassTarget(ball,mate,sign);
  const direct=delivery??{x:clamp(mate.x+(mate.vx||0)*.18,-32.5,32.5),z:clamp(mate.z+(mate.vz||0)*.18,-50.4,50.4)};
  const run=delivery?null:runTarget(mate,ball,sign,transition);
  for(const target of run?[direct,run]:[direct]){
   const leading=target===run,stroke=leading?'through':'pass',length=distance(ball,target),progress=(target.z-ball.z)*sign;
   if(length<2.8||length>44||leading&&progress<3.4)continue;
   const switchSide=Math.abs(target.x-ball.x)>21&&Math.abs(target.x)>13&&Math.abs(ball.x)>6&&target.x*ball.x<0&&progress>-11;
   const combination=!target.delivery&&!leading&&attackDepth>31&&length<19&&Math.abs(target.x)<13&&progress>-4.5;
   const type=target.delivery||(leading&&transition?'counter':switchSide?'switch':progress< -3.4?'recycle':combination?'combine':progress>5?'forward':'support');
   if(!carry.blocked&&!leading&&type!=='forward'&&!target.delivery&&!combination&&!(possessionStyle&&type==='support'&&length<14))continue;
   const flightTarget=leading?{...target,directed:true}:target;
   const travel=deliveryTime(ball,flightTarget,player,stroke);
   if(!Number.isFinite(travel))continue;
   const room=spaceAt(target,opponents,travel),lane=laneSpace(ball,target,opponents,travel,!!target.delivery);
   const neededLane=switchSide?1.45:target.delivery?1.35:leading?1.75:1.15;
   if(room<(switchSide?2.9:target.delivery||leading?2.5:2.05)||lane<neededLane)continue;
   const preference=target.delivery?(target.delivery==='cutback'?7:4.35):
    leading?(transition?4.4:.8):combination?3:
    carry.blocked?(switchSide?5.6:type==='recycle'?4.2:type==='support'?1.75:0):
    possessionStyle&&type==='support'?2.8:0;
   const score=Math.min(4,lane)*1.16+Math.min(7,room)*.48+clamp(progress,-11,16)*.43+preference-
    Math.max(0,length-22)*.14-(mate.keeper?5.5:0)-(mate.id===avoidId?4.5:0);
   if(score>bestScore){
    best={type:'pass',tactic:type,...(leading?{stroke}:null),option:{player:mate,...flightTarget,lane,distance:length}};
    bestScore=score;
   }
  }
 }
 const threshold=carry.blocked?3.7:best?.option.delivery?7.8:best?.tactic==='counter'?8.6:possessionStyle?9.7:11.8;
 if(!best||bestScore<threshold)return null;
 return {...best,quality:bestScore};
}

export function planCpuAttack(player,ball,field,{sign=player.attackSign??(player.team==='home'?-1:1),decide=true,avoidId=null,possessionStyle=false,shotRange=22.5,transition=false}={}){
 const opponents=field.filter(p=>p.team!==player.team&&!p.dismissed&&!p.trainingInactive),carry=dribbleLane(player,opponents,sign);
 if(!decide)return{carry,action:null};
 const shot=shootingLane(player,ball,opponents,sign,carry.pressure,shotRange);
 const pass=passOutlet(player,ball,field,opponents,sign,carry,avoidId,possessionStyle,transition);
 if(!shot)return{carry,action:pass};
 if(pass&&(pass.tactic==='combine'||pass.option.delivery)&&
    pass.quality>shot.quality+(pass.option.delivery==='cutback'?3.3:4.8)){
  const receiverRange=Math.hypot(pass.option.x,pass.option.z-52.5*sign);
  const carrierRange=Math.hypot(ball.x,ball.z-52.5*sign);
  if(receiverRange<carrierRange-3.2)return{carry,action:pass};
 }
 return{carry,action:shot};
}
