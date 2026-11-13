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

export const penaltyDiveLead=.13;
export const penaltyPowerRisk=.76;
export const penaltyStandardPower=.62;

export function penaltyFlight(ball,goalZ,value,power,random,finishing=90){
 const target=penaltyTarget(value,goalZ);
 const over=clamp((power-penaltyPowerRisk)/(1-penaltyPowerRisk),0,1);
 const accuracy=1+clamp((90-finishing)*.012,-.12,.55);
 const spread=(.065+over*.70)*accuracy,heightSpread=spread*.63;
 const x=target.x+(random()*2-1)*spread;
 const y=Math.max(.14,target.y+(random()*2-1)*heightSpread+over*.30);
 const distance=Math.abs(goalZ-ball.z),speed=16+power*18,flight=-Math.log(1-distance*.08/speed)/.08;
 return{x,y,z:goalZ,distance,spread,heightSpread,vx:(x-ball.x)*speed/distance,vz:Math.sign(goalZ-ball.z)*speed,vy:(y-ball.y)/flight+4.905*Math.max(0,flight-1/60)};
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
 // Keep the selected side, then plant at the end of the dive instead of sliding past the ball.
 const reach=(g.targetX-keeper.x)*g.direction;
 const drive=diving?g.direction*clamp(reach/.67,0,1):g.phase==='ready'?axis(input?.x):0;
 movePlayer(keeper,drive,0,diving?penaltyKeeperSpeed:3.6,dt);
 keeper.x=clamp(keeper.x,-3.55,3.55);keeper.z=line;keeper.vz=0;keeper.yaw=sign<0?0:Math.PI;
}
