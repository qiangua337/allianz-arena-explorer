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

// Fixed world-space landing points keep contact independent of pose cadence.
// The next foot reaches ahead while the weight-bearing shoe stays on the turf.
function step(t,from,to,start,end,lift){
 const progress=between(t,start,end),travel=ease(progress);
 target.set(blend(from.x,to.x,travel),.089+lift*stepLift(progress),blend(from.z,to.z,travel));
 return .11*Math.sin(Math.PI*2*progress);
}

export function applyFootballPenaltyKick(bones,motion,group){
 const {elapsed,runup,duration}=motion;
 if(!(runup>0&&duration>runup))return;
 const progress=clamp01(elapsed/runup),after=Math.max(0,elapsed-runup),recovery=duration-runup;
 const weight=rise(progress,0,.10)*(1-rise(after,.26,recovery));
 if(weight<.00001)return;
 const side=motion.side===0?0:1,lateral=side===0?1:-1,plantSide=1-side;
 const direction=Math.sign(motion.contactZ-motion.strikeZ)||1;
 const scale=group.scale.x||1,power=Number.isFinite(motion.power)?clamp01(motion.power):.55;
 const supportX=-lateral*.19*scale*direction,shootX=lateral*.18*scale*direction;
 const contactX=motion.contactX+lateral*.012*scale*direction;
 const contactY=(motion.contactY-group.position.y)/scale+.007;
 // The front of the boot meets the back of the ball at its release point.
 const contactZ=motion.contactZ-(.11+.205*scale)*direction;
 const plantLoad=rise(progress,.65,.88)*(1-rise(after,.09,.34));
 const turn=(rise(progress,.68,.91)*(1-rise(progress,.91,1))*.25-rise(after,0,.17)*.34)*lateral;
 const swing=Math.sin(Math.PI*4*rise(progress,.08,.83))*(1-plantLoad);
 const finishLoad=rise(after,0,.18)*(1-rise(after,.18,recovery)),brake=rise(progress,.62,.86);

 bones[0].position.y-=(.058+.082*plantLoad+.02*Math.sin(Math.PI*3*progress)**2)*weight;
 bones[0].position.x+=(-lateral*.046*plantLoad)*weight;
 bones[0].position.z+=(.026*brake+.055*finishLoad)*weight;
 bones[0].rotateY(turn*.55*weight);
 bones[0].rotateZ(-lateral*.08*plantLoad*weight);
 bones[1].rotateX((.09+.10*(1-brake)+.14*finishLoad)*weight);
 bones[2].rotateY((turn*.45+swing*.10)*weight);
 bones[2].rotateX((.035+.055*brake)*weight);
 bones[3].rotateZ(lateral*.07*plantLoad*weight);
 bones[4].rotateX(.13*weight*(1-rise(after,.25,.52)));
 const lead=plantSide===0?6:12,trail=side===0?6:12;
 bones[lead].rotateX((-.29*swing-.20*plantLoad-.16*finishLoad)*weight);
 bones[lead].rotateZ(lateral*(.12+.44*plantLoad+.22*finishLoad)*weight);
 bones[lead+1].rotateX((-.37+.13*plantLoad)*weight);
 bones[trail].rotateX((.29*swing+.26*plantLoad-.17*finishLoad)*weight);
 bones[trail].rotateZ(-lateral*(.13+.29*plantLoad+.24*finishLoad)*weight);
 bones[trail+1].rotateX((-.32+.13*plantLoad)*weight);

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
  pitch=step(after,from,to,.29,.54,.075);
 }
 place(plantSide,pitch,-lateral*.08);

 const middle=anchor(from,.56,shootX,.22);
 if(progress<.78){
  anchor(to,0,shootX,.09);pitch=step(progress,to,middle,.25,.56,.17);
 }else if(progress<.90){
  anchor(to,.90,shootX,-.27);
  const index=rise(progress,.78,.90);
  target.set(blend(middle.x,to.x,index),.089+.23*index,blend(middle.z,to.z,index));
  pitch=-.35*index;
 }else if(elapsed<=runup){
  anchor(to,.90,shootX,-.27);
  const index=rise(progress,.90,1);
  target.set(blend(to.x,contactX,index),blend(.319,contactY,index),blend(to.z,contactZ,index));
  pitch=blend(-.35,.09,index);
 }else{
  samplePenaltyApproach(motion,duration,finish);
  const up=rise(after,0,.16),relax=rise(after,.16,.43),effort=.84+.26*power;
  const swingX=contactX-lateral*.21*scale*direction*effort;
  const swingZ=contactZ+.47*scale*direction*effort;
  target.set(blend(blend(contactX,swingX,up),finish.x+shootX,relax),
   blend(blend(contactY,contactY+.33*effort,up),.089,relax)+.045*stepLift(between(after,.16,.43)),
   blend(blend(contactZ,swingZ,up),finish.z+.11*scale*direction,relax));
  pitch=(.09+.23*up)*(1-relax);
 }
 place(side,pitch,lateral*.045);
 keepFootballBootsAboveFloor(bones);
}
