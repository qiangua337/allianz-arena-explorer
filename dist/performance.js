import {THREE,v} from './kit.js';
import {roomSpecs} from './building-layout.js';
// Fixed shader light count: walking past a fixture never recompiles all materials.
export function buildLightBudget(scene){
 const rooms=Object.entries(roomSpecs),zoneAt=p=>rooms.find(([,s])=>Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2&&p.y>=s.y-.15&&p.y<s.y+5.5)?.[0]||null;
 // Fixtures do not move. Keep each room's candidates in traversal order, so a
 // walk through one room never scans or sorts the rest of the stadium's lamps.
 const zones=new Map();scene.traverse(o=>{if(o.isPointLight||o.isSpotLight){o.layers.set(1);if(o.isPointLight){const position=o.getWorldPosition(v()),zone=zoneAt(position),fixture={light:o,position};if(!zones.has(zone))zones.set(zone,[]);zones.get(zone).push(fixture);}}});
 const pool=Array.from({length:2},()=>{const light=new THREE.SpotLight(0xffead0,0,30,Math.PI*.49,.48,2);scene.add(light,light.target);return light;});let clock=1;const targets=[null,null];
 const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 return{lights:pool,update(position,dt){clock+=dt;if(clock>=.25){clock=0;targets[0]=targets[1]=null;let first=1200,second=1200;const fixtures=zones.get(zoneAt(position));if(fixtures)for(const f of fixtures){if(!(f.light.intensity>0)||!shown(f.light))continue;const distance=f.position.distanceToSquared(position);if(distance<first){second=first;targets[1]=targets[0];first=distance;targets[0]=f;}else if(distance<second){second=distance;targets[1]=f;}}}
  const blend=1-Math.exp(-Math.min(dt,.25)*10);let animating=false;pool.forEach((l,i)=>{const f=targets[i],target=f?.light.intensity||0;if(f){if(l.intensity<.1)l.position.copy(f.position);else l.position.lerp(f.position,blend);l.color.lerp(f.light.color,blend);l.distance=f.light.distance;l.decay=f.light.decay;l.target.position.set(l.position.x,l.position.y-8,l.position.z);}l.intensity+=(target-l.intensity)*blend;if(Math.abs(target-l.intensity)>.03||f&&l.position.distanceToSquared(f.position)>.0001)animating=true;});return animating;
 }};
}
