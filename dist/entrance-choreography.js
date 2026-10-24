import {entranceTravel,entranceTravelTime} from './matchday-route.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const goals=[[0,-48],[-9,-.8],[-13,-9],[-24,-5],[-24,6],[-22,21],[-23,-21],[-12,9],[-7,0],[-4,23],[-4,-23]];
// NPCs use their own clock and pitch positions. Visitor/camera coordinates are
// deliberately absent: stopping, reversing or strafing cannot drag the queue.
export function sampleQueuePlayer(seconds,index){
 if(index===25)return{x:-35.9,z:2.9,yaw:Math.PI/2,moving:false};
 const official=index>=22,row=official?0:Math.floor(index/2),lane=official?[0,-.85,.85][index-22]:index%2?.68:-.68,start=official?(index===22?-46.6:-47.1):-48.7-row*1.64,hold=4+row*.035,speed=1.24,walk=Math.max(0,seconds-hold),exitTime=entranceTravelTime(start,-30);
 if(walk<exitTime)return{x:entranceTravel(start,walk,-30),z:lane,yaw:Math.PI/2,moving:walk>0};
 let gx,gz;if(official)[gx,gz]=[[0,2.4],[-34,-47],[34,47]][index-22];else{[gx,gz]=goals[row];if(index%2)gx=-gx,gz=-gz;}
 const duration=(Math.hypot(gx+30,gz-lane)+2)/speed,u=clamp((walk-exitTime)/duration),v=1-u;
 const x=v*v*v*-30+3*v*v*u*-20+3*v*u*u*(gx-3)+u*u*u*gx,z=v*v*v*lane+3*v*v*u*lane+3*v*u*u*gz+u*u*u*gz;
 const dx=3*v*v*10+6*v*u*(gx+17)+9*u*u,dz=6*v*u*(gz-lane);
 return{x,z,yaw:u===1?(official?Math.PI/2:index%2?-Math.PI/2:Math.PI/2):Math.atan2(dx,dz),moving:u<1};
}
