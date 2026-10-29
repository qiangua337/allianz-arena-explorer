const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function goalkeeperProfile(difficulty='regular'){
 return difficulty==='casual'?{reaction:.31,shuffle:3.35,dive:5.2,window:.44,recovery:.72,error:.20}:difficulty==='challenge'?{reaction:.205,shuffle:3.95,dive:5.8,window:.47,recovery:.57,error:.09}:{reaction:.255,shuffle:3.65,dive:5.5,window:.455,recovery:.65,error:.14};
}
export function goalkeeperState(){return{phase:'ready',shotId:null,readAt:0,committed:false,diveAt:-10,diveUntil:0,recoverUntil:0,blockedUntil:0,direction:0,targetX:0,targetY:.95};}

// Keepers can read only the ball's observed flight after their reaction delay.
// A committed dive cannot reverse direction to follow a curling or rebounding ball.
export function planGoalkeeper(p,ball,owner,time,difficulty){
 const k=p.keeperState||(p.keeperState=goalkeeperState()),profile=goalkeeperProfile(difficulty),sign=p.attackSign??(p.team==='home'?-1:1),goal=-sign*52.5;
 if(k.phase==='dive'&&time>=k.diveUntil)k.phase='recover';
 if(k.phase==='recover'&&time>=k.recoverUntil)k.phase='ready';
 if(owner?.id===p.id){k.phase='holding';return{x:p.x,z:p.z,speed:0};}
 if(k.phase==='holding')k.phase='ready';
 const incoming=!owner&&ball.vz*sign<-.5,shot=incoming&&ball.shot&&ball.shot.team!==p.team?ball.shot:null;
 if(shot&&shot.id!==k.shotId){k.shotId=shot.id;k.committed=false;k.readAt=Math.max(time+profile.reaction,k.recoverUntil);k.holdX=p.x;k.holdZ=p.z;}
 if(k.phase==='dive')return{x:k.targetX,z:k.holdZ,speed:profile.dive};
 if(k.phase==='recover')return{x:p.x,z:p.z,speed:0};
 if(shot&&!k.committed){
  if(time<k.readAt)return{x:k.holdX,z:k.holdZ,speed:0};
  const plane=p.z+sign*.32,flight=clamp((plane-ball.z)/(ball.vz||1),0,1.5),bias=Math.sin(shot.id*2.17+p.index+.4)*profile.error;
  k.targetX=clamp(ball.x+ball.vx*flight+bias,-4.0,4.0);k.targetY=clamp(ball.y+ball.vy*flight-4.905*flight*flight,.24,2.15);k.direction=Math.sign(k.targetX-p.x)||1;k.holdZ=p.z;
  if(flight>profile.window*.74){k.phase='track';return{x:k.targetX,z:p.z,speed:profile.shuffle};}
  k.committed=true;
  if(Math.abs(k.targetX-p.x)>.55){k.phase='dive';k.diveAt=time;k.diveUntil=time+profile.window;k.recoverUntil=k.diveUntil+profile.recovery;return{x:k.targetX,z:p.z,speed:profile.dive,commit:true,direction:k.direction,height:k.targetY};}
  k.phase='set';return{x:k.targetX,z:p.z,speed:profile.shuffle};
 }
 if(incoming&&shot&&k.committed)return{x:k.targetX,z:goal+sign*1.6,speed:profile.shuffle};
 const distance=Math.abs(ball.z-goal),rushing=owner?.team!==p.team&&owner&&distance<10.5&&Math.abs(ball.x)<16;
 k.phase=rushing?'smother':'ready';const depth=rushing?clamp(distance-1.2,2.2,6.3):distance<22?3.15:2.2;
 return{x:clamp(rushing?ball.x*.70:ball.x*depth/Math.max(6,distance),rushing?-3.5:-2.4,rushing?3.5:2.4),z:goal+sign*depth,speed:rushing?4.6:profile.shuffle};
}

function contactOnSegment(a,b,center,radii){
 const ax=(a.x-center.x)/radii.x,ay=(a.y-center.y)/radii.y,az=(a.z-center.z)/radii.z,dx=(b.x-a.x)/radii.x,dy=(b.y-a.y)/radii.y,dz=(b.z-a.z)/radii.z,t=clamp(-(ax*dx+ay*dy+az*dz)/(dx*dx+dy*dy+dz*dz||1),0,1),distance=(ax+dx*t)**2+(ay+dy*t)**2+(az+dz*t)**2;
 return distance<=1?{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,distance}:null;
}
export function goalkeeperContact(p,ball,previous,time,difficulty){
 const k=p.keeperState||(p.keeperState=goalkeeperState()),profile=goalkeeperProfile(difficulty),sign=p.attackSign??(p.team==='home'?-1:1),speed=Math.hypot(ball.vx,ball.vz);
 if(time<k.blockedUntil||Math.abs(p.x)>20||Math.abs(p.z)<35)return null;
 if(ball.ownerId&&k.phase!=='smother')return null;
 if(speed<5&&ball.y<.5&&Math.hypot(ball.x-p.x,ball.z-p.z)<.70&&k.phase!=='recover')return{kind:'catch',point:{x:ball.x,y:ball.y,z:ball.z}};
 const reacted=!ball.shot||k.committed||k.phase==='track',diving=k.phase==='dive',recovering=k.phase==='recover',progress=clamp((time-k.diveAt)/profile.window,0,1),extension=diving?.16+.58*Math.sin(progress*Math.PI):0;
 let point=null;
 if(reacted&&!recovering&&(!diving||progress>.08)){
  const hands={x:p.x+k.direction*extension,y:k.phase==='smother'?.45:clamp(ball.shot?k.targetY:ball.y,.35,1.95),z:p.z+sign*.34},radii={x:diving?.43:.49,y:diving?.39:.48,z:.44};
  point=contactOnSegment(previous,ball,hands,radii);
 }
 // A body can block the ball before the hands react, but it is not a 3 m
 // wide collection radius and a prone keeper cannot stop head-height shots.
 const body=contactOnSegment(previous,ball,{x:p.x,y:diving||recovering?.45:.91,z:p.z+sign*.07},{x:.34,y:diving||recovering?.43:.88,z:.31});
 const contact=point||body;if(!contact||(contact.z-p.z)*sign<-.22)return null;
 const catchable=point&&speed<19.5&&point.distance<.60&&!recovering&&(!diving||speed<12);
 return{kind:catchable?'catch':'parry',point:contact};
}
