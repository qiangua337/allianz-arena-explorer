import test from 'node:test';
import assert from 'node:assert/strict';
import {createLazyCrowd} from '../dist/lazy-crowd.js';

function fixture(){
 let created=0;const calls=[],root={visible:false},real={root,count:56000,nearCount:128,visitorCount:1200,assetState:'fallback',
  setQuality(...args){calls.push(['quality',...args]);},night(...args){calls.push(['night',...args]);},setOpponent(...args){calls.push(['opponent',...args]);},
  setEnabled(on){root.visible=on;calls.push(['enabled',on]);},prepare(){calls.push(['prepare']);this.assetState='ready';return Promise.resolve(true);},
  react(...args){calls.push(['react',...args]);},update(...args){calls.push(['update',...args]);}};
 const crowd=createLazyCrowd(()=>{created++;return real;});return{crowd,real,calls,get created(){return created;}};
}

test('arena-only views and early settings allocate no audience records or scene objects',()=>{
 const f=fixture(),club={id:'madrid',kit:{shirt:'#fff'}};f.crowd.setQuality('low',.7);f.crowd.night(true);f.crowd.setOpponent(club);f.crowd.update(1,{x:0,y:1.7,z:0});f.crowd.react(1,1);f.crowd.setEnabled(false);
 assert.equal(f.created,0);assert.equal(f.crowd.root,null);assert.equal(f.crowd.count,0);assert.equal(f.crowd.nearCount,0);assert.equal(f.crowd.visitorCount,0);assert.equal(f.crowd.assetState,'off');assert.deepEqual(f.calls,[]);
 f.crowd.setEnabled(true);assert.equal(f.created,1);assert.equal(f.crowd.root,f.real.root);assert.equal(f.crowd.count,56000);assert.equal(f.crowd.nearCount,128);assert.equal(f.crowd.visitorCount,1200);assert.equal(f.crowd.root.visible,true);
 assert.deepEqual(f.calls,[['quality','low',.7],['night',true],['opponent',club],['enabled',true]]);
});

test('preparation exposes the actual root and repeated matches reuse the same prepared crowd',async()=>{
 const f=fixture();assert.equal(await f.crowd.prepare(),true);assert.equal(f.created,1);assert.equal(f.crowd.root,f.real.root);assert.equal(f.crowd.assetState,'ready');assert.equal(f.crowd.root.visible,false);
 f.crowd.setEnabled(true);f.crowd.update(2,{x:0,y:2,z:0});f.crowd.react(2,.6);f.crowd.setEnabled(false);const at=f.calls.length;f.crowd.update(3,{});f.crowd.react(3,1);assert.equal(f.calls.length,at);
 f.crowd.setEnabled(true);await f.crowd.prepare();assert.equal(f.created,1);assert.equal(f.crowd.root,f.real.root);assert.equal(f.crowd.root.visible,true);assert.equal(f.calls.filter(c=>c[0]==='update').length,1);assert.equal(f.calls.filter(c=>c[0]==='react').length,1);
});

test('the latest pre-match settings win and later changes reach the existing crowd directly',()=>{
 const f=fixture();f.crowd.setQuality('high',1);f.crowd.setQuality('standard',.82);f.crowd.night(true);f.crowd.night(false);f.crowd.setOpponent({id:'dortmund'});const club={id:'barcelona'};f.crowd.setOpponent(club);f.crowd.setEnabled(true);
 assert.deepEqual(f.calls.slice(0,3),[['quality','standard',.82],['night',false],['opponent',club]]);
 f.crowd.setQuality('low');f.crowd.night(true);assert.deepEqual(f.calls.slice(-2),[['quality','low'],['night',true]]);assert.equal(f.created,1);
});

test('the deferred real crowd retains lightweight quality and replaces sprites only after detail is enabled',async()=>{
 const {registerHooks}=await import('node:module');registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),previous=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 try{
  const {THREE}=await import('../dist/kit.js'),{buildMatchdayCrowd}=await import('../dist/matchday-crowd.js'),scene=new THREE.Group(),seats=Array.from({length:2000},(_,i)=>({x:42+(i%40)*.5,z:-10+Math.floor(i/40)*.4,y:.7+(i%40)*.34,yaw:Math.PI/2,color:0xc91c36,sector:i%24}));
  const crowd=createLazyCrowd(()=>buildMatchdayCrowd(scene,seats,{mobile:true}));crowd.setQuality('low');crowd.night(true);crowd.setOpponent({kit:{shirt:'#eee'}});assert.equal(scene.children.length,0);
  crowd.setEnabled(true);assert.equal(scene.children.length,1);assert.equal(crowd.root,scene.children[0]);assert.ok(crowd.count>1800);crowd.update(1,{x:45,y:6,z:0});assert.equal(crowd.nearCount,0);
  crowd.setQuality('standard',1);crowd.update(2,{x:45,y:6,z:0});assert.equal(crowd.nearCount,128);crowd.setEnabled(false);assert.equal(crowd.root.visible,false);assert.equal(crowd.nearCount,0);crowd.setEnabled(true);assert.equal(scene.children.length,1);
 }finally{globalThis.document=previous;}
});
