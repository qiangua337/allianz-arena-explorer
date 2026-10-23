import {planTour} from './tour-route.js';
import {roomAt} from './building-layout.js';
import {furnitureBlocksSegment} from './furniture-layout.js';
import {serviceRoomAt,serviceWorld} from './service-layout.js';
import {floorHeight,canStandAt,EYE_HEIGHT,MAX_STEP} from './navigation.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y-b.y)*2);
const privateArea=p=>roomAt(p)||p.x>-80&&p.x<-66&&p.z>-43&&p.z<50&&p.y<1;
export function navigationObstacles(position,groups){
 return [...(groups.world||[]),...(groups.building||[]),...(groups.interiors||[]),...(groups.service||[]),...(!privateArea(position)?groups.circulation||[]:[])].filter(b=>b.enabled!==false&&!b.dynamicDoor);
}
function localBounds(b){
 if(b.cx===undefined)return b;
 const c=Math.abs(Math.cos(b.yaw)),s=Math.abs(Math.sin(b.yaw)),w=c*b.halfW+s*b.halfD,d=s*b.halfW+c*b.halfD;
 return{x0:b.cx-w,x1:b.cx+w,z0:b.cz-d,z1:b.cz+d};
}
export function segmentHitsObstacle(a,b,wall){
 if(Math.max(a.y,b.y)+EYE_HEIGHT<=wall.y0+.2||Math.min(a.y,b.y)>=wall.y1)return false;
 let ax=a.x,az=a.z,bx=b.x,bz=b.z,x0=wall.x0,x1=wall.x1,z0=wall.z0,z1=wall.z1;
 if(wall.cx!==undefined){const c=Math.cos(wall.yaw),s=Math.sin(wall.yaw),transform=p=>[(p.x-wall.cx)*c-(p.z-wall.cz)*s,(p.x-wall.cx)*s+(p.z-wall.cz)*c];[ax,az]=transform(a);[bx,bz]=transform(b);x0=-wall.halfW;x1=wall.halfW;z0=-wall.halfD;z1=wall.halfD;}
 let lo=0,hi=1;for(const[start,end,min,max]of[[ax,bx,x0,x1],[az,bz,z0,z1]]){const delta=end-start;if(Math.abs(delta)<1e-9){if(start<=min||start>=max)return false;}else{let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>=hi)return false;}}return lo<hi;
}
export function walkSegmentClear(a,b,geometry,obstacles){
 const room=roomAt(a)||roomAt(b);if(room&&furnitureBlocksSegment(a,b,room))return false;
 if(obstacles.some(w=>segmentHitsObstacle(a,b,w)))return false;
 const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.4));let feet=a.y;
 for(let i=1;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,next=floorHeight(x,z,feet,geometry);if(next-feet>MAX_STEP+.01||feet-next>1||!canStandAt(x,z,next,geometry))return false;feet=next;}
 return Math.abs(feet-b.y)<1;
}
function obstacleCorners(w,y){const gap=.45;
 if(w.cx===undefined)return [[w.x0-gap,w.z0-gap],[w.x0-gap,w.z1+gap],[w.x1+gap,w.z0-gap],[w.x1+gap,w.z1+gap]].map(([x,z])=>({x,y,z}));
 const c=Math.cos(w.yaw),s=Math.sin(w.yaw),out=[];for(const x of[-w.halfW-gap,w.halfW+gap])for(const z of[-w.halfD-gap,w.halfD+gap])out.push({x:w.cx+x*c+z*s,y,z:w.cz-x*s+z*c});return out;
}
function detour(a,b,geometry,obstacles){
 if(Math.abs(a.y-b.y)>.85)return null;
 const bounds={x0:Math.min(a.x,b.x)-7,x1:Math.max(a.x,b.x)+7,z0:Math.min(a.z,b.z)-7,z1:Math.max(a.z,b.z)+7};
 const nearby=obstacles.filter(w=>{const r=localBounds(w);return r.x1>bounds.x0&&r.x0<bounds.x1&&r.z1>bounds.z0&&r.z0<bounds.z1&&a.y+EYE_HEIGHT>w.y0+.2&&a.y<w.y1;});
 const corners=nearby.flatMap(w=>obstacleCorners(w,a.y)).filter(p=>p.x>bounds.x0&&p.x<bounds.x1&&p.z>bounds.z0&&p.z<bounds.z1&&canStandAt(p.x,p.z,p.y,geometry)&&!nearby.some(w=>segmentHitsObstacle(p,p,w))).sort((p,q)=>distance(a,p)+distance(p,b)-distance(a,q)-distance(q,b)).slice(0,96);
 const points=[a,b,...corners],costs=new Map([[0,0]]),previous=new Map(),open=[0],closed=new Set(),clearCache=new Map();
 const clear=(i,j)=>{const key=i<j?i+':'+j:j+':'+i;if(!clearCache.has(key))clearCache.set(key,walkSegmentClear(points[i],points[j],geometry,nearby));return clearCache.get(key);};
 while(open.length){open.sort((i,j)=>costs.get(i)+distance(points[i],b)-costs.get(j)-distance(points[j],b));const i=open.shift();if(i===1){const ids=[1];while(ids[0]!==0)ids.unshift(previous.get(ids[0]));return ids.slice(1,-1).map((k,n)=>({...points[k],id:'avoid'+n,level:'clearance',label:'绕过服务设施',hint:'沿通行过道绕过导览机、柜台或栏杆。'}));}closed.add(i);
  for(let j=1;j<points.length;j++){if(closed.has(j)||!clear(i,j))continue;const cost=costs.get(i)+distance(points[i],points[j]);if(cost<(costs.get(j)??Infinity)){costs.set(j,cost);previous.set(j,i);if(!open.includes(j))open.push(j);}}
 }return null;
}
export function planWalkPath(position,goal,geometry,groups={}){
 const service=serviceRoomAt(position);if(service){const door={...serviceWorld(service,0,.45),y:service.y},outside=serviceWorld(service,0,3.1),node=(p,id,label)=>({...p,y:service.y,id,level:'upper',label,hint:'按 F 或点击互动按钮打开服务间双门，再回到公共大厅。'}),obstacles=navigationObstacles(position,groups),prefix=walkSegmentClear(position,door,geometry,obstacles)?[]:detour(position,door,geometry,obstacles),tail=planWalkPath({...outside,y:service.y},goal,geometry,groups);if(!prefix)return{path:[],blocked:true};return{path:[...prefix,node(door,service.id+'Exit','走出服务间'),node(outside,service.id+'Outside','返回公共大厅'),...tail.path],blocked:tail.blocked};}
 const route=planTour(position,goal);if(!route.length)return{path:[],blocked:true};
 const obstacles=navigationObstacles(position,groups),remaining=route.map(()=>0);for(let i=route.length-2;i>=0;i--)remaining[i]=remaining[i+1]+distance(route[i],route[i+1]);
 let best=null;for(let i=0;i<Math.min(route.length,5);i++){const target=route[i];if(i&&Math.abs(target.y-position.y)>.85)break;if(i&&distance(position,target)>45)break;
  if(walkSegmentClear(position,target,geometry,obstacles)){const cost=distance(position,target)+remaining[i];if(!best||cost<best.cost)best={cost,index:i};}
  if(target.level==='core'||/^landing/.test(target.id))break;
 }
 if(best)return{path:route.slice(best.index),blocked:false};
 const prefix=detour(position,route[0],geometry,obstacles);return prefix?{path:[...prefix,...route],blocked:false}:{path:[],blocked:true};
}
export function routeOnCurrentLevel(route,feetY){const out=[];for(const n of route){if(Math.abs(n.y-feetY)>1.1)break;out.push(n);}return out;}
