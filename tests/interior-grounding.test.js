import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,style:{},classList:{toggle(){}},focus(){}}),createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');
const {buildInteriors,roomSpecs}=await import('../dist/interiors.js');
const {floorHeight}=await import('../dist/navigation.js');
const {destinationArrival}=await import('../dist/arrivals.js');
const {contactShadow}=await import('../dist/finishes.js');
const {finishFixtureShadows}=await import('../dist/finishes.js');
const {pressCameras,pressFloorRise}=await import('../dist/facility-layout.js');
const {buildBroadcastCamera}=await import('../dist/facility-equipment.js');
const {furniture}=await import('../dist/furniture-layout.js');
await loadBrandAssets();

test('the press-room arrival, rear cross-aisle and side aisles have a rendered floor at walking height',()=>{
 const scene=new THREE.Scene(),interiors=buildInteriors(scene,{decorateConcourse(){}}),geometry={rooms:roomSpecs},arrival=destinationArrival('press',geometry),meshes=[];
 scene.updateMatrixWorld(true);for(const g of[interiors.rooms.press,interiors.shells.press])g.traverse(o=>{if(o.isMesh&&!o.material.transparent)meshes.push(o);});
 const samples=[[arrival.position[0],arrival.position[2]],[-91.9,-22.6],[-72.1,-22.6]];
 for(const x of[-91.9,-72.1])for(const z of[-32,-30,-28,-26,-24])samples.push([x,z]);
 for(const[x,z]of samples){const expected=floorHeight(x,z,arrival.feet,geometry),hit=new THREE.Raycaster(new THREE.Vector3(x,expected+.025,z),new THREE.Vector3(0,-1,0),0,1.2).intersectObjects(meshes,false).find(h=>h.face.normal.y>.9);
  assert.ok(hit,`a solid upward-facing floor exists at ${x},${z}`);assert.ok(Math.abs(hit.point.y-expected)<.002,`walking height ${expected} agrees with visible floor ${hit.point.y} at ${x},${z}`);
 }
 let markingFaces=0;interiors.rooms.press.traverse(o=>{if(!o.isMesh||o.material.color?.getHex()!==0x313335)return;const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;for(let i=0;i<p.count;i+=3){const zs=[p.getZ(i),p.getZ(i+1),p.getZ(i+2)];if(n.getY(i)<.9||Math.max(...zs)-Math.min(...zs)<.02)continue;const z=zs.reduce((a,b)=>a+b)/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;assert.ok(Math.abs(y-pressFloorRise(z)-.019)<1e-5,'aisle markings remain above each tread');markingFaces++;}});assert.ok(markingFaces>10);
});

test('press cameras, all tripod feet and their contacts follow the stepped platform',()=>{
 const root=new THREE.Group(),shadows=new THREE.Group(),spec=roomSpecs.press;
 finishFixtureShadows(shadows,spec,'press');
 for(const camera of pressCameras){
  const g=buildBroadcastCamera(root,{...camera,floorAt:(_x,z)=>pressFloorRise(z)});g.updateMatrixWorld(true);
  assert.equal(g.position.y,pressFloorRise(camera.z));
  const feet=g.children.filter(o=>o.name==='Camera tripod foot');assert.equal(feet.length,3);
  for(const foot of feet){const center=foot.getWorldPosition(new THREE.Vector3()),bounds=new THREE.Box3().setFromObject(foot),ground=pressFloorRise(center.z);
   assert.ok(Math.abs(bounds.min.y-ground)<1e-6,`tripod foot rests on its own tread at ${center.z}`);
  }
  const collision=furniture.find(f=>f.owner==='press'&&f.x===spec.x+camera.x&&f.z===spec.z+camera.z);assert.ok(collision);assert.ok(Math.abs(collision.y0-spec.y-g.position.y)<1e-8);
  const shadow=shadows.children.find(o=>Math.abs(o.position.x-camera.x)<1e-8&&Math.abs(o.position.z-camera.z)<1e-8);assert.ok(shadow);assert.ok(Math.abs(shadow.position.y-pressFloorRise(camera.z)-.015)<1e-8,'camera contact lies on the raised platform');
 }
});

test('contact shadows honour each opacity while reusing textures and same-opacity materials',()=>{
 const root=new THREE.Group(),dim=contactShadow(root,1,1,0,0,0,.24),normal=contactShadow(root,1,1,0,0,0),repeat=contactShadow(root,2,2,1,0,0,.24);
 assert.equal(dim.material.opacity,.24);assert.equal(normal.material.opacity,.34);assert.notEqual(dim.material,normal.material);assert.equal(dim.material,repeat.material);assert.equal(dim.material.map,normal.material.map);assert.equal(dim.material.depthWrite,false);
});
