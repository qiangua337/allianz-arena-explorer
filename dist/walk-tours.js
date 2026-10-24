export const walkingTours=[
 {id:'firstVisit',title:'第一次来到主场',description:'从接待大厅到看台，走进草坪和红色球员通道。',stops:['arcade','concourse','lowerStands','pitch','tunnel','homeRoom']},
 {id:'club',title:'拜仁的故事',description:'逛球迷商店与荣誉展厅，再到包厢和高处看台。',stops:['concourse','store','museum','lounge','upperStands']},
 {id:'players',title:'球员的一天',description:'从更衣室走向入场通道与草坪，最后来到发布厅。',stops:['homeRoom','tunnel','pitch','guestRoom','press']}
];
export function createWalkingTour(){let plan=null,index=0,arrived=false;
 return{start(id){plan=walkingTours.find(p=>p.id===id)||null;index=0;arrived=false;return this.state();},cancel(){plan=null;arrived=false;},update(goal,isArrived){arrived=!!plan&&plan.stops[index]===goal&&isArrived;return this.state();},next(){if(!plan||!arrived)return null;if(index===plan.stops.length-1){this.cancel();return null;}index++;arrived=false;return plan.stops[index];},state(){return plan?{id:plan.id,title:plan.title,goal:plan.stops[index],index,total:plan.stops.length,arrived,last:index===plan.stops.length-1}:null;}};
}
export function routeSummary(position,path){let previous=position,metres=0;for(const p of path){metres+=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);previous=p;}return{metres:Math.ceil(metres),seconds:Math.ceil(metres/4.5)};}
