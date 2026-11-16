const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const approach=[
 [0,0,.35],
 [.27,.22,1.23],
 [.66,.76,1.12],
 [.84,.94,.48],
 [1,1,.31]
];

function strideAt(time,settledStart){
 const index=approach.findIndex((point,index)=>index>0&&time<=point[0]);
 const [at,from,speed]=approach[index-1],[end,to,endSpeed]=approach[index];
 const startSpeed=settledStart&&index===1?0:speed;
 const span=end-at,t=(time-at)/span,u=1-t;
 return (1+2*t)*u*u*from+t*u*u*span*startSpeed+t*t*(3-2*t)*to+t*t*(t-1)*span*endSpeed;
}

export function samplePenaltyApproach(motion,elapsed,out={}){
 const {runup,startX,startZ,strikeX,strikeZ,contactZ,entryYaw}=motion;
 const settledStart=Number.isFinite(entryYaw);
 const time=clamp(elapsed/runup,0,1),distance=strideAt(time,settledStart);
 const dx=strikeX-startX,dz=strikeZ-startZ;
 const direction=Math.sign(contactZ-strikeZ);
 const axis=direction<0?Math.PI:0;
 const angle=Math.atan2(dx,dz);
 const heading=settledStart?entryYaw+angleDelta(entryYaw,angle)*ease(time/.34):angle;
 out.x=startX+dx*distance;
 out.z=startZ+dz*distance;
 out.yaw=heading+angleDelta(heading,axis)*ease((time-.50)/.33);
 const after=clamp((elapsed-runup)/.48,0,1);
 if(after>0){
  if(settledStart){
   // Integrate the terminal stride speed over a linear deceleration.
   // The hips carry forward past contact along the same travel vector.
   const travel=.48*.31/runup*after*(1-after*.5);
   out.x+=dx*travel;
   out.z+=dz*travel;
  }else out.z+=direction*.22*(2-after)*after;
 }
 return out;
}
