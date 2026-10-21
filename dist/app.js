import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {v,TAU,superpoint,seeded,loadBrandAssets} from './kit.js';
import {EYE_HEIGHT,MAX_STEP,mainEntrance,esplanadeHeight,floorHeight,hitsWall,canStandAt} from './navigation.js';
import {accessStairs} from './access-layout.js';
import {rosterInfo} from './roster.js';
import {buildStadium} from './stadium.js';
import {buildWorld,esplanadeY} from './world.js';
import {buildInteriors,roomSpecs} from './interiors.js';

const $=id=>document.getElementById(id),canvas=$('scene');
const places={
 exterior:{title:'欢迎来到安联球场。',tag:'THE EXTERIOR',desc:'一座属于红色的足球殿堂。拖动视角，开始你的主场之旅。',pos:[251,174,307],target:[0,18,0],walk:[mainEntrance.x,esplanadeHeight(mainEntrance.z)+.055+EYE_HEIGHT,mainEntrance.z],look:mainEntrance.look,accuracy:'公开资料参考复原'},
 esplanade:{title:'通往主场的路。',tag:'THE ESPLANADE',desc:'沿着停车场上方起伏的绿色步道，走近慕尼黑的足球地标。',pos:[195,140,487],target:[0,-2,286],walk:[-32,esplanadeY(280)+1.7,280],look:[0,15,0],accuracy:'周边建筑与地形近似'},
 arcade:{title:'从入口，走进主场。',tag:'THE ENTRANCE ARCADE',desc:'沿着铺装环廊，经过服务窗口、导视、休息区和通往上一层的楼梯。',pos:[36,.2,113],target:[64,0,98],walk:[36,-1.2,110],look:[64,-.4,98],accuracy:'入口层与设施 · 公开资料近似'},
 access:{title:'一步步，走向看台。',tag:'THE ACCESS STAIRS',desc:'八组带扶手和踏步标线的楼梯，把入口层与公共大厅连接起来。',pos:[accessStairs[1].x+10,6,accessStairs[1].z+15],target:[accessStairs[1].topX,10,accessStairs[1].topZ],walk:[accessStairs[1].x+accessStairs[1].nx*2,-1.2,accessStairs[1].z+accessStairs[1].nz*2],look:[accessStairs[1].topX,3.5,accessStairs[1].topZ],accuracy:'通行动线与构造 · 布局近似'},
 stands:{title:'三层看台，一种信仰。',tag:'INSIDE THE BOWL',desc:'逐级抬升的看台、红白座椅、悬挑桁架。站在这里，想象全场呐喊。',pos:[-60,25,43],target:[8,9,-3],walk:[-60,10,38],look:[0,3,0],accuracy:'比例与坡度参考官方'},
 pitch:{title:'你的主场，你的视角。',tag:'ON THE PITCH',desc:'从中圈到球门，体验 105 × 68 米草坪与四周看台的真实尺度。',pos:[29,7.5,42],target:[0,9,-20],walk:[0,1.7,13],look:[0,3,-48],accuracy:'草坪尺寸按米建模'},
 tunnel:{title:'迈向属于你的比赛。',tag:'THE PLAYERS’ TUNNEL',desc:'红色几何墙面、白色长灯带、向上的台阶。前方，就是草坪。',pos:[-63,-1.02,.3],target:[-42,-.7,0],walk:[-63,-1,0],look:[-39,0,0],accuracy:'参考用户视频 · 布局近似'},
 homeRoom:{title:'在这里，准备登场。',tag:'FC BAYERN DRESSING ROOM',desc:'红色更衣柜、悬挂球衣、木质长凳、球鞋与战术板。走进比赛前的空间。',pos:[-75.8,-.9,5.8],target:[-85.3,-1,0],walk:[-76.2,-1,4.6],look:[-88,-.9,-3],accuracy:'现役一线队 · 名单核对 '+rosterInfo.checked},
 guestRoom:{title:'另一支球队的起点。',tag:'GUEST DRESSING ROOM',desc:'客队衣柜、备战长桌与相邻淋浴区，以球场功能和参观资料作近似还原。',pos:[-76,-.9,33.5],target:[-86,-1,27],walk:[-76,-1,32],look:[-89,-.8,25],accuracy:'内部陈设与布局近似'},
 press:{title:'比赛之后，故事继续。',tag:'THE PRESS CONFERENCE',desc:'发布台、采访麦克风、赞助背景与媒体座席。来到赛后新闻发布空间。',pos:[-82,.35,-23.3],target:[-82,-1.05,-37],walk:[-82,-.3,-23.5],look:[-82,-1,-37],accuracy:'参考用户视频 · 布局近似'},
 lounge:{title:'换个角度，欣赏主场。',tag:'HOSPITALITY & SKYBOX',desc:'透过落地玻璃俯瞰草坪，近看餐桌、吧台与看台之间的细节。',pos:[90,25.5,8],target:[58,16,-2],walk:[90,25.3,7],look:[0,4,0],accuracy:'代表性包厢 · 陈设近似'},
 museum:{title:'让荣耀，拥有形状。',tag:'A GALLERY OF HONOURS',desc:'六座欧洲冠军杯的年份、银色奖杯、玻璃展柜与俱乐部历史陈列。',pos:[-93,13.8,67],target:[-96,13.6,51],walk:[-93,13.7,67],look:[-96,13.8,48],accuracy:'代表性荣誉展厅 · 布局近似'},
 concourse:{title:'比赛之外，主场之内。',tag:'THE PUBLIC CONCOURSE',desc:'沿着环形大厅，经过餐饮柜台、分区入口和场馆导视。',pos:[94,13.9,-47],target:[96,14,-12],walk:[94,13.9,-47],look:[96,14,-12],accuracy:'环形公共空间 · 陈设近似'},
 store:{title:'把热爱，带回家。',tag:'FC BAYERN STORE',desc:'球衣衣架、红白围巾、装备陈列与服务台。走进球迷商店。',pos:[0,14.3,116.7],target:[0,14,106],walk:[0,13.9,116],look:[0,14,106],accuracy:'代表性球迷商店 · 布局近似'}
};
let renderer,scene,camera,controls,stadium,world,interiors,sky,stars,dayLight,hemi,ambient;
let active='exterior',mode='orbit',night=false,transition=null,tourOn=false,tourElapsed=0,tourIndex=0,toastTimer;
let yaw=0,pitch=0,dragging=false,lastPointer=null,walkReady=false,clock={time:performance.now(),getDelta(){const now=performance.now(),d=(now-this.time)/1000;this.time=now;return d;}},elapsed=0,frames=0,lastPerf=0,frameMs=0;
let desiredEye=EYE_HEIGHT,pointerLockPending=false;const keys=new Set(),moveFlags=new Set(),movementPointers=new Map();const forward=v(),right=v(),step=v(),temp=v();const ray=new THREE.Raycaster();
const mediaReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const toast=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);};

async function init(){
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(error){$('load-status').innerHTML='当前浏览器未能启用 WebGL。请使用支持硬件加速的 Chrome / Edge 打开。';document.querySelector('.load-track').hidden=true;console.error(error);return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xb8cbd6,.00082);
 camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,4500);camera.position.fromArray(places.exterior.pos);
 controls=new OrbitControls(camera,canvas);controls.target.fromArray(places.exterior.target);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=1.1;controls.maxDistance=1000;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.5;controls.enablePan=true;controls.update();
 controls.addEventListener('start',()=>{transition=null;if(tourOn)stopTour();});
 hemi=new THREE.HemisphereLight(0xdae9ff,0x686f54,2.1);ambient=new THREE.AmbientLight(0xffffff,.45);dayLight=new THREE.DirectionalLight(0xffeed5,3.1);dayLight.position.set(-180,270,170);dayLight.castShadow=true;dayLight.shadow.mapSize.set(2048,2048);Object.assign(dayLight.shadow.camera,{left:-165,right:165,top:180,bottom:-170,near:1,far:750});dayLight.shadow.bias=-.0003;dayLight.shadow.normalBias=.15;dayLight.target.position.set(0,0,0);scene.add(hemi,ambient,dayLight,dayLight.target);
 buildSky();
 $('load-status').textContent='正在加载队徽与场景…';await loadBrandAssets();
 world=buildWorld(scene);stadium=buildStadium(scene);interiors=buildInteriors(scene,stadium.circulation);
 buildHotspots();bindUI();setNavOpen(false);document.body.dataset.mode=mode;setDayNight(false);clock.time=performance.now();document.body.dataset.ready='true';document.body.dataset.seats=stadium.seatCount;document.body.dataset.panels=stadium.panelCount;
 const initial=new URLSearchParams(location.search);if(initial.get('night')==='1')setDayNight(true);const place=initial.get('place');if(initial.get('view')==='walk')setMode('walk',{place:place&&places[place]?place:'exterior'});else if(place&&places[place])goPlace(place,false);
 renderer.setAnimationLoop(render);requestAnimationFrame(()=>{$('loading').classList.add('finished');$('load-status').textContent='场景已就绪';});
 window.addEventListener('resize',resize);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('图形上下文已暂停，请重新加载页面恢复。');});
}

function buildSky(){
 const uniform={top:{value:new THREE.Color(0x7e9db4)},bottom:{value:new THREE.Color(0xdfe8e6)},sunDirection:{value:v(-.45,.7,.45).normalize()},night:{value:0}};
 const sm=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:uniform,vertexShader:'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDirection; uniform float night; varying vec3 vDir; void main(){vec3 d=normalize(vDir); float t=pow(max(d.y,0.0),0.5);vec3 c=mix(bottom,top,t);float s=pow(max(dot(d,sunDirection),0.0),250.0); c+=vec3(1.0,.85,.6)*s*(1.0-night)*1.3; gl_FragColor=vec4(c,1.0); #include <tonemapping_fragment> #include <colorspace_fragment> }'});
 // Shader includes must begin on their own lines.
 sm.fragmentShader=sm.fragmentShader.replaceAll(' #include','\n#include').replace('> }','>\n}');sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),sm);sky.renderOrder=-10;scene.add(sky);
 const random=seeded(49),pos=[];for(let i=0;i<1500;i++){const t=random()*TAU,y=random(),r=Math.sqrt(1-y*y)*1900;pos.push(Math.cos(t)*r,y*1900,Math.sin(t)*r);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xd9e6f9,size:1.35,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));stars.visible=false;scene.add(stars);
}

function setDayNight(n){night=n;document.body.dataset.environment=n?'night':'day';$('day').classList.toggle('active',!n);$('night').classList.toggle('active',n);$('day').setAttribute('aria-pressed',String(!n));$('night').setAttribute('aria-pressed',String(n));hemi.intensity=n?.65:2.1;hemi.color.set(n?0x7193c2:0xdae9ff);hemi.groundColor.set(n?0x242b3b:0x686f54);ambient.intensity=n?.23:.45;dayLight.intensity=n?.28:3.1;dayLight.color.set(n?0x7497d1:0xffeed5);scene.fog.color.set(n?0x081423:0xb8cbd6);scene.fog.density=n?.0012:.00082;sky.material.uniforms.top.value.set(n?0x020817:0x7e9db4);sky.material.uniforms.bottom.value.set(n?0x14243b:0xdfe8e6);sky.material.uniforms.night.value=n?1:0;stars.visible=n;renderer.toneMappingExposure=n?1.26:1.17;stadium.night(n);world.night(n);interiors.night(n);}

function goPlace(id,animate=true){
 const p=places[id];if(!p)return;setNavOpen(false);clearWalkInput();active=id;document.body.dataset.place=id;document.querySelectorAll('.location').forEach(b=>{const on=b.dataset.place===id;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'location':'false');});$('place-title').textContent=p.title;$('place-tag').textContent=p.tag;$('place-desc').textContent=p.desc;$('accuracy-tag').textContent=p.accuracy;
 if(mode==='walk'){camera.position.fromArray(p.walk);camera.position.y=floorAt(camera.position.x,camera.position.z,p.walk[1]-desiredEye)+desiredEye;camera.lookAt(v(...p.look));syncAngles();interiors.update(camera.position,active);setWalkReady(true);canvas.focus({preventScroll:true});transition=null;}else{
  controls.maxPolarAngle=roomSpecs[id]||id==='tunnel'||id==='concourse'?Math.PI*.8:Math.PI*.61;
  const dest=v(...p.pos),target=v(...p.target);if(animate&&!mediaReduced&&!roomSpecs[id]&&id!=='tunnel'&&id!=='concourse'){transition={from:camera.position.clone(),to:dest,startTarget:controls.target.clone(),target,time:0,duration:1.65};}else{camera.position.copy(dest);controls.target.copy(target);controls.update();transition=null;}
 }
 $('autorotate').checked=false;controls.autoRotate=false;updateLocationURL();
}

function syncAngles(){const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=e.y;pitch=e.x;}
function clearWalkInput(){keys.clear();moveFlags.clear();movementPointers.clear();dragging=false;lastPointer=null;document.body.classList.remove('looking');}
function setNavOpen(open){$('explore').hidden=!open;$('nav-trigger').setAttribute('aria-expanded',String(open));document.body.classList.toggle('nav-open',open);if(open){clearWalkInput();if(document.pointerLockElement===canvas)document.exitPointerLock?.();}}
function setWalkReady(ready){walkReady=mode==='walk'&&ready;document.body.dataset.walking=String(walkReady);$('walk-prompt').hidden=mode!=='walk'||walkReady;if(!walkReady)clearWalkInput();}
function updateLookHint(){const locked=document.pointerLockElement===canvas;document.body.dataset.look=locked?'locked':'drag';const label=$('look-hint'),button=$('lock-pointer');if(label)label.textContent=locked?'移动鼠标转头':'按住画面转头 · Q/E 转向';if(button){button.textContent=locked?'释放鼠标':'锁定鼠标';button.disabled=pointerLockPending;}}
function setMode(next,{place='exterior'}={}){
 if(!camera)return;if(next===mode){if(next==='walk')beginWalk();return;}
 mode=next;document.body.dataset.mode=next;transition=null;clearWalkInput();setNavOpen(false);controls.enabled=next==='orbit';controls.autoRotate=false;$('autorotate').checked=false;
 $('orbit-mode').classList.toggle('active',next==='orbit');$('walk-mode').classList.toggle('active',next==='walk');$('orbit-mode').setAttribute('aria-pressed',String(next==='orbit'));$('walk-mode').setAttribute('aria-pressed',String(next==='walk'));$('movement').hidden=next!=='walk';$('crosshair').hidden=next!=='walk';
 if(next==='walk'){
  stopTour();camera.fov=66;camera.updateProjectionMatrix();$('hint').innerHTML='<span>WASD 移动 · Shift 加速</span><i></i><span id="look-hint">按住画面转头 · Q/E 转向</span><i></i><button id="lock-pointer">锁定鼠标</button><i></i><button id="entrance">回到正门</button>';$('lock-pointer').onclick=lockMouse;$('entrance').onclick=()=>goPlace('exterior',false);goPlace(place,false);updateLookHint();
 }else{
  document.exitPointerLock?.();setWalkReady(false);camera.fov=48;camera.updateProjectionMatrix();$('hint').innerHTML='<span>↔ 拖动环绕</span><i></i><span>⌕ 滚轮缩放</span><i></i><button id="reset">↺ 重置视角</button>';$('reset').onclick=()=>goPlace(active);goPlace(active,false);
 }
 updateLocationURL();
}
function beginWalk(){if(mode!=='walk')return;setNavOpen(false);setWalkReady(true);canvas.focus({preventScroll:true});updateLookHint();}
async function lockMouse(){
 if(mode!=='walk'||pointerLockPending)return;if(document.pointerLockElement===canvas){document.exitPointerLock?.();return;}
 beginWalk();if(!canvas.requestPointerLock){toast('按住画面即可转头，WASD 可直接移动。');return;}
 pointerLockPending=true;updateLookHint();try{await canvas.requestPointerLock();}catch{toast('鼠标未锁定，可继续按住画面转头。');}finally{pointerLockPending=false;updateLookHint();}
}
function turn(dx,dy,sensitivity=.003){yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*sensitivity,-1.44,1.44);camera.rotation.set(pitch,yaw,0,'YXZ');}
function keyCode(event){const aliases={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',q:'KeyQ',e:'KeyE',p:'KeyP',n:'KeyN',h:'KeyH',up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',escape:'Escape',esc:'Escape',shift:'ShiftLeft'};return event.code&&event.code!=='Unidentified'?event.code:(aliases[(event.key||'').toLowerCase()]||event.key);}

function inside(x,z,spec,margin=0){return x>spec.x-spec.w/2-margin&&x<spec.x+spec.w/2+margin&&z>spec.z-spec.d/2-margin&&z<spec.z+spec.d/2+margin;}
function floorAt(x,z,feetY=camera.position.y-desiredEye){return floorHeight(x,z,feetY,{tiers:stadium.tiers,rooms:roomSpecs});}
function blocked(x,z,y){
 return hitsWall(x,z,y,interiors.colliders,owner=>!owner||interiors.rooms[owner]?.visible)||hitsWall(x,z,y,world.colliders)||hitsWall(x,z,y,stadium.circulation.colliders,()=>stadium.circulation.root.visible);
}

function moveWalk(dt){
 if(mode!=='walk'||!walkReady||!$('explore').hidden||$('info-dialog').open)return;
 yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*Math.min(dt,.25)*1.5;
 const f=(keys.has('KeyW')||keys.has('ArrowUp')||moveFlags.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||moveFlags.has('back')?1:0),s=(keys.has('KeyD')||keys.has('ArrowRight')||moveFlags.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||moveFlags.has('left')?1:0);
 forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));step.set(0,0,0).addScaledVector(forward,f).addScaledVector(right,s);
 if(step.lengthSq()){
  const duration=Math.min(dt,.25),steps=Math.max(1,Math.ceil(duration/.025)),speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?10:4.5;step.normalize().multiplyScalar(speed*duration/steps);
  for(let i=0;i<steps;i++){const feet=camera.position.y-desiredEye,x=THREE.MathUtils.clamp(camera.position.x+step.x,-600,700),z=THREE.MathUtils.clamp(camera.position.z+step.z,-650,850);if(!blocked(x,camera.position.z,camera.position.y)&&floorAt(x,camera.position.z,feet)<=feet+MAX_STEP+.001)camera.position.x=x;if(!blocked(camera.position.x,z,camera.position.y)&&floorAt(camera.position.x,z,feet)<=feet+MAX_STEP+.001)camera.position.z=z;}
 }
 const y=floorAt(camera.position.x,camera.position.z)+desiredEye;camera.position.y=THREE.MathUtils.lerp(camera.position.y,y,Math.min(1,dt*15));camera.rotation.set(pitch,yaw,0,'YXZ');
}

const hotspotDefs=[{name:'探索球场内部',id:'stands',p:[0,52,0],outside:true},{name:'南广场',id:'esplanade',p:[0,2,190],outside:true},{name:'草坪与看台',id:'pitch',p:[0,2,0],inside:true},{name:'球员通道',id:'tunnel',p:[-39,3,0],inside:true},{name:'主队更衣室',id:'homeRoom',p:[-78,3,-2],inside:true}];
function buildHotspots(){for(const h of hotspotDefs){const b=document.createElement('button');b.className='hotspot';b.innerHTML=`<span class="dot">+</span>${h.name}`;b.setAttribute('aria-label','前往'+h.name);b.addEventListener('click',()=>{stopTour();goPlace(h.id);});$('hotspots').appendChild(b);h.el=b;}}
function updateHotspots(){const on=$('markers').checked&&mode==='orbit';const outdoors=active==='exterior'||active==='esplanade';for(const h of hotspotDefs){const show=on&&!roomSpecs[active]&&active!=='tunnel'&&((h.outside&&outdoors)||(h.inside&&!outdoors));if(!show){h.el.hidden=true;continue;}temp.fromArray(h.p).project(camera);const px=(temp.x*.5+.5)*innerWidth,py=(-temp.y*.5+.5)*innerHeight;h.el.hidden=temp.z<0||temp.z>1||px<260||px>innerWidth-240||py<175||py>innerHeight-180;if(!h.el.hidden){h.el.style.left=px+'px';h.el.style.top=py+'px';}}}

const map=$('map'),ctx=map.getContext('2d');
function drawMap(){const w=220,h=170,cx=110,cz=76,scale=.48;ctx.clearRect(0,0,w,h);ctx.lineWidth=1;ctx.strokeStyle='#ffffff05';for(let x=0;x<w;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.strokeStyle='#344754';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(203,0);ctx.lineTo(203,170);ctx.moveTo(0,8);ctx.lineTo(220,8);ctx.stroke();ctx.fillStyle='#273b39';ctx.fillRect(cx-32,137,64,33);ctx.strokeStyle='#70818a';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=120;i++){const p=superpoint(113.5,129,i/120*TAU,2.65);if(i===0)ctx.moveTo(cx+p.x*scale,cz+p.z*scale);else ctx.lineTo(cx+p.x*scale,cz+p.z*scale);}ctx.closePath();ctx.fillStyle=night?'#5c2639':'#354851';ctx.fill();ctx.stroke();ctx.beginPath();for(let i=0;i<=120;i++){const p=superpoint(67,78,i/120*TAU,2.65);if(i===0)ctx.moveTo(cx+p.x*scale,cz+p.z*scale);else ctx.lineTo(cx+p.x*scale,cz+p.z*scale);}ctx.closePath();ctx.fillStyle='#213b37';ctx.fill();ctx.strokeStyle='#687b80';ctx.stroke();ctx.strokeStyle='#87a6a055';ctx.strokeRect(cx-34*scale,cz-52.5*scale,68*scale,105*scale);ctx.beginPath();ctx.moveTo(cx-34*scale,cz);ctx.lineTo(cx+34*scale,cz);ctx.ellipse(cx,cz,9.15*scale,9.15*scale,0,0,TAU);ctx.stroke();
 let x=THREE.MathUtils.clamp(cx+camera.position.x*scale,7,w-7),y=THREE.MathUtils.clamp(cz+camera.position.z*scale,9,h-8);const dir=v();camera.getWorldDirection(dir);const a=Math.atan2(dir.x,-dir.z);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#fa315555';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-9,-20);ctx.lineTo(9,-20);ctx.closePath();ctx.fill();ctx.fillStyle='#fb4260';ctx.beginPath();ctx.arc(0,0,3.5,0,TAU);ctx.fill();ctx.strokeStyle='#ffd7df';ctx.lineWidth=1;ctx.stroke();ctx.restore();$('elevation').textContent='高度 '+Math.round(camera.position.y*10)/10+' m';}

function render(){const raw=Math.min(clock.getDelta(),1),dt=Math.min(raw,.05);elapsed+=raw;frames++;if(transition){transition.time+=raw;const a=Math.min(transition.time/transition.duration,1),t=1-(1-a)**3;camera.position.lerpVectors(transition.from,transition.to,t);controls.target.lerpVectors(transition.startTarget,transition.target,t);if(a===1)transition=null;}if(mode==='orbit')controls.update();else moveWalk(raw);if(tourOn){tourElapsed+=raw;if(tourElapsed>7.5){tourElapsed=0;tourIndex=(tourIndex+1)%Object.keys(places).length;goPlace(Object.keys(places)[tourIndex]);}}
 world.rotor.rotation.z=elapsed*.13;interiors.update(camera.position,active);
 const privateEnclosed=Object.entries(roomSpecs).some(([key,s])=>key!=='lounge'&&inside(camera.position.x,camera.position.z,s)&&Math.abs(camera.position.y-s.y)<6);
 const outer=(Math.abs(camera.position.x)/105)**2.8+(Math.abs(camera.position.z)/122)**2.8,inner=(Math.abs(camera.position.x)/85)**2.8+(Math.abs(camera.position.z)/103)**2.8;
 const inPublicConcourse=outer<1&&inner>1&&camera.position.y>12.9&&camera.position.y<17.8,inBowl=inner<1&&camera.position.y<46;
 stadium.root.visible=!privateEnclosed&&!inPublicConcourse;world.group.visible=!privateEnclosed&&!inPublicConcourse&&!inBowl;world.update(camera.position);stadium.circulation.update(camera.position,privateEnclosed);stadium.update(camera);renderer.render(scene,camera);if(frames%3===0){updateHotspots();drawMap();document.body.dataset.camera=camera.position.toArray().map(x=>x.toFixed(3)).join(',');document.body.dataset.heading=[yaw,pitch].map(x=>x.toFixed(4)).join(',');}if(elapsed-lastPerf>1.5){const fps=Math.round(frames/(elapsed-lastPerf));$('performance').textContent=`THREE.JS r${THREE.REVISION}  /  ${stadium.seatCount.toLocaleString()} 个座位模型  /  ${stadium.panelCount.toLocaleString()} 个气枕  /  ${fps} FPS`;document.body.dataset.fps=fps;document.body.dataset.camera=camera.position.toArray().map(x=>x.toFixed(2)).join(',');document.body.dataset.drawcalls=renderer.info.render.calls;document.body.dataset.triangles=renderer.info.render.triangles;frames=0;lastPerf=elapsed;}}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function updateLocationURL(){const q=new URLSearchParams();if(active!=='exterior')q.set('place',active);if(night)q.set('night','1');if(mode==='walk')q.set('view','walk');history.replaceState(null,'',location.pathname+(q.size?'?'+q:''));}
function stopTour(){if(!tourOn)return;tourOn=false;$('tour').innerHTML='<span>▷</span> 自动巡游 <small>14 个视角</small>';}
function bindUI(){
 document.querySelectorAll('.location').forEach(b=>b.onclick=()=>{stopTour();goPlace(b.dataset.place);});$('home').onclick=e=>{e.preventDefault();stopTour();goPlace('exterior');};$('reset').onclick=()=>goPlace(active);$('day').onclick=()=>{setDayNight(false);updateLocationURL();};$('night').onclick=()=>{setDayNight(true);updateLocationURL();};$('orbit-mode').onclick=()=>setMode('orbit');$('walk-mode').onclick=()=>setMode('walk');$('start-walk').onclick=beginWalk;
 $('roof').onchange=e=>{stadium.roof.visible=e.target.checked;stadium.circulation.setRoof(e.target.checked);interiors.setRoof(e.target.checked);renderer.shadowMap.needsUpdate=true;};$('autorotate').onchange=e=>{if(mode==='walk'){e.target.checked=false;toast('自动环绕可在第三人称视角中使用。');return;}controls.autoRotate=e.target.checked;};
 $('quality').onchange=e=>{const high=e.target.value==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.6:1));renderer.shadowMap.enabled=high;renderer.shadowMap.needsUpdate=true;toast(high?'已启用精细画质与建筑投影。':'已切换流畅画质。');};
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
 window.addEventListener('blur',()=>{if(mode==='walk')setWalkReady(false);else clearWalkInput();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearWalkInput();});
 document.addEventListener('pointerlockchange',()=>{clearWalkInput();pointerLockPending=false;if(mode==='walk'&&document.pointerLockElement===canvas)setWalkReady(true);updateLookHint();});
 document.addEventListener('pointerlockerror',()=>{pointerLockPending=false;updateLookHint();if(mode==='walk')setWalkReady(true);});
 document.querySelectorAll('[data-move]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{if(mode!=='walk')return;e.preventDefault();setNavOpen(false);setWalkReady(true);movementPointers.set(e.pointerId,b.dataset.move);moveFlags.add(b.dataset.move);b.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});});
  b.addEventListener('pointerup',releasePointer);b.addEventListener('pointercancel',releasePointer);
 });
 window.addEventListener('keydown',e=>{
  if($('info-dialog').open||e.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  const code=keyCode(e),movement=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code);
  if(code==='Escape'){if(!$('explore').hidden){setNavOpen(false);canvas.focus({preventScroll:true});}else if(mode==='walk'){document.exitPointerLock?.();setWalkReady(false);}return;}
  if(movement&&mode==='walk'){e.preventDefault();if(!walkReady)beginWalk();keys.add(code);}else if(code==='ShiftLeft'||code==='ShiftRight')keys.add(code);
  if(e.repeat)return;
  if(code==='KeyN'){setDayNight(!night);updateLocationURL();}if(code==='KeyP')setMode(mode==='orbit'?'walk':'orbit');if(code==='Home')goPlace(active);if(code==='KeyH')openDialog('help');
 });
 window.addEventListener('keyup',e=>keys.delete(keyCode(e)));
 $('info-dialog').addEventListener('close',()=>{if(mode==='walk')beginWalk();});
 map.addEventListener('click',e=>{const r=map.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width*220,my=(e.clientY-r.top)/r.height*170,x=(mx-110)/.48,z=(my-76)/.48;if(mode==='walk'){const floor=floorAt(x,z);if(canStandAt(x,z,floor,{rooms:roomSpecs})&&!blocked(x,z,floor+1.7)){camera.position.set(x,floor+1.7,z);toast('已移动至小地图选定位置。');}else toast('这里是建筑内部构造，请选择环廊、楼梯或已开放的房间。');}else goPlace(Math.abs(x)<40&&Math.abs(z)<59?'pitch':'stands');});
}

function openDialog(type){clearWalkInput();document.exitPointerLock?.();if(type==='help')$('dialog-content').innerHTML=`<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>以你的方式，探索安联。</h2><h3>第三人称</h3><p>按住鼠标左键拖动环绕，滚轮缩放；鼠标右键拖动平移。触摸屏使用单指旋转、双指缩放和平移。左上角「选择区域」可打开导航，切换后自动收起，可直达 14 个空间，自动巡游会依次切换视角。</p><h3>第一人称</h3><p>切换第一人称会从南侧正门外出发，面向入口；也可用底部「回到正门」返回。之后可直接使用 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 或方向键移动，按住画面拖动转头，<kbd>Q</kbd> / <kbd>E</kbd> 也可转向。<kbd>Shift</kbd> 加速，<kbd>Esc</kbd> 暂停；按移动键或点击画面即可继续。底部可选「锁定鼠标」，不支持锁定的浏览器仍可直接拖动转头。屏幕方向按钮也可移动。</p><p>脚下高度会随看台台阶和球员通道调整，更衣室主墙带有碰撞。入口层可沿八组楼梯步行进入公共大厅，也可用区域导航直达。小地图可在第一人称中点选位置。</p><h3>场景与快捷键</h3><p><kbd>N</kbd> 切换白天 / 黑夜；<kbd>P</kbd> 切换视角；<kbd>Home</kbd> 重置位置；<kbd>H</kbd> 显示说明。关闭建筑屋顶可观察内部构造；相机图标保存当前 3D 画面。画面卡顿时可将画质改为「流畅」。</p>`;
 else $('dialog-content').innerHTML=`<div class="eyebrow">BUILT FROM PUBLIC REFERENCES</div><h2>尽量走近真实的安联。</h2><p>这是以公开照片、建筑介绍、官方平面图和用户视频为参考的程序化三维复原。采用米制坐标，主要外形与草坪遵循公布的尺寸；并非测绘模型，未取得施工图、摄影测量数据或完整室内尺寸，因此无法保证逐处 1:1。</p><div class="fact-grid"><div><b>258 × 227 m</b><small>建筑外廓参考</small></div><div><b>105 × 68 m</b><small>标准比赛草坪</small></div><div><b>2,784</b><small>官方气枕数量参考</small></div></div><h3>本次还原的细节</h3><p>鼓起的菱形气枕、红色夜间外壳、屋顶开口与悬挑桁架、环形照明、三层阶梯看台、${stadium.seatCount.toLocaleString()} 个独立座椅模型、楼梯过道与分区牌、场边广告、替补席、球门网、角旗、摄像机，以及南广场、停车场采光口、道路、轨道与周边建筑。</p><p>室内包含主客队更衣室、球衣球鞋与装备、更衣长凳、战术板、淋浴区、红色球员通道、新闻发布厅、代表性贵宾包厢、荣誉展厅、环形公共大厅与球迷商店。更衣室以 2022 年官方照片的红色衣柜与木凳为主要视觉参考；球衣姓名和号码按拜仁官网 2026-10-20 的一线队名单核对，更衣室与商店共用同一份名单。所有内部房间的精确尺寸、连接方式、包厢陈设和博物馆布展均有近似。看台文字和座椅数为视觉建模，不等同于售票座位清单。</p><h3>主要参考资料</h3><ol><li><a href="https://fcbayern.com/en/teams/first-team" target="_blank" rel="noopener">拜仁官方 · 当前一线队名单</a>：球员姓名与号码，核对日期 2026-10-20。</li><li><a href="https://allianz-arena.com/en/arena/facts/general-information" target="_blank" rel="noopener">安联球场官方 · Facts & Figures</a>：建筑尺寸、气枕数、草坪、看台坡度与场馆设施。</li><li><a href="https://www.herzogdemeuron.com/projects/205-allianz-arena/" target="_blank" rel="noopener">Herzog & de Meuron · Allianz Arena</a>：外壳形态、三层看台与广场设计。</li><li><a href="https://allianz-arena.com/en/news/2022/10/fc-bayern-team-areas-open-again-for-tours" target="_blank" rel="noopener">球场官方 · 2022 年更衣室图像</a>：红色衣柜、球衣与木质长凳。</li><li><a href="https://fcbayern.com/de/bilder/2018/08/galerie-die-allianz-arena-im-neuen-gewand" target="_blank" rel="noopener">拜仁官方 · 2018 年内场改造照片</a>：红白座椅与主场装饰。</li><li><a href="https://fcbayern.com/en/tickets/fc-bayern-hospitality-tickets/general-information" target="_blank" rel="noopener">拜仁官方 · 各层平面图与场地地图</a>：设施与接待区位置参考。</li><li><a href="https://allianz-arena.com/de/news/2019/einsatzuebung-zur-europameisterschaft-2020" target="_blank" rel="noopener">球场官方 · 外观航拍</a>：南广场步道、停车设施和周边环境。</li><li><a href="https://www.douyin.com/video/7491434777543806266" target="_blank" rel="noopener">NancyChoU · 球员入场通道（用户提供）</a>：白色顶灯、红色墙面与上行台阶。</li><li><a href="https://v.douyin.com/2j99UtAX4TY/" target="_blank" rel="noopener">凯罗同学 · 安联球场参观（用户提供）</a>。</li><li><a href="https://v.douyin.com/ixGw7sUOSUg/" target="_blank" rel="noopener">🌈把爱留在阿根廷 · 球场视频（用户提供）</a>。</li><li><a href="https://github.com/mrdoob/three.js" target="_blank" rel="noopener">Three.js · 官方开源引擎</a>，版本 0.186.1，MIT 许可。</li></ol><p>建模说明：白天使用自然色外壳，黑夜使用拜仁红与场内照明；光照为艺术化实时效果。项目为非官方球迷探索作品，与 FC Bayern、Allianz 及球场运营方无隶属关系。</p>`;
 $('info-dialog').showModal();}

window.addEventListener('error',e=>{console.error('Arena error:',e.error||e.message);if(document.body.dataset.ready!=='true')$('load-status').textContent='加载遇到问题，请刷新页面或查看启动说明。';});
setTimeout(()=>init().catch(error=>{console.error('Arena loading failed:',error);$('load-status').textContent='场景资源加载失败，请刷新页面重试。';}),60);
