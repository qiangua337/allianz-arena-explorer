const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const shapeWeight=.60;

const centreBack={width:.80,shift:.36,depth:.50,min:-45,max:-7,mark:0};
const fullBack={width:.76,shift:.38,depth:.53,min:-43,max:2,mark:1};
const wingBack={...fullBack,min:-42,max:7};
const holding={width:.78,shift:.37,depth:.60,min:-39,max:9,mark:.85,screen:true};
const midfielder={...holding,depth:.57,min:-36,max:16,mark:2};
const wide={width:.76,shift:.36,depth:.61,min:-34,max:22,outletCover:6.5};
const forward={width:.82,shift:.32,depth:.62,min:-28,max:30,outletCover:5.5};
const roles={CB:centreBack,LB:fullBack,RB:fullBack,LWB:wingBack,RWB:wingBack,DM:holding,CM:midfielder,AM:forward,LM:wide,RM:wide,LW:wide,RW:wide,ST:forward};

export function defendingShape(field,team,system,sign,ball,owner,pressers){
 const ballX=clamp(ball.x+(ball.vx||0)*.28,-33,33),ballDepth=clamp((ball.z+(ball.vz||0)*.28)*sign,-51,51);
 const shape=new Map(),markers=[],threats=[],outlets=[],screeners=[],markedIds=[];
 const carrier=owner??(ball.targetId&&field.find(player=>player.id===ball.targetId));
 const guardOutlets=carrier&&carrier.team!==team;
 for(const player of field){
  if(player.dismissed||player.trainingInactive||player.keeper)continue;
  if(player.team!==team){
   if(player.id===owner?.id||player.id===ball.ownerId)continue;
   const x=player.x+clamp((player.vx||0)*.30,-1.9,1.9),depth=(player.z+clamp((player.vz||0)*.30,-1.9,1.9))*sign;
   if(depth< -50||Math.abs(x)>32)continue;
   const relativeDepth=depth-ballDepth,gap=Math.hypot(x-ballX,relativeDepth);
   if(depth<=Math.min(12,ballDepth+9)){
    const danger=-depth*.24-Math.abs(x)*.19-Math.max(0,gap-22)*.19-Math.max(0,relativeDepth)*.28;
    if(danger>-2.6)threats.push({id:player.id,x,depth,danger});
   }
   if(guardOutlets&&player.id!==carrier.id&&relativeDepth>=-9&&relativeDepth<=26&&gap>=6&&gap<=33){
    // Meet a runner between their current lane and its projected receiving point.
    const nextX=player.x+clamp((player.vx||0)*.62,-3.1,3.1);
    const nextDepth=(player.z+clamp((player.vz||0)*.62,-3.1,3.1))*sign;
    outlets.push({id:player.id,x:ballX+(nextX-ballX)*.79,depth:ballDepth+(nextDepth-ballDepth)*.79-.9,
     priority:Math.max(0,6-gap*.20)+Math.max(0,1.8-Math.abs(x)*.065)});
   }
   continue;
  }
  if(pressers?.includes(player.id))continue;
  const base=system.positions[player.index],profile=roles[system.roles[player.index]]||midfielder;
  const weakSide=base[0]*ballX<0?Math.min(1,Math.abs(ballX)/22):0;
  const x=clamp(base[0]*(profile.width-.18*weakSide)+ballX*profile.shift,-31,31);
  const depth=clamp(-base[1]+ballDepth*profile.depth-2,profile.min,profile.max);
  // Retain part of each player's formation position so the block can shift
  // without the midfield and the back line moving onto the same space.
  const anchorX=base[0]+ball.x*.20,anchorDepth=-base[1]+ball.z*sign*.20;
  const point={x:anchorX+(x-anchorX)*shapeWeight,z:(anchorDepth+(depth-anchorDepth)*shapeWeight)*sign,speed:5.1};
  shape.set(player.id,point);
  if(profile.mark!==undefined)markers.push({player,profile,point,x,depth,used:false});
  if(profile.outletCover)screeners.push({profile,point,x:point.x,depth:point.z*sign,used:false});
 }

 // Keep the dangerous lanes covered without assigning two defenders to the same runner.
 threats.sort((a,b)=>b.danger-a.danger);
 let marked=0;
 for(const threat of threats){
  const targetX=threat.x*.92+ballX*.03,targetDepth=Math.max(-48,threat.depth-2.4);
  let marker=null,best=Infinity;
  for(const candidate of markers){
   if(candidate.used)continue;
   const dx=Math.abs(targetX-candidate.x),dz=Math.abs(targetDepth-candidate.depth);
   if(dx>13||dz>13||targetDepth>candidate.depth+9)continue;
   const playerGap=Math.hypot(candidate.player.x-targetX,candidate.player.z*sign-targetDepth);
   const score=dx+dz*.72+candidate.profile.mark+Math.min(20,playerGap)*.16;
   if(score<best){marker=candidate;best=score;}
  }
  if(!marker)continue;
  const t=clamp((threat.danger+6)/14,.55,.89);
  marker.point.x+=(targetX-marker.x)*t*shapeWeight;
  const depth=Math.min(threat.depth-1.25,marker.depth+(targetDepth-marker.depth)*t);
  marker.point.z=Math.min(threat.depth-1.25,marker.point.z*sign+(depth-marker.depth)*shapeWeight)*sign;
  marker.used=true;markedIds.push(threat.id);
  marker.point.faceBall=true;
  if(++marked===3)break;
 }

 // A midfielder behind the pressure line shuts the inside passing lane.
 if(owner?.team!==team&&Math.abs(ballX)>6){
  const x=ballX*.62,depth=clamp(ballDepth-7.5,-42,18);
  let screen=null,best=Infinity;
  for(const candidate of markers){
   if(candidate.used||!candidate.profile.screen)continue;
   const gap=Math.hypot(candidate.x-x,candidate.depth-depth);
   if(gap<best&&gap<15){screen=candidate;best=gap;}
  }
  if(screen){
   screen.point.x+=(x-screen.x)*.76*shapeWeight;
   const screenDepth=screen.point.z*sign+(depth-screen.depth)*.80*shapeWeight;
   screen.point.z=Math.min(Math.max(-40,ballDepth-3),screenDepth)*sign;
   screen.point.faceBall=true;
  }
 }

 // The midfield and forwards close other routes without joining the two
 // pressers. Move only when there is an actual outlet within their zone.
 if(outlets.length&&screeners.length){
  outlets.sort((a,b)=>b.priority-a.priority);
  let covered=0;
  for(const outlet of outlets){
   if(markedIds.includes(outlet.id))continue;
   let best=null,bestGap=14;
   for(const screener of screeners){
    if(screener.used)continue;
    const gap=Math.hypot(outlet.x-screener.x,(outlet.depth-screener.depth)*1.15);
    if(gap<bestGap){best=screener;bestGap=gap;}
   }
   if(!best)continue;
   const dx=outlet.x-best.x,dz=outlet.depth-best.depth;
   const move=Math.min(.77,best.profile.outletCover/(Math.hypot(dx,dz)||1))*clamp((14-bestGap)/3,0,1);
   best.point.x=clamp(best.x+dx*move,-31,31);
   best.point.z=clamp(best.depth+dz*move,best.depth-5,best.depth+4)*sign;
   best.point.faceBall=true;
   best.used=true;
   if(++covered===2)break;
  }
 }

 for(const player of field){
  const target=shape.get(player.id);
  if(!target)continue;
  const drop=(player.z-target.z)*sign,side=Math.abs(player.x-target.x);
  target.speed=5.1+clamp((drop-2)*.12,0,1.2)+clamp((side-7)*.065,0,.55);
 }
 return shape;
}
