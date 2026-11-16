import {floorHeight,MAX_STEP} from './navigation.js';
import {upperAisleTreadHeight} from './building-layout.js';

const traceSpacing=.28;
const riserHeight=.075;
const seamLength=.012;

// Sample only a short, supported piece of the floor ahead. Never force the
// last vertex to a future storey's height when a connector has no floor below.
export function ribbonPoints(start,path,geometry,maxLength=28,segments){
 const mark=(x,z,feet)=>{
  const tread=upperAisleTreadHeight(x,z,feet);
  return {x,y:tread===null?feet+.055:tread+.018,z};
 };
 const points=[mark(start.x,start.z,start.y)];let previous=start,feet=start.y,remaining=maxLength;
 // Locate step edges with short searches only where height changes sharply.
 // The strip ends at each nose and restarts on the next tread.
 function append(a,b,baseFeet){
  if(Math.abs(b.y-a.y)<riserHeight){points.push(b);return;}
  let low=a,high=b;
  while(Math.hypot(high.x-low.x,high.z-low.z)>seamLength){
   const x=(low.x+high.x)*.5,z=(low.z+high.z)*.5;
   const feetAtMiddle=floorHeight(x,z,baseFeet,geometry),middle=mark(x,z,feetAtMiddle);
   if(Math.abs(middle.y-a.y)<riserHeight)low=middle;
   else if(Math.abs(middle.y-b.y)<riserHeight)high=middle;
   else if(Math.hypot(b.x-a.x,b.z-a.z)>seamLength*2){
    // The initial sample can straddle two short treads near a doorway.
    append(a,middle,baseFeet);append(middle,b,feetAtMiddle);return;
   }else break;
  }
  if(low!==a)points.push(low);
  points.push({...high,breakBefore:true});
  if(high!==b)points.push(b);
 }
 for(const target of path){
  const length=Math.hypot(target.x-previous.x,target.z-previous.z);if(length<.02){if(Math.abs(target.y-feet)>.8)break;previous=target;continue;}
  const end=Math.min(1,remaining/length),steps=Math.max(1,Math.ceil(length*end/traceSpacing));
  // Only complete segments between waypoints can repeat unchanged while the
  // walker moves. The leading line and distance-limited end stay live.
  const reusable=segments&&previous!==start&&end===1&&previous.y===feet;
  const initial=points.at(-1),cached=reusable?segments.get(target):null;
  if(cached&&cached.previous.x===previous.x&&cached.previous.y===previous.y&&cached.previous.z===previous.z&&
      cached.initial.x===initial.x&&cached.initial.y===initial.y&&cached.initial.z===initial.z){
   points.push(...cached.points);feet=cached.feet;
  }else{
   const offset=points.length;
   for(let i=1;i<=steps;i++){
    const t=end*i/steps;
    const x=t===1?target.x:previous.x+(target.x-previous.x)*t;
    const z=t===1?target.z:previous.z+(target.z-previous.z)*t;
    const expected=previous.y+(target.y-previous.y)*t,next=floorHeight(x,z,feet,geometry);
    if(next-feet>MAX_STEP+.01||feet-next>1||Math.abs(next-expected)>1.05)return points;
    append(points.at(-1),mark(x,z,next),feet);feet=next;
   }
   if(reusable)segments.set(target,{previous,initial,points:points.slice(offset),feet});
  }
  remaining-=length*end;if(end<1||remaining<=0)break;previous={...target,y:feet};
 }
 return points;
}
