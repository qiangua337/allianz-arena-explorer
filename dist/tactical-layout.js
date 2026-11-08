import {roomSpecs} from './building-layout.js';
import {focusBox} from './interaction-focus.js';

// The visible magnetic board and its picking surface share this one layout.
// These are training diagrams, not a claim about the current starting XI.
export const tacticalBoardLayout=Object.freeze({width:2.5,height:1.4,y:2.1,z:-4.3,inset:.29,textureWidth:1000,textureHeight:560});
const back=[['GK',.085,.50],['LB',.27,.14],['CB',.25,.38],['CB',.25,.62],['RB',.27,.86]];
export const tacticalFormations=[
 {name:'4–2–3–1',roles:[...back,['DM',.46,.35],['DM',.46,.65],['LW',.66,.16],['AM',.65,.50],['RW',.66,.84],['ST',.84,.50]]},
 {name:'4–4–2',roles:[...back,['LM',.53,.14],['CM',.51,.38],['CM',.51,.62],['RM',.53,.86],['ST',.79,.34],['ST',.79,.66]]}
];
export function tacticalBoardPlacement(roomId){
 const s=roomSpecs[roomId],b=tacticalBoardLayout;
 return{x:s.x+s.w/2-b.inset,y:s.y+b.y,z:s.z+b.z};
}
export function tacticalBoardTarget(roomId){
 const s=roomSpecs[roomId],b=tacticalBoardLayout,p=tacticalBoardPlacement(roomId);
 return{id:'tactics-'+roomId,roomId,p:[p.x,p.y,p.z],reach:2.8,
  region:{x0:s.x-s.w/2+.12,x1:s.x+s.w/2-.12,y0:s.y+.2,y1:s.y+4.4,z0:s.z-s.d/2+.12,z1:s.z+s.d/2-.12},
  focusBoxes:[focusBox(p.x,p.y,p.z,.04,b.height,b.width)],
  hitTest(origin,ray){
   // The board faces west. Neither its rear nor a nearby point in the corridor
   // is a usable control surface, even when the coarse box is intersected.
   if(origin.x>=p.x||ray.x<=1e-8)return null;
   const distance=(p.x-origin.x)/ray.x,y=origin.y+ray.y*distance,z=origin.z+ray.z*distance;
   return Math.abs(y-p.y)<=b.height/2&&Math.abs(z-p.z)<=b.width/2?distance:null;
  }
 };
}
