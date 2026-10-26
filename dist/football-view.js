import {THREE,canvasTexture,mesh} from './kit.js';
import {tackleWindow} from './football-assist.js';

// Rendering follows simulation positions. It never moves the game ball,
// advances a player, or uses the spectator camera as an actor's position.
export function buildFootballView(scene,ball,players){
 const root=new THREE.Group();root.name='Playable football cues';root.visible=false;scene.add(root);let enabled=false,lastBall=null;
 const gold=new THREE.MeshBasicMaterial({color:0xe8ca79,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const controlled=new THREE.Group();controlled.name='Controlled footballer';root.add(controlled);
 const ring=mesh(new THREE.RingGeometry(.48,.535,48).rotateX(-Math.PI/2),gold,controlled);ring.renderOrder=2;
 const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.88,.085,0,.67,-.085,0,.67],3));mesh(arrowGeometry,gold,controlled).renderOrder=2;
 const nextPlayer=mesh(new THREE.ConeGeometry(.12,.20,3),new THREE.MeshBasicMaterial({color:0xeeeade,transparent:true,opacity:.75}),root);nextPlayer.rotation.z=Math.PI;nextPlayer.name='Next controllable player';
 const guideGeometry=new THREE.BufferGeometry();guideGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));const guide=new THREE.Line(guideGeometry,new THREE.LineDashedMaterial({color:0xbde7e1,dashSize:.32,gapSize:.42,transparent:true,opacity:.38,depthWrite:false}));guide.frustumCulled=false;guide.name='Directional pass or charged shot preview';root.add(guide);
 const receiver=mesh(new THREE.RingGeometry(.53,.57,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xbde7e1,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}),root);receiver.name='Selected pass receiver';
 const shadowMap=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(0,0,0,.7)');g.addColorStop(.55,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
 const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shadow=mesh(new THREE.PlaneGeometry(.55,.55).rotateX(-Math.PI/2),shadowMaterial,root,0,.012,0);shadow.name='Game ball contact shadow';shadow.renderOrder=1;
 const ballMarker=mesh(new THREE.RingGeometry(.16,.185,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe9eee7,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide}),root,0,.016,0);ballMarker.name='Game ball marker';
 return{root,setEnabled(value){enabled=!!value;root.visible=enabled;lastBall=null;if(enabled&&ball){ball.matrixAutoUpdate=true;ball.updateMatrix();}if(!enabled)controlled.visible=false;},update(state,time,viewer,{firstPerson=false}={}){
  if(!enabled||!state?.ball)return;root.visible=true;const p=state.players.find(p=>p.id===state.controlledId),b=state.ball;
  const next=state.players.find(p=>p.id===state.nextPlayerId);nextPlayer.visible=!!next&&next.id!==state.controlledId;if(next)nextPlayer.position.set(next.x,2.15,next.z);controlled.visible=!!p;if(p){controlled.position.set(p.x,.019,p.z);controlled.rotation.y=p.yaw??0;}
  const owner=state.players.find(p=>p.id===b.ownerId),target=b.ownerId===p?.id?state.chargePower?state.shotPreview:state.passPreview:!b.ownerId?b.receivePoint:null;guide.visible=!!target;receiver.visible=!!target&&!state.chargePower;
  if(target){const dx=target.x-b.x,dz=target.z-b.z,scale=state.chargePower?Math.min(1,13/(Math.hypot(dx,dz)||1)):1,points=guideGeometry.attributes.position;points.setXYZ(0,b.x,.035,b.z);points.setXYZ(1,b.x+dx*scale,.035,b.z+dz*scale);points.needsUpdate=true;guide.computeLineDistances();guide.material.color.set(state.chargePower?0xf2c46c:0xbde7e1);receiver.position.set(target.x,.024,target.z);}
  const available=p&&owner?.team==='away'&&tackleWindow(p,owner,b,{range:2.05}).canReach;gold.color.set(available?0x9ae2b1:0xe8ca79);gold.opacity=p&&state.time<p.tackleAt?.38:.82;
  if(ball){if(lastBall){const dx=b.x-lastBall.x,dz=b.z-lastBall.z;if(Math.hypot(dx,dz)<8){ball.rotation.x+=dz/.11;ball.rotation.z-=dx/.11;}}ball.position.set(b.x,Math.max(.115,b.y||.11),b.z);}
  lastBall={x:b.x,z:b.z};shadow.position.set(b.x,.013,b.z);shadow.scale.setScalar(1+Math.min(5,b.y||.11)*.18);shadowMaterial.opacity=.4/(1+Math.max(0,b.y||0)*1.3);ballMarker.position.set(b.x,.018,b.z);ballMarker.visible=(b.y||.11)<1.5;
  players.root.visible=players.ready;players.updateMatch(state,time,viewer,{firstPerson});
 }};
}
