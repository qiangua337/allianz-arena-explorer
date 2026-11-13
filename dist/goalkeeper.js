import {abilityFactor,playerAbilities} from './football-abilities.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function goalkeeperProfile(difficulty='regular'){
 return difficulty==='casual'?{reaction:.31,shuffle:3.35,dive:5.2,window:.44,recovery:.72,error:.20}:difficulty==='challenge'?{reaction:.205,shuffle:3.95,dive:5.8,window:.47,recovery:.57,error:.09}:{reaction:.255,shuffle:3.65,dive:5.5,window:.455,recovery:.65,error:.14};
}
export function goalkeeperState(){return{phase:'ready',shotId:null,readAt:0,committed:false,diveAt:-10,diveUntil:0,recoverUntil:0,blockedUntil:0,direction:0,targetX:0,targetY:.95};}

function observedFlight(ball,plane){
 const ground=ball.y<=.125&&ball.vy<.3,drag=ground?.39:.08,travel=clamp((plane-ball.z)/(ball.vz||1),0,1.5);
 const time=-Math.log(1-drag*travel)/drag;
 return{x:ball.x+ball.vx*travel+(ball.curve||0)*(time-travel)/drag,y:ground?.11:Math.max(.11,ball.y+ball.vy*time-4.905*time*time),time};
}

// Keepers can read only the ball's observed flight after their reaction delay.
// A committed dive cannot reverse direction to follow a curling or rebounding ball.
export function planGoalkeeper(p,ball,owner,time,difficulty,{openPlay=false}={}){
 const k=p.keeperState||(p.keeperState=goalkeeperState()),profile=goalkeeperProfile(difficulty),sign=p.attackSign??(p.team==='home'?-1:1),goal=-sign*52.5;
 if(k.phase==='dive'&&time>=k.diveUntil)k.phase='recover';
 if(k.phase==='recover'&&time>=k.recoverUntil)k.phase='ready';
 if(owner?.id===p.id){k.phase='holding';return{x:p.x,z:p.z,speed:0};}
 if(k.phase==='holding')k.phase='ready';
 const incoming=!owner&&ball.vz*sign<-.5,shot=incoming&&ball.shot&&ball.shot.team!==p.team?ball.shot:null;
 if(shot&&shot.id!==k.shotId){
  k.shotId=shot.id;k.committed=false;k.holdX=p.x;k.holdZ=p.z;
  k.closeShot=openPlay&&Math.hypot(ball.x,ball.z-goal)<15;
  const released=openPlay&&Number.isFinite(shot.at)?Math.min(time,shot.at):time;
  const reflex=openPlay?abilityFactor(playerAbilities(p).goalkeeping,.009,90):1;
  k.readAt=Math.max(released+profile.reaction/reflex-(k.closeShot?.045:0),k.recoverUntil);
  if(openPlay&&(k.phase==='track'||k.phase==='set'))k.phase='ready';
 }
 if(k.phase==='dive')return{x:k.targetX,z:k.holdZ,speed:profile.dive};
 if(k.phase==='recover')return{x:p.x,z:p.z,speed:0};
 if(shot&&!k.committed){
  if(time<k.readAt)return{x:k.holdX,z:k.holdZ,speed:0};
  const plane=p.z+sign*.32,travel=clamp((plane-ball.z)/(ball.vz||1),0,1.5);
  const intercept=openPlay?observedFlight(ball,plane):{x:ball.x+ball.vx*travel,y:ball.y+ball.vy*travel-4.905*travel*travel,time:travel};
  const bias=Math.sin(shot.id*2.17+p.index+.4)*profile.error;
  k.targetX=clamp(intercept.x+bias,-4,4);k.targetY=clamp(intercept.y,.24,2.15);k.direction=Math.sign(k.targetX-p.x)||1;k.holdZ=p.z;
  if(intercept.time>profile.window*.74){k.phase='track';return{x:k.targetX,z:p.z,speed:profile.shuffle};}
  k.committed=true;
  if(Math.abs(k.targetX-p.x)>(k.closeShot?.44:.55)){k.phase='dive';k.diveAt=time;k.diveUntil=time+profile.window;k.recoverUntil=k.diveUntil+profile.recovery;return{x:k.targetX,z:p.z,speed:profile.dive,commit:true,direction:k.direction,height:k.targetY};}
  k.phase='set';return{x:k.targetX,z:p.z,speed:profile.shuffle};
 }
 if(incoming&&shot&&k.committed)return{x:k.targetX,z:openPlay?k.holdZ:goal+sign*1.6,speed:profile.shuffle};
 const distance=Math.abs(ball.z-goal),rushing=owner?.team!==p.team&&owner&&distance<10.5&&Math.abs(ball.x)<16;
 k.closeShot=false;
 k.phase=rushing?'smother':'ready';
 if(openPlay&&rushing){
  // Come out along the line from the ball to the centre of the goal and
  // leave space to set the feet before the striker takes the last touch.
  const depth=clamp(distance-1.45,1.35,6.45),x=clamp(ball.x*depth/Math.max(2,distance),-5.5,5.5);
  return{x,z:goal+sign*depth,speed:4.9};
 }
 const depth=rushing?clamp(distance-1.2,2.2,6.3):distance<22?3.15:2.2;
 return{x:clamp(rushing?ball.x*.70:ball.x*depth/Math.max(6,distance),rushing?-3.5:-2.4,rushing?3.5:2.4),z:goal+sign*depth,speed:rushing?4.6:profile.shuffle};
}

function contactOnSegment(a,b,center,radii){
 const ax=(a.x-center.x)/radii.x,ay=(a.y-center.y)/radii.y,az=(a.z-center.z)/radii.z,dx=(b.x-a.x)/radii.x,dy=(b.y-a.y)/radii.y,dz=(b.z-a.z)/radii.z,t=clamp(-(ax*dx+ay*dy+az*dz)/(dx*dx+dy*dy+dz*dz||1),0,1),distance=(ax+dx*t)**2+(ay+dy*t)**2+(az+dz*t)**2;
 return distance<=1?{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,distance}:null;
}
export function goalkeeperContact(p,ball,previous,time,difficulty,{openPlay=false}={}){
 const k=p.keeperState||(p.keeperState=goalkeeperState()),profile=goalkeeperProfile(difficulty),sign=p.attackSign??(p.team==='home'?-1:1),speed=Math.hypot(ball.vx,ball.vz);
 if(time<k.blockedUntil||Math.abs(p.x)>20||Math.abs(p.z)<35)return null;
 if(ball.ownerId&&k.phase!=='smother')return null;
 if(speed<5&&ball.y<.5&&Math.hypot(ball.x-p.x,ball.z-p.z)<.70&&k.phase!=='recover')return{kind:'catch',point:{x:ball.x,y:ball.y,z:ball.z}};
 const reacted=!ball.shot||k.committed||k.phase==='track',diving=k.phase==='dive',recovering=k.phase==='recover',smothering=k.phase==='smother';
 const closeShot=openPlay&&k.closeShot,progress=clamp((time-k.diveAt)/profile.window,0,1);
 const extension=diving?(closeShot?.21:.16)+(closeShot?.64:.58)*Math.sin(progress*Math.PI):0,closeBlock=closeShot&&!diving&&!recovering;
 let point=null;
 if(reacted&&!recovering&&(!diving||progress>.08)){
  const hands={x:p.x+k.direction*extension,y:smothering?.45:clamp(ball.shot?k.targetY:ball.y,.35,1.95),z:p.z+sign*.34},radii={x:diving?(k.penaltyDive&&!openPlay?.87:.43):closeBlock?.55:.49,y:diving?.39:.48,z:.44};
  point=contactOnSegment(previous,ball,hands,radii);
 }
 // A body can block the ball before the hands react, but it is not a 3 m
 // wide collection radius and a prone keeper cannot stop head-height shots.
 const body=contactOnSegment(previous,ball,{x:p.x,y:diving||recovering?.45:.91,z:p.z+sign*.07},{x:.34,y:diving||recovering?.43:.88,z:.31});
 // The legs can block a close shot before the hands react.
 const block=closeBlock&&!body?contactOnSegment(previous,ball,{x:p.x,y:.53,z:p.z+sign*.16},{x:.66,y:.57,z:.33}):null;
 const contact=point||body||block;if(!contact||(contact.z-p.z)*sign<-.22)return null;
 const settled=!diving&&!recovering&&point&&Math.abs(point.x-p.x)<.28&&point.y<1.7;
 const hands=openPlay?abilityFactor(playerAbilities(p).goalkeeping,.006):1;
 const catchable=point&&speed<(openPlay&&settled?23:19.5)*hands&&point.distance<.60&&!recovering&&(!diving||speed<12);
 return{kind:catchable?'catch':'parry',point:contact};
}
