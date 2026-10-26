import {applyFootballAction} from './football-action-pose.js';
import {THREE,mat,canvasTexture} from './kit.js';
import {matchdayPeople} from './matchday-roster.js';
import {createFootballMotion} from './football-motion.js';
import {atlasGeometry,characterAtlas,drawJersey} from './football-appearance.js';
import {simplifySkinnedGeometry} from './player-lod.js';
import {sampleQueuePlayer} from './entrance-choreography.js';

const asset=name=>new URL('./assets/players/'+name,import.meta.url).href;
function makeGeometry(binary,part){
 const a=new Float32Array(binary,part.offset,part.vertices*16),g=new THREE.BufferGeometry(),attributes={position:3,normal:3,uv:2,skinIndex:4,skinWeight:4};let offset=0;
 for(const[name,size]of Object.entries(attributes)){const out=name==='skinIndex'?new Uint16Array(part.vertices*size):new Float32Array(part.vertices*size);for(let i=0;i<part.vertices;i++)for(let j=0;j<size;j++)out[i*size+j]=a[i*16+offset+j];g.setAttribute(name,new THREE.BufferAttribute(out,size));offset+=size;}
 g.setIndex(new THREE.BufferAttribute(new Uint16Array(binary,part.indexOffset,part.indexCount),1));g.computeBoundingSphere();return g;
}

function athlete(data,geometries,textures,definition,motion,atlasSize){
 const group=new THREE.Group();group.name=definition.team+' · '+definition.role+' · '+definition.player.name;group.userData.role=definition.role;group.userData.team=definition.team;group.userData.playerNumber=definition.player.number??null;
 const bones=data.bones.map(b=>{const bone=new THREE.Bone();bone.name=b.name;return bone;});
 data.bones.forEach((b,i)=>{const parent=b.parent>=0?bones[b.parent]:group;parent.add(bones[i]);bones[i].position.fromArray(b.head);if(b.parent>=0)bones[i].position.sub(new THREE.Vector3().fromArray(data.bones[b.parent].head));});
 group.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
 const material=new THREE.MeshStandardMaterial({map:characterAtlas(definition,textures,drawJersey,atlasSize),roughness:.82,alphaTest:.38,side:THREE.DoubleSide});
 const body=new THREE.SkinnedMesh(geometries[definition.hair],material);body.name='athlete';body.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),1.75);body.castShadow=true;body.receiveShadow=true;group.add(body);body.bind(skeleton,new THREE.Matrix4());
 const motionPlayer=createFootballMotion(data,motion,bones,group,definition);
 let accessory;if(definition.flag){accessory=new THREE.Group();group.add(accessory);const handle=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.44,6),mat(0x263339));handle.position.y=-.19;accessory.add(handle);const flag=new THREE.Mesh(new THREE.PlaneGeometry(.36,.30),new THREE.MeshBasicMaterial({map:textures.flag,side:THREE.DoubleSide}));flag.position.set(-.18,-.29,0);accessory.add(flag);}
 const hand=new THREE.Vector3();return{group,body,definition,reset:motionPlayer.reset,actionPose(motion,options){applyFootballAction(bones,motion,options);group.updateMatrixWorld(true);},pose(...args){motionPlayer.pose(...args);if(accessory){bones[14].getWorldPosition(hand);accessory.position.copy(group.worldToLocal(hand));}}};
}

export function buildEntrancePlayers(scene,{mobile=false}={}){
 const root=new THREE.Group();root.name='Skinned football entrance queue';root.visible=false;scene.add(root);let loading,players=[],ready=false,lastMatchTime=null;const officials=new Map(),shadowPose=new THREE.Object3D();
 async function prepare(){if(loading)return loading;loading=(async()=>{
  const loader=new THREE.TextureLoader(),loadTexture=name=>loader.loadAsync(asset(name)),[data,binary,light,dark,short02,eyes,brows,crest,motion,awayCrest]=await Promise.all([
   fetch(asset('footballer.json')).then(r=>{if(!r.ok)throw Error('Player manifest '+r.status);return r.json();}),fetch(asset('footballer.bin')).then(r=>{if(!r.ok)throw Error('Player mesh '+r.status);return r.arrayBuffer();}),loadTexture('skin-light.webp'),loadTexture('skin-dark.webp'),loadTexture('hair-short02.webp'),loadTexture('eyes.webp'),loadTexture('brows.webp'),new THREE.ImageLoader().loadAsync(new URL('./assets/fc-bayern.svg',import.meta.url).href),fetch(asset('walk-cycle.json')).then(r=>{if(!r.ok)throw Error('Motion '+r.status);return r.json();}),new THREE.ImageLoader().loadAsync(new URL('./assets/borussia-dortmund.svg',import.meta.url).href)
  ]);for(const t of[light,dark,short02,eyes,brows]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  const shadow=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.4,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
  const boot=canvasTexture(256,256,c=>{c.fillStyle='#e7e8e3';c.fillRect(0,0,256,256);c.fillStyle='#555b5e';c.fillRect(130,0,126,256);c.strokeStyle='#666c6c';c.lineWidth=2;c.beginPath();c.moveTo(5,4);c.lineTo(5,252);c.moveTo(124,4);c.lineTo(124,252);c.stroke();c.strokeStyle='#f8f7ef';c.lineWidth=4;for(let y=90;y<177;y+=13){c.beginPath();c.moveTo(43,y);c.lineTo(86,y+6);c.stroke();}c.strokeStyle='#626967';c.lineWidth=3;for(const x of[13,109]){c.beginPath();c.moveTo(x,68);c.lineTo(x+9,119);c.stroke();}});
  const raw=Object.fromEntries(data.parts.map(p=>[p.name,makeGeometry(binary,p)])),geometries={short02:atlasGeometry(raw,'short02'),crop:atlasGeometry(raw,'crop')};for(const g of Object.values(raw))g.dispose();for(const g of Object.values(geometries)){g.userData.medium=simplifySkinnedGeometry(g,.035);g.userData.low=simplifySkinnedGeometry(g,.085);}
  const flag=canvasTexture(64,64,c=>{c.fillStyle='#f3c431';c.fillRect(0,0,64,64);c.fillStyle='#eb622e';c.fillRect(0,0,32,32);c.fillRect(32,32,32,32);});
  const textures={light,dark,short02,eyes,brows,crest,awayCrest,shadow,boot,flag};
  players=matchdayPeople.map((d,i)=>{const p=athlete(data,geometries,textures,d,motion,mobile?512:d.role==='player'?1024:512);p.geometry=geometries[d.hair];root.add(p.group);return p;});
  const shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(.64,.75).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false,opacity:.28}),players.length);shadows.name='Contact shadows';shadows.frustumCulled=false;root.add(shadows);root.userData.shadows=shadows;
  ready=true;return true;
 })().catch(error=>{loading=null;throw error;});return loading;}
 function updateMatch(state,time,viewer,{firstPerson=false}={}){
  if(!ready||!state?.players)return;const dt=lastMatchTime===null?0:Math.max(0,Math.min(.15,time-lastMatchTime));lastMatchTime=time;
  const onField=new Map(state.players.map(p=>[p.team+':'+p.number,p]));
  for(let i=0;i<players.length;i++){
   const actor=players[i],d=actor.definition;let p=d;
   if(d.role==='player')p=onField.get(d.team+':'+d.player.number);
   else if(d.role==='referee'||d.role==='assistantReferee'||d.role==='fourth'){
    const previous=officials.get(i),pose=matchOfficialPose(d,state.ball,previous,dt);officials.set(i,pose);p=pose;
   }
   if(!p){actor.group.visible=false;shadowPose.scale.setScalar(0);shadowPose.updateMatrix();root.userData.shadows?.setMatrixAt(i,shadowPose.matrix);continue;}
   const distance=viewer?Math.hypot(viewer.x-p.x,viewer.z-p.z):0,controlled=d.role==='player'&&p.id===state.controlledId;
   // Every starter remains available across the full diagonal of the pitch;
   // their low-detail skins and renderer frustum culling handle distant views.
   actor.group.visible=distance<(d.role==='player'?160:mobile?92:130)&&!(controlled&&firstPerson);
   actor.body.geometry=distance>(mobile?22:32)?actor.geometry.userData.low:distance>(mobile?10:16)?actor.geometry.userData.medium:actor.geometry;
   const moving=d.role==='player'?Math.hypot(p.vx||0,p.vz||0)>.16:!!p.moving;
   const heading=p.yaw??(moving?Math.atan2(p.vx,p.vz):0);
   // Pose even a hidden first-person avatar, so its world position and future
   // third-person animation never fall back to the old entrance queue.
   if(actor.group.visible||controlled)actor.pose(p.x,p.z,heading,time,moving,d.seated&&d.role==='assistant'?.45:0);else actor.group.position.set(p.x,0,p.z);
   if(d.role==='player'&&(actor.group.visible||controlled))actor.actionPose(p.motion,{defending:p.defending,speed:Math.hypot(p.vx||0,p.vz||0)});
   shadowPose.position.set(p.x,actor.group.position.y+.012,p.z);shadowPose.scale.setScalar(actor.group.visible?(d.seated?.8:1):0);shadowPose.updateMatrix();root.userData.shadows?.setMatrixAt(i,shadowPose.matrix);
  }
  if(root.userData.shadows)root.userData.shadows.instanceMatrix.needsUpdate=true;
 }
 return{root,prepare,updateMatch,get ready(){return ready;},get positions(){return players.map(p=>[p.group.position.x,p.group.position.z].map(v=>v.toFixed(2)).join(',')).join(';');},reset(){lastMatchTime=null;officials.clear();for(const p of players)p.reset();},update(seconds,time,viewer){lastMatchTime=null;officials.clear();const dummy=new THREE.Object3D();for(let i=0;i<players.length;i++){const actor=players[i],d=actor.definition,p=i<26?sampleQueuePlayer(seconds,i):d,distance=viewer?Math.hypot(viewer.x-p.x,viewer.z-p.z):0;actor.group.visible=distance<(mobile?86:120);if(!actor.group.visible){dummy.scale.setScalar(0);dummy.updateMatrix();root.userData.shadows?.setMatrixAt(i,dummy.matrix);continue;}actor.body.geometry=distance>(mobile?22:32)?actor.geometry.userData.low:distance>(mobile?10:16)?actor.geometry.userData.medium:actor.geometry;actor.pose(p.x,p.z,p.yaw,time,p.moving||false,d.seated&&d.role==='assistant'?.45:0);dummy.position.set(p.x,actor.group.position.y+.012,p.z);dummy.scale.setScalar(d.seated?.8:1);dummy.updateMatrix();root.userData.shadows?.setMatrixAt(i,dummy.matrix);}if(root.userData.shadows)root.userData.shadows.instanceMatrix.needsUpdate=true;}};
}

export function matchOfficialPose(definition,ball,previous,dt=0){
 if(definition.role==='fourth')return{x:-37.4,z:3.8,yaw:Math.PI/2,moving:false};
 const assistant=definition.role==='assistantReferee',side=definition.flag&&definition.phase>0.9?1:-1;
 const target={x:assistant?side*35.5:THREE.MathUtils.clamp((ball?.x||0)+8,-27,27),z:THREE.MathUtils.clamp((ball?.z||0)+(assistant?0:9),assistant?-49:-44,assistant?49:44)};
 let x=target.x,z=target.z,moving=false;
 if(previous){const dx=x-previous.x,dz=z-previous.z,length=Math.hypot(dx,dz),travel=Math.min(length,Math.max(0,Math.min(dt,.15))*(assistant?4:3.4));moving=travel>.002;x=previous.x+(length?dx/length*travel:0);z=previous.z+(length?dz/length*travel:0);}
 return{x,z,yaw:Math.atan2((ball?.x||0)-x,(ball?.z||0)-z),moving};
}
