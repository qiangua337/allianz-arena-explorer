import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatchdayAudio} from '../dist/matchday-audio.js';

class Param{value=0;setTargetAtTime(v){this.value=v;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}}
class Node{gain=new Param();frequency=new Param();Q=new Param();pan=new Param();connect(){return this;}disconnect(){}start(){this.started=true;}stop(){this.stopped=true;}}
class Context{
 static instances=[];sampleRate=1000;currentTime=0;state='suspended';destination=new Node();sources=[];
 constructor(){Context.instances.push(this);}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}
 createGain(){return new Node();}createBiquadFilter(){return new Node();}createStereoPanner(){return new Node();}createConvolver(){return new Node();}
 createDynamicsCompressor(){return{connect(){},threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param()};}
 createAnalyser(){const n=new Node();n.getFloatTimeDomainData=a=>a.fill(.02);return n;}
 createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length).fill(.1));return{length,numberOfChannels:channels,sampleRate:rate,duration:length/rate,getChannelData:i=>data[i]};}
 async decodeAudioData(){return this.createBuffer(2,40000,1000);}
 createBufferSource(){const n=new Node();this.sources.push(n);return n;}createOscillator(){const n=new Node();this.sources.push(n);return n;}
}
const response={ok:true,arrayBuffer:async()=>new ArrayBuffer(20)};
function setup(t,fetch=async()=>response){const oldAudio=globalThis.AudioContext,oldFetch=globalThis.fetch;Context.instances=[];globalThis.AudioContext=Context;globalThis.fetch=fetch;t.after(()=>{globalThis.AudioContext=oldAudio;globalThis.fetch=oldFetch;});}

test('opening or changing sound settings never autoplays or creates an audio context',t=>{
 setup(t);const a=createMatchdayAudio();assert.equal(a.state,'off');a.setVolume(.4);a.setMuted(true);assert.equal(Context.instances.length,0);assert.equal(a.state,'off');
});
test('start decodes once, pause suspends, replay reuses the context and mute controls the signal',async t=>{
 let fetches=0;setup(t,async()=>{fetches++;return response;});let last;const a=createMatchdayAudio({onState:s=>last=s});assert.equal(await a.start(),true);const c=Context.instances[0];assert.equal(a.state,'playing');assert.equal(a.duration,40);assert.equal(c.sources.filter(n=>n.loop).length,1);
 a.setPaused(true);await Promise.resolve();assert.equal(c.state,'suspended');assert.equal(a.state,'paused');assert.equal(a.level,0);a.setPaused(false);await Promise.resolve();assert.equal(c.state,'running');
 a.setVolume(0);assert.equal(a.state,'muted');a.setMuted(false);assert.equal(a.state,'playing');assert.equal(last.volume,.65);a.setMuted(true);assert.equal(a.state,'muted');assert.equal(a.level,0);
 a.stop();assert.equal(a.state,'off');assert.equal(c.sources[0].stopped,true);assert.equal(await a.start(),true);assert.equal(Context.instances.length,1);assert.equal(fetches,1);a.stop();
});
test('a failed download remains retryable even if the user adjusts volume',async t=>{
 let calls=0;setup(t,async()=>++calls===1?{ok:false,status:503}:response);const a=createMatchdayAudio();assert.equal(await a.start(),false);assert.equal(a.state,'unavailable');a.setVolume(.3);a.setMuted(true);assert.equal(a.state,'unavailable');assert.equal(await a.start(),true);assert.equal(a.state,'muted');assert.equal(calls,2);a.stop();
});
test('exiting while audio loads cannot start sound later',async t=>{
 let resolve;setup(t,()=>new Promise(r=>resolve=r));const a=createMatchdayAudio(),started=a.start();await Promise.resolve();assert.ok(resolve);a.stop();resolve(response);assert.equal(await started,false);assert.equal(a.state,'off');assert.equal(Context.instances[0].sources.length,0);
});
test('pausing during loading keeps the decoded recording suspended',async t=>{
 let resolve;setup(t,()=>new Promise(r=>resolve=r));const a=createMatchdayAudio(),started=a.start();await Promise.resolve();a.setPaused(true);resolve(response);assert.equal(await started,true);assert.equal(a.state,'paused');assert.equal(Context.instances[0].state,'suspended');a.stop();
});
test('exit also stops outstanding cheers and generated footsteps',async t=>{
 setup(t);const a=createMatchdayAudio();await a.start();a.cheer();a.footstep(0);a.cue(2);const c=Context.instances[0];assert.equal(c.sources.length,4);a.stop();assert.ok(c.sources.every(s=>s.stopped));
});
