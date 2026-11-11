import {THREE} from './kit.js';
import {simplifySkinnedGeometry} from './player-lod.js';
import {kaneSculpt,kaneHairline,kaneHairOffset} from './football-likeness-kane.js';
import {sculptMusiala,musialaHairline,musialaHairOffset,musialaHairUV,addMusialaCurls} from './football-likeness-musiala.js';

export function playerLikeness(definition){
 if(definition.team!=='home')return null;
 if(definition.player?.number===9)return 'kane';
 if(definition.player?.number===10)return 'musiala';
 return null;
}

function ramp(start,end,value){
 const t=Math.min(1,Math.max(0,(value-start)/(end-start)));
 return t*t*(3-2*t);
}

// Evaluate the same rest-space surface for skin, eyelids, eyeballs and brow.
function sculpt(id,x,y,z,target){
 if(y<=1.6)return target.set(x,y,z);
 return id==='kane'?kaneSculpt(x,y,z,target):sculptMusiala(x,y,z,target);
}

function sculptPart(source,id){
 const geometry=source.clone(),position=geometry.attributes.position,normal=geometry.attributes.normal;
 const point=new THREE.Vector3(),next=new THREE.Vector3(),n=new THREE.Vector3(),tangent=new THREE.Vector3(),bitangent=new THREE.Vector3();
 const across=new THREE.Vector3(),along=new THREE.Vector3(),epsilon=.00015;
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i);
  if(point.y<=1.6)continue;
  n.fromBufferAttribute(normal,i);
  tangent.set(n.z,0,-n.x);
  if(tangent.lengthSq()<1e-8)tangent.set(1,0,0);
  tangent.normalize().multiplyScalar(epsilon);
  bitangent.crossVectors(n,tangent);
  sculpt(id,point.x,point.y,point.z,next);
  sculpt(id,point.x+tangent.x,point.y+tangent.y,point.z+tangent.z,across).sub(next);
  sculpt(id,point.x+bitangent.x,point.y+bitangent.y,point.z+bitangent.z,along).sub(next);
  n.crossVectors(across,along).normalize();
  position.setXYZ(i,next.x,next.y,next.z);normal.setXYZ(i,n.x,n.y,n.z);
 }
 geometry.computeBoundingSphere();
 return geometry;
}

function scalpHair(sculpted,id){
 const positions=[],indices=[],uv=[],skinIndex=[],skinWeight=[],vertexMap=new Map();
 const kane=id==='kane',hairline=kane?kaneHairline:musialaHairline,offset=new THREE.Vector3();
 // The shared rig stores the neck immediately before the head. These are
 // the only two influences on the scalp, including the clipped hairline.
 const head=sculpted.eyes.attributes.skinIndex.getX(0),neck=head-1;
 function store(point){
  const [x,y,z,nx,ny,nz]=point;
  const key=[x,y,z].map(n=>Math.round(n*1e6)).join(',');
  if(vertexMap.has(key))return vertexMap.get(key);
  const index=positions.length/3,depth=y-hairline(x,z);
  const root=ramp(0,.037,depth),front=ramp(.075,.145,z),volume=ramp(1.763,1.847,y);
  if(kane)positions.push(...kaneHairOffset(x,y,z,nx,ny,nz,root,front,volume));
  else{musialaHairOffset(x,y,z,depth,nx,ny,nz,offset);positions.push(offset.x,offset.y,offset.z);}
  if(kane)uv.push(.5+x/.22,Math.max(.006,Math.min(.994,.006+depth/.083)));
  else uv.push(...musialaHairUV(x,y,z,depth));
  skinIndex.push(head,neck,0,0);skinWeight.push(point[6],1-point[6],0,0);
  vertexMap.set(key,index);
  return index;
 }

 for(const name of ['face','skin']){
  const geometry=sculpted[name],{position,normal,skinWeight}=geometry.attributes;
  const signed=index=>position.getY(index)-hairline(position.getX(index),position.getZ(index));
  const point=index=>[
   position.getX(index),position.getY(index),position.getZ(index),normal.getX(index),normal.getY(index),normal.getZ(index),
   skinWeight.getX(index)
  ];
  for(let i=0;i<geometry.index.count;i+=3){
   const triangle=[geometry.index.getX(i),geometry.index.getX(i+1),geometry.index.getX(i+2)];
   const distance=triangle.map(signed);
   if(distance.every(value=>value<=0))continue;
   const points=triangle.map(point),polygon=[];
   for(let j=0;j<3;j++){
    const k=(j+1)%3,a=distance[j],b=distance[k];
    if(a>=0)polygon.push(store(points[j]));
    if((a>=0)===(b>=0))continue;
    const fraction=a/(a-b);
    const edge=points[j].map((value,axis)=>value+(points[k][axis]-value)*fraction);
    polygon.push(store(edge));
   }
   for(let j=1;j+1<polygon.length;j++){
    const triangle=[polygon[0],polygon[j],polygon[j+1]];
    if(new Set(triangle).size===3)indices.push(...triangle);
   }
  }
 }
 if(!kane)addMusialaCurls(positions,indices,uv,skinIndex,skinWeight,head);
 const geometry=new THREE.BufferGeometry();

 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 if(!kane)return geometry;
 // The wider scalp patch gives the tapered sides room to fade. Compact the
 // underlying patch without spending any extra triangles on the match actor.
 geometry.userData.parts={crop:{start:0,count:positions.length/3,indexStart:0,indexCount:indices.length}};
 const optimized=simplifySkinnedGeometry(geometry,.013,{crop:{uvGrid:18}});
 geometry.dispose();
 return optimized;
}

export function likenessParts(raw,id){
 const variant={...raw};
 for(const part of ['face','skin','eyes','eyebrows'])variant[part]=sculptPart(raw[part],id);
 variant.crop=scalpHair(variant,id);
 return variant;
}
