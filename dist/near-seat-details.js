import {THREE,mat,mergeGeometry} from './kit.js';

function solidGrid(surface,axis,thickness,steps=6){
 const positions=[],index=[],size=steps+1,layer=size*size;
 for(let side=0;side<2;side++)for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){const p=surface(i/steps,j/steps);p[axis]+=side*thickness;positions.push(p.x,p.y,p.z);}
 for(let side=0;side<2;side++)for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const a=side*layer+j*size+i,b=a+1,c=a+size,d=c+1;index.push(...(side?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
 const boundary=[];for(let i=0;i<steps;i++)boundary.push(i);for(let j=0;j<steps;j++)boundary.push(j*size+steps);for(let i=steps;i>0;i--)boundary.push(steps*size+i);for(let j=steps;j>0;j--)boundary.push(j*size);
 for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];index.push(a,b,a+layer,b,b+layer,a+layer);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(index);geometry.computeVertexNormals();return geometry;
}
export function seatShellGeometry(steps){
 const pan=solidGrid((u,v)=>{const x=u*2-1,z=v*2-1;return{x:x*.2175*(1-.09*v),y:.23+.018*x*x+.012*z*z,z:z*.2};},'y',-.028,steps);
 const back=solidGrid((u,v)=>{const x=u*2-1;return{x:x*.2175*(.88+.12*v),y:.27+.49*v-.022*Math.abs(x)**6*v**5,z:.17+.05*v-.045*x*x};},'z',.026,steps);
 return mergeGeometry([pan,back]);
}
export function detailedSeatGeometry(steps=6){
 const shell=seatShellGeometry(steps),parts=[];for(const[w,h,d,x,y,z]of[[.34,.025,.12,0,-.17,.13],[.06,.38,.06,0,.025,.13],[.38,.035,.055,0,.19,.13],[.028,.2,.03,-.18,.34,.20],[.028,.2,.03,.18,.34,.20]])parts.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
 return{shell,frame:mergeGeometry(parts)};
}
export function createSeatIndex(seats){
 const cells=new Map(),cellSize=8,key=(x,y,z)=>x+'|'+y+'|'+z;
 for(const seat of seats){const k=key(Math.floor(seat.x/cellSize),Math.floor(seat.y/cellSize),Math.floor(seat.z/cellSize)),list=cells.get(k)||[];list.push(seat);cells.set(k,list);}
 return{query(position,radius=6,capacity=192){
  const candidates=[],distances=[],radiusSquared=radius*radius;
  const bounds=value=>[Math.floor((value-radius)/cellSize),Math.floor((value+radius)/cellSize)];
  const [x0,x1]=bounds(position.x),[y0,y1]=bounds(position.y),[z0,z1]=bounds(position.z);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++){
   const cell=cells.get(key(x,y,z));if(!cell)continue;
   for(const seat of cell){
    const distance=distanceSquaredToSeat(seat,position);
    if(distance<radiusSquared){candidates.push(seat);distances.push(distance);}
   }
  }
  if(!candidates.length||capacity<1)return{seats:[],radius:0};
  if(candidates.length<=capacity)return{seats:candidates,radius};
  const sorted=distances.slice().sort((a,b)=>a-b);
  const cutoff=Math.max(0,Math.sqrt(sorted[capacity-1])-.002),cutoffSquared=cutoff*cutoff;
  return{seats:candidates.filter((_,i)=>distances[i]<cutoffSquared),radius:cutoff};
 }};
}
function distanceSquaredToSeat(seat,position){return(seat.x-position.x)**2+(seat.y-position.y)**2+(seat.z-position.z)**2;}
export function buildNearSeatDetails(root,seats,baseMaterial){
 const geometry=detailedSeatGeometry(),compactShell=seatShellGeometry(3),plastic=new THREE.InstancedMesh(geometry.shell,mat(0xffffff,{roughness:.45,metalness:.04,envMapIntensity:.18,side:THREE.DoubleSide}),384),frame=new THREE.InstancedMesh(geometry.frame,mat(0x394048,{metalness:.48,roughness:.48}),384),focus={value:new THREE.Vector3()},radius={value:0},index=createSeatIndex(seats),dummy=new THREE.Object3D(),color=new THREE.Color();
 plastic.setColorAt(0,new THREE.Color(0xffffff));plastic.receiveShadow=frame.receiveShadow=true;plastic.name='Nearby moulded seating shells';frame.name='Nearby seat mounting frames';root.add(plastic,frame);plastic.count=frame.count=0;plastic.visible=frame.visible=false;const before=baseMaterial.onBeforeCompile,key=baseMaterial.customProgramCacheKey();
 const dynamicBuffers=[plastic.instanceMatrix,frame.instanceMatrix,plastic.instanceColor];
 for(const buffer of dynamicBuffers)buffer.setUsage(THREE.DynamicDrawUsage);
 // A translated near-seat patch fits the query sphere plus one seat at any yaw.
 // Reuse that conservative bound rather than transforming every seat twice.
 const maxGeometryReach=Math.max(...[geometry.shell,compactShell,geometry.frame].map(g=>{
  g.computeBoundingSphere();return g.boundingSphere.center.length()+g.boundingSphere.radius;
 }));
 plastic.boundingSphere=frame.boundingSphere=new THREE.Sphere();
 baseMaterial.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);shader.uniforms.nearSeatFocus=focus;shader.uniforms.nearSeatRadius=radius;shader.vertexShader='varying vec3 vNearSeatOrigin;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvNearSeatOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;');shader.fragmentShader='varying vec3 vNearSeatOrigin;uniform vec3 nearSeatFocus;uniform float nearSeatRadius;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(nearSeatRadius>0.&&distance(vNearSeatOrigin,nearSeatFocus)<nearSeatRadius)discard;');};baseMaterial.customProgramCacheKey=()=>key+'|near-seat-replacement-v1';
 const last=new THREE.Vector3(Infinity,0,0);let lastCapacity=0,lastSeats=[];
 return{get count(){return plastic.count;},update(position,enabled=true,capacity=192,compact=false){
  if(!enabled){plastic.visible=frame.visible=false;plastic.count=frame.count=0;radius.value=0;last.x=Infinity;return;}
  plastic.geometry=compact?compactShell:geometry.shell;
  if(last.distanceToSquared(position)<.09&&lastCapacity===capacity)return;
  last.copy(position);lastCapacity=capacity;
  const result=index.query(position,6,Math.min(384,capacity));
  focus.value.copy(position);radius.value=result.radius;
  plastic.count=frame.count=result.seats.length;plastic.visible=frame.visible=plastic.count>0;
  plastic.boundingSphere.center.copy(position);plastic.boundingSphere.radius=result.radius+maxGeometryReach;
  if(result.seats.length===lastSeats.length&&result.seats.every((seat,i)=>lastSeats[i]===seat))return;
  lastSeats=result.seats;
  result.seats.forEach((s,i)=>{dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,s.yaw,0);dummy.updateMatrix();plastic.setMatrixAt(i,dummy.matrix);frame.setMatrixAt(i,dummy.matrix);plastic.setColorAt(i,color.setHex(s.color));});
  if(!plastic.count)return;
  for(const buffer of dynamicBuffers){
   buffer.clearUpdateRanges();buffer.addUpdateRange(0,plastic.count*buffer.itemSize);buffer.needsUpdate=true;
  }
 }};
}
