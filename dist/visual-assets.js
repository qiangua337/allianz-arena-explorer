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
export async function loadVisualAssets(renderer,{width=innerWidth,night=false,progress=()=>{}}={}){
 const manager=new THREE.LoadingManager(),loader=new THREE.TextureLoader(manager),hdr=new HDRLoader(manager),environments={},backgrounds={};let loaded=0;
 const entries=Object.entries(surfaceBundle).flatMap(([name,channels])=>channels.map(kind=>[name,kind]));
 const size=textureResolution(width),anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const total=entries.length+2,failed=[];const done=()=>progress(++loaded,total);
 const tasks=entries.map(async([name,kind])=>{
  const stem=name+'-'+kind,source=new URL('./assets/pbr/'+stem+'.jpg',import.meta.url).href;
  try{
   const texture=size===512
    ?await loader.loadAsync(new URL('./assets/pbr/mobile/'+stem+'.webp',import.meta.url).href).catch(()=>loader.loadAsync(source))
    :await loader.loadAsync(source);
   if(texture.image.width>size&&typeof createImageBitmap==='function')texture.image=await createImageBitmap(texture.image,{resizeWidth:size,resizeHeight:size,resizeQuality:'high'});
   texture.colorSpace=kind==='diff'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=anisotropy;texture.needsUpdate=true;textures.set(stem,texture);
  }catch{failed.push(name+'-'+kind);}finally{done();}
 });
 const timeName=isNight=>isNight?'night':'day';
 async function loadEnvironment(name,startupGenerator){
  const entry=name+'-hdr';
  let texture,generator=startupGenerator;
  try{
   texture=await hdr.loadAsync(new URL('./assets/pbr/'+entry+'.hdr',import.meta.url).href);
   texture.mapping=THREE.EquirectangularReflectionMapping;
   generator??=new THREE.PMREMGenerator(renderer);
   environments[name]=generator.fromEquirectangular(texture).texture;
   if(name!=='indoor')backgrounds[name]=texture;
   const previousFailure=failed.indexOf(entry);
   if(previousFailure!==-1)failed.splice(previousFailure,1);
   return true;
  }catch{
   if(!failed.includes(entry))failed.push(entry);
   return false;
  }finally{
   if(!backgrounds[name])texture?.dispose();
   if(!startupGenerator)generator?.dispose();
  }
 }

 const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 tasks.push(...[timeName(night),'indoor'].map(name=>loadEnvironment(name,pmrem).finally(done)));
 await Promise.all(tasks);pmrem.dispose();
 // Loading the alternate sky waits for an actual time-of-day change.
 // Repeated toggles share the same request, and a failed request can retry.
 const pending=new Map(),outdoor=new Set();
 return{environments,failed,resolution:size,
  registerOutdoor(...roots){for(const root of roots)root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.isMeshStandardMaterial)outdoor.add(m);});},
  setTime(scene,night){
   const name=timeName(night),environment=environments[name]??environments.indoor;
   if(environment){
    scene.environment=environment;scene.environmentIntensity=.4;
    for(const material of outdoor){
     material.envMap=environment;
     if(!material.userData.realEnvironment){material.envMapIntensity=Math.min(material.envMapIntensity??1,.45);material.userData.realEnvironment=true;material.needsUpdate=true;}
    }
   }
   scene.background=backgrounds[name]??null;
   scene.backgroundIntensity=night?.015:.7;
   scene.backgroundRotation.y=.65;
   return !!scene.background;
  },
  prepareTime(night){
   const name=timeName(night);
   if(environments[name])return Promise.resolve(true);
   if(!pending.has(name))pending.set(name,loadEnvironment(name).finally(()=>pending.delete(name)));
   return pending.get(name);
  },
 };
}
