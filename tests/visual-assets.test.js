import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE,mat,setMaterialEnvironment}=await import('../dist/kit.js');
const {textureResolution,surfaceBundle,applySurfaceQuality}=await import('../dist/visual-assets.js');
const {applyArchitecturalUV}=await import('../dist/surface-finishes.js');
const {fitoutVolumes,insideFitout,fitoutShaderCuts}=await import('../dist/room-volumes.js');
const {roomSpecs}=await import('../dist/building-layout.js');
const {europeanCupGeometry,pokalGeometry}=await import('../dist/trophy-gallery.js');
const {honours}=await import('../dist/honours.js');
const {awayKitRoster,awayXI,substitutes}=await import('../dist/matchday-roster.js');

test('every locally shipped PBR and HDR source has its declared checksum, license and bounded transfer size',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../dist/assets/pbr/manifest.json',import.meta.url))),required=Object.entries(surfaceBundle).flatMap(([name,channels])=>channels.map(channel=>[name,channel]));required.push(...['day','night','indoor'].map(name=>[name,'hdr']));let bytes=0;
 for(const[name,channel]of required){const asset=manifest.assets[name],entry=asset.maps[channel],path=new URL('../dist/assets/pbr/'+entry.file,import.meta.url);assert.equal(asset.license,'CC0-1.0');assert.equal(statSync(path).size,entry.bytes);assert.equal(createHash('md5').update(readFileSync(path)).digest('hex'),entry.md5);bytes+=entry.bytes;}
 assert.ok(bytes<12*1048576);assert.equal(textureResolution(390),512);assert.equal(textureResolution(1024),512);assert.equal(textureResolution(1280),1024);
});
test('real roughness and normal maps receive metre UVs even with no colour texture',()=>{
 const material=new THREE.MeshStandardMaterial(),normal=new THREE.Texture();normal.channel=1;material.normalMap=normal;const group=new THREE.Group(),g=new THREE.BoxGeometry(3,2,1),mesh=new THREE.Mesh(g,material);mesh.position.set(20,2,-7);group.add(mesh);applyArchitecturalUV(group);assert.equal(g.attributes.uv1.count,g.attributes.position.count);assert.ok([...g.attributes.uv1.array].some(n=>n>=18));
 const environment=new THREE.Texture();setMaterialEnvironment(environment);assert.equal(mat(0xffffff).envMap,environment);assert.equal(mat(0xffffff,{envMapIntensity:.8}).envMapIntensity,.8);setMaterialEnvironment(undefined);
});
test('facade cuts protect the full interpreted fit-out volume without removing another floor or the whole shell',()=>{
 assert.equal(fitoutVolumes.length,3);for(const v of fitoutVolumes){const room=roomSpecs[v.id];assert.ok(insideFitout({x:room.x-room.w/2+.02,y:room.y+.05,z:room.z+room.d/2-.02}));assert.ok(!insideFitout({x:room.x,y:room.y+8,z:room.z}));}
 assert.ok(!insideFitout({x:0,y:1.7,z:0}));assert.ok(!insideFitout({x:-114,y:13,z:58}));assert.equal((fitoutShaderCuts.match(/discard/g)||[]).length,3);
});
test('European cup and German cup have distinct finite hollow profiles; eight exhibit footprints remain unchanged',()=>{
 const european=europeanCupGeometry(),pokal=pokalGeometry();for(const g of[european,pokal]){g.computeBoundingBox();assert.ok(g.boundingBox.max.y>1);for(const p of g.attributes.position.array)assert.ok(Number.isFinite(p));}assert.notDeepEqual([...european.attributes.position.array.slice(0,300)],[...pokal.attributes.position.array.slice(0,300)]);
 assert.equal(honours.length,8);assert.equal(honours.filter(h=>h.kind==='europe').length,6);assert.deepEqual(honours.slice(-2).map(h=>h.kind),['shield','pokal']);honours.forEach((h,i)=>{assert.equal(h.x,i%2?3.7:-3.7);assert.equal(h.z,-8+Math.floor(i/2)*5.3);assert.ok(h.source.startsWith('https://'));});
});
test('guest wardrobe names and numbers exactly match the optional exhibition opponent with no invented GAST slots',()=>{
 assert.equal(awayKitRoster.length,20);assert.equal(new Set(awayKitRoster.map(p=>p.number)).size,20);assert.deepEqual(awayKitRoster,[...awayXI,...substitutes.filter(p=>p.team==='away')].map(p=>p.player));assert.equal(awayKitRoster.find(p=>p.number===9).name,'GUIRASSY');assert.ok(awayKitRoster.every(p=>p.name&&!p.name.includes('GAST')));
});


test('power-saving mode removes both detail maps and restores the same textures without rebuilding geometry',()=>{
 const root=new THREE.Group(),m=new THREE.MeshStandardMaterial(),normal=new THREE.Texture(),roughness=new THREE.Texture();m.normalMap=normal;m.roughnessMap=roughness;const mesh=new THREE.Mesh(new THREE.BoxGeometry(),m);root.add(mesh);const geometry=mesh.geometry;
 applySurfaceQuality(root,'low');assert.equal(m.normalMap,null);assert.equal(m.roughnessMap,null);applySurfaceQuality(root,'standard');assert.equal(m.normalMap,normal);assert.equal(m.roughnessMap,roughness);assert.equal(mesh.geometry,geometry);assert.equal(root.children.length,1);
});
