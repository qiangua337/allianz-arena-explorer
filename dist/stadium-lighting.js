// An inexpensive diffuse floodlight fill stays attached to the bowl materials.
// Looking in from a dark tunnel therefore cannot darken the entire field.
export function buildBowlLighting(root){
 const intensity={value:0},materials=new Set();root.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])if(material?.isMeshStandardMaterial)materials.add(material);});
 for(const material of materials){
  const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);shader.uniforms.arenaFloodFill=intensity;shader.fragmentShader='uniform float arenaFloodFill;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*arenaFloodFill;');};
  material.customProgramCacheKey=()=>key+'|arena-fixed-floodlight-v1';material.needsUpdate=true;
 }
 return{night(value){intensity.value=value?.30:0;}};
}
