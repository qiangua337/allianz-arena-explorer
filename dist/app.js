import {buildDestinationMenu} from './destinations.js';
import {buildMatchdayExperience} from './matchday.js';
import {buildFrameBudget,freezeArchitecture} from './scene-budget.js';
import {buildWalkBuilding} from './walk-building.js';
import {buildLightBudget} from './performance.js';
import {buildInteractions} from './interactions.js';
import {tourNodes,tourGoals} from './tour-route.js';
import {inCoreShaft} from './building-layout.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {v,TAU,superpoint,seeded,loadBrandAssets,prepareMaterialLighting} from './kit.js';
import {EYE_HEIGHT,mainEntrance,esplanadeHeight,floorHeight,hitsWall} from './navigation.js';
import {accessStairs} from './access-layout.js';
import {rosterInfo} from './roster.js';
import {buildStadium} from './stadium.js';
import {buildWorld,esplanadeY} from './world.js';
import {buildInteriors,roomSpecs} from './interiors.js';
import {buildWalkGuide,floorLabel} from './walk-guide.js';
import {routeOnCurrentLevel} from './walk-path.js';
import {normalizeDestination,destinationArrival} from './arrivals.js';
import {advanceWalker} from './walk-motion.js';
import {buildServiceRooms} from './service-rooms.js';
import {serviceRoomAt} from './service-layout.js';

const $=id=>document.getElementById(id),canvas=$('scene');
const places={
 exterior:{title:'Allianz Arena',tag:'THE EXTERIOR',desc:'一座属于红色的足球殿堂。拖动视角，开始你的主场之旅。',pos:[251,174,307],target:[0,18,0],walk:[mainEntrance.x,esplanadeHeight(mainEntrance.z)+.055+EYE_HEIGHT,mainEntrance.z],look:mainEntrance.look,accuracy:'公开资料参考复原'},
 esplanade:{title:'南侧广场',tag:'THE ESPLANADE',desc:'沿着停车场上方起伏的绿色步道，走近慕尼黑的足球地标。',pos:[195,140,487],target:[0,-2,286],walk:[-32,esplanadeY(280)+1.7,280],look:[0,15,0],accuracy:'周边建筑与地形近似'},
 arcade:{title:'入口大厅',tag:'THE ENTRANCE ARCADE',desc:'沿着铺装环廊，经过服务窗口、导视、休息区和通往上一层的楼梯。',pos:[36,.2,113],target:[64,0,98],walk:[36,-1.2,110],look:[64,-.4,98],accuracy:'入口层与设施 · 公开资料近似'},
 visitorEntry:{title:'参观通道',tag:'THE VISITOR PASSAGE',desc:'从接待大厅右侧的红色入口进入，沿金色地线和灯带，步行走向草坪与看台。',pos:[22,-.7,112],target:[22,-.8,84],walk:[22,-1.2,111],look:[22,-1.1,79],accuracy:'参观通路 · 布局近似'},
 access:{title:'入场楼梯',tag:'THE ACCESS STAIRS',desc:'八组带扶手和踏步标线的楼梯，把入口层与公共大厅连接起来。',pos:[accessStairs[1].x+10,6,accessStairs[1].z+15],target:[accessStairs[1].topX,10,accessStairs[1].topZ],walk:[accessStairs[1].x+accessStairs[1].nx*2,-1.2,accessStairs[1].z+accessStairs[1].nz*2],look:[accessStairs[1].topX,3.5,accessStairs[1].topZ],accuracy:'通行动线与构造 · 布局近似'},
 stands:{title:'三层看台',tag:'INSIDE THE BOWL',desc:'逐级抬升的看台、红白座椅、悬挑桁架。站在这里，想象全场呐喊。',pos:[-60,25,43],target:[8,9,-3],walk:[-60,10,38],look:[0,3,0],accuracy:'比例与坡度参考官方'},
 pitch:{title:'草坪',tag:'ON THE PITCH',desc:'从中圈到球门，体验 105 × 68 米草坪与四周看台的真实尺度。',pos:[29,7.5,42],target:[0,9,-20],walk:[0,1.7,13],look:[0,3,-48],accuracy:'草坪尺寸按米建模'},
 tunnel:{title:'球员通道',tag:'THE PLAYERS’ TUNNEL',desc:'红色几何墙面、白色长灯带、向上的台阶。前方，就是草坪。',pos:[-63,-1.02,.3],target:[-42,-.7,0],walk:[-63,-1,0],look:[-39,0,0],accuracy:'参考用户视频 · 布局近似'},
 homeRoom:{title:'主队更衣室',tag:'FC BAYERN DRESSING ROOM',desc:'红色更衣柜、悬挂球衣、木质长凳、球鞋与战术板。走进比赛前的空间。',pos:[-75.8,-.9,5.8],target:[-85.3,-1,0],walk:[-76.2,-1,4.6],look:[-88,-.9,-3],accuracy:'现役一线队 · 名单核对 '+rosterInfo.checked},
 guestRoom:{title:'客队更衣室',tag:'GUEST DRESSING ROOM',desc:'客队衣柜、备战长桌与相邻淋浴区，以球场功能和参观资料作近似还原。',pos:[-76,-.9,33.5],target:[-86,-1,27],walk:[-76,-1,32],look:[-89,-.8,25],accuracy:'内部陈设与布局近似'},
 press:{title:'新闻发布厅',tag:'THE PRESS CONFERENCE',desc:'发布台、采访麦克风、赞助背景与媒体座席。来到赛后新闻发布空间。',pos:[-82,.35,-23.3],target:[-82,-1.05,-37],walk:[-82,-.3,-23.5],look:[-82,-1,-37],accuracy:'参考用户视频 · 布局近似'},
 lounge:{title:'贵宾包厢',tag:'HOSPITALITY & SKYBOX',desc:'透过落地玻璃俯瞰草坪，近看餐桌、吧台与看台之间的细节。',pos:[93,25.2,11.8],target:[86.2,25,-2],walk:[90,25.3,7],look:[0,4,0],accuracy:'代表性包厢 · 陈设近似'},
 museum:{title:'荣誉展厅',tag:'A GALLERY OF HONOURS',desc:'六座欧洲冠军杯的年份、银色奖杯、玻璃展柜与俱乐部历史陈列。',pos:[-101.7,13.9,68.5],target:[-96,13.4,55],walk:[-93,13.7,67],look:[-96,13.8,48],accuracy:'代表性荣誉展厅 · 布局近似'},
 concourse:{title:'环形公共大厅',tag:'THE PUBLIC CONCOURSE',desc:'沿着环形大厅，经过餐饮柜台、分区入口和场馆导视。',pos:[94,13.9,-47],target:[96,14,-12],walk:[94,13.9,-47],look:[96,14,-12],accuracy:'环形公共空间 · 陈设近似'},
 store:{title:'球迷商店',tag:'FC BAYERN STORE',desc:'球衣衣架、红白围巾、装备陈列与服务台。走进球迷商店。',pos:[9.5,14.05,123.2],target:[-3,13.8,116.2],walk:[0,13.9,123],look:[0,14,113],accuracy:'代表性球迷商店 · 布局近似'}
};
const frameBudget=buildFrameBudget();let drawnFrames=0;
let building,lightBudget,interactions,serviceRooms,matchday,matchSnapshot=null,matchStarting=false,qualityScale=1,pixelBudget=1,recoveryFrames=0;
let renderer,scene,camera,controls,stadium,world,interiors,walkGuide,sky,stars,dayLight,arenaFill,hemi,ambient;
let active='exterior',mode='orbit',night=false,transition=null,tourOn=false,tourElapsed=0,tourIndex=0,toastTimer;
let yaw=0,pitch=0,dragging=false,lastPointer=null,walkReady=false,clock={time:performance.now(),getDelta(){const now=performance.now(),d=(now-this.time)/1000;this.time=now;return d;}},elapsed=0,frames=0,lastPerf=0,frameMs=0;
let desiredEye=EYE_HEIGHT,walkFeet=null,pointerLockPending=false;const keys=new Set(),moveFlags=new Set(),movementPointers=new Map();const forward=v(),right=v(),step=v(),temp=v(),walkPosition=v();const ray=new THREE.Raycaster();
const mediaReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchAxes={x:0,y:0};let touchSprint=false,joystickPointer=null;
// Orbit previews must never become the starting point of a walking route.
const walker={position:v(...places.exterior.walk),yaw:0,pitch:0,visited:false};
const walkGeometry=()=>({tiers:stadium.tiers,rooms:roomSpecs});
const navigationPosition=()=>mode==='walk'?walkPosition.set(camera.position.x,(walkFeet??camera.position.y-desiredEye)+desiredEye,camera.position.z):walker.position;
const toast=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);};

async function init(){
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});}catch(error){$('load-status').innerHTML='当前浏览器未能启用 WebGL。请使用支持硬件加速的 Chrome / Edge 打开。';document.querySelector('.load-track').hidden=true;console.error(error);return;}
 setQuality();renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 prepareMaterialLighting(renderer);scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xb8cbd6,.00082);
 camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,4500);camera.position.fromArray(places.exterior.pos);
 controls=new OrbitControls(camera,canvas);controls.target.fromArray(places.exterior.target);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=1.1;controls.maxDistance=1000;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.5;controls.enablePan=true;controls.update();
 controls.addEventListener('start',()=>{transition=null;if(tourOn)stopTour();});
 hemi=new THREE.HemisphereLight(0xdae9ff,0x686f54,2.1);ambient=new THREE.AmbientLight(0xffffff,.45);dayLight=new THREE.DirectionalLight(0xffeed5,3.1);dayLight.position.set(-180,270,170);dayLight.castShadow=true;dayLight.shadow.mapSize.set(2048,2048);Object.assign(dayLight.shadow.camera,{left:-165,right:165,top:180,bottom:-170,near:1,far:750});dayLight.shadow.bias=-.0003;dayLight.shadow.normalBias=.15;dayLight.target.position.set(0,0,0);scene.add(hemi,ambient,dayLight,dayLight.target);
 arenaFill=new THREE.DirectionalLight(0xdce7f5,.25);arenaFill.position.set(130,110,-150);scene.add(arenaFill);buildSky();
 $('load-status').textContent='正在加载队徽与场景…';await loadBrandAssets();
 world=buildWorld(scene);stadium=buildStadium(scene);interiors=buildInteriors(scene,stadium.circulation);
 building=buildWalkBuilding(scene);serviceRooms=buildServiceRooms(scene);walkGuide=buildWalkGuide(scene,walkGeometry(),{obstacles:{world:world.colliders,building:building.colliders,interiors:interiors.colliders,circulation:stadium.circulation.colliders,service:serviceRooms.walls},onChoose:()=>setNavOpen(true),onSelect:id=>{stopTour();goPlace(id,false);},onWalk:followDestination,onTeleport:teleportToDestination});interactions=buildInteractions(scene,interiors,{toast,serviceRooms,navigate:id=>goPlace(id),setEye:y=>desiredEye=y,showInfo:showInteractiveInfo});lightBudget=buildLightBudget(scene);matchday=buildMatchdayExperience({scene,stadium,reducedMotion:mediaReduced,mobile:innerWidth<=1024,toast,onBegin:beginMatchday,onPose:applyEntrancePose,onFinish:finishMatchdayEntrance,onVisitBench:visitMatchdayBench,onExit:restoreFromMatchday,onPrepare:root=>renderer.compileAsync(root,camera,scene),onPause:value=>{clearWalkInput();setWalkReady(!value);}});
 freezeArchitecture(world.group,[world.rotor]);freezeArchitecture(stadium.root);freezeArchitecture(stadium.circulation.root);freezeArchitecture(interiors.root);freezeArchitecture(building.root);buildDestinationMenu();buildHotspots();bindUI();setNavOpen(false);document.body.dataset.mode=mode;setDayNight(false);clock.time=performance.now();document.body.dataset.version='1.9.0';document.body.dataset.seats=stadium.seatCount;document.body.dataset.panels=stadium.panelCount;
 const initial=new URLSearchParams(location.search);if(initial.get('night')==='1')setDayNight(true);const place=initial.get('place');if(initial.get('view')==='walk')setMode('walk',{place:place&&(places[place]||tourGoals[place])?place:'arcade'});else if(place&&(places[place]||tourGoals[place]))goPlace(place,false);
 $('load-status').textContent='正在准备室内与室外画面…';await renderer.compileAsync(scene,camera);document.body.dataset.ready='true';clock.time=performance.now();renderer.setAnimationLoop(render);requestAnimationFrame(()=>{$('loading').classList.add('finished');$('load-status').textContent='场景已就绪';});
 window.addEventListener('resize',resize);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('图形上下文已暂停，请重新加载页面恢复。');});
}

function buildSky(){
 const uniform={top:{value:new THREE.Color(0x7e9db4)},bottom:{value:new THREE.Color(0xdfe8e6)},sunDirection:{value:v(-.45,.7,.45).normalize()},night:{value:0}};
 const sm=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:uniform,vertexShader:'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDirection; uniform float night; varying vec3 vDir; void main(){vec3 d=normalize(vDir); float t=pow(max(d.y,0.0),0.5);vec3 c=mix(bottom,top,t);float s=pow(max(dot(d,sunDirection),0.0),250.0); c+=vec3(1.0,.85,.6)*s*(1.0-night)*1.3; gl_FragColor=vec4(c,1.0); #include <tonemapping_fragment> #include <colorspace_fragment> }'});
 // Shader includes must begin on their own lines.
 sm.fragmentShader=sm.fragmentShader.replaceAll(' #include','\n#include').replace('> }','>\n}');sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),sm);sky.renderOrder=-10;scene.add(sky);
 const random=seeded(49),pos=[];for(let i=0;i<1500;i++){const t=random()*TAU,y=random(),r=Math.sqrt(1-y*y)*1900;pos.push(Math.cos(t)*r,y*1900,Math.sin(t)*r);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xd9e6f9,size:1.35,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));stars.visible=false;scene.add(stars);
}

function setDayNight(n){frameBudget.invalidate();night=n;document.body.dataset.environment=n?'night':'day';$('day').classList.toggle('active',!n);$('night').classList.toggle('active',n);$('day').setAttribute('aria-pressed',String(!n));$('night').setAttribute('aria-pressed',String(n));hemi.intensity=n?.72:1.25;hemi.color.set(n?0x9aadc5:0xdae9ff);hemi.groundColor.set(n?0x3e4539:0x686f54);ambient.intensity=n?.30:.22;dayLight.intensity=n?.22:2.65;dayLight.color.set(n?0x7497d1:0xffeed5);scene.fog.color.set(n?0x081423:0xb8cbd6);scene.fog.density=n?.0012:.00082;sky.material.uniforms.top.value.set(n?0x020817:0x7e9db4);sky.material.uniforms.bottom.value.set(n?0x14243b:0xdfe8e6);sky.material.uniforms.night.value=n?1:0;stars.visible=n;renderer.toneMappingExposure=n?1.12:1.05;stadium.night(n);world.night(n);interiors.night(n);}

function beginMatchday({cinematic}){
 matchStarting=true;
 if(!matchSnapshot)matchSnapshot={mode,active,night,position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),fov:camera.fov,yaw,pitch,walkFeet,desiredEye,ready:walkReady,guide:walkGuide.captureState(),roof:$('roof').checked,map:!document.querySelector('.minimap').hidden,hud:document.body.classList.contains('hud-hidden'),walker:{position:walker.position.clone(),yaw:walker.yaw,pitch:walker.pitch,visited:walker.visited}};
 stopTour();$('info-dialog').close();document.body.classList.remove('hud-hidden');$('toggle-hud').setAttribute('aria-pressed','false');$('toggle-hud').setAttribute('aria-label','隐藏界面');if(cinematic){if(mode!=='walk')setMode('walk',{place:'pitch'});goPlace('pitch',false);setDayNight(true);$('roof').checked=true;stadium.roof.visible=true;stadium.circulation.setRoof(true);interiors.setRoof(true);document.querySelector('.minimap').hidden=true;$('map-toggle').setAttribute('aria-expanded','false');}walkGuide.setSuppressed(cinematic);clearWalkInput();setWalkReady(true);matchStarting=false;updateLocationURL();frameBudget.invalidate();
}
function applyEntrancePose(sample,{instant=false,dt=.016}={}){
 camera.position.x=sample.x;camera.position.z=sample.z;const y=sample.feet+EYE_HEIGHT+sample.bob;camera.position.y=instant?y:THREE.MathUtils.damp(camera.position.y,y,18,dt);walkFeet=sample.feet;desiredEye=EYE_HEIGHT;yaw=sample.yaw;pitch=sample.pitch;camera.rotation.set(pitch,yaw,0,'YXZ');if(Math.abs(camera.fov-sample.fov)>.02){camera.fov=sample.fov;camera.updateProjectionMatrix();}if(instant)walkGuide.setGoal('pitch',camera.position);frameBudget.invalidate();
}
function finishMatchdayEntrance({manual=false}={}){clearWalkInput();camera.fov=66;camera.updateProjectionMatrix();syncAngles();walkFeet=floorAt(camera.position.x,camera.position.z);walkGuide.setSuppressed(false);if(manual)walkGuide.setGoal('pitch',camera.position);else walkGuide.arrive('pitch',camera.position);setWalkReady(true);canvas.focus({preventScroll:true});frameBudget.invalidate();}
function visitMatchdayBench(){teleportToDestination('pitch');camera.position.set(-33.2,1.7,-18);camera.lookAt(-38.5,1.25,-18);syncAngles();walkFeet=0;walker.position.copy(camera.position);walker.yaw=yaw;walker.pitch=pitch;walkGuide.arrive('pitch',camera.position);frameBudget.invalidate();}
function restoreFromMatchday(){
 const saved=matchSnapshot;if(!saved)return;matchSnapshot=null;clearWalkInput();if(mode!==saved.mode)setMode(saved.mode,{place:saved.active});goPlace(saved.active,false);camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.updateProjectionMatrix();controls.target.copy(saved.target);if(mode==='orbit')controls.update();yaw=saved.yaw;pitch=saved.pitch;walkFeet=saved.walkFeet;desiredEye=saved.desiredEye;walker.position.copy(saved.walker.position);Object.assign(walker,{yaw:saved.walker.yaw,pitch:saved.walker.pitch,visited:saved.walker.visited});setDayNight(saved.night);$('roof').checked=saved.roof;stadium.roof.visible=saved.roof;stadium.circulation.setRoof(saved.roof);interiors.setRoof(saved.roof);document.querySelector('.minimap').hidden=!saved.map;$('map-toggle').setAttribute('aria-expanded',String(saved.map));document.body.classList.toggle('hud-hidden',saved.hud);$('toggle-hud').setAttribute('aria-pressed',String(saved.hud));$('toggle-hud').setAttribute('aria-label',saved.hud?'显示界面':'隐藏界面');walkGuide.setSuppressed(false);walkGuide.restoreState(saved.guide,navigationPosition(),desiredEye);setWalkReady(saved.ready);updateLocationURL();frameBudget.invalidate();
}

function goPlace(id,animate=true){
 if(matchday?.cinematic&&!matchStarting)matchday.stopFollowing();
 const p=places[id]||(tourGoals[id]?{...(id==='entrance'?places.exterior:places.stands),title:tourGoals[id]}:null);if(!p)return;setNavOpen(false);clearWalkInput();active=id;document.body.dataset.place=id;document.querySelectorAll('.location').forEach(b=>{const on=b.dataset.place===id;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'location':'false');});$('place-title').textContent=p.title;$('place-tag').textContent=p.tag;$('place-desc').textContent=p.desc;$('accuracy-tag').textContent=p.accuracy;
 walkGuide.setGoal(normalizeDestination(id),navigationPosition(),mode==='walk'?desiredEye:EYE_HEIGHT);
 if(mode==='walk'){setWalkReady(true);canvas.focus({preventScroll:true});transition=null;toast('已设置步行路线：'+(tourGoals[id]||p.title));}else{
  controls.maxPolarAngle=roomSpecs[id]||id==='tunnel'||id==='concourse'?Math.PI*.8:Math.PI*.61;
  const dest=v(...p.pos),target=v(...p.target);if(animate&&!mediaReduced&&!roomSpecs[id]&&id!=='tunnel'&&id!=='concourse'){transition={from:camera.position.clone(),to:dest,startTarget:controls.target.clone(),target,time:0,duration:1.65};}else{camera.position.copy(dest);controls.target.copy(target);controls.update();transition=null;}
  if(!tourOn)toast('已选择：'+(tourGoals[id]||p.title)+' · 可步行或传送');
 }
 walkGuide.update(navigationPosition(),mode==='walk'?yaw:walker.yaw,.12,mode,mode==='walk'?desiredEye:EYE_HEIGHT);
 $('autorotate').checked=false;controls.autoRotate=false;updateLocationURL();
}

function syncAngles(){const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=e.y;pitch=e.x;}
function clearWalkInput(){keys.clear();moveFlags.clear();movementPointers.clear();touchAxes.x=touchAxes.y=0;joystickPointer=null;if($('joystick-thumb'))$('joystick-thumb').style.transform='none';dragging=false;lastPointer=null;document.body.classList.remove('looking');}
function setNavOpen(open){$('explore').hidden=!open;$('nav-trigger').setAttribute('aria-expanded',String(open));$('guide-goal').setAttribute('aria-expanded',String(open));document.body.classList.toggle('nav-open',open);if(open){clearWalkInput();if(document.pointerLockElement===canvas)document.exitPointerLock?.();}}
function toggleMap(){const panel=document.querySelector('.minimap');panel.hidden=!panel.hidden;$('map-toggle').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)drawMap();}
function toggleHUD(){setNavOpen(false);const hidden=document.body.classList.toggle('hud-hidden');$('toggle-hud').setAttribute('aria-pressed',String(hidden));$('toggle-hud').setAttribute('aria-label',hidden?'显示界面':'隐藏界面');}
function setWalkReady(ready){walkReady=mode==='walk'&&ready;document.body.dataset.walking=String(walkReady);$('walk-prompt').hidden=mode!=='walk'||walkReady;if(!walkReady)clearWalkInput();}
function updateLookHint(){const locked=document.pointerLockElement===canvas;document.body.dataset.look=locked?'locked':'drag';const label=$('look-hint'),button=$('lock-pointer');if(label)label.textContent=locked?'移动鼠标转头':'按住画面转头 · Q/E 转向';if(button){button.textContent=locked?'释放鼠标':'锁定鼠标';button.disabled=pointerLockPending;}}
function setMode(next,{place}={}){
 if(matchday?.cinematic&&!matchStarting)matchday.stopFollowing();
 if(!camera)return;if(next===mode){if(next==='walk')beginWalk();return;}
 if(mode==='walk'){walker.position.copy(navigationPosition());walker.position.y+=EYE_HEIGHT-desiredEye;walker.yaw=yaw;walker.pitch=pitch;walker.visited=true;interactions.stand();desiredEye=EYE_HEIGHT;}
 mode=next;document.body.dataset.mode=next;transition=null;clearWalkInput();setNavOpen(false);controls.enabled=next==='orbit';controls.autoRotate=false;$('autorotate').checked=false;
 $('orbit-mode').classList.toggle('active',next==='orbit');$('walk-mode').classList.toggle('active',next==='walk');$('orbit-mode').setAttribute('aria-pressed',String(next==='orbit'));$('walk-mode').setAttribute('aria-pressed',String(next==='walk'));$('movement').hidden=next!=='walk';$('crosshair').hidden=next!=='walk';
 if(next==='walk'){
  stopTour();camera.fov=66;camera.updateProjectionMatrix();$('hint').innerHTML='<span>WASD 移动 · Shift 加速</span><i></i><span id="look-hint">按住画面转头 · Q/E 转向</span><i></i><button id="lock-pointer">锁定鼠标</button><i></i><button id="entrance">回到正门</button>';$('lock-pointer').onclick=lockMouse;$('entrance').onclick=spawnEntrance;camera.position.copy(walker.position);walkFeet=walker.position.y-EYE_HEIGHT;yaw=walker.yaw;pitch=walker.pitch;camera.rotation.set(pitch,yaw,0,'YXZ');desiredEye=EYE_HEIGHT;goPlace(place||((active==='exterior'&&!walker.visited)?'arcade':walkGuide.getGoal()),false);updateLookHint();
 }else{
  document.exitPointerLock?.();setWalkReady(false);camera.fov=48;camera.updateProjectionMatrix();$('hint').innerHTML='<span>↔ 拖动环绕</span><i></i><span>⌕ 滚轮缩放</span><i></i><button id="reset">↺ 重置视角</button>';$('reset').onclick=()=>goPlace(active);goPlace(active,false);
 }
 updateLocationURL();
}
function spawnEntrance(){interactions?.stand();desiredEye=EYE_HEIGHT;camera.position.fromArray(places.exterior.walk);walkFeet=camera.position.y-EYE_HEIGHT;camera.lookAt(v(...mainEntrance.look));syncAngles();goPlace('arcade',false);setWalkReady(true);canvas.focus({preventScroll:true});}
function followDestination(){if(mode!=='walk')setMode('walk',{place:walkGuide.getGoal()});else{walkGuide.reset(navigationPosition());beginWalk();}}
function teleportToDestination(id=walkGuide.getGoal()){
 const arrival=destinationArrival(id,walkGeometry());stopTour();if(mode!=='walk')setMode('walk',{place:arrival.goal});
 clearWalkInput();interactions.stand();desiredEye=EYE_HEIGHT;transition=null;camera.position.fromArray(arrival.position);walkFeet=arrival.feet;camera.lookAt(v(...arrival.look));syncAngles();
 goPlace(arrival.goal,false);walkGuide.arrive(arrival.goal,camera.position);walker.position.copy(camera.position);walker.yaw=yaw;walker.pitch=pitch;walker.visited=true;
 beginWalk();toast('已传送到：'+tourGoals[arrival.goal]);
}
function beginWalk(){if(mode!=='walk')return;setNavOpen(false);setWalkReady(true);canvas.focus({preventScroll:true});updateLookHint();}
async function lockMouse(){
 if(mode!=='walk'||pointerLockPending)return;if(document.pointerLockElement===canvas){document.exitPointerLock?.();return;}
 beginWalk();if(!canvas.requestPointerLock){toast('按住画面即可转头，WASD 可直接移动。');return;}
 pointerLockPending=true;updateLookHint();try{await canvas.requestPointerLock();}catch{toast('鼠标未锁定，可继续按住画面转头。');}finally{pointerLockPending=false;updateLookHint();}
}
function turn(dx,dy,sensitivity=.003){yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*sensitivity,-1.44,1.44);camera.rotation.set(pitch,yaw,0,'YXZ');}
function keyCode(event){const aliases={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',q:'KeyQ',e:'KeyE',p:'KeyP',n:'KeyN',h:'KeyH',f:'KeyF',t:'KeyT',up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',escape:'Escape',esc:'Escape',shift:'ShiftLeft'};return event.code&&event.code!=='Unidentified'?event.code:(aliases[(event.key||'').toLowerCase()]||event.key);}

function inside(x,z,spec,margin=0){return x>spec.x-spec.w/2-margin&&x<spec.x+spec.w/2+margin&&z>spec.z-spec.d/2-margin&&z<spec.z+spec.d/2+margin;}
function floorAt(x,z,feetY=walkFeet??camera.position.y-desiredEye){return floorHeight(x,z,feetY,{tiers:stadium.tiers,rooms:roomSpecs});}
function blocked(x,z,y){
 return hitsWall(x,z,y,interactions.colliders)||hitsWall(x,z,y,serviceRooms.colliders)||hitsWall(x,z,y,building.colliders)||hitsWall(x,z,y,interiors.colliders,owner=>!owner||interiors.rooms[owner]?.visible)||hitsWall(x,z,y,world.colliders)||hitsWall(x,z,y,stadium.circulation.colliders,()=>stadium.circulation.root.visible);
}

function moveWalk(dt){
 if(mode!=='walk'||!walkReady||!$('explore').hidden||document.querySelector('dialog[open]'))return;
 yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*Math.min(dt,.25)*1.5;
 const f=(keys.has('KeyW')||keys.has('ArrowUp')||moveFlags.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||moveFlags.has('back')?1:0)+touchAxes.y,s=(keys.has('KeyD')||keys.has('ArrowRight')||moveFlags.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||moveFlags.has('left')?1:0)+touchAxes.x;
 forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));step.set(0,0,0).addScaledVector(forward,f).addScaledVector(right,s);
 if(step.lengthSq()){interactions.stand();
  const duration=Math.min(dt,.25),speed=touchSprint||keys.has('ShiftLeft')||keys.has('ShiftRight')?10:4.5;step.normalize().multiplyScalar(speed*duration*Math.min(1,Math.hypot(f,s)));
  walkFeet=advanceWalker(camera.position,walkFeet??camera.position.y-desiredEye,step.x,step.z,walkGeometry(),blocked);
 }
 walkFeet=floorAt(camera.position.x,camera.position.z);const y=walkFeet+desiredEye;camera.position.y=THREE.MathUtils.lerp(camera.position.y,y,Math.min(1,dt*15));camera.rotation.set(pitch,yaw,0,'YXZ');
}

const hotspotDefs=[{name:'探索球场内部',id:'stands',p:[0,52,0],outside:true},{name:'南广场',id:'esplanade',p:[0,2,190],outside:true},{name:'草坪与看台',id:'pitch',p:[0,2,0],inside:true},{name:'球员通道',id:'tunnel',p:[-39,3,0],inside:true},{name:'主队更衣室',id:'homeRoom',p:[-78,3,-2],inside:true}];
function buildHotspots(){for(const h of hotspotDefs){const b=document.createElement('button');b.className='hotspot';b.innerHTML=`<span class="dot">+</span>${h.name}`;b.setAttribute('aria-label','前往'+h.name);b.addEventListener('click',()=>{stopTour();goPlace(h.id);});$('hotspots').appendChild(b);h.el=b;}}
function updateHotspots(){const on=$('markers').checked&&mode==='orbit';const outdoors=active==='exterior'||active==='esplanade';for(const h of hotspotDefs){const show=on&&!roomSpecs[active]&&active!=='tunnel'&&((h.outside&&outdoors)||(h.inside&&!outdoors));if(!show){h.el.hidden=true;continue;}temp.fromArray(h.p).project(camera);const px=(temp.x*.5+.5)*innerWidth,py=(-temp.y*.5+.5)*innerHeight;h.el.hidden=temp.z<0||temp.z>1||px<260||px>innerWidth-240||py<175||py>innerHeight-180;if(!h.el.hidden){h.el.style.left=px+'px';h.el.style.top=py+'px';}}}

const map=$('map'),ctx=map.getContext('2d');
function drawMap(){const w=220,h=170,cx=110,cz=76,scale=.48;ctx.clearRect(0,0,w,h);ctx.lineWidth=1;ctx.strokeStyle='#ffffff05';for(let x=0;x<w;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.strokeStyle='#344754';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(203,0);ctx.lineTo(203,170);ctx.moveTo(0,8);ctx.lineTo(220,8);ctx.stroke();ctx.fillStyle='#273b39';ctx.fillRect(cx-32,137,64,33);ctx.strokeStyle='#70818a';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=120;i++){const p=superpoint(113.5,129,i/120*TAU,2.65);if(i===0)ctx.moveTo(cx+p.x*scale,cz+p.z*scale);else ctx.lineTo(cx+p.x*scale,cz+p.z*scale);}ctx.closePath();ctx.fillStyle=night?'#5c2639':'#354851';ctx.fill();ctx.stroke();ctx.beginPath();for(let i=0;i<=120;i++){const p=superpoint(67,78,i/120*TAU,2.65);if(i===0)ctx.moveTo(cx+p.x*scale,cz+p.z*scale);else ctx.lineTo(cx+p.x*scale,cz+p.z*scale);}ctx.closePath();ctx.fillStyle='#213b37';ctx.fill();ctx.strokeStyle='#687b80';ctx.stroke();ctx.strokeStyle='#87a6a055';ctx.strokeRect(cx-34*scale,cz-52.5*scale,68*scale,105*scale);ctx.beginPath();ctx.moveTo(cx-34*scale,cz);ctx.lineTo(cx+34*scale,cz);ctx.ellipse(cx,cz,9.15*scale,9.15*scale,0,0,TAU);ctx.stroke();
 if(mode==='walk'&&walkGuide){ctx.strokeStyle='#ffd36b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+camera.position.x*scale,cz+camera.position.z*scale);for(const p of routeOnCurrentLevel(walkGuide.getRoute(),camera.position.y-desiredEye))ctx.lineTo(cx+p.x*scale,cz+p.z*scale);ctx.stroke();} let x=THREE.MathUtils.clamp(cx+camera.position.x*scale,7,w-7),y=THREE.MathUtils.clamp(cz+camera.position.z*scale,9,h-8);const dir=v();camera.getWorldDirection(dir);const a=Math.atan2(dir.x,-dir.z);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#fa315555';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-9,-20);ctx.lineTo(9,-20);ctx.closePath();ctx.fill();ctx.fillStyle='#fb4260';ctx.beginPath();ctx.arc(0,0,3.5,0,TAU);ctx.fill();ctx.strokeStyle='#ffd7df';ctx.lineWidth=1;ctx.stroke();ctx.restore();$('elevation').textContent=mode==='walk'?floorLabel(camera.position.y-desiredEye,camera.position):'全馆总览';}

function render(){const raw=Math.min(clock.getDelta(),1),dt=Math.min(raw,.05);elapsed+=raw;frames++;if(transition){transition.time+=raw;const a=Math.min(transition.time/transition.duration,1),t=1-(1-a)**3;camera.position.lerpVectors(transition.from,transition.to,t);controls.target.lerpVectors(transition.startTarget,transition.target,t);if(a===1)transition=null;}if(mode==='orbit')controls.update();else if(!matchday?.cinematic)moveWalk(raw);matchday?.update(raw,camera.position,yaw);if(tourOn){tourElapsed+=raw;if(tourElapsed>7.5){tourElapsed=0;tourIndex=(tourIndex+1)%Object.keys(places).length;goPlace(Object.keys(places)[tourIndex]);}}
 world.rotor.rotation.z=elapsed*.13;building.update(camera.position,mode);interactions.update(camera.position,raw,mode);interiors.update(camera.position,active);serviceRooms.update(camera.position,raw);walkGuide.update(navigationPosition(),mode==='walk'?yaw:walker.yaw,raw,mode,mode==='walk'?desiredEye:EYE_HEIGHT);
 const privateEnclosed=Object.entries(roomSpecs).some(([key,s])=>key!=='lounge'&&inside(camera.position.x,camera.position.z,s)&&Math.abs(camera.position.y-s.y)<6)||(camera.position.x>-80&&camera.position.x<-66&&camera.position.z>-43&&camera.position.z<50&&camera.position.y<3)||!!serviceRoomAt({x:camera.position.x,y:camera.position.y-desiredEye,z:camera.position.z});
 const outer=(Math.abs(camera.position.x)/105)**2.8+(Math.abs(camera.position.z)/122)**2.8,inner=(Math.abs(camera.position.x)/85)**2.8+(Math.abs(camera.position.z)/103)**2.8;
 const inPublicConcourse=(outer<1&&inner>1&&camera.position.y>12.9&&camera.position.y<17.8)||(camera.position.y>-2&&camera.position.y<44&&inCoreShaft(camera.position.x,camera.position.z)),inBowl=inner<1&&camera.position.y<46;
 stadium.root.visible=!privateEnclosed&&!inPublicConcourse;world.group.visible=!privateEnclosed&&!inPublicConcourse&&!inBowl;world.update(camera.position);stadium.circulation.update(camera.position,privateEnclosed);stadium.update(camera,mode,$('quality').value==='high');const enclosed=privateEnclosed||inPublicConcourse||(camera.position.x>-70&&camera.position.x<-41&&Math.abs(camera.position.z)<2.5&&camera.position.y<3.5);arenaFill.intensity=enclosed?.055:night?.82:.24;hemi.intensity=enclosed?.95:night?.98:1.25;hemi.color.set(enclosed?0xf0ece6:night?0x9aadc5:0xdae9ff);hemi.groundColor.set(enclosed?0xa5a09b:night?0x3e4539:0x686f54);ambient.intensity=enclosed?.18:night?(matchday?.active?.38:.30):.22;dayLight.intensity=enclosed?.16:night?1.85:2.65;dayLight.color.set(night&&!enclosed?0xe4edff:0xffeed5);lightBudget.update(camera.position,raw);if(frameBudget.shouldDraw(camera,elapsed,!!transition||tourOn||dragging||keys.size>0||movementPointers.size>0||interactions.isAnimating?.()||serviceRooms.isAnimating()||matchday?.isAnimating())){renderer.render(scene,camera);drawnFrames++;}if(frames%3===0){updateHotspots();if(!document.querySelector('.minimap').hidden)drawMap();document.body.dataset.camera=camera.position.toArray().map(x=>x.toFixed(3)).join(',');document.body.dataset.heading=[yaw,pitch].map(x=>x.toFixed(4)).join(',');}if(elapsed-lastPerf>1.5){const fps=Math.round(frames/(elapsed-lastPerf));$('performance').textContent=`THREE.JS r${THREE.REVISION}  /  ${stadium.seatCount.toLocaleString()} 个座位模型  /  ${stadium.panelCount.toLocaleString()} 个气枕  /  ${fps} FPS`;document.body.dataset.fps=fps;document.body.dataset.renderfps=Math.round(drawnFrames/(elapsed-lastPerf));drawnFrames=0;if($('quality').value==='standard'){if(elapsed>6&&fps<28&&qualityScale>.82&&(keys.size>0||dragging||joystickPointer!==null||transition||tourOn||matchday?.cinematic)){qualityScale=Math.max(.82,qualityScale*.92);recoveryFrames=0;setQuality(false);}else if(fps>48&&qualityScale<1){if(++recoveryFrames>=4){qualityScale=Math.min(1,qualityScale+.08);recoveryFrames=0;setQuality(false);}}else recoveryFrames=0;}document.body.dataset.camera=camera.position.toArray().map(x=>x.toFixed(2)).join(',');document.body.dataset.drawcalls=renderer.info.render.calls;document.body.dataset.triangles=renderer.info.render.triangles;frames=0;lastPerf=elapsed;}}
function setQuality(reset=true){frameBudget.invalidate();if(reset)qualityScale=1;const high=$('quality').value==='high';pixelBudget=Math.min(devicePixelRatio,high?1.6:1,Math.sqrt((high?2400000:1050000)/(innerWidth*innerHeight)))*qualityScale;renderer.setPixelRatio(pixelBudget);renderer.shadowMap.enabled=high;renderer.shadowMap.needsUpdate=true;document.body.dataset.resolution=pixelBudget.toFixed(2);}
function resize(){document.body.dataset.touch=String(innerWidth<=1024);setQuality(false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);frameBudget.invalidate();}
function updateLocationURL(){const q=new URLSearchParams();if(active!=='exterior')q.set('place',active);if(night)q.set('night','1');if(mode==='walk')q.set('view','walk');if(matchday?.active)q.set('experience','matchday');history.replaceState(null,'',location.pathname+(q.size?'?'+q:''));}
function stopTour(){if(!tourOn)return;tourOn=false;$('tour').innerHTML='<span>▷</span> 自动巡游 <small>15 个视角</small>';}
function bindUI(){
 document.body.dataset.touch=String(innerWidth<=1024);
 $('map-toggle').onclick=toggleMap;$('toggle-hud').onclick=toggleHUD;
 const joystick=$('joystick'),thumb=$('joystick-thumb');
 const steer=e=>{const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),scale=Math.min(1,25/(d||1)),x=dx*scale,y=dy*scale;touchAxes.x=x/25;touchAxes.y=-y/25;thumb.style.transform=`translate(${x}px,${y}px)`;};
 joystick.addEventListener('pointerdown',e=>{if(mode!=='walk')return;e.preventDefault();beginWalk();joystickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);steer(e);});
 joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer){e.preventDefault();steer(e);}});
 const releaseJoystick=e=>{if(e.pointerId===joystickPointer){touchAxes.x=touchAxes.y=0;joystickPointer=null;thumb.style.transform='none';}};
 joystick.addEventListener('pointerup',releaseJoystick);joystick.addEventListener('pointercancel',releaseJoystick);
 $('touch-sprint').onclick=()=>{touchSprint=!touchSprint;$('touch-sprint').setAttribute('aria-pressed',String(touchSprint));};
 $('environment-more').onclick=()=>{const panel=document.querySelector('.environment'),expanded=panel.classList.toggle('expanded');$('environment-more').setAttribute('aria-expanded',String(expanded));};
 document.querySelectorAll('.location').forEach(b=>b.onclick=()=>{stopTour();goPlace(b.dataset.place);});$('home').onclick=e=>{e.preventDefault();stopTour();goPlace('exterior');};$('reset').onclick=()=>goPlace(active);$('day').onclick=()=>{setDayNight(false);updateLocationURL();};$('night').onclick=()=>{setDayNight(true);updateLocationURL();};$('orbit-mode').onclick=()=>setMode('orbit');$('walk-mode').onclick=()=>setMode('walk');$('start-walk').onclick=beginWalk;
 $('roof').onchange=e=>{stadium.roof.visible=e.target.checked;stadium.circulation.setRoof(e.target.checked);interiors.setRoof(e.target.checked);renderer.shadowMap.needsUpdate=true;};$('autorotate').onchange=e=>{if(mode==='walk'){e.target.checked=false;toast('自动环绕可在第三人称视角中使用。');return;}controls.autoRotate=e.target.checked;};
 $('quality').onchange=()=>{setQuality();toast($('quality').value==='high'?'已启用精细画质与建筑投影。':'已启用自适应流畅画质。');};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('可使用浏览器全屏功能扩大画面。');}};
 $('capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`allianz-arena-${active}-${night?'night':'day'}.png`;a.href=canvas.toDataURL('image/png');a.click();toast('已保存当前场景截图。');};
 $('help').onclick=()=>openDialog('help');$('references').onclick=()=>openDialog('references');document.querySelector('.close-dialog').onclick=()=>$('info-dialog').close();$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=$('info-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info-dialog').close();}});
 $('tour').onclick=()=>{if(tourOn){stopTour();return;}if(mode==='walk')setMode('orbit');setNavOpen(false);tourOn=true;tourElapsed=0;tourIndex=Object.keys(places).indexOf(active);$('tour').innerHTML='<span>Ⅱ</span> 暂停巡游 <small>每 7.5 秒切换</small>';toast('自动巡游开始；拖动场景或选择区域可暂停。');};
 $('nav-trigger').onclick=()=>setNavOpen($('explore').hidden);
 $('toggle-nav').onclick=()=>{setNavOpen(false);$('nav-trigger').focus({preventScroll:true});};
 document.addEventListener('pointerdown',e=>{if(!$('explore').hidden&&!e.target.closest('#explore,#nav-trigger'))setNavOpen(false);});
 canvas.addEventListener('contextmenu',e=>{if(mode==='walk')e.preventDefault();});
 canvas.addEventListener('pointerdown',e=>{
  if(mode!=='walk'||(e.pointerType==='mouse'&&e.button===1))return;
  beginWalk();if(document.pointerLockElement===canvas)return;
  dragging=true;lastPointer={id:e.pointerId,x:e.clientX,y:e.clientY};document.body.classList.add('looking');canvas.setPointerCapture?.(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(mode!=='walk'||!walkReady||document.pointerLockElement===canvas||!dragging||lastPointer?.id!==e.pointerId)return;
  turn(e.clientX-lastPointer.x,e.clientY-lastPointer.y,e.pointerType==='touch'?.004:.003);lastPointer={id:e.pointerId,x:e.clientX,y:e.clientY};
 });
 window.addEventListener('mousemove',e=>{if(mode==='walk'&&walkReady&&document.pointerLockElement===canvas)turn(e.movementX,e.movementY,.0021);});
 function releasePointer(e){if(lastPointer?.id===e.pointerId){dragging=false;lastPointer=null;document.body.classList.remove('looking');}movementPointers.delete(e.pointerId);moveFlags.clear();for(const direction of movementPointers.values())moveFlags.add(direction);}
 window.addEventListener('pointerup',releasePointer);window.addEventListener('pointercancel',releasePointer);
 window.addEventListener('blur',()=>{if(matchday?.active)matchday.setPaused(true);if(mode==='walk')setWalkReady(false);else clearWalkInput();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(matchday?.active)matchday.setPaused(true);clearWalkInput();renderer.setAnimationLoop(null);}else{clock.time=performance.now();renderer.setAnimationLoop(render);}});
 document.addEventListener('pointerlockchange',()=>{clearWalkInput();pointerLockPending=false;if(mode==='walk'&&document.pointerLockElement===canvas)setWalkReady(true);updateLookHint();});
 document.addEventListener('pointerlockerror',()=>{pointerLockPending=false;updateLookHint();if(mode==='walk')setWalkReady(true);});
 document.querySelectorAll('[data-move]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{if(mode!=='walk')return;e.preventDefault();setNavOpen(false);setWalkReady(true);movementPointers.set(e.pointerId,b.dataset.move);moveFlags.add(b.dataset.move);b.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});});
  b.addEventListener('pointerup',releasePointer);b.addEventListener('pointercancel',releasePointer);
 });
 window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  const code=keyCode(e),movement=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code);
  if(matchday?.cinematic){if(code==='Escape'||code==='Space')matchday.setPaused(!matchday.paused);if(movement||code==='Space'||code==='Escape')e.preventDefault();return;}if(code==='Escape'){if(!$('explore').hidden){setNavOpen(false);canvas.focus({preventScroll:true});}else if(mode==='walk'){document.exitPointerLock?.();setWalkReady(false);}return;}
  if(movement&&mode==='walk'){e.preventDefault();if(!walkReady)beginWalk();keys.add(code);}else if(code==='ShiftLeft'||code==='ShiftRight')keys.add(code);
  if(e.repeat)return;
  if(code==='KeyF'&&mode==='walk'){if(!matchday?.kick(camera.position,yaw))interactions.activate();}if(code==='KeyT')teleportToDestination();if(code==='KeyM')toggleMap();if(code==='KeyU')toggleHUD();if(code==='KeyL')lockMouse();if(code==='KeyN'){setDayNight(!night);updateLocationURL();}if(code==='KeyP')setMode(mode==='orbit'?'walk':'orbit');if(code==='Home'){if(mode==='walk')spawnEntrance();else goPlace(active);};if(code==='KeyH')openDialog('help');
 });
 window.addEventListener('keyup',e=>keys.delete(keyCode(e)));
 $('info-dialog').addEventListener('close',()=>{if(mode==='walk')beginWalk();});
 map.addEventListener('click',e=>{const r=map.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width*220,my=(e.clientY-r.top)/r.height*170,x=(mx-110)/.48,z=(my-76)/.48;if(mode==='walk'){const goals=Object.keys(tourGoals).map(id=>tourNodes[id]),target=goals.reduce((a,b)=>Math.hypot(a.x-x,a.z-z,2*(a.y-camera.position.y+desiredEye))<Math.hypot(b.x-x,b.z-z,2*(b.y-camera.position.y+desiredEye))?a:b);goPlace(target.id,false);}else goPlace(Math.abs(x)<40&&Math.abs(z)<59?'pitch':'stands');});
}

function showInteractiveInfo(title,text,goals=[]){clearWalkInput();document.exitPointerLock?.();$('dialog-content').replaceChildren();const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=text;$('dialog-content').append(h,p);for(const id of goals){const b=document.createElement('button');b.className='destination-button';b.textContent='步行前往 '+tourGoals[id];b.onclick=()=>{goPlace(id,false);$('info-dialog').close();};$('dialog-content').append(b);}$('info-dialog').showModal();}
function openDialog(type){clearWalkInput();document.exitPointerLock?.();if(type==='help')$('dialog-content').innerHTML=`<div class="eyebrow">ARENA EXPLORER</div><h2>自由探索主场</h2><h3>电脑操作</h3><p>第三人称：拖动环绕、滚轮缩放、右键平移。第一人称：WASD / 方向键移动，拖动画面或 Q / E 转头，Shift 加速。L 锁定或释放鼠标，Esc 暂停，点击画面继续。</p><h3>手机操作</h3><p>第一人称用左下摇杆移动，拖动空白画面转头；「跑」切换移动速度。第三人称用单指环绕、双指缩放和平移。横竖屏均可使用。靠近可互动设施后，点击右下提示按钮操作。</p><h3>选区、步行与传送</h3><p>点击「选择区域」或底部地点，可搜索、按类别筛选目的地。第一人称选区后更新方向、距离与脚下黄线；想直接抵达时，再点击「传送」或按 T。路线详情按需展开，地图用右上地图按钮或 M 打开。眼睛按钮或 U 隐藏界面，再次点击恢复。</p><p>首次进入第一人称从南侧正门出发，之后切回会恢复上次步行位置。大厅右侧的参观通道通往草坪，东侧室内楼梯连接公共大厅、包厢和看台。商店与展厅的自动门靠近即开；公共大厅的 SERVICE 双门需要靠近后按 F 或点击互动按钮，打开后可走入并返回。</p><h3>场景与互动</h3><p>靠近奖杯、球衣、战术板与座位按 F 或点击互动按钮。N 切换昼夜，P 切换视角，Home 返回正门，H 查看说明。显示设置里可关闭屋顶或选择画质。默认采用流畅画质；设备性能有限时建议保留默认设置。</p>`;
 else $('dialog-content').innerHTML=`<div class="eyebrow">BUILT FROM PUBLIC REFERENCES</div><h2>尽量走近真实的安联。</h2><p>这是以公开照片、建筑介绍、官方平面图和用户视频为参考的程序化三维复原。采用米制坐标，主要外形与草坪遵循公布的尺寸；并非测绘模型，未取得施工图、摄影测量数据或完整室内尺寸，因此无法保证逐处 1:1。</p><div class="fact-grid"><div><b>258 × 227 m</b><small>建筑外廓参考</small></div><div><b>105 × 68 m</b><small>标准比赛草坪</small></div><div><b>2,784</b><small>官方气枕数量参考</small></div></div><h3>本次还原的细节</h3><p>鼓起的菱形气枕、红色夜间外壳、屋顶开口与悬挑桁架、环形照明、三层阶梯看台、${stadium.seatCount.toLocaleString()} 个独立座椅模型、楼梯过道与分区牌、场边广告、替补席、球门网、角旗、摄像机，以及南广场、停车场采光口、道路、轨道与周边建筑。</p><p>室内包含主客队更衣室、球衣球鞋与装备、更衣长凳、战术板、淋浴区、红色球员通道、新闻发布厅、代表性贵宾包厢、荣誉展厅、环形公共大厅与球迷商店。更衣室以 2022 年官方照片的红色衣柜与木凳为主要视觉参考；场馆于 2026 年另有更衣室整修公告，尚未取得整修后完整室内参考，因此不能把本模型视为 2026 年现状的精确记录。球衣姓名和号码按拜仁官网 2026-10-20 的一线队名单核对，更衣室与商店共用同一份名单。所有内部房间的精确尺寸、连接方式、包厢陈设和博物馆布展均有近似。看台文字和座椅数为视觉建模，不等同于售票座位清单。</p><h3>主要参考资料</h3><ol><li><a href="https://fcbayern.com/en/teams/first-team" target="_blank" rel="noopener">拜仁官方 · 当前一线队名单</a>：球员姓名与号码，核对日期 2026-10-20。</li><li><a href="https://allianz-arena.com/en/arena/facts/general-information" target="_blank" rel="noopener">安联球场官方 · Facts & Figures</a>：建筑尺寸、气枕数、草坪、看台坡度与场馆设施。</li><li><a href="https://www.herzogdemeuron.com/projects/205-allianz-arena/" target="_blank" rel="noopener">Herzog & de Meuron · Allianz Arena</a>：外壳形态、三层看台与广场设计。</li><li><a href="https://allianz-arena.com/en/news/2022/10/fc-bayern-team-areas-open-again-for-tours" target="_blank" rel="noopener">球场官方 · 2022 年更衣室图像</a>：红色衣柜、球衣与木质长凳。</li><li><a href="https://allianz-arena.com/en/news/2026/05/renovation-work-in-fc-bayern-dressing-room" target="_blank" rel="noopener">球场官方 · 2026 年更衣室整修公告</a>：室内现状可能与早期照片不同。</li><li><a href="https://fcbayern.com/de/bilder/2018/08/galerie-die-allianz-arena-im-neuen-gewand" target="_blank" rel="noopener">拜仁官方 · 2018 年内场改造照片</a>：红白座椅与主场装饰。</li><li><a href="https://fcbayern.com/en/tickets/fc-bayern-hospitality-tickets/general-information" target="_blank" rel="noopener">拜仁官方 · 各层平面图与场地地图</a>：设施与接待区位置参考。</li><li><a href="https://allianz-arena.com/de/news/2019/einsatzuebung-zur-europameisterschaft-2020" target="_blank" rel="noopener">球场官方 · 外观航拍</a>：南广场步道、停车设施和周边环境。</li><li><a href="https://www.douyin.com/video/7491434777543806266" target="_blank" rel="noopener">NancyChoU · 球员入场通道（用户提供）</a>：白色顶灯、红色墙面与上行台阶。</li><li><a href="https://v.douyin.com/2j99UtAX4TY/" target="_blank" rel="noopener">凯罗同学 · 安联球场参观（用户提供）</a>。</li><li><a href="https://v.douyin.com/ixGw7sUOSUg/" target="_blank" rel="noopener">🌈把爱留在阿根廷 · 球场视频（用户提供）</a>。</li><li><a href="https://github.com/mrdoob/three.js" target="_blank" rel="noopener">Three.js · 官方开源引擎</a>，版本 0.186.1，MIT 许可。</li></ol><p>建模说明：白天使用自然色外壳，黑夜使用拜仁红与场内照明；光照为艺术化实时效果。项目为非官方球迷探索作品，与 FC Bayern、Allianz 及球场运营方无隶属关系。</p>`;
 $('info-dialog').showModal();}

window.addEventListener('error',e=>{console.error('Arena error:',e.error||e.message);if(document.body.dataset.ready!=='true')$('load-status').textContent='加载遇到问题，请刷新页面或查看启动说明。';});
setTimeout(()=>init().catch(error=>{console.error('Arena loading failed:',error);$('load-status').textContent='场景资源加载失败，请刷新页面重试。';}),60);
