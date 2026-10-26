// Each frame uses its own transparent bounds in the generated source atlas.
// Width is derived from pixel scale, so narrow seated figures are not stretched.
export const supporterAtlas={width:1254,height:1254,frames:[
 [0,8,370,602],[390,8,198,602],[625,8,315,602],[942,8,312,602],
 [32,618,264,608],[307,618,321,608],[624,618,327,608],[984,618,247,608]
]};
export const crowdDetailBudget=mobile=>mobile?128:384;
export const crowdDetailRadius=mobile=>mobile?27:34;
function random(i,salt){let x=Math.imul((i+1)^salt,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return((x^(x>>>16))>>>0)/4294967296;}
export function createCrowdLayout(seats){
 const records=[],cells=new Map();
 for(let i=0;i<seats.length;i++){
  if(random(i,381)<.065)continue;const seat=seats[i],frame=Math.floor(random(i,173)*8),visitor=seat.x<-48&&seat.z<-72&&seat.y>25;
  const record={id:records.length,seat,frame,phase:random(i,912)*Math.PI*2,scale:.94+random(i,632)*.12,skin:Math.floor(random(i,497)*6),shirt:Math.floor(random(i,816)*8),visitor,gesture:[0,3].includes(frame)?1:[2,5,6].includes(frame)?.65:0,detail:false};
  records.push(record);const key=Math.floor(seat.x/8)+','+Math.floor(seat.z/8);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(record);
 }
 function nearby(viewer,{mobile=false,budget=crowdDetailBudget(mobile),radius=crowdDetailRadius(mobile)}={}){
  if(!viewer||![viewer.x,viewer.y,viewer.z].every(Number.isFinite))return[];const found=[],limit=radius*radius;
  for(let x=Math.floor((viewer.x-radius)/8);x<=Math.floor((viewer.x+radius)/8);x++)for(let z=Math.floor((viewer.z-radius)/8);z<=Math.floor((viewer.z+radius)/8);z++)for(const r of cells.get(x+','+z)||[]){const s=r.seat,d=(s.x-viewer.x)**2+(s.y+.5-viewer.y)**2+(s.z-viewer.z)**2;if(d<limit)found.push({r,d});}
  found.sort((a,b)=>a.d-b.d||a.r.id-b.r.id);return found.slice(0,Math.max(0,budget)).map(p=>p.r);
 }
 return{records,nearby,count:records.length,visitorCount:records.filter(r=>r.visitor).length};
}
