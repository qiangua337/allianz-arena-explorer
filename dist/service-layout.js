import {perimeterFrames} from './access-layout.js';

// Representative ancillary rooms behind the public concourse service doors.
export const serviceRooms=perimeterFrames(85.2,103.2,16).filter(f=>!(f.z<-98&&Math.abs(f.x)<5)).map(f=>({
 id:'service'+f.index,x:f.x+f.normal.x*.16,z:f.z+f.normal.z*.16,nx:f.normal.x,nz:f.normal.z,yaw:f.yaw,y:12.2,width:4.9,depth:4.2,type:f.index%2?'supplies':'equipment'
}));
export function serviceCoordinates(room,x,z){const dx=x-room.x,dz=z-room.z;return{side:dx*room.nz-dz*room.nx,depth:-(dx*room.nx+dz*room.nz)};}
export const serviceWorld=(r,x,z)=>({x:r.x+r.nz*x+r.nx*z,z:r.z-r.nx*x+r.nz*z});
const cells=new Map(),key=(x,z)=>Math.floor(x/12)+','+Math.floor(z/12);
for(const r of serviceRooms){const corners=[];for(const x of[-r.width/2-.9,r.width/2+.9])for(const z of[1,-r.depth-1])corners.push(serviceWorld(r,x,z));const x0=Math.floor(Math.min(...corners.map(p=>p.x))/12),x1=Math.floor(Math.max(...corners.map(p=>p.x))/12),z0=Math.floor(Math.min(...corners.map(p=>p.z))/12),z1=Math.floor(Math.max(...corners.map(p=>p.z))/12);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(r);}}
export function serviceRoomAt(position,margin=0){if(Math.abs(position.y-12.2)>=2)return;for(const r of cells.get(key(position.x,position.z))||[]){const p=serviceCoordinates(r,position.x,position.z);if(Math.abs(p.side)<r.width/2+margin&&p.depth>.08-margin&&p.depth<r.depth+margin)return r;}}
export function serviceDoorOpening(x,z){return(cells.get(key(x,z))||[]).some(r=>{const p=serviceCoordinates(r,x,z);return Math.abs(p.side)<1.86&&Math.abs(p.depth)<.9;});}
