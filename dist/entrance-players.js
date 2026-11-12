import {squadDefinition} from './football-squads.js';
import {applyFootballAction} from './football-action-pose.js';
import {opponentSquad} from './football-teams.js';
import {THREE,mat,canvasTexture} from './kit.js';
import {matchdayPeople} from './matchday-roster.js';
import {createFootballMotion} from './football-motion.js';
import {atlasGeometry,characterAtlas,drawJersey,drawBootTexture} from './football-appearance.js';
import {simplifySkinnedGeometry} from './player-lod.js';
import {sampleQueuePlayer} from './entrance-choreography.js';
import {installAthleteSurface,createActorContactShadows,updateActorContactShadows,flushActorContactShadows} from './football-materials.js';
import {createFramePacer} from './frame-pacing.js';
import {likenessParts,playerLikeness,makeRosterCrop,rosterCropStyles} from './football-likeness.js';
import {shapeFootballBody} from './football-body-profile.js';
import {rosterHeadProfile,shapeRosterHead} from './football-roster-heads.js';

const asset=name=>new URL('./assets/players/'+name,import.meta.url).href;
const noActionOptions={};
function actorGeometry(geometries,definition){
 const likeness=playerLikeness(definition);
 if(likeness)return geometries[likeness];
 const profile=rosterHeadProfile(definition);
 const variant=profile?.hair==='crop'&&!definition.keeper?geometries['crop-'+profile.style]:null;
 const base=variant??geometries[(profile?.hair??definition.hair)+(definition.keeper?'Keeper':'')];
 if(!profile)return base;
 const key='home-'+definition.player.number;
 const geometry=geometries[key]??=shapeRosterHead(base,profile);
 if(base.userData.medium)geometry.userData.medium??=shapeRosterHead(base.userData.medium,profile);
 if(base.userData.low)geometry.userData.low??=shapeRosterHead(base.userData.low,profile);
 return geometry;
}
// Keep the head silhouette and facial texture seams in match cameras.
// Coarser hands and clothing leave room for face detail within the same budget.
const likenessMediumParts={
 face:{cell:.026,uvGrid:24},eyes:{cell:.026},eyebrows:{cell:.026},crop:{cell:.032,uvGrid:22},
 hands:{cell:.051},wrists:{cell:.043},socks:{cell:.043},shorts:{cell:.04}
};
const likenessLowParts={
 face:{cell:.053,uvGrid:14},eyes:{cell:.048,uvGrid:13},eyebrows:{cell:.057,uvGrid:13},crop:{cell:.061,uvGrid:14},
 skin:{cell:.092},shirt:{cell:.098},socks:{cell:.112},bootL:{cell:.085},bootR:{cell:.085}
};
function makeGeometry(binary,part){
 const a=new Float32Array(binary,part.offset,part.vertices*16),g=new THREE.BufferGeometry(),attributes={position:3,normal:3,uv:2,skinIndex:4,skinWeight:4};let offset=0;
 for(const[name,size]of Object.entries(attributes)){const out=name==='skinIndex'?new Uint16Array(part.vertices*size):new Float32Array(part.vertices*size);for(let i=0;i<part.vertices;i++)for(let j=0;j<size;j++)out[i*size+j]=a[i*16+offset+j];g.setAttribute(name,new THREE.BufferAttribute(out,size));offset+=size;}
 g.setIndex(new THREE.BufferAttribute(new Uint16Array(binary,part.indexOffset,part.indexCount),1));g.computeBoundingSphere();return g;
}

// Three traverses the live scene after the animation step. An athlete with a
// current world pose can skip that second bone traversal.
class MatchActorGroup extends THREE.Group{
 constructor(){
  super();
  this.posePosition=new THREE.Vector3();
  this.poseRotation=new THREE.Quaternion();
  this.poseScale=new THREE.Vector3();
  this.poseParentWorld=new THREE.Matrix4();
  this.invalidatePose();
 }
 invalidatePose(){this.poseDirty=true;}
 updateMatrixWorld(force){
  const parentChanged=this.parent!==this.poseParent||this.parent&&!this.poseParentWorld.equals(this.parent.matrixWorld);
  if(!this.solvingPose&&!this.poseDirty&&!parentChanged&&!this.matrixWorldNeedsUpdate&&
     this.position.equals(this.posePosition)&&this.quaternion.equals(this.poseRotation)&&this.scale.equals(this.poseScale))return;
  super.updateMatrixWorld(force);
  this.poseParent=this.parent;
  if(this.parent)this.poseParentWorld.copy(this.parent.matrixWorld);
  this.posePosition.copy(this.position);
  this.poseRotation.copy(this.quaternion);
  this.poseScale.copy(this.scale);
  this.poseDirty=false;
 }
}

function athlete(data,geometries,textures,definition,motion,atlasSize,cacheWorld=false){
 const group=cacheWorld?new MatchActorGroup():new THREE.Group();group.name=definition.team+' · '+definition.role+' · '+definition.player.name;group.userData.role=definition.role;group.userData.team=definition.team;group.userData.playerNumber=definition.player.number??null;
 const bones=data.bones.map(b=>{const bone=new THREE.Bone();bone.name=b.name;return bone;});
 data.bones.forEach((b,i)=>{const parent=b.parent>=0?bones[b.parent]:group;parent.add(bones[i]);bones[i].position.fromArray(b.head);if(b.parent>=0)bones[i].position.sub(new THREE.Vector3().fromArray(data.bones[b.parent].head));});
 group.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
 const material=installAthleteSurface(new THREE.MeshStandardMaterial({map:characterAtlas(definition,textures,drawJersey,atlasSize),roughness:.82,alphaTest:.38,side:THREE.DoubleSide}));
 const body=new THREE.SkinnedMesh(actorGeometry(geometries,definition),material);body.name='athlete';body.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),1.75);body.castShadow=true;body.receiveShadow=true;group.add(body);body.bind(skeleton,new THREE.Matrix4());
 const motionPlayer=createFootballMotion(data,motion,bones,group,definition);
 let accessory;if(definition.flag){accessory=new THREE.Group();group.add(accessory);const handle=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.44,6),mat(0x263339));handle.position.y=-.19;accessory.add(handle);const flag=new THREE.Mesh(new THREE.PlaneGeometry(.36,.30),new THREE.MeshBasicMaterial({map:textures.flag,side:THREE.DoubleSide}));flag.position.set(-.18,-.29,0);accessory.add(flag);}
 const booking=definition.role==='referee'?new THREE.Mesh(new THREE.BoxGeometry(.12,.18,.015),new THREE.MeshBasicMaterial({color:0xf1d14c})):null;if(booking){booking.visible=false;group.add(booking);}
 const hand=new THREE.Vector3();
 function updateHand(){
  const prop=accessory||booking;
  if(!prop)return;
  bones[14].getWorldPosition(hand);
  group.worldToLocal(hand);
  prop.position.copy(hand);
  if(cacheWorld)prop.updateMatrixWorld(true);
 }
 return{group,body,definition,reset:motionPlayer.reset,showBooking(type){if(booking){booking.visible=!!type;booking.material.color.set(type==='yellow'?0xf1d14c:0xe82d42);}},pose(x,z,heading,time,moving,seatY=0,action=null,options=noActionOptions){
  // Apply locomotion and the football stroke before propagating the skeleton
  // once. Stairs keep their intermediate matrices for foot placement.
  if(cacheWorld)group.solvingPose=true;
  motionPlayer.pose(x,z,heading,time,moving,seatY,true,options);
  if(action||options.defending||options.speed>5.5)applyFootballAction(bones,action,options,group);
  if(cacheWorld){
   group.solvingPose=false;
   group.invalidatePose();
  }
  group.updateMatrixWorld(true);
  updateHand();
 },poseBudget:createFramePacer()};
}

export function buildEntrancePlayers(scene,{mobile=false}={}){
 const root=new THREE.Group();root.name='Skinned football entrance queue';root.visible=false;scene.add(root);
 let loading,loadingAssets,players=[],ready=false,lastMatchTime=null,playerAssets=null,opponent='dortmund';
 const officials=new Map(),fieldSlots={home:new Array(11),away:new Array(11)};
 const studioPlayers=matchdayPeople.filter(d=>playerLikeness(d));
 function loadPlayerAssets(){
  if(loadingAssets)return loadingAssets;
  loadingAssets=(async()=>{
  const loader=new THREE.TextureLoader(),loadTexture=name=>loader.loadAsync(asset(name));
  const [data,binary,light,dark,short02,eyes,brows,crest,motion,awayCrest,faceKane,faceMusiala]=await Promise.all([
   fetch(asset('footballer-960.json')).then(r=>{if(!r.ok)throw Error('Player manifest '+r.status);return r.json();}),fetch(asset('footballer-960.bin')).then(r=>{if(!r.ok)throw Error('Player mesh '+r.status);return r.arrayBuffer();}),loadTexture('skin-light.webp'),loadTexture('skin-dark.webp'),loadTexture('hair-short02.webp'),loadTexture('eyes.webp'),loadTexture('brows.webp'),new THREE.ImageLoader().loadAsync(new URL('./assets/fc-bayern.svg',import.meta.url).href),fetch(asset('walk-cycle.json')).then(r=>{if(!r.ok)throw Error('Motion '+r.status);return r.json();}),new THREE.ImageLoader().loadAsync(new URL('./assets/borussia-dortmund.svg',import.meta.url).href),
   loadTexture('face-kane.webp').catch(()=>null),loadTexture('face-musiala.webp').catch(()=>null)
  ]);
  for(const t of[light,dark,short02,eyes,brows,faceKane,faceMusiala])if(t){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  const shadow=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.4,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
  const boot=canvasTexture(256,256,drawBootTexture);
  const raw=Object.fromEntries(data.parts.map(p=>[p.name,makeGeometry(binary,p)]));
  const geometries={short02:atlasGeometry(raw,'short02'),crop:atlasGeometry(raw,'crop'),short02Keeper:atlasGeometry(raw,'short02',{keeper:true}),cropKeeper:atlasGeometry(raw,'crop',{keeper:true})};
  for(const style of rosterCropStyles){
   const crop=makeRosterCrop(raw,style);
   geometries['crop-'+style]=atlasGeometry({...raw,crop},'crop');
   crop.dispose();
  }
  for(const identity of ['kane','musiala']){
   const face=likenessParts(raw,identity),body=shapeFootballBody(face,identity);
   geometries[identity]=atlasGeometry(body,'crop');
   const temporary=new Set([...Object.values(face),...Object.values(body)]);
   for(const g of Object.values(raw))temporary.delete(g);
   for(const g of temporary)g.dispose();
  }
  for(const g of Object.values(raw))g.dispose();
  const flag=canvasTexture(64,64,c=>{c.fillStyle='#f3c431';c.fillRect(0,0,64,64);c.fillStyle='#eb622e';c.fillRect(0,0,32,32);c.fillRect(32,32,32,32);});
  const textures={light,dark,short02,eyes,brows,crest,awayCrest,shadow,boot,flag,likenessFaces:{kane:faceKane,musiala:faceMusiala}};
  return{data,motion,geometries,textures};
  })().catch(error=>{loadingAssets=null;throw error;});
  return loadingAssets;
 }
 async function prepare(){if(loading)return loading;loading=(async()=>{
  playerAssets=await loadPlayerAssets();
  const {data,motion,geometries,textures}=playerAssets;
  for(const key of ['short02','crop','short02Keeper','cropKeeper',...rosterCropStyles.map(style=>'crop-'+style)]){
   const geometry=geometries[key];
   geometry.userData.medium??=simplifySkinnedGeometry(geometry,.035);
   geometry.userData.low??=simplifySkinnedGeometry(geometry,.085);
  }
  for(const key of ['kane','musiala']){
   const geometry=geometries[key];
   geometry.userData.medium??=simplifySkinnedGeometry(geometry,.035,likenessMediumParts);
   geometry.userData.low??=simplifySkinnedGeometry(geometry,.105,likenessLowParts);
  }
  const starterSlots={home:0,away:0},benchSlots={home:0,away:0};
  players=matchdayPeople.map(definition=>{const d={...definition,player:{...definition.player},slot:definition.role==='player'?starterSlots[definition.team]++:definition.role==='substitute'?benchSlots[definition.team]++:null},p=athlete(data,geometries,textures,d,motion,mobile?512:d.role==='player'?1024:512,true);p.originalDefinition={...definition,player:{...definition.player}};p.geometry=p.body.geometry;root.add(p.group);return p;});
  root.userData.shadows=createActorContactShadows(root,players.length,textures.shadow);
  ready=true;return true;
 })().catch(error=>{loading=null;throw error;});return loading;}
 async function preview(identity){
  const member=studioPlayers.find(definition=>playerLikeness(definition)===identity)??squadDefinition('home','dortmund',identity);
  if(!member)throw Error('Unknown player portrait');
  const d={...member,role:'player',seated:false};
  const {data,motion,geometries,textures}=await loadPlayerAssets();
  const actor=athlete(data,geometries,textures,d,motion,mobile?512:1024);
  actor.pose(0,0,0,0,false);
  const head=actor.body.skeleton.bones[5];
  head.quaternion.copy(head.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  actor.group.invalidatePose?.();
  actor.group.updateMatrixWorld(true);
  return actor;
 }
 function setOpponent(id){if(!ready)return;const squad=opponentSquad(id),clubChanged=opponent!==squad.club.id;opponent=squad.club.id;
  for(const actor of players){const d=actor.definition;if(d.team==='home'){if(d.role==='player'||d.role==='substitute')updateIdentity(actor,actor.originalDefinition.player.number,id);continue;}if(d.team!=='away')continue;const next=d.role==='player'?squad.xi[d.slot]:d.role==='substitute'?squad.bench[d.slot]:null;d.club=squad.club;d.kit=squad.club.kit;if(next){updateIdentity(actor,next.player.number,id,clubChanged);continue;}if(!clubChanged)continue;const previous=actor.body.material.map;actor.body.material.map=characterAtlas(d,playerAssets.textures,drawJersey,512);previous.dispose();actor.lastPoseTime=null;
  }
 }
 function updateIdentity(actor,number,clubId,force=false){const d=actor.definition;if(number===d.player.number&&!force)return;const member=squadDefinition(d.team,clubId,number);if(!member)return;Object.assign(d,{player:{...member.player},keeper:member.keeper,dark:member.dark,hair:member.hair,height:member.height,hairColor:member.hairColor??d.hairColor});actor.geometry=actorGeometry(playerAssets.geometries,d);actor.body.geometry=actor.geometry;const previous=actor.body.material.map;actor.body.material.map=characterAtlas(d,playerAssets.textures,drawJersey,mobile?512:d.role==='player'?1024:512);previous.dispose();actor.group.userData.playerNumber=number;actor.group.name=d.team+' · '+d.role+' · '+d.player.name;actor.lastPoseTime=null;actor.reset();}
 function updateMatch(state,time,viewer,{firstPerson=false}={}){
  if(!ready||!state?.players)return;const dt=lastMatchTime===null?0:Math.max(0,Math.min(.15,time-lastMatchTime));lastMatchTime=time;
  fieldSlots.home.fill(null);fieldSlots.away.fill(null);
  for(const player of state.players)if(fieldSlots[player.team])fieldSlots[player.team][player.index]=player;
  const decision=state.discipline?.lastDecision,card=decision?.card&&state.time-decision.at<3?decision.card:null,goal=state.phase==='goal'?state.events?.findLast(e=>e.type==='goal'):null;
  for(let i=0;i<players.length;i++){
   const actor=players[i],d=actor.definition;let p=d;
   // Lessons render their real participants only. Match officials and benches
   // return automatically when this same actor pool is reused for a match.
   if(state.training&&d.role!=='player'){actor.showBooking(null);actor.group.visible=false;updateActorContactShadows(root.userData.shadows,i,actor);continue;}
   if(d.role==='player'){p=fieldSlots[d.team][d.slot];if(p)updateIdentity(actor,p.number,state.fixture?.id);if(p?.dismissed||p?.trainingInactive)p=null;}
   else if(d.role==='substitute'){const number=state.teamSheets?.[d.team]?.bench[d.slot];if(number!=null)updateIdentity(actor,number,state.fixture?.id);else if(state.teamSheets)p=null;}
   else if(d.role==='referee'||d.role==='assistantReferee'||d.role==='fourth'){
    const previous=officials.get(i),pose=matchOfficialPose(d,state.ball,previous,dt);officials.set(i,pose);p=pose;
   }
   actor.showBooking(d.role==='referee'?card:null);if(!p){actor.group.visible=false;updateActorContactShadows(root.userData.shadows,i,actor);continue;}
   const distance=viewer?Math.hypot(viewer.x-p.x,viewer.z-p.z):0,controlled=d.role==='player'&&p.id===state.controlledId;
   // Every starter remains available across the full diagonal of the pitch;
   // their low-detail skins and renderer frustum culling handle distant views.
   actor.group.visible=distance<(d.role==='player'?160:mobile?92:130)&&!(controlled&&firstPerson);
   actor.body.geometry=distance>(mobile?22:32)?actor.geometry.userData.low:distance>(mobile?10:16)?actor.geometry.userData.medium:actor.geometry;
   const speed=d.role==='player'?Math.hypot(p.vx||0,p.vz||0):0,moving=d.role==='player'?speed>.16:!!p.moving;
   const heading=p.yaw??(moving?Math.atan2(p.vx,p.vz):0);
   // Pose even a hidden first-person avatar, so its world position and future
   // third-person animation never fall back to the old entrance queue.
   const cadence=controlled?0:d.role!=='player'?.10:distance>(mobile?28:35)?(mobile?1/12:.065):mobile&&distance>14?1/20:0,observable=actor.group.visible||controlled;
   if(!observable||actor.lastPoseTime==null||time<actor.lastPoseTime||cadence===0)actor.poseBudget.reset();
   // Retain fractional deadlines: .05 seconds sampled by a 30Hz match loop
   // must average 20 poses/second, rather than resetting to an effective 15Hz.
   const animate=observable&&(cadence===0||actor.poseBudget.ready(time,1/cadence));
   if((actor.group.visible||controlled)&&animate){let action=null,options=noActionOptions;if(d.role==='player'){
    const celebrating=goal?.team===d.team&&!p.keeper&&(p.id===state.lastShot?.playerId||Math.hypot(p.x-state.ball.x,p.z-state.ball.z)<24),charging=controlled&&state.chargePower>0;
    action=celebrating?{type:'celebrate',elapsed:state.phaseTime,duration:3.6}:charging?{type:'prepareShot',elapsed:state.chargePower,duration:1,stroke:state.shotKind}:p.motion;
    options=actor.fieldOptions??(actor.fieldOptions={});
    options.defending=p.defending;options.speed=speed;options.fieldLocomotion=controlled||distance<(mobile?18:28);
    options.onBall=state.ball.ownerId===p.id;options.incomingBall=!state.ball.ownerId&&state.ball.targetId===p.id?state.ball:null;
    options.action=action;
   }else if(d.role==='referee'&&card)action={type:'booking',elapsed:state.time-decision.at,duration:3};actor.pose(p.x,p.z,heading,time,moving,d.seated&&d.role==='assistant'?.45:0,action,options);actor.lastPoseTime=time;}else if(d.role==='player'||!actor.group.visible&&!controlled){actor.group.position.set(p.x,0,p.z);actor.group.rotation.y=heading;}
   updateActorContactShadows(root.userData.shadows,i,actor,animate);
  }
  flushActorContactShadows(root.userData.shadows);
 }
 return{root,prepare,preview,updateMatch,setOpponent,get ready(){return ready;},get positions(){return players.map(p=>[p.group.position.x,p.group.position.z].map(v=>v.toFixed(2)).join(',')).join(';');},reset(){lastMatchTime=null;officials.clear();for(const p of players){p.reset();p.lastPoseTime=null;}},update(seconds,time,viewer){
  lastMatchTime=null;officials.clear();
  for(let i=0;i<players.length;i++){
   const actor=players[i],d=actor.definition,p=i<26?sampleQueuePlayer(seconds,i):d,distance=viewer?Math.hypot(viewer.x-p.x,viewer.z-p.z):0;
   actor.group.visible=distance<(mobile?86:120);
   if(actor.group.visible){actor.body.geometry=distance>(mobile?22:32)?actor.geometry.userData.low:distance>(mobile?10:16)?actor.geometry.userData.medium:actor.geometry;actor.pose(p.x,p.z,p.yaw,time,p.moving||false,d.seated&&d.role==='assistant'?.45:0);}
   updateActorContactShadows(root.userData.shadows,i,actor,true);
  }
  flushActorContactShadows(root.userData.shadows);
 }};
}

export function matchOfficialPose(definition,ball,previous,dt=0){
 if(definition.role==='fourth')return{x:-37.4,z:3.8,yaw:Math.PI/2,moving:false};
 const assistant=definition.role==='assistantReferee',side=definition.flag&&definition.phase>0.9?1:-1;
 const target={x:assistant?side*35.5:THREE.MathUtils.clamp((ball?.x||0)+8,-27,27),z:THREE.MathUtils.clamp((ball?.z||0)+(assistant?0:9),assistant?-49:-44,assistant?49:44)};
 let x=target.x,z=target.z,moving=false;
 if(previous){const dx=x-previous.x,dz=z-previous.z,length=Math.hypot(dx,dz),travel=Math.min(length,Math.max(0,Math.min(dt,.15))*(assistant?4:3.4));moving=travel>.002;x=previous.x+(length?dx/length*travel:0);z=previous.z+(length?dz/length*travel:0);}
 return{x,z,yaw:Math.atan2((ball?.x||0)-x,(ball?.z||0)-z),moving};
}
