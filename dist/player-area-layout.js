// One envelope for rendered floors, walls and walking support. Metres.
export const playerCorridor={minX:-72.8,maxX:-66.7,minZ:-41,maxZ:49,y:-2.7,height:3.7};
export const playerShower={minX:-91.5,maxX:-72.5,minZ:37,maxZ:47,y:-2.7,height:4.4};
export function containsFloor(area,x,z,margin=0){return x>area.minX-margin&&x<area.maxX+margin&&z>area.minZ-margin&&z<area.maxZ+margin;}
const c=playerCorridor,wall=(x,z,w,d)=>({x,z,w,d,y0:c.y,y1:c.y+c.height});
export const playerLinks=[
 {id:'northStem',minX:-71.95,maxX:-67.55,minZ:-50.2,maxZ:-39.5,y:-2.7,height:3.7},
 {id:'northHall',minX:-94.1,maxX:-67.55,minZ:-50.2,maxZ:-45.8,y:-2.7,height:3.7},
 {id:'southStem',minX:-71.95,maxX:-67.55,minZ:47.5,maxZ:55.2,y:-2.7,height:3.7},
 {id:'southHall',minX:-94.1,maxX:-67.55,minZ:50.8,maxZ:55.2,y:-2.7,height:3.7}
];
function exposedEdges(rect,others,order){
 const edges=[['x',rect.minX,rect.minZ,rect.maxZ],['x',rect.maxX,rect.minZ,rect.maxZ],['z',rect.minZ,rect.minX,rect.maxX],['z',rect.maxZ,rect.minX,rect.maxX]],out=[];
 for(const [axis,fixed,start,end]of edges){let spans=[[start,end]];
  for(const r of others){const min=axis==='x'?r.minX:r.minZ,max=axis==='x'?r.maxX:r.maxZ,inside=fixed>min+.001&&fixed<max-.001||(Math.abs(fixed-min)<.001||Math.abs(fixed-max)<.001)&&order.indexOf(r)<order.indexOf(rect);if(!inside)continue;const lo=axis==='x'?r.minZ:r.minX,hi=axis==='x'?r.maxZ:r.maxX;spans=spans.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([p,q])=>q-p>.01));}
  for(const[a,b]of spans)out.push({axis,fixed,a,b});
 }return out;
}
export function rectilinearBoundary(rectangles){return rectangles.flatMap(r=>exposedEdges(r,rectangles.filter(q=>q!==r),rectangles).map(e=>({...e,owner:r})));}
const union=[c,...playerLinks];
export const connectionWalls=rectilinearBoundary(union).filter(e=>{
 if(e.owner===c&&e.axis==='x')return false; // Existing room facades and the tunnel portal.
 if(e.axis==='x'&&e.fixed<-94)return false; // Open into the public arcade.
 return true;
}).map(e=>e.axis==='x'?wall(e.fixed,(e.a+e.b)/2,.18,e.b-e.a):wall((e.a+e.b)/2,e.fixed,e.b-e.a,.18));
export const corridorWalls=[
 ...connectionWalls,
 wall(c.maxX,(c.minZ-2.5)/2,.18,-2.5-c.minZ),
 wall(c.maxX,(c.maxZ+2.5)/2,.18,c.maxZ-2.5),
 // Room facades fill the remaining west side; these close the gaps between them.
 wall(-72.5,-40.5,.18,1),wall(-72.5,-16,.18,12),
 wall(-72.5,14.5,.18,9),wall(-72.5,43,.18,12)
];
export function tunnelHasBowlView(position){return position.x>-93&&position.x<-29&&Math.abs(position.z)<3.5&&position.y>-3&&position.y<8;}
export function enclosedPlayerPosition(p){return p.x>-94&&p.x<-66&&p.z>-53&&p.z<57&&p.y>-3&&p.y<3&&!tunnelHasBowlView(p);}
export function arcadeInnerPoint(t){const cosine=Math.cos(t),sine=Math.sin(t),p={x:86*Math.sign(cosine)*Math.abs(cosine)**(2/2.8),z:104*Math.sign(sine)*Math.abs(sine)**(2/2.8)};if(p.x<0){const blend=Math.max(0,Math.min(1,(70-Math.abs(p.z))/18));p.x=Math.min(p.x,p.x+(-94-p.x)*blend);}return p;}
export function playerPublicOpening(x,z){return x<-90&&(Math.abs(z+48)<2.25||Math.abs(z-53)<2.25);}
