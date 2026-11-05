import {THREE,v,mat,mesh} from './kit.js';

export function footballPanelGeometry(radius=.11){
 const source=new THREE.IcosahedronGeometry(1,0),p=source.attributes.position,points=[],triangles=[],lookup=new Map();
 for(let i=0;i<p.count;i+=3){const ids=[];for(let j=0;j<3;j++){const point=v().fromBufferAttribute(p,i+j),key=point.toArray().map(x=>x.toFixed(5)).join(',');if(!lookup.has(key)){lookup.set(key,points.length);points.push(point);}ids.push(lookup.get(key));}triangles.push(ids);}source.dispose();
 const neighbours=points.map(()=>new Set());for(const face of triangles)for(const a of face)for(const b of face)if(a!==b)neighbours[a].add(b);
 const polygons=[];
 for(let i=0;i<points.length;i++){
  const n=points[i].clone().normalize(),u=(Math.abs(n.y)>.9?v(1,0,0):v(0,1,0)).cross(n).normalize(),w=n.clone().cross(u),ring=[...neighbours[i]].map(j=>points[i].clone().multiplyScalar(2).add(points[j]).normalize());
  ring.sort((a,b)=>Math.atan2(a.dot(w),a.dot(u))-Math.atan2(b.dot(w),b.dot(u)));polygons.push({ring,dark:true});
 }
 for(const [a,b,c]of triangles){const ring=[];for(const [i,j]of [[a,b],[b,c],[c,a]]){ring.push(points[i].clone().multiplyScalar(2).add(points[j]).normalize(),points[j].clone().multiplyScalar(2).add(points[i]).normalize());}polygons.push({ring,dark:false});}
 const positions=[],normals=[],colors=[];
 const triangle=(a,b,c,depth,color)=>{if(depth){const ab=a.clone().add(b).normalize(),bc=b.clone().add(c).normalize(),ca=c.clone().add(a).normalize();triangle(a,ab,ca,depth-1,color);triangle(ab,b,bc,depth-1,color);triangle(ca,bc,c,depth-1,color);triangle(ab,bc,ca,depth-1,color);return;}for(const point of [a,b,c]){positions.push(point.x*radius,point.y*radius,point.z*radius);normals.push(...point.toArray());colors.push(...color);}};
 for(const {ring,dark}of polygons){const center=ring.reduce((n,p)=>n.add(p),v()).normalize(),trimmed=ring.map(p=>p.clone().lerp(center,.012).normalize());for(let i=0;i<ring.length;i++)triangle(center,trimmed[i],trimmed[(i+1)%ring.length],2,dark?[.028,.035,.040]:[.88,.90,.85]);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();geometry.userData.panels={pentagons:12,hexagons:20};return geometry;
}
export function buildMatchBall(parent){
 const ball=mesh(footballPanelGeometry(),mat(0xffffff,{vertexColors:true,roughness:.51,metalness:.02}),parent,0,.115,0);ball.name='Spherical 32-panel football with recessed seams';mesh(new THREE.SphereGeometry(.1095,24,16),mat(0x323a3b,{roughness:.88}),ball);ball.castShadow=ball.receiveShadow=true;return ball;
}
