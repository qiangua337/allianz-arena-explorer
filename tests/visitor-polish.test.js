import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {partitionGeometry,spatializeArchitecture,facadeSectorVisible,updateArchitectureSectors}=await import('../dist/spatial-batches.js');
const {applyArchitecturalUV}=await import('../dist/surface-finishes.js');
const {walkingTours,createWalkingTour,routeSummary}=await import('../dist/walk-tours.js');
const {createWalkCheckpoint,safeCheckpointFloor}=await import('../dist/walk-checkpoint.js');
const {floorHeight}=await import('../dist/navigation.js');
const {loadVisitorSettings,saveVisitorSettings,qualityProfile}=await import('../dist/visitor-settings.js');
const {smoothWalkInput}=await import('../dist/walk-smoothing.js');
const {walkSpeed}=await import('../dist/walk-motion.js');
const {tourGoals}=await import('../dist/tour-route.js');
const {createWalkFrameRate}=await import('../dist/walk-frame-rate.js');
const {createFramePacer,WALK_FRAME_SLACK}=await import('../dist/frame-pacing.js');

test('sector batching preserves every triangle, secondary UVs and indexed vertex reuse',()=>{
 const geometry=new THREE.TorusGeometry(110,2,8,128);geometry.rotateX(Math.PI/2);geometry.setAttribute('uv1',geometry.attributes.uv.clone());const chunks=partitionGeometry(geometry);
 assert.ok(chunks.length>=12);assert.equal(chunks.reduce((n,p)=>n+p.geometry.index.count,0),geometry.index.count);
 for(const p of chunks){assert.equal(p.geometry.attributes.uv1.count,p.geometry.attributes.position.count);assert.ok(p.geometry.attributes.position.count<p.geometry.index.count);for(const value of p.geometry.attributes.position.array)assert.ok(Number.isFinite(value));}
});
test('spatial batching retains controlled roofs and object placement',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),g=new THREE.TorusGeometry(100,2,8,256),floor=new THREE.Mesh(g,material),roof=new THREE.Mesh(g.clone(),material);floor.position.y=12;roof.position.y=17;roof.userData.visibilityManaged=true;root.add(floor,roof);spatializeArchitecture(root);assert.equal(roof.parent,root);assert.ok(root.children.length>3);roof.visible=false;assert.equal(roof.visible,false);assert.ok(root.children.filter(c=>c!==roof).every(c=>c.position.y===12));
});
test('the opaque far facade can be omitted outside but remains complete from inside and above',()=>{
 assert.equal(facadeSectorVisible({x:0,y:2,z:214},{x:0,z:129}),true);assert.equal(facadeSectorVisible({x:0,y:2,z:214},{x:0,z:-129}),false);assert.equal(facadeSectorVisible({x:0,y:2,z:0},{x:0,z:-129}),true);assert.equal(facadeSectorVisible({x:0,y:150,z:214},{x:0,z:-129}),true);
 for(const axis of ['x','z'])for(const sign of [-1,1]){const part={visible:true,userData:{sectorCenter:{x:0,z:0,[axis]:-sign*129}}},root={userData:{spatialParts:[part]}};updateArchitectureSectors(root,{x:0,z:0,y:2,[axis]:sign*214});assert.equal(part.visible,false);updateArchitectureSectors(root,{x:0,z:0,y:2});assert.equal(part.visible,true);}
});
test('world-scale material UVs leave the existing sign and clothing coordinates intact',()=>{
 const root=new THREE.Group(),texture=new THREE.Texture();texture.channel=1;const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,.2,4),new THREE.MeshStandardMaterial({map:texture}));mesh.position.set(10,2,20);root.add(mesh);const original=Array.from(mesh.geometry.attributes.uv.array);applyArchitecturalUV(root);assert.deepEqual(Array.from(mesh.geometry.attributes.uv.array),original);const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv1;for(let i=0;i<p.count;i++)if(n.getY(i)>.9){assert.equal(uv.getX(i),p.getX(i)+10);assert.equal(uv.getY(i),p.getZ(i)+20);}
});
test('guided walks only advance after the selected stop is reached and finish cleanly',()=>{
 for(const plan of walkingTours){assert.ok(plan.stops.every(id=>tourGoals[id]));const tour=createWalkingTour();tour.start(plan.id);assert.equal(tour.next(),null);for(let i=0;i<plan.stops.length;i++){assert.equal(tour.update('entrance',true).arrived,false);assert.equal(tour.update(plan.stops[i],false).arrived,false);assert.equal(tour.update(plan.stops[i],true).arrived,true);assert.equal(tour.next(),plan.stops[i+1]??null);}assert.equal(tour.state(),null);}
});
test('a side trip or reload retains the selected tour stop without advancing it',()=>{
 const tour=createWalkingTour();
 tour.start('firstVisit');
 tour.update('arcade',true);
 assert.equal(tour.next(),'concourse');
 assert.equal(tour.update('museum',true).arrived,false);
 const restored=createWalkingTour();
 restored.restore(tour.snapshot());
 assert.equal(restored.state().goal,'concourse');
 assert.equal(restored.next(),null);
 restored.update('concourse',true);
 assert.equal(restored.next(),'lowerStands');
 restored.restore({id:'firstVisit',index:100});
 assert.equal(restored.state(),null);
});
test('same-tab walk checkpoints match the intended place and refuse stale or obstructed positions',()=>{
 let payload,writes=0;
 const storage={setItem(_key,data){payload=data;writes++;},getItem(){return payload;}};
 const geometry={tiers:[],rooms:{}},feet=floorHeight(0,214,-4,geometry);
 const point={place:'arcade',x:0,z:214,feet,yaw:8*Math.PI,pitch:.2,guide:{arrived:false,collapsed:false},tour:{id:'firstVisit',index:0}};
 const session=createWalkCheckpoint(storage);
 session.save(point);session.save(point);
 assert.equal(writes,1);
 assert.equal(session.load('museum'),null);
 const restored=createWalkCheckpoint(storage).load('arcade');
 assert.equal(restored.collapsed,false);
 assert.ok(Math.abs(restored.yaw)<.001);
 assert.equal(safeCheckpointFloor(restored,geometry,()=>false),feet);
 assert.equal(safeCheckpointFloor(restored,geometry,()=>true),null);
 assert.equal(safeCheckpointFloor({...restored,feet:20},geometry,()=>false),null);
 payload='{"place":"arcade","x":"NaN"}';
 assert.equal(session.load('arcade'),null);
});
test('remaining distance includes vertical stairs and an empty route is zero',()=>{
 assert.deepEqual(routeSummary({x:0,y:0,z:0},[]),{metres:0,seconds:0});assert.equal(routeSummary({x:0,y:0,z:0},[{x:3,y:4,z:0},{x:6,y:4,z:4}]).metres,10);
});
test('movement easing is independent of frame rate and releases without sliding',()=>{
 const a={x:0,z:0},b={x:0,z:0};for(let i=0;i<10;i++)smoothWalkInput(a,1,1,.01);smoothWalkInput(b,1,1,.1);assert.ok(Math.abs(a.x-b.x)<1e-10);assert.ok(Math.hypot(a.x,a.z)<=1);smoothWalkInput(a,0,0,.016);assert.deepEqual(a,{x:0,z:0});
});
test('touch sprint slows for the interior stairs and tight gallery, then returns to plaza pace',()=>{
 for(const [x,y,z] of [[100,4.65,7],[103,31.8,8],[101.2,38.42,-36.5],[106,40,-24],[100,37.44,-35.16]]){
  assert.equal(walkSpeed(true,true,x,y,z),6);
  assert.equal(walkSpeed(false,true,x,y,z),4.5);
  assert.equal(walkSpeed(true,false,x,y,z),10);
 }
 assert.equal(walkSpeed(true,true,0,-4.1,214),10);
 assert.equal(walkSpeed(true,true,106,12.2,-24),10);
});
test('quality preferences tolerate unavailable storage and cap mobile rendering work',()=>{
 assert.equal(loadVisitorSettings({getItem(){throw Error();}}).quality,'standard');assert.equal(loadVisitorSettings({getItem:()=>'{bad'}).quality,'standard');let saved;saveVisitorSettings({setItem:(k,v)=>saved=v},{quality:'low'});assert.equal(loadVisitorSettings({getItem:()=>saved}).quality,'low');assert.equal(qualityProfile('low',390,844,3).shadows,false);assert.equal(qualityProfile('low',390,844,3).grass,0);assert.ok(qualityProfile('standard',390,844,3).pixelRatio<=1);assert.equal(qualityProfile('high',1280,720,2).shadows,true);
});
test('match frame preference keeps the previous quality and defaults older saves to 60 FPS',()=>{
 let saved='{"quality":"high"}';
 const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 assert.deepEqual(loadVisitorSettings(storage),{quality:'high',matchFps:60});
 saveVisitorSettings(storage,{...loadVisitorSettings(storage),matchFps:120});
 saveVisitorSettings(storage,{...loadVisitorSettings(storage),quality:'low'});
 assert.deepEqual(loadVisitorSettings(storage),{quality:'low',matchFps:120});
});

test('walk rendering follows ordinary mobile display jitter and adapts only during sustained motion',()=>{
 const pacer=createFramePacer();
 const draws=[];
 for(let i=0;i<600;i++){
  const time=i/60+(i%2===0?.0007:-.0007);
  if(pacer.ready(time,60,WALK_FRAME_SLACK))draws.push(time);
 }
 assert.equal(draws.length,600);
 const budget=createWalkFrameRate();
 const sample=(fps,seconds,active=true)=>{
  let scale;
  for(let i=0;i<fps*seconds;i++)scale=budget.update(1/fps,active);
  return scale;
 };
 assert.equal(sample(30,4,false),1,'an idle view must keep its pixel budget');
 assert.equal(sample(60,2),1);
 assert.equal(sample(30,4),.70,'sustained slow frames reduce pixel work even if callback rate halves');
 assert.equal(sample(60,2),.70,'short recovery does not immediately raise the pixel load');
 assert.ok(sample(60,7)>.70);
 assert.equal(budget.reset(),1);
});
