import {rayBoxDistance} from './interaction-focus.js';

const CELL=4,copy=p=>({x:p.x,y:p.y,z:p.z});
const cell=(x,y,z)=>[x,y,z].map(n=>Math.floor(n/CELL)).join('|');

// The same seat coordinates drive rendering and selection. Only nearby cells
// are visited; looking at a seat never scans the full stadium every frame.
export function createSeatInteraction(seats=[],{reach=2.6,onSit=()=>{},onStand=()=>{}}={}){
 const cells=new Map();let session=null,inspected=0;
 for(let index=0;index<seats.length;index++){
  const seat=seats[index],key=cell(seat.x,seat.y,seat.z),entries=cells.get(key)||[];
  entries.push({seat,index});cells.set(key,entries);
 }
 function* nearby(origin,range){
  for(let x=Math.floor((origin.x-range)/CELL);x<=Math.floor((origin.x+range)/CELL);x++)for(let y=Math.floor((origin.y-range)/CELL);y<=Math.floor((origin.y+range)/CELL);y++)for(let z=Math.floor((origin.z-range)/CELL);z<=Math.floor((origin.z+range)/CELL);z++)for(const entry of cells.get([x,y,z].join('|'))||[]){inspected++;yield entry;}
 }
 function findNearest(origin){
  inspected=0;if(!origin||![origin.x,origin.y,origin.z].every(Number.isFinite))return null;
  let selected=null,distance=reach;
  for(const entry of nearby(origin,reach)){const seat=entry.seat,target={x:seat.x,y:seat.y+.45,z:seat.z},d=Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z);if(d>distance)continue;selected={id:'seat-'+entry.index,seat,target,distance:d};distance=d;}
  return selected;
 }
 function pick(origin,direction){
  inspected=0;if(!origin||!direction||![origin.x,origin.y,origin.z,direction.x,direction.y,direction.z].every(Number.isFinite))return null;
  const length=Math.hypot(direction.x,direction.y,direction.z);if(length<1e-8)return null;
  const ray={x:direction.x/length,y:direction.y/length,z:direction.z/length},range=reach+.85;let selected=null,nearest=reach;
  for(const entry of nearby(origin,range)){
   const s=entry.seat;if(Math.hypot(s.x-origin.x,s.y+.45-origin.y,s.z-origin.z)>range)continue;
   const c=Math.cos(s.yaw),sn=Math.sin(s.yaw),dx=origin.x-s.x,dz=origin.z-s.z,localOrigin={x:dx*c-dz*sn,y:origin.y-s.y,z:dx*sn+dz*c},localRay={x:ray.x*c-ray.z*sn,y:ray.y,z:ray.x*sn+ray.z*c};
   const distance=rayBoxDistance(localOrigin,localRay,{x0:-.26,x1:.26,y0:.18,y1:.8,z0:-.24,z1:.27});if(distance===null||distance>nearest)continue;
   const extentX=Math.abs(c)*.26+Math.abs(sn)*.27,extentZ=Math.abs(sn)*.26+Math.abs(c)*.27;
   selected={id:'seat-'+entry.index,seat:s,distance,highlight:{x0:s.x-extentX,x1:s.x+extentX,y0:s.y+.18,y1:s.y+.8,z0:s.z-extentZ,z1:s.z+extentZ}};nearest=distance;
  }
  return selected;
 }
 return{pick,nearest:findNearest,get inspected(){return inspected;},get count(){return seats.length;},get session(){return session;},
  sit(selection,standingPosition){
   if(session||!selection?.seat||!standingPosition)return null;
   const seat=selection.seat;session={id:selection.id,seat,standingPosition:copy(standingPosition),eyePosition:{x:seat.x,y:seat.y+.98,z:seat.z},feet:seat.y-.19,yaw:seat.yaw,standingEyeHeight:1.7};onSit(session);return session;
  },
  stand(){if(!session)return false;const previous=session;session=null;onStand(previous);return true;}
 };
}
