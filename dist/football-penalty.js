const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const axis=value=>Number.isFinite(value)?clamp(value,-1,1):0;

export function safePenaltyAim(value){return{x:axis(value?.x),y:axis(value?.y)};}

export function penaltyTarget(value,goalZ){
 const {x,y}=safePenaltyAim(value);
 return{x:x*3.34*(goalZ<0?1:-1),y:1.20+y*.97,z:goalZ};
}

export function penaltyCanShoot(penalty){
 return penalty?.stage==='ready'&&penalty.keeperReady!==false&&penalty.time+1e-6>=(penalty.kickAllowedAt??0);
}

export function penaltyFlight(ball,goalZ,value,power,random){
 const target=penaltyTarget(value,goalZ),over=Math.max(0,(power-.76)/.24),spread=.08+over*.59;
 const x=target.x+(random()*2-1)*spread,y=Math.max(.14,target.y+(random()*2-1)*spread*.65+over*.25);
 const distance=Math.abs(goalZ-ball.z),speed=16+power*18,flight=-Math.log(1-distance*.08/speed)/.08;
 return{x,y,z:goalZ,distance,vx:(x-ball.x)*speed/distance,vz:Math.sign(goalZ-ball.z)*speed,vy:(y-ball.y)/flight+4.905*Math.max(0,flight-1/60)};
}

export const penaltyDiveHeight=value=>1.16+axis(value)*.81;

export function penaltyDiveDirection(value,velocity){
 return Number.isFinite(value)?Math.abs(value)>.12?Math.sign(value):0:Math.abs(velocity)>.2?Math.sign(velocity):0;
}

export const penaltyKeeperSpeed=6.9;

export function moveHumanPenaltyKeeper(keeper,goalZ,time,input,dt,movePlayer){
 const g=keeper.keeperState,sign=Math.sign(goalZ),line=goalZ-sign*.12;
 if((g.phase==='dive'||g.phase==='set')&&time>=g.diveUntil)g.phase='recover';
 if(g.phase==='recover'&&time>=g.recoverUntil){g.phase='ready';g.committed=false;g.direction=0;}
 const diving=g.phase==='dive';
 movePlayer(keeper,diving?g.direction:g.phase==='recover'?0:axis(input?.x),0,diving?penaltyKeeperSpeed:3.6,dt);
 keeper.x=clamp(keeper.x,-3.55,3.55);keeper.z=line;keeper.vz=0;keeper.yaw=sign<0?0:Math.PI;
}
