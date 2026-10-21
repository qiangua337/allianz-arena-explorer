import {THREE,v,mat,mesh,box,beam,cylinder,canvasTexture,Batches} from './kit.js';
import {furniture} from './furniture-layout.js';

const geometryCache=new Map();
export function finishedBox(parent,w,h,d,x,y,z,material,radius=.025){
 const r=Math.min(radius,w*.2,h*.2,d*.2),key=[w,h,d,r].join('|');let geometry=geometryCache.get(key);
 if(!geometry){const shape=new THREE.Shape(),a=w/2-r,b=h/2-r;shape.moveTo(-a,-b);shape.lineTo(a,-b);shape.lineTo(a,b);shape.lineTo(-a,b);shape.closePath();geometry=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,steps:1,curveSegments:2});geometry.translate(0,0,-d/2+r);const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));if(ny>=nx&&ny>=nz)uv.setXY(i,p.getX(i)/w+.5,p.getZ(i)/d+.5);else if(nz>=nx)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5);else uv.setXY(i,p.getZ(i)/d+.5,p.getY(i)/h+.5);}geometryCache.set(key,geometry);}
 return mesh(geometry,material,parent,x,y,z);
}

let shadowMaterial;
export function contactShadow(parent,w,d,x,y,z,opacity=.34){
 if(!shadowMaterial){const texture=canvasTexture(128,128,c=>{const g=c.createRadialGradient(64,64,12,64,64,64);g.addColorStop(0,'rgba(10,8,8,.64)');g.addColorStop(.55,'rgba(10,8,8,.3)');g.addColorStop(1,'rgba(10,8,8,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});shadowMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});}
 const plane=mesh(new THREE.PlaneGeometry(w,d),shadowMaterial,parent,x,y,z);plane.rotation.x=-Math.PI/2;plane.renderOrder=1;return plane;
}

let finishes;
function palette(){if(finishes)return finishes;const grain=canvasTexture(256,256,c=>{c.fillStyle='#aeb0ac';c.fillRect(0,0,256,256);let seed=8732;for(let i=0;i<10000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;const y=seed%256;c.fillStyle=i%2?'#ffffff11':'#171b1c0a';c.fillRect(x,y,1,1);}});grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(5,5);
 finishes={steel:mat(0xaab2b5,{metalness:.72,roughness:.31}),dark:mat(0x292c2d,{roughness:.58}),plaster:mat(0xd8d7d0,{roughness:.92,bumpMap:grain,bumpScale:.008}),seam:mat(0x545553,{roughness:.95}),light:new THREE.MeshBasicMaterial({color:0xfff0d5,toneMapped:false}),linen:mat(0xe8e5dc,{roughness:.96,bumpMap:grain,bumpScale:.006}),rubber:mat(0x232425,{roughness:.94})};return finishes;
}

export function finishRoom(g,spec,key){
 const m=palette(),b=new Batches(g),height=4.5,w=spec.w,d=spec.d;
 // Narrow construction joints, skirtings, ceiling coves and framed door reveals.
 b.add(w-.3,.13,.045,0,.065,-d/2+.13,m.dark);b.add(w-.3,.13,.045,0,.065,d/2-.13,m.dark);b.add(.045,.13,d-.3,-w/2+.13,.065,0,m.dark);
 for(const side of[-1,1]){b.add(.035,.13,(d-2.5)/2,w/2-.12,.065,side*(d/4+.625),m.dark);b.add(.11,2.83,.1,w/2-.1,1.415,side*1.23,m.steel);}
 b.add(.11,.1,2.56,w/2-.1,2.83,0,m.steel);
 for(const side of[-1,1]){b.add(w-.35,.12,.12,0,4.36,side*(d/2-.15),m.dark);b.add(w-.4,.035,.075,0,4.39,side*(d/2-.24),m.light);b.add(.12,.12,d-.35,side*(w/2-.15),4.36,0,m.dark);}
 for(const z of[-d*.25,d*.25])for(const x of[-w*.22,w*.22]){
  finishedBox(g,.94,.055,.46,x,4.39,z,m.plaster,.018);for(let j=0;j<8;j++)b.add(.84,.023,.018,x,4.352,z-.17+j*.048,m.seam);
  for(const side of[-1,1])b.add(.018,.015,.018,x+side*.43,4.347,z+.19,m.steel);
 }
 cylinder(g,.085,.045,w*.18,4.4,0,m.plaster,20);cylinder(g,.052,.02,w*.18,4.368,0,m.dark,16);
 // Static contact shading remains inexpensive in the default shadow-free mode.
 contactShadow(g,w-.1,1.4,0,.012,-d/2+.58);contactShadow(g,w-.1,1.4,0,.012,d/2-.58);const sideShadow=contactShadow(g,d-.1,1.5,-w/2+.6,.014,0);sideShadow.rotation.z=Math.PI/2;
 if(key==='homeRoom'||key==='guestRoom'){contactShadow(g,8.5,4.0,0,.017,0);for(const z of[-d/2+1,d/2-1])contactShadow(g,w-1,2.2,0,.018,z);}
 b.flush();
}

export function finishLocker(g,{guest=false,wood,red,metal}){
 const m=palette(),b=new Batches(g);finishedBox(g,1.16,.085,1.02,0,.49,.1,wood,.022);
 for(const x of[-.46,.46]){b.add(.045,.4,.7,x,.23,.04,red);b.add(.045,.04,.82,x,.05,.06,m.dark);}b.add(1.04,.04,.035,0,.12,.42,metal);
 for(const x of[-.56,.56]){finishedBox(g,.055,2.76,.82,x,1.72,0,red,.012);b.add(.015,2.5,.015,x+(x<0?.038:-.038),1.62,.31,m.dark);}
 finishedBox(g,1.15,.075,.82,0,3.1,0,red,.016);finishedBox(g,1.15,.052,.81,0,2.64,0,red,.01);
 b.add(.96,.035,.035,0,2.35,.06,metal);b.add(1.0,.026,.035,0,2.57,.30,m.light);
 for(const x of[-.43,.43]){b.add(.018,.045,.018,x,2.55,.29,m.steel);b.add(.018,.045,.018,x,.22,.38,m.steel);}
 for(let j=0;j<3;j++)finishedBox(g,.55,.027,.29,.025,2.81+j*.03,-.09,j===2?m.linen:red,.011);
 // A rolled cotton towel gives the shelf a readable silhouette at eye level.
 const towel=cylinder(g,.065,.29,-.31,2.87,-.08,m.linen,16);towel.rotation.z=Math.PI/2;
 for(const side of[-1,1]){const ring=mesh(new THREE.TorusGeometry(.046,.008,4,16),m.linen,g,-.31+side*.149,2.87,-.08);ring.rotation.y=Math.PI/2;}
 b.flush();
}

export function finishPlayerTunnel(g){
 const m=palette(),b=new Batches(g);
 for(const side of[-1,1]){
  b.add(25.7,.12,.075,1.55,.11,side*2.33,m.dark);b.add(24.8,.12,.08,1.6,3.68,side*2.32,m.dark);
  beam(g,v(-10.4,1.0,side*2.18),v(8.7,1.0,side*2.18),.035,m.steel,12);
  for(let j=0;j<8;j++){const x=-9.5+j*2.35;b.add(.055,.18,.14,x,.9,side*2.27,m.steel);b.add(1.1,.025,.045,x,.14,side*2.28,m.light);}
 }
 for(let j=0;j<10;j++){const x=-10.3+j*1.9;b.add(.035,.04,4.35,x,3.76,0,m.seam);}
 for(const x of[-9,-3,3]){
  finishedBox(g,.8,.035,2.5,x,.015,0,m.rubber,.018);contactShadow(g,2.0,4,x,.025,0);
 }
 b.flush();
}

export function finishReception(root,batch,atlas,{floorY=-2.9,pale,red,metal,dark}){
 const m=palette();
 for(const x of[-8,8]){
  finishedBox(root,4.6,.92,1.12,x,floorY+.53,107.5,red,.055);finishedBox(root,4.85,.1,1.35,x,floorY+1.04,107.5,pale,.035);
  batch.add(4.32,.12,.98,x,floorY+.06,107.5,m.dark);batch.add(4.2,.015,.035,x,floorY+.19,108.071,m.steel);
  finishedBox(root,.89,.56,.07,x,floorY+1.43,107.2,dark,.025);batch.add(.09,.28,.09,x,floorY+1.14,107.2,metal);finishedBox(root,.36,.028,.26,x,floorY+1.11,107.2,metal,.012);
  contactShadow(root,6.3,2.7,x,floorY+.014,107.6);
 }
 // This is the real counterpart of the existing F-key information interaction.
 const kiosk=new THREE.Group();kiosk.position.set(4,floorY,110);root.add(kiosk);finishedBox(kiosk,.72,.10,.62,0,.05,0,m.dark,.04);finishedBox(kiosk,.42,1.06,.24,0,.57,0,m.steel,.025);finishedBox(kiosk,.74,.96,.11,0,1.34,0,m.dark,.035);
 atlas.add(root,'场馆导览','按 F 选择步行目的地',.65,.27,4,floorY+1.56,110.062,0,{bg:'#eef0e9',fg:'#263130',accent:'#a51935'});
 atlas.add(root,'TRIBÜNEN ↑','MUSEUM / FAN-SHOP →',.65,.43,4,floorY+1.17,110.063,0,{bg:'#e9ebe4',fg:'#2b3632',accent:'#ac1934'});
 contactShadow(root,1.7,1.7,4,floorY+.012,110);
}

export function finishedSeat(parent,x,y,z,yaw,material,metal,width=.8){
 const m=palette(),g=new THREE.Group(),b=new Batches(g);g.position.set(x,y,z);g.rotation.y=yaw;parent.add(g);
 finishedBox(g,width,.16,.73,0,.49,0,material,.045);const back=finishedBox(g,width,.72,.15,0,.95,.32,material,.05);back.rotation.x=-.08;
 for(const xx of[-width*.36,width*.36])for(const zz of[-.24,.24])cylinder(g,.018,.43,xx,.22,zz,metal,8);
 b.add(width-.12,.045,.49,0,.37,0,m.dark);for(const side of[-1,1]){finishedBox(g,.065,.055,.52,side*(width/2+.025),.76,.04,m.dark,.02);b.add(.025,.2,.025,side*(width/2+.025),.64,.22,metal);}b.flush();return g;
}

export function finishFixtureShadows(g,spec,key){
 for(const f of furniture.filter(f=>f.owner===key))contactShadow(g,f.w+.95,f.d+.9,f.x-spec.x,key==='press'?f.y0-spec.y+.09:.015,f.z-spec.z);
}

export function finishHospitality(g,spec,{wood,metal}){
 const m=palette(),b=new Batches(g),fabric=mat(0x5b5752,{roughness:.94,bumpMap:m.plaster.bumpMap,bumpScale:.006}),glass=mat(0xe9e4d4,{transparent:true,opacity:.25,roughness:.08,depthWrite:false});
 for(const side of[-1,1])b.add(.08,.13,spec.d-.25,side*(spec.w/2-.12),.065,0,m.dark);b.add(.075,.07,spec.d-.15,-4.94,3.68,0,metal);b.add(.075,.07,spec.d-.15,-4.94,.045,0,metal);
 for(let j=0;j<5;j++){const z=-10+j*5;contactShadow(g,3.8,2.9,0,.014,z);mesh(new THREE.TorusGeometry(.82,.025,8,36),wood,g,0,.875,z).rotation.x=Math.PI/2;
  for(const side of[-1,1]){finishedSeat(g,side*1.5,0,z,side*Math.PI/2,fabric,metal);contactShadow(g,1.4,1.4,side*1.5,.018,z);cylinder(g,.17,.015,side*.39,.897,z+.23,m.linen,24);finishedBox(g,.22,.012,.31,side*.4,.906,z-.24,m.linen,.008);const bowl=mesh(new THREE.SphereGeometry(1,16,12),glass,g,side*.32,1.105,z);bowl.scale.set(.056,.071,.056);}
 }
 finishedBox(g,1.5,.9,16,3.4,.45,0,m.dark,.035);finishedBox(g,1.65,.075,16,3.4,.945,0,wood,.03);b.add(.04,.05,15.8,2.58,.23,0,metal);contactShadow(g,2.7,17,3.4,.017,0);
 for(const z of[-9,0,9])finishedBox(g,1.32,.065,2.12,0,3.665,z,m.dark,.02);
 for(const z of[-11,11]){b.add(.65,.035,.44,3.8,3.7,z,m.dark);for(let j=0;j<7;j++)b.add(.58,.017,.015,3.8,3.675,z-.15+j*.05,metal);}
 b.flush();
}

export function finishDisplayHardware(rooms,{metal}){
 const m=palette(),shop=rooms.store,gallery=rooms.museum,sb=new Batches(shop),gb=new Batches(gallery);
 for(let row=0;row<3;row++)for(let side=0;side<2;side++){
  const x=-7+side*13,z=-3+row*3.1;for(const xx of[-2,2]){finishedBox(shop,.09,.055,.72,x+xx,.065,z,m.dark,.018);for(const zz of[-.25,.25]){const wheel=cylinder(shop,.046,.055,x+xx,.044,z+zz,m.dark,10);wheel.rotation.z=Math.PI/2;}sb.add(.12,.12,.07,x+xx,2.18,z,metal);}
  beam(shop,v(x-2.15,2.2,z),v(x+2.15,2.2,z),.025,metal,10);
 }
 for(let i=0;i<8;i++){const x=i%2?3.7:-3.7,z=-8+Math.floor(i/2)*5.3;for(const side of[-1,1]){gb.add(1.73,.018,.018,x,2.96,z+side*.855,metal);gb.add(.018,.018,1.73,x+side*.855,2.96,z,metal);for(const edge of[-1,1])gb.add(.012,2.07,.012,x+side*.855,1.93,z+edge*.855,metal);}}
 sb.flush();gb.flush();
}
