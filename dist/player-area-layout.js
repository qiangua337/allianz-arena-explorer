// One envelope for rendered floors, walls and walking support. Metres.
export const playerCorridor={minX:-72.8,maxX:-66.7,minZ:-41,maxZ:49,y:-2.7,height:3.7};
export const playerShower={minX:-91.5,maxX:-72.5,minZ:37,maxZ:47,y:-2.7,height:4.4};
export function containsFloor(area,x,z,margin=0){return x>area.minX-margin&&x<area.maxX+margin&&z>area.minZ-margin&&z<area.maxZ+margin;}
const c=playerCorridor,wall=(x,z,w,d)=>({x,z,w,d,y0:c.y,y1:c.y+c.height});
export const corridorWalls=[
 // Full-height end caps and the east wall, open only at the player tunnel.
 wall((c.minX+c.maxX)/2,c.minZ,6.1,.18),
 wall((c.minX+c.maxX)/2,c.maxZ,6.1,.18),
 wall(c.maxX,(c.minZ-2.5)/2,.18,-2.5-c.minZ),
 wall(c.maxX,(c.maxZ+2.5)/2,.18,c.maxZ-2.5),
 // Room facades fill the remaining west side; these close the gaps between them.
 wall(-72.5,-40.5,.18,1),wall(-72.5,-16,.18,12),
 wall(-72.5,14.5,.18,9),wall(-72.5,43,.18,12)
];
// Adjacent room envelopes must survive distance culling: their open doorways
// are visible along the corridor even when the room's furniture is far away.
export function inPlayerArea(position){return position.x>-96&&position.x<-29&&position.z>-45&&position.z<53&&position.y>-4&&position.y<8;}
export function tunnelHasBowlView(position){return position.x>-93&&position.x<-29&&Math.abs(position.z)<3.5&&position.y>-3&&position.y<8;}
export const privateRoomIds=new Set(['homeRoom','guestRoom','press']);
export function playerShellVisible(key,position,detailsVisible=false){return detailsVisible||privateRoomIds.has(key)&&inPlayerArea(position);}
