import {floorHeight,MAX_STEP} from './navigation.js';

// Sample only a short, supported piece of the floor ahead. Never force the
// last vertex to a future storey's height when a connector has no floor below.
export function ribbonPoints(start,path,geometry,maxLength=28){
 const points=[{x:start.x,y:start.y+.055,z:start.z}];let previous=start,feet=start.y,remaining=maxLength;
 for(const target of path){
  const length=Math.hypot(target.x-previous.x,target.z-previous.z);if(length<.02){if(Math.abs(target.y-feet)>.8)break;previous=target;continue;}
  const end=Math.min(1,remaining/length),steps=Math.max(1,Math.ceil(length*end/.28));
  for(let i=1;i<=steps;i++){const t=end*i/steps,x=previous.x+(target.x-previous.x)*t,z=previous.z+(target.z-previous.z)*t,expected=previous.y+(target.y-previous.y)*t,next=floorHeight(x,z,feet,geometry);
   if(next-feet>MAX_STEP+.01||feet-next>1||Math.abs(next-expected)>1.05)return points;
   feet=next;points.push({x,y:feet+.055,z});
  }
  remaining-=length*end;if(end<1||remaining<=0)break;previous={...target,y:feet};
 }
 return points;
}
