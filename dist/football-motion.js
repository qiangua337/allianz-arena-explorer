import {THREE} from './kit.js';
import {entranceFloor} from './matchday-route.js';
const forward=new THREE.Vector3(0,0,1);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createFootballMotion(data,motion,bones,group,definition){
 const rest=data.bones.map(b=>new THREE.Vector3().fromArray(b.head)),world=data.bones.map(()=>new THREE.Quaternion()),q=new THREE.Quaternion(),a=new THREE.Quaternion(),b=new THREE.Quaternion(),hip=new THREE.Vector3(),knee=new THREE.Vector3(),ankle=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),v=new THREE.Vector3(),u=new THREE.Vector3();
 let distance=0,last=null,blend=0,lastTime=null;
 const heightScale=definition.height/1.86,walk=motion.clips.Walk_Loop,idle=motion.clips[definition.seated?'Sitting_Idle_Loop':definition.role==='coach'?'Idle_Talking_Loop':'Idle_Loop'];
 const rootWalk=new THREE.Vector3(),rootIdle=new THREE.Vector3(),rootOffset=new THREE.Vector3();
 function indices(clip,phase){const f=((phase%1)+1)%1*60,i=Math.floor(f);return[clip.frames[i],clip.frames[(i+1)%61],f-i];}
 function readQuaternion(frames,i,out){return out.slerpQuaternions(a.fromArray(frames[0],3+i*4),b.fromArray(frames[1],3+i*4),frames[2]);}
 function pose(px,pz,heading,time,moving,seatY=0){
  const dt=lastTime===null?.016:clamp(time-lastTime,0,.15);lastTime=time;
  const stair=px>-46.4&&px<-40.3,stride=motion.stride*(stair?.52:1),step=last?Math.hypot(px-last.x,pz-last.z):0;
  if(last&&step<2)distance+=step/(heightScale*stride);last={x:px,z:pz};blend=THREE.MathUtils.damp(blend,moving?1:0,10,dt);if(definition.seated)blend=0;
  const walkFrames=indices(walk,distance+definition.phase/(Math.PI*2)),idleFrames=indices(idle,time/idle.duration+definition.phase);
  rootWalk.fromArray(walkFrames[0]).lerp(u.fromArray(walkFrames[1]),walkFrames[2]);rootIdle.fromArray(idleFrames[0]).lerp(u.fromArray(idleFrames[1]),idleFrames[2]);rootOffset.copy(rootIdle).lerp(rootWalk,blend);
  for(let i=0;i<bones.length;i++){readQuaternion(idleFrames,i,q);readQuaternion(walkFrames,i,world[i]);bones[i].quaternion.copy(q).slerp(world[i],blend);}
  bones[0].position.copy(rest[0]).add(rootOffset);const floor=stair?clamp((px+45.9)/5.4,0,1)*2.7-2.7:entranceFloor(px);
  group.position.set(px,floor+seatY,pz);group.rotation.y=heading;group.scale.setScalar(heightScale);group.updateMatrixWorld(true);
  // On stairs retain the authored upper-body motion, then put each ankle on
  // the next real tread. Knee bending uses the original animation's plane.
  if(stair){
   for(const [thigh,shin,foot]of [[9,10,11],[15,16,17]]){
    bones[thigh].getWorldPosition(hip);bones[shin].getWorldPosition(knee);bones[foot].getWorldPosition(ankle);group.worldToLocal(hip);group.worldToLocal(knee);group.worldToLocal(ankle);
    ankle.z*=.52;const footX=px+ankle.z*Math.sin(heading)*heightScale,ground=entranceFloor(footX);
    ankle.y+=(ground-floor)/heightScale;const sourceLift=Math.max(0,ankle.y-rootOffset.y-.077-(ground-floor)/heightScale);ankle.y+=Math.min(.10,sourceLift*.45);
    const l1=rest[shin].distanceTo(rest[thigh]),l2=rest[foot].distanceTo(rest[shin]);axis.copy(ankle).sub(hip);const length=clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.002);axis.normalize();const along=(l1*l1-l2*l2+length*length)/(2*length),radius=Math.sqrt(Math.max(0,l1*l1-along*along));bend.copy(forward).addScaledVector(axis,-forward.dot(axis)).normalize();knee.copy(hip).addScaledVector(axis,along).addScaledVector(bend,radius);
    const parentWorld=bones[0].quaternion;world[foot].copy(bones[foot].quaternion).premultiply(bones[shin].quaternion).premultiply(bones[thigh].quaternion).premultiply(parentWorld);
    q.setFromUnitVectors(v.copy(rest[shin]).sub(rest[thigh]).normalize(),u.copy(knee).sub(hip).normalize());bones[thigh].quaternion.copy(parentWorld).invert().multiply(q);
    b.setFromUnitVectors(v.copy(rest[foot]).sub(rest[shin]).normalize(),u.copy(ankle).sub(knee).normalize());bones[shin].quaternion.copy(q).invert().multiply(b);bones[foot].quaternion.copy(b).invert().multiply(world[foot]);
   }
   group.updateMatrixWorld(true);let lowest=Infinity;for(const foot of[11,17])for(const x of[-.039,.039])for(const z of[-.08,.16]){v.set(rest[foot].x+x,.023,rest[foot].z+z).sub(rest[foot]).applyMatrix4(bones[foot].matrixWorld);lowest=Math.min(lowest,v.y-entranceFloor(v.x));}if(Number.isFinite(lowest)){bones[0].position.y-=clamp(lowest,-.20,.24)/heightScale;group.updateMatrixWorld(true);}
  }
 }
 return{pose,reset(){distance=0;last=null;blend=0;lastTime=null;}};
}
