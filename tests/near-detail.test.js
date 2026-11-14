import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE,mergeGeometry}=await import('../dist/kit.js');
const {cushionGeometry}=await import('../dist/upholstery.js');
const {hangingJerseyGeometry}=await import('../dist/wardrobe-detail.js');
const {createSeatIndex,detailedSeatGeometry,buildNearSeatDetails}=await import('../dist/near-seat-details.js');
const {buildBucketSeat}=await import('../dist/facility-equipment.js');
const {accessRingGeometry}=await import('../dist/circulation.js');
const {pressSeats,furnitureBlocksSegment}=await import('../dist/furniture-layout.js');

test('static merges retain fabric UVs and normalized colors even when another mesh has no secondary UVs',()=>{
 const a=new THREE.PlaneGeometry(1,1);a.setAttribute('uv2',a.attributes.uv.clone());a.setAttribute('color',new THREE.Uint8BufferAttribute(Array(a.attributes.position.count).fill([255,128,0]).flat(),3,true));const b=new THREE.BoxGeometry(),g=mergeGeometry([a,b]);
 assert.equal(g.attributes.uv2.count,g.attributes.position.count);assert.equal(g.attributes.color.count,g.attributes.position.count);assert.equal(g.attributes.color.getX(0),1);assert.ok(Math.abs(g.attributes.color.getY(0)-128/255)<1e-6);assert.equal(g.attributes.color.getX(g.attributes.position.count-1),1);assert.deepEqual(Array.from(g.attributes.uv2.array.slice(0,12)),Array.from(a.toNonIndexed().attributes.uv2.array));
});
test('padded cushions have a curved crown, shared geometry and finite smooth normals',()=>{
 const g=cushionGeometry(.58,.65,.13);assert.equal(cushionGeometry(.58,.65,.13),g);assert.ok(g.boundingBox.max.z>.065);assert.ok(Math.abs(g.boundingBox.max.x-.29)<1e-6);
 const n=g.attributes.normal;for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(Number.isFinite(length)&&Math.abs(length-1)<1e-5);}
});
test('hanging cloth keeps its weave coordinates independent of the printed atlas and in front of the shirt body',()=>{
 const g=hangingJerseyGeometry(),before=Array.from(g.attributes.uv2.array),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.1+.2,uv.getY(i)*.1+.3);const merged=mergeGeometry([g]);assert.deepEqual(Array.from(merged.attributes.uv2.array),Array.from(g.toNonIndexed().attributes.uv2.array));assert.deepEqual(Array.from(g.attributes.uv2.array),before);
 const p=g.attributes.position;for(let i=0;i<p.count;i++)assert.ok(p.getZ(i)+.066>.030);
});
test('the limited seat patch replaces every seat inside its clip sphere, including cell boundaries and negative coordinates',()=>{
 const seats=[];for(let x=-15;x<=15;x+=.5)for(let z=-15;z<=15;z+=.76)seats.push({x,y:.19+Math.abs(z)*.3,z,yaw:0,color:0xb51d34});const index=createSeatIndex(seats);
 for(const p of[{x:0,y:1.7,z:0},{x:-8.01,y:3,z:-7.99},{x:7.99,y:2,z:8.01}])for(const capacity of[64,128,192]){const result=index.query(p,6,capacity),expected=seats.filter(s=>Math.hypot(s.x-p.x,s.y-p.y,s.z-p.z)<result.radius);assert.ok(result.seats.length<=capacity);assert.deepEqual(new Set(result.seats),new Set(expected));}
});
test('detailed seat shells are closed volumes and the fixed two-mesh patch clears when disabled',()=>{
 const geometry=detailedSeatGeometry();for(const g of Object.values(geometry)){g.computeBoundingBox();for(const value of g.attributes.position.array)assert.ok(Number.isFinite(value));assert.ok(g.boundingBox.max.y>.2);}assert.ok(geometry.frame.boundingBox.min.y>=-.19);const edges=new Map(),p=geometry.shell.attributes.position;for(let i=0;i<p.count;i+=3){const keys=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].map(n=>n.toFixed(6)).join(','));for(let j=0;j<3;j++){const key=[keys[j],keys[(j+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}}assert.ok([...edges.values()].every(n=>n===2));
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),seats=[{x:1,y:.19,z:1,yaw:.5,color:0xff0000}],patch=buildNearSeatDetails(root,seats,material);patch.update(new THREE.Vector3(1,1.7,1));assert.equal(patch.count,1);const children=root.children.slice();patch.update(new THREE.Vector3(1.01,1.7,1));assert.deepEqual(root.children,children);patch.update(new THREE.Vector3(1,1.7,1),false);assert.equal(patch.count,0);assert.ok(root.children.every(o=>!o.visible));
});
test('the phone seat patch keeps its occupied seats and culling bounds while using fewer triangles and uploads',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),s={x:1,y:.19,z:1,yaw:.5,color:0xff0000};
 const patch=buildNearSeatDetails(root,[s],material),p=new THREE.Vector3(1,1.7,1);
 patch.update(p);
 const [shell,frame]=root.children,original=shell.geometry,version=shell.instanceMatrix.version;
 patch.update(new THREE.Vector3(1.5,1.7,1),true,192,true);
 assert.equal(patch.count,1);
 assert.equal(shell.instanceMatrix.version,version);
 assert.ok(shell.geometry.attributes.position.count<original.attributes.position.count*.4);
 for(const m of [shell,frame]){
  const transform=new THREE.Matrix4();m.getMatrixAt(0,transform);
  const vertices=m.geometry.attributes.position;
  for(let i=0;i<vertices.count;i++)assert.ok(m.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(transform)));
 }
 patch.update(p,false);patch.update(p);
 assert.equal(shell.geometry,original);assert.equal(shell.instanceMatrix.version,version);assert.equal(patch.count,1);
});
test('distant dugout seats preserve the contour, arm arrangement and placement at lower cost',()=>{
 const parent=new THREE.Group(),materials=Object.fromEntries(['red','metal','dark'].map(name=>[name,new THREE.MeshStandardMaterial()]));
 const options={...materials,x:2,y:.4,z:4.5,yaw:Math.PI/2,crest:false};
 const close=buildBucketSeat(parent,options),far=buildBucketSeat(parent,{...options,compact:true});
 assert.ok(far.position.equals(close.position));assert.equal(far.rotation.y,close.rotation.y);
 const triangles=group=>group.children.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
 assert.ok(triangles(far)<triangles(close)*.08);
 const detailed=new THREE.Box3().setFromObject(close),compact=new THREE.Box3().setFromObject(far);
 assert.ok(compact.min.distanceTo(detailed.min)<.1);assert.ok(compact.max.distanceTo(detailed.max)<.1);
});
test('uncut paving removes redundant flat triangles and retains metre UVs and the two boundaries',()=>{
 const bounds=[119,137,151,169],height=700;
 const paving=accessRingGeometry(...bounds,height,false),subdivided=accessRingGeometry(...bounds,height,true);
 paving.computeBoundingBox();subdivided.computeBoundingBox();
 assert.ok(paving.boundingBox.equals(subdivided.boundingBox));
 const area=geometry=>{
  const p=geometry.attributes.position;let a=0;
  for(let i=0;i<p.count;i+=3){
   const dx=p.getX(i+1)-p.getX(i),dz=p.getZ(i+1)-p.getZ(i);
   a+=Math.abs(dx*(p.getZ(i+2)-p.getZ(i))-dz*(p.getX(i+2)-p.getX(i)))/2;
  }
  return a;
 };
 // The same flat footprint triangulated without any interior radial edges.
 assert.equal(paving.attributes.position.count*16,subdivided.attributes.position.count);
 assert.ok(Math.abs(area(paving)-area(subdivided))<.001);
 const {position:p,uv,normal}=paving.attributes;
 for(let i=0;i<p.count;i++){
  assert.ok(Math.abs(p.getX(i)/12-uv.getX(i))<1e-6);
  assert.ok(Math.abs(p.getZ(i)/12-uv.getY(i))<1e-6);
  assert.equal(normal.getY(i),1);
 }
});
test('the resized press seating leaves the centre and both side aisles open along the full room',()=>{
 assert.equal(pressSeats.length,180);for(const x of[-91,-82,-72.8])assert.equal(furnitureBlocksSegment({x,z:-33.4},{x,z:-23.2},'press'),false);
 for(let i=0;i<pressSeats.length;i++)for(let j=i+1;j<pressSeats.length;j++)if(pressSeats[i].z===pressSeats[j].z)assert.ok(Math.abs(pressSeats[i].x-pressSeats[j].x)>.72);
});
