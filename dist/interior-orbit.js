import {roomSpecs} from './building-layout.js';
import {pressLayout,pressFloorRise} from './facility-layout.js';

const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
const sameRoom=(a,b)=>['x','y','z','w','d'].every(k=>a[k]===b[k]);

// Pure geometry: no camera/controls mutation and no browser dependency.
// A .65 m wall margin clears the framed tactical boards as well as camera.near.
// Furniture is deliberately not treated as part of the room envelope.
export function constrainInteriorOrbit(cameraPosition,orbitTarget,spec,options={}){
 const roomId=options.roomId||spec.id||Object.keys(roomSpecs).find(id=>sameRoom(spec,roomSpecs[id]));
 const ceilingHeight=options.ceilingHeight??(roomId==='lounge'?3.725:4.5);
 const margin=Math.min(.65,spec.w/4,spec.d/4),targetMargin=Math.min(margin+.35,spec.w/2-.1,spec.d/2-.1);
 const low={x:spec.x-spec.w/2+margin,y:spec.y+.65,z:spec.z-spec.d/2+margin};
 const high={x:spec.x+spec.w/2-margin,y:spec.y+ceilingHeight-.4,z:spec.z+spec.d/2-margin};
 const floorAt=z=>spec.y+(roomId==='press'?pressFloorRise(z-spec.z):0);
 const originalTarget={x:finite(orbitTarget?.x,spec.x),y:finite(orbitTarget?.y,spec.y+1.7),z:finite(orbitTarget?.z,spec.z)};
 const target={x:clamp(originalTarget.x,spec.x-spec.w/2+targetMargin,spec.x+spec.w/2-targetMargin),y:0,z:clamp(originalTarget.z,spec.z-spec.d/2+targetMargin,spec.z+spec.d/2-targetMargin)};
 target.y=clamp(originalTarget.y,floorAt(target.z)+.95,spec.y+ceilingHeight-.75);
 // Translate the requested camera with a clamped pan, retaining the user's
 // orbit angle and zoom rather than changing which direction they are viewing.
 const ray={x:finite(cameraPosition?.x,originalTarget.x+2)-originalTarget.x,y:finite(cameraPosition?.y,originalTarget.y+.2)-originalTarget.y,z:finite(cameraPosition?.z,originalTarget.z+2)-originalTarget.z};
 let length=Math.hypot(ray.x,ray.y,ray.z);
 if(length<1e-8){ray.x=0;ray.y=0;ray.z=.25;length=.25;}
 if(length<.25)for(const axis of ['x','y','z'])ray[axis]*=.25/length;
 let limit=1;
 for(const axis of ['x','y','z']){
  if(ray[axis]>1e-10)limit=Math.min(limit,(high[axis]-target[axis])/ray[axis]);
  else if(ray[axis]<-1e-10)limit=Math.min(limit,(low[axis]-target[axis])/ray[axis]);
 }
 limit=clamp(limit,0,1);
 if(roomId==='press'){
  // Each real audience tread is a separate floor. Stop at the first raised
  // tread/descending-eye intersection, rather than raising the camera off ray.
  const cuts=[0,limit];
  if(Math.abs(ray.z)>1e-10)for(let row=0;row<=pressLayout.rows;row++){
   const z=spec.z+pressLayout.firstZ-pressLayout.rowDepth/2+row*pressLayout.rowDepth,t=(z-target.z)/ray.z;
   if(t>0&&t<limit)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
   const start=cuts[i],end=cuts[i+1],floor=floorAt(target.z+ray.z*(start+end)/2)+.65;
   if(target.y+ray.y*start<floor-1e-9){limit=Math.max(0,start-1e-6);break;}
   if(ray.y<0){const crossing=(floor-target.y)/ray.y;if(crossing>=start&&crossing<end){limit=Math.max(0,crossing-1e-6);break;}}
  }
  // A requested zoom endpoint can land exactly on the next, higher tread.
  if(target.y+ray.y*limit<floorAt(target.z+ray.z*limit)+.65-1e-9)limit=Math.max(0,limit-1e-6);
 }
 const position={x:target.x+ray.x*limit,y:target.y+ray.y*limit,z:target.z+ray.z*limit};
 return{position,target};
}
