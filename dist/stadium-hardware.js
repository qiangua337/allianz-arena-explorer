import {THREE} from './kit.js';

export function partitionBowlHardware(parent,levels){
 const batches=[];
 const alternates=new THREE.Group();
 alternates.name='Visible hardware by seating tier';
 parent.add(alternates);
 // Opaque box instances may be reordered. Sharing the original arrays keeps
 // the alternate ranges from duplicating their transforms in CPU memory.
 for(const base of parent.children){
  if(!base.isInstancedMesh||base.count<150||base.instanceColor||base.material.transparent)continue;
  const matrices=base.instanceMatrix.array;
  const groups=Array.from({length:levels.length+1},()=>[]);
  for(let i=0;i<base.count;i++){
   const y=matrices[i*16+13],tier=levels.findIndex(limit=>y<limit);
   groups[tier<0?levels.length:tier].push(i);
  }
  if(groups.filter(group=>group.length).length<2)continue;
  const ordered=matrices.slice();
  let offset=0;
  for(const group of groups){
   for(const i of group){matrices.set(ordered.subarray(i*16,i*16+16),offset);offset+=16;}
  }
  base.instanceMatrix.needsUpdate=true;
  offset=0;
  const parts=groups.filter(group=>group.length).map(group=>{
   const part=new THREE.InstancedMesh(base.geometry,base.material,0);
   part.count=group.length;
   part.instanceMatrix=new THREE.InstancedBufferAttribute(matrices.subarray(offset,offset+group.length*16),16);
   offset+=group.length*16;
   part.position.copy(base.position);
   part.quaternion.copy(base.quaternion);
   part.scale.copy(base.scale);
   part.receiveShadow=base.receiveShadow;
   part.castShadow=base.castShadow;
   part.visible=false;
   alternates.add(part);
   return {part,bounds:worldBounds(part)};
  });
  batches.push({base,parts,bounds:worldBounds(base)});
 }
 const covered=new Set(batches.map(({base})=>base));
 let previous=0;
 return {covered,update(active,upperWalk,view){
  const mode=upperWalk?2:active?1:0;
  if(previous===mode&&(!active||!view.changed))return;
  previous=mode;
  for(const {base,parts,bounds} of batches){
   const inView=!active||view.frustum.intersectsBox(bounds);
   let single=null,multiple=false;
   if(mode===2&&inView){
    for(const section of parts)if(view.frustum.intersectsBox(section.bounds)){
     if(single){multiple=true;break;}
     single=section;
    }
   }
   // Keep the complete shared batch whenever the view reaches two tiers.
   // The narrow case can discard off-screen instances without an extra draw.
   const showBase=inView&&(mode!==2||multiple);
   if(base.visible!==showBase)base.visible=showBase;
   for(const section of parts){
    const shown=!multiple&&section===single;
    if(section.part.visible!==shown)section.part.visible=shown;
   }
  }
 }};
}

function worldBounds(mesh){
 mesh.updateWorldMatrix(true,false);
 mesh.computeBoundingBox();
 return mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld).expandByScalar(.18);
}
