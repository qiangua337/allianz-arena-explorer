import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const labels=new Set();
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),fillText:text=>labels.add(text),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}}),nodes=new Map();
globalThis.document={body:{dataset:{}},getElementById:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,style:{},classList:{toggle(){}},focus(){}});return nodes.get(id);},createElement:()=>({getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');
const {buildWorld}=await import('../dist/world.js'),{buildStadium}=await import('../dist/stadium.js'),{buildInteriors,roomSpecs}=await import('../dist/interiors.js'),{buildWalkBuilding}=await import('../dist/walk-building.js'),{buildServiceRooms}=await import('../dist/service-rooms.js'),{buildInteractions}=await import('../dist/interactions.js'),{freezeArchitecture}=await import('../dist/scene-budget.js'),{buildFootballView}=await import('../dist/football-view.js');
await loadBrandAssets();const scene=new THREE.Scene(),world=buildWorld(scene),stadium=buildStadium(scene),interiors=buildInteriors(scene,stadium.circulation),building=buildWalkBuilding(scene),service=buildServiceRooms(scene),interactions=buildInteractions(scene,interiors,{toast(){},showInfo(){},serviceRooms:service,seats:stadium.seatPositions});
const fixedGroups=[[world.group,[world.rotor]],[stadium.root,[stadium.matchBall]],[stadium.circulation.root,[]],[interiors.root,[]],[building.root,[]]],serviceInteriors=service.root.children.filter(o=>o.matrixAutoUpdate===false);
function oldFreeze(group,exclude=[]){group.updateWorldMatrix(true,true);group.traverse(o=>{for(let p=o;p&&p!==group;p=p.parent)if(exclude.includes(p))return;o.updateMatrix();o.matrixAutoUpdate=false;});}
function configure(fn){scene.traverse(o=>o.matrixWorldAutoUpdate=true);for(const[g,excluded]of fixedGroups)fn(g,excluded);for(const g of serviceInteriors)fn(g);}
function countMultiplies(){const original=THREE.Matrix4.prototype.multiplyMatrices;let count=0;try{THREE.Matrix4.prototype.multiplyMatrices=function(...args){count++;return original.apply(this,args);};for(let i=0;i<6;i++)scene.updateMatrixWorld(true);}finally{THREE.Matrix4.prototype.multiplyMatrices=original;}return count;}

test('the real venue reuses fixed world matrices while forced scene updates still animate excluded subtrees',()=>{
 configure(oldFreeze);scene.updateMatrixWorld(true);const matrices=new Map();scene.traverse(o=>matrices.set(o,o.matrixWorld.clone()));const before=countMultiplies();configure(freezeArchitecture);const after=countMultiplies();assert.ok(after<before*.15,JSON.stringify({before,after}));
 for(const[o,m]of matrices)assert.deepEqual(o.matrixWorld.elements,m.elements,'the freeze itself cannot move '+o.name);
 const fixed=[...matrices].filter(([o])=>!o.matrixWorldAutoUpdate),rotor=world.rotor.children[0],oldRotor=rotor.matrixWorld.clone();world.rotor.rotation.z=.7;stadium.matchBall.position.set(8,1.25,-14);scene.updateMatrixWorld(true);
 assert.notDeepEqual(rotor.matrixWorld.elements,oldRotor.elements);assert.equal(world.rotor.matrixWorldAutoUpdate,true);assert.equal(stadium.matchBall.matrixWorldAutoUpdate,true);assert.deepEqual(stadium.matchBall.getWorldPosition(new THREE.Vector3()).toArray(),[8,1.25,-14]);
 for(const[o,m]of fixed)assert.deepEqual(o.matrixWorld.elements,m.elements,'moving the ball/rotor cannot change '+o.name);
});

test('live room doors, near-seat instances and player cues remain dynamic beside the frozen venue',()=>{
 configure(freezeArchitecture);const store=roomSpecs.store,hinge=scene.getObjectByName('store automatic door'),leaf=hinge.getObjectByName('Solid moving door leaf');scene.updateMatrixWorld(true);const closed=leaf.matrixWorld.clone(),position=new THREE.Vector3(store.x+store.w/2+1,store.y+1.7,store.z),camera=new THREE.PerspectiveCamera();camera.position.copy(position);camera.lookAt(store.x,position.y,store.z);
 for(let i=0;i<30;i++)interactions.update(position,1/30,'walk',camera);scene.updateMatrixWorld(true);assert.notDeepEqual(leaf.matrixWorld.elements,closed.elements);assert.equal(leaf.matrixWorldAutoUpdate,true);
 const door=service.doors[0],serviceLeaf=door.leaves[0].hinge,closedService=serviceLeaf.matrixWorld.clone();service.toggle(door);for(let i=0;i<30;i++)service.update({x:door.x+5,y:door.y+1.7,z:door.z},1/30);scene.updateMatrixWorld(true);assert.notDeepEqual(serviceLeaf.matrixWorld.elements,closedService.elements);assert.equal(serviceLeaf.matrixWorldAutoUpdate,true);
 camera.position.set(82.55,25.3,-30.1);stadium.update(camera,'walk',false,true,false);const near=scene.getObjectByName('Nearby moulded seating shells');assert.ok(near.count>0);const version=near.instanceMatrix.version;camera.position.z-=3;stadium.update(camera,'walk',false,true,false);assert.ok(near.instanceMatrix.version>version);assert.equal(near.matrixWorldAutoUpdate,false);
 const actors={root:new THREE.Group(),ready:true,updateMatch(){}},view=buildFootballView(scene,stadium.matchBall,actors),state={players:[{id:'p',team:'home',x:5,z:-8,yaw:1}],controlledId:'p',ball:{x:5,y:.11,z:-8,ownerId:'p'},phase:'playing'};scene.add(actors.root);view.setEnabled(true);view.update(state,1,camera.position);scene.updateMatrixWorld(true);const cue=view.root.getObjectByName('Controlled footballer');assert.deepEqual(cue.getWorldPosition(new THREE.Vector3()).toArray(),[5,.019,-8]);state.players[0].x=12;state.ball.x=12;view.update(state,1.1,camera.position);scene.updateMatrixWorld(true);assert.equal(cue.getWorldPosition(new THREE.Vector3()).x,12);assert.equal(actors.root.matrixWorldAutoUpdate,true);
});

test('a live match bypasses hidden exploration transforms without removing any rooms or suspending the ball',async()=>{
 const {suspendExplorationDuringMatch}=await import('../dist/scene-budget.js');
 const roots=[world.group,interiors.root,building.root,service.root,stadium.circulation.root];
 const setMatch=suspendExplorationDuringMatch(roots),oldPositions=roots.map(o=>o.parent),probes=[];
 for(const root of roots){const probe=new THREE.Object3D();root.add(probe);probes.push(probe);}
 const old=world.group.visible;world.group.visible=false;
 setMatch(true);for(const probe of probes)probe.position.x=5;
 stadium.matchBall.position.x=42;scene.updateMatrixWorld(true);
 assert.ok(probes.every(o=>o.matrixWorld.elements[12]===0));
 assert.ok(roots.every((o,i)=>!o.visible&&o.parent===oldPositions[i]));
 assert.equal(stadium.matchBall.matrixWorld.elements[12],42);
 setMatch(false);scene.updateMatrixWorld(true);
 assert.ok(probes.every(o=>o.matrixWorld.elements[12]===5));
 assert.equal(world.group.visible,false);world.group.visible=old;
});

test('the real entrance and concourse frusta reject most exterior tree geometry while keeping every tree',()=>{
 const belt=world.group.getObjectByName('Fröttmaning trees');
 const crowns=belt.children.filter(mesh=>mesh.castShadow);
 const trunks=belt.children.filter(mesh=>!mesh.castShadow);
 assert.equal(crowns.reduce((count,mesh)=>count+mesh.count,0),1070);
 assert.equal(trunks.reduce((count,mesh)=>count+mesh.count,0),1070);
 assert.ok(crowns.every(mesh=>mesh.instanceColor&&mesh.boundingSphere));
 assert.equal(new Set(crowns.map(mesh=>mesh.geometry)).size,1,'clusters share the same foliage geometry');
 const triangles=meshes=>meshes.reduce((total,mesh)=>total+mesh.count*(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0);
 const allTriangles=triangles(belt.children);
 for(const [position,target] of [[[0,-2.4,214],[0,0,174]],[[94,13.9,-47],[96,14,-12]]]){
  const camera=new THREE.PerspectiveCamera(66,390/844,.06,4500);
  camera.position.fromArray(position);camera.lookAt(...target);camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const visible=belt.children.filter(mesh=>frustum.intersectsObject(mesh));
  assert.ok(visible.length<=10&&triangles(visible)>0&&triangles(visible)<allTriangles*.30,'phone view keeps a tight draw and triangle budget');
 }
});

test('reception wayfinding faces the approach and return paths above walking headroom',()=>{
 const signs=stadium.circulation.root.getObjectByName('Reception junction wayfinding');
 const bounds=new THREE.Box3().setFromObject(signs);
 assert.ok(bounds.min.y>-2.9+2.7,'overhead signs leave more than 2.7 m clear');
 const approaches=[
  [[0,-1.2,121],[0,.85,108.88],[0,0,-1]],
  [[12,-1.2,113],[25.92,.85,113],[1,0,0]],
  [[32,-1.2,113],[26.08,.85,113],[-1,0,0]],
  [[22,-1.2,101],[22,.85,107.42],[0,0,1]]
 ];
 for(const [position,target,heading] of approaches){
  const camera=new THREE.PerspectiveCamera(66,390/844,.06,4500);
  camera.position.fromArray(position);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(...heading)));
  camera.updateMatrixWorld(true);
  const panel=new THREE.Vector3(...target);
  const projected=panel.clone().project(camera);
  assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,'the panel fits the walking view');
  const ray=new THREE.Raycaster(camera.position,panel.sub(camera.position).normalize());
  const hit=ray.intersectObject(stadium.circulation.root,true)[0];
  assert.equal(hit?.object.parent,signs,'the sign is visible without an obstruction from '+position.join(','));
 }
 for(const text of ['球场参观 →','← 球场参观','← 草坪参观','公共楼梯 ↑','接待大厅 →'])assert.ok(labels.has(text),text);
});
