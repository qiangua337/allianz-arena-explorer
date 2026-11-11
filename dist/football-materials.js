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
 const mesh=new THREE.InstancedMesh(geometry,material,count*3);mesh.name='Contact shadows';mesh.frustumCulled=false;mesh.renderOrder=1;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(mesh);return mesh;
}
const inverse=new THREE.Matrix4(),pose=new THREE.Object3D();
function writeShadow(mesh,alpha,index,x,z,width,depth,opacity,floor){
 pose.position.set(x,floor+.013,z);
 pose.scale.set(width,1,depth);
 pose.updateMatrix();
 mesh.setMatrixAt(index,pose.matrix);
 alpha.setX(index,opacity);
}
export function updateActorContactShadows(mesh,index,actor,refresh=false){
 const {group,body}=actor,base=index*3,alpha=mesh.geometry.attributes.contactOpacity;
 if(!group.visible){pose.scale.setScalar(0);pose.updateMatrix();for(let j=0;j<3;j++){mesh.setMatrixAt(base+j,pose.matrix);alpha.setX(base+j,0);}return;}
 const feet=actor.contactFeet??(actor.contactFeet=[new THREE.Vector3(.18,.08,0),new THREE.Vector3(-.18,.08,0)]);
 if(refresh){inverse.copy(group.matrixWorld).invert();for(let j=0;j<2;j++)feet[j].setFromMatrixPosition(body.skeleton.bones[j?17:11].matrixWorld).applyMatrix4(inverse);}
 const yaw=group.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw),scale=group.scale.x,floor=entranceFloor(group.position.x);
 pose.rotation.set(0,yaw,0);
 writeShadow(mesh,alpha,base,group.position.x+.055*scale,group.position.z-.045*scale,.96*scale,1.06*scale,actor.definition.seated?.16:.30,floor);
 for(let j=0;j<2;j++){
  const f=feet[j],x=f.x*scale,z=(f.z+.045)*scale;
  const wx=group.position.x+x*c+z*s,wz=group.position.z+z*c-x*s,ground=entranceFloor(wx);
  const lift=Math.max(0,group.position.y+f.y*scale-ground-.075*scale),spread=1+Math.min(lift,.4)*.7;
  writeShadow(mesh,alpha,base+j+1,wx,wz,.24*scale*spread,.38*scale*spread,.55*Math.exp(-lift*11),ground);
 }
}
export function flushActorContactShadows(mesh){mesh.instanceMatrix.needsUpdate=true;mesh.geometry.attributes.contactOpacity.needsUpdate=true;}
