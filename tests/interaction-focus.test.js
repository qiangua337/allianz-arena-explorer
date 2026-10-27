import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {chooseInteraction,focusBox,rayBoxDistance,pointAhead} from '../dist/interaction-focus.js';
import {museumTargets} from '../dist/museum-targets.js';
import {personalHonours,museumObjectLabel} from '../dist/personal-honours.js';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {buildInteractions}=await import('../dist/interactions.js');
const {uefaTorsoGeometry}=await import('../dist/personal-gallery.js');
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*20})},{get:(o,k)=>k in o?o[k]:()=>{}});
function fixture(position=[-100.5,13.7,59.7]){
 const elements=new Map(),calls=[];globalThis.document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',style:{},focus(){}});return elements.get(id);},createElement:()=>({width:0,height:0,getContext:()=>context}),querySelector:()=>null};
 const camera=new THREE.PerspectiveCamera();camera.position.fromArray(position);const scene=new THREE.Scene(),interactions=buildInteractions(scene,{}, {toast(){},setEye(){},showInfo:title=>calls.push({kind:'club',title}),openPersonal:id=>calls.push({kind:'personal',id}),openCatalogue:()=>calls.push({kind:'catalogue'})});
 return{camera,calls,scene,interactions,elements,aim(x,y,z){camera.lookAt(x,y,z);},update(){interactions.update(camera.position,.016,'walk',camera);},get selected(){return document.body.dataset.interaction;}};
}
test('focus uses a forward ray with finite reach, ignores objects behind the eye and rejects invalid directions',()=>{
 const near={id:'behind',reach:3,focusBoxes:[focusBox(0,0,1,1,1,1)]},front={id:'ahead',reach:5,focusBoxes:[focusBox(0,0,-3,1,1,1)]},origin={x:0,y:0,z:0};assert.equal(chooseInteraction([near,front],origin,{x:0,y:0,z:-2}).id,'ahead');assert.equal(chooseInteraction([near,front],origin,{x:0,y:1,z:0}),null);assert.equal(chooseInteraction([front],origin,{x:NaN,y:0,z:0}),null);assert.equal(chooseInteraction([{...front,reach:2}],origin,{x:0,y:0,z:-1}),null);assert.equal(rayBoxDistance(origin,{x:0,y:0,z:1},front.focusBoxes[0]),null);assert.equal(pointAhead(origin,{x:0,y:0,z:-1},{x:0,y:0,z:1}),false);
});
test('looking at Kane selects Kane despite the closer 2013 European cup, and the opened story uses that same id',()=>{
 const f=fixture();f.aim(-102.98,15.15,59.9);f.update();assert.equal(f.selected,'personal-kane-ballon');assert.ok(f.elements.get('interact').textContent.includes('哈里·凯恩'));f.interactions.activate();assert.deepEqual(f.calls,[{kind:'personal',id:'kane-ballon'}]);
 const outline=f.scene.getObjectByName('Aimed exhibit outline');assert.equal(outline.visible,true);assert.ok(Math.abs(outline.position.x+102.98)<.01);
});
test('pressing F rechecks the current direction instead of opening the previous frame’s story',()=>{
 const f=fixture();f.aim(-99.7,13.7,60.6);f.update();assert.equal(f.selected,'honour2013');f.aim(-102.98,15.15,59.9);assert.equal(f.interactions.activate(),true);assert.deepEqual(f.calls,[{kind:'personal',id:'kane-ballon'}]);
 f.aim(-99.7,13.7,60.6);f.interactions.activate();assert.ok(f.calls[1].title.startsWith('2013'));f.aim(-100.5,25,59.7);assert.equal(f.interactions.activate(),false);assert.equal(f.calls.length,2);assert.equal(f.elements.get('interact').hidden,true);
});
test('transparent empty case space does not steal a wall exhibit, while the actual trophy and plinth remain selectable',()=>{
 const f=fixture([-98,13.7,60.6]);f.aim(-102.98,15.1,59.9);f.update();assert.equal(f.selected,'personal-kane-ballon');f.aim(-99.7,13.7,60.6);f.update();assert.equal(f.selected,'honour2013');f.aim(-99.7,12.7,60.6);f.update();assert.equal(f.selected,'honour2013');
});
test('Ribéry does not open the nearby DFB-Pokal and all ten individual displays can be targeted from their aisle',()=>{
 const f=fixture([-91.6,13.7,67.4]);f.aim(-89.02,13.7,67.5);f.update();assert.equal(f.selected,'personal-ribery');f.interactions.activate();assert.deepEqual(f.calls[0],{kind:'personal',id:'ribery'});
 for(const h of personalHonours){const x=-96+h.x,z=58+h.z;f.camera.position.set(x+(h.x<0?1.4:-1.4),13.7,z);f.aim(x,13.9,z);f.update();assert.equal(f.selected,'personal-'+h.id,h.name);}
});
test('museum targets are unavailable through the outside wall or beyond their viewing range',()=>{
 const o={x:-87,y:13.7,z:59.9};assert.equal(chooseInteraction(museumTargets,o,{x:-1,y:0,z:0}),null);const f=fixture([-96,13.7,59.9]);f.aim(-102.98,15.1,59.9);f.update();assert.notEqual(f.selected,'personal-kane-ballon');
});
test('the UEFA award is a three-dimensional torso and labels distinguish it from the displayed shirts',()=>{
 const g=uefaTorsoGeometry();g.computeBoundingBox();assert.ok(g.boundingBox.max.z-g.boundingBox.min.z>.25);assert.ok(g.boundingBox.max.y>.7);assert.ok([...g.attributes.position.array].every(Number.isFinite));assert.ok(museumObjectLabel(personalHonours.find(h=>h.id==='ribery')).includes('半身'));assert.ok(museumObjectLabel(personalHonours.find(h=>h.id==='kane-shoe')).includes('球衣'));
});
test('non-museum interactive items also require looking at them, so a nearby shirt behind the camera is not chosen',()=>{
 const f=fixture([10,13.65,120]);f.aim(10,13.65,118);f.update();assert.equal(f.selected,'shirt');f.aim(10,13.65,123);f.update();assert.notEqual(f.selected,'shirt');
});
