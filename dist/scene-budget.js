import {THREE,compactGroup} from './kit.js';
import {tunnelHasBowlView,enclosedPlayerPosition} from './player-area-layout.js';
import {core,coreLevels,upperGalleryRooms,upperTierThreshold} from './building-layout.js';
import {inVisitorPassage,visitorPassage} from './tour-route.js';

// Keep hardware instances and independently controlled subtrees intact while
// combining small static meshes that otherwise each cost a draw submission.
export function compactStaticMeshes(group,exclude=[]){
 const skipped=[];group.traverse(o=>{let excluded=o.isInstancedMesh;for(let p=o;p&&p!==group;p=p.parent)if(exclude.includes(p))excluded=true;if(excluded)skipped.push(o);});
 compactGroup(group,skipped);
}
export function freezeArchitecture(group,exclude=[]){
 const fixed=[];group.traverse(o=>{for(let p=o;p&&p!==group;p=p.parent)if(exclude.includes(p))return;fixed.push(o);o.updateMatrix();o.matrixWorldAutoUpdate=true;});
 // These transforms and their ancestors remain fixed for the lifetime of the
 // venue. Reusing only local matrices still lets the Scene's forced traversal
 // multiply every world matrix on every rendered frame.
 group.updateWorldMatrix(true,true);for(const o of fixed){o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;}
}
// Three's matrix traversal can skip a hidden render subtree. Its objects and
// cached world matrices stay available to explicit queries and material tools.
export function suspendMatrixTraversal(root){
 const update=root.updateMatrixWorld;let suspended=false;
 root.updateMatrixWorld=function(force){if(!suspended)return update.call(this,force);};
 return value=>{suspended=value;};
}
// Three skips drawing invisible groups but still walks their transforms.
// Keep hidden roots attached for material settings, queries and room state.
export function suspendExplorationRoots(roots){
 let suspended=false;
 const previous=roots.map(root=>root.visible);
 const setTraversal=roots.map(suspendMatrixTraversal);
 return function setMatchActive(active){
  if(active===suspended)return;
  suspended=active;
  roots.forEach((root,i)=>{setTraversal[i](active);if(active){previous[i]=root.visible;root.visible=false;}else root.visible=previous[i];});
 };
}
export function bowlIsVisible(position,mode,visitorOpeningVisible=false){
 if(enclosedPlayerPosition(position))return false;
 const {x,y,z}=position;
 if(y<8&&inVisitorPassage(x,z,.32))return z<=visitorPassage.rampZ+.03||visitorOpeningVisible;
 const inner=(Math.abs(x)/83)**2.8+(Math.abs(z)/101)**2.8;
 // At pedestrian height the opaque exterior and lower arcade hide the bowl.
 return tunnelHasBowlView(position)||y>18||inner<.98;
}
export function buildWalkFrustum(){
 const frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
 const lastProjection=new THREE.Matrix4(),view={frustum,changed:false};let previousCamera;
 return camera=>{
  camera.updateMatrixWorld();
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  view.changed=camera!==previousCamera||!projection.equals(lastProjection);
  if(view.changed){previousCamera=camera;lastProjection.copy(projection);frustum.setFromProjectionMatrix(projection);}
  return view;
 };
}
export function buildUpperRevealView(){
 const direction=new THREE.Vector3();
 return camera=>{
  // Require the entire viewport to face across the covered bowl. Turning to
  // either side or toward the exterior restores the lower backdrop immediately.
  const vertical=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/camera.zoom,horizontal=vertical*camera.aspect;
  for(const sx of [-1,1])for(const sy of [-1,1]){
   direction.set(sx*horizontal,sy*vertical,-1).applyQuaternion(camera.quaternion);
   if(direction.x>=-.6||Math.abs(direction.z)>-.85*direction.x)return false;
  }
  return true;
 };
}
export function buildVisitorBowlView(walkFrustum=buildWalkFrustum()){
 const {x,width,base,head,rampZ}=visitorPassage;
 const portal=new THREE.Box3(new THREE.Vector3(x-width/2,base,rampZ),new THREE.Vector3(x+width/2,head,rampZ)).expandByScalar(.12);
 return (camera,view)=>{
  const p=camera.position;
  return p.y<8&&p.z>rampZ&&inVisitorPassage(p.x,p.z,.32)&&(view??walkFrustum(camera)).frustum.intersectsBox(portal);
 };
}
export function buildStaticBatchCulling(meshes,opaqueSurfaces=[]){
 const entries=[];
 function register(mesh,box){
  // Seat LODs and normal camera motion both need room at the viewport edge.
  entries.push({mesh,visible:mesh.visible,bounds:box.clone().applyMatrix4(mesh.matrixWorld).expandByScalar(.18)});
 }
 for(const mesh of meshes){
  if(!mesh.isInstancedMesh||mesh.count<150||!mesh.frustumCulled)continue;
  mesh.computeBoundingBox();register(mesh,mesh.boundingBox);
 }
 for(const mesh of opaqueSurfaces){
  if(!mesh.isMesh||!mesh.frustumCulled)continue;
  mesh.geometry.computeBoundingBox();register(mesh,mesh.geometry.boundingBox);
 }
 let previous=false;
 return (active,view)=>{
  if(!active){if(previous)for(const {mesh,visible} of entries)if(mesh.visible!==visible)mesh.visible=visible;previous=false;return;}
  if(previous&&!view.changed)return;
  previous=true;
  for(const {mesh,visible,bounds} of entries){
   const shown=visible&&view.frustum.intersectsBox(bounds);if(mesh.visible!==shown)mesh.visible=shown;
  }
 };
}
export function buildStairwellOcclusion(walkFrustum=buildWalkFrustum()){
 const portal=(min,max)=>new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)).expandByScalar(.16);
 const {front,cross,aisle,bridge}=upperGalleryRooms,level=upperTierThreshold.top,height=3.25,frontZ=-13.25;
 const acrossX=(x,z0,z1)=>portal([x,level,z0],[x,level+height,z1]);
 const acrossZ=(z,x0,x1)=>portal([x0,level,z],[x1,level+height,z]);
 const galleryPortals=[
  acrossZ(frontZ,front.minX,front.maxX),
  acrossX(front.maxX,cross.minZ,cross.maxZ),
  acrossZ(cross.minZ,aisle.minX,aisle.maxX),
  acrossX(aisle.minX,bridge.minZ,bridge.maxZ),
  acrossX(bridge.minX,bridge.minZ,bridge.maxZ)
 ];
 const openings=coreLevels.slice(0,-1).flatMap((floor,i)=>[
  portal([i===2?front.minX:core.minX-.2,floor,frontZ],[i===2?front.maxX:core.maxX+.2,floor+height,frontZ]),
  portal([core.minX-.12,floor,-11.95],[core.minX-.12,floor+height,-9.05])
 ]);
 const corePaths=openings.map(opening=>[opening]).concat([galleryPortals]);
 const galleryPaths=galleryPortals.slice(1).map((_,i)=>{
  const towardCore=galleryPortals.slice(0,i+1).reverse();
  return [...openings.map(opening=>[...towardCore,opening]),galleryPortals.slice(i+1)];
 });
 const hasLineOfSight=(frustum,path,position)=>{
  const {x,y,z}=position,first=path[0],dx=(first.min.x+first.max.x)*.5-x,dz=(first.min.z+first.max.z)*.5-z;
  let lo=-Infinity,hi=Infinity;
  // The frustum must be able to see every doorway along the corridor, and
  // those doorways must overlap in direction for an unbroken sightline.
  for(const opening of path){
   const {min,max}=opening;
   // Openings on other floors share the same plan coordinates, but only the
   // opening that actually contains the camera may bypass the frustum test.
   if(x>=min.x&&x<=max.x&&y>=min.y&&y<=max.y&&z>=min.z&&z<=max.z)continue;
   if(!frustum.intersectsBox(opening))return false;
   if(path.length===1)continue;
   const a=min.x-x,b=max.x-x,c=min.z-z,d=max.z-z;
   const ac=a*dx+c*dz,ad=a*dx+d*dz,bc=b*dx+c*dz,bd=b*dx+d*dz;
   if(Math.min(ac,ad,bc,bd)<=0)continue;
   const l=(a*dz-c*dx)/ac,m=(a*dz-d*dx)/ad,n=(b*dz-c*dx)/bc,o=(b*dz-d*dx)/bd;
   lo=Math.max(lo,Math.min(l,m,n,o));hi=Math.min(hi,Math.max(l,m,n,o));
   if(lo>hi)return false;
  }
  return true;
 };
 return (camera,view)=>{
  const {x,y,z}=camera.position;
  let paths;
  if(x>core.minX+.23&&x<core.maxX-.23&&z>=frontZ&&z<9.8&&y>-1.5&&y<43.12)paths=corePaths;
  else if(y>level+.15&&y<level+3.05&&z<frontZ){
   if(x>front.minX&&x<front.maxX&&z>front.minZ)paths=galleryPaths[0];
   else if(x>=front.maxX&&x<cross.maxX&&z>cross.minZ&&z<cross.maxZ)paths=galleryPaths[1];
   else if(x>aisle.minX&&x<aisle.maxX&&z>aisle.minZ&&z<=cross.minZ)paths=galleryPaths[2];
   else if(x>bridge.minX&&x<=aisle.minX&&z>bridge.minZ&&z<bridge.maxZ)paths=galleryPaths[3];
  }
  if(!paths)return false;
  const {frustum}=view??walkFrustum(camera);
  return !paths.some(path=>hasLineOfSight(frustum,path,camera.position));
 };
}
export function buildFrameBudget(){
 let lastPosition=new THREE.Vector3(Infinity,0,0),lastRotation=new THREE.Quaternion(),lastFrame=-Infinity,dirty=true;
 return{invalidate(){dirty=true;},shouldDraw(camera,time,animated=false,suspended=false){const changed=lastPosition.distanceToSquared(camera.position)>.000001||Math.abs(lastRotation.dot(camera.quaternion))<.9999999;if(!dirty&&!changed&&(suspended||!animated&&time-lastFrame<.35))return false;lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastFrame=time;dirty=false;return true;}};
}
