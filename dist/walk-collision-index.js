import {hitsWall} from './navigation.js';

function walkWallGrid(walls,cellSize){
 const columns=new Map();
 const cell=value=>Math.floor(value/cellSize);
 for(const wall of walls){
  let {x0,x1,z0,z1}=wall;
  if(wall.cx!==undefined){
   const c=Math.abs(Math.cos(wall.yaw)),s=Math.abs(Math.sin(wall.yaw));
   const dx=c*wall.halfW+s*wall.halfD,dz=s*wall.halfW+c*wall.halfD;
   x0=wall.cx-dx;x1=wall.cx+dx;z0=wall.cz-dz;z1=wall.cz+dz;
  }
  for(let ix=cell(x0);ix<=cell(x1);ix++){
   let rows=columns.get(ix);
   if(!rows)columns.set(ix,rows=new Map());
   for(let iz=cell(z0);iz<=cell(z1);iz++){
    let bin=rows.get(iz);
    if(!bin)rows.set(iz,bin=[]);
    bin.push(wall);
   }
  }
 }
 return {columns,cell};
}

// Only fixed walls enter the grid. Moving doors still use their live bounds.
export function indexWalkWalls(walls,cellSize=8){
 const {columns,cell}=walkWallGrid(walls,cellSize);
 return (x,z,eyeY)=>{
  const walls=columns.get(cell(x))?.get(cell(z));
  return walls?hitsWall(x,z,eyeY,walls):false;
 };
}

// A short guide segment normally touches only a few nearby cells. Leave long
// segment queries on the full list when scanning the grid would cost more.
export function indexWalkWallSegments(walls,cellSize=8){
 const {columns,cell}=walkWallGrid(walls,cellSize);
 return (minX,minZ,maxX,maxZ)=>{
  const x0=cell(minX),x1=cell(maxX),z0=cell(minZ),z1=cell(maxZ);
  if((x1-x0+1)*(z1-z0+1)>=walls.length)return walls;
  const nearby=new Set();
  for(let x=x0;x<=x1;x++){
   const rows=columns.get(x);
   if(!rows)continue;
   for(let z=z0;z<=z1;z++){
    const bin=rows.get(z);
    if(bin)for(const wall of bin)nearby.add(wall);
   }
  }
  return nearby;
 };
}
