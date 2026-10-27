import {TAU,superpoint} from './kit.js';
import {roomSpecs,bridges,platforms,coreFlights} from './building-layout.js';
import {playerCorridor,playerLinks,playerShower} from './player-area-layout.js';
import {routeOnCurrentLevel} from './walk-path.js';
import {tourNodes} from './tour-route.js';

export function arenaMapView(position,feetY=0,mode='walk'){
 let x=0,z=35,scale=.54,label='全馆总览',level=null;
 if(mode==='walk'){
  if(feetY<3&&position.x<-40&&position.x>-110&&Math.abs(position.z)<65){x=-65;z=4;scale=1.65;label='球员层 · 更衣室 / 发布厅';level=-2.7;}
  else if(feetY>32){x=80;z=-18;scale=1.75;label='上层看台 · 楼梯与连廊';level=40;}
  else if(feetY>18){x=72;z=-12;scale=1.65;label='包厢 / 中层看台';level=23.6;}
  else if(feetY>7){x=0;z=18;scale=.78;label='公共大厅 · 商店 / 展厅';level=12.2;}
  else if(Math.abs(position.x)<43&&Math.abs(position.z)<60){x=0;z=0;scale=1.02;label='球场层 · 草坪与入口';level=0;}
  else{label='入口层 · 接待与环廊';level=-2.9;}
 }
 return{x,z,scale,label,level,width:260,height:210};
}
export function mapProject(view,point){return{x:view.width/2+(point.x-view.x)*view.scale,y:view.height/2+(point.z-view.z)*view.scale};}
export function mapUnproject(view,point){return{x:(point.x-view.width/2)/view.scale+view.x,z:(point.y-view.height/2)/view.scale+view.z};}
export function mapDestinationAt(view,point,nodes=tourNodes){
 let selected=null,distance=16;for(const node of Object.values(nodes)){if(!node||!Number.isFinite(node.x)||view.level!==null&&Math.abs(node.y-view.level)>3)continue;const p=mapProject(view,node),d=Math.hypot(p.x-point.x,p.y-point.y);if(d<distance){distance=d;selected=node.id;}}return selected;
}

export function drawArenaFloorMap(c,{position,feetY=0,mode='walk',night=false,route=[],goal,yaw=0}){
 const view=arenaMapView(position,feetY,mode),w=view.width,h=view.height,project=p=>mapProject(view,p),path=points=>{c.beginPath();points.forEach((p,i)=>{const q=project(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});},ring=(a,b)=>Array.from({length:97},(_,i)=>superpoint(a,b,i/96*TAU,2.8)),rect=(x,z,ww,dd)=>{const p=project({x:x-ww/2,z:z-dd/2});c.fillRect(p.x,p.y,ww*view.scale,dd*view.scale);c.strokeRect(p.x,p.y,ww*view.scale,dd*view.scale);};
 c.clearRect(0,0,w,h);c.fillStyle='#101c23';c.fillRect(0,0,w,h);c.lineWidth=1;c.strokeStyle='#e8f0f006';for(let x=0;x<w;x+=20){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=20){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 path(ring(113.5,129));c.fillStyle=night?'#392d37':'#303b40';c.fill();c.strokeStyle='#65757c';c.stroke();path(ring(84,102));c.fillStyle='#1d2d30';c.fill();c.stroke();
 c.fillStyle='#233e35';c.strokeStyle='#778f8166';rect(0,0,68,105);path([{x:-34,z:0},{x:34,z:0}]);c.stroke();const center=project({x:0,z:0});c.beginPath();c.ellipse(center.x,center.y,9.15*view.scale,9.15*view.scale,0,0,TAU);c.stroke();
 if(view.level===-2.7){c.fillStyle='#687782';c.strokeStyle='#97a4aa';for(const r of[playerCorridor,...playerLinks,playerShower])rect((r.minX+r.maxX)/2,(r.minZ+r.maxZ)/2,r.maxX-r.minX,r.maxZ-r.minZ);rect(-53.7,0,26,4.6);}
 const labels={homeRoom:'主队更衣室',guestRoom:'客队更衣室',press:'新闻发布厅',lounge:'贵宾包厢',museum:'荣誉展厅',store:'球迷商店'};
 for(const[id,r]of Object.entries(roomSpecs)){const on=view.level===null||Math.abs(view.level-r.y)<2;c.fillStyle=on?'#465762':'#27353b';c.strokeStyle=on?'#9cabb3':'#4c5b63';rect(r.x,r.z,r.w,r.d);if(on){const p=project(r);c.fillStyle='#e7e8de';c.font='9px sans-serif';c.textAlign='center';c.fillText(labels[id],p.x,p.y-3);}}
 c.strokeStyle='#8ba0a9';c.lineWidth=3;for(const b of bridges){if(view.level!==null&&Math.min(Math.abs(b.a[1]-view.level),Math.abs(b.b[1]-view.level))>2)continue;path([{x:b.a[0],z:b.a[2]},{x:b.b[0],z:b.b[2]}]);c.stroke();}
 c.fillStyle='#687d88';c.strokeStyle='#b9c6ca';for(const p of platforms)if(view.level===null||Math.abs(p.y-view.level)<2)rect(p.x,p.z,p.w,p.d);
 c.strokeStyle='#a2b9c2';c.lineWidth=2;for(const f of coreFlights){if(view.level!==null&&Math.min(Math.abs(f.base-view.level),Math.abs(f.top-view.level))>2)continue;path([{x:f.x,z:f.z},{x:f.x,z:f.z+f.dir*f.run}]);c.stroke();}
 const visible=mode==='walk'?routeOnCurrentLevel(route,feetY):[];if(visible.length){c.lineWidth=2.5;c.strokeStyle='#edc876';path([{x:position.x,z:position.z},...visible]);c.stroke();}
 const target=tourNodes[goal];if(target&&(view.level===null||Math.abs(target.y-view.level)<3)){const p=project(target);c.strokeStyle='#e9c778';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,5,0,TAU);c.stroke();}
 for(const[id,node]of Object.entries(tourNodes)){if(view.level!==null&&Math.abs(node.y-view.level)>3)continue;const p=project(node);if(p.x<6||p.x>w-6||p.y<6||p.y>h-6)continue;c.fillStyle=id===goal?'#f1ce81':'#a1b2ba';c.beginPath();c.arc(p.x,p.y,2,0,TAU);c.fill();}
 const p=project(position);c.save();c.translate(Math.max(6,Math.min(w-6,p.x)),Math.max(7,Math.min(h-7,p.y)));c.rotate(-yaw);c.fillStyle='#de3c5e33';c.beginPath();c.moveTo(0,0);c.lineTo(-12,-26);c.lineTo(12,-26);c.closePath();c.fill();c.fillStyle='#f0526f';c.beginPath();c.arc(0,0,4,0,TAU);c.fill();c.strokeStyle='#fee3e8';c.lineWidth=1;c.stroke();c.restore();
 return view;
}
