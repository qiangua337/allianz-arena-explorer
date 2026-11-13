const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const copyObject=value=>value?{...value}:null;
const cloneObject=value=>value?structuredClone(value):null;

function copy(s,roster){
 const competition=copyObject(s.competition);
 if(competition?.result)competition.result={...competition.result};
 if(competition?.addedTime)competition.addedTime={...competition.addedTime};
 if(competition?.shootout)competition.shootout=structuredClone(competition.shootout);
 const ball={...s.ball,shot:copyObject(s.ball.shot),receivePoint:copyObject(s.ball.receivePoint)};
 if(ball.firstTouch)ball.firstTouch={...ball.firstTouch};
 if(ball.rebound?.leaders)ball.rebound={...ball.rebound,leaders:{...ball.rebound.leaders}};
 else if(ball.rebound)ball.rebound={...ball.rebound};
 return{
  ...s,competition,teamSheets:roster?roster.sheets:cloneObject(s.teamSheets),
  discipline:roster?roster.discipline:cloneObject(s.discipline),
  setPiece:cloneObject(s.setPiece),lastShot:copyObject(s.lastShot),score:{...s.score},
  stats:s.stats?{home:{...s.stats.home},away:{...s.stats.away}}:null,ball,
  players:s.players.map(p=>{
   const player={...p,keeperState:copyObject(p.keeperState),motion:copyObject(p.motion)};
   if(player.receiveControl)player.receiveControl={...player.receiveControl};
   if(player.passRun)player.passRun={...player.passRun};
   return player;
  }),
  passPreview:copyObject(s.passPreview),shotPreview:copyObject(s.shotPreview),
  ...(s.events&&{events:s.events.slice()}),
  ...(s.controlledIds&&{controlledIds:{...s.controlledIds}}),
  ...(s.controlModes&&{controlModes:{...s.controlModes}}),
  ...(s.shotKinds&&{shotKinds:{...s.shotKinds}}),
  ...(s.chargePowers&&{chargePowers:{...s.chargePowers}}),
  ...(s.previews&&{previews:{home:{...s.previews.home},away:{...s.previews.away}}})
 };
}

export function createReplayRecorder({seconds=7.5,hz=10}={}){
 const limit=Math.ceil(seconds*hz)+2;let frames=[],highlight=null,last=-Infinity,breakPending=false,roster=null;
 function capture(state){
  const {rosterRevision,teamSheets,discipline}=state;
  // Squad changes and disciplinary decisions both advance rosterRevision.
  // The source identities also distinguish a fresh match at revision zero.
  if(!Number.isInteger(rosterRevision))return copy(state);
  if(roster?.revision!==rosterRevision||roster.teamSheets!==teamSheets||roster.sourceDiscipline!==discipline){
   roster={revision:rosterRevision,teamSheets,sourceDiscipline:discipline,sheets:cloneObject(teamSheets),discipline:cloneObject(discipline)};
  }
  return copy(state,roster);
 }
 function trim(){const cutoff=(frames.at(-1)?.time||0)-seconds;while(frames.length>limit||frames.length>1&&frames[0].time<cutoff)frames.shift();}
 function record(state){
  if(state.phase==='kickoff'){breakPending=true;return;}
  if(!['playing','goal'].includes(state.phase)||state.paused||state.time-last<1/hz-.001)return;
  if(breakPending){frames=[];last=-Infinity;breakPending=false;}
  frames.push(capture(state));last=state.time;trim();
 }
 function clip(){const source=highlight||frames;if(source.length<3||source.at(-1).time-source[0].time<.25)return null;return{frames:source.map(frame=>structuredClone(frame)),duration:source.at(-1).time-source[0].time,isGoal:!!highlight,cameraSide:source[0].ball.x>0?-1:1};}
 function goal(state){
  const frame=capture(state);
  if(frames.at(-1)?.time===state.time)frames[frames.length-1]=frame;
  else frames.push(frame);
  trim();last=state.time;
  // Once captured, frames stay private and are never modified in place.
  highlight=frames.slice();
 }
 return{record,clip,goal,reset(){frames=[];highlight=null;last=-Infinity;breakPending=false;roster=null;},get available(){const source=highlight||frames;return source.length>=3&&source.at(-1).time-source[0].time>=.25;},get count(){return frames.length;},get capacity(){return limit;}};
}

export function replaySample(clip,seconds){
 const frames=clip.frames,target=frames[0].time+clamp(seconds,0,clip.duration);let lo=0,hi=frames.length-1;while(hi-lo>1){const i=(lo+hi)>>1;if(frames[i].time<=target)lo=i;else hi=i;}
 const a=frames[lo],b=frames[hi],t=clamp((target-a.time)/(b.time-a.time||1),0,1),state=copy(t<.5?a:b),lerp=(x,y)=>x+(y-x)*t;
 for(const [i,p] of state.players.entries()){const aa=a.players[i]?.id===p.id?a.players[i]:a.players.find(q=>q.id===p.id),bb=b.players[i]?.id===p.id?b.players[i]:b.players.find(q=>q.id===p.id);if(!aa||!bb)continue;for(const k of['x','z','vx','vz'])p[k]=lerp(aa[k]||0,bb[k]||0);p.yaw=aa.yaw+Math.atan2(Math.sin(bb.yaw-aa.yaw),Math.cos(bb.yaw-aa.yaw))*t;if(p.motion&&aa.motion&&aa.motion.id===bb.motion?.id)p.motion.elapsed=lerp(aa.motion.elapsed,bb.motion.elapsed);}
 for(const k of['x','y','z','vx','vy','vz'])state.ball[k]=lerp(a.ball[k]||0,b.ball[k]||0);state.time=target;state.replay=true;state.replayCameraSide=clip.cameraSide??(frames[0].ball.x>0?-1:1);state.replayProgress=clamp(seconds/(clip.duration||1),0,1);return state;
}

export function replayCamera(state,aspect=16/9){
 const b=state.ball,owner=state.players.find(p=>p.id===b.ownerId),nearOwner=owner&&Math.hypot(owner.x-b.x,owner.z-b.z)<4?owner:null,side=state.replayCameraSide===-1?-1:1;
 // One clip keeps its chosen side. Re-evaluating this from each ball x made
 // crossing the centre line throw the camera about 26m across the action.
 const x=b.x*.7+(nearOwner?.x??b.x)*.3,z=b.z*.7+(nearOwner?.z??b.z)*.3,target=[x,Math.max(.6,b.y||.11),z],position=[clamp(x+side*13,-31,31),Math.max(7.5,target[1]+5),clamp(z+11,-49,49)],points=[[b.x,Math.max(.11,b.y||.11),b.z]];
 if(nearOwner)points.push([nearOwner.x,0,nearOwner.z],[nearOwner.x,2,nearOwner.z]);
 const portrait=aspect<.85,base=portrait?76:61,max=portrait?90:76,tangent=Math.tan(base*Math.PI/360),maximum=Math.tan(max*Math.PI/360);let required=tangent;
 for(let attempt=0;attempt<8;attempt++){
  const direction=target.map((n,i)=>n-position[i]),length=Math.hypot(...direction),horizontal=Math.hypot(direction[0],direction[2]),forward=direction.map(n=>n/length),right=horizontal>.001?[-direction[2]/horizontal,0,direction[0]/horizontal]:[1,0,0],up=[-forward[1]*right[2],horizontal/length,forward[1]*right[0]];required=tangent;
  for(const point of points){const q=point.map((n,i)=>n-position[i]),dot=v=>q.reduce((sum,n,i)=>sum+n*v[i],0),depth=Math.max(.1,dot(forward)),height=dot(up);required=Math.max(required,Math.abs(dot(right))/(depth*Math.max(.3,aspect)*.80),Math.abs(height)/(depth*(height>0?.60:.50)));}
  if(required<=maximum||position[1]>=30)break;position[1]=Math.min(30,position[1]*1.2);
 }
 return{position,target,fov:Math.max(base,Math.min(max,Math.atan(required)*360/Math.PI))};
}
