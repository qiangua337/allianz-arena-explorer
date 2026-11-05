import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {createActorContactShadows,updateActorContactShadows,flushActorContactShadows}=await import('../dist/football-materials.js');
const {buildPitchsideDetails}=await import('../dist/pitchside-details.js');

test('body and planted-foot contacts use one draw, stay on the floor and fade when the foot lifts',()=>{
 const root=new THREE.Group(),shadows=createActorContactShadows(root,2,new THREE.Texture()),group=new THREE.Group(),bones=Array.from({length:18},()=>new THREE.Bone());
 group.position.set(0,0,10);for(const b of bones)group.add(b);bones[11].position.set(.18,.08,0);bones[17].position.set(-.18,.08,0);group.updateMatrixWorld(true);
 const actor={group,body:{skeleton:{bones}},definition:{}};updateActorContactShadows(shadows,0,actor,true);const a=shadows.geometry.attributes.contactOpacity,planted=a.getX(1),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
 assert.equal(root.children.length,1);assert.equal(shadows.count,6);assert.ok(planted>.45);
 for(let i=0;i<3;i++){shadows.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.ok(Math.abs(point.y-.013)<1e-7);assert.ok(matrix.elements.every(Number.isFinite));}
 bones[11].position.y=.50;group.updateMatrixWorld(true);updateActorContactShadows(shadows,0,actor,true);assert.ok(a.getX(1)<planted*.02,'raised foot loses its dark ground contact');assert.ok(a.getX(2)>.45,'support foot stays grounded');
 group.visible=false;updateActorContactShadows(shadows,0,actor);flushActorContactShadows(shadows);for(let i=0;i<3;i++){assert.equal(a.getX(i),0);shadows.getMatrixAt(i,matrix);assert.equal(matrix.elements[0],0);}assert.ok(a.version>0&&shadows.instanceMatrix.version>0);
});

test('pitchside polish preserves the clear player entrance and the whole playable pitch',()=>{
 const previous=globalThis.document,context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>context})};
 try{
  const parent=new THREE.Group(),details=buildPitchsideDetails(parent);parent.updateMatrixWorld(true);let meshes=0;
  const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),point=new THREE.Vector3();
  details.root.traverse(o=>{if(!o.isMesh)return;meshes++;const vertices=o.geometry.attributes.position;
   for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){matrix.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(i,instance);matrix.multiply(instance);}
    for(let j=0;j<vertices.count;j++){point.fromBufferAttribute(vertices,j).applyMatrix4(matrix);assert.ok(point.toArray().every(Number.isFinite));assert.ok(Math.abs(point.x)>=34.1||Math.abs(point.z)>=52.6,'equipment stays off the field');if(point.x< -36&&point.x> -41&&Math.abs(point.z)<4)assert.ok(point.y<.08,'only flush hardware may enter the central tunnel exit');}
   }
  });
  assert.ok(meshes<45,'static equipment is compacted, rather than one draw per bottle or bevel');assert.equal(details.root.children.filter(o=>o.isLight).length,0);details.update(new THREE.Vector3(0,30,0),true);assert.ok(details.root.getObjectByName('Technical area pitchside markings').visible,'essential pitch markings survive low quality');
 }finally{globalThis.document=previous;}
});
