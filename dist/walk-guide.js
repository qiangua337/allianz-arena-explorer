import {THREE,v} from './kit.js';
import {floorHeight,EYE_HEIGHT} from './navigation.js';
import {planTour,tourGoals} from './tour-route.js';
import {waypointReached,movementInstruction} from './wayfinding.js';
import {roomAt} from './building-layout.js';
import {furnitureBlocksSegment} from './furniture-layout.js';
export function buildWalkGuide(scene,geometry){
 const $=id=>document.getElementById(id),panel=$('walk-guide'),select=$('guide-goal'),arrow=$('guide-arrow'),title=$('guide-title'),detail=$('guide-detail'),next=$('guide-next');
 select.innerHTML=Object.entries(tourGoals).filter(([id])=>id!=='exterior').map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
 const group=new THREE.Group();scene.add(group);const positions=new Float32Array(4096*6*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const line=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffd36b,side:THREE.DoubleSide,depthTest:true,depthWrite:false,transparent:true,opacity:.85,toneMapped:false}));line.frustumCulled=false;line.renderOrder=2;group.add(line);
 let path=[],goal='arcade',arrived=false,collapsed=false,timer=0,planClock=0,dirty=true,anchor=null,eyeHeight=EYE_HEIGHT;const lastPosition=v(0,-2.4,214);
 const feet=p=>({x:p.x,y:p.y-eyeHeight,z:p.z});
 function reset(position=lastPosition){anchor=feet(position);path=planTour(anchor,goal);arrived=false;dirty=true;planClock=0;}
 function setGoal(id,position=lastPosition){goal=tourGoals[id]?id:'arcade';select.value=goal;reset(position);return goal;}
 select.onchange=()=>{setGoal(select.value);$('scene').focus({preventScroll:true});};
 $('guide-collapse').onclick=()=>{collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);$('guide-collapse').textContent=collapsed?'展开':'收起';};
 next.onclick=()=>{setGoal(goal==='arcade'?'concourse':goal==='concourse'?'store':goal==='store'?'museum':goal==='museum'?'lounge':goal==='lounge'?'stands':goal==='pitch'?'tunnel':goal==='tunnel'?'homeRoom':'arcade');$('scene').focus({preventScroll:true});};
 function draw(){let count=0,previous=anchor,feet=anchor?.y;const points=[];for(const target of path.slice(0,5)){if(!previous)break;const length=Math.hypot(target.x-previous.x,target.z-previous.z),steps=Math.max(1,Math.ceil(length/.22));for(let i=0;i<steps;i++){const t=i/steps,x=previous.x+(target.x-previous.x)*t,z=previous.z+(target.z-previous.z)*t;feet=floorHeight(x,z,feet,geometry);points.push(v(x,feet+.055,z));}previous=target;}if(previous)points.push(v(previous.x,previous.y+.055,previous.z));for(let i=1;i<points.length&&count+6<4096*6;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,nx=dz/length*.075,nz=-dx/length*.075;for(const [p,side]of[[a,1],[a,-1],[b,1],[b,1],[a,-1],[b,-1]]){positions[count*3]=p.x+nx*side;positions[count*3+1]=p.y;positions[count*3+2]=p.z+nz*side;count++;}}geo.setDrawRange(0,count);geo.attributes.position.needsUpdate=true;dirty=false;}

 function update(position,yaw,dt,mode,currentEyeHeight=EYE_HEIGHT){eyeHeight=currentEyeHeight;lastPosition.copy(position);panel.hidden=mode!=='walk';group.visible=mode==='walk';if(mode!=='walk')return;timer+=dt;planClock+=dt;if(timer<.12)return;timer=0;
  if(!path.length&&!arrived)reset(position);const p=feet(position);
  if(planClock>2&&!arrived&&path.length){planClock=0;let distance=Infinity,previous=anchor;for(const n of path){const dx=n.x-previous.x,dz=n.z-previous.z,dy=(n.y-previous.y)*2,t=Math.max(0,Math.min(1,((p.x-previous.x)*dx+(p.z-previous.z)*dz+(p.y-previous.y)*2*dy)/(dx*dx+dz*dz+dy*dy||1)));distance=Math.min(distance,Math.hypot(p.x-previous.x-dx*t,p.z-previous.z-dz*t,(p.y-previous.y)*2-dy*t));previous=n;}const room=roomAt(p),target=path[0],wrongRoom=room&&target&&!target.id.startsWith(room)&&!(room==='homeRoom'&&target.id==='homeDoor');if(distance>(room?3.5:8)||wrongRoom||room&&target&&furnitureBlocksSegment(p,target,room))reset(position);}
  while(path.length&&waypointReached(p,path[0],anchor,path[1],path.length===1)){anchor=path.shift();dirty=true;}
  if(!path.length){arrived=true;title.textContent='已到达 · '+tourGoals[goal];detail.textContent='自由步行探索，靠近门、展品与设施可按 F 互动。';arrow.textContent='✓';arrow.style.transform='none';next.hidden=false;next.textContent='下一站 →';document.body.dataset.guideTarget=goal;}
  else{const target=path[0],instruction=movementInstruction(p,yaw,target,path[1]);arrow.textContent='↑';arrow.style.transform=`rotate(${instruction.angle}rad)`;title.textContent=instruction.action+' · '+Math.round(instruction.distance)+' m';detail.textContent=instruction.hint;next.hidden=true;document.body.dataset.guideTarget=target.id;}
  if(dirty)draw();
 }
 return{update,reset,setGoal,getGoal:()=>goal,getRoute:()=>path};
}
