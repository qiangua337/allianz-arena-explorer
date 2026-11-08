import {museumTargets} from './museum-targets.js';
import {chooseInteraction,focusBox,pointAhead} from './interaction-focus.js';
import {createSeatInteraction} from './seat-interaction.js';
import {addClubAward} from './trophy-gallery.js';
import {openMuseumCatalog,openMuseumExhibit} from './museum-catalog.js';
import {THREE,v,mat,mesh,box,sign,Batches,compactGroup} from './kit.js';
import {buildShopDisplay} from './shop-display.js';
import {doorCollider,updateAutomaticDoor} from './automatic-door.js';
import {roomSpecs} from './building-layout.js';
export function buildInteractions(scene,interiors,{toast,navigate,showInfo,setEye,serviceRooms,seats=[],onSit,onStand,onFocusSeat,openPersonal=openMuseumExhibit,openCatalogue=openMuseumCatalog}){
 const root=new THREE.Group();root.name='Working doors and interactive exhibits';scene.add(root);const button=document.getElementById('interact'),colliders=[],doors=[],items=[],direction=v(),previousPosition=v(Infinity,0,0),previousDirection=v(),pickerRay=new THREE.Raycaster(),pickerMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});let selected=null,tactic=0,currentPosition=null,currentCamera=null,currentMode='orbit',previousMode='',focusChanged=false,painted='';
 const seating=createSeatInteraction(seats,{onSit:session=>{if(onSit)onSit(session);else setEye?.(1.05);toast('已入座。再次按 F 或移动即可起身。');},onStand:session=>{if(onStand)onStand(session);else setEye?.(1.7);}});
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:0xe3c482,transparent:true,opacity:.72,depthWrite:false}));outline.name='Aimed exhibit outline';outline.visible=false;outline.renderOrder=4;root.add(outline);
 const red=mat(0x9b1a34),glass=mat(0xa1c6cc,{transparent:true,opacity:.19,roughness:.2}),metal=mat(0xa9b9bd,{metalness:.6});
 const tracks=new Batches(root);
 const names={homeRoom:'主队更衣室',guestRoom:'客队更衣室',press:'新闻发布厅',lounge:'贵宾包厢',store:'球迷商店',museum:'荣誉展厅'};
 for(const[id,s]of Object.entries(roomSpecs)){
  const z=id==='lounge'?-10.5:s.z,x=s.x+s.w/2,hinge=new THREE.Group();hinge.name=id+' automatic door';hinge.position.set(x+.16,s.y,z-1.15);root.add(hinge);const leaf=box(hinge,.07,2.9,2.3,0,1.45,1.15,id==='homeRoom'||id==='guestRoom'?red:glass);leaf.name='Solid moving door leaf';const frame=new Batches(hinge);for(const zz of[.045,2.255])frame.add(.085,2.9,.065,0,1.45,zz,metal);for(const yy of[.055,2.845])frame.add(.085,.085,2.2,0,yy,1.15,metal);for(const side of[-1,1]){frame.add(.08,.42,.055,side*.08,1.35,2.0,metal);const label=sign(hinge,names[id],1.45,.21,side*.048,2.15,1.15,{font:67,fg:'#f0e9dc',bg:'#36454c'});label.rotation.y=side*Math.PI/2;}frame.flush();compactGroup(hinge,[leaf]);
  tracks.add(.16,.09,4.8,x+.16,s.y+3.01,z-1.175,metal);
  const board=sign(root,names[id]+' · 自动门',2,.32,x+.13,s.y+3.15,z,{bg:'#354e57',font:70});board.rotation.y=Math.PI/2;
  const collider=doorCollider(x,z,s.y,0,id);colliders.push(collider);doors.push({id,x,z,y:s.y,hinge,opening:0,hold:false,collider});
 }
 tracks.flush();
 function item(id,p,label,act,radius=2.8,target={}){const entry={id,p:v(...p),label,act,reach:radius,focusBoxes:[focusBox(...p,1,1.15,1)],...target};items.push(entry);return entry;}
 item('welcome',[4,-1.2,110],'咨询下一站路线',()=>showInfo('从大厅继续参观','沿入口层环廊到东侧室内楼梯，上楼可到公共大厅、商店、展厅、包厢和三层看台。球员区域可由草坪西侧红色通道步行进入。',['concourse','store','museum','lounge','stands','pitch']));
 item('tactics',[-74,-1,-4.3],'切换战术板阵型',()=>{tactic=1-tactic;interiors.setTactics?.(tactic);toast('战术板：'+(tactic?'4–4–2':'4–2–3–1'));});
 for(const target of museumTargets){const h=target.exhibit;if(target.type==='club')item(target.id,[-96+h.x,13.5,58+h.z],'球队荣誉 · '+h.year+' · '+h.title,()=>showInfo(h.year+' · '+h.title,h.opponent+' · '+h.score+'。'+h.detail,[],h),target.reach,target);else if(target.type==='personal')item(target.id,[-96+h.x,13.6,58+h.z],h.name+' · '+h.award+' · '+h.years,()=>openPersonal(h.id),target.reach,target);else item(target.id,[-89,13.7,60.65],'打开展览目录',openCatalogue,target.reach,target);}
 // CPU-only pick meshes use the same award builder as the visible gallery.
 // They never enter the rendered scene, and omit the empty glass enclosure.
 for(const target of items.filter(i=>i.type==='club')){const h=target.exhibit,probe=new THREE.Group(),x=-96+h.x,z=58+h.z;mesh(new THREE.BoxGeometry(1.74,1.28,1.74),pickerMaterial,probe,x,12.64,z);const award=new THREE.Group();award.position.set(x,13.295,z);award.rotation.y=h.x<0?Math.PI/2:-Math.PI/2;probe.add(award);addClubAward(award,h.kind,{silver:pickerMaterial,gold:pickerMaterial,dark:pickerMaterial,gem:pickerMaterial});probe.updateMatrixWorld(true);target.hitTest=(origin,ray)=>{pickerRay.set(origin,ray);const hit=pickerRay.intersectObject(probe,true)[0];return hit?hit.distance:null;};}
 document.getElementById('museum-catalog').onclick=openCatalogue;
 const shop=buildShopDisplay(root,metal),shopSpec=roomSpecs.store;
 const shirtTarget=item('shirt',[shop.position.x,shop.position.y,shop.position.z],shop.player.number+' '+shop.player.name+' · 换一件球衣',()=>{const player=shop.next();shirtTarget.label=player.number+' '+player.name+' · 换一件球衣';toast(player.number+' · '+player.fullName+'｜可继续切换球衣、查看实体姓名牌。');},2.8,{region:{x0:shopSpec.x-shopSpec.w/2,x1:shopSpec.x+shopSpec.w/2,y0:shopSpec.y+.5,y1:shopSpec.y+3,z0:shopSpec.z-shopSpec.d/2,z1:shopSpec.z+shopSpec.d/2},focusBoxes:[focusBox(shop.position.x,shop.position.y,shop.position.z,1,1.15,1)]});
 button.onclick=()=>activate();
 function refreshSelection(force=false){
  if(currentCamera)currentCamera.getWorldDirection(direction);if(!force&&currentPosition&&currentMode===previousMode&&currentPosition.distanceToSquared(previousPosition)<1e-10&&direction.distanceToSquared(previousDirection)<1e-10)return;
  if(currentPosition)previousPosition.copy(currentPosition);previousDirection.copy(direction);previousMode=currentMode;
  const before=selected?.id||selected?.door?.id||'';selected=null;
  if(currentMode==='walk'&&currentPosition){selected=seating.session?{id:seating.session.id,label:'起身继续参观',act:()=>{seating.stand();toast('已起身。');}}:chooseInteraction(items,currentPosition,currentCamera?direction:null);
   if(!selected){const d=doors.find(d=>Math.hypot(currentPosition.x-d.x,currentPosition.z-d.z)<3&&Math.abs(currentPosition.y-d.y-1.7)<1.8&&(!currentCamera||pointAhead(currentPosition,direction,{x:d.x,y:d.y+1.5,z:d.z})));if(d)selected={door:d,label:d.hold?'恢复感应自动门':'让自动门保持开启'};}
   if(!selected&&serviceRooms){const d=serviceRooms.nearest(currentPosition);if(d&&(!currentCamera||pointAhead(currentPosition,direction,{x:d.x,y:d.y+1.5,z:d.z})))selected={id:d.id,label:d.open?'关闭服务间双门':'打开服务间双门',act:()=>toast(serviceRooms.toggle(d)?'服务间双门已打开，可以走进去查看。':'服务间双门将关闭。')};}
   // A nearby bowl chair behind skybox glazing or a room wall is not an
   // entrance. Exhibits and working doors keep priority over seat discovery.
   const insideRoom=Object.values(roomSpecs).some(s=>Math.abs(currentPosition.x-s.x)<s.w/2+.05&&Math.abs(currentPosition.z-s.z)<s.d/2+.05&&Math.abs(currentPosition.y-s.y-1.7)<2.6);
   if(!selected&&!insideRoom){const seat=seating.pick(currentPosition,currentCamera?direction:null);if(seat)selected={...seat,label:'坐下观看球场',act:()=>seating.sit(seat,currentPosition)};
    else if(onFocusSeat){const nearby=seating.nearest(currentPosition);if(nearby)selected={id:'focus-'+nearby.id,label:'附近座位 · 看过去',act:()=>onFocusSeat({seat:nearby.seat,target:nearby.target})};}
   }
  }
  const id=selected?.id||selected?.door?.id||'',label=selected?'F · '+selected.label:'';focusChanged=before!==id;
  if(id+'|'+label!==painted){painted=id+'|'+label;button.hidden=!selected;if(selected)button.textContent=label;document.body.dataset.interaction=id;document.body.dataset.interactionLabel=selected?.label||'';}
  outline.visible=!!selected?.highlight;if(outline.visible){const b=selected.highlight;outline.position.set((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);outline.scale.set(b.x1-b.x0+.02,b.y1-b.y0+.02,b.z1-b.z0+.02);}
 }
 function activate(){refreshSelection(true);if(!selected)return false;if(selected.door){selected.door.hold=!selected.door.hold;toast(selected.door.hold?'自动门保持开启。':'自动门恢复感应。');}else selected.act();refreshSelection(true);if(!document.querySelector?.('dialog[open]'))document.getElementById('scene').focus({preventScroll:true});return true;}
 function stand(){const changed=seating.stand();if(changed)refreshSelection(true);return changed;}
 return{colliders,activate,stand,get seated(){return !!seating.session;},get seatSession(){return seating.session;},isAnimating:()=>focusChanged||doors.some(d=>Math.abs(d.opening-(d.target||0))>.003),update(position,dt,mode,camera=null){focusChanged=false;currentPosition=position;currentCamera=camera;currentMode=mode;root.visible=true;for(const d of doors)updateAutomaticDoor(d,position,dt);shop.update(position);
  document.getElementById('museum-catalog').hidden=!(Math.abs(position.x+96)<8.2&&Math.abs(position.z-58)<13.2&&Math.abs(position.y-13.7)<3);refreshSelection();
 }};
}
