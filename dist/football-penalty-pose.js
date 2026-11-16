import {THREE} from './kit.js';
import {samplePenaltyApproach} from './penalty-approach.js';
import {keepFootballBootsAboveFloor,placeFootballPoseFoot} from './football-kick-pose.js';

const clamp01=value=>Math.max(0,Math.min(1,value));
const blend=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
const between=(t,a,b)=>clamp01((t-a)/(b-a));
const rise=(t,a,b)=>ease(between(t,a,b));
const stepLift=t=>Math.sin(Math.PI*t)**1.35;
const forward=new THREE.Vector3(),target=new THREE.Vector3();
const from={},to={},finish={};
const cocked=new THREE.Vector3(),contact=new THREE.Vector3(),follow=new THREE.Vector3(),strikeSpeed=new THREE.Vector3();

// Fixed world-space landing points keep contact independent of pose cadence.
// The next foot reaches ahead while the weight-bearing shoe stays on the turf.
function step(t,from,to,start,end,lift){
 const progress=between(t,start,end),travel=ease(progress);
 target.set(blend(from.x,to.x,travel),.089+lift*stepLift(progress),blend(from.z,to.z,travel));
 return .26*Math.sin(Math.PI*progress)*(.7-1.4*progress);
}

// The two sides of impact share the same tangent so the boot drives through
// the ball rather than easing to a stop and starting a second leg swing.
function swingFoot(t,from,to,seconds,approaching){
 const normal=1-t,travel=ease(t);
 const tangent=approaching?-t*t*normal:t*normal*normal;
 target.copy(from).lerp(to,travel).addScaledVector(strikeSpeed,tangent*seconds);
}

export function applyFootballPenaltyKick(bones,motion,group){
 const {elapsed,runup,duration}=motion;
 if(!(runup>0&&duration>runup))return;
 const progress=clamp01(elapsed/runup),after=Math.max(0,elapsed-runup),recovery=duration-runup;
 const weight=rise(progress,0,.14)*(1-rise(after,.43,recovery));
 if(weight<.00001)return;
 const side=motion.side===0?0:1,lateral=side===0?1:-1,plantSide=1-side;
 const direction=Math.sign(motion.contactZ-motion.strikeZ)||1;
 const scale=group.scale.x||1,power=Number.isFinite(motion.power)?clamp01(motion.power):.55;
 const supportX=-lateral*.19*scale*direction,shootX=lateral*.18*scale*direction;
 // The front of the boot meets the back of the ball at its release point.
 contact.set(motion.contactX+lateral*.012*scale*direction,
  (motion.contactY-group.position.y)/scale+.007,motion.contactZ-(.11+.205*scale)*direction);
 const plantLoad=rise(progress,.63,.91)*(1-rise(after,.06,.34));
 const hipTurn=lateral*(.21*rise(progress,.67,.88)-.47*rise(progress,.89,1)-.08*rise(after,0,.11));
 const chestTurn=lateral*(.16*rise(progress,.70,.91)-.41*rise(elapsed-runup,-.075,.125));
 const swing=Math.sin(Math.PI*4*rise(progress,.08,.83))*(1-plantLoad);
 const finishLoad=rise(after,0,.14)*(1-rise(after,.14,.40)),brake=rise(progress,.62,.86);

 bones[0].position.y-=(.047+.097*plantLoad+.025*Math.sin(Math.PI*3*progress)**2)*weight;
 bones[0].position.x+=lateral*(-.075*plantLoad+.02*finishLoad)*weight;
 bones[0].position.z+=(.027*brake+.051*finishLoad)*weight;
 bones[0].rotateY(hipTurn*.48*weight);
 bones[0].rotateZ(-lateral*.095*plantLoad*weight);
 bones[1].rotateX((.07+.11*(1-brake)+.13*plantLoad+.065*finishLoad)*weight);
 bones[2].rotateY((chestTurn+swing*.095)*weight);
 bones[2].rotateX((.025+.039*plantLoad)*weight);
 bones[3].rotateZ(lateral*.085*plantLoad*weight);
 bones[4].rotateX(.15*weight*(1-rise(after,.10,.36)));
 // Opposite arm stays open over the planted leg and folds back after impact.
 const lead=plantSide===0?6:12,trail=side===0?6:12;
 bones[lead].rotateX((-.32*swing-.24*plantLoad+.10*finishLoad)*weight);
 bones[lead].rotateZ(-lateral*(.045+.34*plantLoad+.08*finishLoad)*weight);
 bones[lead+1].rotateX((-.32+.14*plantLoad-.14*finishLoad)*weight);
 bones[trail].rotateX((.32*swing+.39*plantLoad-.16*finishLoad)*weight);
 bones[trail].rotateZ(lateral*(.045+.19*plantLoad+.14*finishLoad)*weight);
 bones[trail+1].rotateX((-.29-.18*finishLoad)*weight);

 const heading=group.rotation.y,cos=Math.cos(heading),sin=Math.sin(heading);
 const facingOffset=Math.atan2(-direction*sin,direction*cos);
 const place=(leg,pitch,yaw)=>{
  const dx=target.x-group.position.x,dz=target.z-group.position.z;
  forward.set((dx*cos-dz*sin)/scale,target.y,(dx*sin+dz*cos)/scale);
  placeFootballPoseFoot(bones,leg,forward,pitch,yaw+facingOffset,weight);
 };
 const anchor=(out,p,x,z)=>{
  samplePenaltyApproach(motion,runup*p,out);out.x+=x;out.z+=z*scale*direction;return out;
 };
 const support=anchor(from,.33,supportX,.17);
 const finalX=motion.strikeX+supportX,finalZ=motion.strikeZ+.18*scale*direction;
 let pitch;
 if(progress<.38){
  anchor(to,0,supportX,-.13);pitch=step(progress,to,support,.12,.33,.13);
 }else if(progress<.84){
  to.x=finalX;to.z=finalZ;pitch=step(progress,support,to,.49,.84,.20);
 }else{
  samplePenaltyApproach(motion,duration,finish);
  from.x=finalX;from.z=finalZ;to.x=finish.x+supportX;to.z=finish.z-.075*scale*direction;
  pitch=step(after,from,to,.41,.60,.067);
 }
 place(plantSide,pitch,-lateral*.08);

 if(progress<.78){
  const middle=anchor(from,.56,shootX,.22);
  anchor(to,0,shootX,.09);pitch=step(progress,to,middle,.25,.56,.17);
 }else{
  const windupEnd=.88,driveTime=runup*(1-windupEnd),crestTime=.14;
  const back=anchor(to,windupEnd,shootX,-.27);
  cocked.set(back.x,.32,back.z);
  if(progress<windupEnd){
   const middle=anchor(from,.56,shootX,.22),lift=rise(progress,.78,windupEnd);
   target.set(middle.x,.089,middle.z).lerp(cocked,lift);
   pitch=-.35*lift;
  }else{
   strikeSpeed.copy(contact).sub(cocked).multiplyScalar(1.52/driveTime);
   strikeSpeed.y=0;
   if(elapsed<=runup){
    const drive=between(progress,windupEnd,1);
    swingFoot(drive,cocked,contact,driveTime,true);
    pitch=blend(-.35,.09,ease(drive));
   }else{
    const effort=.85+.27*power,settle=rise(after,crestTime,.40);
    follow.set(contact.x-lateral*.18*scale*direction*effort,
     contact.y+.33*effort,contact.z+.48*scale*direction*effort);
    if(after<crestTime)swingFoot(after/crestTime,contact,follow,crestTime,false);
    else{
     samplePenaltyApproach(motion,duration,finish);
     target.copy(follow).lerp(forward.set(finish.x+shootX,.089,finish.z+.11*scale*direction),settle);
    }
    pitch=(.09+.23*rise(after,0,crestTime))*(1-settle);
   }
  }
 }
 place(side,pitch,lateral*.045);
 keepFootballBootsAboveFloor(bones);
}
