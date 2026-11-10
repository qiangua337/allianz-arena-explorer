import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExperienceHub,shouldOpenExperienceHub} from '../dist/experience-hub.js';
test('only an ordinary landing opens the hub; scene, training and invitation links keep their destination',()=>{
 assert.equal(shouldOpenExperienceHub(''),true);assert.equal(shouldOpenExperienceHub('?night=1'),true);
 for(const search of ['?place=press','?view=walk','?experience=training&drill=shooting','?room=ABCDEFGH'])assert.equal(shouldOpenExperienceHub(search),false);
});
test('mode selection closes and restores input before opening the next mode, including the native delayed close event',async()=>{
 const classes=new Set(),events=[],listeners={},nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},setAttribute(k,v){this[k]=v;}});return nodes.get(id);};
 const dialog=node('arena-hub'),modes=['explore','training','match','entrance','online'].map(mode=>({dataset:{hubMode:mode}})),times=['day','night'].map(time=>({dataset:{hubTime:time},setAttribute(k,v){this[k]=v;}}));
 dialog.querySelectorAll=selector=>selector==='[data-hub-mode]'?modes:times;dialog.addEventListener=(type,fn)=>listeners[type]=fn;dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;queueMicrotask(()=>listeners.close());};
 globalThis.document={getElementById:node,body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};let settings={night:false,quality:'standard'};
 const hub=buildExperienceHub({getSettings:()=>settings,onOpen:()=>{events.push('open');return{ready:false};},onClose:value=>events.push('restore:'+value.ready),onTraining:()=>events.push('training'),onOnline:()=>events.push('online'),onEnvironment:value=>settings.night=value,onQuality:value=>settings.quality=value});
 hub.open();hub.open();assert.deepEqual(events,['open']);assert.equal(hub.active,true);assert.ok(classes.has('hub-open'));times[1].onclick();assert.equal(times[1]['aria-pressed'],'true');assert.equal(times[0]['aria-pressed'],'false');
 node('hub-quality').value='low';node('hub-quality').onchange();assert.equal(settings.quality,'low');modes[1].onclick();assert.deepEqual(events,['open','restore:false','training']);assert.equal(hub.active,false);assert.ok(!classes.has('hub-open'));await Promise.resolve();assert.equal(events.length,3,'late close cannot pause a newly entered mode');
 hub.open();modes[4].onclick();assert.deepEqual(events.slice(-2),['restore:false','online'],'the friends card opens its own lobby after input has been restored');await Promise.resolve();assert.equal(hub.active,false);
 hub.open();dialog.close();await Promise.resolve();assert.equal(events.at(-1),'restore:false','Escape/native close restores previous input state');
});
