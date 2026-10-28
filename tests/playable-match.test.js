import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {buildPlayableMatch}=await import('../dist/playable-match.js');
function fixture(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id)){const handlers={};nodes.set(id,{hidden:false,textContent:'',dataset:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;},addEventListener(k,v){handlers[k]=v;},fire(k,v){handlers[k]?.(v);},showModal(){this.open=true;},close(){if(this.open){this.open=false;handlers.close?.();}},focus(){}});}return nodes.get(id);};
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),classes=new Set();
 globalThis.document={createElement:()=>({getContext:()=>context}),getElementById:node,querySelectorAll:()=>[],exitPointerLock(){},body:{dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};
 let actorUpdates=0,cheers=0;const audio={muted:false,state:'playing',cheer(){},cue(){},setMuted(value){this.muted=value;}},players={ready:true,root:new THREE.Group(),updateMatch(){actorUpdates++;}};let game;const views=[];
 game=buildPlayableMatch({scene:new THREE.Scene(),stadium:{matchBall:new THREE.Mesh()},players,audio,onCamera(){},onView:v=>views.push(v),onPause:value=>game.setPaused(value),onRestart:()=>game.start(),onExit:()=>game.exit(),onCheer:()=>cheers++});
 return{game,node,audio,views,classes,get actorUpdates(){return actorUpdates;},get cheers(){return cheers;}};
}
const run=(game,seconds,input={})=>{for(let i=0;i<Math.round(seconds*60);i++)game.update(1/60,input,{x:0,y:5,z:9});};
test('a pending or failed player load never advances a live match; retry starts a fresh kick-off',()=>{
 const{game,node,classes}=fixture();game.start();run(game,10);assert.equal(game.state.phaseTime,0);assert.equal(game.state.elapsed,0);assert.equal(game.action('shoot'),false);assert.equal(node('game-overlay').hidden,false);assert.ok(classes.has('game-active'));
 game.fail();assert.equal(node('game-overlay-title').textContent,'球员暂未加载');assert.equal(node('game-restart').hidden,false);game.start();game.ready();run(game,3.1);assert.equal(game.state.phase,'playing');assert.ok(game.state.elapsed<.2);assert.equal(node('game-overlay').hidden,true);
});
test('pause is explicit, help preserves a previous pause, and exit clears the live HUD before callbacks can resume it',()=>{
 const{game,node,classes,views}=fixture();game.start();game.ready();run(game,3.1);game.setPaused(true);const before=JSON.stringify(game.state);run(game,5);assert.equal(JSON.stringify(game.state),before);assert.equal(node('game-resume').hidden,false);
 game.showHelp();assert.equal(node('game-help-dialog').open,true);node('game-help-close').onclick();assert.equal(game.state.paused,true);game.setPaused(false);game.showHelp();node('game-help-close').onclick();assert.equal(game.state.paused,false);
 game.setView('first');assert.equal(views.at(-1),'first');game.exit();assert.equal(game.active,false);assert.equal(node('game-ui').hidden,true);assert.ok(!classes.has('game-active'));assert.equal(game.action('pass'),false);
});
test('sound remains controllable during play and restarting resets possession and score',()=>{
 const{game,node,audio}=fixture();game.start();game.ready();run(game,3.1);node('game-mute').onclick();assert.equal(audio.muted,true);assert.equal(node('game-mute')['aria-label'],'开启比赛声音');game.state.score.home=2;node('game-restart').onclick();assert.deepEqual(game.state.score,{home:0,away:0});assert.equal(game.state.phase,'kickoff');assert.equal(game.state.ball.ownerId,'home-1');
});


test('control assistance can change during a match without resetting it, and pressure releases on pause',()=>{
 const{game,node}=fixture();game.start();game.ready();run(game,3.2);const elapsed=game.state.elapsed,controlled=game.state.controlledId;game.setControlMode('manual');assert.equal(game.state.controlMode,'manual');assert.equal(game.state.elapsed,elapsed);assert.equal(game.state.controlledId,controlled);assert.equal(node('game-control-mode').textContent,'手动 ↻');
 const button=node('game-pressure');button.fire('pointerdown',{pointerId:7,preventDefault(){}});run(game,.1);assert.equal(game.state.players.find(p=>p.id===controlled).defending,true);assert.equal(button['aria-pressed'],'true');game.setPaused(true);assert.equal(button['aria-pressed'],'false');game.setPaused(false);run(game,.1);assert.equal(game.state.players.find(p=>p.id===controlled).defending,false);
 node('game-control-mode').onclick();assert.equal(game.state.controlMode,'semi');
});

test('a charged shot releases exactly once, pointer cancellation and pausing discard it safely',()=>{
 const speeds=[];for(const hold of[.1,.8]){const{game,node}=fixture();game.start();game.ready();run(game,3.1);assert.equal(game.beginCharge(),true);run(game,hold);assert.equal(node('game-shoot')['aria-pressed'],'true');assert.equal(game.releaseCharge(),true);assert.equal(game.state.stats.home.shots,1);assert.equal(game.releaseCharge(),false);speeds.push(Math.hypot(game.state.ball.vx,game.state.ball.vz));}assert.ok(speeds[1]>speeds[0]+7);
 const{game,node}=fixture();game.start();game.ready();run(game,3.1);const shoot=node('game-shoot');shoot.fire('pointerdown',{pointerId:9,preventDefault(){}});run(game,.3);shoot.fire('pointercancel',{pointerId:9});assert.equal(game.state.chargePower,0);assert.equal(game.state.stats.home.shots,0);assert.equal(game.releaseCharge(),false);assert.equal(game.beginCharge(),true);game.setPaused(true);game.setPaused(false);assert.equal(game.releaseCharge(),false);assert.equal(game.state.stats.home.shots,0);
});

test('changing opponent replaces the simulated squad and scoreboard while camera switches preserve a live match',()=>{
 const{game,node}=fixture();game.start({opponent:'barcelona',difficulty:'challenge',camera:'broadcast'});game.ready();run(game,3.2);assert.equal(node('game-away-name').textContent,'巴萨');assert.equal(game.state.players.find(p=>p.id==='away-9').name,'LAMINE YAMAL');const elapsed=game.state.elapsed;assert.equal(game.camera,'broadcast');assert.equal(game.cycleCamera(),'follow');assert.equal(game.cycleCamera(),'first');assert.equal(game.view,'first');assert.equal(game.cycleCamera(),'broadcast');assert.equal(game.state.elapsed,elapsed);assert.equal(game.state.fixture.id,'barcelona');game.start({opponent:'city',difficulty:'casual'});assert.equal(node('game-away-name').textContent,'曼城');assert.equal(game.state.players.find(p=>p.id==='away-1').name,'HAALAND');assert.equal(game.state.elapsed,0);
});

test('pausing stops repeated skeleton work while a paused perspective change still refreshes the scene once',()=>{
 const f=fixture();f.game.start();f.game.ready();run(f.game,3.2);f.game.setPaused(true);const before=f.actorUpdates;run(f.game,1);assert.equal(f.actorUpdates,before);f.game.setCamera('first');run(f.game,.2);assert.equal(f.actorUpdates,before+1);f.game.setPaused(false);run(f.game,.2);assert.ok(f.actorUpdates>before+5);
});

test('cheering works independently of ball possession and cannot fire during loading, pause or after exit',()=>{
 const f=fixture(),cheer=f.node('game-cheer');f.game.start();cheer.onclick();assert.equal(f.cheers,0);f.game.ready();run(f.game,3.1);const before=JSON.stringify(f.game.state);cheer.onclick();assert.equal(f.cheers,1);assert.equal(JSON.stringify(f.game.state),before,'cheering never changes the score, ball or player state');f.game.state.ball.ownerId='away-1';cheer.onclick();assert.equal(f.cheers,2);f.game.setPaused(true);assert.equal(cheer.disabled,true);cheer.onclick();assert.equal(f.cheers,2);f.game.exit();cheer.onclick();assert.equal(f.cheers,2);
});

test('optional replay freezes the real score, ball and clock, then returns paused without changing the chosen perspective',()=>{
 const f=fixture();f.game.start();assert.equal(f.game.startReplay(),false);f.game.ready();run(f.game,8);f.game.setCamera('first');assert.equal(f.game.startReplay(),true);const before=JSON.stringify(f.game.state);run(f.game,1);assert.equal(JSON.stringify(f.game.state),before);assert.equal(f.game.action('shoot'),false);assert.equal(f.game.replaying,true);assert.ok(f.classes.has('game-replay'));f.game.endReplay();assert.equal(f.game.replaying,false);assert.equal(f.game.state.paused,true);assert.equal(f.game.view,'first');assert.ok(!f.classes.has('game-replay'));f.game.setPaused(false);const time=f.game.state.elapsed;run(f.game,.3);assert.ok(f.game.state.elapsed>time);f.game.exit();assert.equal(f.game.startReplay(),false);
});

test('shot style buttons cycle without resetting a match and changing style cancels an unfinished charge',()=>{
 const f=fixture();f.game.start();f.game.ready();run(f.game,3.1);const before=f.game.state.elapsed;assert.equal(f.game.beginCharge(),true);f.node('game-shot-mode').onclick();assert.equal(f.game.state.shotKind,'finesse');assert.equal(f.game.releaseCharge(),false);assert.equal(f.game.state.stats.home.shots,0);assert.equal(f.game.state.elapsed,before);f.game.cycleShotKind();assert.equal(f.game.state.shotKind,'lob');assert.equal(f.node('game-shot-mode').textContent,'挑射 Z');f.game.start({opponent:'madrid'});assert.equal(f.game.state.shotKind,'lob');
});
