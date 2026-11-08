import {turnFootballer,pressureTarget} from './football-assist.js';
import {receivingPoint} from './football-tactics.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function continuesReceiveIntent(input,receive){const strength=Math.hypot(input.x||0,input.z||0),original=Math.hypot(receive.x,receive.z),alignment=((input.x||0)*receive.x+(input.z||0)*receive.z)/Math.max(.001,strength*original);return strength>=.18&&Math.abs(strength-original)<=.18&&alignment>=.95&&!!input.sprint===receive.sprint&&!input.defend;}
// Shared by authoritative simulation and local movement prediction.
export function moveFootballer(p,dx,dz,speed,dt,turn=null){
 const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}const factor=1-Math.exp(-dt*(turn?.response||(length>.01?12:16)));p.vx+=(dx*speed-p.vx)*factor;p.vz+=(dz*speed-p.vz)*factor;
 p.x=clamp(p.x+p.vx*dt,-35.2,35.2);p.z=clamp(p.z+p.vz*dt,-53.6,53.6);if(turn||Math.hypot(p.vx,p.vz)>.18)p.yaw=turnFootballer(p.yaw,turn?.heading??Math.atan2(p.vx,p.vz),dt*(turn?.rate||(4.5+3.5/(1+Math.hypot(p.vx,p.vz)))));
}
export function moveControlledFootballer(p,b,owner,input,dt,time){
 const receive=p.receiveControl;
 if(receive){
  if(b.ownerId||b.targetId!==p.id||time>receive.until||!continuesReceiveIntent(input,receive))p.receiveControl=null;
  // The direction already held by the passer must not instantly run the new
  // recipient away from a short pass. A fresh direction or release overrides
  // this assistance immediately; no minimum lock time is imposed.
  else input={...input,x:0,z:0,sprint:false};
 }
 let x=input.x,z=input.z;const chasing=input.defend&&owner?.team!==p.team;p.defending=!!input.defend;
 if(chasing){const target=pressureTarget(p,owner,b),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),assist=Math.min(1,Math.max(0,(d-target.standOff)/2));x=dx/(d||1)*assist*.88+input.x*.4;z=dz/(d||1)*assist*.88+input.z*.4;}
 else if(!b.ownerId&&b.targetId===p.id&&Math.hypot(x,z)<.18){const target=receivingPoint(p,b),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);x=dx/Math.max(1,d);z=dz/Math.max(1,d);}
 else if(time<(p.lungeUntil||0)&&Math.hypot(x,z)<.2){const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);x=dx/(d||1)*.7;z=dz/(d||1)*.7;}
 const sprint=!!input.sprint&&p.stamina>.04;let speed=(sprint?7.6:input.defend&&chasing?6:5.5)*(b.ownerId===p.id?(input.defend?.62:input.charging?.65:.91):1),turn=null;
 if(b.ownerId===p.id&&!input.defend&&!input.charging&&Math.hypot(input.x,input.z)>.18){
  const heading=Math.atan2(input.x,input.z),gap=Math.abs(Math.atan2(Math.sin(heading-p.yaw),Math.cos(heading-p.yaw)));
  if(time>=(p.pivotUntil||0)&&Math.hypot(p.vx,p.vz)>3&&gap>2.1)p.pivotUntil=time+.36;
  if(time<(p.pivotUntil||0)){speed*=.35+.65*Math.max(0,Math.cos(gap));turn={heading,rate:9,response:22};}
 }else p.pivotUntil=0;
 moveFootballer(p,x,z,speed,dt,turn);
 if(input.defend&&b.ownerId!==p.id)p.yaw=turnFootballer(p.yaw,Math.atan2(b.x-p.x,b.z-p.z),dt*9);
 p.stamina=clamp(p.stamina+(sprint&&Math.hypot(x,z)>.2?-.10:.085)*dt,0,1);
}
export function carryFootball(p,b,dt,time){const speed=Math.hypot(p.vx,p.vz),moving=speed>.15,reach=(p.defending?.46:.58)+Math.min(.28,speed*.035)+(moving?.10*(.5+.5*Math.sin(time*11)):0),x=p.x+Math.sin(p.yaw)*reach,z=p.z+Math.cos(p.yaw)*reach,amount=1-Math.exp(-dt*(time<(p.trapUntil||0)?15:32));b.x+=(x-b.x)*amount;b.z+=(z-b.z)*amount;b.y=.11+(moving?.008*Math.sin(time*13):0);b.vx=p.vx;b.vz=p.vz;b.vy=0;}
