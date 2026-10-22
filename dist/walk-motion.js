import {floorHeight,MAX_STEP,EYE_HEIGHT} from './navigation.js';

// Physical floor height advances at every short movement step. Camera easing
// must not determine which storey a visitor can stand on during a slow frame.
export function advanceWalker(position,feet,dx,dz,geometry,blocked){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22)),sx=dx/steps,sz=dz/steps;
 for(let i=0;i<steps;i++){
  const x=Math.max(-600,Math.min(700,position.x+sx)),z=Math.max(-650,Math.min(850,position.z+sz));
  let height=floorHeight(x,position.z,feet,geometry);
  if(!blocked(x,position.z,feet+EYE_HEIGHT)&&height<=feet+MAX_STEP+.001){position.x=x;feet=height;}
  height=floorHeight(position.x,z,feet,geometry);
  if(!blocked(position.x,z,feet+EYE_HEIGHT)&&height<=feet+MAX_STEP+.001){position.z=z;feet=height;}
 }
 return floorHeight(position.x,position.z,feet,geometry);
}
