import {surfaceMaps} from './visual-assets.js';
import {THREE,mat,mesh,canvasTexture,seeded} from './kit.js';
export function buildPitchSurface(root,turf){
 const detail=surfaceMaps('grass',{channel:1,repeat:[.28,.28],strength:.15});
 if(!detail.normalMap){
  const random=seeded(1880);
  const fibres=canvasTexture(256,256,(c,w,h)=>{
   c.fillStyle='#888';c.fillRect(0,0,w,h);
   for(const tone of ['#a5a5a5','#686868']){
    c.fillStyle=tone;
    for(let i=0;i<6900;i++)c.fillRect(random()*w,random()*h,.45+random()*.45,.7+random()*2.6);
   }
  });
  fibres.wrapS=fibres.wrapT=THREE.RepeatWrapping;fibres.repeat.set(24,37);fibres.anisotropy=8;
  detail.bumpMap=fibres;detail.bumpScale=.012;
 }
 turf.anisotropy=8;
 const groundMaterial=mat(0xffffff,{map:turf,roughness:1,...detail});
 groundMaterial.userData.arenaPitch=true;
 const ground=mesh(new THREE.PlaneGeometry(72,111),groundMaterial,root,0,.005,0);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.name='Mown grass with painted pitch markings';
 // Only a small patch around a ground-level visitor has actual blades. The
 // distant field uses the same colour map, with no stadium-wide grass mesh.
 const blade=new THREE.InstancedBufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-.004,0,0,.004,0,0,-.002,.021,.002,.002,.021,.002,0,.036,.005],3));blade.setAttribute('normal',new THREE.Float32BufferAttribute([0,.5,1,0,.5,1,0,.6,1,0,.6,1,0,.8,1],3));blade.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,.6,1,.6,.5,1],2));blade.setIndex([0,1,2,1,3,2,2,3,4]);
 // Continue the original seed after its fibre strokes, so loading a normal
 // map or using the fallback places the grass blades at identical positions.
 const random=seeded(310691192),count=26000,offsets=new Float32Array(count*3);for(let i=0;i<count;i++){offsets[i*3]=(random()-.5)*8;offsets[i*3+1]=(random()-.5)*8;offsets[i*3+2]=random()*Math.PI*2;}blade.setAttribute('bladeOffset',new THREE.InstancedBufferAttribute(offsets,3));blade.instanceCount=16000;
 const center={value:new THREE.Vector2()},material=mat(0xffffff,{map:turf,roughness:1,side:THREE.DoubleSide});
 material.userData.arenaPitch=true;
 material.onBeforeCompile=shader=>{shader.uniforms.bladeCenter=center;shader.vertexShader='attribute vec3 bladeOffset;uniform vec2 bladeCenter;varying float bladeFade;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
float bladeCos=cos(bladeOffset.z),bladeSin=sin(bladeOffset.z);
objectNormal.xz=mat2(bladeCos,bladeSin,-bladeSin,bladeCos)*objectNormal.xz;`);shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
// A moving, faded window over an 8 m world-space tile. Only already invisible
// blades wrap at its edge; the grass at the visitor's feet stays rooted.
vec2 localOffset=mod(bladeOffset.xy-bladeCenter+4.,8.)-4.;
vec2 p=vec2(bladeCos*position.x-bladeSin*position.z,bladeSin*position.x+bladeCos*position.z)+localOffset+bladeCenter;
transformed=vec3(p.x,position.y+.008,p.y);vMapUv=vec2(p.x/72.+.5,.5-p.y/111.);bladeFade=1.-smoothstep(2.2,3.8,length(localOffset));
// The same fade test applies to every vertex of a blade. Collapse the fully
// discarded blades before rasterization instead of shading invisible grass.
transformed*=step(.15,bladeFade);`);shader.fragmentShader='varying float bladeFade;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vMapUv.x<.006||vMapUv.x>.994||vMapUv.y<.006||vMapUv.y>.994||bladeFade<.15)discard;');};material.customProgramCacheKey=()=> 'local-grass-fibres-v2';const tufts=mesh(blade,material,root);tufts.name='Nearby turf blades';tufts.frustumCulled=false;
 return{ground,update(camera,high=false,low=false,mobile=false){
  tufts.visible=!low&&camera.position.y<5&&camera.position.y>.3&&Math.abs(camera.position.x)<43&&Math.abs(camera.position.z)<62;
  // At phone resolution the baked grass remains visible between the closest
  // blades. Submitting fewer of them reduces overdraw at eye level.
  blade.instanceCount=mobile?(high?16000:8500):(high?26000:16000);
  center.value.set(camera.position.x,camera.position.z);
 }};
}
