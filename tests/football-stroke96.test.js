import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';

registerHooks({
 resolve(specifier,context,next){
  if(specifier==='three')return{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
 }
});
const {THREE}=await import('../dist/kit.js');
const {applyFootballAction}=await import('../dist/football-action-pose.js');
const {setFootballBootBounds}=await import('../dist/football-kick-pose.js');
const directory=new URL('../dist/assets/players/',import.meta.url);
const data=JSON.parse(readFileSync(new URL('footballer-960.json',directory)));
const {clips}=JSON.parse(readFileSync(new URL('walk-cycle.json',directory)));
const bytes=readFileSync(new URL('footballer-960.bin',directory));
const bootVertices=['bootL','bootR'].map(name=>{
 const part=data.parts.find(part=>part.name===name);
 return new Float32Array(bytes.buffer,bytes.byteOffset+part.offset,part.vertices*16);
});
const strokes={short:'pass',through:'pass',lofted:'pass',drive:'shoot',finesse:'shoot',lob:'shoot'};
const legs=[11,17],vector=(...args)=>new THREE.Vector3(...args);
const action=(stroke,options={})=>({id:1,type:strokes[stroke],stroke,elapsed:0,duration:strokes[stroke]==='pass'?.32:.46,...options});

function fixture(){
 const group=new THREE.Group(),bones=data.bones.map(()=>new THREE.Bone());
 data.bones.forEach((definition,i)=>{
  const parent=definition.parent;
  (parent<0?group:bones[parent]).add(bones[i]);
  bones[i].position.fromArray(definition.head);
  if(parent>=0)bones[i].position.sub(vector(...data.bones[parent].head));
 });
 setFootballBootBounds(bones,data.bootBounds);
 const head=legs.map(index=>vector(...data.bones[index].head)),point=vector();
 return{
  group,bones,
  pose(motion,{clip='Walk_Loop',phase=0,x=8,z=15,heading=0,scale=1,speed=0}={}){
   const frame=clips[clip].frames[Math.round(phase*60)];
   group.position.set(x,0,z);group.rotation.y=heading;group.scale.setScalar(scale);
   bones[0].position.fromArray(data.bones[0].head).add(vector(...frame.slice(0,3)));
   for(let i=0;i<bones.length;i++)bones[i].quaternion.fromArray(frame,3+i*4);
   if(motion)applyFootballAction(bones,motion,{speed},group);
   group.updateMatrixWorld(true);
   return{
    feet:legs.map(i=>bones[i].getWorldPosition(vector())),
    toe:legs.map(i=>vector(0,0,1).applyQuaternion(bones[i].getWorldQuaternion(new THREE.Quaternion()))),
    arms:[6,12].map(i=>bones[i].quaternion.clone()),
    root:bones[0].position.clone()
   };
  },
  worldBall(x,y,z){
   return group.localToWorld(vector(x,y,z));
  },
  boots(ball){
   return bootVertices.map((vertices,side)=>{
    let lowest=Infinity,contact=Infinity;
    for(let i=0;i<vertices.length;i+=16){
     point.fromArray(vertices,i).sub(head[side]).applyMatrix4(bones[legs[side]].matrixWorld);
     lowest=Math.min(lowest,point.y);
     if(ball)contact=Math.min(contact,point.distanceTo(ball));
    }
    return{lowest,contact};
   });
  }
 };
}

test('all six strikes meet the authoritative release point with the appropriate skinned boot at the first pose',()=>{
 for(const stroke of Object.keys(strokes))for(const heading of [0,.91,Math.PI])for(const localX of [-.32,0,.32]){
  for(const [clip,phase,reach] of [['Idle_Loop',.2,.52],['Jog_Fwd_Loop',.6,.66],['Sprint_Loop',.8,.79]]){
   const f=fixture(),frame={clip,phase,heading,scale:1.03};f.pose(null,frame);
   const ball=f.worldBall(localX,.11,reach),motion=action(stroke,{contactX:ball.x,contactY:ball.y,contactZ:ball.z});
   f.pose(motion,frame);
   const boots=f.boots(ball),strikeBoot=boots[localX>.20?0:1];
   assert.ok(Math.abs(strikeBoot.contact-.11)<.025,JSON.stringify({stroke,heading,localX,reach,boots}));
   assert.ok(boots.every(boot=>boot.lowest>=.001),JSON.stringify({stroke,heading,localX,reach,boots}));
  }
 }
});

test('the support boot anchors as the skinned actor continues across the grass at each pose rate',()=>{
 for(const hz of [12,30,60])for(const heading of [0,1.57,3.14])for(const side of [-1,1]){
  const f=fixture(),start={heading,clip:'Jog_Fwd_Loop',phase:.36};f.pose(null,start);
  const ball=f.worldBall(side*.29,.11,.58);
  const motion=action('drive',{contactX:ball.x,contactY:ball.y,contactZ:ball.z,power:.85});
  const support=side>0?1:0;
  const first=f.pose(motion,start).feet[support];
  for(let n=1;n<=Math.ceil(motion.duration*hz);n++){
   const elapsed=Math.min(motion.duration,n/hz),travel=elapsed*2.2;
   const frame={...start,heading:heading+elapsed*.13,phase:(start.phase+elapsed*1.6)%1,x:8+Math.sin(heading+.30)*travel,z:15+Math.cos(heading+.30)*travel};
   const current=f.pose({...motion,elapsed},frame);
   if(elapsed<=1/12+1e-5)assert.ok(current.feet[support].distanceTo(first)<.024,JSON.stringify({hz,heading,side,elapsed,first,current:current.feet[support]}));
   assert.ok(f.boots().every(boot=>boot.lowest>=-.001),JSON.stringify({hz,heading,side,elapsed}));
   if(elapsed===motion.duration)assert.deepEqual(current,f.pose(null,frame),'the action returns to the exact locomotion sample');
  }
 }
});

test('passes, finesse, driven shots and lobs have distinct contact and follow-through, while predicted strokes only load',()=>{
 const frame={clip:'Idle_Loop',phase:.45,x:0,z:0},f=fixture();
 const shortContact=f.pose(action('short'),frame),driveContact=f.pose(action('drive'),frame),lobContact=f.pose(action('lob'),frame);
 assert.ok(shortContact.toe[1].x<driveContact.toe[1].x-.5,'the short pass opens the inside of the boot');
 assert.ok(lobContact.toe[1].y>driveContact.toe[1].y+.3,'the lob lifts the toe under the ball');
 const low=f.pose(action('drive',{elapsed:.14,power:.15}),frame);
 const hard=f.pose(action('drive',{elapsed:.14,power:1}),frame);
 const firstTime=f.pose(action('drive',{elapsed:.14,power:1,firstTime:true}),frame);
 const finesse=f.pose(action('finesse',{elapsed:.14,power:1}),frame);
 const short=f.pose(action('short',{elapsed:.08,power:1}),frame);
 const through=f.pose(action('through',{elapsed:.08,power:1}),frame);
 const loft=f.pose(action('lofted',{elapsed:.08,power:1}),frame);
 assert.ok(hard.feet[1].y>low.feet[1].y+.045,'power adds lift to the follow-through');
 assert.ok(hard.feet[1].distanceTo(driveContact.feet[1])>short.feet[1].distanceTo(shortContact.feet[1])+.12);
 assert.ok(finesse.feet[1].x>hard.feet[1].x+.09,'finesse wraps the foot across the body');
 assert.ok(through.feet[1].z>short.feet[1].z+.045,'the ground through-ball has a longer stroke');
 assert.ok(loft.feet[1].y>through.feet[1].y+.05,'the lofted through-ball lifts the leg: '+loft.feet[1].y+' vs '+through.feet[1].y);
 assert.ok(hard.feet[1].distanceTo(driveContact.feet[1])>firstTime.feet[1].distanceTo(driveContact.feet[1])+.04,'a first-time strike has a compact follow-through');
 for(const stroke of Object.keys(strokes))for(const elapsed of [0,.08,.23,.31]){
  const pending=f.pose(action(stroke,{elapsed,predicted:true}),frame);
  assert.ok(pending.feet[1].z<.25,'an unconfirmed action stays behind the contact point');
  assert.ok(f.boots().every(boot=>boot.lowest>=-.001));
 }
});

test('high-speed charge and online anticipation keep both running boots on their base gait',()=>{
 const f=fixture();
 const prepare={type:'prepareShot',stroke:'drive',elapsed:.9,duration:1};
 const pending=action('drive',{elapsed:.22,predicted:true});
 for(const [clip,speed] of [['Jog_Fwd_Loop',4.5],['Sprint_Loop',7]]){
  for(let phase=0;phase<1;phase+=.125){
   const frame={clip,phase,speed},baseline=f.pose(null,frame);
   for(const motion of [prepare,pending]){
    const loaded=f.pose(motion,frame);
    assert.deepEqual(loaded.feet,baseline.feet);
    assert.deepEqual(loaded.root,baseline.root);
    assert.ok(loaded.arms[0].angleTo(baseline.arms[0])>.05,'the upper body shows the shot preparation');
   }
  }
 }
 const idle={clip:'Idle_Loop',phase:.25};
 assert.ok(f.pose(prepare,idle).feet[1].distanceTo(f.pose(null,idle).feet[1])>.15,'stationary charging still loads its back leg');
});

test('a run-up carries the true planted foot into immediate contact and takes weight over the next frames',()=>{
 const f=fixture();
 let samples=0,totalFixed=0,totalRunning=0,worstContact=0;
 for(const stroke of ['short','drive'])for(const [clip,speed] of [['Jog_Fwd_Loop',4.5],['Sprint_Loop',7]]){
  for(const localX of [-.28,.28])for(let n=0;n<20;n++){
   const frame={clip,phase:n/20},strikeSide=localX>0?0:1,supportSide=1-strikeSide;
   const before=f.pose(null,frame);
   if(f.boots()[supportSide].lowest>.035)continue;
   const ball=f.worldBall(localX,.11,.63);
   const metadata={id:++samples*2,contactX:ball.x,contactY:ball.y,contactZ:ball.z};
   const fixed=f.pose(action(stroke,metadata),frame);
   const motion=action(stroke,{...metadata,id:metadata.id+1,approachSpeed:speed});
   const running=f.pose(motion,frame),boot=f.boots(ball)[strikeSide];
   totalFixed+=fixed.feet[supportSide].distanceTo(before.feet[supportSide]);
   totalRunning+=running.feet[supportSide].distanceTo(before.feet[supportSide]);
   worstContact=Math.max(worstContact,Math.abs(boot.contact-.11));
   assert.ok(running.root.y>fixed.root.y+.04,'the hips absorb weight progressively');
   const overPlant=f.pose({...motion,elapsed:motion.duration*.24},frame);
   assert.ok(overPlant.root.y<running.root.y-.028,'the runner settles over the support after contact');
  }
 }
 assert.ok(samples>24);
 assert.ok(totalRunning<totalFixed*.52,JSON.stringify({samples,totalFixed,totalRunning}));
 assert.ok(worstContact<.045,'run-up does not push the foot away from the real ball: '+worstContact);
});

test('a central running pass chooses the free boot when the right shoe is already on the grass',()=>{
 const f=fixture();
 let cases=0;
 for(let n=0;n<20;n++){
  const frame={clip:'Sprint_Loop',phase:n/20,speed:6.5};
  f.pose(null,frame);
  const [left,right]=f.boots();
  if(right.lowest>.02||left.lowest-right.lowest<.11)continue;
  const ball=f.worldBall(0,.11,.61);
  f.pose(action('short',{id:n,contactX:ball.x,contactY:ball.y,contactZ:ball.z}),frame);
  const [strike,support]=f.boots(ball);
  assert.ok(Math.abs(strike.contact-.11)<.04);
  assert.ok(support.lowest<.045&&support.contact>.114,JSON.stringify({n,left,right,strike,support}));
  cases++;
 }
 assert.ok(cases>=2);
});
