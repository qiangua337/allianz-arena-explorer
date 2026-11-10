import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// Retain the actual controller, HUD, training, match and online simulations.
// Only asset loading and browser/device constructors are replaced.
const factories={
 './online-lobby.js':'buildOnlineLobby','./matchday-crowd.js':'buildMatchdayCrowd',
 './entrance-players.js':'buildEntrancePlayers','./matchday-audio.js':'createMatchdayAudio',
 './matchday-set.js':'buildMatchdaySet','./football-setup.js':'buildMatchSetup'
};
registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true};
 const name=context.parentURL?.endsWith('/dist/matchday.js')&&factories[specifier];
 return name?{url:'data:text/javascript,'+encodeURIComponent(`export const ${name}=(...args)=>globalThis.trainingLifecycleFactories.${name}(...args);`),shortCircuit:true}:next(specifier,context);
}});
const {THREE}=await import('../dist/kit.js');
const {buildMatchdayExperience}=await import('../dist/matchday.js');
const {createFootballSimulation}=await import('../dist/football-simulation.js');
const {packOnlineState}=await import('../dist/online-protocol.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};

function fixture({prepareGate=null,onPrepare,audioStart=async()=>true}={}){
 const nodes=new Map(),classes=new Set(),context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 function element(){
  const listeners={},ownClasses=new Set();
  return{hidden:false,textContent:'',innerHTML:'',style:{},dataset:{},children:[],
   classList:{add:(...values)=>values.forEach(x=>ownClasses.add(x)),remove:(...values)=>values.forEach(x=>ownClasses.delete(x)),toggle(x,value){const on=value??!ownClasses.has(x);on?ownClasses.add(x):ownClasses.delete(x);return on;}},
   setAttribute(k,value){this[k]=value;},addEventListener(type,fn){listeners[type]=fn;},
   append(...children){this.children.push(...children);},getContext:()=>context,
   close(){this.open=false;queueMicrotask(()=>listeners.close?.());},showModal(){this.open=true;},focus(){}};
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const tabs=['training','play','online','tour'].map(panel=>({...element(),dataset:{matchTab:panel}}));
 globalThis.location={search:'',href:'https://arena.test/'};
 globalThis.document={createElement:element,getElementById:node,querySelectorAll:selector=>selector==='[data-match-tab]'?tabs:[],exitPointerLock(){},
  body:{dataset:{},classList:{add:(...values)=>values.forEach(x=>classes.add(x)),remove:(...values)=>values.forEach(x=>classes.delete(x)),toggle(x,on){on?classes.add(x):classes.delete(x);}}}};
 const calls={crowdConstructed:0,crowdPrepared:0,prepares:[],scores:[],exits:0,lobbyResets:0,ready:0,audioStarts:0,audioStops:0,toasts:[]};
 const audio={muted:false,state:'playing',duration:0,level:0,start:()=>{calls.audioStarts++;return audioStart();},stop(){calls.audioStops++;},setPaused(){},setVolume(){},setMuted(){},cheer(){},kick(){},whistle(){},update(){}};
 const crowd={root:new THREE.Group(),enabled:false,count:100,nearCount:0,visitorCount:10,assetState:'ready',
  prepare:async()=>{calls.crowdPrepared++;return true;},setEnabled(value){this.enabled=value;},setQuality(){},night(){},setOpponent(){},react(){},update(){}};crowd.root.name='audit-crowd';
 const players={root:new THREE.Group(),ready:!prepareGate,positions:'',prepare:async()=>{if(prepareGate)await prepareGate.promise;players.ready=true;return true;},reset(){},setOpponent(){},updateMatch(){}};players.root.name='audit-players';
 globalThis.trainingLifecycleFactories={
  buildOnlineLobby:()=>({reset(){calls.lobbyResets++;},open(){}}),
  buildMatchdayCrowd:()=>{calls.crowdConstructed++;return crowd;},buildEntrancePlayers:()=>players,
  createMatchdayAudio:()=>audio,buildMatchdaySet:()=>({setEnabled(){},isAnimating:()=>false}),
  buildMatchSetup:()=>({options:{opponent:'dortmund',rules:{mode:'league',duration:180}},refresh(){}})
 };
 const stadium={root:new THREE.Group(),bowl:new THREE.Group(),seatPositions:[],matchBall:new THREE.Mesh(),setMatchday(){},setMatchScore:s=>calls.scores.push(s.training?.id||'match')};
 const experience=buildMatchdayExperience({scene:new THREE.Scene(),stadium,toast:message=>calls.toasts.push(message),onExit:()=>calls.exits++,onPrepare:root=>{calls.prepares.push(root.name);return onPrepare?.(root);}});
 const position=new THREE.Vector3(0,8,0),run=seconds=>{for(let i=0;i<Math.round(seconds*60);i++)experience.update(1/60,position,0,{});};
 return{experience,calls,node,players,crowd,run,position};
}

test('training uses no crowd allocation or compile, completes from physical receptions and restarts the same lesson',async()=>{
 const {experience,calls,node,run}=fixture();
 const course=node('training-courses').children.find(button=>button.dataset.trainingDrill==='passing');
 await course.onclick();assert.equal(experience.training,'passing');
 assert.equal(calls.crowdConstructed,0);assert.equal(calls.crowdPrepared,0);
 assert.deepEqual(calls.prepares,['audit-players','Playable football cues']);
 for(let k=0;k<5;k++){
  const s=experience.gameState,owner=s.players.find(p=>p.id===s.ball.ownerId),mate=s.players.find(p=>p.team==='home'&&!p.trainingInactive&&p.id!==owner.id);
  assert.equal(experience.gameAction('pass',{direction:{x:mate.x-owner.x,z:mate.z-owner.z},power:.45}),true);
  assert.equal(s.training.metrics.completedPasses,k);
  for(let i=0;i<400&&s.training.metrics.completedPasses===k;i++)run(1/60);
  assert.equal(s.training.metrics.completedPasses,k+1);
 }
 assert.equal(experience.gameState.phase,'fulltime');assert.equal(node('game-overlay-title').textContent,'训练完成');
 assert.equal(node('training-result').hidden,false);assert.match(node('training-result').innerHTML,/成功传接/);
 assert.equal(node('game-result').hidden,true);assert.equal(node('game-overlay-team').hidden,true);
 assert.equal(calls.scores.length,0,'training must not overwrite arena screens with a fictitious match clock or opponent');
 await node('game-restart').onclick();
 assert.equal(experience.training,'passing');assert.equal(experience.gameState.training.metrics.completedPasses,0);
 assert.equal(experience.gameState.phase,'playing');assert.equal(node('training-result').hidden,true);
 assert.equal(calls.crowdConstructed,0);experience.exit();
});

test('changing a completed or paused course returns to training choices, then an ordinary match restores its HUD and crowd',async()=>{
 const {experience,calls,node,crowd}=fixture();await experience.start(false,true,null,'shooting');
 experience.setPaused(true);assert.equal(node('game-change-match').textContent,'选择其他训练');
 node('game-change-match').onclick();
 assert.equal(experience.active,false);assert.equal(node('match-dialog').dataset.panel,'training');assert.equal(node('match-dialog').open,true);
 assert.equal(node('game-ui').hidden,true);assert.equal(document.body.dataset.gameTraining,'');assert.equal(calls.exits,1);
 await experience.start(false,true);experience.setPaused(true);
 assert.equal(experience.training,null);assert.equal(node('training-hud').hidden,true);assert.equal(node('training-result').hidden,true);
 assert.equal(node('game-result').hidden,false);assert.equal(node('game-change-match').textContent,'更换对手与难度 →');
 assert.equal(calls.crowdConstructed,1);assert.equal(calls.crowdPrepared,1);assert.ok(calls.prepares.includes('audit-crowd'));
 assert.ok(calls.scores.length>0);assert.ok(calls.scores.every(mode=>mode==='match'));assert.equal(crowd.enabled,true);
 experience.exit();assert.equal(crowd.enabled,false);assert.equal(calls.exits,2);
});

test('leaving before model loading completes never readies or reveals an abandoned training session',async()=>{
 const gate=deferred(),{experience,node,calls,players,run}=fixture({prepareGate:gate});
 const starting=experience.start(false,true,null,'free');assert.equal(node('game-overlay-title').textContent,'正在准备训练球场');
 experience.exit();gate.resolve();await starting;run(.2);
 assert.equal(experience.active,false);assert.equal(experience.playing,false);assert.equal(node('game-ui').hidden,true);
 assert.equal(players.root.visible,false);assert.equal(document.body.dataset.gamePhase,undefined);
 assert.equal(document.body.dataset.gameTraining,'');assert.deepEqual(calls.prepares,[]);assert.equal(calls.exits,1);
});

test('leaving during shader preparation prevents later crowd and playable compilation',async()=>{
 const gate=deferred(),{experience,calls}=fixture({onPrepare:()=>gate.promise});
 const starting=experience.start(false,true);for(let i=0;i<6&&calls.prepares.length===0;i++)await Promise.resolve();
 assert.deepEqual(calls.prepares,['audit-players']);experience.exit();gate.resolve();await starting;
 assert.deepEqual(calls.prepares,['audit-players'],'obsolete loading work must stop after the pending await');
 assert.equal(experience.active,false);
});

test('switching sessions while an older compile awaits cannot ready or compile the old fixture over training',async()=>{
 const gate=deferred();let first=true;
 const {experience,calls,node,crowd}=fixture({onPrepare:()=>{if(first){first=false;return gate.promise;}}});
 const previous=experience.start(false,true);for(let i=0;i<6&&calls.prepares.length===0;i++)await Promise.resolve();
 await experience.start(false,true,null,'free');assert.equal(experience.training,'free');
 gate.resolve();await previous;
 assert.equal(experience.training,'free');assert.equal(experience.gameState.phase,'playing');
 assert.equal(node('game-overlay').hidden,true);assert.equal(crowd.enabled,false);
 assert.deepEqual(calls.prepares,['audit-players','audit-players','Playable football cues']);experience.exit();
});

test('a subsequent online match has no training state, readies once, and unsubscribes and leaves on exit',async()=>{
 const {experience,node}=fixture();await experience.start(false,true,null,'passing');experience.exit();
 const server=createFootballSimulation({humanTeams:['home','away'],rules:{mode:'league',duration:180}});
 for(let i=0;i<190;i++)server.update(1/60);
 const listeners=new Set();let readies=0,leaves=0;
 const session={team:'home',opponent:'dortmund',code:'ABCDEFGH',connection:'connected',latency:70,
  room:{started:true,seats:[{team:'home',paused:false},{team:'away',paused:false}]},packet:packOnlineState(server.state,1),
  subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},send:()=>true,sendInput:()=>1,setReady:()=>readies++,leave:()=>leaves++};
 await experience.start(false,true,session);
 assert.equal(experience.online,true);assert.equal(experience.training,null);assert.equal(experience.gameState.training,undefined);
 assert.equal(node('training-hud').hidden,true);assert.equal(readies,1);assert.equal(listeners.size,1);
 experience.exit();assert.equal(listeners.size,0);assert.equal(leaves,1);assert.equal(experience.online,false);
});

test('ready models start an ordinary match and training while the audio download remains unresolved',async()=>{
 for(const drill of [null,'free']){
  const sound=deferred(),{experience,node,run,calls}=fixture({audioStart:()=>sound.promise});
  let ready=false;const starting=experience.start(false,true,null,drill).then(()=>ready=true);
  await flush();
  try{
   assert.equal(ready,true,'model readiness must not wait for the stadium recording');
   assert.equal(node('game-overlay').hidden,true);assert.equal(experience.active,true);
   assert.equal(experience.gameState.phase,drill?'playing':'kickoff');
   const time=experience.gameState.time;run(.2);assert.ok(experience.gameState.time>time,'the real simulation already advances');
   assert.equal(calls.toasts.length,0);assert.equal(calls.audioStarts,1);
  }finally{experience.exit();sound.resolve(true);await starting;}
 }
});

test('late audio resolve or rejection after exit cannot revive the controller or emit stale failure toasts',async()=>{
 for(const settlement of ['resolve','reject']){
  const sound=deferred(),{experience,node,calls,players,run}=fixture({audioStart:()=>sound.promise});
  let ready=false;const starting=experience.start(false,true).then(()=>ready=true);await flush();
  assert.equal(ready,true);experience.exit();
  if(settlement==='resolve')sound.resolve(false);else sound.reject(Error('late recording failure'));
  await starting;await flush();run(.2);
  assert.equal(experience.active,false);assert.equal(experience.playing,false);assert.equal(players.root.visible,false);
  assert.equal(node('game-ui').hidden,true);assert.equal(document.body.dataset.gamePhase,undefined);
  assert.equal(calls.audioStarts,1);assert.equal(calls.audioStops,1);assert.deepEqual(calls.toasts,[]);
 }
});

test('late sound from a replaced match does not warn over a newly ready training session',async()=>{
 const oldSound=deferred();let first=true;
 const {experience,calls,node}=fixture({audioStart:()=>{if(first){first=false;return oldSound.promise;}return Promise.resolve(true);}});
 const previous=experience.start(false,true);await flush();
 await experience.start(false,true,null,'passing');oldSound.reject(Error('old match audio failed'));await previous;await flush();
 assert.equal(experience.training,'passing');assert.equal(experience.gameState.phase,'playing');
 assert.equal(node('game-overlay').hidden,true);assert.deepEqual(calls.toasts,[]);experience.exit();
});
