import {THREE} from './kit.js';
// Cluster inside each atlas region, retaining its UV seams and normalized skin weights.
// A character can reserve a finer grid for parts whose silhouette remains readable at a distance.
export function simplifySkinnedGeometry(source,cell=.04,parts={}){
 const values={position:[],normal:[],uv:[],skinIndex:[],skinWeight:[]},indices=[],ranges={};
 for(const[name,range]of Object.entries(source.userData.parts)){
  const partCell=parts[name]?.cell??cell,uvGrid=parts[name]?.uvGrid??(partCell>=.08?10:24);
  const clusters=new Map(),remap=new Map(),start=values.position.length/3;
  for(let i=range.start;i<range.start+range.count;i++){
   const p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv,skin=source.attributes.skinIndex,weights=source.attributes.skinWeight,key=[Math.round(p.getX(i)/partCell),Math.round(p.getY(i)/partCell),Math.round(p.getZ(i)/partCell),Math.floor(uv.getX(i)*uvGrid),Math.floor(uv.getY(i)*uvGrid)].join(',');
   let cluster=clusters.get(key);if(!cluster){cluster={index:start+clusters.size,count:0,p:[0,0,0],n:[0,0,0],uv:[0,0],weights:new Map()};clusters.set(key,cluster);}remap.set(i,cluster.index);cluster.count++;
   for(let j=0;j<3;j++){cluster.p[j]+=p.array[i*3+j];cluster.n[j]+=n.array[i*3+j];}for(let j=0;j<2;j++)cluster.uv[j]+=uv.array[i*2+j];for(let j=0;j<4;j++){const bone=skin.array[i*4+j],w=weights.array[i*4+j];cluster.weights.set(bone,(cluster.weights.get(bone)||0)+w);}
  }
  for(const c of clusters.values()){values.position.push(...c.p.map(x=>x/c.count));const length=Math.hypot(...c.n)||1;values.normal.push(...c.n.map(x=>x/length));values.uv.push(...c.uv.map(x=>x/c.count));const weights=[...c.weights].sort((a,b)=>b[1]-a[1]).slice(0,4);while(weights.length<4)weights.push([0,0]);const sum=weights.reduce((s,w)=>s+w[1],0)||1;values.skinIndex.push(...weights.map(w=>w[0]));values.skinWeight.push(...weights.map(w=>w[1]/sum));}
  ranges[name]={start,count:clusters.size};
  const seen=new Set(),sourceIndices=source.index.array,indexStart=range.indexStart??0,indexEnd=range.indexCount===undefined?sourceIndices.length:indexStart+range.indexCount;
  for(let i=indexStart;i<indexEnd;i+=3){const a=sourceIndices[i];if(a<range.start||a>=range.start+range.count)continue;const triangle=[a,sourceIndices[i+1],sourceIndices[i+2]].map(v=>remap.get(v));if(new Set(triangle).size<3)continue;const key=[...triangle].sort((a,b)=>a-b).join(',');if(!seen.has(key)){indices.push(...triangle);seen.add(key);}}
 }
 const geometry=new THREE.BufferGeometry();for(const[name,size]of Object.entries({position:3,normal:3,uv:2,skinIndex:4,skinWeight:4}))geometry.setAttribute(name,new THREE.BufferAttribute(name==='skinIndex'?new Uint16Array(values[name]):new Float32Array(values[name]),size));geometry.setIndex(indices);geometry.computeBoundingSphere();geometry.userData.parts=ranges;return geometry;
}
