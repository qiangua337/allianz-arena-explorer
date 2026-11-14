import {floorHeight,MAX_STEP,EYE_HEIGHT,canStandAt} from './navigation.js';
import {core,coreLevels,upperGalleryRooms,upperThresholdLanding} from './building-layout.js';

const upperGallery=Object.values(upperGalleryRooms);

export function inTightWalkSpace(x,y,z){
 if(y<coreLevels[0]-.2||y>coreLevels.at(-1)+.4)return false;
 if(x>core.minX&&x<core.maxX&&z>core.front-1&&z<10)return true;
 if(y<upperThresholdLanding.y-1.7)return false;
 if(x>=upperThresholdLanding.x0-2&&x<=upperGalleryRooms.bridge.maxX&&z>=upperThresholdLanding.z0&&z<=upperThresholdLanding.z1+.8)return true;
 return upperGallery.some(room=>x>=room.minX&&x<=room.maxX&&z>=room.minZ&&z<=room.maxZ);
}

export function walkSpeed(running,touching,x,feet,z){
 return running?touching&&inTightWalkSpace(x,feet,z)?6:10:4.5;
}

// Physical floor height advances at every short movement step. Camera easing
// must not determine which storey a visitor can stand on during a slow frame.
export function advanceWalker(position,feet,dx,dz,geometry,blocked){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22)),sx=dx/steps,sz=dz/steps;
 for(let i=0;i<steps;i++){
  const x=Math.max(-600,Math.min(700,position.x+sx)),z=Math.max(-650,Math.min(850,position.z+sz));
  let height=floorHeight(x,position.z,feet,geometry);
  if(Number.isFinite(height)&&Math.abs(height-feet)<=MAX_STEP+.001&&canStandAt(x,position.z,height,geometry)&&!blocked(x,position.z,feet+EYE_HEIGHT)){position.x=x;feet=height;}
  height=floorHeight(position.x,z,feet,geometry);
  if(Number.isFinite(height)&&Math.abs(height-feet)<=MAX_STEP+.001&&canStandAt(position.x,z,height,geometry)&&!blocked(position.x,z,feet+EYE_HEIGHT)){position.z=z;feet=height;}
 }
 return floorHeight(position.x,position.z,feet,geometry);
}
