import {THREE} from './kit.js';
const rigs=new WeakMap(),bootBounds=new WeakMap(),defaultBounds={min:[-.054,-.075,-.105],max:[.054,.065,.205]},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
export function setFootballBootBounds(bones,bounds){if(bounds?.min?.length===3&&bounds?.max?.length===3&&[...bounds.min,...bounds.max].every(Number.isFinite))bootBounds.set(bones,bounds);}
function rigFor(bones){
 let rig=rigs.get(bones);if(rig)return rig;
 const legs=[[9,10,11],[15,16,17]].map(([thigh,shin,foot])=>({thigh,shin,foot,length1:bones[shin].position.length(),length2:bones[foot].position.length()}));
 if(legs.some(l=>l.length1<.1||l.length2<.1))return null;
 const goals=[new THREE.Vector3(),new THREE.Vector3()];rig={legs,bounds:bootBounds.get(bones)||defaultBounds,goals,readGoal:goals.map(goal=>(hip,target)=>target.copy(goal)),v:Array.from({length:12},()=>new THREE.Vector3()),q:Array.from({length:7},()=>new THREE.Quaternion())};rigs.set(bones,rig);return rig;
}
// Solve in the actor's local coordinates before its one skeleton propagation.
// Keeping the old segment twist avoids a knee snap as the stroke recovers.
function placeFoot(bones,leg,rig,goal,footAngle,weight,bendWeight=weight){
 const [hip,knee,ankle,target,axis,bend,currentBend,desiredKnee,a,b,up,forward]=rig.v,[parent,thigh,shin,foot,desiredThigh,desiredShin,delta]=rig.q;
 parent.copy(bones[0].quaternion);thigh.copy(parent).multiply(bones[leg.thigh].quaternion);shin.copy(thigh).multiply(bones[leg.shin].quaternion);foot.copy(shin).multiply(bones[leg.foot].quaternion);
 hip.copy(bones[leg.thigh].position).applyQuaternion(parent).add(bones[0].position);knee.copy(bones[leg.shin].position).applyQuaternion(thigh).add(hip);ankle.copy(bones[leg.foot].position).applyQuaternion(shin).add(knee);
 if(footAngle!==null){delta.setFromAxisAngle(up.set(1,0,0),footAngle);foot.slerp(delta,weight);}target.copy(ankle).lerp(goal(hip,forward),weight);
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
export function placeFootballSupportFoot(bones,side,target,weight){const rig=rigFor(bones);if(!rig)return;rig.goals[side].copy(target);placeFoot(bones,rig.legs[side],rig,rig.readGoal[side],null,weight,0);}
export function keepFootballBootsAboveFloor(bones){
 const rig=rigFor(bones);if(!rig)return;const {min,max}=rig.bounds,point=rig.v[10],foot=rig.q[3];
 for(let side=0;side<2;side++){const ankle=rig.goals[side];readFootballAnkle(bones,side,ankle);foot.copy(rig.q[2]).multiply(bones[rig.legs[side].foot].quaternion);let lowest=Infinity;for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)lowest=Math.min(lowest,ankle.y+point.set(x?max[0]:min[0],y?max[1]:min[1],z?max[2]:min[2]).applyQuaternion(foot).y);if(lowest<.001)placeFoot(bones,rig.legs[side],rig,rig.readGoal[side],null,1,0);}
}
export function applyFootballShotPreparation(bones,amount){
 const rig=rigFor(bones);if(!rig)return false;const weight=clamp(amount,0,1);if(weight<=0)return true;bones[0].position.y-=.10*weight;
 placeFoot(bones,rig.legs[0],rig,(hip,target)=>target.set(hip.x+.025,.085,hip.z+.12),0,weight);
 placeFoot(bones,rig.legs[1],rig,(hip,target)=>target.set(hip.x-.015,.15+.10*weight,-.24-.10*weight),-.10,weight);return true;
}
export function applyFootballKick(bones,kind,progress){
 const rig=rigFor(bones);if(!rig)return false;
 const t=clamp(progress,0,1),weight=1-smooth(clamp((t-.20)/.80,0,1)),follow=smooth(clamp(t/.22,0,1)),shot=kind==='shoot';if(weight<=0)return true;
 // Simulation releases the ball at elapsed=0. Start at contact, rather than
 // wind up after the ball has already travelled several metres.
 bones[0].position.y-=(shot?.10:.085)*weight;
 placeFoot(bones,rig.legs[0],rig,(hip,target)=>target.set(hip.x+.025,.085,hip.z+.12),0,weight);
 placeFoot(bones,rig.legs[1],rig,(hip,target)=>target.set(hip.x-.015,.105+(shot?.19:.12)*follow,(shot?.50:.46)+(shot?.16:.10)*follow),.035+.12*follow,weight);
 bones[6].rotateZ(-.12*weight);bones[12].rotateZ(.15*weight);bones[2].rotateX(.06*weight);return true;
}
