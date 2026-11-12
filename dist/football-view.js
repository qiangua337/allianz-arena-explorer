import {THREE,canvasTexture,mesh} from './kit.js';
import {tackleWindow} from './football-assist.js';
import {shotGuideTiming,sampleShotGuide,shotReadout,shotGuideSpread} from './shot-feedback.js';
import {footballBallForDisplay} from './football-controls.js';

function markGuideBuffer(attribute,count){
 // Keep a pending write if the previous frame never drew the guide.
 const pending=attribute.updateRanges[0];
 if(pending)pending.count=Math.max(pending.count,count);
 else attribute.addUpdateRange(0,count);
 attribute.needsUpdate=true;
}

// Rendering follows simulation positions. It never moves the game ball,
// advances a player, or uses the spectator camera as an actor's position.
export function buildFootballView(scene,ball,players,{getRenderCamera}={}){
 const root=new THREE.Group();root.name='Playable football cues';root.visible=false;scene.add(root);
 let enabled=false,hasBallSample=false,ballX=0,ballZ=0;
 const ballAxis=new THREE.Vector3();
 const lastCameraWorld=new THREE.Matrix4(),lastCameraProjection=new THREE.Matrix4();
 let lastCamera=null;
 function cameraChanged(){
  const camera=getRenderCamera?.()??null;
  return camera!==lastCamera||!!camera&&(!lastCameraWorld.equals(camera.matrixWorld)||!lastCameraProjection.equals(camera.projectionMatrix));
 }
 const gold=new THREE.MeshBasicMaterial({color:0xf0dcab,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const controlled=new THREE.Group();controlled.name='Controlled footballer';root.add(controlled);
 const ring=mesh(new THREE.RingGeometry(.48,.524,48,1,Math.PI*1.5+.34,Math.PI*2-.68).rotateX(-Math.PI/2),gold,controlled);ring.renderOrder=2;
 const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.88,.085,0,.67,-.085,0,.67],3));mesh(arrowGeometry,gold,controlled).renderOrder=2;
 const nextPlayer=mesh(new THREE.ConeGeometry(.12,.20,3),new THREE.MeshBasicMaterial({color:0xeeeade,transparent:true,opacity:.75}),root);nextPlayer.rotation.z=Math.PI;nextPlayer.name='Next controllable player';
 const guideGeometry=new THREE.BufferGeometry();
 const guidePositions=new THREE.Float32BufferAttribute(new Float32Array(99),3).setUsage(THREE.DynamicDrawUsage);
 const guideDistances=new THREE.Float32BufferAttribute(new Float32Array(33),1).setUsage(THREE.DynamicDrawUsage);
 guideGeometry.setAttribute('position',guidePositions);guideGeometry.setAttribute('lineDistance',guideDistances);
 const guide=new THREE.Line(guideGeometry,new THREE.LineDashedMaterial({color:0xbde7e1,dashSize:.32,gapSize:.42,transparent:true,opacity:.5,depthWrite:false}));guide.frustumCulled=false;guide.name='Directional pass or charged shot preview';root.add(guide);
 const aim=mesh(new THREE.RingGeometry(.20,.235,32),new THREE.MeshBasicMaterial({color:0xf2c46c,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}),root);aim.name='Charged shot goal target';
 const spreadGeometry=new THREE.BufferGeometry();spreadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(36),3).setUsage(THREE.DynamicDrawUsage));const spread=new THREE.LineSegments(spreadGeometry,new THREE.LineBasicMaterial({color:0xf2c46c,transparent:true,opacity:.65,depthWrite:false}));spread.name='Shot preparation dispersion';spread.frustumCulled=false;root.add(spread);const guidePoint=new THREE.Vector3();
 const shotGuideFields=['vx','vy','vz','curve','flight','spread','heightSpread'],lastShotGuide={};
 function updateGuidePath(b,target,charging){
  const points=guidePositions;
  if(charging){
   const {x,y,z}=b;
   if(guideGeometry.drawRange.count===33&&lastShotGuide.x===x&&lastShotGuide.y===y&&lastShotGuide.z===z&&shotGuideFields.every(key=>lastShotGuide[key]===target[key]))return;
   lastShotGuide.x=x;lastShotGuide.y=y;lastShotGuide.z=z;
   for(const key of shotGuideFields)lastShotGuide[key]=target[key];
   const timing=shotGuideTiming(b,target);
   for(let i=0;i<33;i++){sampleShotGuide(b,target,timing.duration*i/32,guidePoint);points.setXYZ(i,guidePoint.x,guidePoint.y,guidePoint.z);}
   guideGeometry.setDrawRange(0,33);aim.position.copy(guidePoint);aim.rotation.x=timing.lands?-Math.PI/2:0;
   const {width,height}=shotGuideSpread(target,timing),g=spreadGeometry.attributes.position,{x:aimX,y:aimY,z:aimZ}=guidePoint,tick=.14;
   g.setXYZ(0,aimX-width,aimY,aimZ);g.setXYZ(1,aimX+width,aimY,aimZ);
   g.setXYZ(2,aimX-width,aimY-(timing.lands?0:tick),aimZ-(timing.lands?tick:0));g.setXYZ(3,aimX-width,aimY+(timing.lands?0:tick),aimZ+(timing.lands?tick:0));
   g.setXYZ(4,aimX+width,aimY-(timing.lands?0:tick),aimZ-(timing.lands?tick:0));g.setXYZ(5,aimX+width,aimY+(timing.lands?0:tick),aimZ+(timing.lands?tick:0));
   if(!timing.lands){g.setXYZ(6,aimX,aimY-height,aimZ);g.setXYZ(7,aimX,aimY+height,aimZ);g.setXYZ(8,aimX-tick,aimY-height,aimZ);g.setXYZ(9,aimX+tick,aimY-height,aimZ);g.setXYZ(10,aimX-tick,aimY+height,aimZ);g.setXYZ(11,aimX+tick,aimY+height,aimZ);}
   const spreadCount=timing.lands?6:12;
   spreadGeometry.setDrawRange(0,spreadCount);markGuideBuffer(g,spreadCount*3);
  }else{
   const x=Math.fround(b.x),z=Math.fround(b.z),tx=Math.fround(target.x),tz=Math.fround(target.z);
   if(guideGeometry.drawRange.count===2&&points.getX(0)===x&&points.getZ(0)===z&&points.getX(1)===tx&&points.getZ(1)===tz)return;
   points.setXYZ(0,x,.035,z);points.setXYZ(1,tx,.035,tz);guideGeometry.setDrawRange(0,2);
  }
  const count=guideGeometry.drawRange.count;
  let length=0;
  for(let i=1;i<count;i++){
   length+=Math.hypot(points.getX(i)-points.getX(i-1),points.getY(i)-points.getY(i-1),points.getZ(i)-points.getZ(i-1));
   guideDistances.setX(i,length);
  }
  markGuideBuffer(points,count*3);markGuideBuffer(guideDistances,count);
 }
 const receiver=mesh(new THREE.RingGeometry(.53,.57,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xbde7e1,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}),root);receiver.name='Selected pass receiver';
 const shadowMap=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(0,0,0,.7)');g.addColorStop(.55,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
 const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shadow=mesh(new THREE.PlaneGeometry(.55,.55).rotateX(-Math.PI/2),shadowMaterial,root,0,.012,0);shadow.name='Game ball contact shadow';shadow.renderOrder=1;
 const ballMarker=mesh(new THREE.RingGeometry(.16,.185,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe9eee7,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide}),root,0,.016,0);ballMarker.name='Game ball marker';
 return{root,cameraChanged,setEnabled(value){enabled=!!value;root.visible=enabled;hasBallSample=false;lastCamera=null;if(enabled&&ball){ball.matrixAutoUpdate=true;ball.matrixWorldAutoUpdate=true;ball.updateMatrix();}if(!enabled)controlled.visible=false;},update(state,time,viewer,{firstPerson=false}={}){
  if(!enabled||!state?.ball)return;root.visible=true;const p=state.players.find(p=>p.id===state.controlledId&&!p.trainingInactive),b=state.ball;
  const next=state.players.find(p=>p.id===state.nextPlayerId&&!p.trainingInactive);nextPlayer.visible=!state.replay&&!!next&&next.id!==state.controlledId;if(next)nextPlayer.position.set(next.x,2.15,next.z);controlled.visible=!!p&&!state.replay;
  if(p){
   controlled.position.set(p.x,.019,p.z);controlled.rotation.y=p.yaw??0;
   const distance=viewer?controlled.position.distanceTo(viewer):0;
   controlled.scale.setScalar(1+Math.min(Math.max(distance-11,0)/85,.27));
  }
  const displayedBall=footballBallForDisplay(state),penalty=state.phase==='penalties'||state.setPiece?.type==='penalty',charging=b.ownerId===p?.id&&!!state.chargePower,owner=state.players.find(p=>p.id===b.ownerId&&!p.trainingInactive),target=penalty||displayedBall!==b?null:b.ownerId===p?.id?state.chargePower?state.shotPreview:state.passPreview:!b.ownerId?b.receivePoint:null;guide.visible=!!target&&!state.replay;receiver.visible=!!target&&!charging&&!state.replay;
  aim.visible=!!target&&charging&&!state.replay;spread.visible=aim.visible;
  if(guide.visible){
   updateGuidePath(b,target,charging);
   const tone=charging?shotReadout(target).tone:null;guide.material.color.set(charging?tone==='risk'?0xf39483:tone==='caution'?0xe8c17c:state.shotKind==='lob'?0xc9b6f6:state.shotKind==='finesse'?0x94dec5:0xf2c46c:0xbde7e1);aim.material.color.copy(guide.material.color);spread.material.color.copy(guide.material.color);receiver.position.set(target.x,.024,target.z);
  }
  const available=p&&owner&&owner.team!==p?.team&&tackleWindow(p,owner,b,{range:2.05}).canReach;gold.color.set(available?0xabe7bb:0xf0dcab);gold.opacity=p&&state.time<p.tackleAt?.38:.82;
  const {x,y,z}=displayedBall,height=Math.max(.115,y||.11),lift=height-.115;
  if(ball){
   if(hasBallSample){
    const dx=x-ballX,dz=z-ballZ,distance=Math.hypot(dx,dz);
    if(distance>.0005&&distance<8){
     ballAxis.set(dz/distance,0,-dx/distance);
     const rolling=1-Math.min(lift/.22,1)*.71;
     ball.rotateOnWorldAxis(ballAxis,distance/.11*rolling);
    }
   }
   ball.position.set(x,height,z);
  }
  hasBallSample=true;ballX=x;ballZ=z;
  shadow.position.set(x,.013,z);shadow.scale.setScalar(.80+Math.min(lift,4)*.26);
  shadowMaterial.opacity=.56/(1+lift*1.55);
  ballMarker.position.set(x,.018,z);
  const markerDistance=viewer?ballMarker.position.distanceTo(viewer):0;
  ballMarker.scale.setScalar(1+Math.min(Math.max(markerDistance-10,0)/42,.70));
  ballMarker.material.opacity=.24+.24*Math.min(markerDistance/42,1);
  ballMarker.visible=height<1.5&&!state.replay&&markerDistance>5;
  lastCamera=getRenderCamera?.()??null;
  if(lastCamera){lastCameraWorld.copy(lastCamera.matrixWorld);lastCameraProjection.copy(lastCamera.projectionMatrix);}
  players.root.visible=players.ready;players.updateMatch(state,time,viewer,{firstPerson,camera:lastCamera});
 }};
}
