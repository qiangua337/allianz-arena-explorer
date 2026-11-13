import {turnFootballer,pressureTarget} from './football-assist.js';
import {receivingPoint} from './football-tactics.js';
import {abilityFactor,playerAbilities} from './football-abilities.js';
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
 let x=input.x,z=input.z,jockey=0;const chasing=input.defend&&owner?.team!==p.team;p.defending=!!input.defend;
 if(chasing){
  const target=pressureTarget(p,owner,b),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
  jockey=owner?clamp((5.4-Math.hypot(owner.x-p.x,owner.z-p.z))/3,0,1):0;
  const steering=clamp(Math.hypot(x,z)/.65,0,1),assist=clamp((d-target.standOff)/2,0,1)*.88*(1-.88*jockey*steering),manual=.4+.6*jockey;
  x=dx/(d||1)*assist+x*manual;z=dz/(d||1)*assist+z*manual;
 }
 else if(!b.ownerId&&b.targetId===p.id&&Math.hypot(x,z)<.18){const target=receivingPoint(p,b),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);x=dx/Math.max(1,d);z=dz/Math.max(1,d);}
 else if(time<(p.lungeUntil||0)&&Math.hypot(x,z)<.2){const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);x=dx/(d||1)*.7;z=dz/(d||1)*.7;}
 const abilities=playerAbilities(p),sprint=!!input.sprint&&p.stamina>.04;
 let speed=(sprint?7.6:chasing?6-jockey*1.35:5.5)*abilityFactor(abilities.pace,sprint?.006:.003)*(b.ownerId===p.id?(input.defend?.62:input.charging?.65:.91*abilityFactor(abilities.dribbling,.0025)):1),turn=null;
 if(chasing&&owner)turn={heading:Math.atan2(b.x-p.x,b.z-p.z),rate:10,response:12+jockey*4};
 if(b.ownerId===p.id&&!input.defend&&!input.charging&&Math.hypot(input.x,input.z)>.18){
  const heading=Math.atan2(input.x,input.z),gap=Math.abs(Math.atan2(Math.sin(heading-p.yaw),Math.cos(heading-p.yaw)));
  const control=abilityFactor(abilities.dribbling,.008);
  if(time>=(p.pivotUntil||0)&&Math.hypot(p.vx,p.vz)>3&&gap>2.1)p.pivotUntil=time+.36/control;
  if(time<(p.pivotUntil||0)){speed*=.35+.65*Math.max(0,Math.cos(gap));turn={heading,rate:9,response:22};}
  else{
   // Plant into an ordinary cut instead of changing the travel direction
   // much faster than the body and its dribbling touch can follow. Straight
   // acceleration is unchanged; sharper cuts retain a little more momentum.
   const travel=Math.hypot(p.vx,p.vz)>.4?Math.atan2(p.vx,p.vz):p.yaw,cut=Math.abs(Math.atan2(Math.sin(heading-travel),Math.cos(heading-travel)));
   turn={rate:9,response:12-3*clamp((cut-.35)/1.2,0,1)/control};
  }
 }else p.pivotUntil=0;
 moveFootballer(p,x,z,speed,dt,turn);
 if(input.defend&&b.ownerId!==p.id&&!(chasing&&owner))p.yaw=turnFootballer(p.yaw,Math.atan2(b.x-p.x,b.z-p.z),dt*9);
 p.stamina=clamp(p.stamina+(sprint&&Math.hypot(x,z)>.2?-.10:.085)*dt,0,1);
}
const firstTouchSeconds=.24;

export function clearFootballTouch(ball){
 ball.firstTouch=null;
 ball.touchPhase=0;
}

export function beginFootballTouch(player,ball,input,time){
 const vx=player.vx||0,vz=player.vz||0,speed=Math.hypot(vx,vz),inputLength=Math.hypot(input?.x||0,input?.z||0);
 const contactX=ball.x-player.x,contactZ=ball.z-player.z,contactDistance=Math.hypot(contactX,contactZ);
 let x=Math.sin(player.yaw),z=Math.cos(player.yaw);
 if(inputLength>.18){x=input.x/inputLength;z=input.z/inputLength;}
 else if(speed>.70){x=vx/speed;z=vz/speed;}
 else if(contactDistance>.06){x=contactX/contactDistance;z=contactZ/contactDistance;}
 const control=abilityFactor(playerAbilities(player).dribbling,.009);
 const reach=((inputLength>.18&&input?.sprint ? .72 : .46)+Math.min(.19,speed*.037))/control;
 // A fast or bouncing pass can retain a little motion on contact. A new
 // steering direction cushions the component that would carry it away.
 const ballSpeed=Math.hypot(ball.vx,ball.vz),roll=Math.min(.11,1.8/(ballSpeed||1));
 const along=Math.max(0,ball.vx*x+ball.vz*z),lateral=inputLength>.18?.23:.56;
 ball.firstTouch={
  ownerId:player.id,until:time+firstTouchSeconds,x:x*reach,z:z*reach,
  vx:(along*x+(ball.vx-along*x)*lateral)*roll,
  vz:(along*z+(ball.vz-along*z)*lateral)*roll
 };
}

export function carryFootball(player,ball,dt,time,openPlay=true){
 const speed=Math.hypot(player.vx,player.vz),forwardX=Math.sin(player.yaw),forwardZ=Math.cos(player.yaw);
 if(player.keeperState?.holdingWithHands){
  const amount=1-Math.exp(-dt*22);
  ball.x+=(player.x+forwardX*.43-ball.x)*amount;ball.z+=(player.z+forwardZ*.43-ball.z)*amount;
  ball.y+=(1.05-ball.y)*amount;ball.vx=player.vx;ball.vz=player.vz;ball.vy=0;
  return;
 }
 if(player.keeper||!openPlay){
  const moving=speed>.15,reach=(player.defending?.46:.58)+Math.min(.28,speed*.035)+(moving?.10*(.5+.5*Math.sin(time*11)):0);
  const amount=1-Math.exp(-dt*(time<(player.trapUntil||0)?15:32));
  ball.x+=(player.x+forwardX*reach-ball.x)*amount;ball.z+=(player.z+forwardZ*reach-ball.z)*amount;
  ball.y=.11+(moving?.008*Math.sin(time*13):0);ball.vx=player.vx;ball.vz=player.vz;ball.vy=0;
  return;
 }

 const movementX=player.vx/(speed||1),movementZ=player.vz/(speed||1),pivot=clamp(((player.pivotUntil||0)-time)/.13,0,1);
 const turn=speed>.45?clamp(1-(movementX*forwardX+movementZ*forwardZ),0,1):0;
 const extension=player.defending?0:clamp((speed-4.55)/2.3,0,1)*(1-.8*turn)*(1-pivot);
 ball.touchPhase=speed>.30?((ball.touchPhase||0)+speed*dt/(.78+speed*.19))%1:0;
 const stride=(1-Math.cos(ball.touchPhase*2*Math.PI))*.5;
 const baseReach=player.defending ? .37 : (.44+.20*pivot)/abilityFactor(playerAbilities(player).dribbling,.008);
 const reach=baseReach+Math.min(.32,speed*(player.defending?.025:.046))+.32*extension+stride*(.056+.15*extension);
 const travelWeight=clamp((speed-.25)/3,0,1)*(.19*pivot+(.36+.19*turn)*(1-pivot)),side=clamp(forwardZ*movementX-forwardX*movementZ,-1,1)*Math.min(.09,speed*.03);
 let offsetX=(forwardX*(1-travelWeight)+movementX*travelWeight)*reach+forwardZ*side;
 let offsetZ=(forwardZ*(1-travelWeight)+movementZ*travelWeight)*reach-forwardX*side;
 let driftX=0,driftZ=0,settle=0;
 const touch=ball.firstTouch;
 if(touch?.ownerId===player.id&&time<touch.until){
  settle=clamp((touch.until-time)/firstTouchSeconds,0,1);
  // The first touch gives the initial direction, but live motion can still
  // turn the player away immediately when the next stick input changes.
  const weight=settle*(.93-.30*clamp((speed-.75)/3,0,1));
  offsetX+=(touch.x-offsetX)*weight;offsetZ+=(touch.z-offsetZ)*weight;
  driftX=touch.vx*settle*dt;driftZ=touch.vz*settle*dt;
 }else if(touch)ball.firstTouch=null;

 const amount=1-Math.exp(-dt*(33-8*extension-11*settle)*abilityFactor(playerAbilities(player).dribbling,.006));
 const dx=(player.x+offsetX-ball.x)*amount+driftX,dz=(player.z+offsetZ-ball.z)*amount+driftZ;
 ball.x+=dx;ball.z+=dz;
 ball.y=settle>0?.11+Math.max(0,ball.y-.11)*Math.exp(-dt*22):.11+stride*extension*.012;
 const step=Math.hypot(dx,dz),velocityScale=Math.min(1/dt,16/(step||1));
 ball.vx=dx*velocityScale;ball.vz=dz*velocityScale;ball.vy=0;
}
