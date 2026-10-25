import {roomSpecs} from './building-layout.js';

// A small analytic ambient-occlusion field supplements the two real lights.
// It follows existing room boundaries and adds no depth or post-process pass.
export function roomAmbientOcclusion(position,spec){
 const x=Math.abs(position.x-spec.x),z=Math.abs(position.z-spec.z),h=position.y-spec.y;
 if(x>spec.w/2+.24||z>spec.d/2+.24||h<-.2||h>4.7)return 1;
 const wall=Math.max(0,Math.min(spec.w/2-x,spec.d/2-z)),floor=Math.max(0,h),ceiling=Math.max(0,4.5-h);
 return Math.max(.48,1-.12*Math.exp(-floor/.55)-.12*Math.exp(-ceiling/.5)-.22*Math.exp(-wall/.48)*(Math.exp(-floor/1.3)+.6*Math.exp(-ceiling/1.1)));
}

const number=n=>Number(n).toFixed(3);
const rooms=Object.values(roomSpecs).map(s=>`{
 vec3 p=vArenaFinishPosition-vec3(${number(s.x)},${number(s.y)},${number(s.z)});
 if(abs(p.x)<${number(s.w/2+.24)}&&abs(p.z)<${number(s.d/2+.24)}&&p.y>-.2&&p.y<4.7){
  float wall=max(0.,min(${number(s.w/2)}-abs(p.x),${number(s.d/2)}-abs(p.z)));
  float floorH=max(0.,p.y),ceilingH=max(0.,4.5-p.y);
  float occlusion=max(.48,1.-.12*exp(-floorH/.55)-.12*exp(-ceilingH/.5)-.22*exp(-wall/.48)*(exp(-floorH/1.3)+.6*exp(-ceilingH/1.1)));
  float cove=(1.-smoothstep(0.,.65,ceilingH))*exp(-min(abs(p.x-${number(s.w*.29)}),abs(p.x+${number(s.w*.29)}))*2.1);
  return vec2(occlusion,cove);
 }
}`).join('\n');

export function installInteriorShading(root){
 const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.isMeshStandardMaterial&&!m.transparent)materials.add(m);});
 for(const material of materials){
  if(material.userData.interiorShading)continue;
  const before=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material),originalKey=cache();material.userData.interiorShading=true;
  material.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);shader.vertexShader='varying vec3 vArenaFinishPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 finishPosition=vec4(transformed,1.);
#ifdef USE_BATCHING
 finishPosition=batchingMatrix*finishPosition;
#endif
#ifdef USE_INSTANCING
 finishPosition=instanceMatrix*finishPosition;
#endif
vArenaFinishPosition=(modelMatrix*finishPosition).xyz;`);
   shader.fragmentShader=`varying vec3 vArenaFinishPosition;\nvec2 arenaRoomAtmosphere(){${rooms}\nreturn vec2(1.,0.);}\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
vec2 roomAtmosphere=arenaRoomAtmosphere();
reflectedLight.indirectDiffuse*=roomAtmosphere.x;
reflectedLight.indirectSpecular*=roomAtmosphere.x;
reflectedLight.directDiffuse*=mix(.84,1.,roomAtmosphere.x);
reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.28,.235,.18)*roomAtmosphere.y;`);
  };
  material.customProgramCacheKey=()=>originalKey+'|arena-room-atmosphere-v1';material.needsUpdate=true;
 }
 return materials.size;
}
