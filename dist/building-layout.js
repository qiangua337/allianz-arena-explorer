// Shared by the visible building, walking floors and route graph. Metres.
// These connections are an explorable interpretation, not a surveyed plan.
export const roomSpecs={homeRoom:{x:-82,z:0,y:-2.7,w:19,d:20},guestRoom:{x:-82,z:28,y:-2.7,w:19,d:18},press:{x:-82,z:-31,y:-2.7,w:21,d:18},lounge:{x:90,z:0,y:23.6,w:10,d:28},museum:{x:-96,z:58,y:12,w:15,d:25},store:{x:0,z:118,y:12.2,w:29,d:14}};
export const core={left:100,right:103,width:2.45,start:-8,front:-13,minX:98.45,maxX:104.55};
export const coreLevels=[-2.9,12.2,23.6,40];
export const seatingTiers=[{a:43,b:61,y:.7,rows:30,depth:.76,angle:24},{a:66,b:84,y:13.2,rows:24,depth:.76,angle:30},{a:85,b:103,y:27.1,rows:26,depth:.73,angle:34}];
export const coreFlights=[];
for(let i=0;i<coreLevels.length-1;i++){
 const bottom=coreLevels[i],top=coreLevels[i+1],steps=Math.ceil((top-bottom)/.36),run=steps*.34,middle=(top+bottom)/2;
 coreFlights.push({id:`core${i}a`,x:core.left,z:core.start,dir:1,base:bottom,top:middle,steps,run,width:core.width,level:i});
 coreFlights.push({id:`core${i}b`,x:core.right,z:core.start+run,dir:-1,base:middle,top,steps,run,width:core.width,level:i});
}
export const platforms=coreLevels.map((y,i)=>({id:'landing'+i,x:101.5,z:-10.5,y,w:6.1,d:5}));
for(let i=0;i<3;i++){const f=coreFlights[i*2];platforms.push({id:'turn'+i,x:101.5,z:f.z+f.run+1.05,y:f.top,w:6.1,d:2.1});}
export const bridges=[
 {id:'loungeBridge',a:[101.5,23.6,-10.5],b:[95,23.6,-10.5],width:2.6},
 {id:'middleGallery',a:[101.5,23.6,-11.5],b:[101.5,23.6,-30.1],width:2.5},
 {id:'middleBridge',a:[101.5,23.6,-30.1],b:[82.55,23.6,-30.1],width:2.5},
 {id:'upperGallery',a:[101.5,40,-11.5],b:[104,40,-36.5],width:2.5},
 {id:'upperBridge',a:[104,40,-36.5],b:[102.75,40,-36.5],width:2.5},
 {id:'lowerPassage',a:[0,12.2,-104],b:[0,10.512,-83.2],width:3}
];
export function onBridge(x,z,b,margin=0){const dx=b.b[0]-b.a[0],dz=b.b[2]-b.a[2],d=dx*dx+dz*dz,t=((x-b.a[0])*dx+(z-b.a[2])*dz)/(d||1);return t>=-.03&&t<=1.03&&Math.abs((x-b.a[0])*dz-(z-b.a[2])*dx)/Math.sqrt(d||1)<b.width/2+margin?t:null;}
export function inCoreShaft(x,z,margin=0){return x>core.minX-margin&&x<core.maxX+margin&&z>core.start-.01&&z<10+margin;}
export function buildingFloors(x,z){const out=[];
 for(const p of platforms)if(Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2+.01)out.push(p.y);
 for(const f of coreFlights){const a=(z-f.z)*f.dir;if(Math.abs(x-f.x)<f.width/2&&a>=-.01&&a<=f.run+.01)out.push(f.base+(f.top-f.base)*Math.min(f.steps,Math.max(1,Math.floor(a/.34)+1))/f.steps);}
 for(const b of bridges){const t=onBridge(x,z,b);if(t!==null)out.push(b.a[1]+(b.b[1]-b.a[1])*Math.max(0,Math.min(1,t)));}return out;
}
export function roomFootprint(x,z,margin=0){return ['museum','store'].some(id=>{const s=roomSpecs[id];return Math.abs(x-s.x)<s.w/2+margin&&Math.abs(z-s.z)<s.d/2+margin;});}
export const publicWallOpening=(x,z)=>roomFootprint(x,z,.45)||(z<-98&&Math.abs(x)<2.5);
export const clearCore=(x,z)=>x>94&&Math.abs(z)<24;
export const tierEntryOpening=(x,z,tier,row)=>tier===0&&row>=27&&Math.abs(x)<1.8&&z<-78||tier===1&&row>=21&&x>79&&Math.abs(z+30.1)<1.8||tier===2&&row>=24&&x>99&&Math.abs(z+36.5)<1.8;
