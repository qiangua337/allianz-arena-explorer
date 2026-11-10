import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// Exercise the real matchday controller, playable HUD and online simulation.
// Asset constructors are isolated so the regression needs no WebGL/audio device.
const factories={
 './online-lobby.js':'buildOnlineLobby',
 './matchday-crowd.js':'buildMatchdayCrowd',
 './entrance-players.js':'buildEntrancePlayers',
 './matchday-audio.js':'createMatchdayAudio',
 './matchday-set.js':'buildMatchdaySet',
 './football-setup.js':'buildMatchSetup'
};
registerHooks({resolve(s,c,next){
 if(s==='three')return{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true};
 const name=c.parentURL?.endsWith('/dist/matchday.js')&&factories[s];
 return name?{url:'data:text/javascript,'+encodeURIComponent(`export const ${name}=(...args)=>globalThis.matchdayTestFactories.${name}(...args);`),shortCircuit:true}:next(s,c);
}});
const {THREE}=await import('../dist/kit.js');
const {createFootballSimulation}=await import('../dist/football-simulation.js');
const {packOnlineState}=await import('../dist/online-protocol.js');
const {buildMatchdayExperience}=await import('../dist/matchday.js');

test('remote pauses and halftime freeze crowd/audio clocks but keep online updates and resume without a time jump',async()=>{
 const nodes=new Map(),classes=new Set(),node=id=>{if(!nodes.has(id)){const handlers={};nodes.set(id,{hidden:false,textContent:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v;},addEventListener(k,v){handlers[k]=v;},append(){},close(){this.open=false;},showModal(){this.open=true;},focus(){}});}return nodes.get(id);};
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 globalThis.document={createElement:()=>({dataset:{},append(){},getContext:()=>context}),getElementById:node,querySelectorAll:()=>[],exitPointerLock(){},body:{dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,value){value?classes.add(x):classes.delete(x);}}}};
 const audioPauses=[],pauseEvents=[],crowdTimes=[];let audioUpdates=0,actorUpdates=0;
 const audio={muted:false,state:'playing',duration:10,level:0,start:async()=>true,stop(){},setPaused:value=>audioPauses.push(value),setVolume(){},setMuted(){},cheer(){},kick(){},whistle(){},update(){audioUpdates++;}};
 const crowd={root:new THREE.Group(),count:100,nearCount:0,visitorCount:10,assetState:'ready',prepare:async()=>true,setEnabled(){},setQuality(){},night(){},setOpponent(){},react(){},update:time=>crowdTimes.push(time)};
 globalThis.matchdayTestFactories={
  buildOnlineLobby:()=>({reset(){}}),buildMatchdayCrowd:()=>crowd,
  buildEntrancePlayers:()=>({root:new THREE.Group(),ready:true,positions:'',prepare:async()=>true,reset(){},setOpponent(){},updateMatch(){actorUpdates++;}}),
  createMatchdayAudio:()=>audio,buildMatchdaySet:()=>({setEnabled(){},isAnimating:()=>false}),
  buildMatchSetup:()=>({options:{opponent:'dortmund',rules:{mode:'league',duration:180}}})
 };
 const server=createFootballSimulation({humanTeams:['home','away'],rules:{mode:'league',duration:180}});for(let i=0;i<190;i++)server.update(1/60,{});
 const listeners=new Set(),inputs=[],session={team:'home',opponent:'dortmund',code:'ABCDEFGH',connection:'connected',latency:80,room:{started:true,seats:[{team:'home',paused:false},{team:'away',paused:false}]},packet:packOnlineState(server.state,1),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setReady(){},leave(){},send:()=>true,sendInput:p=>{inputs.push(p);return inputs.length;}};
 const stadium={root:new THREE.Group(),bowl:new THREE.Group(),seatPositions:[],matchBall:new THREE.Mesh()},experience=buildMatchdayExperience({scene:new THREE.Scene(),stadium,onPause:value=>pauseEvents.push(value)}),position=new THREE.Vector3(0,8,0);
 const run=seconds=>{for(let i=0;i<Math.round(seconds*60);i++)experience.update(1/60,position,0,{});},publish=seq=>{session.packet=packOnlineState(server.state,seq);for(const receive of listeners)receive();};
 await experience.start(false,true,session);run(.2);assert.equal(experience.isAnimating(),true);const before=crowdTimes.at(-1);
 server.setPaused(true);publish(2);run(1/60);assert.equal(experience.paused,true);assert.equal(experience.isAnimating(),false);assert.equal(document.body.dataset.matchday,'paused');assert.equal(audioPauses.at(-1),true);assert.equal(pauseEvents.at(-1),true);assert.equal(experience.cheer(),false);
 const audioCount=audioUpdates,crowdCount=crowdTimes.length,actors=actorUpdates,inputCount=inputs.length;run(10);assert.equal(audioUpdates,audioCount);assert.equal(crowdTimes.length,crowdCount);assert.equal(actorUpdates,actors);assert.ok(inputs.length>inputCount+40,'network input heartbeat remains alive');
 session.connection='reconnecting';for(const receive of listeners)receive();run(1/60);assert.equal(node('game-overlay-title').textContent,'正在重新连接');session.connection='connected';server.setPaused(false);publish(3);run(1/60);assert.equal(experience.paused,false);assert.equal(audioPauses.at(-1),false);assert.equal(experience.isAnimating(),true);assert.ok(Math.abs(crowdTimes.at(-1)-before-1/60)<1e-8,'crowd resumes one frame later without advancing through the pause');
 server.state.phase='interval';server.state.paused=true;publish(4);run(1/60);assert.equal(experience.isAnimating(),false);assert.equal(node('game-overlay-title').textContent,'中场休息');assert.equal(audioPauses.at(-1),true);experience.exit();delete globalThis.matchdayTestFactories;
});
