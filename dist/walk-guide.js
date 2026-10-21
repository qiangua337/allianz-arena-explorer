import {THREE,v} from './kit.js';
import {EYE_HEIGHT} from './navigation.js';
import {planTour,tourGoals} from './tour-route.js';
export function buildWalkGuide(scene){
 const $=id=>document.getElementById(id),panel=$('walk-guide'),select=$('guide-goal'),arrow=$('guide-arrow'),title=$('guide-title'),detail=$('guide-detail'),next=$('guide-next');
 select.innerHTML=Object.entries(tourGoals).filter(([id])=>id!=='exterior').map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
 const group=new THREE.Group();scene.add(group);const positions=new Float32Array(4096*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd36b,depthTest:false,transparent:true,opacity:.8}));line.frustumCulled=false;line.renderOrder=8;group.add(line);
 let path=[],goal='arcade',arrived=false,collapsed=false,timer=0,planClock=0,dirty=true,anchor=null;const lastPosition=v(0,-2.4,214);
 const feet=p=>({x:p.x,y:p.y-EYE_HEIGHT,z:p.z});
 function reset(position=lastPosition){anchor=feet(position);path=planTour(anchor,goal);arrived=false;dirty=true;planClock=0;}
 function setGoal(id,position=lastPosition){goal=tourGoals[id]?id:'arcade';select.value=goal;reset(position);return goal;}
 select.onchange=()=>{setGoal(select.value);$('scene').focus({preventScroll:true});};
 $('guide-collapse').onclick=()=>{collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);$('guide-collapse').textContent=collapsed?'展开':'收起';};
 next.onclick=()=>{setGoal(goal==='arcade'?'concourse':goal==='concourse'?'store':goal==='store'?'museum':goal==='museum'?'lounge':goal==='lounge'?'stands':goal==='pitch'?'tunnel':goal==='tunnel'?'homeRoom':'arcade');$('scene').focus({preventScroll:true});};
 function draw(){let count=0;for(const p of [anchor,...path]){if(!p||count>=4096)continue;positions[count*3]=p.x;positions[count*3+1]=p.y+.12;positions[count*3+2]=p.z;count++;}geo.setDrawRange(0,count);geo.attributes.position.needsUpdate=true;dirty=false;}
 function update(position,yaw,dt,mode){lastPosition.copy(position);panel.hidden=mode!=='walk';group.visible=mode==='walk';if(mode!=='walk')return;timer+=dt;planClock+=dt;if(timer<.12)return;timer=0;
  if(!path.length&&!arrived)reset(position);const p=feet(position);
  if(planClock>2){planClock=0;let distance=Infinity,previous=anchor;for(const n of path){const dx=n.x-previous.x,dz=n.z-previous.z,dy=(n.y-previous.y)*2,t=Math.max(0,Math.min(1,((p.x-previous.x)*dx+(p.z-previous.z)*dz+(p.y-previous.y)*2*dy)/(dx*dx+dz*dz+dy*dy||1)));distance=Math.min(distance,Math.hypot(p.x-previous.x-dx*t,p.z-previous.z-dz*t,(p.y-previous.y)*2-dy*t));previous=n;}if(distance>8)reset(position);}
  while(path.length&&Math.hypot(p.x-path[0].x,p.z-path[0].z)<1.1&&Math.abs(p.y-path[0].y)<.85){anchor=path.shift();dirty=true;}
  if(!path.length){arrived=true;title.textContent='已到达 · '+tourGoals[goal];detail.textContent='自由步行探索，靠近门、展品与设施可按 F 互动。';arrow.textContent='✓';arrow.style.transform='none';next.hidden=false;next.textContent='下一站 →';document.body.dataset.guideTarget=goal;}
  else{const target=path[0],dx=target.x-position.x,dz=target.z-position.z;arrow.textContent='↑';arrow.style.transform=`rotate(${yaw-Math.atan2(-dx,-dz)}rad)`;title.textContent=target.label+' · '+Math.round(Math.hypot(dx,dz))+' m';detail.textContent=target.hint;next.hidden=true;document.body.dataset.guideTarget=target.id;}
  if(dirty)draw();
 }
 return{update,reset,setGoal,getGoal:()=>goal,getRoute:()=>path};
}
