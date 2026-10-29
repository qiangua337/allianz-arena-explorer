const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function footballInput({forward=0,side=0,yaw=0,sprint=false,defend=false}={}){
 const length=Math.max(1,Math.hypot(forward,side)),f=forward/length,s=side/length;
 return{x:-Math.sin(yaw)*f+Math.cos(yaw)*s,z:-Math.cos(yaw)*f-Math.sin(yaw)*s,sprint,defend};
}
export function footballCamera(player,{view='third',yaw=0,pitch=-.14,style='follow',ball=player,aspect=16/9,penalty=null}={}){
 if(view==='first')return{position:[player.x,1.68,player.z],target:null,fov:76,yaw,pitch:clamp(pitch,-.95,.5)};
 if(penalty)return penalty==='keeper'?{position:[0,3,-59.8],target:[0,1,-43],fov:aspect<.85?100:68,controlYaw:Math.PI}:{position:[player.x*.2,4.5,aspect<.85?-28:-32],target:[0,.8,-51.5],fov:55,controlYaw:0};
 if(style==='broadcast'){
  const portrait=aspect<.85,separation=Math.hypot(player.x-ball.x,player.z-ball.z),scale=(portrait?.82:1)+clamp((separation-7)/30,0,.25),x=clamp(player.x*.62+ball.x*.38+(ball.vx||0)*.12,-20,20),z=clamp(player.z*.62+ball.z*.38+(ball.vz||0)*.20,-39,39);
  return{position:[x+32*scale,26*scale,z+8*scale],target:[x,.45,z],fov:portrait?58:54,controlYaw:Math.atan2(32,8)};
 }
 const distance=8.3,height=4.5-clamp(pitch,-.65,.2)*5;
 return{position:[player.x+Math.sin(yaw)*distance,height,player.z+Math.cos(yaw)*distance],target:[player.x-Math.sin(yaw)*3,1.2+clamp(pitch,-.65,.2)*2,player.z-Math.cos(yaw)*3],fov:66};
}
export function matchTime(state){if(state.competition?.stage==='shootout')return'点球';const seconds=state.competition?Math.max(0,Math.floor(state.elapsed/state.competition.regulationDuration*5400)):Math.max(0,Math.ceil(state.duration-state.elapsed));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
export function ballDirection(player,ball,yaw){
 const dx=ball.x-player.x,dz=ball.z-player.z,forward=-Math.sin(yaw)*dx-Math.cos(yaw)*dz,right=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
 return (Math.abs(right)>Math.abs(forward)*.65?(right>0?'右侧 →':'← 左侧'):forward>=0?'前方 ↑':'后方 ↓')+' '+Math.round(Math.hypot(dx,dz))+' m';
}
