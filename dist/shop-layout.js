import {roomSpecs} from './building-layout.js';

// Metres relative to the shop floor. Rendering, body clearance, route planning
// and the interactive display all read this layout.
export const shopRails=Array.from({length:6},(_,i)=>({id:'rail'+i,x:-7+(i%2)*13,z:-3+Math.floor(i/2)*3.1,w:4.3,d:.72,height:2.5,numbers:[9,10,17,14,6]}));
export const shopWallDisplays=[];
for(const side of[-1,1])for(let row=0;row<7;row++){
 const z=-5+row*1.6;if(side>0&&Math.abs(z)<2.5)continue;
 shopWallDisplays.push({id:'wall'+side+'-'+row,x:side*13.65,z,side,w:.85,d:1.35,height:2.65});
}
export const shopCheckout={x:2,z:5,w:5.5,d:1.6,height:1.8};
// The circular plinth and its clearance stay unchanged when the shirt turns.
// 1.26m puts the 12cm base plate exactly on the 12.2m shop floor.
export const shopFeature={x:10,z:0,y:1.26,radius:.68,clearance:1.36,height:2.02,numbers:[9,10,17,14,6]};
export function shopWorld(x,y,z){const s=roomSpecs.store;return{x:s.x+x,y:s.y+y,z:s.z+z};}
