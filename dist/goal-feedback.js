import {THREE} from './kit.js';

export function createGoalNetMaterial(){
 const material=new THREE.LineBasicMaterial({color:0xdde5df,transparent:true,opacity:.72}),time={value:10},hit={value:new THREE.Vector2()},power={value:0};
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{netTime:time,netHit:hit,netPower:power});shader.vertexShader='uniform float netTime;uniform vec2 netHit;uniform float netPower;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float netDistance=length(position.xy-netHit);
float netWave=sin(netDistance*7.-netTime*15.)*exp(-netDistance*.55)*exp(-netTime*3.8);
transformed.z+=netWave*netPower*smoothstep(0.,.65,position.z);`);};
 material.customProgramCacheKey=()=> 'goal-net-impact-v4';
 return{material,pulse(x,y){hit.value.set(x,y);time.value=0;power.value=.34;},update(dt){time.value=Math.min(10,time.value+Math.max(0,Math.min(.25,dt)));},reset(){time.value=10;power.value=0;}};
}

export function goalFeedbackController(nets){
 let score='0:0',lastTime=null;
 return{reset(){score='0:0';lastTime=null;for(const net of nets)net.reset();},update(state,time){
  const dt=lastTime===null?0:Math.max(0,time-lastTime);lastTime=time;for(const net of nets)net.update(dt);
  const key=state.score.home+':'+state.score.away;if(key!==score){score=key;if(state.phase==='goal'){const side=state.ball.z<0?0:1;nets[side]?.pulse(state.ball.z<0?-state.ball.x:state.ball.x,state.ball.y);}}
 }};
}
