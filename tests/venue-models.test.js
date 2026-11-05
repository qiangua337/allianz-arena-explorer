import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {shellProfileSampler,buildPressSeat,buildPressSeatInstances,ribbonPanelGeometry,seatingDetail,buildRoofLining}=await import('../dist/venue-models.js');
const {footballPanelGeometry}=await import('../dist/football-ball.js');

test('the smoothed ETFE profile stays within the measured envelope and retains a continuous roof opening',()=>{
 const sample=shellProfileSampler([[.885,5.8],[.948,10.2],[.985,18.5],[1,27],[.99,35.5],[.947,42.6],[.874,48.7],[.779,51.4],[.686,50.3],[.589,47.8]]);let before=sample(0);
 for(let i=1;i<=4096;i++){const p=sample(i/4096);assert.ok(p.r>=.589&&p.r<=1&&p.y>=5.8&&p.y<=51.4);assert.ok(Math.abs(p.r-before.r)<.002&&Math.abs(p.y-before.y)<.04);before=p;}assert.ok(Math.abs(sample(1).r-.589)<1e-12&&Math.abs(sample(1).y-47.8)<1e-12);
});
test('a curved press chair fits the existing walking clearance, has a central base and reuses its moulded geometry',()=>{
 const parent=new THREE.Group(),m=new THREE.MeshStandardMaterial(),a=buildPressSeat(parent,{upholstery:m,metal:m}),b=buildPressSeat(parent,{x:1,upholstery:m,metal:m});parent.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(a),size=bounds.getSize(new THREE.Vector3());assert.ok(size.x<=.72&&size.z<=.74&&size.y<=1.3);assert.ok(bounds.min.y>=0);assert.equal(a.children[0].geometry,b.children[0].geometry);assert.equal(a.children.filter(o=>o.geometry.type==='CylinderGeometry').length,3);
});
test('180 press chairs retain one copy of each mesh with only two instanced draws and exact seating positions',()=>{
 const parent=new THREE.Group(),m=new THREE.MeshStandardMaterial(),seats=Array.from({length:180},(_,i)=>({x:i%20*.8,y:Math.floor(i/20)*.095,z:Math.floor(i/20)*1.05,width:.58})),parts=buildPressSeatInstances(parent,seats,{upholstery:m,metal:m}),matrix=new THREE.Matrix4(),point=new THREE.Vector3();assert.equal(parts.length,2);for(const part of parts){assert.ok(part.isInstancedMesh);assert.equal(part.count,180);for(const i of [0,19,179]){part.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.ok(Math.abs(point.x-seats[i].x)<1e-5&&Math.abs(point.z-seats[i].z)<1e-5);}}
});
test('mobile low quality and ordinary tunnel views keep the whole crowd bowl on the inexpensive seating mesh',()=>{
 for(const distance of [10,50,200]){assert.equal(seatingDetail({distance,low:true,high:true}),'far');assert.equal(seatingDetail({distance,tunnel:true}),'far');assert.equal(seatingDetail({distance,playing:true}),'far');}assert.equal(seatingDetail({distance:10}),'curved');assert.equal(seatingDetail({distance:50}),'coarse');assert.equal(seatingDetail({distance:20,high:true,tunnel:true}),'curved');
});
test('the folded red wall and desk panels have bounded geometry and outward faces, rather than crossing door openings',()=>{
 for(const [w,h]of [[25.5,2.1],[14.9,.85]]){const g=ribbonPanelGeometry(w,h),p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getX(i))<=w/2+1e-5&&Math.abs(p.getY(i))<=h/2+1e-5);assert.ok(p.getZ(i)>=0&&p.getZ(i)<=.00801);assert.ok(n.getZ(i)>=0);}}
});
test('the football has twelve pentagons, twenty hexagons and a round 22 cm envelope with outward panel faces',()=>{
 const g=footballPanelGeometry(),p=g.attributes.position;assert.deepEqual(g.userData.panels,{pentagons:12,hexagons:20});const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);for(const v of [a,b,c])assert.ok(Math.abs(v.length()-.11)<1e-7);n.copy(b).sub(a).cross(c.clone().sub(a));assert.ok(n.dot(a)>0);}assert.ok(p.count/3<3500,'one small detailed ball stays inexpensive');
});
test('the independent inner canopy leaves the pitch opening empty and adds one bounded mesh',()=>{
 const previous=globalThis.document,ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{const root=new THREE.Group(),lining=buildRoofLining(root,(u,w)=>new THREE.Vector3((113.5-(w-.49)/.51*46.7)*Math.cos(u*Math.PI*2),48, (129-(w-.49)/.51*51.2)*Math.sin(u*Math.PI*2))),p=lining.geometry.attributes.position;assert.equal(root.children.length,1);assert.ok(lining.geometry.index.count/3<11000);for(let i=0;i<p.count;i++){assert.ok(p.getX(i)**2/66.7**2+p.getZ(i)**2/77.7**2>1);assert.ok(Math.abs(p.getY(i)-47.8)<1e-4);}}finally{globalThis.document=previous;}
});
