import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
function canvas(){const image={width:0,height:0},context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),fillText:text=>{image.lastText=text;}},{get:(o,k)=>k in o?o[k]:()=>{}});image.getContext=()=>context;return image;}
globalThis.document={createElement:canvas,createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE,loadBrandAssets}=await import('../dist/kit.js');
const {buildStadium}=await import('../dist/stadium.js');
const {buildInteriors}=await import('../dist/interiors.js');
const {buildWalkBuilding}=await import('../dist/walk-building.js');
const {buildServiceRooms}=await import('../dist/service-rooms.js');
const {serviceWorld}=await import('../dist/service-layout.js');
await loadBrandAssets();const scene=new THREE.Scene(),stadium=buildStadium(scene),interiors=buildInteriors(scene,stadium.circulation),building=buildWalkBuilding(scene),service=buildServiceRooms(scene),camera=new THREE.PerspectiveCamera();
function trackVisible(root){let writes=0;root.traverse(o=>{let value=o.visible;Object.defineProperty(o,'visible',{configurable:true,get:()=>value,set:next=>{writes++;value=next;}});});return{count:()=>writes,reset(){writes=0;}};}
const tracker=trackVisible(scene),update=(mode='walk',high=false,low=false,playing=false)=>{stadium.update(camera,mode,high,low,playing);interiors.update(camera.position,'pitch');building.update(camera.position,mode);stadium.circulation.update(camera.position);service.update(camera.position,.016);};

test('stationary architectural updates skip repeated visibility work while preserving settings and movement changes',()=>{
 globalThis.innerWidth=390;camera.position.set(0,1.7,0);update();tracker.reset();
 for(let i=0;i<1000;i++){camera.rotation.y=i*.001;update();}
 assert.equal(tracker.count(),0,'turning in place does not reassign all static visibility');
 update('walk',false,true);assert.ok(tracker.count()>0,'quality changes immediately apply');assert.equal(stadium.root.getObjectByName('Nearby turf blades').visible,false);
 tracker.reset();update('walk',true,false);assert.ok(tracker.count()>0);assert.equal(stadium.root.getObjectByName('Nearby turf blades').visible,true);
 tracker.reset();globalThis.innerWidth=844;update('walk',true,false);assert.ok(tracker.count()>0,'viewport changes invalidate seat capacity');
 tracker.reset();update('walk',true,false,true);assert.ok(tracker.count()>0,'playing changes disable walking seat detail');assert.equal(stadium.detailSeatCount,0);
 tracker.reset();update('orbit',true,false,true);assert.ok(tracker.count()>0,'mode changes apply without movement');
 tracker.reset();camera.position.x+=1e-12;update('orbit',true,false,true);assert.ok(tracker.count()>0,'exact position changes cannot hide a threshold crossing');
 camera.position.set(-80,-1,5);update();assert.equal(stadium.bowl.visible,false);assert.equal(interiors.rooms.homeRoom.visible,true);
 camera.position.set(0,150,300);update('orbit');assert.equal(stadium.bowl.visible,true);assert.equal(interiors.rooms.homeRoom.visible,false);
 update('walk');assert.equal(building.root.visible,false);building.root.visible=true;update('walk');assert.equal(building.root.visible,false,'app may re-enable the root when leaving a match; cached distance visibility is still restored');
});

test('night lamps, animated service doors and minute clocks still update while the camera stays fixed',()=>{
 const lamps=[];stadium.circulation.root.traverse(o=>{if(o.isPointLight&&o.distance===33)lamps.push(o);});assert.equal(lamps.length,8);camera.position.copy(lamps[0].position);camera.position.y=1.7;stadium.circulation.night(false);update();assert.ok(lamps.every(l=>!l.visible));
 stadium.circulation.night(true);update();assert.ok(lamps.some(l=>l.visible),'night is a visibility input even without movement');
 const door=service.doors[0],p=serviceWorld(door,0,3);camera.position.set(p.x,door.y+1.7,p.z);update();service.toggle(door);update();const angle=door.angle;update();assert.ok(door.angle>angle,'only static visibility is cached, not animation');
 const maps=new Set();interiors.rooms.homeRoom.traverse(o=>{const material=o.material;for(const m of Array.isArray(material)?material:[material])if(m?.map?.image?.width===512&&m.map.image.height===160)maps.add(m.map);});assert.ok(maps.size>0,'actual changing-room clock texture');
 const before=[...maps].map(m=>m.version),now=Date.now;try{Date.now=()=>now()+120000;update();}finally{Date.now=now;}assert.ok([...maps].some((m,i)=>m.version>before[i]),'clock still paints after its minute changes');
});
