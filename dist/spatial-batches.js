import {THREE} from './kit.js';

const angleSector=(x,z,sectors)=>Math.min(sectors-1,Math.floor((Math.atan2(z,x)+Math.PI)/(2*Math.PI)*sectors));

// From the arcade only a fraction of the ring is visible. Keep the global
// instance draw for distant views, and use tight sector bounds while walking.
export function buildMobileArcadeBatches(roots,sectors=6){
 const representations=[],matrix=new THREE.Matrix4(),color=new THREE.Color();
 for(const root of roots){
  root.updateWorldMatrix(true,true);
  for(const original of root.children.slice()){
   if(!original.isInstancedMesh||original.count<sectors*24)continue;
   const bins=Array.from({length:sectors},()=>[]);
   for(let i=0;i<original.count;i++){
    original.getMatrixAt(i,matrix);
    bins[angleSector(matrix.elements[12],matrix.elements[14],sectors)].push(i);
   }
   const clusters=bins.filter(bin=>bin.length);
   if(clusters.length<2)continue;
   const group=new THREE.Group();
   group.name='Arcade fixtures and stairs';
   root.add(group);
   group.add(original);
   const parts=clusters.map(indices=>{
    const instance=new THREE.InstancedMesh(original.geometry,original.material,indices.length);
    instance.position.copy(original.position);
    instance.quaternion.copy(original.quaternion);
    instance.scale.copy(original.scale);
    instance.castShadow=original.castShadow;
    instance.receiveShadow=original.receiveShadow;
    instance.layers.mask=original.layers.mask;
    instance.renderOrder=original.renderOrder;
    instance.frustumCulled=false;
    instance.visible=false;
    for(const [next,previous] of indices.entries()){
     original.getMatrixAt(previous,matrix);
     instance.setMatrixAt(next,matrix);
     if(original.instanceColor){
      original.getColorAt(previous,color);
      instance.setColorAt(next,color);
     }
    }
    group.add(instance);
    instance.updateWorldMatrix(true,false);
    instance.computeBoundingBox();
    const bounds=instance.boundingBox.clone().applyMatrix4(instance.matrixWorld).expandByScalar(.18);
    return {instance,bounds};
   });
   representations.push({original,parts});
  }
 }
 let active=false;
 return (mobileView,view)=>{
  if(mobileView===active&&(!active||!view.changed))return;
  active=mobileView;
  for(const {original,parts} of representations){
   if(original.visible===active)original.visible=!active;
   for(const {instance,bounds} of parts){
    const show=active&&view.frustum.intersectsBox(bounds);
    if(instance.visible!==show)instance.visible=show;
   }
  }
 };
}

// Preserve vertex indices and every attribute while splitting a static ring.
// Each sector then gets a useful frustum bound instead of one stadium-wide box.
export function partitionGeometry(geometry,sectors=16,includeSourceIndices=false){
 const p=geometry.attributes.position,index=geometry.index,attributes=Object.entries(geometry.attributes),bins=new Map();
 for(let t=0;t<(index?.count??p.count);t+=3){const ids=[0,1,2].map(j=>index?index.getX(t+j):t+j),x=ids.reduce((s,i)=>s+p.getX(i),0),z=ids.reduce((s,i)=>s+p.getZ(i),0),sector=angleSector(x,z,sectors);let bin=bins.get(sector);
  if(!bin){bin={sector,vertices:new Map(),index:[],arrays:Object.fromEntries(attributes.map(([key])=>[key,[]]))};bins.set(sector,bin);}
  for(const id of ids){let next=bin.vertices.get(id);if(next===undefined){next=bin.vertices.size;bin.vertices.set(id,next);for(const[key,a]of attributes)for(let j=0;j<a.itemSize;j++)bin.arrays[key].push(a.array[id*a.itemSize+j]);}bin.index.push(next);}
 }
 return [...bins.values()].map(bin=>{const g=new THREE.BufferGeometry();for(const[key,a]of attributes)g.setAttribute(key,new THREE.BufferAttribute(new a.array.constructor(bin.arrays[key]),a.itemSize,a.normalized));g.setIndex(bin.index);g.computeBoundingBox();g.computeBoundingSphere();return{geometry:g,sector:bin.sector,sourceIndices:includeSourceIndices?bin.vertices:undefined};});
}
// Use only for explicitly selected, immutable surfaces. Keep their owning
// group, transforms and visibility while giving each arc a useful frustum box.
export function partitionStaticMesh(mesh,sectors=16){
 if(!mesh?.parent||!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material))return null;
 const parts=partitionGeometry(mesh.geometry,sectors);
 if(parts.length<2){for(const part of parts)part.geometry.dispose();return null;}
 const root=new THREE.Group();root.name=mesh.name;root.position.copy(mesh.position);root.quaternion.copy(mesh.quaternion);root.scale.copy(mesh.scale);root.visible=mesh.visible;root.layers.mask=mesh.layers.mask;root.userData={...mesh.userData,partitionedStaticSurface:true};
 for(const {geometry,sector}of parts){const part=new THREE.Mesh(geometry,mesh.material);part.name=(mesh.name||'Arena static surface')+' · sector '+sector;part.castShadow=mesh.castShadow;part.receiveShadow=mesh.receiveShadow;part.customDepthMaterial=mesh.customDepthMaterial;part.customDistanceMaterial=mesh.customDistanceMaterial;part.renderOrder=mesh.renderOrder;part.layers.mask=mesh.layers.mask;root.add(part);}
 mesh.parent.add(root);mesh.removeFromParent();mesh.geometry.dispose();return root;
}
export function spatializeArchitecture(group,sectors=8){
 group.updateWorldMatrix(true,true);group.userData.spatialParts=[];
 const meshes=[];group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&!Array.isArray(o.material))meshes.push(o);});let split=0;
 for(const mesh of meshes){if(mesh.userData.visibilityManaged)continue;const g=mesh.geometry;g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3());if((g.index?.count??g.attributes.position.count)<12000||Math.max(size.x,size.z)<70)continue;
  const parts=partitionGeometry(g,sectors);if(parts.length<2){for(const p of parts)p.geometry.dispose();continue;}
  for(const p of parts){const child=new THREE.Mesh(p.geometry,mesh.material);child.name=mesh.name+' · sector '+p.sector;child.position.copy(mesh.position);child.quaternion.copy(mesh.quaternion);child.scale.copy(mesh.scale);child.castShadow=mesh.castShadow;child.receiveShadow=mesh.receiveShadow;child.customDepthMaterial=mesh.customDepthMaterial;child.renderOrder=mesh.renderOrder;child.userData.sectorCenter=p.geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld);mesh.parent.add(child);group.userData.spatialParts.push(child);}mesh.removeFromParent();g.dispose();split++;
 }return split;
}
export function updateArchitectureSectors(group,position){const outside=(Math.abs(position.x)/125)**2.8+(Math.abs(position.z)/143)**2.8>1.15&&position.y<5;for(const part of group.userData.spatialParts||[])part.visible=!outside||facadeSectorVisible(position,part.userData.sectorCenter);}
export function facadeSectorVisible(position,center){
 const outside=(position.x/116)**2+(position.z/132)**2>1.12;if(!outside||position.y>25)return true;
 const nx=center.x/(113.5*113.5),nz=center.z/(129*129),length=Math.hypot(nx,nz);return length<.00001||(position.x-center.x)*nx/length+(position.z-center.z)*nz/length>-30;
}
