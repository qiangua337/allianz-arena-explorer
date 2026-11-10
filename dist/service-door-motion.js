import {serviceCoordinates,serviceWorld} from './service-layout.js';

// The collider includes the same body clearance as every other walk obstacle.
// Check the whole rotating leaf, not only its final pose after a slow frame.
function depthAt(leaf,position,angle){
 const rotation=-leaf.side*angle,c=Math.cos(rotation),s=Math.sin(rotation),dx=position.side-(leaf.side*1.88-leaf.side*.93*c),dz=-position.depth-leaf.side*.93*s;
 return Math.min(leaf.collider.halfW-Math.abs(dx*c-dz*s),leaf.collider.halfD-Math.abs(dx*s+dz*c));
}
function applyAngle(door,angle){
 door.angle=angle;
 for(const leaf of door.leaves){const rotation=-leaf.side*angle,x=leaf.side*1.88-leaf.side*.93*Math.cos(rotation),z=leaf.side*.93*Math.sin(rotation),world=serviceWorld(door,x,z);leaf.hinge.rotation.y=rotation;leaf.collider.cx=world.x;leaf.collider.cz=world.z;leaf.collider.yaw=door.yaw+rotation;}
}
export function updateServiceDoor(door,position,dt){
 const local=serviceCoordinates(door,position.x,position.z),atFloor=position.y>door.y+.2&&position.y-1.7<door.y+3.23;
 door.target=door.open?Math.PI*.48:0;
 if(!door.open&&atFloor&&Math.abs(local.side)<1.9&&Math.abs(local.depth)<1.1)door.target=Math.max(door.angle,Math.PI*.48);
 if(Math.abs(door.angle-door.target)<.00001)return;
 const desired=door.target+(door.angle-door.target)*Math.exp(-10*Math.max(0,dt));
 if(!atFloor||Math.hypot(local.side,local.depth)>4.7){applyAngle(door,desired);return;}
 const steps=Math.max(1,Math.ceil(Math.abs(desired-door.angle)*2.2/.045)),stride=(desired-door.angle)/steps;
 let angle=door.angle,depths=door.leaves.map(leaf=>depthAt(leaf,local,angle));
 for(let i=0;i<steps;i++){
  const next=angle+stride,nextDepths=door.leaves.map(leaf=>depthAt(leaf,local,next));
  // Someone already touching a leaf may move out; it cannot deepen overlap.
  if(nextDepths.some((depth,j)=>depth>0&&depth>Math.max(0,depths[j])+.00001))break;
  angle=next;depths=nextDepths;
 }
 applyAngle(door,angle);
}
