import {hitsWall} from './navigation.js';

// Only fixed walls enter the grid. Moving doors still use their live bounds.
export function indexWalkWalls(walls,cellSize=8){
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
 return (x,z,eyeY)=>{
  const walls=columns.get(cell(x))?.get(cell(z));
  return walls?hitsWall(x,z,eyeY,walls):false;
 };
}
