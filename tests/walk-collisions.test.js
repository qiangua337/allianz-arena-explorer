import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
// Rendering is verified in the browser. This canvas stub lets the actual
// scene builders supply their collision geometry to the walking regression.
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={body:{dataset:{}},getElementById:()=>({hidden:true,style:{},classList:{toggle(){}},focus(){}}),createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener:()=>{},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');
const {buildStadium}=await import('../dist/stadium.js');
const {buildInteriors,roomSpecs}=await import('../dist/interiors.js');
const {buildWalkBuilding}=await import('../dist/walk-building.js');
const {buildWorld}=await import('../dist/world.js');
const {tourGoals,tourNodes,planTour}=await import('../dist/tour-route.js');
const {floorHeight,hitsWall}=await import('../dist/navigation.js');
const {buildInteractions}=await import('../dist/interactions.js');
const {furnitureBlocksSegment}=await import('../dist/furniture-layout.js');
const {buildWalkGuide}=await import('../dist/walk-guide.js');
const {planWalkPath,navigationObstacles,walkSegmentClear,routeOnCurrentLevel}=await import('../dist/walk-path.js');
const {destinationArrival}=await import('../dist/arrivals.js');
const {canStandAt}=await import('../dist/navigation.js');
const {advanceWalker}=await import('../dist/walk-motion.js');
await loadBrandAssets();const scene=new THREE.Scene(),world=buildWorld(scene),stadium=buildStadium(scene),interiors=buildInteriors(scene,stadium.circulation),building=buildWalkBuilding(scene),geometry={rooms:roomSpecs,tiers:stadium.tiers};
const obstacleGroups={world:world.colliders,building:building.colliders,interiors:interiors.colliders,circulation:stadium.circulation.colliders};
test('real room walls, fixtures and handrails leave all advertised routes clear',()=>{
 for(const goal of Object.keys(tourGoals)){
  const path=planTour(tourNodes.entrance,goal);let feet=path[0].y;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.15);
   for(let j=1;j<=steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;feet=floorHeight(x,z,feet,geometry);const eye=feet+1.7;
    const list=[...world.colliders,...stadium.circulation.colliders,...interiors.colliders,...building.colliders];
    assert.equal(hitsWall(x,z,eye,list),false,`${goal}: ${a.id} → ${b.id} blocked at ${x.toFixed(2)},${z.toFixed(2)} floor ${feet.toFixed(2)}`);
   }
  }
 }
});
test('automatic doors physically open for a nearby walker, then close after departure',()=>{
 const interactions=buildInteractions(scene,interiors,{toast(){},showInfo(){},setEye(){}});
 for(const[id,s]of Object.entries(roomSpecs)){
  const x=s.x+s.w/2,z=id==='lounge'?-10.5:s.z,near=new THREE.Vector3(x+2,s.y+1.7,z);
  for(let i=0;i<20;i++)interactions.update(near,.025,'walk');
  assert.equal(hitsWall(x,z,s.y+1.7,interactions.colliders),false,id+' opens');
  for(let i=0;i<40;i++)interactions.update(new THREE.Vector3(300,100,300),.025,'walk');
  assert.equal(hitsWall(x,z,s.y+1.7,interactions.colliders),true,id+' closes');
 }
});

test('routes from inside rooms use the door and avoid preparation tables, racks, cases and chairs',()=>{
 const examples=[
  ['homeRoom',[-88,-86,-82,-78,-74],[-7,-4,-2,2,4,7],'homeDoor'],
  ['guestRoom',[-88,-86,-82,-78,-74],[21,24,26,30,32,35],'guestRoomDoor'],
  ['museum',[-101.7,-98,-96,-94,-90],[47.5,50,52.7,58,63.3,68.6],'museumDoor'],
  ['store',[-10.1,0,10.4],[112.5,116.55,119.65,122.8],'storeDoor'],
  ['press',[-91,-82,-72.8],[-33.4,-29,-26,-23.2],'pressDoor']
 ];
 // The exterior circulation group is hidden while inside a room, just as in app.js.
 const walls=[...world.colliders,...interiors.colliders,...building.colliders];let checked=0;
 for(const [room,xs,zs,door]of examples)for(const x of xs)for(const z of zs){
  const spec=roomSpecs[room],p={x,y:spec.y,z};p.y=floorHeight(x,z,p.y,geometry);if(hitsWall(x,z,p.y+1.7,walls)||furnitureBlocksSegment(p,p,room))continue;
  const route=planTour(p,'entrance');assert.ok(route.findIndex(n=>n.id===door)>=0,room+' must exit through its door');assert.ok(route[0].id.startsWith(room)||route[0].id===door,room+' starts in the room');
  let a=p,feet=p.y;for(const b of route){const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.13);for(let j=1;j<=steps;j++){const t=j/steps,xx=a.x+(b.x-a.x)*t,zz=a.z+(b.z-a.z)*t;feet=floorHeight(xx,zz,feet,geometry);assert.equal(hitsWall(xx,zz,feet+1.7,walls),false,`${room} from ${x},${z}: ${a.id||'start'} → ${b.id} blocked at ${xx.toFixed(2)},${zz.toFixed(2)}`);}a=b;if(b.id===door)break;}checked++;
 }
 assert.ok(checked>80,'many free positions, not only the preset viewpoint');
});

test('arrival stays complete while exploring; selecting a new destination resumes navigation',()=>{
 const guide=buildWalkGuide(scene,geometry,{obstacles:obstacleGroups}),at=new THREE.Vector3(-76,-1,0);
 guide.setGoal('homeRoom',at);guide.update(at,0,.2,'walk');assert.equal(guide.getRoute().length,0);
 const exploring=new THREE.Vector3(-88,-1,7);guide.update(exploring,0,2.5,'walk');assert.equal(guide.getRoute().length,0);
 guide.setGoal('entrance',exploring);guide.update(exploring,0,.2,'walk');assert.ok(guide.getRoute().length>1);assert.ok(guide.getRoute().some(n=>n.id==='homeDoor'));
 const start={x:exploring.x,y:exploring.y-1.7,z:exploring.z};assert.equal(walkSegmentClear(start,guide.getRoute()[0],geometry,navigationObstacles(start,obstacleGroups)),true,'the next instruction uses a clear aisle from the actual position');
});

test('the overlapping public ring cannot render through a private room or raise its floor',()=>{
 for(const key of ['store','museum']){const s=roomSpecs[key],p=new THREE.Vector3(s.x,s.y+1.7,s.z);interiors.update(p,key);assert.equal(interiors.rooms[key].visible,true);assert.equal(interiors.rooms.concourse.visible,false);assert.equal(floorHeight(s.x,s.z,s.y,geometry),s.y);}
 interiors.update(new THREE.Vector3(94,13.9,-47),'concourse');assert.equal(interiors.rooms.concourse.visible,true);
});

test('museum guidance joins a walkable route from either side of the reception kiosk and counters',()=>{
 const samples=[[6.082,109.726],[0,113],[2,110],[6,110],[4,113],[4,106],[8,111],[-8,111],[-8,104],[8,104],[-5,108],[11,108],[0,118]];
 for(const[x,z]of samples){const p={x,y:-2.9,z},walls=navigationObstacles(p,obstacleGroups);if(hitsWall(x,z,-1.2,walls))continue;
  const result=planWalkPath(p,'museum',geometry,obstacleGroups);assert.equal(result.blocked,false,`route from ${x},${z}`);assert.equal(result.path.at(-1).id,'museum');
  let a=p;for(const b of result.path){assert.equal(walkSegmentClear(a,b,geometry,navigationObstacles(a,obstacleGroups)),true,`${x},${z}: ${a.id||'visitor'} → ${b.id} must avoid actual fixtures and height jumps`);a=b;}
 }
});

test('all teleport arrivals stand on the correct floor and outside walls and furniture',()=>{
 for(const id of Object.keys(tourGoals)){
  const at=destinationArrival(id,geometry),[x,y,z]=at.position,p={x,y:at.feet,z},walls=navigationObstacles(p,obstacleGroups);
  assert.equal(canStandAt(x,z,at.feet,geometry),true,id+' has a floor');assert.equal(hitsWall(x,z,y,walls),false,id+' is outside walls');
  const room=Object.keys(roomSpecs).find(key=>key===id);if(room)assert.equal(furnitureBlocksSegment(p,p,room),false,id+' is outside furniture');
  assert.ok(Math.abs(floorHeight(x,z,at.feet,geometry)-at.feet)<.01,id+' stays on arrival floor');
 }
});

test('every selectable arrival can resume walking toward every other destination',()=>{
 for(const source of Object.keys(tourGoals).filter(id=>id!=='exterior'))for(const target of Object.keys(tourGoals).filter(id=>id!=='exterior')){
  const a=destinationArrival(source,geometry),p={x:a.position[0],y:a.feet,z:a.position[2]},result=planWalkPath(p,target,geometry,obstacleGroups);
  assert.equal(result.blocked,false,source+' → '+target+' finds a route');assert.equal(result.path.at(-1).id,target);
  assert.equal(walkSegmentClear(p,result.path[0],geometry,navigationObstacles(p,obstacleGroups)),true,source+' → '+target+' has a clear first connector');
 }
});

test('the map stops at the next floor transition instead of overlaying the upper loop',()=>{
 const path=planTour(tourNodes.reception,'museum'),lower=routeOnCurrentLevel(path,-2.9);
 assert.ok(lower.length>3);assert.ok(lower.length<path.length);assert.ok(lower.every(p=>Math.abs(p.y+2.9)<=1.1));assert.equal(lower.some(p=>p.id==='museum'),false);
});

test('sprinting at four frames per second climbs the complete indoor staircase without dropping a storey',()=>{
 const targets=['flight0Out','flight0Turn','flight0End','landing1','flight1Start','flight1Out','flight1Turn','flight1End','landing2','flight2Start','flight2Out','flight2Turn','flight2End','landing3'].map(id=>tourNodes[id]);
 const p={x:100,z:-8.1};let feet=-2.9;
 for(const target of targets){for(let frame=0;frame<100;frame++){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.02)break;const stride=Math.min(2.5,d),old=feet;feet=advanceWalker(p,feet,dx/d*stride,dz/d*stride,geometry,(x,z,eye)=>hitsWall(x,z,eye,[...world.colliders,...building.colliders,...interiors.colliders,...stadium.circulation.colliders]));assert.ok(feet>=old-.4,'ascending cannot drop back to the lower floor');}
  assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.05,target.id+' physically reachable');assert.ok(Math.abs(feet-target.y)<.4,target.id+' has the correct storey');
 }
 assert.equal(feet,40);
 for(const target of [tourNodes.flight2End,...targets.slice(0,-1).reverse(),tourNodes.flight0Start]){
  for(let frame=0;frame<100;frame++){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.02)break;const stride=Math.min(2.5,d);feet=advanceWalker(p,feet,dx/d*stride,dz/d*stride,geometry,(x,z,eye)=>hitsWall(x,z,eye,[...world.colliders,...building.colliders,...interiors.colliders,...stadium.circulation.colliders]));}
  assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.05,target.id+' reachable on return');assert.ok(Math.abs(feet-target.y)<.4,target.id+' returns on the correct floor');
 }
 assert.equal(feet,-2.9);
});
