import {roomSpecs} from './building-layout.js';
// The interpreted fit-outs occupy real volumes. The curved ETFE skin must
// never cut through their floors, display cases or visitor sightlines.
export const fitoutVolumes=['museum','store','lounge'].map(id=>{
 const r=roomSpecs[id];return{id,minX:r.x-r.w/2-.12,maxX:r.x+r.w/2+.12,minY:r.y-.2,maxY:r.y+4.65,minZ:r.z-r.d/2-.12,maxZ:r.z+r.d/2+.12};
});
export const insideFitout=p=>fitoutVolumes.some(r=>p.x>r.minX&&p.x<r.maxX&&p.y>r.minY&&p.y<r.maxY&&p.z>r.minZ&&p.z<r.maxZ);
export const fitoutShaderCuts=fitoutVolumes.map(r=>`if(all(greaterThan(vPortalPosition,vec3(${r.minX.toFixed(3)},${r.minY.toFixed(3)},${r.minZ.toFixed(3)})))&&all(lessThan(vPortalPosition,vec3(${r.maxX.toFixed(3)},${r.maxY.toFixed(3)},${r.maxZ.toFixed(3)}))))discard;`).join('\n');
