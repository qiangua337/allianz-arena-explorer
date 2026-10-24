import {THREE,compactGroup} from './kit.js';
import {tunnelHasBowlView} from './player-area-layout.js';

// Keep hardware instances and independently controlled subtrees intact while
// combining small static meshes that otherwise each cost a draw submission.
export function compactStaticMeshes(group,exclude=[]){
 const skipped=[];group.traverse(o=>{let excluded=o.isInstancedMesh;for(let p=o;p&&p!==group;p=p.parent)if(exclude.includes(p))excluded=true;if(excluded)skipped.push(o);});
 compactGroup(group,skipped);
}
export function freezeArchitecture(group,exclude=[]){
 group.updateWorldMatrix(true,true);group.traverse(o=>{for(let p=o;p&&p!==group;p=p.parent)if(exclude.includes(p))return;o.updateMatrix();o.matrixAutoUpdate=false;});
}
export function bowlIsVisible(position,mode){
 const inner=(Math.abs(position.x)/83)**2.8+(Math.abs(position.z)/101)**2.8,passage=position.y<8&&Math.abs(position.x-22)<3.6&&position.z>60&&position.z<105;
 // At pedestrian height the opaque exterior and lower arcade hide the bowl.
 return tunnelHasBowlView(position)||position.y>18||inner<.98&&!passage;
}
export function buildFrameBudget(){
 let lastPosition=new THREE.Vector3(Infinity,0,0),lastRotation=new THREE.Quaternion(),lastFrame=-Infinity,dirty=true;
 return{invalidate(){dirty=true;},shouldDraw(camera,time,animated=false){const changed=lastPosition.distanceToSquared(camera.position)>.000001||Math.abs(lastRotation.dot(camera.quaternion))<.9999999;if(!dirty&&!changed&&!animated&&time-lastFrame<.35)return false;lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastFrame=time;dirty=false;return true;}};
}
