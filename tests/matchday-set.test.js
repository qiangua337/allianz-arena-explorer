import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
const context=new Proxy({measureText:t=>({width:String(t).length*20})},{get:(o,k)=>k in o?o[k]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>context})};
const {THREE}=await import('../dist/kit.js'),{buildMatchdaySet}=await import('../dist/matchday-set.js');
test('the ball only responds nearby on its floor and resets when matchday closes',()=>{
 const root=new THREE.Group(),ball=new THREE.Mesh(new THREE.SphereGeometry(.11),new THREE.MeshBasicMaterial());ball.position.set(0,.115,0);root.add(ball);const setting=buildMatchdaySet(root,ball);
 assert.equal(setting.kick({x:0,y:1.7,z:1},0),false);setting.setEnabled(true);assert.equal(setting.kick({x:10,y:1.7,z:0},0),false);assert.equal(setting.kick({x:0,y:13.9,z:0},0),false);assert.equal(setting.kick({x:0,y:1.7,z:1},0),true);
 for(let i=0;i<300;i++)setting.update(.05);assert.ok(ball.position.z<-3);assert.ok(ball.position.z>-52.3);assert.equal(setting.isAnimating(),false);setting.setEnabled(false);assert.deepEqual(ball.position.toArray(),[0,.115,0]);
});
