import {honours} from './honours.js';
import {personalHonours} from './personal-honours.js';
import {roomSpecs} from './building-layout.js';
import {focusBox} from './interaction-focus.js';
const room=roomSpecs.museum,region=focusBox(room.x,room.y+2.2,room.z,room.w-.1,4.5,room.d-.1);
export const museumTargets=[
 ...honours.map(h=>{const x=room.x+h.x,z=room.z+h.z,y=room.y,award=h.kind==='shield'?focusBox(x,y+1.80,z,.30,1.02,.98):focusBox(x,y+(h.kind==='europe'?1.68:1.59),z,h.kind==='europe'?.53:.46,h.kind==='europe'?.83:.62,h.kind==='europe'?.93:.53);return{id:'honour'+h.year,type:'club',exhibit:h,reach:4.6,region,focusBoxes:[focusBox(x,y+.64,z,1.74,1.28,1.74),award],highlight:focusBox(x,y+1.29,z,1.78,2.58,1.78)};}),
 ...personalHonours.map(h=>{const bounds=focusBox(room.x+h.x,room.y+2.13,room.z+h.z,.72,3.94,2.66);return{id:'personal-'+h.id,type:'personal',exhibit:h,reach:5.2,region,focusBoxes:[bounds],highlight:bounds};}),
 {id:'museum-directory',type:'directory',reach:3.2,region,focusBoxes:[focusBox(room.x+7.30,room.y+2.1,room.z+2.65,.13,1.7,1.65)]}
];
