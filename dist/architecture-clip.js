import {THREE} from './kit.js';

// Subtract room footprints from shared circulation meshes. Keeping those
// meshes present through a doorway must not paint their floors over a room.
export function subtractFootprints(geometry,rectangles){
 const source=geometry.index?geometry.toNonIndexed():geometry,attributes=Object.entries(source.attributes).filter(([,a])=>a.itemSize<=4),output=Object.fromEntries(attributes.map(([name])=>[name,[]]));
 function clip(polygon,axis,boundary,inside){const out=[];if(!polygon.length)return out;let a=polygon.at(-1),da=(a.position[axis]-boundary)*inside;
  for(const b of polygon){const db=(b.position[axis]-boundary)*inside;if((da>=-1e-7)!==(db>=-1e-7)){const t=da/(da-db),v={};for(const[name]of attributes)v[name]=a[name].map((x,i)=>x+(b[name][i]-x)*t);out.push(v);}if(db>=-1e-7)out.push(b);a=b;da=db;}return out;
 }
 for(let i=0;i<source.attributes.position.count;i+=3){let pieces=[Array.from({length:3},(_,j)=>Object.fromEntries(attributes.map(([name,a])=>[name,Array.from(a.array.slice((i+j)*a.itemSize,(i+j+1)*a.itemSize))])))] ;
  for(const r of rectangles){const next=[];for(let polygon of pieces){for(const[axis,boundary,side]of [[0,r.minX,1],[0,r.maxX,-1],[2,r.minZ,1],[2,r.maxZ,-1]]){const outside=clip(polygon,axis,boundary,-side);if(outside.length>=3)next.push(outside);polygon=clip(polygon,axis,boundary,side);if(polygon.length<3)break;}}pieces=next;}
  for(const p of pieces)for(let j=1;j<p.length-1;j++)for(const v of [p[0],p[j],p[j+1]])for(const[name]of attributes)output[name].push(...v[name]);
 }
 const result=new THREE.BufferGeometry();for(const[name,a]of attributes)result.setAttribute(name,new THREE.Float32BufferAttribute(output[name],a.itemSize));result.normalizeNormals();result.computeBoundingBox();result.computeBoundingSphere();if(source!==geometry)source.dispose();return result;
}
