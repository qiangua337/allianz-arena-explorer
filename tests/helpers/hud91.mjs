import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../../dist/kit.js');
const {buildPlayableMatch}=await import('../../dist/playable-match.js');
export function hudFixture(build=buildPlayableMatch){
 let writes=0;const stats=new Map(),record=k=>{writes++;stats.set(k,(stats.get(k)||0)+1);};const nodes=new Map(),classes=new Set(),tracked=new Set(['textContent','hidden','disabled','value','title','innerHTML']);
 const dataset=(id='body')=>new Proxy({},{set(o,k,v){record(id+'.data.'+String(k));o[k]=String(v);return true;}});
 const node=id=>{if(nodes.has(id))return nodes.get(id);const handlers={},attrs={};const result=new Proxy({hidden:false,textContent:'',dataset:dataset(id),style:{},classList:{toggle(){}},setAttribute(k,v){record(id+'.attr.'+k);attrs[k]=String(v);},getAttribute:k=>attrs[k]??null,addEventListener(k,v){handlers[k]=v;},focus(){},showModal(){this.open=true;},close(){this.open=false;},fire(type,e){handlers[type]?.(e);}},{set(o,k,v){if(tracked.has(k))record(id+'.'+String(k));o[k]=k==='textContent'?String(v??''):v;return true;}});nodes.set(id,result);return result;};
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),actions=['pass','through','switch','tackle'].map(type=>{const n=node('action-'+type);n.dataset.gameAction=type;return n;});
 globalThis.document={createElement:()=>({getContext:()=>context}),getElementById:node,querySelectorAll:s=>s==='[data-game-action]'?actions:[],exitPointerLock(){},body:{dataset:dataset(),classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}}};node('game-radar').getContext=()=>context;
 const audio={muted:false,state:'playing',cheer(){},kick(){},whistle(){},setMuted(v){this.muted=v;}},players={ready:true,root:new THREE.Group(),updateMatch(){}};let game;
 game=build({scene:new THREE.Scene(),stadium:{matchBall:new THREE.Mesh()},players,audio,mobile:true,onPause:v=>game.setPaused(v),onView(){},onCamera(){},onRestart(){},onExit:()=>game.exit()});
 return{game,node,get writes(){return writes;},get writeStats(){return Object.fromEntries([...stats].sort((a,b)=>b[1]-a[1]));},resetWrites(){writes=0;stats.clear();},run(seconds,input={}){for(let i=0;i<Math.round(seconds*30);i++)game.update(1/30,input,{x:0,y:8,z:9});}};
}
