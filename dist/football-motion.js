import {THREE} from './kit.js';
import {entranceFloor} from './matchday-route.js';
import {setFootballBootBounds,keepFootballBootsAboveFloor} from './football-kick-pose.js';
import {createFootballFootPlant} from './football-foot-plant.js';
const forward=new THREE.Vector3(0,0,1);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createFootballMotion(data,motion,bones,group,definition){
 setFootballBootBounds(bones,data.bootBounds);
 const footPlant=definition.role==='player'?createFootballFootPlant(bones):null;
 const rest=data.bones.map(b=>new THREE.Vector3().fromArray(b.head)),world=data.bones.map(()=>new THREE.Quaternion()),q=new THREE.Quaternion(),a=new THREE.Quaternion(),b=new THREE.Quaternion(),hip=new THREE.Vector3(),knee=new THREE.Vector3(),ankle=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),v=new THREE.Vector3(),u=new THREE.Vector3();
 let distance=0,hasLast=false,lastX=0,lastZ=0,blend=0,lastTime=null,travelSpeed=0,gaitDirection=1;
 let heightScale=definition.height/1.86;const walk=motion.clips.Walk_Loop,jog=motion.clips.Jog_Fwd_Loop||walk,sprint=motion.clips.Sprint_Loop||jog,idle=motion.clips[definition.seated?'Sitting_Idle_Loop':definition.role==='coach'?'Idle_Talking_Loop':'Idle_Loop'];
 const rootWalk=new THREE.Vector3(),rootIdle=new THREE.Vector3(),rootOffset=new THREE.Vector3(),rootJog=new THREE.Vector3(),rootSprint=new THREE.Vector3(),jogQ=new THREE.Quaternion(),sprintQ=new THREE.Quaternion();
 const walkFrames={},idleFrames={},jogFrames={},sprintFrames={};
 function indices(clip,phase,out){const f=((phase%1)+1)%1*60,i=Math.floor(f);out.a=clip.frames[i];out.b=clip.frames[(i+1)%61];out.t=f-i;}
 function readQuaternion(frames,i,out){return out.slerpQuaternions(a.fromArray(frames.a,3+i*4),b.fromArray(frames.b,3+i*4),frames.t);}
 function readRoot(frames,out){return out.fromArray(frames.a).lerp(u.fromArray(frames.b),frames.t);}
 function pose(px,pz,heading,time,moving,seatY=0,deferWorld=false){heightScale=definition.height/1.86;
  const discontinuity=lastTime!==null&&(time<lastTime||time-lastTime>.25),dt=lastTime===null?.016:clamp(time-lastTime,0,.15);lastTime=time;
  const stair=px>-46.4&&px<-40.3,step=hasLast?Math.hypot(px-lastX,pz-lastZ):0;travelSpeed=THREE.MathUtils.damp(travelSpeed,dt>.001&&step<2?step/dt:0,8,dt);const run=stair||definition.seated?0:clamp((travelSpeed-2.2)/2,0,1),fast=stair||definition.seated?0:clamp((travelSpeed-5.4)/1.6,0,1),stride=THREE.MathUtils.lerp(THREE.MathUtils.lerp(motion.stride,jog.stride||2.25,run),sprint.stride||3.1,fast)*(stair?.52:1);
  // A defender can retreat while still facing the ball. Advancing the same
  // forward clip made both planted feet slide at nearly twice travel speed.
  // Signed *actual displacement* also works at distant 12Hz pose updates.
  if(hasLast&&step<2){const along=(px-lastX)*Math.sin(heading)+(pz-lastZ)*Math.cos(heading);if(!stair&&!definition.seated&&step>.0001){if(along<-.35*step)gaitDirection=-1;else if(along>.35*step)gaitDirection=1;}else gaitDirection=1;distance+=step*gaitDirection/(heightScale*stride);}lastX=px;lastZ=pz;hasLast=true;blend=THREE.MathUtils.damp(blend,moving?1:0,10,dt);if(definition.seated)blend=0;
  // Reuse frame windows, and sample only clips that contribute to this pose.
  // Standing staff no longer decode three unused locomotion clips per frame.
  const phase=distance+definition.phase/(Math.PI*2),locomotion=blend>0,walkWeight=fast<1&&run<1,jogWeight=fast<1&&run>0;
  if(blend<1)indices(idle,time/idle.duration+definition.phase,idleFrames);
  if(locomotion){if(walkWeight)indices(walk,phase,walkFrames);if(jogWeight)indices(jog,phase,jogFrames);if(fast>0)indices(sprint,phase,sprintFrames);
   if(fast===1)readRoot(sprintFrames,rootWalk);else{if(run===1)readRoot(jogFrames,rootWalk);else readRoot(walkFrames,rootWalk);if(run>0&&run<1)rootWalk.lerp(readRoot(jogFrames,rootJog),run);if(fast>0)rootWalk.lerp(readRoot(sprintFrames,rootSprint),fast);}
  }
  if(blend===1)rootOffset.copy(rootWalk);else{readRoot(idleFrames,rootIdle);rootOffset.copy(rootIdle);if(locomotion)rootOffset.lerp(rootWalk,blend);}
  for(let i=0;i<bones.length;i++){
   if(locomotion){if(fast===1)readQuaternion(sprintFrames,i,world[i]);else{if(run===1)readQuaternion(jogFrames,i,world[i]);else readQuaternion(walkFrames,i,world[i]);if(run>.001&&run<1)world[i].slerp(readQuaternion(jogFrames,i,jogQ),run);if(fast>.001)world[i].slerp(readQuaternion(sprintFrames,i,sprintQ),fast);}}
   if(blend===1)bones[i].quaternion.copy(world[i]);else{readQuaternion(idleFrames,i,q);bones[i].quaternion.copy(q);if(locomotion)bones[i].quaternion.slerp(world[i],blend);}
  }
  bones[0].position.copy(rest[0]).add(rootOffset);const floor=stair?clamp((px+45.9)/5.4,0,1)*2.7-2.7:entranceFloor(px);
  group.position.set(px,floor+seatY,pz);group.rotation.y=heading;group.scale.setScalar(heightScale);footPlant?.update(px,pz,heading,heightScale,phase,fast,dt,moving&&travelSpeed>3.4&&blend>.9,stair||definition.seated||px< -39.6||discontinuity||step>=2);
  // Interpolated clip rotations do not preserve the exporters' grounded soles.
  // Correct only mixed flat-ground poses; stairs retain their own real treads.
  if(footPlant&&!stair&&!definition.seated&&px>=-39.6&&(blend>.03&&blend<.995||run>.001&&run<.999||fast>.001&&fast<.999))keepFootballBootsAboveFloor(bones);
  if(!deferWorld||stair)group.updateMatrixWorld(true);
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
 return{pose,reset(){distance=0;hasLast=false;blend=0;lastTime=null;travelSpeed=0;gaitDirection=1;footPlant?.reset();}};
}
