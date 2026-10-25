import {THREE,canvasTexture,mat,seeded} from './kit.js';

const cushions=new Map(),pipes=new Map(),fabrics=new Map();let weave;
export function cushionGeometry(w,h,d){
 const key=[w,h,d].join('|');if(cushions.has(key))return cushions.get(key);
 const g=new THREE.BoxGeometry(w,h,d,8,8,2),p=g.attributes.position,r=Math.min(.055,d*.38),half=new THREE.Vector3(w/2,h/2,d/2),inner=half.clone().addScalar(-r),a=new THREE.Vector3(),b=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  a.fromBufferAttribute(p,i);b.copy(a).clamp(inner.clone().negate(),inner);const n=a.clone().sub(b).normalize();a.copy(b).addScaledVector(n,r);
  const bulge=.012*Math.max(0,1-(a.x/half.x)**2)*Math.max(0,1-(a.y/half.y)**2);a.z+=Math.sign(a.z)*bulge;p.setXYZ(i,a.x,a.y,a.z);
 }
 g.computeVertexNormals();const normals=g.attributes.normal,shared=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(6)).join(','),entry=shared.get(key)||{normal:new THREE.Vector3(),ids:[]};entry.normal.add(new THREE.Vector3().fromBufferAttribute(normals,i));entry.ids.push(i);shared.set(key,entry);}for(const entry of shared.values()){entry.normal.normalize();for(const i of entry.ids)normals.setXYZ(i,entry.normal.x,entry.normal.y,entry.normal.z);}
 g.computeBoundingBox();g.computeBoundingSphere();cushions.set(key,g);return g;
}
export function pipingGeometry(w,h,d){
 const key=[w,h,d].join('|');if(pipes.has(key))return pipes.get(key);const a=w/2-.025,b=h/2-.025,r=Math.min(.035,a*.25,b*.25),points=[];
 for(let k=0;k<4;k++){const angle=k*Math.PI/2,cx=(k===0||k===3?1:-1)*(a-r),cy=(k<2?1:-1)*(b-r);for(let j=0;j<=4;j++){const t=angle+j*Math.PI/8;points.push(new THREE.Vector3(cx+Math.cos(t)*r,cy+Math.sin(t)*r,d/2+.002));}}
 const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),48,.0018,3,true);pipes.set(key,geometry);return geometry;
}
export function clothWeave(){
 if(weave)return weave;const random=seeded(2804);weave=canvasTexture(256,256,c=>{c.fillStyle='#b6b4ad';c.fillRect(0,0,256,256);for(let y=0;y<256;y+=4)for(let x=0;x<256;x+=4){c.fillStyle=(x/4+y/4)%2?'#dedbd1':'#8d8d88';c.fillRect(x,y,3,1);c.fillRect(x+1,y+1,1,3);}for(let i=0;i<6000;i++){c.fillStyle=i%2?'#ffffff18':'#00000010';c.fillRect(random()*256,random()*256,1,1);}});weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(3,3);weave.anisotropy=4;return weave;
}
export function fabricMaterial(color){
 if(fabrics.has(color))return fabrics.get(color);const map=clothWeave(),bump=map.clone();bump.colorSpace=THREE.NoColorSpace;const material=mat(color,{map,bumpMap:bump,bumpScale:.0025,roughness:.94,envMapIntensity:.09});fabrics.set(color,material);return material;
}
export function lockerBackingMaterial(){
 const map=canvasTexture(256,512,c=>{const g=c.createLinearGradient(0,0,256,0);g.addColorStop(0,'#4e4b4b');g.addColorStop(.12,'#a9a5a2');g.addColorStop(.5,'#eee9e2');g.addColorStop(.88,'#aaa5a0');g.addColorStop(1,'#4c4949');c.fillStyle=g;c.fillRect(0,0,256,512);const base=c.createLinearGradient(0,0,0,512);base.addColorStop(0,'#00000044');base.addColorStop(.25,'#00000000');base.addColorStop(.78,'#00000000');base.addColorStop(1,'#00000055');c.fillStyle=base;c.fillRect(0,0,256,512);});return mat(0x73162a,{map,roughness:.64});
}
