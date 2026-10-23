import {entranceTravel,entranceTravelTime} from './matchday-route.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const goals=[[5,-8],[-6,8],[8,13],[20,-12],[-19,-9],[0,-42]];
// NPCs use their own clock and pitch positions. Visitor/camera coordinates are
// deliberately absent: stopping, reversing or strafing cannot drag the queue.
export function sampleQueuePlayer(seconds,index){
 const row=Math.floor(index/2),lane=index%2?.72:-.72,start=-58.2+row*2.35,hold=4+(2-row)*.17+(index%2)*.07,speed=1.29,walk=Math.max(0,seconds-hold),exitTime=entranceTravelTime(start,-25);
 if(walk<exitTime)return{x:entranceTravel(start,walk,-25),z:lane,yaw:Math.PI/2,moving:walk>0};
 const[gx,gz]=goals[index],duration=(Math.hypot(gx+25,gz-lane)+3)/speed,u=clamp((walk-exitTime)/duration),v=1-u;
 const x=v*v*v*-25+3*v*v*u*-17+3*v*u*u*(gx-3)+u*u*u*gx,z=v*v*v*lane+3*v*v*u*lane+3*v*u*u*gz+u*u*u*gz;
 const dx=3*v*v*8+6*v*u*(gx+14)+3*u*u*3,dz=6*v*u*(gz-lane);
 return{x,z,yaw:Math.atan2(dx,dz),moving:u<1};
}
