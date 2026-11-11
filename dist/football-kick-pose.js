import {THREE} from './kit.js';
const rigs=new WeakMap(),bootBounds=new WeakMap(),defaultBounds={min:[-.054,-.075,-.105],max:[.054,.065,.205]},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
const ramp=(t,from,to)=>smooth(clamp((t-from)/(to-from),0,1));
const strokes={
 short:{open:.82,pitch:.02,contactBack:.095,reach:.11,lift:.10,across:.055,peak:.23,release:.27,drop:.080,turn:.21,lean:.07,arm:.17,load:.16},
 through:{open:.48,pitch:.08,contactBack:.132,reach:.22,lift:.15,across:.065,peak:.27,release:.32,drop:.088,turn:.24,lean:.13,arm:.22,load:.23},
 lofted:{open:.35,pitch:-.19,contactBack:.185,reach:.19,lift:.27,across:.055,peak:.28,release:.35,drop:.091,turn:.18,lean:-.02,arm:.23,load:.23},
 drive:{open:.08,pitch:.19,contactBack:.265,reach:.31,lift:.29,across:.12,peak:.33,release:.40,drop:.100,turn:.36,lean:.19,arm:.34,load:.36},
 finesse:{open:.88,pitch:-.02,contactBack:.092,reach:.16,lift:.19,across:.29,peak:.31,release:.34,drop:.094,turn:.45,lean:.06,arm:.29,load:.28},
 lob:{open:.15,pitch:-.28,contactBack:.272,reach:.10,lift:.26,across:.03,peak:.24,release:.32,drop:.090,turn:.10,lean:-.14,arm:.22,load:.22}
};
export function setFootballBootBounds(bones,bounds){if(bounds?.min?.length===3&&bounds?.max?.length===3&&[...bounds.min,...bounds.max].every(Number.isFinite))bootBounds.set(bones,bounds);}
function rigFor(bones){
 let rig=rigs.get(bones);if(rig)return rig;
 const legs=[[9,10,11],[15,16,17]].map(([thigh,shin,foot])=>({thigh,shin,foot,length1:bones[shin].position.length(),length2:bones[foot].position.length()}));
 if(legs.some(l=>l.length1<.1||l.length2<.1))return null;
 rig={legs,bounds:bootBounds.get(bones)||defaultBounds,goals:[new THREE.Vector3(),new THREE.Vector3()],stroke:{},v:Array.from({length:12},()=>new THREE.Vector3()),q:Array.from({length:8},()=>new THREE.Quaternion())};rigs.set(bones,rig);return rig;
}
// Solve in the actor's local coordinates before its one skeleton propagation.
// Keeping the old segment twist avoids a knee snap as the stroke recovers.
function placeFoot(bones,leg,rig,goal,footAngle,weight,bendWeight=weight,footYaw=0){
 const [hip,knee,ankle,target,axis,bend,currentBend,desiredKnee,a,b,up,forward]=rig.v,[parent,thigh,shin,foot,desiredThigh,desiredShin,delta,yaw]=rig.q;
 parent.copy(bones[0].quaternion);thigh.copy(parent).multiply(bones[leg.thigh].quaternion);shin.copy(thigh).multiply(bones[leg.shin].quaternion);foot.copy(shin).multiply(bones[leg.foot].quaternion);
 hip.copy(bones[leg.thigh].position).applyQuaternion(parent).add(bones[0].position);knee.copy(bones[leg.shin].position).applyQuaternion(thigh).add(hip);ankle.copy(bones[leg.foot].position).applyQuaternion(shin).add(knee);
 if(footAngle!==null){delta.setFromAxisAngle(up.set(1,0,0),footAngle);yaw.setFromAxisAngle(up.set(0,1,0),footYaw);foot.slerp(delta.premultiply(yaw),weight);}target.copy(ankle).lerp(goal,weight);
 // Bounds of the actual shared boot relative to its ankle. A flat target alone
 // lets the authored toe-down rotation cut through the pitch during recovery.
 const {min,max}=rig.bounds;let sole=Infinity;for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)sole=Math.min(sole,up.set(x?max[0]:min[0],y?max[1]:min[1],z?max[2]:min[2]).applyQuaternion(foot).y);target.y=Math.max(target.y,.012-sole);
 axis.copy(target).sub(hip);const distance=clamp(axis.length(),Math.abs(leg.length1-leg.length2)+.001,leg.length1+leg.length2-.002);axis.normalize();
 const along=(leg.length1*leg.length1-leg.length2*leg.length2+distance*distance)/(2*distance),radius=Math.sqrt(Math.max(0,leg.length1*leg.length1-along*along));
 a.copy(ankle).sub(hip).normalize();currentBend.copy(knee).sub(hip).addScaledVector(a,-b.copy(knee).sub(hip).dot(a));currentBend.addScaledVector(axis,-currentBend.dot(axis)).normalize();forward.set(0,0,1);bend.copy(forward).addScaledVector(axis,-forward.dot(axis)).normalize().lerp(currentBend,1-Math.max(.03,bendWeight)).normalize();desiredKnee.copy(hip).addScaledVector(axis,along).addScaledVector(bend,radius);target.copy(hip).addScaledVector(axis,distance);
 delta.setFromUnitVectors(a.copy(knee).sub(hip).normalize(),b.copy(desiredKnee).sub(hip).normalize());desiredThigh.copy(delta).multiply(thigh);
 delta.setFromUnitVectors(a.copy(ankle).sub(knee).normalize(),b.copy(target).sub(desiredKnee).normalize());desiredShin.copy(delta).multiply(shin);
 bones[leg.thigh].quaternion.copy(parent).invert().multiply(desiredThigh);bones[leg.shin].quaternion.copy(desiredThigh).invert().multiply(desiredShin);
 bones[leg.foot].quaternion.copy(desiredShin).invert().multiply(foot);
}
export function readFootballAnkle(bones,side,out){
 const rig=rigFor(bones);if(!rig)return false;const leg=rig.legs[side],[hip,knee]=rig.v,[root,thigh,shin]=rig.q;root.copy(bones[0].quaternion);thigh.copy(root).multiply(bones[leg.thigh].quaternion);shin.copy(thigh).multiply(bones[leg.shin].quaternion);hip.copy(bones[leg.thigh].position).applyQuaternion(root).add(bones[0].position);knee.copy(bones[leg.shin].position).applyQuaternion(thigh).add(hip);out.copy(bones[leg.foot].position).applyQuaternion(shin).add(knee);return true;
}
export function placeFootballSupportFoot(bones,side,target,weight){const rig=rigFor(bones);if(!rig)return;placeFoot(bones,rig.legs[side],rig,target,null,weight,0);}
export function keepFootballBootsAboveFloor(bones){
 const rig=rigFor(bones);if(!rig)return;const {min,max}=rig.bounds,point=rig.v[10],foot=rig.q[3];
 for(let side=0;side<2;side++){const ankle=rig.goals[side];readFootballAnkle(bones,side,ankle);foot.copy(rig.q[2]).multiply(bones[rig.legs[side].foot].quaternion);let lowest=Infinity;for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)lowest=Math.min(lowest,ankle.y+point.set(x?max[0]:min[0],y?max[1]:min[1],z?max[2]:min[2]).applyQuaternion(foot).y);if(lowest<.001)placeFoot(bones,rig.legs[side],rig,ankle,null,1,0);}
}
// A diving goalkeeper has no planted leg to solve against. Keep the shared
// boots clear by moving only the local pose root, never the simulated player.
export function liftFootballBootsAboveFloor(bones){
 const rig=rigFor(bones);if(!rig)return;const {min,max}=rig.bounds,point=rig.v[10],foot=rig.q[3];let lowest=Infinity;
 for(let side=0;side<2;side++){const ankle=rig.goals[side];readFootballAnkle(bones,side,ankle);foot.copy(rig.q[2]).multiply(bones[rig.legs[side].foot].quaternion);for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)lowest=Math.min(lowest,ankle.y+point.set(x?max[0]:min[0],y?max[1]:min[1],z?max[2]:min[2]).applyQuaternion(foot).y);}
 if(lowest<.008)bones[0].position.y+=.008-lowest;
}
function profileFor(motion){
 if(Object.hasOwn(strokes,motion.stroke))return strokes[motion.stroke];
 if(motion.type!=='pass')return strokes.drive;
 return motion.lofted?strokes.lofted:strokes.short;
}

export function applyFootballShotPreparation(bones,amount,motion={}){
 const rig=rigFor(bones);if(!rig)return false;
 const weight=clamp(amount,0,1);if(weight<=0)return true;
 const profile=profileFor(motion),[plant,kick]=rig.goals;
 bones[0].position.y-=profile.drop*weight;
 bones[0].position.x+=.035*weight;bones[0].rotateY(-profile.turn*.35*weight);
 bones[2].rotateY(-profile.turn*.22*weight);bones[2].rotateX(.09*weight);
 bones[6].rotateX(-profile.arm*.45*weight);bones[6].rotateZ(-.18*weight);
 bones[12].rotateX(profile.arm*.6*weight);bones[12].rotateZ(.22*weight);
 placeFoot(bones,rig.legs[0],rig,plant.set(.16,.083,.13),0,weight);
 placeFoot(bones,rig.legs[1],rig,kick.set(-.17,.13+profile.lift*.35*weight,-.05-profile.load*weight),-.14,weight,weight,-profile.open*.22);
 return true;
}

// The render pose can sample an online stroke after contact. Keep its first
// visible origin stable through interpolation, and invalidate it on replay seeks.
function strokeOrigin(rig,motion,group){
 const stroke=rig.stroke,heading=group?.rotation.y||0,scale=group?.scale.x||1;
 const x=group?.position.x||0,z=group?.position.z||0;
 const ballX=motion.contactX,ballZ=motion.contactZ;
 if(!group||!Number.isFinite(motion.id)||stroke.id!==motion.id||stroke.style!==motion.stroke||
    stroke.ballX!==ballX||stroke.ballZ!==ballZ||motion.elapsed+1e-5<stroke.elapsed||Math.hypot(x-stroke.x,z-stroke.z)>2){
  const dx=ballX-x,dz=ballZ-z,sin=Math.sin(heading),cos=Math.cos(heading);
  const hasContact=!!group&&Number.isFinite(ballX)&&Number.isFinite(ballZ)&&Math.hypot(dx,dz)<1.4*scale;
  stroke.id=motion.id;stroke.style=motion.stroke;stroke.ballX=ballX;stroke.ballZ=ballZ;
  stroke.x=x;stroke.z=z;stroke.heading=heading;
  stroke.side=hasContact&&(dx*cos-dz*sin)/scale>.20?0:1;
  stroke.localX=hasContact?clamp((dx*cos-dz*sin)/scale,-.57,.57):0;
  stroke.localY=hasContact&&Number.isFinite(motion.contactY)?clamp((motion.contactY-group.position.y)/scale,.085,.47):.11;
  stroke.localZ=hasContact?clamp((dx*sin+dz*cos)/scale,-.38,.85):.65;
 }
 stroke.elapsed=motion.elapsed;
 return stroke;
}

function lockedGoal(goal,x,y,z,stroke,group,lock,limit){
 goal.set(x,y,z);
 if(!group||lock<=0)return goal;
 const heading=group.rotation.y,scale=group.scale.x||1,sin=Math.sin(heading),cos=Math.cos(heading);
 const originalSin=Math.sin(stroke.heading),originalCos=Math.cos(stroke.heading);
 const dx=(stroke.x-group.position.x)/scale+x*originalCos+z*originalSin;
 const dz=(stroke.z-group.position.z)/scale-x*originalSin+z*originalCos;
 const offX=dx*cos-dz*sin-x,offZ=dx*sin+dz*cos-z;
 const weight=lock*Math.min(1,limit/Math.max(.001,Math.hypot(offX,offZ)));
 goal.x+=offX*weight;goal.z+=offZ*weight;
 return goal;
}

export function applyFootballKick(bones,motion,progress,group){
 const rig=rigFor(bones);if(!rig)return false;
 const profile=profileFor(motion),t=clamp(progress,0,1),compact=motion.firstTime?.83:1;
 const weight=1-ramp(t,profile.release*compact,1);
 if(weight<=0)return true;
 // Contact is the first authoritative frame. Only the follow-through runs
 // after the ball has left, with no animation event gating the input.
 const stroke=strokeOrigin(rig,motion,group),side=stroke.side,sign=side===0?1:-1,plantSide=1-side;
 const peak=profile.peak*compact,follow=ramp(t,0,peak)*(1-.42*ramp(t,peak,1));
 const power=Number.isFinite(motion.power)?clamp(motion.power,0,1):.55,effort=(.77+power*.42)*compact;
 const reach=Math.max(0,stroke.localZ-.67),bodyTurn=profile.turn*effort*(.24+.76*follow)*weight;
 bones[0].position.y-=(profile.drop+reach*.25)*weight;
 bones[0].position.x+=(-sign*.035+stroke.localX*.17)*weight;
 bones[0].position.z+=(.026+reach*.54)*weight;
 bones[0].rotateY(-sign*bodyTurn*.60);bones[0].rotateZ(sign*.07*weight);
 bones[2].rotateY(-sign*bodyTurn*.40);bones[2].rotateX(profile.lean*(.58+follow*.42)*weight);
 bones[3].rotateZ(sign*.06*weight);
 const leadArm=plantSide===0?6:12,trailArm=side===0?6:12,arm=profile.arm*(.48+.52*follow)*weight*compact;
 bones[leadArm].rotateX(-arm);bones[leadArm].rotateZ(sign*(.11+profile.arm*.27)*weight);
 bones[leadArm+1].rotateX(-arm*.40);bones[trailArm].rotateX(arm*.82);
 bones[trailArm].rotateZ(-sign*(.15+profile.arm*.34)*weight);bones[trailArm+1].rotateX(-arm*.24);
 const [plant,kick]=rig.goals,plantLock=1-ramp(t,profile.release*.65,profile.release+.21);
 const plantX=-sign*.155+stroke.localX*.22,plantZ=clamp(stroke.localZ-.44,-.15,.22);
 const turn=group?clamp(Math.atan2(Math.sin(stroke.heading-group.rotation.y),Math.cos(stroke.heading-group.rotation.y)),-.8,.8):0;
 placeFoot(bones,rig.legs[plantSide],rig,lockedGoal(plant,plantX,.083,plantZ,stroke,group,plantLock,.43),0,weight,.68,turn*plantLock);
 const ankleX=stroke.localX+sign*(.060+.077*profile.open-profile.across*effort*follow);
 const ankleY=stroke.localY-.005+profile.lift*effort*follow;
 // The lace and toe strokes contact further from the ankle than the inside
 // edge of a turned boot. Use that difference before computing follow-through.
 const ankleZ=stroke.localZ-profile.contactBack+profile.reach*effort*follow;
 const impactLock=1-ramp(t,0,peak);
 placeFoot(bones,rig.legs[side],rig,lockedGoal(kick,ankleX,ankleY,ankleZ,stroke,group,impactLock,.32),
  profile.pitch+(.11+profile.reach*.24)*follow,weight,weight,sign*(profile.open+profile.across*.55*follow)+turn*impactLock);
 return true;
}
