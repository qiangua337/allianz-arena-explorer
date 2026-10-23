import {buildingFloors,inCoreShaft,onBridge,bridges,platforms} from './building-layout.js';
import {accessAt,accessHeight,ACCESS_BASE,ACCESS_TOP} from './access-layout.js';
import {visitorFloor,inVisitorPassage} from './tour-route.js';
import {serviceRoomAt} from './service-layout.js';
// Heights are in metres. Pick the floor reachable from the current level,
// rather than the topmost stand whose footprint overlaps the player.
export const EYE_HEIGHT=1.7;
export const MAX_STEP=.8;
export const mainEntrance={x:0,z:214,look:[0,0,174]};
export const esplanadeHeight=z=>-3-Math.max(0,Math.min(1,(z-140)/543))*8.5;
const within=(x,z,a,b,n)=>Math.pow(Math.abs(x)/a,n)+Math.pow(Math.abs(z)/b,n)<=1;
const inRoom=(x,z,s)=>Math.abs(x-s.x)<s.w/2&&Math.abs(z-s.z)<s.d/2;

export function groundHeight(x,z){
 let height=-12.2;
 if(within(x,z,151,169,2.8))height=-3;
 if(Math.abs(x)<=68&&z>=134&&z<=677)height=Math.max(height,esplanadeHeight(z)+.055);
 return height;
}

export function floorHeight(x,z,feetY,{tiers=[],rooms={}}={}){
 const ground=groundHeight(x,z),floors=[ground,...buildingFloors(x,z)];
 if(within(x,z,121,139,2.8)&&!within(x,z,72,90,2.8))floors.push(ACCESS_BASE);
 const stair=accessAt(x,z),stairFloor=accessHeight(x,z);
 if(stairFloor!==null)floors.push(stairFloor);
 const passageFloor=visitorFloor(x,z);if(passageFloor!==null)floors.push(passageFloor);
 const inPlayerTunnel=x>-72.8&&x<-40.45&&Math.abs(z)<2.5;
 if(Math.abs(x)<41.5&&Math.abs(z)<60&&!inPlayerTunnel)floors.push(0);
 if(inPlayerTunnel){
  floors.push(x<-45.9?-2.7:Math.min(0,-2.7+(Math.floor((x+45.9)/.36)+1)*.18));
 }
 if(x>-72.8&&x<-66.7&&z>-41&&z<49)floors.push(-2.7);
 if(x>-91.5&&x<-72.5&&z>37&&z<47)floors.push(-2.7);
 for(const[key,s]of Object.entries(rooms))if(inRoom(x,z,s)){
  const rise=key==='press'&&z>-32.64?Math.max(0,Math.min(5,Math.floor((z+32.64)/1.28)))*.14:0;
  floors.push(s.y+rise);
 }
 const roomFloor=Object.values(rooms).some(s=>inRoom(x,z,s)&&Math.abs(feetY-s.y)<1.2);
 if(!roomFloor&&!inCoreShaft(x,z)&&within(x,z,105,122,2.8)&&!within(x,z,85,103,2.8)&&(!stair||stair.along>stair.stair.run-.45))floors.push(ACCESS_TOP);
 for(const tier of tiers){
  if(inCoreShaft(x,z,.15))continue;
  if(passageFloor!==null&&tier.y<1)continue;
  const depth=tier.rows*tier.depth;
  if(within(x,z,tier.a+depth,tier.b+depth,3.35)&&!within(x,z,tier.a,tier.b,3.35)){
   let lo=0,hi=depth;
   for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(within(x,z,tier.a+mid,tier.b+mid,3.35))hi=mid;else lo=mid;}
   floors.push(tier.y+Math.floor((lo+.03)/tier.depth)*tier.depth*Math.tan(tier.angle*Math.PI/180));
  }
 }
 const reachable=floors.filter(height=>height<=feetY+MAX_STEP+.001);
 return reachable.length?Math.max(...reachable):ground;
}

export function hitsWall(x,z,eyeY,colliders,isVisible=()=>true){
 return colliders.some(b=>{
  if(b.enabled===false||!isVisible(b.owner)||eyeY<=b.y0+.2||eyeY-EYE_HEIGHT>=b.y1)return false;
  if(b.cx===undefined)return x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1;
  const dx=x-b.cx,dz=z-b.cz,c=Math.cos(b.yaw),s=Math.sin(b.yaw);
  return Math.abs(dx*c-dz*s)<b.halfW&&Math.abs(dx*s+dz*c)<b.halfD;
 });
}

export function canStandAt(x,z,feetY,{rooms={},tiers=[]}={}){
 if(serviceRoomAt({x,y:feetY,z}))return true;
 if(inVisitorPassage(x,z)||inCoreShaft(x,z)||bridges.some(b=>onBridge(x,z,b)!==null)||platforms.some(p=>Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2))return true;
 if(accessAt(x,z)||Object.values(rooms).some(s=>inRoom(x,z,s)&&Math.abs(feetY-s.y)<2))return true;
 if(tiers.some(t=>feetY>=t.y-.15&&feetY<t.y+t.rows*t.depth*Math.tan(t.angle*Math.PI/180)+.9&&within(x,z,t.a+t.rows*t.depth,t.b+t.rows*t.depth,3.35)&&!within(x,z,t.a,t.b,3.35)))return true;
 if(feetY>9)return within(x,z,105,122,2.8)&&!within(x,z,85,103,2.8);
 if(!within(x,z,86,104,2.8)||Math.abs(x)<41.5&&Math.abs(z)<60)return true;
 return x>-72.8&&x<-40.45&&Math.abs(z)<2.5||x>-72.8&&x<-66.7&&z>-41&&z<49||x>-91.5&&x<-72.5&&z>37&&z<47;
}
