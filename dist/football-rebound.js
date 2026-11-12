const RADIUS=.11;
const HALF_WIDTH=34;
const HALF_LENGTH=52.5;
const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));

function reachablePositions(ball){
 let {x,y,z,vx,vy,vz}=ball;
 const positions=[],sampleStep=.1,step=1/60;
 for(let i=0;i<=14;i++){
  if(y<.69)positions.push({x,z,time:i*sampleStep});
  for(let j=0;j<6;j++){
   vx+=(ball.curve||0)*step;
   x+=vx*step;
   y+=vy*step;
   z+=vz*step;
   vy-=9.81*step;
   if(y<RADIUS){
    y=RADIUS;
    vy=vy<-1?-vy*.28:0;
   }
   const drag=Math.exp(-(y<=RADIUS+.015?.39:.08)*step);
   vx*=drag;
   vz*=drag;
  }
  if(Math.abs(x)>HALF_WIDTH||Math.abs(z)>HALF_LENGTH)break;
 }
 return positions;
}

export function planReboundChases(ball,field,formations,attackSign){
 const {team,leaders:previousLeaders}=ball.rebound;
 const positions=reachablePositions(ball),targets={},leaders={};
 if(!positions.length)return {targets,leaders:previousLeaders};
 for(const side of ['home','away']){
  const attacking=side===team,sign=attackSign(side),speed=attacking?6.85:6.7;
  let leader,intercept,best=Infinity;
  for(const player of field){
   if(player.keeper||player.team!==side)continue;
   const role=formations[side].roles[player.index];
   const positionCost=attacking&&['CB','LB','RB','LWB','RWB'].includes(role)?.25:0;
   const stability=previousLeaders?.[side]===player.id?.16:0;
   for(const point of positions){
    const dx=point.x-player.x,dz=point.z-player.z,distance=Math.hypot(dx,dz);
    const momentum=(dx*player.vx+dz*player.vz)/Math.max(1,distance);
    const arrival=Math.max(0,distance-.42-momentum*.18)/speed;
    const goalSideCost=!attacking&&(player.z-point.z)*sign>1?.14:0;
    const score=Math.max(arrival+.11,point.time)+Math.max(0,arrival-point.time)*.28+positionCost+goalSideCost-stability;
    if(score<best){
     best=score;
     leader=player;
     intercept=point;
    }
   }
  }
  // Give the contest to nearby players without dragging distant lines out of shape.
  if(!leader||best>2.5)continue;
  leaders[side]=leader.id;
  targets[leader.id]={x:intercept.x,z:intercept.z,speed,lead:true};
  const spread=intercept.x>0?-1:1;
  const support={
   x:clamp(intercept.x+spread*(attacking?4.2:2.8),-32,32),
   z:clamp(intercept.z-sign*(attacking?5.3:4.1),-51,51),
   speed:attacking?5.6:5.35
  };
  let cover,near=attacking?10:12;
  for(const player of field){
   if(player.team!==side||player===leader||player.keeper)continue;
   const distance=Math.hypot(player.x-support.x,player.z-support.z);
   if(distance<near){
    near=distance;
    cover=player;
   }
  }
  if(cover)targets[cover.id]=support;
 }
 return {targets,leaders};
}
