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
 const root=new THREE.Group(),m=new THREE.MeshStandardMaterial();let called=0;m.onBeforeCompile=shader=>{called++;shader.vertexShader+=' custom motion';};root.add(new THREE.Mesh(new THREE.BoxGeometry(),m));const fill=buildBowlLighting(root),key=m.customProgramCacheKey(),shader={uniforms:{},vertexShader:'',fragmentShader:'#include <aomap_fragment>'};m.onBeforeCompile(shader);assert.equal(called,1);fill.night(true);assert.equal(shader.uniforms.arenaFloodFill.value,.22);fill.night(false);assert.equal(shader.uniforms.arenaFloodFill.value,0);assert.equal(key,m.customProgramCacheKey());assert.ok(shader.vertexShader.includes('custom motion'));
});

test('night ground spill retains its controller after static batching and costs two meshes',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 try{const root=new THREE.Group(),spill=buildNightGroundSpill(root,[new THREE.Vector3(0,-3,180),new THREE.Vector3(56,-4,200)]);compactStaticMeshes(root,spill.objects);assert.equal(root.children.length,2);spill.setNight(false);assert.ok(spill.objects.every(o=>o.parent===root&&!o.visible));spill.setNight(true);assert.ok(spill.objects.every(o=>o.parent===root&&o.visible));const wash=spill.objects[1];assert.equal(wash.geometry.attributes.color.itemSize,4);for(const p of wash.geometry.attributes.position.array)assert.ok(Number.isFinite(p));}finally{globalThis.document=previous;}
});
