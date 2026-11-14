import {THREE,compactGroup} from './kit.js';
import {tunnelHasBowlView,enclosedPlayerPosition} from './player-area-layout.js';
import {core,coreLevels} from './building-layout.js';

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
 const portal=(min,max)=>new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)).expandByScalar(.28);
 // Match the full-width openings in the front wall and the first three
 // western openings. Their slight padding keeps edge views conservative.
 const openings=coreLevels.flatMap((floor,i)=>[
  portal([core.minX-.2,floor,-13.35],[core.maxX+.2,floor+3.25,-13.15]),
  ...(i<3?[portal([core.minX-.22,floor,-11.95],[core.minX-.02,floor+3.25,-9.05])]:[]),
 ]);
 return camera=>{
  const {x,y,z}=camera.position;
  if(x<=core.minX+.23||x>=core.maxX-.23||z<=-13||z>=9.8||y<=-1.5||y>=43.12)return false;
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  return !openings.some(opening=>frustum.intersectsBox(opening));
 };
}
export function buildFrameBudget(){
 let lastPosition=new THREE.Vector3(Infinity,0,0),lastRotation=new THREE.Quaternion(),lastFrame=-Infinity,dirty=true;
 return{invalidate(){dirty=true;},shouldDraw(camera,time,animated=false,suspended=false){const changed=lastPosition.distanceToSquared(camera.position)>.000001||Math.abs(lastRotation.dot(camera.quaternion))<.9999999;if(!dirty&&!changed&&(suspended||!animated&&time-lastFrame<.35))return false;lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastFrame=time;dirty=false;return true;}};
}
