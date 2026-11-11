import {THREE} from './kit.js';
import {entranceFloor} from './matchday-route.js';

// The atlas shares one draw call. Its UV cells can still have distinct physical
// responses: matte polyester, softer skin, polished boots and moist eyes.
export function installAthleteSurface(material){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
float athleteRoughness=.88;
if(vMapUv.y>.5){athleteRoughness=vMapUv.x<.5?.78:.89;}
else if(vMapUv.y>.25){athleteRoughness=vMapUv.x<.5?.91:vMapUv.x<.75?.34:.29;}
roughnessFactor=athleteRoughness;`);
 };material.customProgramCacheKey=()=>key+'|athlete-surface-v3';
 return material;
}

// A soft body shadow and two ankle contacts share one instanced draw. Foot
// contacts fade as a foot lifts, rather than following the torso's bobbing.
export function createActorContactShadows(parent,count,texture){
 const geometry=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),opacity=new THREE.InstancedBufferAttribute(new Float32Array(count*3),1);
 geometry.setAttribute('contactOpacity',opacity);opacity.setUsage(THREE.DynamicDrawUsage);
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 material.onBeforeCompile=shader=>{shader.vertexShader='attribute float contactOpacity;varying float vContactOpacity;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvContactOpacity=contactOpacity;');shader.fragmentShader='varying float vContactOpacity;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vContactOpacity;');};
 material.customProgramCacheKey=()=> 'athlete-contact-shadows-v1';
 const mesh=new THREE.InstancedMesh(geometry,material,count*3);mesh.name='Contact shadows';mesh.frustumCulled=false;mesh.renderOrder=1;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 shadowStates.set(mesh,{actors:new Array(count),first:Infinity,last:0});
 parent.add(mesh);
 return mesh;
}
const shadowStates=new WeakMap(),inverse=new THREE.Matrix4(),pose=new THREE.Object3D(),localFoot=new THREE.Vector3();
function writeShadow(mesh,alpha,index,x,z,width,depth,opacity,floor){
 pose.position.set(x,floor+.013,z);
 pose.scale.set(width,1,depth);
 pose.updateMatrix();
 mesh.setMatrixAt(index,pose.matrix);
 alpha.setX(index,opacity);
}
function markShadowRange(shadows,first,last){
 shadows.first=Math.min(shadows.first,first);
 shadows.last=Math.max(shadows.last,last);
}
export function updateActorContactShadows(mesh,index,actor,refresh=false){
 const {group,body}=actor,base=index*3,alpha=mesh.geometry.attributes.contactOpacity;
 const shadows=shadowStates.get(mesh),previous=shadows.actors[index]??(shadows.actors[index]={});
 if(!group.visible){
  if(previous.visible===false)return;
  previous.visible=false;
  pose.scale.setScalar(0);pose.updateMatrix();
  for(let j=0;j<3;j++){mesh.setMatrixAt(base+j,pose.matrix);alpha.setX(base+j,0);}
  markShadowRange(shadows,base,base+3);
  return;
 }
 const {x,y,z}=group.position,yaw=group.rotation.y,scale=group.scale.x,seated=!!actor.definition.seated;
 const moved=!previous.visible||previous.x!==x||previous.y!==y||previous.z!==z||previous.yaw!==yaw||previous.scale!==scale||previous.seated!==seated;
 if(!moved&&!refresh)return;
 const feet=actor.contactFeet??(actor.contactFeet=[new THREE.Vector3(.18,.08,0),new THREE.Vector3(-.18,.08,0)]);
 let feetMoved=0;
 if(refresh){
  inverse.copy(group.matrixWorld).invert();
  for(let j=0;j<2;j++){
   localFoot.setFromMatrixPosition(body.skeleton.bones[j?17:11].matrixWorld).applyMatrix4(inverse);
   if(localFoot.distanceToSquared(feet[j])>1e-10){feet[j].copy(localFoot);feetMoved|=1<<j;}
  }
 }
 if(!moved&&!feetMoved)return;
 pose.rotation.set(0,yaw,0);
 if(moved){
  previous.visible=true;previous.x=x;previous.y=y;previous.z=z;previous.yaw=yaw;previous.scale=scale;previous.seated=seated;
  writeShadow(mesh,alpha,base,x+.055*scale,z-.045*scale,.96*scale,1.06*scale,seated?.16:.30,entranceFloor(x));
  markShadowRange(shadows,base,base+1);
 }
 const c=Math.cos(yaw),s=Math.sin(yaw);
 for(let j=0;j<2;j++){
  if(!moved&&!(feetMoved&(1<<j)))continue;
  const f=feet[j],footX=f.x*scale,footZ=(f.z+.045)*scale;
  const wx=x+footX*c+footZ*s,wz=z+footZ*c-footX*s,ground=entranceFloor(wx);
  const lift=Math.max(0,y+f.y*scale-ground-.075*scale),spread=1+Math.min(lift,.4)*.7;
  writeShadow(mesh,alpha,base+j+1,wx,wz,.24*scale*spread,.38*scale*spread,.55*Math.exp(-lift*11),ground);
  markShadowRange(shadows,base+j+1,base+j+2);
 }
}
function flushShadowRange(attribute,start,end){
 // If a frame was never drawn, retain its pending range for the next draw.
 const pending=attribute.updateRanges[0];
 if(pending){
  end=Math.max(end,pending.start+pending.count);
  pending.start=Math.min(start,pending.start);
  pending.count=end-pending.start;
 }else attribute.addUpdateRange(start,end-start);
 attribute.needsUpdate=true;
}
export function flushActorContactShadows(mesh){
 const shadows=shadowStates.get(mesh),{first,last}=shadows;
 if(first>=last)return;
 flushShadowRange(mesh.instanceMatrix,first*16,last*16);
 flushShadowRange(mesh.geometry.attributes.contactOpacity,first,last);
 shadows.first=Infinity;shadows.last=0;
}
