import {canStandAt,EYE_HEIGHT,floorHeight} from './navigation.js';

const key='arena-walk-checkpoint-v1';
const round=value=>Math.round(value*1000)/1000;

export function createWalkCheckpoint(storage){
 let lastWrite='';
 return{
  save({place,x,z,feet,yaw,pitch,guide,tour}){
   const data=JSON.stringify({
    place,x:round(x),z:round(z),feet:round(feet),
    yaw:round(Math.atan2(Math.sin(yaw),Math.cos(yaw))),pitch:round(pitch),
    arrived:guide.arrived===true,collapsed:guide.collapsed!==false,tour
   });
   if(lastWrite===data)return;
   try{storage?.setItem(key,data);lastWrite=data;}catch{}
  },
  load(place){
   try{
    const saved=JSON.parse(storage?.getItem(key)||'null');
    if(!saved||saved.place!==place)return null;
    const {x,z,feet,yaw,pitch}=saved;
    if(![x,z,feet,yaw,pitch].every(Number.isFinite))return null;
    if(Math.abs(x)>850||Math.abs(z)>850||feet<-16||feet>60||Math.abs(yaw)>3.142||Math.abs(pitch)>1.45)return null;
    return saved;
   }catch{return null;}
  }
 };
}

export function safeCheckpointFloor(saved,geometry,blocked){
 const {x,z,feet}=saved;
 const floor=floorHeight(x,z,feet,geometry);
 if(Math.abs(floor-feet)>.35||!canStandAt(x,z,floor,geometry)||blocked(x,z,floor+EYE_HEIGHT))return null;
 return floor;
}
