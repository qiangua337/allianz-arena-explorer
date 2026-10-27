const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const copy=s=>({...s,lastShot:s.lastShot?{...s.lastShot}:null,score:{...s.score},stats:s.stats?{home:{...s.stats.home},away:{...s.stats.away}}:null,ball:{...s.ball,shot:s.ball.shot?{...s.ball.shot}:null,receivePoint:s.ball.receivePoint?{...s.ball.receivePoint}:null},players:s.players.map(p=>({...p,keeperState:p.keeperState?{...p.keeperState}:null,motion:p.motion?{...p.motion}:null})),passPreview:s.passPreview?{...s.passPreview}:null,shotPreview:s.shotPreview?{...s.shotPreview}:null});
export function createReplayRecorder({seconds=7.5,hz=10}={}){
 const limit=Math.ceil(seconds*hz)+2;let frames=[],highlight=null,last=-Infinity,breakPending=false;
 function record(state){
  if(state.phase==='kickoff'){breakPending=true;return;}
  if(!['playing','goal'].includes(state.phase)||state.paused||state.time-last<1/hz-.001)return;
  if(breakPending){frames=[];last=-Infinity;breakPending=false;}
  frames.push(copy(state));last=state.time;if(frames.length>limit)frames.shift();
 }
 function clip(){const source=highlight||frames;if(source.length<3||source.at(-1).time-source[0].time<.25)return null;return{frames:source.map(copy),duration:source.at(-1).time-source[0].time,isGoal:!!highlight};}
 return{record,clip,goal(state){if(frames.at(-1)?.time===state.time)frames[frames.length-1]=copy(state);else frames.push(copy(state));if(frames.length>limit)frames.shift();last=state.time;highlight=frames.map(copy);},reset(){frames=[];highlight=null;last=-Infinity;breakPending=false;},get available(){const source=highlight||frames;return source.length>=3&&source.at(-1).time-source[0].time>=.25;},get count(){return frames.length;},get capacity(){return limit;}};
}

export function replaySample(clip,seconds){
 const frames=clip.frames,target=frames[0].time+clamp(seconds,0,clip.duration);let lo=0,hi=frames.length-1;while(hi-lo>1){const i=(lo+hi)>>1;if(frames[i].time<=target)lo=i;else hi=i;}
 const a=frames[lo],b=frames[hi],t=clamp((target-a.time)/(b.time-a.time||1),0,1),state=copy(t<.5?a:b),lerp=(x,y)=>x+(y-x)*t;
 for(const p of state.players){const aa=a.players.find(q=>q.id===p.id),bb=b.players.find(q=>q.id===p.id);if(!aa||!bb)continue;for(const k of['x','z','vx','vz'])p[k]=lerp(aa[k]||0,bb[k]||0);p.yaw=aa.yaw+Math.atan2(Math.sin(bb.yaw-aa.yaw),Math.cos(bb.yaw-aa.yaw))*t;if(p.motion&&aa.motion?.id===bb.motion?.id)p.motion.elapsed=lerp(aa.motion.elapsed,bb.motion.elapsed);}
 for(const k of['x','y','z','vx','vy','vz'])state.ball[k]=lerp(a.ball[k]||0,b.ball[k]||0);state.time=target;state.replay=true;state.replayProgress=clamp(seconds/(clip.duration||1),0,1);return state;
}

export function replayCamera(state,aspect=16/9){
 const b=state.ball,owner=state.players.find(p=>p.id===b.ownerId),x=clamp(b.x*.7+(owner?.x??b.x)*.3,-22,22),z=clamp(b.z,-44,44),side=x>0?-1:1;
 return{position:[x+side*13,7.5,z+11],target:[x,Math.max(.6,Math.min(2,b.y)),z-1],fov:aspect<.85?76:61};
}
