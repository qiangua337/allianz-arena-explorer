import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {buildPlayableMatch}=await import('../dist/playable-match.js');
function fixture(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id)){const handlers={};nodes.set(id,{hidden:false,textContent:'',dataset:{},setAttribute(k,v){this[k]=v;},addEventListener(k,v){handlers[k]=v;},fire(k,v){handlers[k]?.(v);},showModal(){this.open=true;},close(){if(this.open){this.open=false;handlers.close?.();}},focus(){}});}return nodes.get(id);};
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),classes=new Set();
 globalThis.document={createElement:()=>({getContext:()=>context}),getElementById:node,querySelectorAll:()=>[],exitPointerLock(){},body:{dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};
 const audio={muted:false,state:'playing',cheer(){},cue(){},setMuted(value){this.muted=value;}},players={ready:true,root:new THREE.Group(),updateMatch(){}};let game;const views=[];
 game=buildPlayableMatch({scene:new THREE.Scene(),stadium:{matchBall:new THREE.Mesh()},players,audio,onCamera(){},onView:v=>views.push(v),onPause:value=>game.setPaused(value),onRestart:()=>game.start(),onExit:()=>game.exit()});
 return{game,node,audio,views,classes};
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
