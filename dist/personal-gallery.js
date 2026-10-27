import {THREE,v,mat,mesh,box,beam,cylinder,fittedSign as sign,canvasTexture,Batches} from './kit.js';
import {personalHonours,museumObjectLabel} from './personal-honours.js';
import {hangingJerseyGeometry,jerseyBumpTexture} from './wardrobe-detail.js';
import {drawJerseyArtwork} from './jersey-artwork.js';

// Original lightweight interpretations of award silhouettes, not scans.
export function goldenBallGeometry(radius=.34){
 const raw=new THREE.IcosahedronGeometry(1,0).attributes.position,vertices=[],faces=[];
 for(let i=0;i<raw.count;i+=3){const face=[];for(let j=0;j<3;j++){const p=v().fromBufferAttribute(raw,i+j);let index=vertices.findIndex(q=>q.distanceToSquared(p)<1e-8);if(index<0){index=vertices.length;vertices.push(p);}face.push(index);}faces.push(face);}
 const neighbours=vertices.map(()=>new Set()),polygons=[];
 for(const [a,b,c]of faces){for(const [i,j]of[[a,b],[b,c],[c,a]]){neighbours[i].add(j);neighbours[j].add(i);}polygons.push([[a,b],[b,a],[b,c],[c,b],[c,a],[a,c]].map(([i,j])=>vertices[i].clone().multiplyScalar(2/3).addScaledVector(vertices[j],1/3).normalize().multiplyScalar(radius)));}
 vertices.forEach((p,i)=>polygons.push([...neighbours[i]].map(j=>p.clone().multiplyScalar(2/3).addScaledVector(vertices[j],1/3).normalize().multiplyScalar(radius))));
 const positions=[];
 for(const polygon of polygons){const normal=polygon.reduce((s,p)=>s.add(p),v()).normalize(),u=polygon[0].clone().projectOnPlane(normal).normalize(),w=v().crossVectors(normal,u),center=normal.clone().multiplyScalar(radius*1.006);polygon.sort((a,b)=>Math.atan2(a.dot(w),a.dot(u))-Math.atan2(b.dot(w),b.dot(u)));for(let i=0;i<polygon.length;i++){const a=polygon[i].clone().lerp(center,.035),b=polygon[(i+1)%polygon.length].clone().lerp(center,.035);positions.push(...center,...a,...b);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const normals=[];for(let i=0;i<positions.length;i+=3){const n=v(positions[i],positions[i+1],positions[i+2]).normalize();normals.push(...n);}g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
}
export function goldenBootGeometry(){
 const sections=[[-.43,.09,.045,.06],[-.37,.12,.10,.11],[-.24,.16,.13,.16],[-.12,.24,.11,.23],[.01,.18,.12,.17],[.17,.115,.15,.095],[.34,.09,.14,.065],[.45,.09,.055,.04]],positions=[],indices=[],count=20;
 for(const[x,y,w,h]of sections)for(let j=0;j<count;j++){const t=j/count*Math.PI*2;positions.push(x,y+Math.sin(t)*h,Math.cos(t)*w);}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<count;j++){const a=i*count+j,b=i*count+(j+1)%count,c=a+count,d=b+count;indices.push(a,b,c,b,d,c);}for(const end of[0,sections.length-1])for(let j=1;j<count-1;j++)indices.push(end*count,end*count+j+(end?0:1),end*count+j+(end?1:0));
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function ellipsoid(g,m,x,y,z,sx,sy,sz){const o=mesh(new THREE.SphereGeometry(1,16,10),m,g,x,y,z);o.scale.set(sx,sy,sz);return o;}
function ball(g,gold,bronze){mesh(goldenBallGeometry(),gold,g,0,.57,0);mesh(new THREE.SphereGeometry(.313,20,14),bronze,g,0,.57,0);const rock=mesh(new THREE.DodecahedronGeometry(.27,0),bronze,g,0,.15,0);rock.scale.set(1,.58,.9);cylinder(g,.25,.04,0,.025,0,gold,32);}
function boot(g,gold,bronze){mesh(goldenBootGeometry(),gold,g,0,.16,0);for(const x of[-.31,-.12,.18,.33])for(const z of[-.075,.075])cylinder(g,.022,.045,x,.15,z,gold,8);for(let i=0;i<5;i++){const x=-.13+i*.055,y=.39-i*.025;beam(g,v(x-.018,y,-.06),v(x+.015,y,.06),.007,bronze,5);}cylinder(g,.29,.055,0,.03,0,bronze,32);}
function glove(g,gold,bronze){
 const hand=new THREE.Group();hand.rotation.z=-.16;hand.position.y=.11;g.add(hand);ellipsoid(hand,gold,0,.30,0,.16,.22,.065);box(hand,.23,.10,.12,0,.10,0,bronze);
 for(let i=0;i<4;i++){const x=-.12+i*.08,top=.72-Math.abs(i-1.3)*.05;beam(hand,v(x,.42,0),v(x*1.2,top-.055,-.015),.034,gold,10);ellipsoid(hand,gold,x*1.2,top-.05,-.015,.034,.04,.033);beam(hand,v(x,.46,.062),v(x*1.16,top-.08,.023),.004,bronze,5);}
 beam(hand,v(-.12,.29,0),v(-.27,.45,.01),.05,gold,12);ellipsoid(hand,gold,-.27,.45,.01,.048,.055,.043);cylinder(g,.25,.05,0,.025,0,bronze,32);
}
export function uefaTorsoGeometry(){
 const rows=[[0,.20,.105],[.10,.19,.105],[.25,.18,.11],[.40,.225,.14],[.54,.255,.14],[.62,.24,.115]],segments=48,positions=[],indices=[];
 for(let i=0;i<rows.length;i++){const[y,w,d]=rows[i];for(let j=0;j<=segments;j++){const t=j/segments*Math.PI*2,x=Math.cos(t)*w,shoulder=i===rows.length-1?.13*Math.abs(Math.cos(t))**2:0,form=.006*Math.sin(t*3+y*16)*Math.sin(i/(rows.length-1)*Math.PI);positions.push(x,y+shoulder,Math.sin(t)*(d+form));}}
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function addPersonalAward(g,kind,{gold,silver,bronze,dark}){
 if(kind==='ballon')ball(g,gold,bronze);
 else if(kind==='boot')boot(g,gold,bronze);
 else if(kind==='glove')glove(g,gold,bronze);
 else if(kind==='best'){
  mesh(new THREE.CylinderGeometry(.14,.24,.62,24),silver,g,0,.36,0);cylinder(g,.25,.09,0,.045,0,dark,32);mesh(goldenBallGeometry(.22),silver,g,0,.85,0);mesh(new THREE.SphereGeometry(.202,16,12),dark,g,0,.85,0);sign(g,'THE BEST',.24,.07,0,.35,.21,{fg:'#282d31',font:70});
 }else if(kind==='world-ball'){
  cylinder(g,.25,.06,0,.03,0,bronze,32);mesh(new THREE.CylinderGeometry(.16,.23,.37,24),gold,g,0,.24,0);mesh(goldenBallGeometry(.29),gold,g,0,.72,0);mesh(new THREE.SphereGeometry(.267,20,12),bronze,g,0,.72,0);
 }else{
  const metal=silver.clone();metal.side=THREE.DoubleSide;mesh(uefaTorsoGeometry(),metal,g,0,.09,0);cylinder(g,.255,.09,0,.045,0,dark,32);
  for(const[a,b]of [[v(-.20,.70,0),v(-.39,.96,0)],[v(.20,.70,0),v(.44,.86,0)]]){const delta=b.clone().sub(a),arm=mesh(new THREE.CylinderGeometry(.084,.109,delta.length(),24,1,true),metal,g);arm.position.copy(a).add(b).multiplyScalar(.5);arm.quaternion.setFromUnitVectors(v(0,1,0),delta.normalize());const rim=mesh(new THREE.TorusGeometry(.084,.005,5,24),silver,g);rim.position.copy(b);rim.quaternion.setFromUnitVectors(v(0,0,1),delta);}
  mesh(new THREE.TorusGeometry(.063,.003,4,32),silver,g,0,.52,.146);sign(g,'UEFA',.105,.035,0,.525,.150,{font:80,fg:'#e9edef'});sign(g,'BEST PLAYER',.21,.033,0,.20,.132,{font:60,fg:'#c7cdd2'});
 }
}
function drawCard(c,h,i){
 const w=640,gradient=c.createLinearGradient(0,0,w,512);gradient.addColorStop(0,'#411622');gradient.addColorStop(1,'#151b20');c.fillStyle=gradient;c.fillRect(0,0,w,512);
 c.fillStyle='#ffffff05';c.font='bold 330px Arial';c.fillText(h.number,260,406);c.fillStyle='#c2a775';c.fillRect(38,36,38,3);c.font='18px Arial';c.fillText(String(i+1).padStart(2,'0')+' / INDIVIDUAL HONOURS',92,44);
 c.fillStyle='#f3ecdf';c.font='600 38px Microsoft YaHei,Arial';c.fillText(h.name,38,112,w-76);c.fillStyle='#a79d8c';c.font='18px Arial';c.fillText(h.english,40,148,w-80);
 c.fillStyle='#e0c58f';c.font='bold 58px Arial';c.fillText(h.years,38,240,w-76);c.font='23px Microsoft YaHei,Arial';c.fillText(h.award,40,285,w-80);
 c.fillStyle='#d8d2c7';c.font='21px Microsoft YaHei,Arial';c.fillText(h.caption,40,355,w-80);c.fillStyle='#ffffff18';c.fillRect(40,396,560,1);c.fillStyle='#a8aaa3';c.font='18px Microsoft YaHei,Arial';c.fillText('对准此展柜 · F 查看获奖故事',40,449);c.font='13px Arial';c.fillText('FC BAYERN · DIGITAL COLLECTION',40,483);
}
function memoryCase(g,h,m){
 const {gold,silver,bronze,dark}=m,white=mat(0xe3e0d6,{roughness:.85});
 for(const[i,color]of ['#b71d36','#dedaca'].entries()){
  const texture=canvasTexture(512,640,c=>drawJerseyArtwork(c,h.id==='thomas'?25:9,h.id==='thomas'?'MÜLLER':'KANE',color)),material=mat(0xffffff,{map:texture,bumpMap:jerseyBumpTexture(),bumpScale:.002,roughness:.95,alphaTest:.15,side:THREE.DoubleSide}),shirt=mesh(hangingJerseyGeometry(),material,g,(i-.5)*1.06,2.22,-.12);shirt.scale.setScalar(1.1);
  beam(g,v((i-.5)*1.06-.27,2.70,-.16),v((i-.5)*1.06,2.84,-.16),.009,bronze,6);beam(g,v((i-.5)*1.06,2.84,-.16),v((i-.5)*1.06+.27,2.70,-.16),.009,bronze,6);
 }
 beam(g,v(-1.1,2.85,-.17),v(1.1,2.85,-.17),.015,bronze,8);
 const sphere=new THREE.Group();sphere.position.set(.89,1.05,.02);g.add(sphere);mesh(goldenBallGeometry(.11),white,sphere);mesh(new THREE.SphereGeometry(.101,16,10),dark,sphere);cylinder(g,.08,.055,.89,.89,.02,bronze,16);
 // A miniature Torjägerkanone, a distinctive object in Kane's real showcase.
 if(h.id==='kane-shoe'){
  for(const z of[-.09,.09]){const wheel=mesh(new THREE.TorusGeometry(.105,.015,6,20),bronze,g,-.86,1.0,z);for(let j=0;j<6;j++){const t=j/6*Math.PI*2;beam(g,v(-.86,1,z),v(-.86+Math.cos(t)*.1,1+Math.sin(t)*.1,z),.004,bronze,4);}}
  beam(g,v(-1.04,1.09,0),v(-.62,1.24,0),.036,gold,12);box(g,.23,.04,.21,-.86,.88,0,bronze);
 }
 const note=box(g,.28,.24,.008,-.91,1.50,-.12,white);note.rotation.z=-.06;for(let i=0;i<4;i++)box(g,.20,.004,.003,-.91,1.56-i*.035,-.112,bronze);
 for(const i of[0,1]){const x=(i-.5)*1.06;sign(g,(h.id==='thomas'?'MÜLLER · 25':'KANE · 9'),.98,.15,x,1.64,.337,{font:135,fg:'#f5e8c6',bg:'#192129'});sign(g,i?'浅色球衣 · 配色示意':'红色球衣 · 配色示意',.98,.105,x,1.47,.338,{font:120,fg:'#d0d9db',bg:'#192129'});}
}
export function buildPersonalGallery(g,materials){
 const {gold,silver,bronze,dark,glass}=materials,b=new Batches(g),back=mat(0x282522,{roughness:.78}),glow=new THREE.MeshBasicMaterial({color:0xe4c995,toneMapped:false});
 const atlas=canvasTexture(2560,1536,c=>personalHonours.forEach((h,i)=>{c.save();c.translate(i%4*640,Math.floor(i/4)*512);drawCard(c,h,i);c.restore();})),cardMaterial=new THREE.MeshBasicMaterial({map:atlas,toneMapped:false});
 for(const[hIndex,h]of personalHonours.entries()){
  const niche=new THREE.Group();niche.name=h.english+' · '+h.award;niche.position.set(h.x,0,h.z);niche.rotation.y=h.yaw;g.add(niche);
  box(niche,2.62,3.90,.11,0,2.13,-.27,back);for(const x of[-1.3,1.3])box(niche,.025,3.9,.035,x,2.13,-.19,bronze);
  box(niche,2.54,.77,.65,0,.385,0,dark);box(niche,2.58,.035,.68,0,.785,0,bronze);box(niche,2.43,.018,.57,0,.81,0,glow);
  const memory=['kane-shoe','thomas'].includes(h.id),top=memory?3.05:2.04,cy=(.8+top)/2;
  box(niche,2.5,.025,.60,0,top,0,bronze);box(niche,2.44,.015,.52,0,top-.03,0,glow);box(niche,2.5,top-.84,.006,0,cy,.32,glass);
  for(const x of[-1.25,1.25]){box(niche,.009,top-.8,.63,x,cy,0,glass);box(niche,.016,top-.8,.016,x,cy,.32,bronze);}
  const count=h.models;for(let j=0;j<count;j++){const award=new THREE.Group();award.position.set((j-(count-1)/2)*(memory?.50:.91),.84,.025);award.rotation.y=.12;award.scale.setScalar(memory?.55:count>1?.83:1);niche.add(award);addPersonalAward(award,h.kind,materials);}
  if(h.id==='lewandowski'){const shoe=new THREE.Group();shoe.position.set(.71,.84,.04);shoe.scale.setScalar(.66);niche.add(shoe);addPersonalAward(shoe,'boot',materials);}
  if(memory){memoryCase(niche,h,materials);sign(niche,h.name+' · 个人展柜',2.32,.23,0,3.75,-.198,{font:75,fg:'#f0e8d8'});sign(niche,h.award+' / '+h.years,2.32,.17,0,3.40,-.197,{font:53,fg:'#ccb684'});}
  else{const geometry=new THREE.PlaneGeometry(2.48,1.984),uv=geometry.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,(hIndex%4+uv.getX(k))/4,1-(Math.floor(hIndex/4)+1-uv.getY(k))/3);mesh(geometry,cardMaterial,niche,0,3.09,-.198);}
  // The identifying label remains at the case, even when the tall history board
  // is above a close visitor's field of view.
  const labelY=memory?2.94:1.92;sign(niche,h.name+' · '+h.years,2.45,.19,0,labelY,.345,{fg:'#f5e6bb',bg:'#192129',font:140});
  sign(niche,h.name,2.25,.19,0,.60,.337,{fg:'#f1e0b3',font:150});sign(niche,h.award+' · '+h.years,2.25,.12,0,.39,.338,{fg:'#d1c5aa',font:145});sign(niche,museumObjectLabel(h),2.25,.10,0,.20,.339,{fg:'#aebbc0',font:140});
 }
 // Ribbed side cladding and a calm central runner anchor the room at human scale.
 const red=mat(0x771f31,{roughness:.82});for(const side of[-1,1])for(let z=-12;z<12.1;z+=.24){if(side>0&&Math.abs(z)<1.42)continue;b.add(.025,4.2,.035,side*7.39,2.1,z,red);}
 b.add(2.55,.012,21.5,0,.008,0,mat(0x242526,{roughness:1}));for(const x of[-1.30,1.30])b.add(.018,.015,21.5,x,.018,0,bronze);
 sign(g,'CLUB GLORY',2.6,.22,0,.025,-9.3,{font:80,fg:'#c5ae7e'}).rotation.x=-Math.PI/2;sign(g,'PERSONAL GREATNESS',3.2,.20,0,.025,8.9,{font:65,fg:'#c5ae7e'}).rotation.x=-Math.PI/2;
 // Recessed ceiling tracks, without adding dozens of dynamic lights.
 for(const x of[-5.55,0,5.55]){b.add(.16,.07,23.5,x,4.32,0,dark);for(let z=-10.5;z<=10.5;z+=3.5){b.add(.22,.10,.5,x,4.25,z,dark);b.add(.17,.012,.44,x,4.19,z,glow);}}
 for(const x of[-2.3,2.3]){beam(g,v(x,4.25,-12),v(x,4.25,12),.12,back,12);for(let z=-11;z<12;z+=1.4){const band=mesh(new THREE.TorusGeometry(.126,.008,4,12),bronze,g,x,4.25,z);band.rotation.y=0;}}for(let z=-10;z<=10;z+=4)b.add(13.7,.08,.20,0,4.35,z,dark);
 b.flush();return personalHonours.length;
}
