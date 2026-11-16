const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const approach=[
 [0,0,.35],
 [.27,.22,1.23],
 [.66,.76,1.12],
 [.84,.94,.48],
 [1,1,.31]
];

function strideAt(time){
 const index=approach.findIndex((point,index)=>index>0&&time<=point[0]);
 const [at,from,startSpeed]=approach[index-1],[end,to,endSpeed]=approach[index];
 const span=end-at,t=(time-at)/span,u=1-t;
 return (1+2*t)*u*u*from+t*u*u*span*startSpeed+t*t*(3-2*t)*to+t*t*(t-1)*span*endSpeed;
}

export function samplePenaltyApproach(motion,elapsed,out={}){
 const {runup,startX,startZ,strikeX,strikeZ,contactZ}=motion;
 const time=clamp(elapsed/runup,0,1),distance=strideAt(time);
 const direction=Math.sign(contactZ-strikeZ);
 const axis=direction<0?Math.PI:0;
 const angle=Math.atan2(strikeX-startX,strikeZ-startZ);
 const turn=Math.atan2(Math.sin(axis-angle),Math.cos(axis-angle));
 out.x=startX+(strikeX-startX)*distance;
 out.z=startZ+(strikeZ-startZ)*distance;
 out.yaw=angle+turn*ease((time-.50)/.33);
 // Continue briefly over the planted foot so the finish carries the same
 // forward momentum, then settle within one recovery step of the spot.
 const after=clamp((elapsed-runup)/.48,0,1);
 if(after>0)out.z+=direction*.22*(2-after)*after;
 return out;
}
