const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function penaltyContext(state,team=state.players.find(p=>p.id===state.controlledId)?.team){
 const ordinary=state.setPiece?.type==='penalty'?state.setPiece:null,contest=state.phase==='penalties'?state.competition?.shootout:null,p=ordinary||contest;
 if(!p)return null;return{...p,role:p.team===team?'shooter':'keeper',goalZ:ordinary?.goalZ??-52.5,kind:ordinary?'match':'shootout'};
}
export function footballControlYaw(state,{cameraMode='close',yaw=0}={}){
 const penalty=penaltyContext(state);if(penalty&&cameraMode!=='first'){const attacking=penalty.goalZ<0?0:Math.PI;return penalty.role==='keeper'?attacking+Math.PI:attacking;}
 return['broadcast','close'].includes(cameraMode)?Math.atan2(32,8):yaw;
}
export function footballInput({forward=0,side=0,yaw=0,sprint=false,defend=false}={}){
 const length=Math.max(1,Math.hypot(forward,side)),f=forward/length,s=side/length;
 return{x:-Math.sin(yaw)*f+Math.cos(yaw)*s,z:-Math.cos(yaw)*f-Math.sin(yaw)*s,sprint,defend};
}
// Check the camera that is actually on screen, including its smoothed target.
// A distant cursor switch must not leave the new footballer behind the HUD.
export function footballerInFrame({position,target,fov},player,aspect=16/9){
 if(!player||!target||!position||!Number.isFinite(fov)||!Number.isFinite(aspect)||aspect<=0)return false;
 const direction=target.map((n,i)=>n-position[i]),length=Math.hypot(...direction),horizontal=Math.hypot(direction[0],direction[2]);if(length<.001||horizontal<.001)return false;
 const forward=direction.map(n=>n/length),right=[-direction[2]/horizontal,0,direction[0]/horizontal],up=[-forward[1]*right[2],horizontal/length,forward[1]*right[0]],tan=Math.tan(fov*Math.PI/360);
 return [0,2].every(y=>{const q=[player.x-position[0],y-position[1],player.z-position[2]],dot=v=>q.reduce((sum,n,i)=>sum+n*v[i],0),depth=dot(forward);if(depth<=.1)return false;const x=dot(right)/(depth*tan*aspect),height=dot(up)/(depth*tan);return Math.abs(x)<=.82&&height<=.65&&height>=-.52;});
}
export function advanceFootballCamera(previous,desired,{player,aspect=16/9,dt=1/60,rate=9,changed=false,instant=false}={}){
 const cut=instant||!desired.target||!previous.target||changed&&!footballerInFrame(previous,player,aspect),amount=cut?1:1-Math.exp(-clamp(dt,0,.25)*rate),blend=(from,to)=>to.map((n,i)=>from[i]+(n-from[i])*amount);
 return{...desired,position:blend(previous.position,desired.position),target:desired.target?blend(previous.target||desired.target,desired.target):null,cut};
}
export function footballCamera(player,{view='third',yaw=0,pitch=-.14,style='follow',ball=player,aspect=16/9,penalty=null}={}){
 if(view==='first')return{position:[player.x,1.68,player.z],target:null,fov:76,yaw,pitch:clamp(pitch,-.95,.5)};
 if(penalty){const role=typeof penalty==='string'?penalty:penalty.role,side=typeof penalty==='string'||penalty.goalZ<0?1:-1;return role==='keeper'?{position:[0,3,-59.8*side],target:[0,1,-43*side],fov:aspect<.85?100:68,controlYaw:side>0?Math.PI:0}:{position:[player.x*.2,4.5,(aspect<.85?-28:-32)*side],target:[0,.8,-51.5*side],fov:55,controlYaw:side>0?0:Math.PI};}
 if(style==='broadcast'||style==='close'){
  const close=style==='close',portrait=aspect<.85,fov=close?(portrait?68:48):(portrait?76:54),offsetX=close?18:32,offsetY=close?14:26,offsetZ=close?4.5:8,tan=Math.tan(fov*Math.PI/360),separation=Math.hypot(player.x-ball.x,player.z-ball.z),span=Math.min(1,(close?24:34)/(separation||1)),bx=player.x+(ball.x-player.x)*span,bz=player.z+(ball.z-player.z)*span,lead=Math.min(1,3/(Math.hypot(ball.vx||0,ball.vz||0)*.12||1)),x=clamp(player.x*.62+bx*.38+(ball.vx||0)*.12*lead,-33,33),z=clamp(player.z*.62+bz*.38+(ball.vz||0)*.12*lead,-52,52),target=[x,.8,z],length=Math.hypot(offsetX,offsetY,offsetZ),horizontal=Math.hypot(offsetX,offsetZ);
  const forward=[-offsetX/length,-offsetY/length,-offsetZ/length],right=[offsetZ/horizontal,0,-offsetX/horizontal],up=[-offsetX*offsetY/(horizontal*length),horizontal/length,-offsetZ*offsetY/(horizontal*length)];let scale=1;
  for(const point of [[player.x,0,player.z],[player.x,2,player.z],[bx,Math.max(.11,ball.y||.11),bz]]){const q=point.map((n,i)=>n-target[i]),dot=v=>q.reduce((sum,n,i)=>sum+n*v[i],0),depth=dot(forward),height=dot(up);scale=Math.max(scale,(Math.abs(dot(right))/(tan*Math.max(.3,aspect)*.82)-depth)/length,(Math.abs(height)/(tan*(height>0?.65:.52))-depth)/length);}
  scale=clamp(scale,1,close?3:1.7);return{position:[x+offsetX*scale,target[1]+offsetY*scale,z+offsetZ*scale],target,fov,controlYaw:Math.atan2(offsetX,offsetZ)};
 }
 const distance=8.3,height=4.5-clamp(pitch,-.65,.2)*5;
 return{position:[player.x+Math.sin(yaw)*distance,height,player.z+Math.cos(yaw)*distance],target:[player.x-Math.sin(yaw)*3,1.2+clamp(pitch,-.65,.2)*2,player.z-Math.cos(yaw)*3],fov:66};
}
export function matchTime(state){if(state.competition?.stage==='shootout')return'点球';const seconds=state.competition?Math.max(0,Math.floor(state.elapsed/state.competition.regulationDuration*5400)):Math.max(0,Math.ceil(state.duration-state.elapsed));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
export function ballDirection(player,ball,yaw){
 const dx=ball.x-player.x,dz=ball.z-player.z,forward=-Math.sin(yaw)*dx-Math.cos(yaw)*dz,right=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
 return (Math.abs(right)>Math.abs(forward)*.65?(right>0?'右侧 →':'← 左侧'):forward>=0?'前方 ↑':'后方 ↓')+' '+Math.round(Math.hypot(dx,dz))+' m';
}
export function offscreenBallCue(point,width,height){
 if(![point.x,point.y,point.z,width,height].every(Number.isFinite)||width<100||height<180)return null;
 const compact=width<=1024,landscape=height<500&&width>=600,top=landscape?65:compact?112:85,bottom=height-(landscape?65:compact?190:125),left=landscape?180:25,right=width-left;if(bottom<=top||right<=left)return null;
 const px=(point.x+1)*width/2,py=(1-point.y)*height/2,behind=point.z>1||point.z< -1;if(!behind&&px>=left&&px<=right&&py>=top&&py<=bottom)return null;
 const cx=width/2,cy=(top+bottom)/2,centered=Math.abs(point.x)+Math.abs(point.y)<.001,dx=point.x*width/2*(behind?-1:1),dy=centered?1:-point.y*height/2*(behind?-1:1),scale=Math.min((right-left)/2/Math.max(.001,Math.abs(dx)),(bottom-top)/2/Math.max(.001,Math.abs(dy)));
 return{x:cx+dx*scale,y:cy+dy*scale,angle:Math.atan2(dy,dx)*180/Math.PI};
}
