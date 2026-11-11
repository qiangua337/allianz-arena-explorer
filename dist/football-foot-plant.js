import {THREE} from './kit.js';
import {readFootballAnkle,placeFootballSupportFoot} from './football-kick-pose.js';
const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createFootballFootPlant(bones){
 const feet=[0,1].map(side=>({side,active:false,weight:0,x:0,z:0,heading:0,release:0,ankle:new THREE.Vector3(),goal:new THREE.Vector3()}));
 function reset(){for(const foot of feet){foot.active=false;foot.weight=0;foot.release=0;}}
 return{reset,update(x,z,heading,scale,phase,fast,dt,enabled,hardReset=false,walk=0,adaptive=false,yieldSide=-1){
  // The walking clip has a longer real stance (.98 -> .60) than the run.
  // Reusing the jogging window released a side-step while its sole was down.
  if(hardReset){reset();return;}const cos=Math.cos(heading),sin=Math.sin(heading),landing=(.13+.07*fast)*(1-walk)+.02*walk,end=(.45-.01*fast)*(1-walk)+.62*walk;
  for(const foot of feet){
   const cycle=((phase+foot.side*.5+landing)%1+1)%1,contact=enabled&&foot.side!==yieldSide&&cycle<end;
   if(!contact&&foot.weight<=.01){foot.active=false;foot.weight=0;continue;}
   if(!readFootballAnkle(bones,foot.side,foot.ankle))continue;
   if(contact&&!foot.active&&(foot.weight<=.01||foot.release>.10)){foot.x=x+(foot.ankle.x*cos+foot.ankle.z*sin)*scale;foot.z=z+(-foot.ankle.x*sin+foot.ankle.z*cos)*scale;foot.weight=1;foot.release=0;foot.heading=heading;}
   else if(contact){foot.weight=1-(1-foot.weight)*Math.exp(-dt*24);foot.release=0;}
   else if(!contact){foot.weight*=Math.exp(-dt*(adaptive?18-5*walk-3*fast:24-8*walk));foot.release+=dt;}
   // Hold the point of support on gentle curves. At sharper angles allow
   // the planted sole to pivot under the body instead of twisting the knee.
   if(foot.active||foot.weight>.01){const yaw=turn(foot.heading,heading),pivot=adaptive?.18+.42*Math.min(1,Math.abs(yaw)/Math.max(.01,dt*4)):.5,angle=yaw*pivot,c=Math.cos(angle),s=Math.sin(angle),dx=foot.x-x,dz=foot.z-z;foot.x=x+dx*c+dz*s;foot.z=z-dx*s+dz*c;}
   foot.active=contact;foot.heading=heading;
   const dx=foot.x-x,dz=foot.z-z,lift=adaptive?.065:.10;foot.goal.set((dx*cos-dz*sin)/scale,foot.ankle.y+(!contact?lift*(1-Math.exp(-foot.release*35)):0),(dx*sin+dz*cos)/scale);
   placeFootballSupportFoot(bones,foot.side,foot.goal,foot.weight);
  }
 }};
}
