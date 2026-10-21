import {THREE,TAU,v,mat,mesh,box,beam,sign,cylinder,canvasTexture,textTexture,superpoint,supernormal,ringGeometry,curveLine,mergeGeometry,compactGroup,Batches,addCrest,seeded} from './kit.js';
import {buildCirculation} from './circulation.js';
import {accessStairs,ACCESS_BASE,ACCESS_TOP} from './access-layout.js';
import {visitorPassage,bowlOpening} from './tour-route.js';
import {tierEntryOpening,inCoreShaft,seatingTiers} from './building-layout.js';

export function buildStadium(scene){
 const root=new THREE.Group();root.name='Allianz Arena | metres';scene.add(root);
 const roof=new THREE.Group();roof.name='Roof and trusses';root.add(roof);
 const structural=new THREE.Group();root.add(structural);const batch=new Batches(structural);
 const concrete=mat(0x8c9193,{side:THREE.DoubleSide}),darkConcrete=mat(0x454d52),steel=mat(0xb9c2c5,{metalness:.55,roughness:.42}),red=mat(0xc71936,{side:THREE.DoubleSide}),white=mat(0xf2f1ed),dark=mat(0x1b252e);
 const ledMaterial=new THREE.MeshBasicMaterial({color:0xff1945,toneMapped:false});
 const lightMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
 // The cross-section follows the rolled ETFE shell, from its lower lip to the roof opening.
 const cross=[[.885,5.8],[.948,10.2],[.985,18.5],[1,27],[.99,35.5],[.947,42.6],[.874,48.7],[.779,51.4],[.686,50.3],[.589,47.8]];
 const arc=[];let distance=0,previous=superpoint(113.5,129,0,2.65);arc.push({t:0,d:0});
 for(let i=1;i<=2048;i++){const t=i/2048*TAU,p=superpoint(113.5,129,t,2.65);distance+=p.distanceTo(previous);arc.push({t,d:distance});previous=p;}
 const theta=(u)=>{let d=((u%1+1)%1)*distance,lo=0,hi=arc.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m].d<d)lo=m;else hi=m;}return THREE.MathUtils.lerp(arc[lo].t,arc[hi].t,(d-arc[lo].d)/(arc[hi].d-arc[lo].d));};
 function surface(u,w){w=THREE.MathUtils.clamp(w,0,1);const f=w*(cross.length-1),i=Math.min(Math.floor(f),cross.length-2),t=f-i;const r=THREE.MathUtils.lerp(cross[i][0],cross[i+1][0],t),y=THREE.MathUtils.lerp(cross[i][1],cross[i+1][1],t),p=superpoint(113.5*r,129*r,theta(u),2.65);p.y=y;return p;}
 const shellMaterials=[mat(0xe5e8e4,{roughness:.42,metalness:.08,side:THREE.DoubleSide,vertexColors:true}),mat(0xf4f4ed,{roughness:.52,metalness:.05,side:THREE.DoubleSide,vertexColors:true})];
 // Clip the entire inflated panel surface at the stair portals, including its
 // corners and shadow pass. Dropping panel centres leaves diamond-shaped obstructions.
 const portalCuts=accessStairs.map((s,i)=>`{vec2 delta=vPortalPosition.xz-vec2(${s.x.toFixed(5)},${s.z.toFixed(5)});float along=-dot(delta,vec2(${s.nx.toFixed(6)},${s.nz.toFixed(6)}));float side=dot(delta,vec2(${s.nz.toFixed(6)},${(-s.nx).toFixed(6)}));float floorY=${ACCESS_BASE.toFixed(3)}+along*${((ACCESS_TOP-ACCESS_BASE)/s.run).toFixed(6)};if(abs(side)<${(s.width/2+.34).toFixed(3)}&&along>-.3&&along<${(s.run+1.8).toFixed(3)}&&vPortalPosition.y>floorY-.45&&vPortalPosition.y<floorY+4.15)discard;}`).join('\n');
 function cutPortals(material){material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vPortalPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvPortalPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 vPortalPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+portalCuts);};material.customProgramCacheKey=()=> 'arena-stair-portals-v1';return material;}
 shellMaterials.forEach(cutPortals);const shellDepth=cutPortals(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}));
 const buffers=[{p:[],c:[],i:[]},{p:[],c:[],i:[]}];let panelCount=0;
 const rand=seeded(370);const samples=16,rings=3;
 for(let row=0;row<24;row++)for(let col=0;col<116;col++){
  const u=(col+.5+(row%2)*.5)/116,w=(row+.5)/24,section=row>=12?1:0,b=buffers[section],start=b.p.length/3,center=surface(u,w);
  const du=surface(u+.0002,w).sub(center),dv=surface(u,w+.0002).sub(center);let normal=new THREE.Vector3().crossVectors(dv,du).normalize();
  if(normal.dot(v(center.x/113.5,w>.5?2:0,center.z/129))<0)normal.negate();
  const shade=.88+rand()*.12;
  const put=(p,k)=>{b.p.push(p.x,p.y,p.z);b.c.push(shade*k,shade*k,shade*k);};
  put(center.clone().addScaledVector(normal,.54),1.04);
  for(let rr=1;rr<=rings;rr++)for(let k=0;k<samples;k++){
   const edge=k/4,side=Math.floor(edge),t=edge-side;const vertices=[[0,-1],[1,0],[0,1],[-1,0]];const a=vertices[side],c=vertices[(side+1)%4],r=rr/rings;
   const dx=THREE.MathUtils.lerp(a[0],c[0],t)*.5/116*r*.986,dy=THREE.MathUtils.lerp(a[1],c[1],t)/24*r*.986;
   const p=surface(u+dx,w+dy).addScaledVector(normal,.54*(1-r*r));put(p,1-.12*r**3);
  }
  for(let k=0;k<samples;k++)b.i.push(start,start+1+k,start+1+(k+1)%samples);
  for(let rr=1;rr<rings;rr++)for(let k=0;k<samples;k++){const a=start+1+(rr-1)*samples+k,c=start+1+(rr-1)*samples+(k+1)%samples,d=start+1+rr*samples+k,e=start+1+rr*samples+(k+1)%samples;b.i.push(a,d,c,c,d,e);}
  panelCount++;
 }
 const shellMeshes=[];buffers.forEach((b,i)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.setIndex(b.i);g.computeVertexNormals();const o=mesh(g,shellMaterials[i],i?roof:root);o.customDepthMaterial=shellDepth;o.castShadow=true;shellMeshes.push(o);});
 // The pedestrian level stays present when the outer bowl is culled indoors.
 const circulation=buildCirculation(scene);
 // A three-tier bowl. Angles follow the published 24 / 30 / 34 degree sections.
 const tiers=seatingTiers;
 const rowGeometries=[];const seats=[];const closeLabels=new THREE.Group();root.add(closeLabels);const textCanvas=document.createElement('canvas');textCanvas.width=1200;textCanvas.height=260;const tx=textCanvas.getContext('2d');tx.fillStyle='#000';tx.fillRect(0,0,1200,260);tx.fillStyle='#fff';tx.textAlign='center';tx.textBaseline='middle';tx.font='bold 165px Arial';tx.fillText('FC BAYERN MÜNCHEN',600,130,1170);const textPixels=tx.getImageData(0,0,1200,260).data;
 function openTunnelRing(a,b,aa,bb,y,row){const limit=Math.asin((2.6/b)**(3.35/2)),ts=Array.from({length:385},(_,i)=>i/384*TAU);ts.push(Math.PI-limit,Math.PI+limit);if(row<8)for(const x of[visitorPassage.x-visitorPassage.width/2-.35,visitorPassage.x+visitorPassage.width/2+.35])ts.push(Math.acos(Math.sign(x)*Math.abs(x/a)**(3.35/2)));ts.sort((a,b)=>a-b);const ps=[];for(let i=0;i<ts.length-1;i++){const t=ts[i],u=ts[i+1],mid=superpoint(a,b,(t+u)/2,3.35);if(bowlOpening(mid.x,mid.z,row))continue;const pts=[superpoint(a,b,t,3.35),superpoint(aa,bb,t,3.35),superpoint(aa,bb,u,3.35),superpoint(a,b,u,3.35)];for(const k of[0,2,1,0,3,2])ps.push(pts[k].x,y,pts[k].z);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.computeVertexNormals();return g;}
 tiers.forEach((tier,ti)=>{
  const rise=tier.depth*Math.tan(tier.angle*Math.PI/180);
  for(let r=0;r<tier.rows;r++){
   const a=tier.a+r*tier.depth,b=tier.b+r*tier.depth,y=tier.y+r*rise;
   rowGeometries.push(ti===0&&r<17?openTunnelRing(a-.1,b-.1,a+tier.depth+.02,b+tier.depth+.02,y,r):ringGeometry(a-.1,b-.1,a+tier.depth+.02,b+tier.depth+.02,y,3.35,192));
   // A low vertical riser creates readable horizontal shadow lines.
   const positions=[];for(let j=0;j<192;j++){const t=j/192*TAU,u=(j+1)/192*TAU,p=superpoint(a,b,t,3.35),q=superpoint(a,b,u,3.35);if(ti===0&&(bowlOpening(p.x,p.z,r)||bowlOpening(q.x,q.z,r)))continue;positions.push(p.x,y,p.z,q.x,y,q.z,p.x,y-rise,p.z,q.x,y,q.z,q.x,y-rise,q.z,p.x,y-rise,p.z);}const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));rg.computeVertexNormals();rowGeometries.push(rg);
   let last=superpoint(a+.3,b+.3,0,3.35),length=0;const path=[{p:last,t:0,d:0}];for(let j=1;j<=768;j++){const t=j/768*TAU,p=superpoint(a+.3,b+.3,t,3.35);length+=p.distanceTo(last);path.push({p,t,d:length});last=p;}
   const count=Math.floor(length/.5);let idx=0;for(let j=0;j<count;j++){
    const d=j/count*length;while(idx<path.length-2&&path[idx+1].d<d)idx++;const f=(d-path[idx].d)/(path[idx+1].d-path[idx].d),t=THREE.MathUtils.lerp(path[idx].t,path[idx+1].t,f);const p=path[idx].p.clone().lerp(path[idx+1].p,f);const block=(j/count*48)%1;
    if(block<.055||block>.945)continue;
    // Keep the player entrance open through the lowest western rows.
    if(ti===0&&bowlOpening(p.x,p.z,r)||tierEntryOpening(p.x,p.z,ti,r)||ti===2&&inCoreShaft(p.x,p.z,.5))continue;
    const n=supernormal(a,b,t,3.35);let color=0xc91c36;
    if(ti===1&&p.x>0&&Math.abs(p.z)<64){const px=Math.floor((p.z+64)/128*1199),py=Math.floor((tier.rows-1-r)/(tier.rows-1)*259);if(textPixels[(py*1200+px)*4]>100)color=0xefefea;}
    if(ti===2&&p.z<-80&&r>3&&r<10&&Math.abs(p.x)<46){if((Math.floor((p.x+46)/4)+r)%5<2)color=0xe9e9e4;}
    seats.push({x:p.x,y:y+.19,z:p.z,yaw:Math.atan2(n.x,n.z),color,sector:Math.min(11,Math.floor(j/count*12))});
   }
  }
  // Continuous red fascias, handrails, glass balustrades and section identifiers.
  const innerA=tier.a-.2,innerB=tier.b-.2,fasciaY=tier.y-.4;
  const fasPos=[];for(let j=0;j<192;j++){const p=superpoint(innerA,innerB,j/192*TAU,3.35),q=superpoint(innerA,innerB,(j+1)/192*TAU,3.35);if(ti===0&&(bowlOpening(p.x,p.z,0)||bowlOpening(q.x,q.z,0)))continue;fasPos.push(p.x,fasciaY,p.z,q.x,fasciaY,q.z,p.x,fasciaY-1,p.z,q.x,fasciaY,q.z,q.x,fasciaY-1,q.z,p.x,fasciaY-1,p.z);}const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fasPos,3));fg.computeVertexNormals();mesh(fg,red,root);
  let pts=[];for(let j=0;j<=512;j++){const p=superpoint(innerA,innerB,j/512*TAU,3.35);p.y=tier.y+.95;if(ti===0&&bowlOpening(p.x,p.z,0)){if(pts.length>1)curveLine(root,pts,0xbec9cd,.8);pts=[];}else pts.push(p);}if(pts.length>1)curveLine(root,pts,0xbec9cd,.8);
  for(let j=0;j<48;j++){const t=(j+.5)/48*TAU,p=superpoint(innerA,innerB,t,3.35),n=supernormal(innerA,innerB,t,3.35),yaw=Math.atan2(n.x,n.z);if(ti===0&&bowlOpening(p.x,p.z,0))continue;batch.add(.04,1,.04,p.x,tier.y+.45,p.z,steel);const lab=sign(closeLabels,String(100+ti*100+j+1),1.8,.58,p.x-n.x*.06,tier.y-.66,p.z-n.z*.06,{w:128,h:64,font:38,fg:'#ffffff',bg:'#b51632'});lab.rotation.y=yaw+Math.PI;}
  // Radial stair aisles with intermediate handrail posts.
  for(let j=0;j<48;j++)for(let r=0;r<tier.rows;r++){const t=j/48*TAU,p=superpoint(tier.a+r*tier.depth+.25,tier.b+r*tier.depth+.25,t,3.35),n=supernormal(tier.a,tier.b,t,3.35);if(ti===0&&bowlOpening(p.x,p.z,r))continue;batch.add(1.05,.08,tier.depth+.1,p.x,tier.y+r*rise+.045,p.z,concrete,Math.atan2(n.x,n.z));if(r%4===0)batch.add(.035,.9,.035,p.x,tier.y+r*rise+.45,p.z,steel);}
 });
 const steps=mesh(mergeGeometry(rowGeometries),concrete,root);steps.castShadow=true;
 const seatBottom=new THREE.BoxGeometry(.435,.1,.4).translate(0,0,0),seatBack=new THREE.BoxGeometry(.435,.46,.085).translate(0,.23,.17),seatGeom=mergeGeometry([seatBottom,seatBack]);
 const coarseSeat=mergeGeometry([new THREE.PlaneGeometry(.435,.4).rotateX(-Math.PI/2),new THREE.PlaneGeometry(.435,.46).translate(0,.23,.17)]),seatMat=mat(0xffffff,{roughness:.53,metalness:.04,side:THREE.DoubleSide});const dummy=new THREE.Object3D(),seatInstances=[];
 for(let sector=0;sector<12;sector++){const list=seats.filter(s=>s.sector===sector),inst=new THREE.InstancedMesh(seatGeom,seatMat,list.length);list.forEach((s,i)=>{dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,s.yaw,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,new THREE.Color(s.color));});inst.computeBoundingSphere();inst.receiveShadow=true;root.add(inst);seatInstances.push(inst);}
 // Roof compression ring, radial cantilever trusses and suspended floodlights.
 const roofBatch=new Batches(roof),trussGeometries=[];const trussBeam=(a,b,r=.13)=>{const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0,1,0),delta.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);trussGeometries.push(g);};
 for(let j=0;j<72;j++){
  const t=j/72*TAU,p=superpoint(66.8,77.8,t,2.65),q=superpoint(105,121,t,2.65);p.y=46.5;q.y=44.8;trussBeam(p,q,.14);const lower=p.clone();lower.y-=2.6;trussBeam(lower,q,.13);trussBeam(p,lower,.1);
  for(let k=1;k<5;k++){const a=p.clone().lerp(q,k/5),b=p.clone().lerp(q,(k-1)/5);b.y-=2.6*(1-(k-1)/5);trussBeam(a,b,.08);}
  const lum=p.clone().lerp(q,.08),n=supernormal(66,78,t,2.65),yaw=Math.atan2(n.x,n.z);for(let k=0;k<4;k++)roofBatch.add(.6,.23,.4,lum.x+n.z*(k-1.5)*.72,lum.y-1.25,lum.z-n.x*(k-1.5)*.72,lightMaterial,yaw);
 }
 roofBatch.flush();mesh(mergeGeometry(trussGeometries),steel,roof);
 for(const [a,b,y]of[[66.6,77.6,46.4],[83,97,48.2],[104,120,44.5]]){const pts=[];for(let j=0;j<=256;j++){const p=superpoint(a,b,j/256*TAU,2.65);p.y=y;pts.push(p);}curveLine(roof,pts,0xadb8bb);}
 const rim=[];for(let j=0;j<=384;j++){const p=superpoint(66.8,77.8,j/384*TAU,2.65);p.y=47.1;rim.push(p);}curveLine(roof,rim,0xff274a);
 // Roof lights use broad sources; the 288 modelled luminaires remain visible as individual units.
 const stadiumLights=[];for(const [x,z]of[[-42,-37],[-42,37],[42,-37],[42,37]]){const l=new THREE.SpotLight(0xe4edff,0,180,1.1,.65,2);l.position.set(x,45,z);l.target.position.set(x*.2,0,z*.2);root.add(l,l.target);stadiumLights.push(l);}
 const logo=sign(root,'Allianz Arena',40,5.4,0,26.7,129.7,{fg:'#164c94',w:2048,h:256,font:185,weight:650,unique:true});
 const logoBack=sign(root,'Allianz Arena',40,5.4,0,26.7,-129.7,{fg:'#164c94',w:2048,h:256,font:185,weight:650,unique:true});logoBack.rotation.y=Math.PI;const logoDayMap=logo.material.map,logoNightMap=textTexture('Allianz Arena',{fg:'#ffffff',w:2048,h:256,font:185,weight:650});
 // LED scoreboards hang above the goal ends, facing the pitch.
 const scoreboards=[];for(const z of[-78,78]){const group=new THREE.Group();group.position.set(0,40.8,z);if(z>0)group.rotation.y=Math.PI;root.add(group);box(group,19.4,11.3,.55,0,0,0,dark);const front=sign(group,'',18.8,10.6,0,0,.3,{bg:'#c71a36',h:600});front.material.transparent=false;front.material.needsUpdate=true;addCrest(group,3.6,-5.8,1.4,.38);sign(group,'FC BAYERN',10.4,1.5,2.1,2,.38,{font:100});sign(group,'MÜNCHEN',10.4,.9,2.1,.3,.38,{font:100});sign(group,'0 : 0',7.5,1.8,0,-2.6,.38,{font:150});sign(group,'MIA SAN MIA',12,.55,0,-4.2,.38,{font:80});compactGroup(group);scoreboards.push(front);for(const x of[-7,7])batch.add(.16,6,.16,x,46,z,steel);}
 // Continuous advertising boards around the edge of the grass.
 const adDefs=[['T',0xe22286],['Allianz',0x164c92],['adidas',0x111820],['Audi',0xefefee],['FC BAYERN',0xca1c37],['PAULANER',0x103f76]];
 for(const side of[-1,1])for(let j=0;j<12;j++){const [label,color]=adDefs[j%adDefs.length],z=-52+j*9.45;if(side<0&&Math.abs(z)<7)continue;const ad=sign(closeLabels,label,9.25,.95,side*40.5,.6,z,{bg:'#'+color.toString(16).padStart(6,'0'),fg:label==='Audi'?'#202632':'#ffffff',font:100});ad.rotation.y=side<0?Math.PI/2:-Math.PI/2;}
 for(const side of[-1,1])for(let j=0;j<8;j++){const[label,color]=adDefs[j%6],x=-33+j*9.45;if(side>0&&Math.abs(x-visitorPassage.x)<6)continue;const ad=sign(closeLabels,label,9.2,.95,x,.6,side*59.7,{bg:'#'+color.toString(16).padStart(6,'0'),fg:label==='Audi'?'#202632':'#ffffff',font:100});ad.rotation.y=side>0?Math.PI:0;}
 buildPitch(root,batch,{white,dark,red,steel});
 // Double bank of dugouts with individual seats and transparent shelters.
 for(const z0 of[-18,18]){
  const g=new THREE.Group();g.position.set(-38.1,0,z0);root.add(g);const gb=new Batches(g);gb.add(3.2,.2,17,0,.08,0,dark);
  for(let row=0;row<2;row++)for(let j=0;j<12;j++){gb.add(.72,.2,.7,-.65+row*1.15,.5+row*.45,-7.1+j*1.28,red);gb.add(.15,1,.72,-.95+row*1.15,1.1+row*.45,-7.1+j*1.28,red);}gb.flush();
  const glass=mat(0xa5c6d9,{transparent:true,opacity:.21,metalness:.2,roughness:.2,side:THREE.DoubleSide,depthWrite:false});box(g,.08,2.5,17,-1.6,1.55,0,glass);box(g,3.3,.08,17,0,2.8,0,glass);for(let j=0;j<7;j++){const z=-8.5+j*17/6;beam(g,v(-1.65,.2,z),v(-1.65,2.8,z),.035,steel);beam(g,v(-1.65,2.8,z),v(1.65,2.8,z),.035,steel);}const a=sign(g,'FC BAYERN MÜNCHEN',15,.36,-1.71,2.65,0,{font:65,h:128});a.rotation.y=-Math.PI/2;compactGroup(g);
 }
 batch.flush();compactGroup(closeLabels);
 return {root,roof,circulation,seatCount:seats.length,panelCount,tiers,update(camera){closeLabels.visible=camera.position.length()<180;for(const inst of seatInstances){const center=inst.boundingSphere.center;inst.geometry=camera.position.distanceTo(center)>70?coarseSeat:seatGeom;}},night(n){circulation.night(n);shellMaterials[0].color.set(n?0xe52a49:0xe5e8e4);shellMaterials[0].emissive.set(n?0xd7082c:0x000000);shellMaterials[0].emissiveIntensity=n?.52:0;shellMaterials[1].color.set(n?0xcfc0c4:0xf4f4ed);shellMaterials[1].emissive.set(n?0x9d1736:0x000000);shellMaterials[1].emissiveIntensity=n?.22:0;stadiumLights.forEach(l=>l.intensity=n?2400:100);logo.material.map=logoBack.material.map=n?logoNightMap:logoDayMap;}};
}

function buildPitch(root,batch,{white,dark,red,steel}){
 const apron=mat(0x273d38);box(root,83,.15,120,0,-.12,0,apron);
 const random=seeded(902);
 const turf=canvasTexture(1536,2368,(ctx,w,h)=>{
  ctx.fillStyle='#427a38';ctx.fillRect(0,0,w,h);
  for(let i=0;i<20;i++){ctx.fillStyle=i%2?'#4e8b3d':'#447e35';ctx.fillRect(0,i*h/20,w,h/20);}
  for(let i=0;i<145000;i++){ctx.fillStyle=random()>.5?'#d5d99720':'#12371a25';ctx.fillRect(random()*w,random()*h,random()*2+.3,random()*5+.7);}
  const px=x=>w/2+x/72*w,pz=z=>h/2+z/111*h;ctx.strokeStyle='#e9edda';ctx.fillStyle='#ecf0df';ctx.lineWidth=2.2;
  const line=(x1,z1,x2,z2)=>{ctx.beginPath();ctx.moveTo(px(x1),pz(z1));ctx.lineTo(px(x2),pz(z2));ctx.stroke();};
  const rect=(x,z,ww,hh)=>ctx.strokeRect(px(x),pz(z),ww/72*w,hh/111*h);
  rect(-34,-52.5,68,105);line(-34,0,34,0);
  ctx.beginPath();ctx.ellipse(px(0),pz(0),9.15/72*w,9.15/111*h,0,0,TAU);ctx.stroke();
  for(const s of[-1,1]){const z=s*52.5;rect(-20.16,s<0?z:z-16.5,40.32,16.5);rect(-9.16,s<0?z:z-5.5,18.32,5.5);ctx.beginPath();ctx.arc(px(0),pz(s*41.5),2.4,0,TAU);ctx.fill();ctx.beginPath();const center=s*41.5,alpha=Math.acos(5.5/9.15);if(s<0)ctx.ellipse(px(0),pz(center),9.15/72*w,9.15/111*h,0,Math.PI/2-alpha,Math.PI/2+alpha);else ctx.ellipse(px(0),pz(center),9.15/72*w,9.15/111*h,0,-Math.PI/2-alpha,-Math.PI/2+alpha);ctx.stroke();}
  ctx.beginPath();ctx.arc(px(0),pz(0),2.5,0,TAU);ctx.fill();
  for(const x of[-34,34])for(const z of[-52.5,52.5]){ctx.beginPath();const a=x>0?Math.PI:0,b=z>0?Math.PI:0;ctx.ellipse(px(x),pz(z),w/72,h/111,0,x>0?(z>0?Math.PI:Math.PI/2):(z>0?-Math.PI/2:0),x>0?(z>0?Math.PI*1.5:Math.PI):(z>0?0:Math.PI/2));ctx.stroke();}
 });
 const grass=mesh(new THREE.PlaneGeometry(72,111),mat(0xffffff,{map:turf,roughness:1}),root,0,.005,0);grass.rotation.x=-Math.PI/2;
 const netMaterial=new THREE.LineBasicMaterial({color:0xdde5df,transparent:true,opacity:.65});
 for(const s of[-1,1]){
  const g=new THREE.Group();g.position.z=s*52.5;if(s<0)g.rotation.y=Math.PI;root.add(g);
  for(const x of[-3.66,3.66]){beam(g,v(x,.02,0),v(x,2.44,0),.06,white,12);beam(g,v(x,.02,2.1),v(x,2.44,1.5),.025,steel);beam(g,v(x,2.44,0),v(x,2.44,1.5),.025,steel);}beam(g,v(-3.66,2.44,0),v(3.66,2.44,0),.06,white,12);
  const points=[];const line=(a,b)=>points.push(...a,...b);
  for(let x=-3.66;x<3.67;x+=.15){line([x,0,2.1],[x,2.44,1.5]);line([x,2.44,0],[x,2.44,1.5]);}for(let y=0;y<2.45;y+=.15)line([-3.66,y,2.1-y/2.44*.6],[3.66,y,2.1-y/2.44*.6]);for(let z=0;z<=2.1;z+=.15)for(const x of[-3.66,3.66])line([x,0,z],[x,2.44,Math.min(z,1.5)]);for(let y=.15;y<2.44;y+=.15)for(const x of[-3.66,3.66])line([x,y,0],[x,y,2.1-y/2.44*.6]);
  const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.add(new THREE.LineSegments(ng,netMaterial));compactGroup(g);
 }
 for(const x of[-34.3,34.3])for(const z of[-52.8,52.8]){cylinder(root,.022,1.5,x,.75,z,white,6);const f=box(root,.48,.32,.008,x+.24,1.35,z,red);}
 // Centre ball, pitch sprinklers, photographers' stools and broadcast cameras.
 const ball=mesh(new THREE.IcosahedronGeometry(.11,2),mat(0xeeeeea),root,0,.115,0);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.111,1)),new THREE.LineBasicMaterial({color:0x2a3030}));ball.add(edges);
 for(const z of[-57.5,57.5])for(let j=0;j<7;j++){batch.add(.7,.65,.6,-25+j*8,.3,z,dark);batch.add(.5,.3,.32,-25+j*8,.8,z,steel);}
 for(const z of[-31,31]){const group=new THREE.Group();group.position.set(-40,0,z);root.add(group);beam(group,v(0,.1,0),v(0,1.6,0),.05,steel);for(const d of[-1,1])beam(group,v(0,1.1,0),v(.6*d,0,.5),.035,steel);box(group,.7,.4,1,0,1.75,0,dark);cylinder(group,.16,.2,0,1.9,.4,dark);}
}
