import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets,superpoint}=await import('../dist/kit.js');await loadBrandAssets();
const {buildStadium}=await import('../dist/stadium.js');
const {partitionStaticMesh}=await import('../dist/spatial-batches.js');
const {freezeArchitecture}=await import('../dist/scene-budget.js');
const {bowlOpening}=await import('../dist/tour-route.js');
const {createCrowdLayout}=await import('../dist/crowd-layout.js');
const scene=new THREE.Scene(),stadium=buildStadium(scene),triangles=o=>(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
function meshes(root){const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;}
const upper=meshes(stadium.roof).filter(o=>o.name.startsWith('ETFE upper roof section'));
const decks=stadium.bowl.getObjectByName('Seating decks and risers'),lining=stadium.roof.getObjectByName('Continuous ribbed inner roof canopy'),trusses=stadium.roof.getObjectByName('Radial roof trusses and compression rings'),rails=stadium.bowl.getObjectByName('Continuous stair handrails beside clear walking aisles');
const ringMeshes=[...upper,...meshes(decks),...meshes(lining),...meshes(trusses),...meshes(rails)];

test('only the six intended static rings are divided; every original triangle and ETFE depth material remains',()=>{
 assert.equal(upper.length,32);assert.equal(upper.reduce((n,o)=>n+triangles(o),0),111360);
 for(const [group,count]of [[decks,67750],[lining,10208],[trusses,23904],[rails,48144]]){assert.ok(group);assert.equal(meshes(group).length,16);assert.equal(meshes(group).reduce((n,o)=>n+triangles(o),0),count);}
 assert.equal(ringMeshes.reduce((n,o)=>n+triangles(o),0),261366);
 assert.ok(upper.every(o=>o.castShadow&&o.customDepthMaterial===upper[0].customDepthMaterial));assert.ok(meshes(lining).every(o=>o.castShadow&&o.receiveShadow));
 const plainSeats=stadium.bowl.children.filter(o=>o.isInstancedMesh&&o.instanceColor&&o.count>384);assert.equal(plainSeats.length,24,'the existing seat sectors are untouched');
 assert.equal(stadium.matchBall.isMesh,true);assert.ok(stadium.matchBall.geometry.attributes.position.count>1000,'dynamic ball is not spatially divided');
});
test('sector boundaries keep real seating floors and a complete roof around all directions',()=>{
 scene.updateMatrixWorld(true);let floorHits=0,roofHits=0;
 for(const [tierIndex,tier]of stadium.tiers.entries())for(const row of[10,20])for(let sector=0;sector<32;sector++){
  const angle=sector/32*Math.PI*2,p=superpoint(tier.a+row*tier.depth+.35,tier.b+row*tier.depth+.35,angle,3.35),y=tier.y+row*tier.depth*Math.tan(tier.angle*Math.PI/180);
  if(tierIndex===0&&bowlOpening(p.x,p.z,row))continue;
  const hit=new THREE.Raycaster(new THREE.Vector3(p.x,y+.12,p.z),new THREE.Vector3(0,-1,0),0,.3).intersectObject(decks,true)[0];assert.ok(hit,`real floor at tier ${tierIndex}, row ${row}, angle ${angle}`);assert.ok(Math.abs(hit.point.y-y)<1e-4);floorHits++;
 }
 for(let sector=0;sector<32;sector++){
  const angle=sector/32*Math.PI*2,p=superpoint(88,102,angle,2.65),direction=new THREE.Vector3(p.x,48,p.z).normalize();
  assert.ok(new THREE.Raycaster(new THREE.Vector3(0,1.7,0),direction,0,200).intersectObject(stadium.roof,true).length>0,'canopy exists at each sector seam');roofHits++;
 }
 assert.ok(floorHits>170);assert.equal(roofHits,32);
});
test('the real phone follow view submits fewer static-ring triangles without reducing geometry or losing visibility controls',()=>{
 const camera=new THREE.PerspectiveCamera(66,390/844,.1,2500);camera.position.set(0,5.2,8.3);camera.lookAt(0,.92,-3);camera.updateMatrixWorld(true);stadium.update(camera,'walk',false,false,true);scene.updateMatrixWorld(true);
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),visible=ringMeshes.filter(o=>frustum.intersectsObject(o)),submitted=visible.reduce((n,o)=>n+triangles(o),0);
 assert.ok(submitted<120000,`static rings submit ${submitted} triangles instead of 261366`);assert.ok(visible.length<40,'partitioning has a bounded extra draw cost');
 stadium.night(true);assert.ok(upper.some(o=>o.material.emissiveIntensity>0));assert.equal(new Set(upper.map(o=>o.material)).size,2,'night materials remain shared');
 camera.position.set(-82,-1,5);stadium.update(camera,'walk');assert.ok(upper.every(o=>!o.visible),'all roof shell pieces obey enclosed-player hiding');
 camera.position.set(0,8,214);stadium.update(camera,'orbit');assert.ok(upper.every(o=>o.visible),'all roof shell pieces restore outside');
 stadium.roof.visible=false;assert.ok(ringMeshes.filter(o=>upper.includes(o)||meshes(lining).includes(o)||meshes(trusses).includes(o)).every(o=>{for(let p=o;p;p=p.parent)if(p===stadium.roof)return !p.visible;return false;}));stadium.roof.visible=true;stadium.night(false);
});

test('phone stairwell occlusion restores the full stadium at an opening or immediately on turning toward it',()=>{
 const width=globalThis.innerWidth;globalThis.innerWidth=390;
 const camera=new THREE.PerspectiveCamera(66,390/844,.1,2500);
 const face=(x,y,z,mode='walk',high=false,playing=false)=>{
  camera.lookAt(x,y,z);stadium.update(camera,mode,high,false,playing);
 };
 try{
  camera.position.set(100,29.8,-1.2);
  face(100,30.1,2);
  assert.equal(stadium.bowl.visible,false);
  assert.equal(stadium.circulation.root.visible,false,'paving and lower access flights are behind the stairwell walls');
  assert.equal(lining.visible,false);
  assert.ok(upper.every(mesh=>!mesh.visible));
  face(101.5,25.3,-13.25);
  assert.equal(stadium.bowl.visible,true,'turning in place restores portal views');
  assert.equal(stadium.circulation.root.visible,true);
  assert.equal(lining.visible,true);
  assert.ok(upper.every(mesh=>mesh.visible));
  face(100,30.1,2,'walk',true);
  assert.equal(stadium.bowl.visible,true);
  face(100,30.1,2,'orbit');
  assert.equal(stadium.bowl.visible,true);
  face(100,30.1,2,'walk',false,true);
  assert.equal(stadium.bowl.visible,true);
  camera.position.set(106,41.7,-25);face(106,41.7,-37.6);
  assert.equal(stadium.bowl.visible,false,'the first corridor cannot see around the far corner');
  assert.equal(stadium.circulation.root.visible,false);
  camera.position.set(103.3,41.7,-36.5);face(90,38,-36.5);
  assert.equal(stadium.bowl.visible,true,'the open seating entrance is visible before crossing it');
  assert.equal(stadium.circulation.root.visible,true);
  face(90,38,-32);
  assert.equal(stadium.bowl.visible,true,'a grazing view keeps the padded opening visible');
  face(105,41.7,-36.5);
  assert.equal(stadium.bowl.visible,false,'turning to return hides the exterior again');
  camera.position.set(101,40.2,-36.5);face(0,15,0);
  assert.equal(stadium.bowl.visible,true,'the upper stands panorama remains visible');
 }finally{if(width===undefined)delete globalThis.innerWidth;else globalThis.innerWidth=width;}
});

test('bowl fittings retain every box and cull the opposite stand from match cameras',()=>{
 const fittings=meshes(stadium.bowl.getObjectByName('Bowl concrete steps and metal fittings'));
 assert.ok(fittings.every(o=>o.isInstancedMesh&&o.castShadow&&o.receiveShadow));
 assert.ok(fittings.length<=26);
 const all=fittings.reduce((n,o)=>n+o.count,0);
 assert.ok(all>9000);
 scene.updateMatrixWorld(true);
 for(const [x,z,aspect] of [[20,15,16/9],[-22,-18,16/9],[8,30,390/844]]){
  const camera=new THREE.PerspectiveCamera(66,aspect,.1,2500);
  camera.position.set(x,10,z);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const submitted=fittings.filter(o=>frustum.intersectsObject(o)).reduce((n,o)=>n+o.count,0);
  assert.ok(submitted>0&&submitted<all*.8,`${submitted}/${all} boxes from ${x}, ${z}`);
 }
});
test('static splitting preserves world area, transforms, UV channels and shadow flags and rejects dynamic instances',()=>{
 const parent=new THREE.Group(),geometry=new THREE.TorusGeometry(90,2,6,80).rotateX(Math.PI/2);geometry.setAttribute('uv1',geometry.attributes.uv.clone());const source=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());source.position.set(3,7,-4);source.scale.set(1.2,1,1.3);source.castShadow=source.receiveShadow=true;source.customDepthMaterial=new THREE.MeshDepthMaterial();parent.add(source);parent.updateMatrixWorld(true);
 const area=root=>{let area=0;for(const mesh of meshes(root)){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<(index?.count??p.count);i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));area+=v[1].sub(v[0]).cross(v[2].sub(v[0])).length()/2;}}return area;};
 const before=area(parent),part=partitionStaticMesh(source);parent.updateMatrixWorld(true);assert.ok(Math.abs(area(parent)-before)<1e-4);assert.ok(meshes(part).every(o=>o.geometry.attributes.uv1.count===o.geometry.attributes.position.count&&o.castShadow&&o.receiveShadow&&o.customDepthMaterial===source.customDepthMaterial));
 const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(),source.material,2);parent.add(inst);assert.equal(partitionStaticMesh(inst),null);
 freezeArchitecture(stadium.root,[stadium.matchBall]);const matrix=ringMeshes[0].matrixWorld.clone(),ball=stadium.matchBall.position.x;stadium.matchBall.position.x+=2;scene.updateMatrixWorld(true);assert.ok(ringMeshes.every(o=>o.matrixWorldAutoUpdate===false));assert.ok(ringMeshes[0].matrixWorld.equals(matrix));assert.equal(stadium.matchBall.matrixWorld.elements[12],ball+2,'the active ball still updates its world transform');
});
test('filled matches skip seat geometry hidden by spectators and restore all seats for training and exploration',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,5.2,8.3);
 const seats=stadium.bowl.children.filter(o=>o.isInstancedMesh&&o.instanceColor&&o.count>384);
 const count=()=>seats.reduce((n,o)=>n+o.count,0);
 const audience=createCrowdLayout(stadium.seatPositions).count;
 stadium.update(camera,'walk',false,false,true,true);
 assert.equal(count(),stadium.seatCount-audience);
 stadium.update(camera,'walk',false,false,true,false);
 assert.equal(count(),stadium.seatCount);
 stadium.update(camera,'walk',true,false,true,true);
 assert.equal(count(),stadium.seatCount);
 stadium.update(camera,'walk',false,false,true,true);
 stadium.update(camera,'walk',false,false,false);
 assert.equal(count(),stadium.seatCount);
});
