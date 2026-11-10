export const controlModes=['manual','semi','assisted'];
export const controlLabels={manual:'手动',semi:'半自动',assisted:'辅助'};
export const controlDescriptions={manual:'只按 Q 换人',semi:'控球自动换人 · 防守按 Q',assisted:'接球与防守辅助换人'};
export const validControlMode=value=>controlModes.includes(value)?value:'semi';
export function loadFootballSettings(storage){try{return{controlMode:validControlMode(JSON.parse(storage?.getItem('arena-football-controls')||'{}').controlMode)};}catch{return{controlMode:'semi'};}}
export function saveFootballSettings(storage,settings){try{storage?.setItem('arena-football-controls',JSON.stringify({controlMode:validControlMode(settings.controlMode)}));}catch{}}
export function turnFootballer(current,target,limit){let delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+Math.max(-limit,Math.min(limit,delta));}
export function cursorCandidate(players,ball,{exclude=null,team='home',direction=null,from=null}={}){
 const owner=players.find(p=>p.id===ball.ownerId),point={x:ball.x+(ball.vx||0)*.22,z:ball.z+(ball.vz||0)*.22},reference=from||players.find(p=>p.id===exclude)||players.find(p=>p.team===team),ownGoal=-(reference?.attackSign??(team==='home'?-1:1))*52.5,strength=Math.hypot(direction?.x||0,direction?.z||0);
 let nearest=null,best=Infinity;for(const p of players){if(p.dismissed||p.team!==team||p.keeper||p.id===exclude)continue;
  const distance=Math.hypot(p.x-point.x,p.z-point.z),behindBall=(p.z-point.z)*Math.sign(ownGoal)<-1.5;
  const dx=p.x-(reference?.x??point.x),dz=p.z-(reference?.z??point.z),gap=Math.hypot(dx,dz),aim=reference&&strength>.18&&gap>1?(dx*direction.x+dz*direction.z)/(gap*strength):0;
  const score=distance+(owner?.team===team&&owner.id===p.id?-6:0)+(owner?.team!==team&&behindBall?1.8:0)-aim*8;
  if(score<best){best=score;nearest=p;}
 }return nearest;
}
// A defender must reach the actual exposed ball. A nearby body alone is
// insufficient, especially when the carrier has turned their back to shield.
export function tackleWindow(defender,owner,ball,{range=1.85}={}){
 const dx=ball.x-defender.x,dz=ball.z-defender.z,d=Math.hypot(dx,dz),front=d>.001?(Math.sin(defender.yaw)*dx+Math.cos(defender.yaw)*dz)/d:1;
 const ox=defender.x-owner.x,oz=defender.z-owner.z,reach=Math.hypot(ox,oz),bx=ball.x-owner.x,bz=ball.z-owner.z,br=Math.hypot(bx,bz);
 const sheltered=reach>.1&&br>.1&&(ox*bx+oz*bz)/(reach*br)<-.25&&d>1.0;
 return{distance:d,front,sheltered,canReach:d<=range&&ball.y<.65&&front>-.25&&!sheltered};
}
export function pressureTarget(defender,owner,ball){
 const target={x:ball.x+(owner?.vx||ball.vx||0)*.18,z:ball.z+(owner?.vz||ball.vz||0)*.18,standOff:owner&&owner.team!==(defender.team||'home')?1.1:.45};
 if(owner&&owner.team!==(defender.team||'home')&&tackleWindow(defender,owner,ball).sheltered){
  const bx=ball.x-owner.x,bz=ball.z-owner.z,length=Math.hypot(bx,bz)||1,cross=(defender.x-owner.x)*bz-(defender.z-owner.z)*bx,side=cross===0?(defender.x>=owner.x?1:-1):Math.sign(cross);
  target.x=owner.x+bz/length*side*1.15+bx*.25;target.z=owner.z-bx/length*side*1.15+bz*.25;target.standOff=.15;
 }
 return target;
}
