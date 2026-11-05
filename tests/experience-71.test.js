import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {PerspectiveCamera,Vector3}=await import('../dist/vendor/three.module.js');
const {footballCamera,offscreenBallCue}=await import('../dist/football-controls.js');
const {buildFrameBudget}=await import('../dist/scene-budget.js');
const {cursorCandidate}=await import('../dist/football-assist.js');
const {createOnlinePrediction}=await import('../dist/online-prediction.js');
const {matchReport,buildMatchReport}=await import('../dist/football-report.js');

test('broadcast framing keeps nearby ball and the full controlled athlete in the safe view at touchlines, corners and phone aspects',()=>{
 for(const aspect of [320/740,390/844,844/390,16/9])for(const x of [-33,0,33])for(const z of [-52,0,52])for(const delta of [-25,0,25]){
  const player={x,z},ball={x:Math.max(-34,Math.min(34,x+delta*.3)),z:Math.max(-52.5,Math.min(52.5,z+delta)),y:.11},pose=footballCamera(player,{style:'broadcast',ball,aspect}),camera=new PerspectiveCamera(pose.fov,aspect,.1,2500);camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
  for(const point of [[x,0,z],[x,2,z],[ball.x,ball.y,ball.z]]){const q=new Vector3(...point).project(camera);assert.ok(Math.abs(q.x)<=.821&&q.y>=-.521&&q.y<=.651,JSON.stringify({aspect,player,ball,screen:q.toArray()}));}assert.ok(pose.position[1]<=45.01,'camera stays below the roof');
 }
});
test('a paused background stays idle but a resized canvas or changed quality draws once instead of remaining blank',()=>{const camera=new PerspectiveCamera(),budget=buildFrameBudget();assert.equal(budget.shouldDraw(camera,0,false,true),true);assert.equal(budget.shouldDraw(camera,2,true,true),false);budget.invalidate();assert.equal(budget.shouldDraw(camera,2.01,true,true),true);assert.equal(budget.shouldDraw(camera,2.02,true,true),false);camera.position.x=1;assert.equal(budget.shouldDraw(camera,2.03,false,true),true);assert.equal(budget.shouldDraw(camera,2.04,false,true),false);assert.equal(budget.shouldDraw(camera,3,true,false),true);});
test('defender selection exchanges goal-side preference after half time and a manual direction chooses the intended teammate',()=>{
 const p={id:'home-1',team:'home',x:10,z:0,attackSign:-1},front={id:'home-2',team:'home',x:0,z:3},back={id:'home-3',team:'home',x:0,z:-3},ball={x:0,z:0,ownerId:'away-1'};assert.equal(cursorCandidate([p,front,back],ball,{exclude:p.id}).id,front.id);p.attackSign=1;assert.equal(cursorCandidate([p,front,back],ball,{exclude:p.id}).id,back.id);
 const left={id:'home-4',team:'home',x:-8,z:0},right={id:'home-5',team:'home',x:8,z:0};p.x=0;p.z=12;for(const x of [-1,1])assert.equal(cursorCandidate([p,left,right],ball,{exclude:p.id,direction:{x,z:0}}).id,x>0?right.id:left.id);
});
test('a dismissed avatar cannot push the locally predicted player away from an otherwise empty position',()=>{const p={id:'home-1',team:'home',x:0,z:0,vx:0,vz:0,yaw:0,stamina:1},state={phase:'playing',paused:false,time:1,controlledId:p.id,players:[p,{id:'away-1',team:'away',x:0,z:0,dismissed:true}],ball:{x:10,z:10,y:.11,ownerId:null}};const predictor=createOnlinePrediction('home');predictor.receive(state);for(let i=0;i<12;i++)predictor.update(state,1/60,{x:0,z:0},i+1);assert.equal(p.x,0);assert.equal(p.z,0);});
test('match reports retain actual counts, separate shootout results and avoid rewriting an unchanged paused report',()=>{const s={fixture:{short:'皇马'},score:{home:1,away:1},stats:{home:{shots:8,onTarget:4,passes:30},away:{shots:6,onTarget:3,passes:26}},discipline:{home:{yellows:2,reds:1},away:{yellows:1,reds:0}},competition:{shootout:{home:[true,false,true],away:[true,false,false]}}},model=matchReport(s);assert.deepEqual(model.score,[1,1]);assert.deepEqual(model.penalties,[2,1]);assert.equal(model.rows.find(r=>r.label==='黄牌').home,2);assert.equal(model.rows[0].homeWidth,8/14*100);let writes=0;const root={set innerHTML(v){writes++;this.html=v;}};const report=buildMatchReport(root);report.update(s,true);report.update(s,true);assert.equal(writes,1);assert.ok(root.html.includes('点球 2 : 1'));s.stats.home.shots++;report.update(s,true);assert.equal(writes,2);report.update(s,false);assert.equal(root.hidden,true);});

test('off-screen ball cues stay away from the score and touch controls and disappear for visible balls',()=>{assert.equal(offscreenBallCue({x:0,y:0,z:.5},390,844),null);for(const point of [{x:4,y:.3,z:.5},{x:-3,y:-2,z:.5},{x:.1,y:.6,z:2}]){const cue=offscreenBallCue(point,390,844);assert.ok(cue.x>=25&&cue.x<=365);assert.ok(cue.y>=112&&cue.y<=654);assert.ok(Number.isFinite(cue.angle));}assert.equal(offscreenBallCue({x:NaN,y:0,z:0},390,844),null);});
