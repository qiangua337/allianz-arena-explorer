import {THREE,canvasTexture,mesh} from './kit.js';

// Rendering follows simulation positions. It never moves the game ball,
// advances a player, or uses the spectator camera as an actor's position.
export function buildFootballView(scene,ball,players){
 const root=new THREE.Group();root.name='Playable football cues';root.visible=false;scene.add(root);let enabled=false,lastBall=null;
 const gold=new THREE.MeshBasicMaterial({color:0xe8ca79,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const controlled=new THREE.Group();controlled.name='Controlled footballer';root.add(controlled);
 const ring=mesh(new THREE.RingGeometry(.48,.535,48).rotateX(-Math.PI/2),gold,controlled);ring.renderOrder=2;
 const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.88,.085,0,.67,-.085,0,.67],3));mesh(arrowGeometry,gold,controlled).renderOrder=2;
 const shadowMap=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(0,0,0,.7)');g.addColorStop(.55,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
 const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shadow=mesh(new THREE.PlaneGeometry(.55,.55).rotateX(-Math.PI/2),shadowMaterial,root,0,.012,0);shadow.name='Game ball contact shadow';shadow.renderOrder=1;
 const ballMarker=mesh(new THREE.RingGeometry(.16,.185,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe9eee7,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide}),root,0,.016,0);ballMarker.name='Game ball marker';
 return{root,setEnabled(value){enabled=!!value;root.visible=enabled;lastBall=null;if(!enabled)controlled.visible=false;},update(state,time,viewer,{firstPerson=false}={}){
  if(!enabled||!state?.ball)return;root.visible=true;const p=state.players.find(p=>p.id===state.controlledId),b=state.ball;
  controlled.visible=!!p;if(p){controlled.position.set(p.x,.019,p.z);controlled.rotation.y=Math.hypot(p.vx||0,p.vz||0)>.16?Math.atan2(p.vx,p.vz):p.yaw??0;}
  if(ball){if(lastBall){const dx=b.x-lastBall.x,dz=b.z-lastBall.z;if(Math.hypot(dx,dz)<8){ball.rotation.x+=dz/.11;ball.rotation.z-=dx/.11;}}ball.position.set(b.x,Math.max(.115,b.y||.11),b.z);}
  lastBall={x:b.x,z:b.z};shadow.position.set(b.x,.013,b.z);shadow.scale.setScalar(1+Math.min(5,b.y||.11)*.18);shadowMaterial.opacity=.4/(1+Math.max(0,b.y||0)*1.3);ballMarker.position.set(b.x,.018,b.z);ballMarker.visible=(b.y||.11)<1.5;
  players.root.visible=players.ready;players.updateMatch(state,time,viewer,{firstPerson});
 }};
}
