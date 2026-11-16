export const walkingTours=[
 {id:'southToUpper',title:'南门到上层看台',description:'从南门进接待大厅，经西侧 T3 楼梯前往荣誉展厅，再走室内楼梯和连廊到上层看台。',stops:['arcade','museum','upperStands']},
 {id:'firstVisit',title:'第一次来到主场',description:'从接待大厅到看台，走进草坪和红色球员通道。',stops:['arcade','concourse','lowerStands','pitch','tunnel','homeRoom']},
 {id:'club',title:'拜仁的故事',description:'逛球迷商店与荣誉展厅，再到包厢和高处看台。',stops:['concourse','store','museum','lounge','upperStands']},
 {id:'players',title:'球员的一天',description:'从更衣室走向入场通道与草坪，最后来到发布厅。',stops:['homeRoom','tunnel','pitch','guestRoom','press']}
];
export function walkingTourFromSearch(search){
 const params=new URLSearchParams(search);
 if(params.has('room')||params.has('experience'))return null;
 const id=params.get('tour');
 return walkingTours.find(plan=>plan.id===id)??null;
}
export function walkingTourShareURL(pageURL,id,night){
 if(!walkingTours.some(plan=>plan.id===id))return null;
 const url=new URL(pageURL);
 url.search='';url.hash='';
 url.searchParams.set('tour',id);
 if(night)url.searchParams.set('night','1');
 return url.href;
}
export function createWalkingTour(){
 let plan=null,index=0,arrived=false,reached=false,paused=false;
 return{
  start(id){plan=walkingTours.find(p=>p.id===id)||null;index=0;arrived=reached=paused=false;return this.state();},
  cancel(){plan=null;arrived=reached=paused=false;},
  pause(){if(plan){paused=true;arrived=false;}},
  resume(){paused=false;return this.state();},
  update(goal,isArrived){
   arrived=!!plan&&!paused&&plan.stops[index]===goal&&isArrived;
   if(arrived)reached=true;
   return this.state();
  },
  next(){
   if(!plan||!arrived)return null;
   if(index===plan.stops.length-1){this.cancel();return null;}
   index++;arrived=reached=false;return plan.stops[index];
  },
  snapshot(){return plan?{id:plan.id,index,reached,paused}:null;},
  restore(saved){
   const candidate=walkingTours.find(p=>p.id===saved?.id);
   if(!candidate||!Number.isInteger(saved.index)||saved.index<0||saved.index>=candidate.stops.length){this.cancel();return;}
   plan=candidate;index=saved.index;arrived=false;reached=saved.reached===true;paused=saved.paused===true;
  },
  state(){return plan?{id:plan.id,title:plan.title,stops:plan.stops,goal:plan.stops[index],nextGoal:plan.stops[index+1]??null,index,total:plan.stops.length,arrived,paused,visitedCount:index+Number(reached),last:index===plan.stops.length-1}:null;}
 };
}
export function routeSummary(position,path){let previous=position,metres=0;for(const p of path){metres+=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);previous=p;}return{metres:Math.ceil(metres),seconds:Math.ceil(metres/4.5)};}
