import {THREE,compactGroup} from './kit.js';
import {tunnelHasBowlView,enclosedPlayerPosition} from './player-area-layout.js';
import {core,coreLevels,upperGalleryRooms,upperTierThreshold} from './building-layout.js';

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
// Three skips invisible groups when drawing, but still walks their transforms.
// Suspend only the exploration roots for matches; they stay in the scene so
// material settings, queries, and the existing room state still find them.
export function suspendExplorationDuringMatch(roots){
 let suspended=false;
 const previous=roots.map(root=>root.visible);
 for(const root of roots){
  const update=root.updateMatrixWorld;
  root.updateMatrixWorld=function(force){if(!suspended)update.call(this,force);};
 }
 return function setMatchActive(active){
  if(active===suspended)return;
  suspended=active;
  roots.forEach((root,i)=>{if(active){previous[i]=root.visible;root.visible=false;}else root.visible=previous[i];});
 };
}
export function bowlIsVisible(position,mode){
 if(enclosedPlayerPosition(position))return false;
 const inner=(Math.abs(position.x)/83)**2.8+(Math.abs(position.z)/101)**2.8,passage=position.y<8&&Math.abs(position.x-22)<3.6&&position.z>60&&position.z<105;
 // At pedestrian height the opaque exterior and lower arcade hide the bowl.
 return tunnelHasBowlView(position)||position.y>18||inner<.98&&!passage;
}
export function buildStairwellOcclusion(){
 const frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
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
 const hasLineOfSight=(path,position)=>{
  const {x,z}=position,first=path[0],dx=(first.min.x+first.max.x)*.5-x,dz=(first.min.z+first.max.z)*.5-z;
  let lo=-Infinity,hi=Infinity;
  // The frustum must be able to see every doorway along the corridor, and
  // those doorways must overlap in direction for an unbroken sightline.
  for(const opening of path){
   const {min,max}=opening;
   if(x>=min.x&&x<=max.x&&z>=min.z&&z<=max.z)continue;
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
 return camera=>{
  const {x,y,z}=camera.position;
  let paths;
  if(x>core.minX+.23&&x<core.maxX-.23&&z>frontZ&&z<9.8&&y>-1.5&&y<43.12)paths=corePaths;
  else if(y>level+.15&&y<level+3.05&&z<frontZ){
   if(x>front.minX&&x<front.maxX&&z>front.minZ)paths=galleryPaths[0];
   else if(x>=front.maxX&&x<cross.maxX&&z>cross.minZ&&z<cross.maxZ)paths=galleryPaths[1];
   else if(x>aisle.minX&&x<aisle.maxX&&z>aisle.minZ&&z<=cross.minZ)paths=galleryPaths[2];
   else if(x>bridge.minX&&x<=aisle.minX&&z>bridge.minZ&&z<bridge.maxZ)paths=galleryPaths[3];
  }
  if(!paths)return false;
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  return !paths.some(path=>hasLineOfSight(path,camera.position));
 };
}
export function buildFrameBudget(){
 let lastPosition=new THREE.Vector3(Infinity,0,0),lastRotation=new THREE.Quaternion(),lastFrame=-Infinity,dirty=true;
 return{invalidate(){dirty=true;},shouldDraw(camera,time,animated=false,suspended=false){const changed=lastPosition.distanceToSquared(camera.position)>.000001||Math.abs(lastRotation.dot(camera.quaternion))<.9999999;if(!dirty&&!changed&&(suspended||!animated&&time-lastFrame<.35))return false;lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastFrame=time;dirty=false;return true;}};
}
