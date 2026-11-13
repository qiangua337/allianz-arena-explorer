import {drawArenaFloorMap,mapDestinationAt} from './arena-floor-map.js';
import {joystickAxes} from './touch-control.js';
import {replayCamera} from './football-replay.js';
import {constrainInteriorOrbit} from './interior-orbit.js';
import {footballInput,footballCamera,advanceFootballCamera,offscreenBallCue,penaltyContext,footballControlYaw,footballPlayerFocus,footballShotFocus,footballBallForDisplay} from './football-controls.js';
import {loadVisualAssets,applySurfaceQuality} from './visual-assets.js';
import {installInteriorShading} from './interior-shading.js';
import {lightingProfile,updateSceneLighting} from './lighting-profile.js';
import {walkingTours,createWalkingTour} from './walk-tours.js';
import {createWalkCheckpoint,safeCheckpointFloor} from './walk-checkpoint.js';
import {loadVisitorSettings,saveVisitorSettings,qualityProfile,matchFpsCap} from './visitor-settings.js';
import {smoothWalkInput} from './walk-smoothing.js';
import {applyArchitecturalUV} from './surface-finishes.js';
import {spatializeArchitecture,updateArchitectureSectors} from './spatial-batches.js';
import {buildDestinationMenu} from './destinations.js';
import {buildMatchdayExperience} from './matchday.js';
import {buildFrameBudget,freezeArchitecture,suspendExplorationDuringMatch} from './scene-budget.js';
import {createFramePacer,MOBILE_ONLINE_FRAME_SLACK} from './frame-pacing.js';
import {createMatchFrameRate} from './match-frame-rate.js';
import {writeHudProperty} from './hud-write.js';
import {buildWalkBuilding} from './walk-building.js';
import {buildLightBudget} from './performance.js';
import {buildInteractions} from './interactions.js';
import {tourNodes,tourGoals} from './tour-route.js';
import {inCoreShaft} from './building-layout.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {v,TAU,superpoint,seeded,loadBrandAssets,prepareMaterialLighting,setMaterialEnvironment} from './kit.js';
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
const ballCue=$('game-ball-cue'),ballCueArrow=$('game-ball-cue-arrow'),ballCueDistance=$('game-ball-cue-distance');
let experienceHub,destinationMenu;
let visitorStorage;try{visitorStorage=window.localStorage;}catch{}const visitorSettings=loadVisitorSettings(visitorStorage),walkingTour=createWalkingTour(),smoothInput={x:0,z:0};let qualityMode=visitorSettings.quality,matchFps=visitorSettings.matchFps,tourUIState='';
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
 guestRoom:{title:'客队更衣室',tag:'GUEST DRESSING ROOM',desc:'客队备战区：球衣、更衣长凳、战术板与淋浴区；当前为多特蒙德示范陈列。',pos:[-76,-.9,33.5],target:[-86,-1,27],walk:[-76,-1,32],look:[-89,-.8,25],accuracy:'多特蒙德示范陈列 · 非真实比赛名单'},
 press:{title:'新闻发布厅',tag:'THE PRESS CONFERENCE',desc:'180 席阶梯媒体座椅、鹅颈麦克风、转播摄像机与灯架；参考官方发布厅照片与设施说明。',pos:[-82,.35,-23.3],target:[-82,-1.05,-37],walk:[-82,-.3,-23.5],look:[-82,-1,-37],accuracy:'参考用户视频 · 布局近似'},
 lounge:{title:'贵宾包厢',tag:'HOSPITALITY & SKYBOX',desc:'透过落地玻璃俯瞰草坪，近看餐桌、吧台与看台之间的细节。',pos:[93,25.2,11.8],target:[86.2,25,-2],walk:[90,25.3,7],look:[0,4,0],accuracy:'代表性包厢 · 陈设近似'},
 museum:{title:'荣誉展厅',tag:'A GALLERY OF HONOURS',desc:'8 组球队奖杯与 10 组个人荣誉：金球、金靴、金手套。对准展柜标题或展品按 F，或打开展览目录查看官方资料。',pos:[-96,14.05,69.1],target:[-96,14.0,49],walk:[-93,13.7,67],look:[-96,13.8,48],accuracy:'参考真实展陈 · 空间压缩呈现'},
 concourse:{title:'环形公共大厅',tag:'THE PUBLIC CONCOURSE',desc:'沿着环形大厅，经过餐饮柜台、分区入口和场馆导视。',pos:[94,13.9,-47],target:[96,14,-12],walk:[94,13.9,-47],look:[96,14,-12],accuracy:'环形公共空间 · 陈设近似'},
 store:{title:'球迷商店',tag:'FC BAYERN STORE',desc:'球衣衣架、红白围巾、装备陈列与服务台。走进球迷商店。',pos:[9.5,14.05,123.2],target:[-3,13.8,116.2],walk:[0,13.9,123],look:[0,14,113],accuracy:'代表性球迷商店 · 布局近似'}
};
const frameBudget=buildFrameBudget(),gameDrawBudget=createFramePacer(),visitDrawBudget=createFramePacer(),telemetryBudget=createFramePacer();let drawnFrames=0,sceneTime=0,gameCameraInstant=true;let gameCameraLook=null,gameCameraPeriod=null,gameCameraPlayer=null,gameCameraStoppage=null,gameCameraPhase=null;
const matchFrameRate=createMatchFrameRate({cap:matchFps,quality:qualityMode});let matchBudgetActive=false,matchSampling=false,pendingMatchScale,matchSampleTime=0,matchSampleFrames=0,matchSampleDraws=0,matchSampleWork=0,matchSampleGameWork=0;
const matchRafGaps=new Uint16Array(101),matchDrawGaps=new Uint16Array(101);let previousRaf=0,previousDraw=0;
let building,lightBudget,interactions,serviceRooms,matchday,setExplorationMatchMode,matchSnapshot=null,matchStarting=false,qualityScale=1,recoveryFrames=0;
let visualAssets,renderer,scene,camera,controls,stadium,world,interiors,walkGuide,sky,stars,dayLight,arenaFill,hemi,ambient;
let active='exterior',mode='orbit',night=false,transition=null,tourOn=false,tourElapsed=0,tourIndex=0,toastTimer;
let yaw=0,pitch=0,dragging=false,lastPointer=null,walkReady=false,clock={time:performance.now(),getDelta(){const now=performance.now(),d=(now-this.time)/1000;this.time=now;return d;}},elapsed=0,frames=0,lastPerf=0,frameMs=0;
let desiredEye=EYE_HEIGHT,walkFeet=null,pointerLockPending=false,seatStanding=null;const keys=new Set(),moveFlags=new Set(),movementPointers=new Map();const forward=v(),right=v(),step=v(),temp=v(),walkPosition=v();const ray=new THREE.Raycaster();
const mediaReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchAxes={x:0,y:0};let touchSprint=false,joystickPointer=null;
// Orbit previews must never become the starting point of a walking route.
const walker={position:v(...places.exterior.walk),yaw:0,pitch:0,visited:false};
let walkStorage;
try{walkStorage=window.sessionStorage;}catch{}
const walkCheckpoint=createWalkCheckpoint(walkStorage);
const walkGeometry=()=>({tiers:stadium.tiers,rooms:roomSpecs});
const navigationPosition=()=>mode==='walk'?walkPosition.set(camera.position.x,(walkFeet??camera.position.y-desiredEye)+desiredEye,camera.position.z):walker.position;
const toast=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);};

export async function startArena({hub, initial, nightAtStart}){
 experienceHub=hub;
 $('quality').value=qualityMode;syncMatchFpsOptions();
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:qualityMode==='high'||!(innerWidth<=760||window.matchMedia('(pointer:coarse)').matches),alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});}catch(error){throw new Error('当前浏览器未能启用 WebGL。请检查浏览器的硬件加速设置。',{cause:error});}
 setQuality();renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xb8cbd6,.00082);
 camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,4500);camera.position.fromArray(places.exterior.pos);
 controls=new OrbitControls(camera,canvas);controls.target.fromArray(places.exterior.target);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=1.1;controls.maxDistance=1000;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.5;controls.enablePan=true;controls.update();
 controls.addEventListener('start',()=>{transition=null;if(tourOn)stopTour();});
 hemi=new THREE.HemisphereLight(0xdae9ff,0x686f54,2.1);ambient=new THREE.AmbientLight(0xffffff,.45);dayLight=new THREE.DirectionalLight(0xffeed5,3.1);dayLight.position.set(-180,270,170);dayLight.castShadow=true;dayLight.shadow.mapSize.set(2048,2048);Object.assign(dayLight.shadow.camera,{left:-165,right:165,top:180,bottom:-170,near:1,far:750});dayLight.shadow.bias=-.0003;dayLight.shadow.normalBias=.15;dayLight.target.position.set(0,0,0);scene.add(hemi,ambient,dayLight,dayLight.target);
 arenaFill=new THREE.DirectionalLight(0xdce7f5,.25);arenaFill.position.set(130,110,-150);scene.add(arenaFill);buildSky();
 $('load-status').textContent='正在加载材质与环境光…';const assetResults=await Promise.all([loadBrandAssets(),loadVisualAssets(renderer,{progress:(n,total)=>{$('load-status').textContent='正在加载材质与环境光 '+n+' / '+total;}})]);visualAssets=assetResults[1];if(visualAssets.environments.indoor)setMaterialEnvironment(visualAssets.environments.indoor);else prepareMaterialLighting(renderer);document.body.dataset.surfaceResolution=visualAssets.resolution;document.body.dataset.assetFailures=visualAssets.failed.length;
 world=buildWorld(scene);stadium=buildStadium(scene);interiors=buildInteriors(scene,stadium.circulation);
 building=buildWalkBuilding(scene);serviceRooms=buildServiceRooms(scene);walkGuide=buildWalkGuide(scene,walkGeometry(),{obstacles:{world:world.colliders,building:building.colliders,interiors:interiors.colliders,circulation:stadium.circulation.colliders,service:serviceRooms.walls},onChoose:()=>setNavOpen(true),onSelect:id=>{stopTour();goPlace(id,false);},onWalk:followDestination,onTeleport:teleportToDestination,onContinue:advanceWalkingTourFromGuide,nextDestination:upcomingWalkDestination});interactions=buildInteractions(scene,interiors,{toast,serviceRooms,navigate:id=>goPlace(id),setEye:y=>desiredEye=y,seats:stadium.seatPositions,onSit:seatIntoView,onStand:standFromSeat,onFocusSeat:focusArenaSeat,showInfo:showInteractiveInfo});lightBudget=buildLightBudget(scene);matchday=buildMatchdayExperience({scene,stadium,reducedMotion:mediaReduced,mobile:innerWidth<=1024,toast,onBegin:beginMatchday,onPose:applyEntrancePose,onFinish:finishMatchdayEntrance,onVisitBench:visitMatchdayBench,onGameCamera:applyGameCamera,onGameView:updateGameView,onReadGameInput:()=>gameInput(0),getGameRenderCamera:()=>qualityMode==='high'?null:camera,onExit:restoreFromMatchday,onPrepare:root=>{applySurfaceQuality(root,qualityMode);return renderer.compileAsync(root,camera,scene);},onPause:value=>{clearWalkInput();setWalkReady(!value);}});
 matchday.setQuality(qualityMode,qualityScale);visualAssets.registerOutdoor(world.group,stadium.root);applyArchitecturalUV(stadium.root);applyArchitecturalUV(stadium.circulation.root);applyArchitecturalUV(interiors.root);applyArchitecturalUV(building.root);applyArchitecturalUV(world.group);installInteriorShading(interiors.root);
 spatializeArchitecture(stadium.circulation.root);spatializeArchitecture(interiors.rooms.concourse);
 setExplorationMatchMode=suspendExplorationDuringMatch([world.group,building.root,interiors.root,serviceRooms.root,stadium.circulation.root]);
 freezeArchitecture(world.group,[world.rotor]);freezeArchitecture(stadium.root,[stadium.matchBall]);freezeArchitecture(stadium.circulation.root);freezeArchitecture(interiors.root);freezeArchitecture(building.root);destinationMenu=buildDestinationMenu({onDismiss:()=>setNavOpen(false)});buildHotspots();bindUI();setNavOpen(false);document.body.dataset.mode=mode;setDayNight(nightAtStart);applySurfaceQuality(scene,qualityMode);clock.time=performance.now();document.body.dataset.version='10.5.1';document.body.dataset.seats=stadium.seatCount;document.body.dataset.panels=stadium.panelCount;
 const requestedPlace=initial.get('place');
 if(initial.get('view')==='walk'){
  const place=requestedPlace&&(places[requestedPlace]||tourGoals[requestedPlace])?requestedPlace:'arcade';
  const saved=restoreWalkCheckpoint(initial,place);
  setMode('walk',{place});
  if(saved)walkGuide.restoreState({goal:normalizeDestination(place),selected:true,collapsed:saved.collapsed,arrived:saved.arrived},navigationPosition());
 }else if(requestedPlace&&(places[requestedPlace]||tourGoals[requestedPlace]))goPlace(requestedPlace,false);
 $('load-status').textContent='正在准备室内与室外画面…';await renderer.compileAsync(scene,camera);document.body.dataset.ready='true';clock.time=performance.now();renderer.setAnimationLoop(render);
 window.addEventListener('resize',resize);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('图形上下文已暂停，请重新加载页面恢复。');});
 return arenaEntry;
}

function restoreWalkCheckpoint(initial,place){
 if(initial.has('room')||initial.has('experience')||performance.getEntriesByType('navigation')[0]?.type!=='reload')return null;
 const saved=walkCheckpoint.load(place);
 if(!saved)return null;
 const feet=safeCheckpointFloor(saved,walkGeometry(),blocked);
 if(feet===null)return null;
 walker.position.set(saved.x,feet+EYE_HEIGHT,saved.z);
 Object.assign(walker,{yaw:saved.yaw,pitch:saved.pitch,visited:true});
 walkingTour.restore(saved.tour);
 return saved;
}
function saveWalkCheckpoint(){
 if(mode!=='walk'||matchStarting||matchday?.active||seatStanding||walkFeet===null)return;
 walkCheckpoint.save({place:active,x:camera.position.x,z:camera.position.z,feet:walkFeet,yaw,pitch,guide:walkGuide.captureState(),tour:walkingTour.snapshot()});
}

const arenaEntry={
 getSettings(){return{night,quality:qualityMode};},
 setEnvironment(value){setDayNight(value);updateLocationURL();},
 setQuality(value){$('quality').value=value;setQuality();persistDisplaySettings();},
 pauseForHub(){
  const state={ready:walkReady,matchPaused:matchday.paused};
  stopTour();clearWalkInput();document.exitPointerLock?.();
  if(matchday.active)matchday.setPaused(true);
  setWalkReady(false);setNavOpen(false);
  return state;
 },
 resumeFromHub(state){
  if(matchday.active)matchday.setPaused(state.matchPaused);
  setWalkReady(state.ready);frameBudget.invalidate();
 },
 enter(panel){
  if(matchday.active)matchday.exit();
  if(panel==='explore'){
   walkingTour.cancel();
   setMode('walk',{place:'entrance'});
   teleportToDestination('entrance');beginWalk();
  }else matchday.launch(panel);
 }
};

function buildSky(){
 const uniform={top:{value:new THREE.Color(0x7e9db4)},bottom:{value:new THREE.Color(0xdfe8e6)},sunDirection:{value:v(-.45,.7,.45).normalize()},night:{value:0}};
 const sm=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:uniform,vertexShader:'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDirection; uniform float night; varying vec3 vDir; void main(){vec3 d=normalize(vDir); float t=pow(max(d.y,0.0),0.5);vec3 c=mix(bottom,top,t);float s=pow(max(dot(d,sunDirection),0.0),250.0); c+=vec3(1.0,.85,.6)*s*(1.0-night)*1.3; gl_FragColor=vec4(c,1.0); #include <tonemapping_fragment> #include <colorspace_fragment> }'});
 // Shader includes must begin on their own lines.
 sm.fragmentShader=sm.fragmentShader.replaceAll(' #include','\n#include').replace('> }','>\n}');sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),sm);sky.renderOrder=-10;scene.add(sky);
 const random=seeded(49),pos=[];for(let i=0;i<1500;i++){const t=random()*TAU,y=random(),r=Math.sqrt(1-y*y)*1900;pos.push(Math.cos(t)*r,y*1900,Math.sin(t)*r);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xd9e6f9,size:1.35,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));stars.visible=false;scene.add(stars);
}

function setDayNight(n){frameBudget.invalidate();night=n;document.body.dataset.environment=n?'night':'day';$('day').classList.toggle('active',!n);$('night').classList.toggle('active',n);$('day').setAttribute('aria-pressed',String(!n));$('night').setAttribute('aria-pressed',String(n));hemi.intensity=n?.72:1.25;hemi.color.set(n?0x9aadc5:0xdae9ff);hemi.groundColor.set(n?0x3e4539:0x686f54);ambient.intensity=n?.30:.22;dayLight.intensity=n?.22:2.65;dayLight.color.set(n?0x7497d1:0xffeed5);scene.fog.color.set(n?0x081423:0xb8cbd6);scene.fog.density=n?.0016:.00082;sky.material.uniforms.top.value.set(n?0x020817:0x7e9db4);sky.material.uniforms.bottom.value.set(n?0x14243b:0xdfe8e6);sky.material.uniforms.night.value=n?1:0;const hdrReady=visualAssets?.setTime(scene,n);sky.visible=!hdrReady;stars.visible=n&&!hdrReady;renderer.toneMappingExposure=n?1.04:.98;stadium.night(n);world.night(n);interiors.night(n);matchday?.night(n);}

function beginMatchday({cinematic,playing=false}){
 matchStarting=true;clearTimeout(toastTimer);$('toast').classList.remove('visible');
 interactions?.stand();
 if(!matchSnapshot)matchSnapshot={mode,active,night,position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),fov:camera.fov,yaw,pitch,walkFeet,desiredEye,ready:walkReady,guide:walkGuide.captureState(),tour:walkingTour.snapshot(),roof:$('roof').checked,map:!document.querySelector('.minimap').hidden,hud:document.body.classList.contains('hud-hidden'),walker:{position:walker.position.clone(),yaw:walker.yaw,pitch:walker.pitch,visited:walker.visited}};
 stopTour();walkingTour.cancel();refreshWalkingTour();$('info-dialog').close();document.body.classList.remove('hud-hidden');$('toggle-hud').setAttribute('aria-pressed','false');$('toggle-hud').setAttribute('aria-label','隐藏界面');if(cinematic||playing){if(mode!=='walk')setMode('walk',{place:'pitch'});goPlace('pitch',false);if(cinematic)setDayNight(true);$('roof').checked=true;stadium.roof.visible=true;stadium.circulation.setRoof(true);interiors.setRoof(true);document.querySelector('.minimap').hidden=true;$('map-toggle').setAttribute('aria-expanded','false');}walkGuide.setSuppressed(cinematic||playing);clearWalkInput();touchSprint=false;$('touch-sprint').setAttribute('aria-pressed','false');if(playing){yaw=0;pitch=-.14;gameCameraInstant=true;controls.enabled=false;}setWalkReady(true);matchStarting=false;updateLocationURL();frameBudget.invalidate();
}
function updateGameView(view){
 gameCameraInstant=true;const first=view==='first';for(const[id,selected]of[['orbit-mode',!first],['walk-mode',first]]){$(id).classList.toggle('active',selected);$(id).setAttribute('aria-pressed',String(selected));}$('crosshair').hidden=!first;updateLocationURL();
}
function applyGameCamera(state,view,dt){
 const player=state.players.find(p=>p.id===state.controlledId);if(!player)return;
 const penalty=state.replay?null:penaltyContext(state),cameraView=penalty?'third':view,phase=state.setPiece?'match-penalty':state.phase,changed=!state.replay&&(gameCameraPlayer!==state.controlledId||gameCameraStoppage!==state.stoppageId||gameCameraPhase!==phase&&(penalty||gameCameraPhase==='match-penalty'||['kickoff','penalties'].includes(phase)));if(changed&&(view==='first'||penalty))gameCameraInstant=true;
 gameCameraPlayer=state.controlledId;gameCameraStoppage=state.stoppageId;gameCameraPhase=phase;
 const period=state.phase==='penalties'?'penalty-'+(state.competition.shootout.home.length+state.competition.shootout.away.length):state.competition?.period;if(gameCameraPeriod!==period){gameCameraInstant=true;gameCameraPeriod=period;if(view==='first')yaw=player.yaw-Math.PI;}if(gameCameraInstant&&view==='first')yaw=player.yaw-Math.PI;
 const ball=footballBallForDisplay(state),trackShot=ball===state.ball?footballShotFocus(state):ball.type==='shoot';
 const desired=state.replay?replayCamera(state,innerWidth/innerHeight):footballCamera(player,{view:cameraView,yaw,pitch,style:state.cameraMode,ball,aspect:innerWidth/innerHeight,penalty,training:state.training,playerFocus:footballPlayerFocus(state),trackShot}),pose=advanceFootballCamera({position:camera.position.toArray(),target:gameCameraLook?.toArray(),fov:camera.fov},desired,{player,aspect:innerWidth/innerHeight,dt,rate:['broadcast','close'].includes(state.cameraMode)?7:9,changed,instant:gameCameraInstant||cameraView==='first'});camera.position.fromArray(pose.position);
 if(pose.target){if(!gameCameraLook)gameCameraLook=v();gameCameraLook.fromArray(pose.target);camera.lookAt(gameCameraLook);}else camera.rotation.set(pose.pitch,pose.yaw,0,'YXZ');gameCameraInstant=false;
 if(camera.fov!==pose.fov){camera.fov=pose.fov;camera.updateProjectionMatrix();}
 camera.updateMatrixWorld();
 writeHudProperty($('crosshair'),'hidden',cameraView!=='first');
 if(penalty)matchday.projectGamePenalty((x,y,z)=>{
  temp.set(x,y,z).project(camera);
  return temp.set((temp.x+1)*innerWidth/2,(1-temp.y)*innerHeight/2,temp.z);
 });
 const cue=!penalty&&!state.paused&&state.phase==='playing'&&!state.replay?offscreenBallCue(temp.set(ball.x,Math.max(.11,ball.y),ball.z).project(camera),innerWidth,innerHeight):null;
 writeHudProperty(ballCue,'hidden',!cue);
 if(cue){
  writeHudProperty(ballCue.style,'transform',`translate(${Math.round(cue.x)}px,${Math.round(cue.y)}px) translate(-50%,-50%)`);
  writeHudProperty(ballCueArrow.style,'transform',`rotate(${Math.round(cue.angle)}deg)`);
  writeHudProperty(ballCueDistance,'textContent',Math.round(Math.hypot(player.x-ball.x,player.z-ball.z))+' m');
 }
 walkFeet=0;
}
function gameInput(dt){
 if(matchday.paused)return footballInput();
 const forward=(keys.has('KeyW')||keys.has('ArrowUp')||moveFlags.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||moveFlags.has('back')?1:0)+touchAxes.y,side=(keys.has('KeyD')||keys.has('ArrowRight')||moveFlags.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||moveFlags.has('left')?1:0)+touchAxes.x;
 const penalty=penaltyContext(matchday.gameState),inputYaw=footballControlYaw(matchday.gameState,{cameraMode:penalty?'close':matchday.gameCamera,yaw});
 const input={...footballInput({forward:penalty?.role==='keeper'?0:forward,side,yaw:inputYaw,sprint:touchSprint||keys.has('ShiftLeft')||keys.has('ShiftRight'),defend:keys.has('KeyE')}),yaw:inputYaw};
 if(penalty)input.penaltyAimAxis={x:THREE.MathUtils.clamp(side,-1,1),y:THREE.MathUtils.clamp(forward,-1,1)};
 return input;
}
function applyEntrancePose(sample,{instant=false,dt=.016}={}){
 camera.position.x=sample.x;camera.position.z=sample.z;const y=sample.feet+EYE_HEIGHT+sample.bob;camera.position.y=instant?y:THREE.MathUtils.damp(camera.position.y,y,18,dt);walkFeet=sample.feet;desiredEye=EYE_HEIGHT;yaw=sample.yaw;pitch=sample.pitch;camera.rotation.set(pitch,yaw,0,'YXZ');if(Math.abs(camera.fov-sample.fov)>.02){camera.fov=sample.fov;camera.updateProjectionMatrix();}if(instant)walkGuide.setGoal('pitch',camera.position);frameBudget.invalidate();
}
function finishMatchdayEntrance({manual=false}={}){clearWalkInput();camera.fov=66;camera.updateProjectionMatrix();syncAngles();walkFeet=floorAt(camera.position.x,camera.position.z);walkGuide.setSuppressed(false);if(manual)walkGuide.setGoal('pitch',camera.position);else walkGuide.arrive('pitch',camera.position);setWalkReady(true);canvas.focus({preventScroll:true});frameBudget.invalidate();}
function visitMatchdayBench(){teleportToDestination('pitch');camera.position.set(-33.2,1.7,-18);camera.lookAt(-38.5,1.25,-18);syncAngles();walkFeet=0;walker.position.copy(camera.position);walker.yaw=yaw;walker.pitch=pitch;walkGuide.arrive('pitch',camera.position);frameBudget.invalidate();}
function restoreFromMatchday(){
 const saved=matchSnapshot;if(!saved)return;matchSnapshot=null;walkingTour.restore(saved.tour);clearWalkInput();touchSprint=false;$('touch-sprint').setAttribute('aria-pressed','false');if(mode!==saved.mode)setMode(saved.mode,{place:saved.active});goPlace(saved.active,false);camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.updateProjectionMatrix();controls.target.copy(saved.target);if(mode==='orbit')controls.update();yaw=saved.yaw;pitch=saved.pitch;walkFeet=saved.walkFeet;desiredEye=saved.desiredEye;walker.position.copy(saved.walker.position);Object.assign(walker,{yaw:saved.walker.yaw,pitch:saved.walker.pitch,visited:saved.walker.visited});setDayNight(saved.night);$('roof').checked=saved.roof;stadium.roof.visible=saved.roof;stadium.circulation.setRoof(saved.roof);interiors.setRoof(saved.roof);document.querySelector('.minimap').hidden=!saved.map;$('map-toggle').setAttribute('aria-expanded',String(saved.map));document.body.classList.toggle('hud-hidden',saved.hud);$('toggle-hud').setAttribute('aria-pressed',String(saved.hud));$('toggle-hud').setAttribute('aria-label',saved.hud?'显示界面':'隐藏界面');walkGuide.setSuppressed(false);walkGuide.restoreState(saved.guide,navigationPosition(),desiredEye);setWalkReady(saved.ready);controls.enabled=mode==='orbit';for(const[id,on]of[['orbit-mode',mode==='orbit'],['walk-mode',mode==='walk']]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}$('crosshair').hidden=mode!=='walk';updateLocationURL();frameBudget.invalidate();
}

function goPlace(id,animate=true){
 if(matchday?.playing&&!matchStarting){toast('请先退出球赛，再继续参观。');return;}
 if(matchday?.cinematic&&!matchStarting)matchday.stopFollowing();
 const tour=walkingTour.state();
 const detour=tour?.goal===walkGuide.getGoal()&&normalizeDestination(id)!==tour.goal;
 const p=places[id]||(tourGoals[id]?{...(id==='entrance'?places.exterior:places.stands),title:tourGoals[id]}:null);if(!p)return;setNavOpen(false);clearWalkInput();active=id;document.body.dataset.place=id;document.querySelectorAll('.location').forEach(b=>{const on=b.dataset.place===id;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'location':'false');});$('place-title').textContent=p.title;$('place-tag').textContent=p.tag;$('place-desc').textContent=p.desc;$('accuracy-tag').textContent=p.accuracy;
 walkGuide.setGoal(normalizeDestination(id),navigationPosition(),mode==='walk'?desiredEye:EYE_HEIGHT);
 if(mode==='walk'){setWalkReady(true);canvas.focus({preventScroll:true});transition=null;if(!matchStarting)toast('已设置步行路线：'+(tourGoals[id]||p.title)+(detour?' · 原导览已保留':''));}else{
  controls.maxPolarAngle=roomSpecs[id]||id==='tunnel'||id==='concourse'?Math.PI*.8:Math.PI*.61;
  const dest=v(...p.pos),target=v(...p.target);if(animate&&!mediaReduced&&!roomSpecs[id]&&id!=='tunnel'&&id!=='concourse'){transition={from:camera.position.clone(),to:dest,startTarget:controls.target.clone(),target,time:0,duration:1.65};}else{camera.position.copy(dest);controls.target.copy(target);controls.update();transition=null;}
  if(!tourOn&&!matchStarting)toast('已选择：'+(tourGoals[id]||p.title)+' · 可步行或传送');
 }
 walkGuide.update(navigationPosition(),mode==='walk'?yaw:walker.yaw,.12,mode,mode==='walk'?desiredEye:EYE_HEIGHT);
 $('autorotate').checked=false;controls.autoRotate=false;updateLocationURL();
}

function syncAngles(){const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=e.y;pitch=e.x;}
function focusArenaSeat({target}){clearWalkInput();camera.lookAt(target.x,target.y,target.z);syncAngles();frameBudget.invalidate();toast('已对准座位 · 再次确认即可入座。');}
function seatIntoView(session){
 seatStanding={feet:walkFeet??camera.position.y-desiredEye,eye:desiredEye};stopTour();refreshWalkingTour();clearWalkInput();
 walkFeet=session.feet;desiredEye=session.eyePosition.y-session.feet;camera.position.copy(session.eyePosition);yaw=session.yaw;pitch=-.08;camera.rotation.set(pitch,yaw,0,'YXZ');walkGuide.setSuppressed(true);document.body.dataset.seated='true';frameBudget.invalidate();
}
function standFromSeat(session){
 camera.position.copy(session.standingPosition);walkFeet=seatStanding?.feet??floorAt(camera.position.x,camera.position.z);desiredEye=seatStanding?.eye??EYE_HEIGHT;camera.position.y=walkFeet+desiredEye;seatStanding=null;walkGuide.setSuppressed(false);document.body.dataset.seated='false';frameBudget.invalidate();
}
function clearWalkInput(){smoothInput.x=smoothInput.z=0;keys.clear();moveFlags.clear();movementPointers.clear();touchAxes.x=touchAxes.y=0;joystickPointer=null;if($('joystick-thumb'))$('joystick-thumb').style.transform='none';dragging=false;lastPointer=null;document.body.classList.remove('looking');}
function setNavOpen(open){if(open&&matchday?.playing)return;$('explore').hidden=!open;$('nav-trigger').setAttribute('aria-expanded',String(open));$('guide-goal').setAttribute('aria-expanded',String(open));document.body.classList.toggle('nav-open',open);destinationMenu?.setOpen(open);if(open){setMapOpen(false);clearWalkInput();if(document.pointerLockElement===canvas)document.exitPointerLock?.();}}
function setMapOpen(open){
 if(open&&matchday?.playing)return;
 const panel=$('arena-map-panel');
 panel.hidden=!open;
 $('map-toggle').setAttribute('aria-expanded',String(open));
 if(open){
  setNavOpen(false);clearWalkInput();
  if(document.pointerLockElement===canvas)document.exitPointerLock?.();
  drawMap(true);
 }
}
function toggleMap(){setMapOpen($('arena-map-panel').hidden);}
function toggleHUD(){if(matchday?.playing)return;setNavOpen(false);const hidden=document.body.classList.toggle('hud-hidden');$('toggle-hud').setAttribute('aria-pressed',String(hidden));$('toggle-hud').setAttribute('aria-label',hidden?'显示界面':'隐藏界面');}
function setWalkReady(ready){walkReady=mode==='walk'&&ready;document.body.dataset.walking=String(walkReady);$('walk-prompt').hidden=mode!=='walk'||walkReady;if(!walkReady)clearWalkInput();}
function updateLookHint(){const locked=document.pointerLockElement===canvas;document.body.dataset.look=locked?'locked':'drag';const label=$('look-hint'),button=$('lock-pointer');if(label)label.textContent=locked?'移动鼠标转头':'按住画面转头 · Q/E 转向 · PgUp/PgDn 抬头低头';if(button){button.textContent=locked?'释放鼠标':'锁定鼠标';button.disabled=pointerLockPending;}}
function setMode(next,{place}={}){
 if(matchday?.playing){clearWalkInput();matchday.setGameView(next==='walk'?'first':'third');return;}
 if(matchday?.cinematic&&!matchStarting)matchday.stopFollowing();
 if(!camera)return;if(next===mode){if(next==='walk')beginWalk();return;}
 if(mode==='walk'){interactions.stand();walker.position.copy(navigationPosition());walker.position.y+=EYE_HEIGHT-desiredEye;walker.yaw=yaw;walker.pitch=pitch;walker.visited=true;desiredEye=EYE_HEIGHT;}
 mode=next;document.body.dataset.mode=next;transition=null;clearWalkInput();setNavOpen(false);controls.enabled=next==='orbit';controls.autoRotate=false;$('autorotate').checked=false;
 $('orbit-mode').classList.toggle('active',next==='orbit');$('walk-mode').classList.toggle('active',next==='walk');$('orbit-mode').setAttribute('aria-pressed',String(next==='orbit'));$('walk-mode').setAttribute('aria-pressed',String(next==='walk'));$('movement').hidden=next!=='walk';$('crosshair').hidden=next!=='walk';
 if(next==='walk'){
  stopTour();camera.fov=66;camera.updateProjectionMatrix();$('hint').innerHTML='<span>WASD 移动 · Shift 加速</span><i></i><span id="look-hint">按住画面转头 · Q/E 转向 · PgUp/PgDn 抬头低头</span><i></i><button id="lock-pointer">锁定鼠标</button><i></i><button id="entrance">回到正门</button>';$('lock-pointer').onclick=lockMouse;$('entrance').onclick=spawnEntrance;camera.position.copy(walker.position);walkFeet=walker.position.y-EYE_HEIGHT;yaw=walker.yaw;pitch=walker.pitch;camera.rotation.set(pitch,yaw,0,'YXZ');desiredEye=EYE_HEIGHT;goPlace(place||((active==='exterior'&&!walker.visited)?'arcade':walkGuide.getGoal()),false);updateLookHint();
 }else{
  document.exitPointerLock?.();setWalkReady(false);camera.fov=48;camera.updateProjectionMatrix();$('hint').innerHTML='<span>↔ 拖动环绕</span><i></i><span>⌕ 滚轮缩放</span><i></i><button id="reset">↺ 重置视角</button>';$('reset').onclick=()=>goPlace(active);goPlace(active,false);
 }
 updateLocationURL();
}
function spawnEntrance(){if(matchday?.playing)return;interactions?.stand();desiredEye=EYE_HEIGHT;camera.position.fromArray(places.exterior.walk);walkFeet=camera.position.y-EYE_HEIGHT;camera.lookAt(v(...mainEntrance.look));syncAngles();goPlace('arcade',false);setWalkReady(true);canvas.focus({preventScroll:true});}
function followDestination(){if(mode!=='walk')setMode('walk',{place:walkGuide.getGoal()});else{walkGuide.reset(navigationPosition());beginWalk();}}
function teleportToDestination(id=walkGuide.getGoal()){
 if(matchday?.playing)return;
 const arrival=destinationArrival(id,walkGeometry());stopTour();if(mode!=='walk')setMode('walk',{place:arrival.goal});
 clearWalkInput();interactions.stand();desiredEye=EYE_HEIGHT;transition=null;camera.position.fromArray(arrival.position);walkFeet=arrival.feet;camera.lookAt(v(...arrival.look));syncAngles();
 goPlace(arrival.goal,false);walkGuide.arrive(arrival.goal,camera.position);walker.position.copy(camera.position);walker.yaw=yaw;walker.pitch=pitch;walker.visited=true;
 beginWalk();toast('已传送到：'+tourGoals[arrival.goal]);
}
function beginWalk(){if(mode!=='walk'||matchday?.playing&&matchday.paused)return;setNavOpen(false);setWalkReady(true);canvas.focus({preventScroll:true});updateLookHint();}
async function lockMouse(){
 if(mode!=='walk'||pointerLockPending)return;if(document.pointerLockElement===canvas){document.exitPointerLock?.();return;}
 beginWalk();if(!canvas.requestPointerLock){toast('按住画面即可转头，WASD 可直接移动。');return;}
 pointerLockPending=true;updateLookHint();try{await canvas.requestPointerLock();}catch{toast('鼠标未锁定，可继续按住画面转头。');}finally{pointerLockPending=false;updateLookHint();}
}
function turn(dx,dy,sensitivity=.003){yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*sensitivity,-1.44,1.44);camera.rotation.set(pitch,yaw,0,'YXZ');}
function keyCode(event){const aliases={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',q:'KeyQ',e:'KeyE',p:'KeyP',n:'KeyN',h:'KeyH',f:'KeyF',t:'KeyT',j:'KeyJ',k:'KeyK',l:'KeyL',c:'KeyC',g:'KeyG',v:'KeyV',r:'KeyR',x:'KeyX',z:'KeyZ',' ':'Space',space:'Space',up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',escape:'Escape',esc:'Escape',shift:'ShiftLeft'};return event.code&&event.code!=='Unidentified'?event.code:(aliases[(event.key||'').toLowerCase()]||event.key);}

function inside(x,z,spec,margin=0){return x>spec.x-spec.w/2-margin&&x<spec.x+spec.w/2+margin&&z>spec.z-spec.d/2-margin&&z<spec.z+spec.d/2+margin;}
function floorAt(x,z,feetY=walkFeet??camera.position.y-desiredEye){return floorHeight(x,z,feetY,{tiers:stadium.tiers,rooms:roomSpecs});}
function blocked(x,z,y){
 return hitsWall(x,z,y,interactions.colliders)||hitsWall(x,z,y,serviceRooms.colliders)||hitsWall(x,z,y,building.colliders)||hitsWall(x,z,y,interiors.colliders)||hitsWall(x,z,y,world.colliders)||hitsWall(x,z,y,stadium.circulation.colliders);
}

function moveWalk(dt){
 if(mode!=='walk'||!walkReady||!$('explore').hidden||document.querySelector('dialog[open]'))return;
 yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*Math.min(dt,.25)*1.5;
 const f=(keys.has('KeyW')||keys.has('ArrowUp')||moveFlags.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||moveFlags.has('back')?1:0)+touchAxes.y,s=(keys.has('KeyD')||keys.has('ArrowRight')||moveFlags.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||moveFlags.has('left')?1:0)+touchAxes.x;
 if(interactions.seated&&Math.hypot(f,s)<.01){camera.rotation.set(pitch,yaw,0,'YXZ');return;}
 smoothWalkInput(smoothInput,s,f,dt);forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));step.set(0,0,0).addScaledVector(forward,smoothInput.z).addScaledVector(right,smoothInput.x);
 if(step.lengthSq()){interactions.stand();
  const duration=Math.min(dt,.25),speed=touchSprint||keys.has('ShiftLeft')||keys.has('ShiftRight')?10:4.5;step.normalize().multiplyScalar(speed*duration*Math.min(1,Math.hypot(smoothInput.x,smoothInput.z)));
  walkFeet=advanceWalker(camera.position,walkFeet??camera.position.y-desiredEye,step.x,step.z,walkGeometry(),blocked);
 }
 walkFeet=floorAt(camera.position.x,camera.position.z);const y=walkFeet+desiredEye;camera.position.y=THREE.MathUtils.lerp(camera.position.y,y,1-Math.exp(-Math.min(dt,.25)*15));camera.rotation.set(pitch,yaw,0,'YXZ');
}

const hotspotDefs=[{name:'探索球场内部',id:'stands',p:[0,52,0],outside:true},{name:'南广场',id:'esplanade',p:[0,2,190],outside:true},{name:'草坪与看台',id:'pitch',p:[0,2,0],inside:true},{name:'球员通道',id:'tunnel',p:[-39,3,0],inside:true},{name:'主队更衣室',id:'homeRoom',p:[-78,3,-2],inside:true}];
function buildHotspots(){for(const h of hotspotDefs){const b=document.createElement('button');b.className='hotspot';b.innerHTML=`<span class="dot">+</span>${h.name}`;b.setAttribute('aria-label','前往'+h.name);b.addEventListener('click',()=>{stopTour();goPlace(h.id);});$('hotspots').appendChild(b);h.el=b;}}
function updateHotspots(){const on=$('markers').checked&&mode==='orbit';const outdoors=active==='exterior'||active==='esplanade';for(const h of hotspotDefs){const show=on&&!roomSpecs[active]&&active!=='tunnel'&&((h.outside&&outdoors)||(h.inside&&!outdoors));if(!show){h.el.hidden=true;continue;}temp.fromArray(h.p).project(camera);const px=(temp.x*.5+.5)*innerWidth,py=(-temp.y*.5+.5)*innerHeight;h.el.hidden=temp.z<0||temp.z>1||px<260||px>innerWidth-240||py<175||py>innerHeight-180;if(!h.el.hidden){h.el.style.left=px+'px';h.el.style.top=py+'px';}}}

const map=$('map'),ctx=map.getContext('2d'),mapDirection=v();
let lastMapView=null,lastMapPaint,listedFloor,listedGoal;
function chooseMapPlace(id){
 setMapOpen(false);goPlace(id,false);
 if(mode==='orbit')canvas.focus({preventScroll:true});
}
function updateMapPlaces(view,goal){
 if(listedFloor===view.floor&&listedGoal===goal)return;
 listedFloor=view.floor;listedGoal=goal;
 const list=$('map-places');
 list.hidden=view.floor==='overview';
 if(list.hidden){list.replaceChildren();return;}
 const buttons=view.destinations.map(id=>{
  const button=document.createElement('button');
  button.type='button';button.textContent=id==='entrance'?'南侧正门':tourGoals[id];
  button.setAttribute('aria-current',String(id===goal));
  button.onclick=()=>chooseMapPlace(id);
  return button;
 });
 list.replaceChildren(...buttons);
}
function drawMap(force=false){
 const {x,y,z}=camera.position,route=walkGuide.getRoute(),goal=walkGuide.getGoal(),selection=$('map-floor').value;
 camera.getWorldDirection(mapDirection);
 const heading=-Math.atan2(mapDirection.x,-mapDirection.z);
 const previous=lastMapPaint;
 if(!force&&previous&&previous.mode===mode&&previous.night===night&&previous.goal===goal&&previous.route===route&&previous.selection===selection
    &&Math.abs(previous.x-x)+Math.abs(previous.z-z)<.30&&Math.abs(previous.y-y)<.13&&Math.abs(previous.heading-heading)<.025)return;
 lastMapPaint={x,y,z,heading,mode,night,goal,route,selection};
 lastMapView=drawArenaFloorMap(ctx,{position:camera.position,feetY:camera.position.y-desiredEye,mode,night,route,goal,yaw:heading,selection});
 const label=lastMapView.floor===lastMapView.current||lastMapView.floor==='overview'?lastMapView.label:'你在 '+lastMapView.currentLabel;
 writeHudProperty($('elevation'),'textContent',label);
 writeHudProperty($('map-position-key'),'textContent',lastMapView.showPosition?'红点为当前位置 · 金线为路线':'点选地点查看路线');
 updateMapPlaces(lastMapView,goal);
}

let modalWasOpen=false;
function constrainRoomOrbit(){const spec=roomSpecs[active];if(!spec)return;const clipped=constrainInteriorOrbit(camera.position,controls.target,spec);camera.position.copy(clipped.position);controls.target.copy(clipped.target);camera.lookAt(controls.target);}
function drawArena(){
 matchday?.cullCrowd(camera);
 renderer.render(scene,camera);
}
function render(timestamp){
 const playing=!!matchday?.playing;
 const raw=Math.min(clock.getDelta(),1);
 if(playing!==matchBudgetActive){
  matchBudgetActive=playing;setExplorationMatchMode(playing);
  if(playing)$('interact').hidden=true;
  resetMatchBudget();applyAdaptiveScale(playing?matchFrameRate.state.scale:1);
 }
 elapsed+=raw;sceneTime+=raw;frames++;
 if(transition){
  transition.time+=raw;
  const a=Math.min(transition.time/transition.duration,1),t=1-(1-a)**3;
  camera.position.lerpVectors(transition.from,transition.to,t);controls.target.lerpVectors(transition.startTarget,transition.target,t);
  if(a===1)transition=null;
 }
 const phone=innerWidth<=1024;
 const phase=playing?matchday.gameState?.phase:null;
 const replay=playing&&matchday.gameReplaying;
 const matchPaused=playing&&matchday.paused;
 const livePhase=phase==='playing'||phase==='penalties';
 const sample=livePhase&&!matchPaused&&!replay&&$('game-overlay').hidden&&!document.hidden;
 // Keep processing network traffic during halftime while the stationary
 // camera and match overlay only need occasional visual updates.
 const drawRate=matchPaused&&!replay?24:matchFrameRate.state.rate;
 const drawSlack=sample&&phone&&matchday.online?MOBILE_ONLINE_FRAME_SLACK:.0007;
 const drawFrame=playing?gameDrawBudget.ready(timestamp/1000,drawRate,drawSlack):visitDrawBudget.ready(elapsed,phone?60:90);
 const measureStart=sample?performance.now():0;
 let rendered=false;
 if(!playing){
  if(mode==='orbit'){controls.update(raw);constrainRoomOrbit();}
  else if(!matchday?.cinematic)moveWalk(raw);
 }
 const gameStart=sample?performance.now():0;
 matchday?.update(raw,camera.position,yaw,playing?gameInput(raw):{},drawFrame);
 if(sample)matchSampleGameWork+=performance.now()-gameStart;
 if(tourOn){
  tourElapsed+=raw;
  if(tourElapsed>7.5){tourElapsed=0;tourIndex=(tourIndex+1)%Object.keys(places).length;goPlace(Object.keys(places)[tourIndex]);}
 }
 if(drawFrame){
  if(playing&&pendingMatchScale!==undefined){
   // Resizing clears the buffer. Resize immediately before a draw so there
   // is no cleared frame between adapting and presenting the next picture.
   applyAdaptiveScale(pendingMatchScale);
   pendingMatchScale=undefined;
  }
  const modalOpen=!!document.querySelector('dialog[open]')||!!playing&&!$('game-overlay').hidden;
  if(modalWasOpen!==modalOpen)frameBudget.invalidate();
  modalWasOpen=modalOpen;
  const renderDelta=sceneTime;sceneTime=0;
  if(!playing){
   world.rotor.rotation.z=elapsed*.13;
   building.update(camera.position,mode);interactions.update(camera.position,renderDelta,mode,camera);
   interiors.update(camera.position,active);serviceRooms.update(camera.position,renderDelta);
   walkGuide.update(navigationPosition(),mode==='walk'?yaw:walker.yaw,renderDelta,mode,mode==='walk'?desiredEye:EYE_HEIGHT);refreshWalkingTour();
  }
  const privateEnclosed=!playing&&(Object.entries(roomSpecs).some(([key,s])=>key!=='lounge'&&inside(camera.position.x,camera.position.z,s)&&Math.abs(camera.position.y-s.y)<6)||(camera.position.x>-80&&camera.position.x<-66&&camera.position.z>-43&&camera.position.z<50&&camera.position.y<3)||!!serviceRoomAt({x:camera.position.x,y:camera.position.y-desiredEye,z:camera.position.z}));
  const inPublicConcourse=!playing&&(((Math.abs(camera.position.x)/105)**2.8+(Math.abs(camera.position.z)/122)**2.8<1&&(Math.abs(camera.position.x)/85)**2.8+(Math.abs(camera.position.z)/103)**2.8>1&&camera.position.y>12.9&&camera.position.y<17.8)||(camera.position.y>-2&&camera.position.y<44&&inCoreShaft(camera.position.x,camera.position.z)));
  stadium.root.visible=true;
  if(!playing){world.update(camera.position);updateArchitectureSectors(stadium.circulation.root,camera.position);stadium.circulation.update(camera.position,privateEnclosed);}
  stadium.update(camera,mode,qualityMode==='high',qualityMode==='low',playing,playing&&!matchday.training);
  const enclosed=privateEnclosed||inPublicConcourse||(camera.position.x>-70&&camera.position.x<-41&&Math.abs(camera.position.z)<2.5&&camera.position.y<3.5);
  const lightingChanging=updateSceneLighting({hemi,ambient,dayLight,arenaFill},lightingProfile({night,enclosed,position:camera.position}),renderDelta);
  const fixturesChanging=lightBudget.update(camera.position,renderDelta);
  const animated=lightingChanging||fixturesChanging||!!transition||tourOn||dragging||keys.size>0||movementPointers.size>0||interactions.isAnimating?.()||serviceRooms.isAnimating()||matchday?.isAnimating();
  if(frameBudget.shouldDraw(camera,elapsed,animated,modalOpen)){drawArena();drawnFrames++;rendered=true;}
 }
 if(sample){
  matchSampleTime+=raw;matchSampleFrames++;
  if(previousRaf)recordFrameGap(matchRafGaps,timestamp-previousRaf);previousRaf=timestamp;
  if(rendered){
   if(previousDraw)recordFrameGap(matchDrawGaps,timestamp-previousDraw);previousDraw=timestamp;
   matchSampleDraws++;matchSampleWork+=performance.now()-measureStart;
  }
  if(matchSampleTime>=1.5){
   const renderFps=Math.round(matchSampleDraws/matchSampleTime),rafFps=matchSampleFrames/matchSampleTime;
   const frameMs=matchSampleWork/Math.max(1,matchSampleDraws);
   const gap95=frameGap95(matchDrawGaps,matchSampleDraws-1),rafGap95=frameGap95(matchRafGaps,matchSampleFrames-1);
   const {rate,scale}=matchFrameRate.update({rafFps,renderFps,frameMs,gap95,rafGap95});
   document.body.dataset.targetFps=rate;
   document.body.dataset.frameGap95=String(gap95??'');
   document.body.dataset.matchRenderedFps=String(renderFps);
   document.body.dataset.matchRafFps=rafFps.toFixed(1);
   document.body.dataset.matchRafGap95=String(rafGap95??'');
   document.body.dataset.matchWorkMs=frameMs.toFixed(2);
   document.body.dataset.matchGameWorkMs=(matchSampleGameWork/matchSampleFrames).toFixed(2);
   const readout='最近实测 '+renderFps+' FPS';if($('game-frame-rate-status').textContent!==readout)$('game-frame-rate-status').textContent=readout;
   if(scale!==qualityScale)pendingMatchScale=scale;
   clearMatchSample();
  }
 }else if(matchSampling){
  clearMatchSample();
  matchFrameRate.interrupt();
 }
 matchSampling=sample;
 if(drawFrame&&telemetryBudget.ready(elapsed,20)){
  if(!playing){updateHotspots();if(!document.querySelector('.minimap').hidden)drawMap();}
  document.body.dataset.camera=camera.position.toArray().map(x=>x.toFixed(3)).join(',');
  document.body.dataset.heading=[yaw,pitch].map(x=>x.toFixed(4)).join(',');
 }
 if(elapsed-lastPerf>1.5){saveWalkCheckpoint();const fps=Math.round(frames/(elapsed-lastPerf)),renderRate=Math.round(drawnFrames/(elapsed-lastPerf));$('performance').textContent=`THREE.JS r${THREE.REVISION}  /  ${stadium.seatCount.toLocaleString()} 个座位模型  /  ${stadium.panelCount.toLocaleString()} 个气枕  /  ${renderRate} FPS`;document.body.dataset.fps=fps;document.body.dataset.renderfps=renderRate;drawnFrames=0;if(!playing&&qualityMode==='standard'){if(elapsed>6&&fps<28&&qualityScale>.82&&(keys.size>0||dragging||joystickPointer!==null||transition||tourOn||matchday?.cinematic)){applyAdaptiveScale(Math.max(.82,qualityScale*.92));recoveryFrames=0;}else if(fps>48&&qualityScale<1){if(++recoveryFrames>=4){applyAdaptiveScale(Math.min(1,qualityScale+.08));recoveryFrames=0;}}else recoveryFrames=0;}document.body.dataset.camera=camera.position.toArray().map(x=>x.toFixed(2)).join(',');document.body.dataset.nearSeats=stadium.detailSeatCount;document.body.dataset.drawcalls=renderer.info.render.calls;document.body.dataset.triangles=renderer.info.render.triangles;document.body.dataset.matchCrowdSubmitted=matchday?.crowdSubmitted??0;document.body.dataset.matchCrowdBatches=matchday?.crowdBatches??0;frames=0;lastPerf=elapsed;}
}
function recordFrameGap(histogram,ms){if(ms>0)histogram[Math.min(histogram.length-1,Math.ceil(ms))]++;}
function frameGap95(histogram,count){if(count<2)return undefined;const limit=Math.ceil(count*.95);let sum=0;for(let ms=1;ms<histogram.length;ms++){sum+=histogram[ms];if(sum>=limit)return ms;}}
function clearMatchSample(){matchSampleTime=matchSampleFrames=matchSampleDraws=matchSampleWork=matchSampleGameWork=previousRaf=previousDraw=0;matchRafGaps.fill(0);matchDrawGaps.fill(0);}
function resetMatchBudget(){
 const {rate}=matchFrameRate.reset({cap:matchFps,quality:qualityMode,mobile:innerWidth<=1024,online:!!matchday?.online});gameDrawBudget.reset();clearMatchSample();recoveryFrames=0;
 matchSampling=false;pendingMatchScale=undefined;
 document.body.dataset.targetFps=rate;document.body.dataset.matchFpsCap=matchFps;
 for(const key of ['frameGap95','matchRenderedFps','matchRafFps','matchRafGap95','matchWorkMs','matchGameWorkMs'])delete document.body.dataset[key];
 $('game-frame-rate-status').textContent='开球后测量实际帧率';
}
function syncMatchFpsOptions(){for(const option of document.querySelectorAll('[data-match-fps]'))option.value=String(matchFps);}
function persistDisplaySettings(){saveVisitorSettings(visitorStorage,{quality:qualityMode,matchFps});}
function setMatchFps(value){matchFps=matchFpsCap(value);syncMatchFpsOptions();setQuality();persistDisplaySettings();}
let bufferWidth=0,bufferHeight=0,physicalWidth=0,physicalHeight=0;
function syncDrawingBuffer(){
 const width=innerWidth,height=innerHeight,{pixelRatio}=qualityProfile(qualityMode,width,height,devicePixelRatio,qualityScale);
 const pixelsX=Math.floor(width*pixelRatio),pixelsY=Math.floor(height*pixelRatio);
 if(width===bufferWidth&&height===bufferHeight&&pixelsX===physicalWidth&&pixelsY===physicalHeight)return;
 bufferWidth=width;bufferHeight=height;physicalWidth=pixelsX;physicalHeight=pixelsY;
 renderer.setDrawingBufferSize(width,height,pixelRatio);document.body.dataset.resolution=pixelRatio.toFixed(2);frameBudget.invalidate();
}
function applyAdaptiveScale(scale){if(qualityScale===scale)return;qualityScale=scale;syncDrawingBuffer();matchday?.setQuality(qualityMode,scale);}
function setQuality(){
 frameBudget.invalidate();const next=$('quality').value,modeChanged=next!==qualityMode;qualityMode=next;
 resetMatchBudget();qualityScale=matchday?.playing?matchFrameRate.state.scale:1;syncDrawingBuffer();
 const shadow=qualityMode==='high';if(renderer.shadowMap.enabled!==shadow){renderer.shadowMap.enabled=shadow;renderer.shadowMap.needsUpdate=shadow;}
 document.body.dataset.quality=qualityMode;if(scene&&modeChanged)applySurfaceQuality(scene,qualityMode);matchday?.setQuality(qualityMode,qualityScale);
}

function resize(){document.body.dataset.touch=String(innerWidth<=1024);syncDrawingBuffer();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();frameBudget.invalidate();}
function updateLocationURL(){const q=new URLSearchParams(),room=matchday?.onlineRoom||new URLSearchParams(location.search).get('room');if(room)q.set('room',room);if(active!=='exterior'||mode==='walk')q.set('place',active);if(night)q.set('night','1');if(mode==='walk')q.set('view','walk');if(matchday?.active){q.set('experience',matchday.training?'training':matchday.playing?'football':'matchday');if(matchday.training)q.set('drill',matchday.training);}history.replaceState(null,'',location.pathname+(q.size?'?'+q:''));}
function resumeWalkingTour(){
 const tour=walkingTour.state();
 if(!tour)return;
 $('walking-tour-dialog').close();
 if(mode!=='walk')setMode('walk',{place:tour.goal});
 else if(walkGuide.getGoal()!==tour.goal)goPlace(tour.goal,false);
 beginWalk();refreshWalkingTour();
}
function upcomingWalkDestination(){
 const tour=walkingTour.state();
 if(!tour)return undefined;
 return tour.goal===walkGuide.getGoal()?tour.nextGoal:tour.goal;
}
function advanceWalkingTourFromGuide(){
 const tour=walkingTour.state();
 if(!tour)return false;
 if(tour.goal===walkGuide.getGoal())$('tour-advance').click();
 else resumeWalkingTour();
 return true;
}
function refreshWalkingTour(){const state=walkingTour.update(walkGuide.getGoal(),walkGuide.isArrived()),show=state?.arrived&&mode==='walk'&&walkReady&&!seatStanding&&$('explore').hidden&&!document.querySelector('dialog[open]'),key=JSON.stringify([state?.id,state?.index,state?.arrived,!!show]);if(key===tourUIState)return;tourUIState=key;document.body.dataset.walkingTour=state?.id||'none';$('tour-arrival').hidden=!show;if(state){$('tour-arrival-progress').textContent=`${state.index+1} / ${state.total} · ${state.title}`;$('tour-arrival-title').textContent='已到达 · '+tourGoals[state.goal];$('tour-advance').textContent=state.last?'完成导览':'下一站 →';}}
function stopTour(){if(!tourOn)return;tourOn=false;$('tour').innerHTML='<span>▷</span> 自动巡游 <small>15 个视角</small>';}
function bindUI(){
 document.body.dataset.touch=String(innerWidth<=1024);
 $('nav-visit-start').onclick=()=>teleportToDestination('entrance');$('nav-match-start').onclick=()=>{setNavOpen(false);matchday.launch();};$('nav-museum-start').onclick=()=>{setNavOpen(false);$('museum-catalog').click();};
 $('map-toggle').onclick=toggleMap;$('toggle-hud').onclick=toggleHUD;
 $('map-close').onclick=()=>{setMapOpen(false);$('map-toggle').focus({preventScroll:true});};
 $('map-floor').onchange=()=>drawMap(true);
 const joystick=$('joystick'),thumb=$('joystick-thumb');
 let joystickBounds;
 const steer=e=>{
  const r=joystickBounds??=joystick.getBoundingClientRect();
  const axes=joystickAxes(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);
  touchAxes.x=axes.x;touchAxes.y=axes.y;thumb.style.transform=`translate(${axes.thumbX}px,${axes.thumbY}px)`;
  matchday?.flushGameInput();
 };
 joystick.addEventListener('pointerdown',e=>{
  if(mode!=='walk'||matchday?.playing&&matchday.paused)return;
  e.preventDefault();beginWalk();joystickPointer=e.pointerId;
  joystickBounds=undefined;joystick.setPointerCapture(e.pointerId);steer(e);
 });
 joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer){e.preventDefault();steer(e);}});
 const releaseJoystick=e=>{
  if(e.pointerId!==joystickPointer)return;
  touchAxes.x=touchAxes.y=0;joystickPointer=null;joystickBounds=undefined;thumb.style.transform='none';
  matchday?.flushGameInput();
 };
 joystick.addEventListener('pointerup',releaseJoystick);joystick.addEventListener('pointercancel',releaseJoystick);joystick.addEventListener('lostpointercapture',releaseJoystick);
 window.addEventListener('resize',()=>{joystickBounds=undefined;});
 $('touch-sprint').onclick=()=>{
  touchSprint=!touchSprint;$('touch-sprint').setAttribute('aria-pressed',String(touchSprint));
  matchday?.flushGameInput();
 };
 $('environment-more').onclick=()=>{const panel=document.querySelector('.environment'),expanded=panel.classList.toggle('expanded');$('environment-more').setAttribute('aria-expanded',String(expanded));};
 document.querySelectorAll('.location').forEach(b=>b.onclick=()=>{stopTour();goPlace(b.dataset.place);});$('home').onclick=e=>{e.preventDefault();experienceHub.open();};$('reset').onclick=()=>goPlace(active);$('day').onclick=()=>{setDayNight(false);updateLocationURL();};$('night').onclick=()=>{setDayNight(true);updateLocationURL();};$('orbit-mode').onclick=()=>setMode('orbit');$('walk-mode').onclick=()=>setMode('walk');$('start-walk').onclick=beginWalk;
 $('roof').onchange=e=>{stadium.roof.visible=e.target.checked;stadium.circulation.setRoof(e.target.checked);interiors.setRoof(e.target.checked);renderer.shadowMap.needsUpdate=true;};$('autorotate').onchange=e=>{if(mode==='walk'){e.target.checked=false;toast('自动环绕可在第三人称视角中使用。');return;}controls.autoRotate=e.target.checked;};
 $('quality').onchange=()=>{setQuality();persistDisplaySettings();toast(qualityMode==='high'?'已启用精细画质与建筑投影。':qualityMode==='low'?'已启用省电画质。':'已启用自适应均衡画质。');};
 for(const select of document.querySelectorAll('[data-match-fps]'))select.onchange=()=>setMatchFps(select.value);
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('可使用浏览器全屏功能扩大画面。');}};
 $('capture').onclick=()=>{drawArena();const a=document.createElement('a');a.download=`allianz-arena-${active}-${night?'night':'day'}.png`;a.href=canvas.toDataURL('image/png');a.click();toast('已保存当前场景截图。');};
 $('help').onclick=()=>matchday?.playing?matchday.showGameHelp():openDialog('help');$('references').onclick=()=>openDialog('references');document.querySelector('.close-dialog').onclick=()=>$('info-dialog').close();$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=$('info-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info-dialog').close();}});
 $('tour').onclick=()=>{if(tourOn){stopTour();return;}if(mode==='walk')setMode('orbit');setNavOpen(false);tourOn=true;tourElapsed=0;tourIndex=Object.keys(places).indexOf(active);$('tour').innerHTML='<span>Ⅱ</span> 暂停巡游 <small>每 7.5 秒切换</small>';toast('自动巡游开始；拖动场景或选择区域可暂停。');};
 $('walking-tour-plans').innerHTML=walkingTours.map(plan=>`<button data-walking-tour="${plan.id}"><small>${plan.stops.length} 站</small><b>${plan.title}<span>↗</span></b><p>${plan.description}</p></button>`).join('');
 $('walking-tour').onclick=()=>{setNavOpen(false);clearWalkInput();const tour=walkingTour.state(),resume=$('walking-tour-resume');resume.hidden=!tour;if(tour)resume.textContent='继续导览 · '+tourGoals[tour.goal];$('walking-tour-dialog').showModal();};
 $('walking-tour-resume').onclick=resumeWalkingTour;$('walking-tour-close').onclick=()=>$('walking-tour-dialog').close();
 document.querySelectorAll('[data-walking-tour]').forEach(button=>button.onclick=()=>{walkingTour.cancel();$('walking-tour-dialog').close();if(mode!=='walk')setMode('walk');const selected=walkingTour.start(button.dataset.walkingTour);goPlace(selected.goal,false);beginWalk();toast('已开始：'+selected.title);refreshWalkingTour();});
 $('tour-advance').onclick=()=>{const goal=walkingTour.next();if(goal)goPlace(goal,false);else toast('导览已完成，可以继续自由探索。');refreshWalkingTour();};$('tour-end').onclick=()=>{walkingTour.cancel();refreshWalkingTour();};
 $('nav-trigger').onclick=()=>setNavOpen($('explore').hidden);
 $('toggle-nav').onclick=()=>destinationMenu.dismiss();
 document.addEventListener('pointerdown',e=>{if(!$('explore').hidden&&!e.target.closest('#explore,#nav-trigger'))setNavOpen(false);});
 canvas.addEventListener('contextmenu',e=>{if(mode==='walk')e.preventDefault();});
 canvas.addEventListener('pointerdown',e=>{
  if(mode!=='walk'||matchday?.playing&&matchday.paused||(e.pointerType==='mouse'&&e.button===1))return;
  if(matchday?.playing&&matchday.gameCamera==='broadcast'){canvas.focus({preventScroll:true});return;}
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
 document.addEventListener('museum-open',()=>{clearWalkInput();stopTour();});
 window.addEventListener('blur',()=>{if(matchday?.active){if(matchday.online)matchday.clearOnlineInput();else matchday.setPaused(true);}if(mode==='walk')setWalkReady(false);else clearWalkInput();});
 window.addEventListener('pagehide',saveWalkCheckpoint);
 document.addEventListener('visibilitychange',()=>{
  clearMatchSample();
  if(matchSampling)matchFrameRate.interrupt();
  matchSampling=false;
  if(document.hidden){
   saveWalkCheckpoint();
   if(matchday?.active){if(matchday.online)matchday.clearOnlineInput();else matchday.setPaused(true);}
   clearWalkInput();renderer.setAnimationLoop(null);
  }else{clock.time=performance.now();renderer.setAnimationLoop(render);}
 });
 document.addEventListener('pointerlockchange',()=>{clearWalkInput();pointerLockPending=false;if(mode==='walk'&&document.pointerLockElement===canvas)setWalkReady(true);updateLookHint();});
 document.addEventListener('pointerlockerror',()=>{pointerLockPending=false;updateLookHint();if(mode==='walk')setWalkReady(true);});
 document.querySelectorAll('[data-move]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{if(mode!=='walk')return;e.preventDefault();setNavOpen(false);setWalkReady(true);movementPointers.set(e.pointerId,b.dataset.move);moveFlags.add(b.dataset.move);b.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});});
  b.addEventListener('pointerup',releasePointer);b.addEventListener('pointercancel',releasePointer);
 });
 window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(document.querySelector('dialog[open]')||e.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  const code=keyCode(e),movement=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code);
  if(matchday?.playing){
   if(e.target.closest?.('button')&&['Enter','NumpadEnter','Space'].includes(code))return;
   const movement=['KeyW','KeyA','KeyS','KeyD','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(code);e.preventDefault();
   if(matchday.gameReplaying){if(code==='Escape'||code==='KeyR')matchday.endReplay();return;}if(code==='KeyR'){if(!e.repeat)matchday.startReplay();return;}if(code==='Escape'){if(!e.repeat)matchday.setPaused(!matchday.paused);return;}if(code==='KeyH'){if(!e.repeat)matchday.showGameHelp();return;}if(matchday.paused)return;
   if(movement)keys.add(code);if(e.repeat)return;
   const penalty=penaltyContext(matchday.gameState);
   if(penalty&&movement)matchday.nudgeGamePenaltyAim();
   if(movement&&matchday.online)matchday.flushGameInput();
   if(penalty&&code==='KeyX')matchday.centerGamePenaltyAim();
   if(code==='KeyK'||code==='KeyF')matchday.beginGameCharge();const action={KeyJ:'pass',KeyL:'through',Space:'tackle',KeyQ:'switch'}[code];if(action)matchday.gameAction(action,{direction:gameInput(0)});if(code==='KeyZ')matchday.cycleShotKind();if(code==='KeyC')matchday.cycleGameCamera();if(code==='KeyG')matchday.cheer();if(!penalty&&(code==='KeyV'||code==='KeyP'))matchday.setGameView(matchday.gameView==='first'?'third':'first');if(code==='KeyN'){setDayNight(!night);updateLocationURL();}return;
  }
  if(matchday?.cinematic){if(code==='Escape'||code==='Space')matchday.setPaused(!matchday.paused);if(movement||code==='Space'||code==='Escape')e.preventDefault();return;}if(code==='Escape'){if(!$('arena-map-panel').hidden){setMapOpen(false);$('map-toggle').focus({preventScroll:true});return;}if(!$('explore').hidden){setNavOpen(false);canvas.focus({preventScroll:true});}else if(mode==='walk'){document.exitPointerLock?.();setWalkReady(false);}return;}
  if(mode==='walk'&&['PageUp','PageDown'].includes(code)){e.preventDefault();if(!walkReady)beginWalk();pitch=THREE.MathUtils.clamp(pitch+(code==='PageUp'?.12:-.12),-1.44,1.44);camera.rotation.set(pitch,yaw,0,'YXZ');frameBudget.invalidate();return;}
  if(movement&&mode==='walk'){e.preventDefault();if(!walkReady)beginWalk();keys.add(code);}else if(code==='ShiftLeft'||code==='ShiftRight')keys.add(code);
  if(e.repeat)return;
  if(code==='KeyF'&&mode==='walk'){if(!matchday?.kick(camera.position,yaw))interactions.activate();}if(code==='KeyT')teleportToDestination();if(code==='KeyM')toggleMap();if(code==='KeyU')toggleHUD();if(code==='KeyL')lockMouse();if(code==='KeyN'){setDayNight(!night);updateLocationURL();}if(code==='KeyP')setMode(mode==='orbit'?'walk':'orbit');if(code==='Home'){if(mode==='walk')spawnEntrance();else goPlace(active);};if(code==='KeyH')openDialog('help');
 });
 window.addEventListener('keyup',e=>{
  const code=keyCode(e),wasHeld=keys.delete(code);
  if(!matchday?.playing)return;
  if(wasHeld&&matchday.online)matchday.flushGameInput();
  if(code==='KeyK'||code==='KeyF')matchday.releaseGameCharge();
 });
 $('info-dialog').addEventListener('close',()=>{if(mode==='walk')beginWalk();});
 map.addEventListener('click',e=>{if(!lastMapView)return;const r=map.getBoundingClientRect(),point={x:(e.clientX-r.left)/r.width*map.width,y:(e.clientY-r.top)/r.height*map.height},id=mapDestinationAt(lastMapView,point);if(id)chooseMapPlace(id);else toast('点击地图上的地点圆点，选择步行目的地。');});
}

function showInteractiveInfo(title,text,goals=[],exhibit=null){$('info-dialog').classList.remove('museum-dialog');clearWalkInput();document.exitPointerLock?.();$('dialog-content').replaceChildren();const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=text;$('dialog-content').append(h,p);if(exhibit){const meta=document.createElement('div');meta.className='exhibit-meta';for(const value of [exhibit.city,exhibit.score]){const span=document.createElement('span');span.textContent=value;meta.append(span);}const source=document.createElement('a');source.href=exhibit.source;source.target='_blank';source.rel='noopener';source.className='exhibit-source';source.textContent='查看历史资料 ↗';$('dialog-content').append(meta,source);}for(const id of goals){const b=document.createElement('button');b.className='destination-button';b.textContent='步行前往 '+tourGoals[id];b.onclick=()=>{goPlace(id,false);$('info-dialog').close();};$('dialog-content').append(b);}$('info-dialog').showModal();}
function openDialog(type){clearWalkInput();document.exitPointerLock?.();if(type==='help')$('dialog-content').innerHTML=`<div class="eyebrow">ARENA EXPLORER</div><h2>自由探索主场</h2><h3>电脑操作</h3><p>第三人称：拖动环绕、滚轮缩放、右键平移。第一人称：WASD / 方向键移动，拖动画面或 Q / E 转头，Shift 加速。L 锁定或释放鼠标，Esc 暂停，点击画面继续。</p><h3>手机操作</h3><p>第一人称用左下摇杆移动，拖动空白画面转头；「跑」切换移动速度。第三人称用单指环绕、双指缩放和平移。横竖屏均可使用。靠近可互动设施后，点击右下提示按钮操作。</p><h3>选区、步行与传送</h3><p>点击「选择区域」或底部地点，可搜索、按类别筛选目的地。第一人称选区后更新方向、距离与脚下黄线；想直接抵达时，再点击「传送」或按 T。路线详情按需展开，地图用右上地图按钮或 M 打开。眼睛按钮或 U 隐藏界面，再次点击恢复。</p><p>首次进入第一人称从南侧正门出发，之后切回会恢复上次步行位置。大厅右侧的参观通道通往草坪，东侧室内楼梯连接公共大厅、包厢和看台。商店与展厅的自动门靠近即开；公共大厅的 SERVICE 双门需要靠近后按 F 或点击互动按钮，打开后可走入并返回。</p><h3>场景与互动</h3><p>靠近奖杯、球衣、战术板与座位按 F 或点击互动按钮。N 切换昼夜，P 切换视角，Home 返回正门，H 查看说明。显示设置里可关闭屋顶或选择画质。默认采用流畅画质；设备性能有限时建议保留默认设置。</p>`;
 else $('dialog-content').innerHTML=`<div class="eyebrow">BUILT FROM PUBLIC REFERENCES</div><h2>尽量走近真实的安联。</h2><p>这是以公开照片、建筑介绍、官方平面图和用户视频为参考的程序化三维复原。采用米制坐标，主要外形与草坪遵循公布的尺寸；并非测绘模型，未取得施工图、摄影测量数据或完整室内尺寸，因此无法保证逐处 1:1。</p><div class="fact-grid"><div><b>258 × 227 m</b><small>建筑外廓参考</small></div><div><b>105 × 68 m</b><small>标准比赛草坪</small></div><div><b>2,784</b><small>官方气枕数量参考</small></div></div><h3>本轮直接参观的官方全景</h3><p><a href="https://allianz-arena.com/360/allianzarena/?source=startseite_en" target="_blank" rel="noopener">安联官方 360° 全景游览（2022） ↗</a> · <a href="https://allianz-arena.com/arena3d/" target="_blank" rel="noopener">官方 3D 座席预览 ↗</a></p><p>7.1 按全景中实际看到的屋顶内侧、发布厅中央支脚弧形座椅、灯架、球员通道斜纹墙面与顶面队徽细化对应模型。全景是有年份的实景依据，室内连接及未公开尺寸仍是近似，不能视为完整现状测绘。</p><h3>可查阅的室内实景依据</h3><p><a href="https://fcbayern.com/museum/de/news/2026/06/update-umbau-mit-einer-allee-der-erfolge-und-vielem-mehr" target="_blank" rel="noopener">2026 博物馆改造实景 ↗</a> · <a href="https://fcbayern.com/museum/en/news/2024/12/display-case-from-and-for-harry-kane-in-the-museum" target="_blank" rel="noopener">凯恩真实展柜 ↗</a> · <a href="https://allianz-arena.com/en/event-venue/rooms/presseclub--foyer" target="_blank" rel="noopener">发布厅官方设施 ↗</a> · <a href="https://allianz-arena.com/de/news/2019/09/spielertunnel-der-allianz-arena-renoviert-und-umgestaltet" target="_blank" rel="noopener">球员通道 LED 实景 ↗</a></p><h3>本次还原的细节</h3><p>鼓起的菱形气枕、红色夜间外壳、屋顶开口与悬挑桁架、环形照明、三层阶梯看台、${stadium.seatCount.toLocaleString()} 个独立座椅模型、楼梯过道与分区牌、场边广告、替补席、球门网、角旗、摄像机，以及南广场、停车场采光口、道路、轨道与周边建筑。</p><p>室内包含主客队更衣室、球衣球鞋与装备、更衣长凳、战术板、淋浴区、红色球员通道、新闻发布厅、代表性贵宾包厢、荣誉展厅、环形公共大厅与球迷商店。更衣室以 2022 年官方照片的红色衣柜与木凳为主要视觉参考；场馆于 2026 年另有更衣室整修公告，尚未取得整修后完整室内参考，因此不能把本模型视为 2026 年现状的精确记录。球衣姓名和号码按拜仁官网 2026-10-26 的一线队名单核对，更衣室与商店共用同一份名单。室内精确尺寸与连接仍属近似。荣誉展厅参考 2026 年官方改造照片的双排透光奖杯展台、深色设备顶，以及凯恩球衣和纪念物展柜；这里为压缩布展，并非完整博物馆平面。新闻发布厅增至 180 席，补充转播机镜头、液压云台、线缆与灯架，替补席采用红色高背侧翼座椅。设备细部按照片估算，没有厂商 CAD 或现场测量资料。看台文字和座椅数为视觉建模，不等同于售票座位清单。</p><h3>主要参考资料</h3><ol><li><a href="https://fcbayern.com/en/teams/first-team" target="_blank" rel="noopener">拜仁官方 · 当前一线队名单</a>：球员姓名与号码，核对日期 2026-10-26。</li><li><a href="https://allianz-arena.com/en/arena/facts/general-information" target="_blank" rel="noopener">安联球场官方 · Facts & Figures</a>：建筑尺寸、气枕数、草坪、看台坡度与场馆设施。</li><li><a href="https://www.herzogdemeuron.com/projects/205-allianz-arena/" target="_blank" rel="noopener">Herzog & de Meuron · Allianz Arena</a>：外壳形态、三层看台与广场设计。</li><li><a href="https://allianz-arena.com/en/news/2022/10/fc-bayern-team-areas-open-again-for-tours" target="_blank" rel="noopener">球场官方 · 2022 年更衣室图像</a>：红色衣柜、球衣与木质长凳。</li><li><a href="https://allianz-arena.com/en/news/2026/05/renovation-work-in-fc-bayern-dressing-room" target="_blank" rel="noopener">球场官方 · 2026 年更衣室整修公告</a>：室内现状可能与早期照片不同。</li><li><a href="https://fcbayern.com/de/bilder/2018/08/galerie-die-allianz-arena-im-neuen-gewand" target="_blank" rel="noopener">拜仁官方 · 2018 年内场改造照片</a>：红白座椅与主场装饰。</li><li><a href="https://fcbayern.com/en/tickets/fc-bayern-hospitality-tickets/general-information" target="_blank" rel="noopener">拜仁官方 · 各层平面图与场地地图</a>：设施与接待区位置参考。</li><li><a href="https://allianz-arena.com/de/news/2019/einsatzuebung-zur-europameisterschaft-2020" target="_blank" rel="noopener">球场官方 · 外观航拍</a>：南广场步道、停车设施和周边环境。</li><li><a href="https://www.douyin.com/video/7491434777543806266" target="_blank" rel="noopener">NancyChoU · 球员入场通道（用户提供）</a>：白色顶灯、红色墙面与上行台阶。</li><li><a href="https://v.douyin.com/2j99UtAX4TY/" target="_blank" rel="noopener">凯罗同学 · 安联球场参观（用户提供）</a>。</li><li><a href="https://v.douyin.com/ixGw7sUOSUg/" target="_blank" rel="noopener">🌈把爱留在阿根廷 · 球场视频（用户提供）</a>。</li><li><a href="https://github.com/mrdoob/three.js" target="_blank" rel="noopener">Three.js · 官方开源引擎</a>，版本 0.186.1，MIT 许可。</li></ol><p>建模说明：白天使用自然色外壳，黑夜使用拜仁红与场内照明；材质与日夜 HDR 环境参考 Poly Haven CC0 素材（Powered by Poly Haven），光照为实时艺术化效果。项目为非官方球迷探索作品，与 FC Bayern、Allianz 及球场运营方无隶属关系。</p>`;
 $('info-dialog').showModal();}
