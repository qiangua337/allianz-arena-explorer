import {THREE} from './kit.js';
import {keepFootballBootsAboveFloor,liftFootballBootsAboveFloor,placeFootballPoseFoot,placeFootballSupportFoot,readFootballAnkle} from './football-kick-pose.js';

const neutral=new THREE.Quaternion();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ramp=(time,from,to)=>{
 const t=clamp((time-from)/(to-from),0,1);
 return t*t*(3-2*t);
};
const parents=[-1,0,1,2,3,4,3,6,7,0,9,10,3,12,13,0,15,16];
const positions=parents.map(()=>new THREE.Vector3()),rotations=parents.map(()=>new THREE.Quaternion());
const planted=[new THREE.Vector3(),new THREE.Vector3()];
const target=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),current=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),elbowGoal=new THREE.Vector3();
const upper=new THREE.Quaternion(),lower=new THREE.Quaternion(),delta=new THREE.Quaternion();
const clearances=[[0,.16],[2,.17],[3,.19],[5,.135],[6,.13],[7,.10],[8,.22],[9,.16],[10,.10],[12,.13],[13,.10],[14,.22],[15,.16],[16,.10]];
const recoveryBoot=new THREE.Vector3();

function readRig(bones){
 for(let i=0;i<parents.length;i++){
  const parent=parents[i];
  if(parent<0){positions[i].copy(bones[i].position);rotations[i].copy(bones[i].quaternion);}
  else{
   positions[i].copy(bones[i].position).applyQuaternion(rotations[parent]).add(positions[parent]);
   rotations[i].copy(rotations[parent]).multiply(bones[i].quaternion);
  }
 }
}

function placeGlove(bones,arm,x,y,z,weight){
 if(weight<=.001)return;
 const shoulder=positions[arm],elbow=positions[arm+1],wrist=positions[arm+2];
 const a=bones[arm+1].position.length(),b=bones[arm+2].position.length();
 target.copy(wrist).lerp(to.set(x,y,z),weight);
 axis.copy(target).sub(shoulder);
 const length=clamp(axis.length(),Math.abs(a-b)+.005,a+b-.027);
 axis.normalize();
 const along=(a*a-b*b+length*length)/(2*length);
 const radius=Math.sqrt(Math.max(0,a*a-along*along));
 current.copy(elbow).sub(shoulder).addScaledVector(axis,-from.copy(elbow).sub(shoulder).dot(axis)).normalize();
 bend.set(0,-.42,1).addScaledVector(axis,-axis.z+.42*axis.y).normalize().lerp(current,1-weight).normalize();
 elbowGoal.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,radius);
 target.copy(shoulder).addScaledVector(axis,length);
 delta.setFromUnitVectors(from.copy(elbow).sub(shoulder).normalize(),to.copy(elbowGoal).sub(shoulder).normalize());
 upper.copy(delta).multiply(rotations[arm]);
 delta.setFromUnitVectors(from.copy(wrist).sub(elbow).normalize(),to.copy(target).sub(elbowGoal).normalize());
 lower.copy(delta).multiply(rotations[arm+1]);
 bones[arm].quaternion.copy(rotations[3]).invert().multiply(upper);
 bones[arm+1].quaternion.copy(upper).invert().multiply(lower);
}

export function applyPenaltyKeeperSet(bones,lateralSpeed,phase,motion){
 const speed=motion?lateralSpeed*(1-ramp(motion.elapsed,0,.10)):lateralSpeed;
 const shuffle=ramp(Math.abs(speed),.05,1.15),direction=Math.sign(speed);
 bones[0].position.y-=.09;
 bones[0].position.x+=direction*.05*shuffle;
 bones[0].rotateZ(-direction*.08*shuffle);
 bones[2].rotateX(.15);
 bones[4].rotateX(-.10);
 for(let i=0;i<2;i++){
  const side=1-2*i;
  const progress=(phase+i*.5)%1;
  // One boot supports the keeper while the other closes the lateral step.
  const swing=progress<.5?0:Math.sin((progress-.5)*2*Math.PI);
  const shift=.17-progress*.68+.68*ramp(progress,.5,1);
  recoveryBoot.set(side*.245+direction*shuffle*shift,.086+.074*shuffle*swing,.025);
  placeFootballPoseFoot(bones,i,recoveryBoot,.10*shuffle*swing,side*.13,1);
 }
 readRig(bones);
 placeGlove(bones,6,.30,.96,.40,.87);
 placeGlove(bones,12,-.30,.96,.40,.87);
}

export function applyPenaltyKeeperPose(bones,motion,group){
 const time=motion.elapsed,duration=motion.duration;
 const height=Number.isFinite(motion.height)?clamp((motion.height-1.16)/.81,-1,1):0;
 if(time<=0||time>=duration)return;
 if(motion.type==='save'){
  const extend=ramp(time,0,.185)*(1-ramp(time,.26,duration)),low=Math.max(0,-height),high=Math.max(0,height);
  for(let i=0;i<2;i++)readFootballAnkle(bones,i,planted[i]);
  bones[2].rotateX((.16+.36*low-.22*high)*extend);
  bones[4].rotateX((-.04-.13*low+.12*high)*extend);
  bones[0].position.y+=(.025*high-.045-.11*low)*extend;
  for(let i=0;i<2;i++)placeFootballSupportFoot(bones,i,planted[i],extend);
  keepFootballBootsAboveFloor(bones);
  const catchHeight=clamp(1.16+height*.81,.43,1.92);
  readRig(bones);
  placeGlove(bones,6,.15+.047*low,catchHeight,.47-.07*high,extend);
  placeGlove(bones,12,-.15-.047*low,catchHeight,.47-.07*high,extend);
  return;
 }

 const side=motion.direction<0?-1:1;
 const leadArm=side>0?6:12,trailArm=side>0?12:6;
 const leadFoot=side>0?0:1,trailFoot=1-leadFoot;
 const leadLeg=side>0?9:15,trailLeg=side>0?15:9;
 const save=Number.isFinite(motion.saveWindow)?motion.saveWindow:.585;
 const high=Math.max(0,height),low=Math.max(0,-height);
 const landingAt=save+.06+.13*high-.06*low;
 const recoverStart=Math.min(duration-.27,landingAt+.12);
 const load=ramp(time,0,.095)*(1-ramp(time,.095,.245));
 const push=ramp(time,.07,.335+.055*high);
 const rise=ramp(time,recoverStart,duration);
 const lateral=push*(1-rise);
 const drop=ramp(time,landingAt-.14,landingAt+.06);
 const brace=drop*(1-ramp(time,recoverStart+.035,duration-.05));
 const lift=high*ramp(time,.105,.36)*(1-ramp(time,.46,landingAt+.04));
 const reach=ramp(time,.055,.36)*(1-ramp(time,landingAt-.04,landingAt+.16));
 const plantedWeight=ramp(time,0,.036)*(1-ramp(time,.121,.214));
 if(plantedWeight>0)for(let i=0;i<2;i++)readFootballAnkle(bones,i,planted[i]);
 const authored=ramp(time,.035,.205)*(1-ramp(time,recoverStart+.03,duration));
 for(const bone of bones)bone.quaternion.slerp(neutral,.88*authored);

 // Low saves cut down along the grass. High saves extend upward before
 // the body rolls onto its side and folds the legs below the hips.
 const roll=(1.03+.28*low-.54*high)*lateral+(.24+.43*high-.10*low)*brace;
 bones[0].rotateZ(side*(.10*load-roll));
 bones[0].position.x+=side*(-.10*load+.15*lateral-.14*brace);
 bones[0].position.y+=-.10*load-(.20+.19*low-.15*high)*lateral-.27*brace+.30*lift;
 bones[0].position.z+=.11*brace;
 bones[1].rotateX(.12*load+.27*brace);
 bones[2].rotateY(-side*.20*brace);
 bones[4].rotateZ(side*(.19*lateral+.13*brace));
 bones[5].rotateY(-side*(.13*lateral+.13*brace));
 bones[leadLeg].rotateX(-.17*load+.08*reach-.46*brace);
 bones[leadLeg+1].rotateX(.37*load+.20*reach+.94*brace+.20*lift);
 bones[trailLeg].rotateX(-.27*load+(.24+.25*low)*reach-.59*brace);
 bones[trailLeg+1].rotateX(.49*load+.18*reach+.86*brace+.22*lift);
 bones[0].position.y=Math.max(.29,bones[0].position.y);
 if(plantedWeight>0){
  const support=planted[trailFoot];
  // Hold the loaded boot in pitch coordinates as the simulation starts the
  // lateral move. Roll through the toe once the leg reaches full extension.
  if(group&&Number.isFinite(motion.startX)){
   const localSlide=(group.position.x-motion.startX)*Math.cos(group.rotation.y)/group.scale.x;
   support.x-=clamp(localSlide,-.51,.51);
   placeFootballPoseFoot(bones,trailFoot,support,.23*ramp(time,.105,.19),-side*.15,plantedWeight);
  }else placeFootballSupportFoot(bones,trailFoot,support,plantedWeight);
  placeFootballSupportFoot(bones,leadFoot,planted[leadFoot],plantedWeight*.58);
 }
 const gather=ramp(time,landingAt,landingAt+.17)*(1-ramp(time,recoverStart+.14,duration-.025));
 if(gather>0){
  recoveryBoot.set(side*.35,.088,.27);
  placeFootballPoseFoot(bones,leadFoot,recoveryBoot,.02,side*.25,gather);
  recoveryBoot.set(-side*.33,.135,-.29);
  placeFootballPoseFoot(bones,trailFoot,recoveryBoot,.37,-side*.22,gather*.68);
 }
 liftFootballBootsAboveFloor(bones);
 const landing=ramp(time,landingAt-.135,landingAt+.15);
 const gloveDrop=ramp(time,landingAt-.14-.14*high,landingAt+.17);
 const extension=ramp(time,.018,.395);
 const gloves=ramp(time,0,.15)*(1-ramp(time,recoverStart+.045,duration-.015));
 readRig(bones);
 placeGlove(bones,leadArm,side*((.29+(.78+.08*low-.20*high)*extension)*(1-landing)+.61*landing),
  (.99+(.95*high-.64*low)*extension)*(1-gloveDrop)+.21*gloveDrop,.33+.10*landing,gloves);
 placeGlove(bones,trailArm,side*((-.28+(1.03-.08*high)*extension)*(1-landing)+.16*landing),
  (.97+(.77*high-.49*low)*extension)*(1-gloveDrop)+.54*gloveDrop,.32+.12*landing,gloves);
 readRig(bones);
 let floor=Infinity;
 for(const [bone,radius] of clearances)floor=Math.min(floor,positions[bone].y-radius);
 if(floor<.014)bones[0].position.y+=.014-floor;
}
