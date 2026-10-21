import {THREE,TAU,v,mat,mesh,box,beam,sign,cylinder,superpoint,ringGeometry,curveLine,Batches,seeded,floorTexture,repeatTex,wallCollider} from './kit.js';

export function esplanadeY(z){return -3-THREE.MathUtils.clamp((z-140)/543,0,1)*8.5;}
export function buildWorld(scene){
 const group=new THREE.Group();group.name='Fröttmaning context | approximate surroundings';scene.add(group);const b=new Batches(group),colliders=[];
 const concrete=mat(0xa9aea9,{map:repeatTex(floorTexture(),25,25)}),edge=mat(0x8b9294),grass=mat(0x748660),road=mat(0x424b4c),pale=mat(0xd4d4c9),dark=mat(0x17252b),metal=mat(0x87959b,{metalness:.5,roughness:.55}),leaf=mat(0x34593f),stripe=mat(0xc7ccbf),red=mat(0xc61935),blue=mat(0x173f75);
 const lightMat=new THREE.MeshBasicMaterial({color:0xfff0d0,toneMapped:false});
 const terrain=mesh(new THREE.PlaneGeometry(3200,3200),grass,group,0,-12.2,0);terrain.rotation.x=-Math.PI/2;
 mesh(ringGeometry(0,0,151,169,-3,2.8,256),concrete,group);
 // The esplanade is an elevated landscape above the car parks, not a flat parking lot.
 const deckGeom=new THREE.PlaneGeometry(136,543,20,60);deckGeom.rotateX(-Math.PI/2);const p=deckGeom.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i)+405.5;p.setY(i,esplanadeY(z));p.setZ(i,z);}deckGeom.computeVertexNormals();const deck=mesh(deckGeom,grass,group);
 function ribbon(xs,width,material=concrete){const curve=new THREE.CatmullRomCurve3(xs.map(([x,z])=>v(x,esplanadeY(z)+.055,z)));const pts=curve.getPoints(90),pos=[],uv=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],q=pts[i+1],t=q.clone().sub(a).normalize(),n=v(t.z,0,-t.x).multiplyScalar(width/2),aa=a.clone().add(n),ab=a.clone().sub(n),qa=q.clone().add(n),qb=q.clone().sub(n);for(const x of[aa,ab,qa,qa,ab,qb]){pos.push(x.x,x.y,x.z);uv.push(x.x/12,x.z/12);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();mesh(g,material,group);}
 ribbon([[-53,132],[-30,200],[35,290],[15,380],[-39,475],[-29,570],[0,680]],11);
 ribbon([[50,132],[29,205],[-31,295],[-13,385],[36,480],[25,575],[0,680]],11);
 ribbon([[-65,140],[-60,310],[-61,500],[-59,680]],7);
 ribbon([[65,140],[60,310],[61,500],[59,680]],7);
 for(const z of[225,365,510,625])ribbon([[-65,z],[-22,z+12],[24,z-9],[65,z+3]],7);
 ribbon([[0,214],[0,188],[0,166]],14);
 // South main entrance: canopy, open lanes and visible ticket-reader cabinets.
 // The central lane is deliberately unobstructed; this is the first-person starting route.
 const gateY=esplanadeY(178)+.055,entryMetal=mat(0xb9c1c3,{metalness:.65,roughness:.35}),entryDark=mat(0x22313d);
 b.add(104,.22,12,0,gateY+4.8,178,entryMetal);b.add(104,.8,.35,0,gateY+4.42,184.1,entryDark);
 sign(group,'HAUPTEINGANG SÜD',32,.85,0,gateY+4.42,184.31,{font:105,w:4096,h:128,fg:'#fff'});
 sign(group,'SOUTH ENTRANCE  ·  EINGANG',24,.42,0,gateY+3.65,184.34,{font:74,w:4096,h:128,fg:'#fff'});
 for(const x of[-50,-30,-10,10,30,50]){b.add(.38,4.6,.38,x,gateY+2.3,174,entryMetal);wallCollider(colliders,x,174,.38,.38,gateY,gateY+4.6);}
 const entryGreen=new THREE.MeshBasicMaterial({color:0x35e298,toneMapped:false});
 for(let i=0;i<10;i++)for(const side of[-1,1]){const x=side*(2.8+i*5);b.add(.45,1.13,1.7,x,gateY+.565,179,entryMetal);b.add(.32,.16,.34,x,gateY+1.22,179.55,entryDark);b.add(.25,.025,.12,x,gateY+1.315,179.55,entryGreen);wallCollider(colliders,x,179,.45,1.7,gateY,gateY+1.35);}
 for(const x of[-25,0,25])sign(group,'↓',1.2,1.2,x,gateY+2.6,182.8,{font:135,w:128,h:128,fg:'#8df4c1'});
 // Linear lightwells and open ramps cut down to the parking decks.
 for(let i=0;i<9;i++){
  const z=200+i*49,x=i%2?28:-28,y=esplanadeY(z)+.12;const angle=(i%2?1:-1)*.18;
  b.add(11,.12,29,x,y,z,dark,angle);b.add(.35,1,29,x-5.6,y+.45,z,edge,angle);b.add(.35,1,29,x+5.6,y+.45,z,edge,angle);b.add(11,.65,.35,x,y+.25,z-14.5,edge,angle);
  for(let j=0;j<8;j++){b.add(.5,.07,10,x-4.6+j*1.3,y+.12,z,pale,angle);}
  const s=sign(group,`P${Math.floor(i/3)+1}`,3.3,1.2,x,y+1.25,z+15.2,{fg:'#fff',bg:'#c31e39',font:150,w:512,h:200});
 }
 // Parking structures are visible at the western edge beneath the planted deck.
 for(let level=0;level<4;level++){const gg=new THREE.PlaneGeometry(138,530,1,24);gg.rotateX(-Math.PI/2);const pp=gg.attributes.position;for(let i=0;i<pp.count;i++){const z=pp.getZ(i)+405;pp.setZ(i,z);pp.setY(i,esplanadeY(z)-.25-level*2.4);}gg.computeVertexNormals();mesh(gg,edge,group);}
 for(let j=0;j<47;j++)for(const x of[-68,68])b.add(.6,8.5,.6,x,-7.1,146+j*11.4,edge);
 // Keep above-ground deck and landscaping visible over the concrete garage slab.
 for(let j=0;j<4;j++){const z=198+j*137;const s=sign(group,`P${j+1}  ·  PARKHAUS`,18,2.8,-70,-6.5,z,{bg:'#24313b',fg:'#f3f3ee',font:80,h:200});s.rotation.y=-Math.PI/2;}
 // Roads: eastern A9, northern A99, the local stadium loop and west service road.
 b.add(42,.15,1700,197,-11.9,70,road);b.add(1500,.15,36,150,-11.8,-261,road);b.add(9,.2,900,-165,-11.8,210,road);
 b.add(1,.32,1700,197,-11.55,70,edge);
 for(let i=0;i<140;i++)for(const x of[182,188,205,211])b.add(.12,.025,4,x,-11.79,-770+i*12,stripe);
 for(let i=0;i<124;i++)for(const z of[-273,-266,-254,-247])b.add(4,.025,.12,-600+i*12,-11.68,z,stripe);
 const loop=[];for(let i=0;i<=256;i++){const p=superpoint(157,180,i/256*TAU,2.8);p.y=-10.8;loop.push(p);}const curve=new THREE.CatmullRomCurve3(loop,true);const loopTube=mesh(new THREE.TubeGeometry(curve,256,4,4,true),road,group);loopTube.scale.y=.05;loopTube.position.y=-10.3;
 // Rail depot and Fröttmaning underground station west of the esplanade.
 for(let j=0;j<8;j++){const x=-224-j*6;b.add(.13,.2,1100,x,-11.7,220,metal);b.add(.13,.2,1100,x+1.5,-11.7,220,metal);for(let i=0;i<80;i++)b.add(3,.08,.22,x+.75,-11.8,-320+i*14,edge);}
 for(let z=390;z<=520;z+=65){b.add(20,4.5,55,-204,-9.6,z,pale);b.add(21,.4,56,-204,-7.25,z,metal);for(let j=0;j<10;j++)b.add(.1,2.3,2,-193.9,-9.2,z-24+j*5,dark);}
 const station=sign(group,'U6   FRÖTTMANING',23,2,-193.6,-7.7,457,{fg:'#fff',bg:'#143d70',font:75,h:160});station.rotation.y=Math.PI/2;
 for(let track=0;track<2;track++)for(let c=0;c<6;c++){const x=-226-track*12,z=455+c*19;b.add(3.1,2.4,18,x,-10.3,z,blue);b.add(3.15,.6,14,x,-10,z,dark);b.add(3.2,.3,18,x,-8.9,z,pale);}
 // Maintenance halls and service buildings seen in the official aerial photographs.
 for(let j=0;j<6;j++){const x=-326+j*17;b.add(15,9,100,x,-7.4,255,pale);b.add(17,.45,102,x,-2.7,255,metal);for(let k=0;k<12;k++)b.add(.1,2.8,4,x+7.55,-6.5,210+k*8,dark);}
 for(let j=0;j<7;j++){const x=-310+(j%3)*46,z=-75+Math.floor(j/3)*52;b.add(38,7+j%3*2,35,x,-8+j%3,z,pale);b.add(39,.3,36,x,-4.4+j%3*2,z,metal);for(let k=0;k<9;k++)b.add(2,2,.08,x-16+k*4,-6.4+j%3,z+17.55,dark);}
 // Pedestrian bridges, security gates, ticket booths and entry signs.
 for(const z of[150,660]){b.add(55,.5,7,-100,-2.2,z,edge);b.add(55,1,.07,-100,-1.45,z-3.5,metal);b.add(55,1,.07,-100,-1.45,z+3.5,metal);b.add(1,9,1,-125,-7,z,edge);}
 for(let i=0;i<12;i++){const x=(i<6?-1:1)*(6+(i%6)*8);b.add(.7,2.4,.7,x,-1.8,148,dark);b.add(6,3.1,3,x,-1.35,158,pale);b.add(4.8,1,.1,x,-.9,159.55,dark);wallCollider(colliders,x,158,6,3,-2.9,.2);}
 sign(group,'WILLKOMMEN · ALLIANZ ARENA',49,2.6,0,1.45,157.9,{bg:'#bf1732',fg:'#fff',font:95,h:160});
 sign(group,'EINGANG SÜD   →',18,2.6,-60,-.2,167,{bg:'#c81a36',fg:'#fff',font:90,h:180});
 for(const z of[-164,164])for(let i=0;i<9;i++)b.add(.22,1,.22,-25+i*6,-2.5,z,metal);
 // Curved balloon-headed lamps and street furniture.
 const lampPositions=[];for(let i=0;i<20;i++){const z=157+i*25;for(const side of[-1,1])lampPositions.push(v(side*(56+Math.sin(i*.9)*3),esplanadeY(z),z));}for(let i=0;i<20;i++){const p=superpoint(143,157,i/20*TAU,2.8);p.y=-3;if(p.z>140&&Math.abs(p.x)<5)continue;lampPositions.push(p);}
 const globeGeometry=new THREE.SphereGeometry(.72,8,8);const poleGeometry=new THREE.CylinderGeometry(.055,.08,7.6,6);const lamps=new THREE.InstancedMesh(globeGeometry,lightMat,lampPositions.length),poles=new THREE.InstancedMesh(poleGeometry,metal,lampPositions.length),d=new THREE.Object3D();lampPositions.forEach((p,i)=>{d.position.copy(p).add(v(0,8,0));d.scale.set(.58,1.2,.58);d.updateMatrix();lamps.setMatrixAt(i,d.matrix);d.position.copy(p).add(v(0,3.8,0));d.scale.set(1,1,1);d.updateMatrix();poles.setMatrixAt(i,d.matrix);});group.add(lamps,poles);
 for(let j=0;j<24;j++){const z=175+j*20,x=j%2?50:-50,y=esplanadeY(z);b.add(2,.12,.55,x,y+.5,z,mat(0x78664f));b.add(.1,.5,.45,x-.75,y+.25,z,metal);b.add(.1,.5,.45,x+.75,y+.25,z,metal);b.add(.65,.9,.65,x+3,y+.45,z,dark);}
 for(let j=0;j<12;j++){const x=-58+j*10.5;b.add(.07,13,.07,x,3.5,135,metal);const flag=box(group,2.5,4,.04,x+1.25,7.5,135,j%2?whiteFlag():red);}
 // Cars and coaches around the service perimeter and highways.
 const random=seeded(113);const carColors=[mat(0xcad0d0),mat(0x283948),mat(0xb62338),mat(0xe4dfcc),mat(0x4f6268)];
 for(let j=0;j<84;j++){const x=j<48?181+Math.floor(random()*5)*6:-145-random()*25,z=-600+random()*1500,y=-11;const color=carColors[j%5];b.add(1.8,.8,4.3,x,y,z,color);b.add(1.55,.65,2.3,x,y+.65,z,dark);for(const zz of[-1.4,1.4])b.add(1.95,.45,.6,x,y-.35,z+zz,dark);}
 for(let j=0;j<12;j++){const x=-111+j*19,z=-190,y=-10.8;b.add(3,3.1,12,x,y+1,z,j%3?carColors[j%5]:red);b.add(3.05,1.2,10.3,x,y+1.7,z,dark);}
 for(const z of[-80,420]){b.add(.3,9,.3,174,-7,z,metal);b.add(.3,9,.3,220,-7,z,metal);b.add(47,.3,.3,197,-2.5,z,metal);const s=sign(group,'A9   MÜNCHEN   ↓',16,3.1,196,-3.7,z+.2,{bg:'#184d92',font:83,h:180});}
 // Fröttmaning Hill, the wind turbine, and the small Holy Cross church are contextual approximations.
 const hill=mesh(new THREE.SphereGeometry(140,48,18),mat(0x718761),group,375,-30,-40);hill.scale.set(1.5,.45,2);
 const turbine=new THREE.Group();turbine.position.set(390,24,-95);group.add(turbine);cylinder(turbine,1.1,80,0,40,0,pale,10);box(turbine,3,3.5,8,0,81,-2,pale);const rotor=new THREE.Group();rotor.position.set(0,81,3);turbine.add(rotor);mesh(new THREE.SphereGeometry(1.8,10,8),pale,rotor);for(let i=0;i<3;i++){const blade=box(rotor,1.4,36,.28,0,19,0,pale);blade.geometry.translate(0,-19,0);blade.position.set(0,0,0);blade.rotation.z=i*TAU/3;blade.geometry.translate(0,19,0);}
 const church=new THREE.Group();church.position.set(354,5,183);group.add(church);box(church,10,8,19,0,4,0,pale);const roofMesh=mesh(new THREE.ConeGeometry(9.5,5.5,4),mat(0x5c4a3c),church,0,10.5,0);roofMesh.rotation.y=Math.PI/4;roofMesh.scale.z=1.6;box(church,4.5,15,4.5,0,7.5,11,pale);mesh(new THREE.ConeGeometry(3.7,6,4),mat(0x5c4a3c),church,0,18,11);beam(church,v(0,20.5,11),v(0,23,11),.08,metal);beam(church,v(-.7,22,11),v(.7,22,11),.07,metal);
 // A belt of instanced trees keeps the surrounding open landscape visible at useful frame rates.
 const treePositions=[];for(let i=0;i<1350;i++){const x=(random()-.5)*1800,z=(random()-.5)*1900;if(Math.abs(x)<165&&z>-190&&z<710)continue;if(Math.abs(x-197)<35||Math.abs(z+261)<28||Math.abs(x+245)<48)continue;if(x<-175&&x>-385&&z>160&&z<600)continue;treePositions.push({x,z,s:2.5+random()*4,y:-12});}
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.28,4,5),mat(0x706650),treePositions.length),crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leaf,treePositions.length);treePositions.forEach((p,i)=>{d.position.set(p.x,p.y+p.s*.35,p.z);d.scale.set(1,p.s/4,1);d.rotation.set(0,random()*TAU,0);d.updateMatrix();trunks.setMatrixAt(i,d.matrix);d.position.y=p.y+p.s;d.scale.set(p.s*.65,p.s*.85,p.s*.65);d.updateMatrix();crowns.setMatrixAt(i,d.matrix);crowns.setColorAt(i,new THREE.Color().setHSL(.27+random()*.1,.22,.22+random()*.13));});crowns.castShadow=true;group.add(trunks,crowns);
 b.flush();
 const nightLights=[];for(const p of lampPositions.filter((_,i)=>i%5===0)){const l=new THREE.PointLight(0xffdda3,0,20,1.8);l.position.copy(p).add(v(0,6,0));group.add(l);nightLights.push(l);}
 let isNight=false;
 return {group,rotor,colliders,update(position){for(const l of nightLights)l.visible=isNight&&l.position.distanceTo(position)<45;},night(n){isNight=n;lightMat.color.set(n?0xffd99d:0xf5f0e2);nightLights.forEach(l=>{l.intensity=n?14:0;l.visible=n;});}};
 function whiteFlag(){return pale;}
}
