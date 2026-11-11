import {TAU,superpoint} from './kit.js';
import {roomSpecs,bridges,platforms,coreFlights} from './building-layout.js';
import {playerCorridor,playerLinks,playerShower,enclosedPlayerPosition,tunnelHasBowlView} from './player-area-layout.js';
import {routeOnCurrentLevel} from './walk-path.js';
import {tourGoals,tourNodes} from './tour-route.js';

const width=260,height=210;
const outerRing=makeRing(113.5,129),innerRing=makeRing(84,102);
const destinationIds=Object.keys(tourGoals).filter(id=>id!=='exterior');
const floors={
 overview:{x:0,z:68,scale:.42,label:'全馆总览',level:null},
 entry:{x:0,z:78,scale:.46,label:'入口层 · 接待与环廊',level:-2.9,destinations:['esplanade','entrance','arcade','visitorEntry','access']},
 player:{x:-65,z:4,scale:1.65,label:'球员层 · 更衣室 / 发布厅',level:-2.7,destinations:['tunnel','homeRoom','guestRoom','press']},
 pitch:{x:0,z:0,scale:1.02,label:'球场层 · 草坪与入口',level:0,destinations:['pitch']},
 public:{x:0,z:0,scale:.80,label:'公共大厅 · 商店 / 展厅',level:12.2,destinations:['concourse','store','museum','lowerStands']},
 middle:{x:84,z:-18,scale:1.65,label:'包厢 / 中层看台',level:23.6,destinations:['lounge','stands']},
 upper:{x:91,z:-25,scale:1.75,label:'上层看台 · 楼梯与连廊',level:40,destinations:['upperStands']}
};

export function mapFloorAt(position,feetY){
 const feet={x:position.x,y:feetY,z:position.z};
 if(enclosedPlayerPosition(feet)||feet.x<-40&&tunnelHasBowlView(feet))return 'player';
 if(feetY>32)return 'upper';
 if(feetY>18)return 'middle';
 if(feetY>7)return 'public';
 if(Math.abs(position.x)<43&&Math.abs(position.z)<60)return 'pitch';
 return 'entry';
}

function makeRing(a,b){
 return Array.from({length:97},(_,i)=>superpoint(a,b,i/96*TAU,2.8));
}

export function arenaMapView(position,feetY=0,mode='walk',selection='auto'){
 const current=mode==='walk'?mapFloorAt(position,feetY):'overview';
 const floor=Object.hasOwn(floors,selection)?selection:current;
 const {scale,label,level,destinations=destinationIds}=floors[floor];
 let {x,z}=floors[floor];
 if(mode==='walk'&&floor===current){
  const horizontalRoom=(width/2-34)/scale,verticalRoom=(height/2-36)/scale;
  x=Math.max(position.x-horizontalRoom,Math.min(position.x+horizontalRoom,x));
  z=Math.max(position.z-verticalRoom,Math.min(position.z+verticalRoom,z));
 }
 return{x,z,scale,label,level,floor,current,currentLabel:floors[current].label,destinations,width,height,showPosition:mode==='walk'&&(floor===current||floor==='overview')};
}
export function mapProject(view,point){return{x:view.width/2+(point.x-view.x)*view.scale,y:view.height/2+(point.z-view.z)*view.scale};}
export function mapUnproject(view,point){return{x:(point.x-view.width/2)/view.scale+view.x,z:(point.y-view.height/2)/view.scale+view.z};}

function visibleDestination(view,node){
 if(!node||!Number.isFinite(node.x))return null;
 const p=mapProject(view,node);
 return p.x>=6&&p.x<=view.width-6&&p.y>=6&&p.y<=view.height-6?p:null;
}

export function mapDestinationAt(view,point,nodes=tourNodes){
 let selected=null,distance=20;
 for(const id of view.destinations){
  const marker=visibleDestination(view,nodes[id]);
  if(!marker)continue;
  const gap=Math.hypot(marker.x-point.x,marker.y-point.y);
  if(gap<distance){distance=gap;selected=id;}
 }
 return selected;
}

export function drawArenaFloorMap(c,{position,feetY=0,mode='walk',night=false,route=[],goal,yaw=0,selection='auto'}){
 const view=arenaMapView(position,feetY,mode,selection),w=view.width,h=view.height,project=p=>mapProject(view,p),path=points=>{c.beginPath();points.forEach((p,i)=>{const q=project(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});},rect=(x,z,ww,dd)=>{const p=project({x:x-ww/2,z:z-dd/2});c.fillRect(p.x,p.y,ww*view.scale,dd*view.scale);c.strokeRect(p.x,p.y,ww*view.scale,dd*view.scale);};
 c.clearRect(0,0,w,h);c.fillStyle='#101c23';c.fillRect(0,0,w,h);c.lineWidth=1;c.strokeStyle='#e8f0f006';for(let x=0;x<w;x+=20){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=20){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 path(outerRing);c.fillStyle=night?'#392d37':'#303b40';c.fill();c.strokeStyle='#65757c';c.stroke();path(innerRing);c.fillStyle='#1d2d30';c.fill();c.stroke();
 c.fillStyle='#233e35';c.strokeStyle='#778f8166';rect(0,0,68,105);path([{x:-34,z:0},{x:34,z:0}]);c.stroke();const center=project({x:0,z:0});c.beginPath();c.ellipse(center.x,center.y,9.15*view.scale,9.15*view.scale,0,0,TAU);c.stroke();
 if(view.level===-2.7){c.fillStyle='#687782';c.strokeStyle='#97a4aa';for(const r of[playerCorridor,...playerLinks,playerShower])rect((r.minX+r.maxX)/2,(r.minZ+r.maxZ)/2,r.maxX-r.minX,r.maxZ-r.minZ);rect(-53.7,0,26,4.6);}
 const labels={homeRoom:'主队更衣室',guestRoom:'客队更衣室',press:'新闻发布厅',lounge:'贵宾包厢',museum:'荣誉展厅',store:'球迷商店'};
 for(const[id,r]of Object.entries(roomSpecs)){const on=view.level===null||Math.abs(view.level-r.y)<2;c.fillStyle=on?'#465762':'#27353b';c.strokeStyle=on?'#9cabb3':'#4c5b63';rect(r.x,r.z,r.w,r.d);if(on){const p=project(r);c.fillStyle='#e7e8de';c.font='9px sans-serif';c.textAlign='center';c.fillText(labels[id],p.x,p.y-8);}}
 c.strokeStyle='#8ba0a9';c.lineWidth=3;for(const b of bridges){if(view.level!==null&&Math.min(Math.abs(b.a[1]-view.level),Math.abs(b.b[1]-view.level))>2)continue;path([{x:b.a[0],z:b.a[2]},{x:b.b[0],z:b.b[2]}]);c.stroke();}
 c.fillStyle='#687d88';c.strokeStyle='#b9c6ca';for(const p of platforms)if(view.level===null||Math.abs(p.y-view.level)<2)rect(p.x,p.z,p.w,p.d);
 c.strokeStyle='#a2b9c2';c.lineWidth=2;for(const f of coreFlights){if(view.level!==null&&Math.min(Math.abs(f.base-view.level),Math.abs(f.top-view.level))>2)continue;path([{x:f.x,z:f.z},{x:f.x,z:f.z+f.dir*f.run}]);c.stroke();}
 const visible=view.showPosition?routeOnCurrentLevel(route,feetY):[];if(visible.length){c.lineWidth=2.5;c.strokeStyle='#edc876';path([{x:position.x,z:position.z},...visible]);c.stroke();}
 for(const id of view.destinations){
  const p=visibleDestination(view,tourNodes[id]);
  if(!p)continue;
  c.fillStyle=id===goal?'#f1ce81':'#c6d3d8';c.beginPath();c.arc(p.x,p.y,3.5,0,TAU);c.fill();
  if(id===goal){c.strokeStyle='#e9c778';c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,6.5,0,TAU);c.stroke();}
 }
 if(view.showPosition){const p=project(position);c.save();c.translate(Math.max(6,Math.min(w-6,p.x)),Math.max(7,Math.min(h-7,p.y)));c.rotate(-yaw);c.fillStyle='#de3c5e33';c.beginPath();c.moveTo(0,0);c.lineTo(-12,-26);c.lineTo(12,-26);c.closePath();c.fill();c.fillStyle='#f0526f';c.beginPath();c.arc(0,0,4,0,TAU);c.fill();c.strokeStyle='#fee3e8';c.lineWidth=1;c.stroke();c.restore();}
 return view;
}
