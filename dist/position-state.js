// Turning in place redraws the scene but does not change architectural
// visibility. Exact coordinates preserve even the smallest boundary crossing.
export function positionStateChanged(){
 let x=NaN,y=NaN,z=NaN,previous;
 return(position,state=0)=>{
  if(position.x===x&&position.y===y&&position.z===z&&state===previous)return false;
  x=position.x;y=position.y;z=position.z;previous=state;return true;
 };
}
