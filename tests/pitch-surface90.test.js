import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const {THREE}=await import('../dist/kit.js');
const {buildPitchSurface}=await import('../dist/pitch-surface.js');
const root=new THREE.Group(),surface=buildPitchSurface(root,new THREE.Texture()),tufts=root.getObjectByName('Nearby turf blades');
function compiled(){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};tufts.material.onBeforeCompile(shader);return shader;}

test('nearby turf stays within its fixed two draw and 16k/26k instance budget, with low mode disabled',()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(1.001,1.7,-.713);surface.update(camera);assert.equal(root.children.length,2);assert.equal(tufts.geometry.attributes.position.count,5);assert.equal(tufts.geometry.index.count,9);assert.equal(tufts.geometry.attributes.bladeOffset.count,26000);assert.equal(tufts.geometry.instanceCount,16000);assert.equal(tufts.visible,true);
 const shader=compiled();assert.deepEqual(shader.uniforms.bladeCenter.value.toArray(),[1.001,-.713]);camera.position.x=1.002;surface.update(camera,true);assert.equal(tufts.geometry.instanceCount,26000);assert.equal(shader.uniforms.bladeCenter.value.x,1.002,'continuous fade window does not snap every two metres');surface.update(camera,true,true);assert.equal(tufts.visible,false);camera.position.y=10;surface.update(camera);assert.equal(tufts.visible,false);
});

test('the grass shader rotates its normals before normal projection and removes fully faded triangles before rasterization',()=>{
 const shader=compiled(),vs=shader.vertexShader,fs=shader.fragmentShader;
 assert.ok(vs.indexOf('objectNormal.xz=')>vs.indexOf('#include <beginnormal_vertex>'));assert.ok(vs.indexOf('objectNormal.xz=')<vs.indexOf('#include <defaultnormal_vertex>'));
 assert.ok(vs.indexOf('transformed*=step(.15,bladeFade)')<vs.indexOf('#include <project_vertex>'));
 assert.ok(fs.includes('bladeFade<.15)discard'),'the vertex rejection shares the existing fragment threshold');assert.ok(vs.includes('vMapUv=vec2(p.x/72.+.5,.5-p.y/111.)'),'grass color remains registered with the painted field');
});
