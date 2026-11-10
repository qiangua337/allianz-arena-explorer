export const trainingDrills=[
 {id:'free',title:'自由热身',description:'没有逼抢与倒计时，沿标记练习带球、转向和加速。',instruction:'控球穿过金色标记，再前往下一个。',attemptLimit:0,targetCount:4},
 {id:'passing',title:'三角传接',description:'三名队员真实传接，完成五次队友接球。',instruction:'选择接应方向，短传后跟随足球并接管队友。',attemptLimit:0,targetCount:5},
 {id:'shooting',title:'射门练习',description:'八次起脚面对真实门将，练习力度与落点。',instruction:'方向选择落点，按住射门蓄力，松手出脚。',attemptLimit:8,targetCount:8}
];
export const validTrainingDrill=id=>trainingDrills.some(drill=>drill.id===id)?id:'free';
export function trainingLayout(id,attempt=1){
 const drill=validTrainingDrill(id);
 if(drill==='passing')return[{id:'home-1',x:0,z:18,yaw:Math.PI},{id:'home-8',x:-9,z:5,yaw:.60},{id:'home-9',x:9,z:5,yaw:-.60}];
 if(drill==='shooting'){
  const spots=[[0,-32.6],[-10,-34],[10,-34],[0,-28]],spot=spots[(Math.max(1,attempt)-1)%spots.length];
  return[{id:'home-1',x:spot[0],z:spot[1],yaw:Math.atan2(-spot[0],-52.5-spot[1])},{id:'away-0',x:0,z:-50.7,yaw:0}];
 }
 return[{id:'home-1',x:0,z:28,yaw:Math.PI}];
}
export const trainingGates=[{x:0,z:20},{x:9,z:10},{x:-8,z:0},{x:0,z:-12}];
