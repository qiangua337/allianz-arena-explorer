const profiles={
 kane:{upperWidth:.105,upperDepth:.15,hipWidth:.045,hipDepth:.07},
 musiala:{upperWidth:-.075,upperDepth:-.085,hipWidth:-.035,hipDepth:-.065}
};

function ease(low,high,value){
 const t=Math.max(0,Math.min(1,(value-low)/(high-low)));
 return t*t*(3-2*t);
}

// Apply the same continuous rest-space shape to skin and clothing. It tapers
// out before the wrists, collar and knees so the shared rig and boots still fit.
export function shapeFootballBody(parts,identity){
 const profile=profiles[identity];
 if(!profile)return parts;
 const shaped={...parts};
 for(const name of ['skin','shirt','shorts']){
  const geometry=parts[name].clone(),positions=geometry.attributes.position,normals=geometry.attributes.normal;
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
   const upper=ease(1.02,1.31,y)*(1-ease(1.48,1.59,y))*(1-ease(.28,.46,Math.abs(x)));
   const hip=ease(.72,.96,y)*(1-ease(1.04,1.27,y));
   const width=1+upper*profile.upperWidth+hip*profile.hipWidth;
   const depth=1+upper*profile.upperDepth+hip*profile.hipDepth;
   if(width===1&&depth===1)continue;
   positions.setXYZ(i,x*width,y,.025+(z-.025)*depth);
   const nx=normals.getX(i)/width,ny=normals.getY(i),nz=normals.getZ(i)/depth;
   const length=Math.hypot(nx,ny,nz)||1;
   normals.setXYZ(i,nx/length,ny/length,nz/length);
  }
  shaped[name]=geometry;
 }
 return shaped;
}
