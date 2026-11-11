import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {buildLightBudget}=await import('../dist/performance.js');
const {roomAmbientOcclusion,installInteriorShading}=await import('../dist/interior-shading.js');
const {lightingProfile,updateSceneLighting}=await import('../dist/lighting-profile.js');
const {buildBowlLighting}=await import('../dist/stadium-lighting.js');
const {buildNightGroundSpill}=await import('../dist/landscape-finishes.js');
const {compactStaticMeshes}=await import('../dist/scene-budget.js');
const {roomSpecs}=await import('../dist/building-layout.js');
const settle=(budget,position)=>{for(let i=0;i<150;i++)budget.update(position,1/60);};

test('room fixtures retain priority over a closer light across the wall; the corridor cannot borrow room lamps',()=>{
 const scene=new THREE.Scene();for(const[x,z]of[[-84,-3],[-84,3],[-71,0]]){const l=new THREE.PointLight(0xffeadd,80,30,2);l.position.set(x,1,z);scene.add(l);}
 const budget=buildLightBudget(scene);settle(budget,new THREE.Vector3(-73.6,-1,0));assert.equal(budget.lights.length,2);assert.ok(budget.lights.every(l=>Math.abs(l.position.x+84)<.001));
 settle(budget,new THREE.Vector3(-70,-1,0));assert.ok(Math.abs(budget.lights[0].position.x+71)<.001);assert.ok(budget.lights[1].intensity<.001);assert.equal(scene.children.filter(o=>o.isSpotLight).length,2);assert.ok(budget.lights.every(l=>l.target.position.y<l.position.y));
});

test('hidden fixtures fade out and changing rooms keeps the same two render lights',()=>{
 const scene=new THREE.Scene(),room=new THREE.Group(),lamp=new THREE.PointLight(0xffffff,60);lamp.position.set(-82,1,0);room.add(lamp);scene.add(room);const budget=buildLightBudget(scene),identities=budget.lights.slice(),p=new THREE.Vector3(-82,-1,0);assert.equal(budget.update(p,.016),true);settle(budget,p);room.visible=false;settle(budget,p);assert.ok(budget.lights.every(l=>l.intensity<.001));assert.deepEqual(budget.lights,identities);
});

test('the two nearest fixtures keep traversal-order ties and react to lamp and ancestor changes',()=>{
 const scene=new THREE.Scene(),room=new THREE.Group(),p=new THREE.Vector3(-82,-1,0),lamps=[];scene.add(room);
 for(const [x,z,color]of[[-84,0,0xff0000],[-80,0,0x00ff00],[-82,3,0x0000ff]]){const lamp=new THREE.PointLight(color,60,13,1.5);lamp.position.set(x,1,z);room.add(lamp);lamps.push(lamp);}
 const budget=buildLightBudget(scene);settle(budget,p);assert.ok(budget.lights[0].color.r>.999);assert.ok(budget.lights[1].color.g>.999,'equidistant lamps keep scene order');
 lamps[0].intensity=0;settle(budget,p);assert.ok(budget.lights[0].color.g>.999);assert.ok(budget.lights[1].color.b>.999);
 lamps[2].color.set(0xff00ff);lamps[2].distance=21;lamps[2].decay=2;settle(budget,p);assert.ok(budget.lights[1].color.r>.999);assert.equal(budget.lights[1].distance,21);assert.equal(budget.lights[1].decay,2);
 room.visible=false;settle(budget,p);assert.ok(budget.lights.every(l=>l.intensity<.001));room.visible=true;settle(budget,p);assert.ok(budget.lights.every(l=>l.intensity>59.99));
});

test('a dense room measures each fixture at most once when selecting its two render lights',()=>{
 const scene=new THREE.Scene(),count=32;for(let i=0;i<count;i++){const lamp=new THREE.PointLight(0xffffff,60);lamp.position.set(-88+i*.35,1,(i%5)-2);scene.add(lamp);}
 const budget=buildLightBudget(scene),original=THREE.Vector3.prototype.distanceToSquared;let distances=0;
 try{THREE.Vector3.prototype.distanceToSquared=function(p){distances++;return original.call(this,p);};budget.update(new THREE.Vector3(-82,-1,0),.25);}finally{THREE.Vector3.prototype.distanceToSquared=original;}
 assert.ok(distances<=count+2,'selection stays linear instead of repeatedly measuring the same candidates during sorting');assert.ok(budget.lights.every(l=>l.intensity>0));
});

test('room corner occlusion remains bounded, respects the actual floor and leaves outside surfaces alone',()=>{
 const s=roomSpecs.homeRoom,at=(x,y,z)=>roomAmbientOcclusion({x:s.x+x,y:s.y+y,z:s.z+z},s);
 assert.ok(at(s.w/2,0,s.d/2)<at(0,0,0));assert.ok(at(0,0,0)<at(0,2,0));assert.equal(at(s.w,0,0),1);assert.equal(at(0,9,0),1);
 for(let y=0;y<=4.5;y+=.1)for(let x=0;x<=s.w/2;x+=.25){const n=at(x,y,0);assert.ok(Number.isFinite(n)&&n>=.48&&n<=1);}
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();let prior=0;material.onBeforeCompile=()=>prior++;root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));installInteriorShading(root);const key=material.customProgramCacheKey();installInteriorShading(root);assert.equal(key,material.customProgramCacheKey());const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <aomap_fragment>'};material.onBeforeCompile(shader);assert.equal(prior,1);assert.ok(shader.vertexShader.includes('instanceMatrix*finishPosition'));
});

test('night lighting separates the exterior from the pitch and intensity transitions are independent of frame rate',()=>{
 const field=lightingProfile({night:true}),outside=lightingProfile({night:true,position:{x:0,y:0,z:214}}),day=lightingProfile();assert.ok(outside.key<field.key&&outside.hemi<field.hemi);assert.ok(day.key>field.key);assert.equal(lightingProfile({night:true,enclosed:true}).key,lightingProfile({night:false,enclosed:true}).key);
 const lights=()=>({hemi:new THREE.HemisphereLight(),ambient:new THREE.AmbientLight(),dayLight:new THREE.DirectionalLight(),arenaFill:new THREE.DirectionalLight()}),a=lights(),b=lights();for(let i=0;i<60;i++)updateSceneLighting(a,outside,1/60);for(let i=0;i<30;i++)updateSceneLighting(b,outside,1/30);assert.ok(Math.abs(a.dayLight.intensity-b.dayLight.intensity)<1e-10);
});

test('the bowl light fill preserves authored shaders and switches day/night without new material programs',()=>{
 const root=new THREE.Group(),stand=new THREE.MeshStandardMaterial(),pitch=new THREE.MeshStandardMaterial();
 pitch.userData.arenaPitch=true;
 let called=0;
 stand.onBeforeCompile=shader=>{called++;shader.vertexShader+=' custom motion';};
 root.add(new THREE.InstancedMesh(new THREE.BoxGeometry(),stand,2),new THREE.Mesh(new THREE.PlaneGeometry(),pitch));
 const fill=buildBowlLighting(root),keys=[stand.customProgramCacheKey(),pitch.customProgramCacheKey()];
 function compile(material){
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);return shader;
 }
 const seats=compile(stand),field=compile(pitch);
 assert.equal(called,1);
 assert.ok(seats.vertexShader.includes('custom motion'));
 assert.ok(seats.vertexShader.indexOf('dot(mvPosition.xyz')>seats.vertexShader.indexOf('#include <project_vertex>'),'tier lighting follows instance-transformed height');
 assert.ok(seats.fragmentShader.includes('vec3(vArenaSpill)'));
 assert.ok(!field.vertexShader.includes('vArenaSpill'),'the field retains even illumination');
 assert.ok(field.fragmentShader.includes('arenaFacing * vec3(2.06, 2.13, 2.25)'));
 assert.notEqual(keys[0],keys[1],'field and stand shader programs cannot collide');
 assert.equal(seats.uniforms.arenaFloodFill,field.uniforms.arenaFloodFill);
 fill.night(true);assert.equal(field.uniforms.arenaFloodFill.value,.12);
 fill.night(false);assert.equal(field.uniforms.arenaFloodFill.value,0);
 assert.deepEqual([stand.customProgramCacheKey(),pitch.customProgramCacheKey()],keys);
});

test('night ground spill retains its controller after static batching and costs two meshes',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 try{const root=new THREE.Group(),spill=buildNightGroundSpill(root,[new THREE.Vector3(0,-3,180),new THREE.Vector3(56,-4,200)]);compactStaticMeshes(root,spill.objects);assert.equal(root.children.length,2);spill.setNight(false);assert.ok(spill.objects.every(o=>o.parent===root&&!o.visible));spill.setNight(true);assert.ok(spill.objects.every(o=>o.parent===root&&o.visible));const wash=spill.objects[1];assert.equal(wash.geometry.attributes.color.itemSize,4);for(const p of wash.geometry.attributes.position.array)assert.ok(Number.isFinite(p));}finally{globalThis.document=previous;}
});
