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
 const ground=groundHeight(x,z),floors=[ground];
 if(within(x,z,116,132,2.8)&&!within(x,z,42,60,2.8))floors.push(-2.9);
 if(Math.abs(x)<41.5&&Math.abs(z)<60)floors.push(0);
 if(x>-72.8&&x<-40.45&&Math.abs(z)<2.5){
  floors.push(x<-45.9?-2.7:Math.min(0,-2.7+(Math.floor((x+45.9)/.36)+1)*.18));
 }
 if(x>-72.8&&x<-66.7&&z>-41&&z<49)floors.push(-2.7);
 if(x>-91.5&&x<-72.5&&z>37&&z<47)floors.push(-2.7);
 for(const[key,s]of Object.entries(rooms))if(inRoom(x,z,s)){
  const rise=key==='press'&&z>-32.64?Math.max(0,Math.min(5,Math.floor((z+32.64)/1.28)))*.14:0;
  floors.push(s.y+rise);
 }
 if(within(x,z,105,122,2.8)&&!within(x,z,77,95,2.8))floors.push(12.2);
 for(const tier of tiers){
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
 return colliders.some(b=>isVisible(b.owner)&&x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1&&eyeY>b.y0+.2&&eyeY-EYE_HEIGHT<b.y1);
}
