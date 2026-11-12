const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// The locally presented first touch can lead the match state. Consumers
// that award possession, goals or fouls continue to read state.ball.
export function footballBallForDisplay(state){
 return state.online&&state.phase==='playing'&&!state.paused&&!state.setPiece&&!state.replay
  ?state.kickPresentation??state.ball:state.ball;
}
// Off-ball close views keep the controlled player readable; the existing edge
// cue points to a distant ball. Reception and active possession retain it.
export function footballPlayerFocus(state){
 if(state.training||state.phase!=='playing'||state.ball.ownerId===state.controlledId||state.ball.targetId===state.controlledId)return 0;
 const p=state.players.find(p=>p.id===state.controlledId);return p?clamp((Math.hypot(p.x-state.ball.x,p.z-state.ball.z)-14)/16,0,1):0;
}
export function footballShotFocus(state){
 const {ball,lastShot}=state;
 return state.phase==='playing'&&!state.training&&state.setPiece?.type!=='penalty'&&!ball.ownerId&&!!lastShot&&lastShot.playerId===state.controlledId&&
  lastShot.id===ball.shot?.id&&(lastShot.outcome==='flight'||lastShot.id===ball.rebound?.shotId);
}
export function penaltyContext(state,team=state.players.find(p=>p.id===state.controlledId)?.team){
 const ordinary=state.setPiece?.type==='penalty'?state.setPiece:null,contest=state.phase==='penalties'?state.competition?.shootout:null,p=ordinary||contest;
 if(!p)return null;return{...p,role:p.team===team?'shooter':'keeper',goalZ:ordinary?.goalZ??-52.5,kind:ordinary?'match':'shootout'};
}
export function footballControlYaw(state,{cameraMode='close',yaw=0}={}){
 const penalty=penaltyContext(state);if(penalty&&cameraMode!=='first'){const attacking=penalty.goalZ<0?0:Math.PI;return penalty.role==='keeper'?attacking+Math.PI:attacking;}
 if(state.training&&cameraMode==='close'){const player=state.players.find(p=>p.id===state.controlledId);return state.training.id==='shooting'&&player?shootingTrainingYaw(player):Math.atan2(10,8);}
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
 const fov=cut||!desired.smoothLens||!Number.isFinite(previous.fov)?desired.fov:previous.fov+(desired.fov-previous.fov)*amount;
 return{...desired,fov:Math.abs(fov-desired.fov)<.01?desired.fov:fov,position:blend(previous.position,desired.position),target:desired.target?blend(previous.target||desired.target,desired.target):null,cut};
}
export function footballCamera(player,{view='third',yaw=0,pitch=-.14,style='follow',ball=player,aspect=16/9,penalty=null,training=null,playerFocus=0,trackShot=false}={}){
 if(view==='first')return{position:[player.x,1.68,player.z],target:null,fov:76,yaw,pitch:clamp(pitch,-.95,.5)};
 if(penalty){const role=typeof penalty==='string'?penalty:penalty.role,side=typeof penalty==='string'||penalty.goalZ<0?1:-1;return role==='keeper'?{position:[0,3,-59.8*side],target:[0,1,-43*side],fov:aspect<.85?100:68,controlYaw:side>0?Math.PI:0}:{position:[player.x*.2,4.5,(aspect<.85?-28:-32)*side],target:[0,.8,-51.5*side],fov:55,controlYaw:side>0?0:Math.PI};}
 if(training&&style==='close')return trainingCamera(player,ball,training,aspect);
 if(style==='broadcast'||style==='close'){
  const close=style==='close',portrait=aspect<.85;
  const activeBall=!training&&(trackShot||(!ball.ownerId&&!!ball.targetId&&ball.targetId===player.id));
  const focus=close&&!activeBall?clamp(Number(playerFocus)||0,0,1):0;
  const separation=Math.hypot(player.x-ball.x,player.z-ball.z);
  const span=Math.min(1,(activeBall?(close?38:46):close?24-16*focus:34)/(separation||1));
  const bx=player.x+(ball.x-player.x)*span,bz=player.z+(ball.z-player.z)*span;
  const weight=.38+(activeBall&&!trackShot?.10*clamp((separation-16)/16,0,1):0);
  const vx=ball.vx||0,vz=ball.vz||0,leadSeconds=.12-(activeBall?.06*clamp((separation-12)/8,0,1):0);
  const lead=leadSeconds*Math.min(1,3/(Math.hypot(vx,vz)*leadSeconds||1));
  const x=clamp(player.x*(1-weight)+bx*weight+vx*lead,-33,33);
  const z=clamp(player.z*(1-weight)+bz*weight+vz*lead,-52,52);
  const target=[x,.8,z],offset=close?[18,14,4.5]:[32,26,8];
  const points=[[player.x,0,player.z],[player.x,2,player.z],[bx,Math.max(.11,(ball.y||.11)*(1-focus)),bz]];
  const fov=close?(portrait?68:48):(portrait?76:54);
  const maxScale=activeBall?(close?2.55:1.58):close?3:1.7;
  return{...fitFootballCamera(points,target,offset,fov,aspect,{maxScale,widenBy:activeBall?(portrait?10:6):0}),smoothLens:true};
 }
 const distance=8.3,height=4.5-clamp(pitch,-.65,.2)*5;
 return{position:[player.x+Math.sin(yaw)*distance,height,player.z+Math.cos(yaw)*distance],target:[player.x-Math.sin(yaw)*3,1.2+clamp(pitch,-.65,.2)*2,player.z-Math.cos(yaw)*3],fov:66};
}
// A lesson has fewer participants than a full match. Start closer and lower,
// then fit the actual drill: the complete goal in shooting, all three receivers
// in passing, and only the footballer/ball during a free warm-up.
function trainingCamera(player,ball,training,aspect){
 const points=[[player.x,0,player.z],[player.x,2,player.z],[ball.x,Math.max(.11,ball.y||.11),ball.z]];
 if(training.id==='shooting'){
  for(const x of[-3.66,3.66])for(const y of[0,2.44])points.push([x,y,-52.5]);
  // Put the shooter and goal on the same screen axis. A touchline-style
  // framing had to shrink both to fit their long horizontal separation.
  const yaw=shootingTrainingYaw(player),lead=Math.min(6,Math.hypot(player.x,player.z+52.5)*.30),x=Math.sin(yaw),z=Math.cos(yaw),target=[player.x-x*lead,.9,player.z-z*lead];
  return fitFootballCamera(points,target,[x*(7.5+lead),4.3,z*(7.5+lead)],aspect<.85?68:48,aspect);
 }
 if(training.id==='passing')for(const p of training.targets||[])if(Number.isFinite(p.x)&&Number.isFinite(p.z)){points.push([p.x,0,p.z],[p.x,2,p.z]);}
 const x=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,z=(Math.min(...points.map(p=>p[2]))+Math.max(...points.map(p=>p[2])))/2;
 return fitFootballCamera(points,[x,.9,z],[10,6.8,8],aspect<.85?68:48,aspect);
}
// Keep the attack direction when dribbling through the goal mouth; the camera
// must not flip by 180 degrees as the player crosses the goal-centre point.
function shootingTrainingYaw(player){return Math.atan2(player.x,Math.max(6,player.z+52.5));}
function fitFootballCamera(points,target,offset,fov,aspect,{maxScale=Infinity,widenBy=0}={}){
 const length=Math.hypot(...offset),horizontal=Math.hypot(offset[0],offset[2]);
 const forward=offset.map(n=>-n/length),right=[offset[2]/horizontal,0,-offset[0]/horizontal];
 const up=[-offset[0]*offset[1]/(horizontal*length),horizontal/length,-offset[2]*offset[1]/(horizontal*length)];
 const tan=Math.tan(fov*Math.PI/360),horizontalMargin=Math.max(.3,aspect)*.82;
 let scale=1,widerTan=tan;
 for(const point of points){
  const q=point.map((n,i)=>n-target[i]),dot=v=>q.reduce((sum,n,i)=>sum+n*v[i],0);
  const depth=dot(forward),height=dot(up);
  const demand=Math.max(Math.abs(dot(right))/horizontalMargin,Math.abs(height)/(height>0?.65:.52));
  scale=Math.max(scale,(demand/tan-depth)/length);
  if(widenBy)widerTan=Math.max(widerTan,demand/Math.max(.1,depth+maxScale*length));
 }
 // Track an involved ball without moving the camera up into the canopy.
 const lens=widerTan>tan?Math.min(fov+widenBy,Math.atan(widerTan)*360/Math.PI):fov;
 return{position:target.map((n,i)=>n+offset[i]*Math.min(scale,maxScale)),target,fov:lens,controlYaw:Math.atan2(offset[0],offset[2])};
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
