import {THREE} from './kit.js';

// The sector split preserves triangle order. Simplify only complete cushions;
// a cushion crossing two sector bounds retains its original tessellation.
export function distantRoofCushions(geometry,sourceIndices,samples,rings){
 const panelVertices=1+samples*rings,fullIndexCount=samples*(2*rings-1)*3;
 const original=geometry.index.array,coarse=[];
 const panelAt=new Uint32Array(sourceIndices.size);
 for(const [originalVertex,localVertex] of sourceIndices){
  panelAt[localVertex]=Math.floor(originalVertex/panelVertices);
 }
 let start=0;
 while(start<original.length){
  const panel=panelAt[original[start]];
  let end=start+3;
  while(end<original.length&&panelAt[original[end]]===panel)end+=3;
  if(end-start!==fullIndexCount){
   for(let j=start;j<end;j++)coarse.push(original[j]);
  }else{
   // Retain the summit, first ring and every perimeter sample. Bridge the
   // first ring directly to the edge, using the original winding and normals.
   for(let j=start;j<start+3*samples;j++)coarse.push(original[j]);
   const inner=panel*panelVertices+1,outer=inner+(rings-1)*samples;
   for(let k=0;k<samples;k++){
    const next=(k+1)%samples,a=sourceIndices.get(inner+k),b=sourceIndices.get(inner+next);
    const c=sourceIndices.get(outer+k),d=sourceIndices.get(outer+next);
    coarse.push(a,b,c,b,d,c);
   }
  }
  start=end;
 }
 const result=new THREE.BufferGeometry();
 for(const [name,attribute] of Object.entries(geometry.attributes))result.setAttribute(name,attribute);
 result.setIndex(coarse);
 result.boundingSphere=geometry.boundingSphere;
 result.boundingBox=geometry.boundingBox;
 return result;
}
