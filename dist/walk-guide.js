import {THREE,v} from './kit.js';
import {EYE_HEIGHT} from './navigation.js';
import {inCoreShaft,coreLevels} from './building-layout.js';
import {tourGoals} from './tour-route.js';
import {waypointReached,movementInstruction} from './wayfinding.js';
import {planWalkPath,navigationObstacles,walkSegmentClear} from './walk-path.js';
import {normalizeDestination} from './arrivals.js';
import {destinationName} from './destinations.js';
import {ribbonPoints} from './ribbon-path.js';

export function floorLabel(y,position){if(position){const{x,z}=position;if(inCoreShaft(x,z)&&!coreLevels.some(level=>Math.abs(level-y)<.5))return'楼梯间';if(y<3&&x>-95&&x<-40&&z>-43&&z<49)return'球员层';if(y>=-.3&&Math.abs(x)<42&&Math.abs(z)<60)return'球场层';}return y<2?'入口层':y<18?'公共大厅层':y<32?'包厢 / 中层':'上层看台';}
export function buildWalkGuide(scene,geometry,{obstacles={},onChoose,onSelect,onWalk,onTeleport}={}){
 const $=id=>document.getElementById(id),panel=$('walk-guide'),select=$('guide-goal'),arrow=$('guide-arrow'),title=$('guide-title'),detail=$('guide-detail'),next=$('guide-next');
 const walkButton=$('guide-walk'),teleportButton=$('guide-teleport'),goalName=$('guide-goal-name'),distanceText=$('guide-distance');
 const group=new THREE.Group();scene.add(group);const positions=new Float32Array(4096*6*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const line=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffd36b,side:THREE.DoubleSide,depthTest:true,depthWrite:false,transparent:true,opacity:.85,toneMapped:false}));line.frustumCulled=false;line.renderOrder=2;group.add(line);
 let path=[],goal='arcade',arrived=false,blocked=false,selected=false,collapsed=true,suppressed=false,timer=0,planClock=0,anchor=null,eyeHeight=EYE_HEIGHT,lastMode='orbit';
 const lastPosition=v(0,-2.4,214);let lastDraw=null;
 const feet=p=>({x:p.x,y:p.y-eyeHeight,z:p.z});
 function expand(){collapsed=true;panel.classList.toggle('collapsed',true);$('guide-collapse').textContent='详情';}
 function reset(position=lastPosition){lastPosition.copy(position);anchor=feet(position);const result=planWalkPath(anchor,goal,geometry,obstacles);path=result.path;blocked=result.blocked;arrived=false;planClock=0;lastDraw=null;}
 function choose(id){if(onSelect)onSelect(id);else setGoal(id);$('scene').focus({preventScroll:true});}
 function setGoal(id,position=lastPosition,currentEyeHeight=EYE_HEIGHT){eyeHeight=currentEyeHeight;goal=normalizeDestination(id);select.value=goal;goalName.textContent=destinationName(goal);selected=true;expand();reset(position);refresh();return goal;}
 select.onclick=()=>onChoose?.();
 $('guide-collapse').onclick=()=>{collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);$('guide-collapse').textContent=collapsed?'详情':'收起';};
 walkButton.onclick=()=>{expand();onWalk?.();};teleportButton.onclick=()=>onTeleport?.(goal);
 next.onclick=()=>choose(goal==='arcade'?'concourse':goal==='concourse'?'store':goal==='store'?'museum':goal==='museum'?'lounge':goal==='lounge'?'stands':goal==='pitch'?'tunnel':goal==='tunnel'?'homeRoom':'arcade');
 function refresh(yaw=0){
  panel.hidden=suppressed||lastMode!=='walk'&&!selected;group.visible=!suppressed&&lastMode==='walk'&&!blocked&&!arrived;
  const p=feet(lastPosition);document.body.dataset.destination=goal;document.body.dataset.guideState=arrived?'arrived':blocked?'blocked':'routing';
  walkButton.hidden=lastMode==='walk';teleportButton.title='传送到'+tourGoals[goal]+'（T）';next.hidden=!arrived;distanceText.textContent=arrived?floorLabel(p.y,p):lastMode==='walk'?'沿地面指引前行':'步行 / 直接传送';
  if(arrived){title.textContent='已到达 · '+tourGoals[goal];detail.textContent='自由探索，靠近门、展品与设施可按 F 互动。';arrow.textContent='✓';arrow.style.transform='none';next.textContent='下一站 →';document.body.dataset.guideTarget=goal;delete document.body.dataset.guidePoint;}
  else if(blocked){title.textContent='当前位置暂未找到可通行路线';detail.textContent='回到开放过道后会重新规划，也可直接传送。';arrow.textContent='!';arrow.style.transform='none';document.body.dataset.guideTarget='';delete document.body.dataset.guidePoint;}
  else if(lastMode!=='walk'){title.textContent='已选择 · '+tourGoals[goal];detail.textContent='从上次步行位置出发，或直接传送到目的地。';arrow.textContent='↗';arrow.style.transform='none';}
  else if(path.length){const target=path[0],instruction=movementInstruction(p,yaw,target,path[1]);arrow.textContent='↑';arrow.style.transform=`rotate(${instruction.angle}rad)`;title.textContent=instruction.action;distanceText.textContent=Math.round(instruction.distance)+' m · '+floorLabel(p.y,p);detail.textContent=floorLabel(p.y,p)+' · '+instruction.hint;document.body.dataset.guideTarget=target.id;document.body.dataset.guidePoint=[target.x,target.y,target.z].join(',');}
 }
 function draw(p){let count=0;const points=ribbonPoints(p,path,geometry);for(let i=1;i<points.length&&count+6<4096*6;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,nx=dz/length*.075,nz=-dx/length*.075;for(const [point,side]of[[a,1],[a,-1],[b,1],[b,1],[a,-1],[b,-1]]){positions[count*3]=point.x+nx*side;positions[count*3+1]=point.y;positions[count*3+2]=point.z+nz*side;count++;}}geo.setDrawRange(0,count);geo.attributes.position.needsUpdate=true;lastDraw={...p};}
 function update(position,yaw,dt,mode,currentEyeHeight=EYE_HEIGHT){
  eyeHeight=currentEyeHeight;lastPosition.copy(position);lastMode=mode;if(suppressed){panel.hidden=true;group.visible=false;return;}timer+=dt;planClock+=dt;if(timer<.12)return;timer=0;const p=feet(position);
  if(!anchor)reset(position);
  const walls=navigationObstacles(p,obstacles);
  // Never advance a corner if the resulting shortcut crosses a fixture.
  while(path.length&&waypointReached(p,path[0],anchor,path[1],path.length===1)&&(!path[1]||walkSegmentClear(p,path[1],geometry,walls))){anchor=path.shift();lastDraw=null;}
  if(!path.length&&!blocked)arrived=true;
  if(planClock>1.2&&!arrived){planClock=0;const target=path[0],distance=Math.hypot(p.x-anchor.x,p.z-anchor.z);
   if(blocked?distance>.7:target&&(!walkSegmentClear(p,target,geometry,walls)||distance>55))reset(position);
  }
  refresh(yaw);
  if(mode==='walk'&&!blocked&&!arrived&&(!lastDraw||Math.hypot(p.x-lastDraw.x,p.y-lastDraw.y,p.z-lastDraw.z)>.15))draw(p);
 }
 function arrive(id,position){setGoal(id,position);path=[];blocked=false;arrived=true;geo.setDrawRange(0,0);refresh();}
 function restoreState(saved,position,currentEyeHeight=EYE_HEIGHT){setGoal(saved.goal,position,currentEyeHeight);selected=saved.selected;collapsed=saved.collapsed;if(saved.arrived){arrived=true;blocked=false;path=[];geo.setDrawRange(0,0);}panel.classList.toggle('collapsed',collapsed);$('guide-collapse').textContent=collapsed?'详情':'收起';refresh();}
 return{update,reset,setGoal,arrive,setSuppressed(value){suppressed=value;refresh();},captureState:()=>({goal,selected,collapsed,arrived}),restoreState,getGoal:()=>goal,getRoute:()=>path};
}
