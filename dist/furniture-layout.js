import {roomSpecs} from './building-layout.js';

// Shared body clearance for furniture and route planning, in world metres.
export const furniture=[];
function add(owner,x,z,w,d,height,yOffset=0){const s=roomSpecs[owner];furniture.push({owner,x:s.x+x,z:s.z+z,w,d,y0:s.y+yOffset,y1:s.y+yOffset+height});}
for(const owner of ['homeRoom','guestRoom']){
 add(owner,0,0,7.2,2.7,1.15);add(owner,4.8,4.9,2.6,.9,1.1);add(owner,4.8,-6,2.1,.9,1.15);
}
for(let i=0;i<8;i++)add('museum',i%2?3.7:-3.7,-8+Math.floor(i/2)*5.3,1.75,1.75,3);
for(let row=0;row<3;row++)for(let side=0;side<2;side++)add('store',-7+side*13,-3+row*3.1,4.3,.65,2.6);
add('store',2,5,5.5,1.6,1.8);
for(let row=0;row<6;row++)for(let col=0;col<8;col++)add('press',-7.4+col*2.1+(col>3?.5:0),-1+row*1.28,1.02,.75,1.4,row*.14);
add('press',0,-5.4,15,1.25,1.4);

export function furnitureBlocksSegment(a,b,owner,clearance=.24){
 return furniture.some(o=>{if(o.owner!==owner)return false;let min=0,max=1;for(const axis of ['x','z']){const half=(axis==='x'?o.w:o.d)/2+clearance,delta=b[axis]-a[axis],low=o[axis]-half,high=o[axis]+half;if(Math.abs(delta)<1e-8){if(a[axis]<=low||a[axis]>=high)return false;}else{let t0=(low-a[axis])/delta,t1=(high-a[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];min=Math.max(min,t0);max=Math.min(max,t1);if(min>=max)return false;}}return min<max;});
}
