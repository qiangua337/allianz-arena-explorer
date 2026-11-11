import {THREE} from './kit.js';

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

function bell(center,width,value){
 const t=(value-center)/width;
 return Math.exp(-t*t);
}

// Coordinates are in the shared athlete's rest pose, in metres. Each edit
// fades before the neck so the face and skin patches stay joined when posed.
function sculpt(id,x,y,z,target){
 if(y<=1.6)return target.set(x,y,z);
 const kane=id==='kane',ax=Math.abs(x),neck=ramp(1.60,1.65,y);
 const front=ramp(.064,.13,z),midface=ramp(.10,.16,z);
 const jaw=bell(1.663,.036,y),cheek=bell(1.712,.031,y);
 const nose=bell(1.707,.021,y)*bell(0,.021,x)*midface;
 const brow=bell(1.756,.014,y)*bell(.033,.026,ax)*front;
 const lips=bell(1.676,.012,y)*bell(0,.04,x)*midface;
 const cheekSide=cheek*bell(.052,.025,ax)*front;
 const width=1+neck*(kane?.075*jaw-.04*cheek:-.14*jaw+.035*cheek);
 const eyeLift=bell(1.744,.021,y)*bell(.037,.017,ax)*front;
 return target.set(
  x*(width+(kane?-.11:.14)*nose),
  y+neck*((kane?-.007:-.001)*jaw*front+(kane?0:.003)*eyeLift+(kane?-.002:.002)*lips),
  z+neck*((kane?.007:-.003)*nose+(kane?.0015:.001)*brow+(kane?-.003:.003)*cheekSide+(kane?-.003:.004)*lips)
 );
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

function hairline(x,z,id){
 const ax=Math.abs(x),front=ramp(.078,.145,z),back=1-ramp(-.034,.032,z);
 if(id==='kane')return 1.763+.027*front+.014*front*bell(.057,.022,ax)-.023*back;
 const curls=.0024*Math.sin(x*385)+.0011*Math.cos(x*693);
 return 1.765+(.020+curls)*front+.009*front*ramp(.038,.073,ax)-.020*back;
}

function addRinglets(geometry,positions,indices,uv,skinIndex,skinWeight,head){
 const surface=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const curl=new THREE.SphereGeometry(1,5,3),rays=new THREE.Raycaster();
 const point=new THREE.Vector3(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
 const origin=new THREE.Vector3(),front=new THREE.Vector3(0,0,-1),down=new THREE.Vector3(0,-1,0);
 const curlPosition=curl.attributes.position;
 function place(index,direction){
  rays.set(origin,direction);
  const hit=rays.intersectObject(surface,false)[0];
  if(!hit)return;
  hit.normal.normalize();
  const center=hit.point.addScaledVector(hit.normal,.0013),size=.0046+.0018*(.5+.5*Math.sin(index*2.21));
  rotation.setFromUnitVectors(up,hit.normal);
  const offset=positions.length/3;
  for(let i=0;i<curlPosition.count;i++){
   point.fromBufferAttribute(curlPosition,i);
   point.set(point.x*size,point.y*size*.84,point.z*size*(.76+.12*Math.cos(index*3.2))).applyQuaternion(rotation).add(center);
   positions.push(point.x,point.y,point.z);
   uv.push(Math.min(.98,Math.max(.02,hit.uv.x+curlPosition.getX(i)*.016)),Math.min(.97,Math.max(.19,hit.uv.y+curlPosition.getY(i)*.068)));
   skinIndex.push(head,0,0,0);skinWeight.push(1,0,0,0);
  }
  for(const vertex of curl.index.array)indices.push(offset+vertex);
 }
 for(let i=0;i<11;i++){
  const x=(i-5)*.012;
  origin.set(x,hairline(x,.147,'musiala')+.007+.004*Math.sin(i*1.81),.26);
  place(i,front);
 }
 for(let i=0;i<6;i++){
  const angle=i*Math.PI/3;
  origin.set(Math.sin(angle)*.028,1.95,.066+Math.cos(angle)*.052);
  place(i+11,down);
 }
 curl.dispose();surface.material.dispose();
}

function scalpHair(sculpted,id){
 const positions=[],indices=[],uv=[],skinIndex=[],skinWeight=[],vertexMap=new Map();
 const kane=id==='kane';
 // The shared rig stores the neck immediately before the head. These are
 // the only two influences on the scalp, including the clipped hairline.
 const head=sculpted.eyes.attributes.skinIndex.getX(0),neck=head-1;
 function store(point){
  const [x,y,z,nx,ny,nz]=point;
  const key=[x,y,z].map(n=>Math.round(n*1e6)).join(',');
  if(vertexMap.has(key))return vertexMap.get(key);
  const index=positions.length/3,depth=y-hairline(x,z,id);
  const root=ramp(0,.037,depth),front=ramp(.075,.145,z),volume=ramp(1.763,1.847,y);
  const strand=kane?Math.cos(x*328+(z-.05)*137)*.0035:
   Math.sin(x*747+z*533)*Math.sin(z*761-y*377)*.0038;
  const thickness=.0005+root*(.003+volume*(kane?.015:.013)+front*(kane?.013:.005)+strand);
  positions.push(x+nx*thickness+(kane?.005*root*front:0),y+ny*thickness,z+nz*thickness);
  uv.push(.5+x/.22,Math.max(.006,Math.min(.994,.006+depth/.083)));
  skinIndex.push(head,neck,0,0);skinWeight.push(point[6],1-point[6],0,0);
  vertexMap.set(key,index);
  return index;
 }

 for(const name of ['face','skin']){
  const geometry=sculpted[name],{position,normal,skinWeight}=geometry.attributes;
  const signed=index=>position.getY(index)-hairline(position.getX(index),position.getZ(index),id);
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
 const geometry=new THREE.BufferGeometry();
 if(!kane){
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  addRinglets(geometry,positions,indices,uv,skinIndex,skinWeight,head);
 }
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}

export function likenessParts(raw,id){
 const variant={...raw};
 for(const part of ['face','skin','eyes','eyebrows'])variant[part]=sculptPart(raw[part],id);
 variant.crop=scalpHair(variant,id);
 return variant;
}
