export const ENTRANCE_DURATION=44;
export const ENTRANCE_HOLD=4;
export const ENTRANCE_WALK_END=40;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

// The same west-side tunnel and treads used by ordinary first-person walking.
export function entranceFloor(x){return x<-45.9?-2.7:Math.min(0,-2.7+(Math.floor((x+45.9)/.36)+1)*.18);}
export function entranceTravelTime(start,end=-31){let x=start,time=0;for(const[limit,speed]of[[-45.9,1.3],[-40.5,.675],[end,1.25]]){const next=Math.min(end,limit);if(next>x){time+=(next-x)/speed;x=next;}}return time;}
export function entranceTravel(start,seconds,end=-31){let x=start,left=Math.max(0,seconds);for(const[limit,speed]of[[-45.9,1.3],[-40.5,.675],[end,1.25]]){const next=Math.min(end,limit);if(next<=x)continue;const duration=(next-x)/speed;if(left<duration)return x+left*speed;x=next;left-=duration;}return end;}
export function entranceSample(seconds,{reducedMotion=false}={}){
 const time=clamp(seconds,0,ENTRANCE_DURATION),progress=clamp((time-ENTRANCE_HOLD)/(ENTRANCE_WALK_END-ENTRANCE_HOLD)),x=entranceTravel(-67.4,progress*entranceTravelTime(-67.4)),reveal=smooth((x+44)/9),finish=smooth((time-ENTRANCE_WALK_END)/4),moving=time>ENTRANCE_HOLD&&time<ENTRANCE_WALK_END;
 const countdown=time<ENTRANCE_HOLD?Math.max(1,Math.ceil(ENTRANCE_HOLD-time)):0;
 const phase=countdown?'lineup':x<-46?'tunnel':x<-40.45?'stairs':time<ENTRANCE_WALK_END?'emerge':time<ENTRANCE_DURATION?'reveal':'free';
 const labels={lineup:'列队候场',tunnel:'跟随队友走向出口',stairs:'踏上场边台阶',emerge:'迎接全场欢呼',reveal:'这就是你的主场',free:'比赛日 · 自由漫游'};
 return{time,x,z:0,feet:entranceFloor(x),yaw:-Math.PI/2-finish*.19,pitch:.015+reveal*.075,bob:reducedMotion||!moving?0:Math.sin((time-ENTRANCE_HOLD)*Math.PI*3.3)*.022,fov:66+reveal*5,countdown,phase,label:labels[phase],reveal,moving,finished:time>=ENTRANCE_DURATION};
}
export function matchdayAcoustics(position){
 const x=position.x,z=position.z,nearTunnel=Math.abs(z)<3&&x>-76&&x<-35&&position.y<7;
 const openness=nearTunnel?smooth((x+53)/15):clamp(1-Math.max(0,Math.hypot(x,z)-45)/105,.08,1);
 return{openness,cutoff:650+openness*11350,gain:.22+openness*.48,reverb:.30-openness*.17};
}
