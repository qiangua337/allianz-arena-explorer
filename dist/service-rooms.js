import {THREE,mat,box,sign,Batches} from './kit.js';
import {finishedBox,contactShadow} from './finishes.js';
import {serviceRooms,serviceWorld,serviceCoordinates} from './service-layout.js';
import {orientedCollider} from './access-layout.js';
import {compactStaticMeshes,freezeArchitecture} from './scene-budget.js';

export function buildServiceRooms(scene){
 const root=new THREE.Group();root.name='Openable service doors and ancillary rooms';scene.add(root);
 const wall=mat(0xc9c8bf,{roughness:.93}),floor=mat(0x787d78,{roughness:.95}),metal=mat(0x9ba9a8,{metalness:.48,roughness:.42}),dark=mat(0x333d40,{roughness:.68}),red=mat(0x9f2639),wood=mat(0xb6a17b,{roughness:.87}),light=new THREE.MeshBasicMaterial({color:0xfff0d6,toneMapped:false});
 const colliders=[],walls=[],doors=[],interiors=[];
 const leafMaterial=mat(0x344044,{roughness:.68});
 for(const r of serviceRooms){
  const interior=new THREE.Group();interior.position.set(r.x,r.y,r.z);interior.rotation.y=r.yaw;root.add(interior);interiors.push({room:r,group:interior});
  const b=new Batches(interior),addCollider=(w,d,x,z,h)=>{const p=serviceWorld(r,x,z),c=orientedCollider(p.x,p.z,w,d,r.y,r.y+h,r.yaw,r.id);colliders.push(c);walls.push(c);},addWall=(w,h,d,x,y,z)=>{b.add(w,h,d,x,y,z,wall);addCollider(w,d,x,z,h);};
  b.add(r.width,.16,r.depth+.22,0,-.08,-r.depth/2,floor);b.add(r.width,.16,r.depth+.22,0,3.38,-r.depth/2,wall);
  addWall(.15,3.35,r.depth,-r.width/2,1.675,-r.depth/2);addWall(.15,3.35,r.depth,r.width/2,1.675,-r.depth/2);addWall(r.width,3.35,.15,0,1.675,-r.depth);
  for(const side of[-1,1]){addWall(.5,3.35,.18,side*2.2,1.675,0);b.add(.085,3.4,.16,side*1.96,1.7,.02,metal);b.add(.08,.12,r.depth,side*(r.width/2-.1),.06,-r.depth/2,dark);}
  b.add(3.85,.14,.18,0,3.34,.02,metal);b.add(3.7,.045,.05,0,.02,.07,metal);b.add(2.7,.045,.24,0,3.27,-2,light);b.add(2.9,.09,.38,0,3.32,-2,dark);
  for(const side of[-1,1]){const x=side*1.78;for(const z of[-3.65,-2.15])b.add(.055,2.45,.055,x-side*.45,1.225,z,metal);for(let shelf=0;shelf<4;shelf++){b.add(1.0,.065,1.7,x,.35+shelf*.6,-2.9,metal);if(shelf<3)for(let i=0;i<2;i++)finishedBox(interior,.65,.35,.55,x,.56+shelf*.6,-3.35+i*.8,r.type==='supplies'?wood:dark,.025);}}
  for(const side of[-1,1])addCollider(1,1.8,side*1.78,-2.9,2.5);
  finishedBox(interior,1.25,.76,.58,0,.38,-3.72,r.type==='supplies'?wood:dark,.025);b.add(.9,.06,.6,0,.8,-3.7,wall);addCollider(1.25,.6,0,-3.72,.86);
  if(r.type==='equipment'){for(let i=0;i<4;i++){b.add(.72,.23,.12,0,1.13+i*.32,-4.05,dark);b.add(.07,.045,.04,.25,1.13+i*.32,-3.97,red);}}
  else{b.add(.65,.72,.13,0,1.92,-4.04,wall);sign(interior,'+',.36,.36,0,1.94,-3.96,{fg:'#7b9f82',font:125});}
  contactShadow(interior,4.5,1.4,0,.015,-3.6);const lamp=new THREE.PointLight(0xffedcf,28,9,2);lamp.position.set(0,2.95,-2);interior.add(lamp);b.flush();compactStaticMeshes(interior);freezeArchitecture(interior);
  const front=new THREE.Group();front.position.set(r.x,r.y,r.z);front.rotation.y=r.yaw;root.add(front);box(front,r.width,1.4,.18,0,3.98,0,wall);
  const record={...r,front,open:false,angle:0,target:0,leaves:[]};
  for(const side of[-1,1]){const hinge=new THREE.Group();hinge.position.x=side*1.88;front.add(hinge);finishedBox(hinge,1.86,3.23,.09,-side*.93,1.615,0,leafMaterial,.018);box(hinge,.045,.55,.10,-side*1.65,1.41,.11,metal);box(hinge,.045,.55,.10,-side*1.65,1.41,-.11,metal);
   compactStaticMeshes(hinge);const p=serviceWorld(r,side*.95,0),collider=orientedCollider(p.x,p.z,1.86,.09,r.y,r.y+3.23,r.yaw,r.id);collider.dynamicDoor=true;colliders.push(collider);record.leaves.push({side,hinge,collider});
  }
  doors.push(record);
 }
 function update(position,dt){for(const entry of interiors)entry.group.visible=Math.hypot(position.x-entry.room.x,position.z-entry.room.z)<18&&Math.abs(position.y-entry.room.y)<6;
  for(const d of doors){d.front.visible=Math.hypot(position.x-d.x,position.z-d.z)<42&&Math.abs(position.y-d.y)<8;d.target=d.open?Math.PI*.48:0;const p=serviceCoordinates(d,position.x,position.z);if(!d.open&&Math.abs(position.y-d.y-1.7)<2&&Math.abs(p.side)<1.9&&Math.abs(p.depth)<1.1)d.target=Math.max(d.angle,Math.PI*.48);if(Math.abs(d.angle-d.target)<.00001)continue;d.angle=THREE.MathUtils.damp(d.angle,d.target,10,dt);
   for(const leaf of d.leaves){const angle=-leaf.side*d.angle;leaf.hinge.rotation.y=angle;const x=leaf.side*1.88-leaf.side*.93*Math.cos(angle),z=leaf.side*.93*Math.sin(angle),world=serviceWorld(d,x,z);leaf.collider.cx=world.x;leaf.collider.cz=world.z;leaf.collider.yaw=d.yaw+angle;}
  }
 }
 return{root,colliders,walls,doors,update,isAnimating:()=>doors.some(d=>Math.abs(d.angle-d.target)>.003),nearest(position){return doors.find(d=>Math.hypot(position.x-d.x,position.z-d.z)<3.5&&Math.abs(position.y-d.y-1.7)<2);},toggle(door){door.open=!door.open;return door.open;}};
}
