import {roomSpecs} from './building-layout.js';

const bands=[
 {inner:[86,104],outer:[116,132],floor:-2.9,ceiling:5.4,arcade:true},
 {inner:[85,103],outer:[105,122],floor:12.2,ceiling:16.8}
];
const ringValue=(x,z,a,b)=>(Math.abs(x)/a)**2.8+(Math.abs(z)/b)**2.8;
const softContact=(height,width)=>1/(1+(height/width)**2);

// Restrained wall-to-floor and soffit contact shading remains visible with
// mobile shadows disabled. The open arrival apron keeps its outdoor lighting.
export function publicAmbientOcclusion(position){
 const {x,y,z}=position;
 for(const band of bands){
  if(y<band.floor-.2||y>band.ceiling+.2)continue;
  const a=band.arcade&&x<0?86+8*Math.max(0,Math.min(1,(70-Math.abs(z))/18)):band.inner[0];
  const inner=ringValue(x,z,a,band.inner[1]),outer=ringValue(x,z,...band.outer);
  if(inner<.992||outer>1.01)continue;
  const wall=Math.max(0,(inner-1)*Math.min(a,band.inner[1])/2.8);
  const lower=softContact(Math.max(0,y-band.floor),.8);
  const upper=softContact(Math.max(0,band.ceiling-y),.7);
  const contact=.07*lower+.1*upper+.23*softContact(wall,.7)*(lower+.65*upper);
  const edge=Math.max(0,Math.min(1,(1-outer)*Math.min(...band.outer)/5.6));
  return 1-contact*edge*edge*(3-2*edge);
 }
 return 1;
}

// A small analytic ambient-occlusion field supplements the two real lights.
// It follows existing room boundaries and adds no depth or post-process pass.
export function roomAmbientOcclusion(position,spec){
 const x=Math.abs(position.x-spec.x),z=Math.abs(position.z-spec.z),h=position.y-spec.y;
 if(x>spec.w/2+.24||z>spec.d/2+.24||h<-.2||h>4.7)return 1;
 const wall=Math.max(0,Math.min(spec.w/2-x,spec.d/2-z)),floor=Math.max(0,h),ceiling=Math.max(0,4.5-h);
 return Math.max(.48,1-.12*Math.exp(-floor/.55)-.12*Math.exp(-ceiling/.5)-.22*Math.exp(-wall/.48)*(Math.exp(-floor/1.3)+.6*Math.exp(-ceiling/1.1)));
}

const number=n=>Number(n).toFixed(3);
const publicBands=bands.map(s=>`{
 if(p.y>${number(s.floor-.2)}&&p.y<${number(s.ceiling+.2)}){
  float a=${number(s.inner[0])};
  ${s.arcade?'if(p.x<0.)a+=8.*clamp((70.-abs(p.z))/18.,0.,1.);':''}
  float inner=pow(abs(p.x)/a,2.8)+pow(abs(p.z)/${number(s.inner[1])},2.8);
  float outer=pow(abs(p.x)/${number(s.outer[0])},2.8)+pow(abs(p.z)/${number(s.outer[1])},2.8);
  if(inner>=.992&&outer<=1.01){
   float wall=max(0.,(inner-1.)*min(a,${number(s.inner[1])})/2.8);
   float lower=max(0.,p.y-(${number(s.floor)}))/.8;
   float upper=max(0.,${number(s.ceiling)}-p.y)/.7;
   lower=1./(1.+lower*lower);upper=1./(1.+upper*upper);
   float contact=.07*lower+.1*upper+.23/(1.+wall*wall/.49)*(lower+.65*upper);
   float edge=clamp((1.-outer)*${number(Math.min(...s.outer))}/5.6,0.,1.);
   return vec2(1.-contact*edge*edge*(3.-2.*edge),0.);
  }
 }
}`).join('\n');
const rooms=Object.values(roomSpecs).map(s=>`{
 vec3 p=vArenaFinishPosition-vec3(${number(s.x)},${number(s.y)},${number(s.z)});
 if(!matched&&abs(p.x)<${number(s.w/2+.24)}&&abs(p.z)<${number(s.d/2+.24)}&&p.y>-.2&&p.y<4.7){
  float wall=max(0.,min(${number(s.w/2)}-abs(p.x),${number(s.d/2)}-abs(p.z)));
  float floorH=max(0.,p.y),ceilingH=max(0.,4.5-p.y);
  float occlusion=max(.48,1.-.12*exp(-floorH/.55)-.12*exp(-ceilingH/.5)-.22*exp(-wall/.48)*(exp(-floorH/1.3)+.6*exp(-ceilingH/1.1)));
  float cove=(1.-smoothstep(0.,.65,ceilingH))*exp(-min(abs(p.x-${number(s.w*.29)}),abs(p.x+${number(s.w*.29)}))*2.1);
  atmosphere=vec2(occlusion,cove);matched=true;
 }
}`).join('\n');

export function installInteriorShading(root,{publicOnly=false}={}){
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
   shader.fragmentShader=`varying vec3 vArenaFinishPosition;\nvec2 arenaRoomAtmosphere(){vec2 atmosphere=vec2(1.,0.);${publicOnly?'':`bool matched=false;${rooms}\nif(matched)return atmosphere;`}vec3 p=vArenaFinishPosition;${publicBands}\nreturn atmosphere;}\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
vec2 roomAtmosphere=arenaRoomAtmosphere();
reflectedLight.indirectDiffuse*=roomAtmosphere.x;
reflectedLight.indirectSpecular*=roomAtmosphere.x;
reflectedLight.directDiffuse*=mix(.84,1.,roomAtmosphere.x);
reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.28,.235,.18)*roomAtmosphere.y;`);
  };
  material.customProgramCacheKey=()=>originalKey+(publicOnly?'|arena-public-atmosphere-v3':'|arena-room-atmosphere-v3');material.needsUpdate=true;
 }
 return materials.size;
}
