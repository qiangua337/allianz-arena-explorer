export const ACCESS_BASE=-2.9;
export const ACCESS_TOP=12.2;
export const ACCESS_STEPS=84;
export const ACCESS_RUN=31.08;
export const ACCESS_WIDTH=5.8;
const TAU=Math.PI*2;
export function perimeterPoint(a,b,t,n=2.8){const c=Math.cos(t),s=Math.sin(t);return{x:a*Math.sign(c)*Math.abs(c)**(2/n),z:b*Math.sign(s)*Math.abs(s)**(2/n)};}
export function perimeterNormal(a,b,t,n=2.8){const p=perimeterPoint(a,b,t-.0001,n),q=perimeterPoint(a,b,t+.0001,n),x=q.z-p.z,z=p.x-q.x,d=Math.hypot(x,z);return{x:x/d,z:z/d};}
export function perimeterFrames(a,b,count,n=2.8,offset=.5){
 const samples=[{t:0,d:0}];let last=perimeterPoint(a,b,0,n),length=0;
 for(let i=1;i<=4096;i++){const t=i/4096*TAU,p=perimeterPoint(a,b,t,n);length+=Math.hypot(p.x-last.x,p.z-last.z);samples.push({t,d:length});last=p;}
 return Array.from({length:count},(_,i)=>{const d=(i+offset)/count*length;let lo=0,hi=samples.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(samples[m].d<d)lo=m;else hi=m;}const t=samples[lo].t+(samples[hi].t-samples[lo].t)*(d-samples[lo].d)/(samples[hi].d-samples[lo].d),p=perimeterPoint(a,b,t,n),normal=perimeterNormal(a,b,t,n);return{...p,t,normal,yaw:Math.atan2(normal.x,normal.z),spacing:length/count,index:i};});
}
export const accessStairs=Array.from({length:8},(_,i)=>{
 const t=(i+.5)/8*TAU,p=perimeterPoint(96,113,t),normal=perimeterNormal(96,113,t);
 return{id:'T'+(i+1),t,topX:p.x,topZ:p.z,x:p.x+normal.x*ACCESS_RUN,z:p.z+normal.z*ACCESS_RUN,nx:normal.x,nz:normal.z,yaw:Math.atan2(normal.x,normal.z),run:ACCESS_RUN,width:ACCESS_WIDTH,steps:ACCESS_STEPS,rise:(ACCESS_TOP-ACCESS_BASE)/ACCESS_STEPS};
});
export function stairCoordinates(stair,x,z){const dx=x-stair.x,dz=z-stair.z;return{along:-(dx*stair.nx+dz*stair.nz),side:dx*stair.nz-dz*stair.nx};}
export function accessAt(x,z,margin=0){for(const stair of accessStairs){const p=stairCoordinates(stair,x,z);if(Math.abs(p.side)<stair.width/2+margin&&p.along>=-.2&&p.along<=stair.run+2)return{stair,...p};}return null;}
export function accessHeight(x,z){const hit=accessAt(x,z);if(!hit)return null;return Math.min(ACCESS_TOP,ACCESS_BASE+Math.max(0,Math.floor(hit.along/(hit.stair.run/hit.stair.steps))+1)*hit.stair.rise);}
export function stairwellAt(x,z,level){const hit=accessAt(x,z,.55);if(!hit)return false;const floor=ACCESS_BASE+hit.along/ACCESS_RUN*(ACCESS_TOP-ACCESS_BASE);return hit.along<ACCESS_RUN-.45&&floor>level-3.3;}
export function facadeOpening(x,y,z){const hit=accessAt(x,z,1.05);if(!hit)return false;const floor=ACCESS_BASE+hit.along/ACCESS_RUN*(ACCESS_TOP-ACCESS_BASE);return y>floor-.8&&y<floor+4.0;}

export function orientedCollider(x,z,w,d,y0,y1,yaw=0,owner='arcade'){
 return{cx:x,cz:z,halfW:w/2+.24,halfD:d/2+.24,yaw,y0,y1,owner};
}
