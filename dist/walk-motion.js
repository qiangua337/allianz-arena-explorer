import {floorHeight,MAX_STEP,EYE_HEIGHT,canStandAt} from './navigation.js';
import {core,coreLevels,roomSpecs,upperGalleryRooms,upperThresholdLanding} from './building-layout.js';
import {inVisitorPassage,visitorPassage} from './tour-route.js';

const upperGallery=Object.values(upperGalleryRooms);

export function inTightWalkSpace(x,y,z){
 if(y>=visitorPassage.base-.2&&y<.4&&inVisitorPassage(x,z))return true;
 const museum=roomSpecs.museum;
 if(Math.abs(y-museum.y)<.45&&Math.abs(x-(museum.x+museum.w/2))<2.4&&Math.abs(z-museum.z)<1.5)return true;
 if(y<coreLevels[0]-.2||y>coreLevels.at(-1)+.4)return false;
 if(x>core.minX&&x<core.maxX&&z>core.front-1&&z<10)return true;
 if(y<upperThresholdLanding.y-1.7)return false;
 if(x>=upperThresholdLanding.x0-2&&x<=upperGalleryRooms.bridge.maxX&&z>=upperThresholdLanding.z0&&z<=upperThresholdLanding.z1+.8)return true;
 return upperGallery.some(room=>x>=room.minX&&x<=room.maxX&&z>=room.minZ&&z<=room.maxZ);
}

export function walkSpeed(running,touching,x,feet,z){
 return running?touching&&inTightWalkSpace(x,feet,z)?6:10:4.5;
}

// A newly sampled touch direction cannot account for the whole time spent
// blocked in a slow draw. Limit catch-up to one short movement interval.
export function walkMotionSeconds(delta,touching){
 return Math.min(delta,touching?1/12:.25);
}

// Physical floor height advances at every short movement step. Camera easing
// must not determine which storey a visitor can stand on during a slow frame.
export function advanceWalker(position,feet,dx,dz,geometry,blocked){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22)),sx=dx/steps,sz=dz/steps;
 const tryStep=(x,z)=>{
  if(x===position.x&&z===position.z)return;
  const height=floorHeight(x,z,feet,geometry);
  if(!Number.isFinite(height)||Math.abs(height-feet)>MAX_STEP+.001||
     blocked(x,z,height+EYE_HEIGHT)||!canStandAt(x,z,height,geometry))return;
  position.x=x;position.z=z;feet=height;
 };
 for(let i=0;i<steps;i++){
  const x=Math.max(-600,Math.min(700,position.x+sx)),z=Math.max(-650,Math.min(850,position.z+sz));
  tryStep(x,position.z);
  tryStep(position.x,z);
 }
 return feet;
}
