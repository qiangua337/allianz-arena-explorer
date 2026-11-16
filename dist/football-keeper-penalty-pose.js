import {THREE} from './kit.js';
import {keepFootballBootsAboveFloor,liftFootballBootsAboveFloor,placeFootballSupportFoot,readFootballAnkle} from './football-kick-pose.js';

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

export function applyPenaltyKeeperPose(bones,motion){
 const time=motion.elapsed,duration=motion.duration;
 const height=Number.isFinite(motion.height)?clamp((motion.height-1.16)/.81,-1,1):0;
 if(time<=0||time>=duration)return;
 if(motion.type==='save'){
  const extend=ramp(time,0,.16)*(1-ramp(time,.23,duration));
  bones[2].rotateX((.23-.13*height)*extend);
  bones[9].rotateX(-.21*extend);bones[15].rotateX(-.21*extend);
  bones[10].rotateX(.37*extend);bones[16].rotateX(.37*extend);
  bones[0].position.y-=.07*extend;
  keepFootballBootsAboveFloor(bones);
  const catchHeight=clamp(1.16+height*.81,.58,1.87);
  readRig(bones);
  placeGlove(bones,6,.19,catchHeight,.49,extend);
  placeGlove(bones,12,-.19,catchHeight,.49,extend);
  return;
 }

 const side=motion.direction<0?-1:1;
 const leadArm=side>0?6:12,trailArm=side>0?12:6;
 const leadLeg=side>0?9:15,trailLeg=side>0?15:9;
 const save=Number.isFinite(motion.saveWindow)?motion.saveWindow:.585;
 const recoverStart=Math.min(duration-.32,save+.12);
 const push=ramp(time,.075,.36),up=ramp(time,recoverStart,duration);
 const airborne=push*(1-up),load=ramp(time,0,.095)*(1-ramp(time,.09,.23));
 const bracing=ramp(time,save-.14,save+.10)*(1-ramp(time,recoverStart,duration-.08));
 const reach=ramp(time,.03,.34)*(1-ramp(time,save-.02,save+.28));
 const plantedWeight=ramp(time,0,.045)*(1-ramp(time,.075,.19));
 if(plantedWeight>0)for(let i=0;i<2;i++)readFootballAnkle(bones,i,planted[i]);
 // The actor slides laterally along the simulation's goal line. A forward
 // running clip at that speed would cycle the legs below an airborne keeper.
 const authored=ramp(time,.04,.21)*(1-ramp(time,recoverStart+.03,duration));
 for(const bone of bones)bone.quaternion.slerp(neutral,.88*authored);

 const high=Math.max(0,height),low=Math.max(0,-height);
 // Load the opposite leg, extend toward the selected post and rotate onto
 // the lead hip only after the reach. The lead knee folds for the rise.
 const roll=(1.05+.18*low-.54*high)*airborne+(.24+.34*high)*bracing;
 bones[0].rotateZ(side*(.10*load-roll));
 bones[0].position.x+=side*(-.10*load+.16*airborne);
 bones[0].position.y+=-.10*load-(.27+.12*low-.20*high)*airborne-.20*bracing;
 bones[1].rotateX(.14*load+.14*bracing);
 bones[4].rotateZ(side*(.20*airborne+.09*bracing));
 bones[5].rotateY(-side*.12*airborne);
 bones[leadLeg].rotateX(-.16*load+.12*reach-.48*bracing);
 bones[leadLeg+1].rotateX(.34*load+.24*reach+1.03*bracing);
 bones[trailLeg].rotateX(-.30*load+.30*reach-.35*bracing);
 bones[trailLeg+1].rotateX(.50*load+.17*reach+.68*bracing);
 // Floor correction moves just the model's pelvis. The keeper's position
 // and the save contact stay owned by the authoritative simulation.
 bones[0].position.y=Math.max(.33,bones[0].position.y);
 if(plantedWeight>0)for(let i=0;i<2;i++)placeFootballSupportFoot(bones,i,planted[i],plantedWeight);
 liftFootballBootsAboveFloor(bones);
 const landing=ramp(time,save-.09,save+.31);
 const extension=clamp((time-.04)/.30,0,1);
 const gloves=ramp(time,0,.125)*(1-ramp(time,recoverStart+.055,duration-.025));
 readRig(bones);
 placeGlove(bones,leadArm,side*((.32+.74*extension)*(1-landing)+.76*landing),
  (.99+(.82*high-.52*low)*extension)*(1-landing)+.235*landing,.33,gloves);
 placeGlove(bones,trailArm,side*((-.28+1.05*extension)*(1-landing)+.39*landing),
  (.95+(.77*high-.50*low)*extension)*(1-landing)+.38*landing,.32,gloves);
 readRig(bones);
 let floor=Infinity;
 for(const [bone,radius] of clearances)floor=Math.min(floor,positions[bone].y-radius);
 if(floor<.014)bones[0].position.y+=.014-floor;
}
