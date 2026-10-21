import {THREE,v} from './kit.js';
// Fixed shader light count: walking past a fixture never recompiles all materials.
export function buildLightBudget(scene){
 const fixtures=[];scene.traverse(o=>{if(o.isPointLight||o.isSpotLight){o.layers.set(1);if(o.isPointLight)fixtures.push({light:o,position:o.getWorldPosition(v())});}});
 const pool=Array.from({length:2},()=>{const light=new THREE.PointLight(0xffead0,0,30,2);scene.add(light);return light;});let clock=1;
 const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 return{update(position,dt){clock+=dt;if(clock<.25)return;clock=0;const nearby=fixtures.filter(f=>shown(f.light)&&f.light.intensity>0&&f.position.distanceToSquared(position)<1200).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position));pool.forEach((l,i)=>{const f=nearby[i];l.intensity=f?f.light.intensity:0;if(f){l.position.copy(f.position);l.color.copy(f.light.color);l.distance=f.light.distance;l.decay=f.light.decay;}});}};
}
