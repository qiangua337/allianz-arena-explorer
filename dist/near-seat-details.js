import {THREE,mat,mergeGeometry} from './kit.js';

function solidGrid(surface,axis,thickness,steps=6){
 const positions=[],index=[],size=steps+1,layer=size*size;
 for(let side=0;side<2;side++)for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){const p=surface(i/steps,j/steps);p[axis]+=side*thickness;positions.push(p.x,p.y,p.z);}
 for(let side=0;side<2;side++)for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const a=side*layer+j*size+i,b=a+1,c=a+size,d=c+1;index.push(...(side?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
 const boundary=[];for(let i=0;i<steps;i++)boundary.push(i);for(let j=0;j<steps;j++)boundary.push(j*size+steps);for(let i=steps;i>0;i--)boundary.push(steps*size+i);for(let j=steps;j>0;j--)boundary.push(j*size);
 for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];index.push(a,b,a+layer,b,b+layer,a+layer);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(index);geometry.computeVertexNormals();return geometry;
}
export function detailedSeatGeometry(){
 const pan=solidGrid((u,v)=>{const x=u*2-1,z=v*2-1;return{x:x*.2175*(1-.09*v),y:.23+.018*x*x+.012*z*z,z:z*.2};},'y',-.028);
 const back=solidGrid((u,v)=>{const x=u*2-1;return{x:x*.2175*(.88+.12*v),y:.27+.49*v-.022*Math.abs(x)**6*v**5,z:.17+.05*v-.045*x*x};},'z',.026);
 const shell=mergeGeometry([pan,back]),parts=[];for(const[w,h,d,x,y,z]of[[.34,.025,.12,0,-.17,.13],[.06,.38,.06,0,.025,.13],[.38,.035,.055,0,.19,.13],[.028,.2,.03,-.18,.34,.20],[.028,.2,.03,.18,.34,.20]])parts.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
 return{shell,frame:mergeGeometry(parts)};
}
export function createSeatIndex(seats){
 const cells=new Map(),key=(x,y,z)=>[x,y,z].map(n=>Math.floor(n/8)).join('|');for(const seat of seats){const k=key(seat.x,seat.y,seat.z),list=cells.get(k)||[];list.push(seat);cells.set(k,list);}
 return{query(position,radius=6,capacity=192){const candidates=[],cx=Math.floor(position.x/8),cy=Math.floor(position.y/8),cz=Math.floor(position.z/8),range=Math.ceil(radius/8);
  for(let x=cx-range;x<=cx+range;x++)for(let y=cy-range;y<=cy+range;y++)for(let z=cz-range;z<=cz+range;z++)for(const seat of cells.get([x,y,z].join('|'))||[]){const distance=(seat.x-position.x)**2+(seat.y-position.y)**2+(seat.z-position.z)**2;if(distance<radius*radius)candidates.push({seat,distance});}
  candidates.sort((a,b)=>a.distance-b.distance);const cutoff=candidates.length>capacity?Math.max(0,Math.sqrt(candidates[capacity-1].distance)-.002):radius;return{seats:candidates.filter(c=>c.distance<cutoff*cutoff).map(c=>c.seat),radius:candidates.length?cutoff:0};
 }};
}
export function buildNearSeatDetails(root,seats,baseMaterial){
 const geometry=detailedSeatGeometry(),plastic=new THREE.InstancedMesh(geometry.shell,mat(0xffffff,{roughness:.45,metalness:.04,envMapIntensity:.18,side:THREE.DoubleSide}),384),frame=new THREE.InstancedMesh(geometry.frame,mat(0x394048,{metalness:.48,roughness:.48}),384),focus={value:new THREE.Vector3()},radius={value:0},index=createSeatIndex(seats),dummy=new THREE.Object3D();
 plastic.setColorAt(0,new THREE.Color(0xffffff));plastic.receiveShadow=frame.receiveShadow=true;plastic.name='Nearby moulded seating shells';frame.name='Nearby seat mounting frames';root.add(plastic,frame);plastic.count=frame.count=0;plastic.visible=frame.visible=false;const before=baseMaterial.onBeforeCompile,key=baseMaterial.customProgramCacheKey();
 baseMaterial.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);shader.uniforms.nearSeatFocus=focus;shader.uniforms.nearSeatRadius=radius;shader.vertexShader='varying vec3 vNearSeatOrigin;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvNearSeatOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;');shader.fragmentShader='varying vec3 vNearSeatOrigin;uniform vec3 nearSeatFocus;uniform float nearSeatRadius;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(nearSeatRadius>0.&&distance(vNearSeatOrigin,nearSeatFocus)<nearSeatRadius)discard;');};baseMaterial.customProgramCacheKey=()=>key+'|near-seat-replacement-v1';
 let last=new THREE.Vector3(Infinity,0,0),lastCapacity=0;
 return{get count(){return plastic.count;},update(position,enabled=true,capacity=192){
  if(!enabled){plastic.visible=frame.visible=false;plastic.count=frame.count=0;radius.value=0;last.x=Infinity;return;}
  if(last.distanceToSquared(position)<.09&&lastCapacity===capacity)return;last.copy(position);lastCapacity=capacity;const result=index.query(position,6,Math.min(384,capacity));focus.value.copy(position);radius.value=result.radius;plastic.count=frame.count=result.seats.length;plastic.visible=frame.visible=plastic.count>0;
  result.seats.forEach((s,i)=>{dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,s.yaw,0);dummy.updateMatrix();plastic.setMatrixAt(i,dummy.matrix);frame.setMatrixAt(i,dummy.matrix);plastic.setColorAt(i,new THREE.Color(s.color));});
  for(const mesh of[plastic,frame]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}if(plastic.instanceColor)plastic.instanceColor.needsUpdate=true;
 }};
}
