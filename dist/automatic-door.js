import {orientedCollider} from './access-layout.js';

const TRAVEL=2.35,OFFSET=.16;
export function doorCollider(x,z,y,opening=0,owner){
 const collider=orientedCollider(x+OFFSET,z-TRAVEL*opening,.07,2.3,y,y+2.9,0,owner);
 collider.dynamicDoor=true;return collider;
}
function penetration(position,collider){
 if(position.y<=collider.y0+.2||position.y-1.7>=collider.y1)return-Infinity;
 const dx=position.x-collider.cx,dz=position.z-collider.cz,c=Math.cos(collider.yaw),s=Math.sin(collider.yaw);
 return Math.min(collider.halfW-Math.abs(dx*c-dz*s),collider.halfD-Math.abs(dx*s+dz*c));
}
export function updateAutomaticDoor(door,position,dt){
 const atFloor=position.y>door.y+.2&&position.y-1.7<door.y+2.9;
 const near=atFloor&&Math.hypot(position.x-door.x,position.z-door.z)<3.3;
 // A wide swinging leaf would block either the press-room aisle or the
 // connected corridor. A tracked automatic door retracts along the wall.
 door.target=door.hold||near?1:0;
 if(Math.abs(door.target-door.opening)<.00001)return;
 const desired=door.target+(door.opening-door.target)*Math.exp(-9*Math.max(0,dt)),steps=Math.max(1,Math.ceil(Math.abs(desired-door.opening)*TRAVEL/.06)),stride=(desired-door.opening)/steps;
 let opening=door.opening,depth=penetration(position,door.collider);
 for(let i=0;i<steps;i++){
  const next=opening+stride,candidate=doorCollider(door.x,door.z,door.y,next,door.id),nextDepth=penetration(position,candidate);
  // Check the swept leaf, including low-frame-rate updates. Never slide a
  // solid panel into the body; an existing overlap may always escape.
  if(nextDepth>0&&nextDepth>Math.max(0,depth)+.00001)break;
  opening=next;depth=nextDepth;
 }
 door.opening=opening<.0001?0:opening;door.hinge.position.set(door.x+OFFSET,door.y,door.z-1.15-TRAVEL*door.opening);
 Object.assign(door.collider,doorCollider(door.x,door.z,door.y,door.opening,door.id));
}
