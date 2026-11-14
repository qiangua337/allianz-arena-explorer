import {routeSummary} from './walk-tours.js';
import {THREE,v} from './kit.js';
import {EYE_HEIGHT} from './navigation.js';
import {inCoreShaft,coreLevels} from './building-layout.js';
import {tourGoals,tourNodes} from './tour-route.js';
import {waypointReached,movementInstruction} from './wayfinding.js';
import {directWalkDestination,planWalkPath,navigationObstacles,walkSegmentClear} from './walk-path.js';
import {normalizeDestination} from './arrivals.js';
import {destinationName} from './destinations.js';
import {ribbonPoints} from './ribbon-path.js';
import {playerLinks,containsFloor} from './player-area-layout.js';
import {alternateWalkDestination,nextWalkDestination} from './walk-continuation.js';
import {writeHudAttribute,writeHudData,writeHudProperty} from './hud-write.js';

export function floorLabel(y,position){if(position){const{x,z}=position;if(inCoreShaft(x,z)&&!coreLevels.some(level=>Math.abs(level-y)<.5))return'楼梯间';if(y<3&&(x>-95&&x<-40&&z>-43&&z<49||playerLinks.some(r=>containsFloor(r,x,z))))return'球员层';if(y>=-.3&&Math.abs(x)<42&&Math.abs(z)<60)return'球场层';}return y<2?'入口层':y<18?'公共大厅层':y<32?'包厢 / 中层':'上层看台';}
export function buildWalkGuide(scene,geometry,{obstacles={},onChoose,onSelect,onWalk,onTeleport,onContinue,onOrient,nextDestination}={}){
 const $=id=>document.getElementById(id),panel=$('walk-guide'),select=$('guide-goal'),arrow=$('guide-arrow'),title=$('guide-title'),detail=$('guide-detail'),next=$('guide-next');
 const walkButton=$('guide-walk'),teleportButton=$('guide-teleport'),goalName=$('guide-goal-name'),distanceText=$('guide-distance');
 const alternate=$('guide-alternate'),orient=$('guide-orient'),collapse=$('guide-collapse');
 const group=new THREE.Group();scene.add(group);const positions=new Float32Array(2048*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const line=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffd36b,side:THREE.DoubleSide,depthTest:true,depthWrite:false,transparent:true,opacity:.85,toneMapped:false,forceSinglePass:true}));line.frustumCulled=false;line.renderOrder=2;group.add(line);
 let path=[],goal='arcade',arrived=false,blocked=false,selected=false,collapsed=true,suppressed=false,timer=0,planClock=0,anchor=null,eyeHeight=EYE_HEIGHT,lastMode='orbit';
 const lastPosition=v(0,-2.4,214);let lastDraw=null,lastYaw=0;
 const feet=p=>({x:p.x,y:p.y-eyeHeight,z:p.z});
 function setCollapsed(value){
  collapsed=value;panel.classList.toggle('collapsed',value);
  collapse.textContent=value?'详情':'收起';
  collapse.setAttribute('aria-expanded',String(!value));
 }
 function reset(position=lastPosition){lastPosition.copy(position);anchor=feet(position);const result=planWalkPath(anchor,goal,geometry,obstacles);path=result.path;blocked=result.blocked;arrived=false;planClock=0;lastDraw=null;geo.setDrawRange(0,0);}
 function choose(id){if(onSelect)onSelect(id);else setGoal(id);$('scene').focus({preventScroll:true});}
 function setGoal(id,position=lastPosition,currentEyeHeight=EYE_HEIGHT){eyeHeight=currentEyeHeight;goal=normalizeDestination(id);select.value=goal;goalName.textContent=destinationName(goal);selected=true;setCollapsed(true);reset(position);refresh();return goal;}
 select.onclick=()=>onChoose?.();
 collapse.onclick=()=>{setCollapsed(!collapsed);refresh();};
 walkButton.onclick=()=>{setCollapsed(true);onWalk?.();};teleportButton.onclick=()=>onTeleport?.(goal);
 const suggestions=()=>{const id=nextDestination?.();return id===undefined?[nextWalkDestination(goal),alternateWalkDestination(goal)]:[id,null];};
 next.onclick=()=>{if(!arrived)return;if(onContinue?.())return;const [id]=suggestions();if(id)choose(id);};
 alternate.onclick=()=>{const [,id]=suggestions();if(arrived&&id)choose(id);};
 orient.onclick=()=>{if(lastMode==='walk'&&!arrived&&!blocked&&path[0])onOrient?.(path[0]);};
 const writeText=(element,value)=>writeHudProperty(element,'textContent',value);
 const setHint=(key,value)=>writeHudData(document.body,key,value);
 function refresh(yaw=lastYaw){
  lastYaw=yaw;
  writeHudProperty(panel,'hidden',suppressed||lastMode!=='walk'&&!selected);
  group.visible=!suppressed&&lastMode==='walk'&&!blocked&&!arrived;
  const p=feet(lastPosition);setHint('destination',goal);setHint('guideState',arrived?'arrived':blocked?'blocked':'routing');
  const walking=lastMode==='walk';
  panel.classList.toggle('arrived',arrived&&walking);
  writeHudProperty(walkButton,'hidden',walking);
  writeHudProperty(teleportButton,'title','传送到'+tourGoals[goal]+'（T）');
  writeHudProperty(next,'hidden',!arrived||!walking);
  writeHudProperty(orient,'hidden',collapsed||!walking||arrived||blocked||!path.length);
  let action,hint,subline,symbol,angle=0;
  let other=null;
  if(arrived){
   const [id,alternateGoal]=suggestions();other=walking?alternateGoal:null;
   action='已到达 · '+(goal==='entrance'?destinationName(goal):tourGoals[goal]);hint='靠近开放门、展品或座位即可互动。';subline=floorLabel(p.y,p);symbol='✓';
   writeText(next,id?destinationName(id)+' →':'完成导览');
   writeHudProperty(next,'title',id?'步行前往'+destinationName(id):'完成当前步行导览');
   writeHudAttribute(next,'aria-label',next.title);
   if(other){writeText(alternate,destinationName(other)+' →');writeHudAttribute(alternate,'aria-label','步行前往'+destinationName(other));}
   setHint('routeMetres',0);setHint('guideTarget',goal);delete document.body.dataset.guidePoint;
  }else if(blocked&&walking){
   action='附近没有找到通路';hint='先退回开放过道，路线会重新计算。也可直接传送。';subline=floorLabel(p.y,p);symbol='!';
   delete document.body.dataset.routeMetres;setHint('guideTarget','');delete document.body.dataset.guidePoint;
  }else if(!walking){
   action='已选择 · '+tourGoals[goal];hint='从上次步行位置出发，或直接传送到目的地。';subline='步行 / 直接传送';symbol='↗';
  }else if(path.length){
   const target=path[0],instruction=movementInstruction(p,yaw,target,path[1]),summary=routeSummary(p,path);
   action=instruction.action;symbol='↑';angle=instruction.angle;
   subline='还有 '+summary.metres+' 米 · '+floorLabel(p.y,p);
   hint=instruction.hint+' 下一转向点约 '+Math.round(instruction.distance)+' 米。';
   setHint('routeMetres',summary.metres);setHint('guideTarget',target.id);setHint('guidePoint',target.x+','+target.y+','+target.z);
  }
  writeHudProperty(alternate,'hidden',!other);
  if(action){
   writeText(title,action);writeHudProperty(title,'title',action);writeText(detail,hint);writeText(distanceText,subline);writeText(arrow,symbol);
   const transform=angle?`rotate(${angle}rad)`:'none';if(arrow.style.transform!==transform)arrow.style.transform=transform;
  }
 }
 function draw(p){
  let count=0,spacing=0;
  function vertex(x,y,z){positions[count*3]=x;positions[count*3+1]=y;positions[count*3+2]=z;count++;}
  const points=ribbonPoints(p,path,geometry);
  for(let i=1;i<points.length&&count+9<positions.length/3;i++){
   const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
   if(b.breakBefore){spacing=0;continue;}
   if(length<.001)continue;
   const ux=dx/length,uz=dz/length,nx=uz*.055,nz=-ux*.055;
   vertex(a.x+nx,a.y,a.z+nz);vertex(a.x-nx,a.y,a.z-nz);vertex(b.x+nx,b.y,b.z+nz);
   vertex(b.x+nx,b.y,b.z+nz);vertex(a.x-nx,a.y,a.z-nz);vertex(b.x-nx,b.y,b.z-nz);
   spacing+=length;
   // Widen the line into arrowheads only on flat runs, clear of stair edges and turns.
   if(spacing>=3.2&&i>=2&&i+2<points.length){
    const before=points[i-2],after=points[i+2],straight=(after.x-before.x)*ux+(after.z-before.z)*uz;
    if(Math.abs(after.y-b.y)<.015&&Math.abs(before.y-b.y)<.015&&straight>.68){
     vertex(b.x+uz*.24-ux*.24,b.y,b.z-ux*.24-uz*.24);
     vertex(b.x-uz*.24-ux*.24,b.y,b.z+ux*.24-uz*.24);
     vertex(b.x+ux*.34,b.y,b.z+uz*.34);
     spacing=0;
    }
   }
  }
  geo.setDrawRange(0,count);
  if(count){
   const attribute=geo.attributes.position;attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*3);attribute.needsUpdate=true;
  }
  lastDraw={...p};
 }
 function update(position,yaw,dt,mode,currentEyeHeight=EYE_HEIGHT){
  eyeHeight=currentEyeHeight;lastPosition.copy(position);lastMode=mode;lastYaw=yaw;if(suppressed){panel.hidden=true;group.visible=false;return;}timer+=dt;planClock+=dt;if(timer<.12)return;timer=0;const p=feet(position);
  if(!anchor)reset(position);
  if(mode!=='walk'){refresh(yaw);return;}
  let walls;
  const getWalls=()=>walls??=navigationObstacles(p,obstacles);
  // A visitor may take another open aisle instead of visiting every old node.
  // Arrival still requires the same floor and an unobstructed final segment.
  const destination=tourNodes[goal],remaining=Math.hypot(p.x-destination.x,p.z-destination.z);
  const approachPending=goal==='upperStands'&&path.some(node=>node.id==='upperThresholdFoot'||node.id==='upperAisleEntry');
  if(!arrived&&!approachPending&&remaining<8&&Math.abs(p.y-destination.y)<(goal==='upperStands'?.65:1)){
   if(walkSegmentClear(p,destination,geometry,getWalls())){
    blocked=false;
    if(remaining<(goal==='upperStands'?1.45:2.3)){path=[];arrived=true;lastDraw=null;}
    else if(path.length!==1||path[0].id!==goal){anchor={...p};path=[destination];lastDraw=null;}
   }else if(path.length===1&&path[0].id===goal){
    reset(position);
   }
  }
  // Advance intermediate waypoints only. The final destination uses the
  // clear-segment check above, even when it is just on the other side of a wall.
  while(path.length>1&&waypointReached(p,path[0],anchor,path[1])&&walkSegmentClear(p,path[1],geometry,getWalls())){anchor=path.shift();lastDraw=null;}
  if(!path.length&&!blocked&&!arrived)reset(position);
  if(planClock>1.2&&!arrived){
   planClock=0;
   const target=path[0],distance=Math.hypot(p.x-anchor.x,p.z-anchor.z);
   if(!approachPending&&path.length>1&&distance>.7&&directWalkDestination(p,goal,geometry,getWalls())){
    anchor=p;path=[destination];lastDraw=null;
   }else if(blocked?distance>.7:target&&(!walkSegmentClear(p,target,geometry,getWalls())||distance>55))reset(position);
  }
  refresh(yaw);
  if(mode==='walk'&&!blocked&&!arrived&&(!lastDraw||Math.hypot(p.x-lastDraw.x,p.y-lastDraw.y,p.z-lastDraw.z)>.15))draw(p);
 }
 function arrive(id,position){setGoal(id,position);path=[];blocked=false;arrived=true;geo.setDrawRange(0,0);refresh();}
 function restoreState(saved,position,currentEyeHeight=EYE_HEIGHT){setGoal(saved.goal,position,currentEyeHeight);selected=saved.selected;if(saved.arrived){arrived=true;blocked=false;path=[];geo.setDrawRange(0,0);}setCollapsed(saved.collapsed);refresh();}
 return{update,reset,setGoal,arrive,isArrived:()=>arrived,setSuppressed(value){suppressed=value;refresh();},captureState:()=>({goal,selected,collapsed,arrived}),restoreState,getGoal:()=>goal,getRoute:()=>path};
}
