import {THREE,canvasTexture,mat,seeded} from './kit.js';
let palette;
export function architecturalMaterials(){
 if(palette)return palette;const random=seeded(6517);
 const texture=(base,joints=false)=>{const t=canvasTexture(512,512,c=>{c.fillStyle=base;c.fillRect(0,0,512,512);for(let i=0;i<26000;i++){c.fillStyle=i%2?'#ffffff09':'#10202a07';c.fillRect(random()*512,random()*512,random()*1.3+.4,random()*1.3+.4);}if(joints){c.strokeStyle='#15202b20';c.lineWidth=1.3;for(const p of [0,256,512]){c.beginPath();c.moveTo(p,0);c.lineTo(p,512);c.moveTo(0,p);c.lineTo(512,p);c.stroke();}c.strokeStyle='#ffffff18';c.lineWidth=1;c.strokeRect(2,2,252,252);c.strokeRect(258,258,252,252);}});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/2.4,1/2.4);t.channel=1;t.anisotropy=4;return t;};
 const stone=texture('#b6bab8',true),paint=texture('#f0efe9'),rubber=texture('#b4b5b2',true);
 palette={stone:mat(0xd4d8d4,{map:stone,bumpMap:stone,bumpScale:.012,roughness:.9}),charcoal:mat(0x50585b,{map:rubber,bumpMap:rubber,bumpScale:.008,roughness:.91}),plaster:mat(0xe1ded3,{map:paint,bumpMap:paint,bumpScale:.006,roughness:.94}),warmPlaster:mat(0xe5dfce,{map:paint,bumpMap:paint,bumpScale:.006,roughness:.93})};return palette;
}
// Secondary UVs are in metres. Colour, grain and grout stay the same size
// across a long wall or a narrow step without changing jersey/sign UVs.
export function applyArchitecturalUV(root){
 root.updateWorldMatrix(true,true);const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||![o.material.map,o.material.bumpMap].some(t=>t?.channel===1))return;const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);normalMatrix.getNormalMatrix(o.matrixWorld);
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix);const axis=Math.abs(normal.y)>.7?1:Math.abs(normal.x)>Math.abs(normal.z)?0:2;uv[i*2]=axis===0?point.z:point.x;uv[i*2+1]=axis===1?point.z:point.y;}g.setAttribute('uv1',new THREE.BufferAttribute(uv,2));
 });
}
