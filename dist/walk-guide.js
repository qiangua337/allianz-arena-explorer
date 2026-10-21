import {THREE,v} from './kit.js';
import {floorHeight,EYE_HEIGHT} from './navigation.js';
import {planTour,tourGoals} from './tour-route.js';

export function buildWalkGuide(scene,geometry){
 const $=id=>document.getElementById(id),panel=$('walk-guide'),select=$('guide-goal'),arrow=$('guide-arrow'),title=$('guide-title'),detail=$('guide-detail'),next=$('guide-next');
 const group=new THREE.Group();group.name='Continuous visitor walking route';scene.add(group);
 const material=new THREE.MeshBasicMaterial({color:0xffd36b,toneMapped:false,transparent:true,opacity:.9,depthWrite:false});
 let path=[],goal='pitch',mesh=null,clock=0,lastDraw=0,lastPlan=0,arrived=false,collapsed=false,lastPoint=null,anchor=null;
 const feet=position=>({x:position.x,y:position.y-EYE_HEIGHT,z:position.z});
 const near=(a,b,r=2.2)=>Math.hypot(a.x-b.x,a.z-b.z)<r&&Math.abs(a.y-b.y)<1.25;
 function reset(position){anchor=feet(position);path=planTour(anchor,goal);arrived=false;lastPoint=null;lastDraw=-10;lastPlan=clock;}
 select.addEventListener('change',()=>{goal=select.value;reset(lastPosition);$('scene').focus({preventScroll:true});});
 $('guide-collapse').onclick=()=>{collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);$('guide-collapse').textContent=collapsed?'展开':'收起';};
 next.onclick=()=>{goal=goal==='pitch'?'tunnel':goal==='tunnel'?'homeRoom':'pitch';select.value=goal;reset(lastPosition);$('scene').focus({preventScroll:true});};
 let lastPosition=v(0,0,214);
 function draw(position){
  if(mesh){group.remove(mesh);mesh.geometry.dispose();mesh=null;}
  const points=[],start=feet(position),route=[start,...path];
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],segments=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.45));
   for(let j=0;j<segments;j++){const t=j/segments,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,estimated=a.y+(b.y-a.y)*t,y=floorHeight(x,z,estimated+.05,geometry);points.push(v(x,y+.07,z));}
  }
  if(path.length){const end=path[path.length-1];points.push(v(end.x,end.y+.07,end.z));}
  if(points.length>1){mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,false,'centripetal',0),Math.min(points.length*2,1800),.065,4,false),material);mesh.name='Gold visitor route on actual floor';group.add(mesh);}
  lastPoint=position.clone();lastDraw=clock;
 }
 function update(position,yaw,dt,mode){
  lastPosition.copy(position);clock+=dt;panel.hidden=mode!=='walk';group.visible=mode==='walk';if(mode!=='walk')return;
  if(position.y>19){group.visible=false;title.textContent='此层请使用区域导航';detail.textContent='从「选择区域」回到大厅，可继续步行参观。';arrow.textContent='↗';next.hidden=true;return;}
  if(!path.length&&!arrived)reset(position);const p=feet(position);let changed=false;
  if(path.length&&clock-lastPlan>2){let distance=Infinity,previous=anchor;for(const n of path){const dx=n.x-previous.x,dz=n.z-previous.z,t=Math.max(0,Math.min(1,((p.x-previous.x)*dx+(p.z-previous.z)*dz)/(dx*dx+dz*dz||1)));distance=Math.min(distance,Math.hypot(p.x-previous.x-dx*t,p.z-previous.z-dz*t));previous=n;}if(distance>9){reset(position);changed=true;}}
  while(path.length&&near(p,path[0],path.length===1?2.1:2.4)){anchor=path.shift();changed=true;}
  if(!path.length){arrived=true;title.textContent='已到达 · '+tourGoals[goal];detail.textContent=goal==='pitch'?'可以自由探索，也可继续参观球员区域。':goal==='tunnel'?'沿红色通道继续走，可到主队更衣室。':'可切换目的地，沿金色地线返回。';arrow.textContent='✓';arrow.style.transform='none';next.hidden=goal==='entrance';next.textContent=goal==='pitch'?'继续：球员通道 →':goal==='tunnel'?'继续：主队更衣室 →':'返回草坪 →';document.body.dataset.guideTarget=goal;}
  else{const target=path[0],dx=target.x-position.x,dz=target.z-position.z,angle=yaw-Math.atan2(-dx,-dz);arrow.textContent='↑';arrow.style.transform=`rotate(${angle}rad)`;title.textContent=target.label+' · '+Math.round(Math.hypot(dx,dz))+' m';detail.textContent=target.hint;next.hidden=true;document.body.dataset.guideTarget=target.id;}
  if(changed||!lastPoint||clock-lastDraw>.7&&position.distanceTo(lastPoint)>1.6)draw(position);
 }
 return{update,reset,getRoute:()=>path};
}
