import {surfaceMaps} from './visual-assets.js';
import {THREE,canvasTexture,mat,mesh,seeded,superpoint,TAU} from './kit.js';
import {architecturalMaterials} from './surface-finishes.js';

export function landscapeMaterials(){
 const random=seeded(7391),make=(base,grass)=>{const texture=canvasTexture(512,512,c=>{c.fillStyle=base;c.fillRect(0,0,512,512);
  if(grass)for(let i=0;i<95;i++){const x=random()*512,y=random()*512,r=12+random()*62,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'#aeae6720':'#1f382020');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  for(let i=0;i<22000;i++){const x=random()*512,y=random()*512;c.fillStyle=i%2?'#e8e9c71c':'#17221b20';c.fillRect(x,y,grass?.5:1,grass?1+random()*3:1);}
 });texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.channel=1;texture.repeat.setScalar(grass?1/8:1/5);texture.anisotropy=4;return texture;};
 const grass=make('#708052',true),asphalt=make('#4b5050',false);
 return{concrete:architecturalMaterials().stone,grass:mat(0xffffff,{map:grass,bumpMap:grass,bumpScale:.025,roughness:1,...surfaceMaps('grass',{channel:1,repeat:[.22,.22],strength:.22})}),road:mat(0xffffff,{map:asphalt,bumpMap:asphalt,bumpScale:.012,roughness:.96})};
}

// Static spill on the paving uses one instanced draw for every lamp. No
// additional real-time lights or full-screen bloom are needed on mobile.
export function buildNightGroundSpill(root,lampPositions){
 const glow=canvasTexture(128,128,c=>{const g=c.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'#fff4d2b0');g.addColorStop(.4,'#ffe2b14a');g.addColorStop(1,'#ffe2b100');c.fillStyle=g;c.fillRect(0,0,128,128);});
 const material=new THREE.MeshBasicMaterial({map:glow,color:0xffe2b5,transparent:true,opacity:.26,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(9,12),material,lampPositions.length),dummy=new THREE.Object3D();lampPositions.forEach((p,i)=>{dummy.position.copy(p);dummy.position.y+=.085;dummy.rotation.set(-Math.PI/2+(p.z>140&&p.y<-3.01?Math.atan(8.5/543):0),0,0);dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);});pools.computeBoundingSphere();pools.name='Baked esplanade light pools';pools.renderOrder=2;root.add(pools);
 const points=[],colors=[],index=[],rings=[[115,131,0],[122,138,.7],[136,152,.16],[148,165,0]],segments=128;
 rings.forEach(([a,b,alpha],r)=>{for(let i=0;i<=segments;i++){const p=superpoint(a,b,i/segments*TAU,2.8);points.push(p.x,-2.965,p.z);colors.push(1,1,1,alpha);if(r&&i){const k=r*(segments+1)+i,j=k-(segments+1);index.push(j-1,k-1,j,j,k-1,k);}}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(index);g.computeVertexNormals();
 const wash=mesh(g,new THREE.MeshBasicMaterial({color:0xed2446,vertexColors:true,transparent:true,opacity:.25,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),root);wash.name='Red facade spill on the perimeter paving';wash.renderOrder=2;
 return{objects:[pools,wash],setNight(value){pools.visible=wash.visible=value;}};
}
