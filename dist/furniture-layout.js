import {roomSpecs} from './building-layout.js';

// Shared body clearance for furniture and route planning, in world metres.
export const furniture=[],changingLockers={};
function add(owner,x,z,w,d,height,yOffset=0){const s=roomSpecs[owner];furniture.push({owner,x:s.x+x,z:s.z+z,w,d,y0:s.y+yOffset,y1:s.y+yOffset+height});}
for(const owner of ['homeRoom','guestRoom']){
 add(owner,0,0,7.2,2.7,1.15);add(owner,4.8,4.9,2.6,.9,1.1);add(owner,4.8,-6,2.1,.9,1.15);
 const s=roomSpecs[owner],layout=[];for(let i=0;i<12;i++)layout.push({x:-s.w/2+.62,z:-7.2+i*1.23,yaw:Math.PI/2});for(const side of[-1,1])for(let i=0;i<11;i++){const x=-7.1+i*1.23;if(owner==='guestRoom'&&side>0&&Math.abs(x)<1.8)continue;layout.push({x,z:side*(s.d/2-.61),yaw:side<0?0:Math.PI});}
 changingLockers[owner]=layout;for(const locker of layout){const rotated=Math.abs(Math.sin(locker.yaw))>.5;add(owner,locker.x+Math.sin(locker.yaw)*.1,locker.z+Math.cos(locker.yaw)*.1,rotated?1.02:1.16,rotated?1.16:1.02,3.31);}
}
for(let i=0;i<8;i++)add('museum',i%2?3.7:-3.7,-8+Math.floor(i/2)*5.3,1.75,1.75,3);
for(let row=0;row<3;row++)for(let side=0;side<2;side++)add('store',-7+side*13,-3+row*3.1,4.3,.65,2.6);
add('store',2,5,5.5,1.6,1.8);
export const pressSeats=Array.from({length:84},(_,i)=>{const row=Math.floor(i/14),col=i%14;return{x:(col<7?-1:1)*(1.15+(col%7)*1.1),z:-1+row*1.28,y:row*.14,width:.58};});
for(const seat of pressSeats)add('press',seat.x,seat.z,.72,.74,1.3,seat.y);
add('press',0,-5.4,15,1.25,1.4);

export function furnitureBlocksSegment(a,b,owner,clearance=.24){
 return furniture.some(o=>{if(o.owner!==owner)return false;let min=0,max=1;for(const axis of ['x','z']){const half=(axis==='x'?o.w:o.d)/2+clearance,delta=b[axis]-a[axis],low=o[axis]-half,high=o[axis]+half;if(Math.abs(delta)<1e-8){if(a[axis]<=low||a[axis]>=high)return false;}else{let t0=(low-a[axis])/delta,t1=(high-a[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];min=Math.max(min,t0);max=Math.min(max,t1);if(min>=max)return false;}}return min<max;});
}
