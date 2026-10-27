const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const frames=[];for(const z of[-52.5,52.5]){for(const x of[-3.66,3.66])frames.push({a:{x,y:0,z},b:{x,y:2.44,z},name:'门柱'});frames.push({a:{x:-3.66,y:2.44,z},b:{x:3.66,y:2.44,z},name:'横梁'});}

function root(a,b,c){if(a<1e-12)return null;const d=b*b-4*a*c;if(d<0)return null;const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;}
// Swept sphere against the six goal-frame capsules, including their end caps.
// A fast shot cannot skip the post between two 60 Hz simulation samples.
export function goalFrameCollision(previous,next,velocity,radius=.11){
 const delta=sub(next,previous),r=radius+.06;let hit=null;
 for(const frame of frames){
  const axis=sub(frame.b,frame.a),length=Math.sqrt(dot(axis,axis));for(const k of['x','y','z'])axis[k]/=length;
  const offset=sub(previous,frame.a),along=dot(offset,axis),travel=dot(delta,axis),p={x:offset.x-axis.x*along,y:offset.y-axis.y*along,z:offset.z-axis.z*along},d={x:delta.x-axis.x*travel,y:delta.y-axis.y*travel,z:delta.z-axis.z*travel};
  const candidates=[],t=root(dot(d,d),2*dot(p,d),dot(p,p)-r*r);
  if(t!==null&&along+travel*t>=0&&along+travel*t<=length)candidates.push({t,center:mix(frame.a,frame.b,(along+travel*t)/length)});
  for(const center of[frame.a,frame.b]){const o=sub(previous,center),end=root(dot(delta,delta),2*dot(o,delta),dot(o,o)-r*r);if(end!==null)candidates.push({t:end,center});}
  for(const candidate of candidates){if(hit&&candidate.t>=hit.t)continue;const point=mix(previous,next,candidate.t),normal=sub(point,candidate.center),n=Math.sqrt(dot(normal,normal))||1;for(const k of['x','y','z'])normal[k]/=n;const inward=dot(velocity,normal);if(inward>=-.01)continue;hit={...candidate,point,normal,name:frame.name,velocity:{x:(velocity.x-1.68*inward*normal.x)*.97,y:(velocity.y-1.68*inward*normal.y)*.97,z:(velocity.z-1.68*inward*normal.z)*.97}};}
 }
 return hit;
}
