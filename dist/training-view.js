import * as THREE from 'three';
// Ground-level targets reuse a fixed pool; they do not affect ball physics.
export function buildTrainingView(scene){
 const root=new THREE.Group();root.name='training-targets';root.visible=false;scene.add(root);const markers=[];
 const geometry=new THREE.RingGeometry(.945,1,40),material=new THREE.MeshBasicMaterial({color:0xe3c27d,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<8;i++){const mesh=new THREE.Mesh(geometry,material.clone());mesh.rotation.x=-Math.PI/2;mesh.position.y=.055;mesh.visible=false;root.add(mesh);markers.push(mesh);}
 function update(training){root.visible=!!training;if(!training)return;for(let i=0;i<markers.length;i++){const mesh=markers[i],target=training.targets[i];mesh.visible=!!target&&target.kind!=='goal'&&target.active&&!target.completed;if(!mesh.visible)continue;mesh.position.set(target.x,.055,target.z);const radius=target.radius||1.5;mesh.scale.setScalar(radius);}}
 return{root,update,setEnabled(value){root.visible=value;}};
}
