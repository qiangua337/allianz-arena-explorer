import * as THREE from 'three';
import {HDRLoader} from './vendor/HDRLoader.js';

const textures=new Map();
export const surfaceBundle={concrete:['normal','rough'],wood:['diff','normal','rough'],fabric:['normal','rough'],rubber:['normal','rough'],plaster:['normal','rough'],grass:['normal','rough']};
export const textureResolution=width=>width<=1024?512:1024;
export function applySurfaceQuality(root,quality){
 const seen=new Set();root.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:[o.material]){
  if(!material?.isMeshStandardMaterial||seen.has(material))continue;seen.add(material);
  if(!material.userData.surfaceDetail&&material.normalMap)material.userData.surfaceDetail={normalMap:material.normalMap,roughnessMap:material.roughnessMap};
  const detail=material.userData.surfaceDetail;if(!detail)continue;const normal=quality==='low'?null:detail.normalMap,roughness=quality==='low'?null:detail.roughnessMap;
  if(material.normalMap!==normal||material.roughnessMap!==roughness){material.normalMap=normal;material.roughnessMap=roughness;material.needsUpdate=true;}
 }});
}
// Map copies share their uploaded image, while UV scale and channel remain local.
export function surfaceMaps(name,{channel=0,repeat=[1,1],strength=.2,albedo=false}={}){
 const result={};for(const[kind,slot]of[['diff','map'],['normal','normalMap'],['rough','roughnessMap']]){
  const source=textures.get(name+'-'+kind);if(!source||kind==='diff'&&!albedo)continue;
  const t=source.clone();t.channel=channel;t.repeat.set(...repeat);t.needsUpdate=true;result[slot]=t;
 }
 if(result.normalMap)result.normalScale=new THREE.Vector2(strength,strength);
 if(result.normalMap)Object.assign(result,{bumpMap:null,bumpScale:0});return result;
}
export async function loadVisualAssets(renderer,{width=innerWidth,progress=()=>{}}={}){
 const manager=new THREE.LoadingManager(),loader=new THREE.TextureLoader(manager),hdr=new HDRLoader(manager),environments={},backgrounds={};let loaded=0;
 const entries=Object.entries(surfaceBundle).flatMap(([name,channels])=>channels.map(kind=>[name,kind]));
 const total=entries.length+3,failed=[];const done=()=>progress(++loaded,total);
 const tasks=entries.map(async([name,kind])=>{
  try{const texture=await loader.loadAsync(new URL('./assets/pbr/'+name+'-'+kind+'.jpg',import.meta.url).href);
   const size=textureResolution(width);if(texture.image.width>size&&typeof createImageBitmap==='function')texture.image=await createImageBitmap(texture.image,{resizeWidth:size,resizeHeight:size,resizeQuality:'high'});
   texture.colorSpace=kind==='diff'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;textures.set(name+'-'+kind,texture);
  }catch{failed.push(name+'-'+kind);}finally{done();}
 });
 const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 // Generate all three from 1K HDR sources: switching time of day reuses the same shader layout.
 tasks.push(...['day','night','indoor'].map(async(name)=>{try{
  const texture=await hdr.loadAsync(new URL('./assets/pbr/'+name+'-hdr.hdr',import.meta.url).href);texture.mapping=THREE.EquirectangularReflectionMapping;
  environments[name]=pmrem.fromEquirectangular(texture).texture;if(name!=='indoor')backgrounds[name]=texture;else texture.dispose();
 }catch{failed.push(name+'-hdr');}finally{done();}}));
 await Promise.all(tasks);pmrem.dispose();
 const outdoor=new Set();return{environments,failed,resolution:textureResolution(width),
  registerOutdoor(...roots){for(const root of roots)root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.isMeshStandardMaterial)outdoor.add(m);});},
  setTime(scene,night){const name=night?'night':'day',environment=environments[name];if(!environment)return false;scene.environment=environment;scene.environmentIntensity=.4;
   for(const m of outdoor){m.envMap=environment;if(!m.userData.realEnvironment){m.envMapIntensity=Math.min(m.envMapIntensity??1,.45);m.userData.realEnvironment=true;m.needsUpdate=true;}}
   if(backgrounds[name]){scene.background=backgrounds[name];scene.backgroundIntensity=night?.015:.7;scene.backgroundRotation.y=.65;return true;}return false;
  }
 };
}
