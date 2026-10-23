import {THREE,v,mat,mesh,box,sign,canvasTexture} from './kit.js';
import {roomSpecs} from './building-layout.js';
import {playerByNumber} from './roster.js';
export function buildInteractions(scene,interiors,{toast,navigate,showInfo,setEye,serviceRooms}){
 const root=new THREE.Group();root.name='Working doors and interactive exhibits';scene.add(root);const button=document.getElementById('interact'),colliders=[],doors=[],items=[];let selected=null,clock=0,seated=false,shirt=0,tactic=0;
 const red=mat(0x9b1a34),glass=mat(0xa1c6cc,{transparent:true,opacity:.19,roughness:.2}),metal=mat(0xa9b9bd,{metalness:.6});
 const names={homeRoom:'主队更衣室',guestRoom:'客队更衣室',press:'新闻发布厅',lounge:'贵宾包厢',store:'球迷商店',museum:'荣誉展厅'};
 for(const[id,s]of Object.entries(roomSpecs)){
  const z=id==='lounge'?-10.5:s.z,x=s.x+s.w/2,hinge=new THREE.Group();hinge.position.set(x,s.y,z-1.15);root.add(hinge);box(hinge,.07,2.9,2.3,0,1.45,1.15,id==='homeRoom'||id==='guestRoom'?red:glass);box(hinge,.13,.42,.055,-.07,1.35,2.0,metal);
  const board=sign(root,names[id]+' · 自动门',2,.32,x+.13,s.y+3.15,z,{bg:'#354e57',font:70});board.rotation.y=Math.PI/2;
  const collider={x0:x-.3,x1:x+.3,z0:z-1.38,z1:z+1.38,y0:s.y,y1:s.y+2.9,enabled:true};colliders.push(collider);doors.push({id,x,z,y:s.y,hinge,angle:0,hold:false,collider});
 }
 function item(id,p,label,act,radius=2.8){items.push({id,p:v(...p),label,act,radius});}
 item('welcome',[4,-1.2,110],'咨询下一站路线',()=>showInfo('从大厅继续参观','沿入口层环廊到东侧室内楼梯，上楼可到公共大厅、商店、展厅、包厢和三层看台。球员区域可由草坪西侧红色通道步行进入。',['concourse','store','museum','lounge','stands','pitch']));
 item('tactics',[-74,-1,-4.3],'切换战术板阵型',()=>{tactic=1-tactic;interiors.setTactics?.(tactic);toast('战术板：'+(tactic?'4–4–2':'4–2–3–1'));});
 const years=['1974','1975','1976','2001','2013','2020'];
 for(let i=0;i<6;i++){const x=-96+(i%2?3.7:-3.7),z=58-8+Math.floor(i/2)*5.3;item('cup'+i,[x,13.5,z],`查看 ${years[i]} 冠军杯`,()=>showInfo(years[i]+' · 欧洲冠军杯','靠近观察银杯、双耳把手、玻璃展柜和底座年份。展厅以六次夺冠年份为主题作近似布展。'));}
 const display=new THREE.Group();display.position.set(10,13.65,118);root.add(display);box(display,1.7,.12,1.3,0,-1.2,0,metal);box(display,.06,1.2,.06,0,-.6,0,metal);const jerseyCanvas=document.createElement('canvas');jerseyCanvas.width=512;jerseyCanvas.height=640;const jerseyMap=new THREE.CanvasTexture(jerseyCanvas);jerseyMap.colorSpace=THREE.SRGBColorSpace;const jersey=mesh(new THREE.PlaneGeometry(.9,1.15),new THREE.MeshBasicMaterial({map:jerseyMap,side:THREE.DoubleSide}),display,0,0,0);jersey.rotation.y=Math.PI/2;
 function updateShirt(){const p=playerByNumber([9,10,17,14,6][shirt]),c=jerseyCanvas.getContext('2d');c.fillStyle='#b71c37';c.fillRect(0,0,512,640);c.textAlign='center';c.fillStyle='#fff';c.font='bold 30px Arial';c.fillText('FC BAYERN MÜNCHEN',256,90,480);c.font='bold 240px Arial';c.fillText(p.number,256,365);c.font='bold 44px Arial';c.fillText(p.name,256,465,470);c.font='24px Arial';c.fillText('F · NEXT PLAYER',256,570);jerseyMap.needsUpdate=true;}updateShirt();
 item('shirt',[11,13.7,118],'切换球衣 · 旋转陈列',()=>{shirt=(shirt+1)%5;updateShirt();display.rotation.y+=Math.PI/4;toast('展示球衣：'+playerByNumber([9,10,17,14,6][shirt]).name);});
 for(const[id,p]of[['middleSeat',[81.2,24.8,-30.1]],['upperSeat',[101.4,41,-36.5]],['lowerSeat',[1.1,12,-82.5]]])item(id,p,'坐下 / 起身观看球场',()=>{seated=!seated;setEye(seated?1.05:1.7);toast(seated?'已坐下。再次按 F 或移动即可起身。':'已起身。');},3.2);
 button.onclick=()=>activate();
 function activate(){if(selected?.door){selected.door.hold=!selected.door.hold;toast(selected.door.hold?'自动门保持开启。':'自动门恢复感应。');}else selected?.act();document.getElementById('scene').focus({preventScroll:true});}
 function stand(){if(seated){seated=false;setEye(1.7);}}
 return{colliders,activate,stand,isAnimating:()=>doors.some(d=>Math.abs(d.angle-(d.target||0))>.003),update(position,dt,mode){root.visible=true;for(const d of doors){const distance=Math.hypot(position.x-d.x,position.z-d.z),close=distance<3.3&&Math.abs(position.y-d.y-1.7)<2.2,target=d.hold||close?Math.PI/2:0;d.target=target;d.angle=THREE.MathUtils.damp(d.angle,target,9,dt);d.hinge.rotation.y=d.angle;d.collider.enabled=d.angle<1.05;}
  clock+=dt;if(clock<.15)return;clock=0;if(mode!=='walk'){button.hidden=true;return;}const nearby=items.filter(i=>position.distanceTo(i.p)<i.radius).sort((a,b)=>position.distanceToSquared(a.p)-position.distanceToSquared(b.p));selected=nearby[0]||null;
  if(!selected){const d=doors.find(d=>Math.hypot(position.x-d.x,position.z-d.z)<3&&Math.abs(position.y-d.y-1.7)<1.8);if(d)selected={door:d,label:d.hold?'恢复感应自动门':'让自动门保持开启'};}
  if(!selected&&serviceRooms){const d=serviceRooms.nearest(position);if(d)selected={id:d.id,label:d.open?'关闭服务间双门':'打开服务间双门',act:()=>toast(serviceRooms.toggle(d)?'服务间双门已打开，可以走进去查看。':'服务间双门将关闭。')};}
  button.hidden=!selected;if(selected)button.textContent='F · '+selected.label;document.body.dataset.interaction=selected?.id||selected?.door?.id||'';
 }};
}
