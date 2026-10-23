import {compactStaticMeshes} from './scene-budget.js';
import {finishReception,finishedBox,contactShadow} from './finishes.js';
import {inCoreShaft,publicWallOpening,clearCore,roomFootprint} from './building-layout.js';
import {THREE,TAU,v,mat,mesh,box,beam,canvasTexture,repeatTex,floorTexture,ringGeometry,Batches,mergeGeometry,addCrest} from './kit.js';
import {ACCESS_BASE,ACCESS_TOP,accessStairs,perimeterFrames,perimeterPoint,perimeterNormal,stairwellAt,orientedCollider} from './access-layout.js';
import {visitorPassage,visitorWallOpening} from './tour-route.js';

// One shared sign atlas and instanced architectural parts keep the pedestrian
// level detailed without adding a separate draw call for every door or label.
class SignAtlas{
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.width=4096;this.canvas.height=2048;
  this.ctx=this.canvas.getContext('2d');this.cells=new Map();this.parts=new Map();
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.anisotropy=8;
  this.material=new THREE.MeshBasicMaterial({map:this.texture,side:THREE.FrontSide,toneMapped:false});
 }
 add(parent,title,sub,w,h,x,y,z,yaw=0,{bg='#293943',fg='#f3f0e9',accent='#d9183e',tilt=0,style='label'}={}){
  const key=JSON.stringify([title,sub,bg,fg,accent,style,Math.round(w/h*100)]);let cell=this.cells.get(key);
  if(!cell){
   const index=this.cells.size;if(index>=128)throw Error('Wayfinding atlas capacity exceeded');
   cell={x:index%8*512,y:Math.floor(index/8)*128};this.cells.set(key,cell);
   const c=this.ctx;c.save();c.translate(cell.x,cell.y);c.fillStyle=bg;c.fillRect(0,0,512,128);
   c.fillStyle=accent;c.fillRect(0,0,8,128);const scale=(512/128)/(w/h);
   c.translate(262,0);c.scale(scale,1);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';
   const maxWidth=464/scale;
   if(style==='map'){
    c.font='700 15px Arial';c.fillText(title,0,15,maxWidth);const r=Math.min(maxWidth*.23,42),cx=-maxWidth*.2,cy=73;
    c.lineWidth=6;c.strokeStyle='#ba2946';c.beginPath();c.ellipse(cx,cy,r,r*.77,0,0,TAU);c.stroke();c.lineWidth=1.5;c.strokeStyle='#657f88';c.beginPath();c.ellipse(cx,cy,r*.67,r*.51,0,0,TAU);c.stroke();
    c.fillStyle='#42775d';c.fillRect(cx-9,cy-14,18,28);c.strokeStyle='#d3e8d9';c.strokeRect(cx-7,cy-12,14,24);c.beginPath();c.moveTo(cx-7,cy);c.lineTo(cx+7,cy);c.stroke();
    for(let j=0;j<8;j++){const t=j/8*TAU;c.fillStyle=j===2?'#daac47':'#3b7061';c.beginPath();c.arc(cx+Math.cos(t)*r,cy+Math.sin(t)*r*.77,3,0,TAU);c.fill();}
    c.textAlign='left';c.fillStyle='#344b55';c.font='700 9px Arial';const tx=maxWidth*.12;c.fillText('EINGÄNGE',tx,49);c.fillText('WC / SERVICE',tx,70);c.fillText('TRIBÜNEN',tx,91);c.font='8px Arial';c.fillText('SÜD ↓  ·  NORD ↑',tx,110);
   }else{let size=sub?64:79;c.font=`700 ${size}px Arial, sans-serif`;if(c.measureText(title).width>maxWidth){size*=maxWidth/c.measureText(title).width;c.font=`700 ${size}px Arial, sans-serif`;}c.fillText(title,0,sub?48:66);if(sub){c.fillStyle=fg==='#f3f0e9'?'#d5dcdd':fg;c.font='500 27px Arial, sans-serif';c.fillText(sub,0,101,maxWidth);}}
   c.restore();
  }
  const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++){const u=uv.getX(i),vv=uv.getY(i);uv.setXY(i,(cell.x+1+u*510)/4096,1-(cell.y+1+(1-vv)*126)/2048);}
  const matrix=new THREE.Matrix4().compose(v(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,yaw,0,'YXZ')),v(1,1,1));g.applyMatrix4(matrix);
  if(!this.parts.has(parent))this.parts.set(parent,[]);this.parts.get(parent).push(g);
 }
 finish(parent){const gs=this.parts.get(parent);if(gs?.length){const signMesh=mesh(mergeGeometry(gs),this.material,parent);signMesh.name='Batched architectural wayfinding';this.parts.delete(parent);}this.texture.needsUpdate=true;}
}

function architecturalTexture(type){
 return canvasTexture(1024,1024,(ctx)=>{
  let seed=851;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  ctx.fillStyle=type==='floor'?'#a3a6a4':'#afb3b1';ctx.fillRect(0,0,1024,1024);
  for(let i=0;i<24000;i++){const value=random();ctx.fillStyle=value<.5?'#626b6b22':'#edf0e32b';const size=.5+random()*2.5;ctx.fillRect(random()*1024,random()*1024,size,size);}
  ctx.strokeStyle=type==='floor'?'#727a785c':'#727d7a48';ctx.lineWidth=type==='floor'?2:2.5;
  const divisions=type==='floor'?8:4;
  for(let i=0;i<=divisions;i++){const p=i*1024/divisions;ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,1024);ctx.moveTo(0,p);ctx.lineTo(1024,p);ctx.stroke();}
  if(type==='wall'){ctx.fillStyle='#64706a50';for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(const [dx,dy]of[[22,22],[233,22],[22,233],[233,233]]){ctx.beginPath();ctx.arc(x*256+dx,y*256+dy,3.5,0,TAU);ctx.fill();}}
 });
}

export function accessRingGeometry(a,b,aa,bb,y,holes=true){
 const points=[],uv=[],segments=384,bands=16;
 for(let r=0;r<bands;r++)for(let i=0;i<segments;i++){
  const t=i/segments*TAU,u=(i+1)/segments*TAU,f=r/bands,ff=(r+1)/bands;
  const p=perimeterPoint(a+(aa-a)*f,b+(bb-b)*f,t),q=perimeterPoint(a+(aa-a)*ff,b+(bb-b)*ff,t),s=perimeterPoint(a+(aa-a)*ff,b+(bb-b)*ff,u),v0=perimeterPoint(a+(aa-a)*f,b+(bb-b)*f,u);
  const cx=(p.x+q.x+s.x+v0.x)/4,cz=(p.z+q.z+s.z+v0.z)/4;
  if(holes&&(stairwellAt(cx,cz,y)||inCoreShaft(cx,cz,.4)))continue;
  const vertices=[p,s,q,p,v0,s];for(const vertex of vertices){points.push(vertex.x,y,vertex.z);uv.push(vertex.x/12,vertex.z/12);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

export function buildCirculation(parent){
 const root=new THREE.Group();root.name='Detailed entrance arcade and eight access stairs';parent.add(root);
 const roof=new THREE.Group();roof.name='Entrance arcade ceiling';root.add(roof);
 const atlas=new SignAtlas(),batch=new Batches(root),roofBatch=new Batches(roof),colliders=[],lamps=[],stairSlabs=[];let lightingNight=false;
 const floor=mat(0xf1f2ed,{map:repeatTex(architecturalTexture('floor'),1,1),roughness:.86,bumpMap:null,side:THREE.DoubleSide});
 const wall=mat(0xe3e6e1,{map:repeatTex(architecturalTexture('wall'),2,2),roughness:.9,bumpMap:floor.map,bumpScale:.008,side:THREE.DoubleSide});
 const column=mat(0xadb3ac,{roughness:.87}),edge=mat(0x555f63,{roughness:.6}),metal=mat(0x9faeb1,{metalness:.65,roughness:.35}),red=mat(0xb41b36,{roughness:.48}),pale=mat(0xe1e0d5),dark=mat(0x26343e),wood=mat(0xffffff,{map:repeatTex(floorTexture('wood'),2,1),roughness:.7});
 const glass=mat(0xb3d0d8,{transparent:true,opacity:.24,depthWrite:false,metalness:.18,roughness:.14,side:THREE.DoubleSide});
 const glow=new THREE.MeshBasicMaterial({color:0xfff1d5,toneMapped:false}),green=new THREE.MeshBasicMaterial({color:0x76d7a8,toneMapped:false});
 const ground=mesh(accessRingGeometry(72,90,121,139,ACCESS_BASE,false),floor,root);ground.name='Jointed concrete entrance paving';
 mesh(accessRingGeometry(119,137,151,169,-2.985,false),floor,root).name='Continuous paved arrival apron';
 mesh(accessRingGeometry(91,108,99,116,ACCESS_BASE+.012,false),mat(0x8f9793,{map:floor.map,roughness:.9}),root);
 mesh(ringGeometry(111.2,128.2,111.45,128.45,ACCESS_BASE+.025),red,root);
 mesh(ringGeometry(116,133,116.5,133.5,ACCESS_BASE+.027),edge,root);
 const soffit=mat(0xd5d8d0,{roughness:.96,emissive:0x5c5c52,emissiveIntensity:.22,side:THREE.DoubleSide});
 mesh(accessRingGeometry(86,104,116,132,5.4),soffit,roof).name='Closed double-sided entrance soffit';
 const innerWall=[],wallAngles=Array.from({length:385},(_,i)=>i/384*TAU);
 for(const x of[visitorPassage.x-visitorPassage.width/2,visitorPassage.x+visitorPassage.width/2])wallAngles.push(Math.acos(Math.sign(x)*Math.abs(x/86)**1.4));wallAngles.sort((a,b)=>a-b);
 for(let i=0;i<wallAngles.length-1;i++){
  const t=wallAngles[i],u=wallAngles[i+1],p=perimeterPoint(86,104,t),q=perimeterPoint(86,104,u),cx=(p.x+q.x)/2,cz=(p.z+q.z)/2,y0=visitorWallOpening(cx,cz)?visitorPassage.head:ACCESS_BASE,y1=5.4;
  innerWall.push(p.x,y0,p.z,q.x,y0,q.z,p.x,y1,p.z,q.x,y0,q.z,q.x,y1,q.z,p.x,y1,p.z);
  colliders.push(orientedCollider(cx,cz,Math.hypot(p.x-q.x,p.z-q.z)+.02,.18,y0,y1,Math.atan2(q.z-p.z,p.x-q.x)*-1));
 }
 const wallGeometry=new THREE.BufferGeometry();wallGeometry.setAttribute('position',new THREE.Float32BufferAttribute(innerWall,3));
 const wallUV=[];for(let i=0;i<innerWall.length;i+=3)wallUV.push((innerWall[i]+innerWall[i+2])/6,innerWall[i+1]/4);wallGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(wallUV,2));wallGeometry.computeVertexNormals();mesh(wallGeometry,wall,root).name='Continuous enclosure below the seating bowl';

 const frames=perimeterFrames(105,120,66),entries=new Set([0,5,16,27,38,49,60]);
 const services=['INFORMATION','ARENA TOUR','FAN SERVICE','WC','GETRÄNKE','FAN SHOP'];
 const placement=(frame,x,z)=>({x:frame.x+frame.normal.z*x+frame.normal.x*z,z:frame.z-frame.normal.x*x+frame.normal.z*z});
 function solid(frame,w,h,d,x,y,z,m,target=batch){const p=placement(frame,x,z);target.add(w,h,d,p.x,ACCESS_BASE+y,p.z,m,frame.yaw);}
 function label(frame,title,sub,w,h,x,y,z,options={}){const p=placement(frame,x,z);atlas.add(root,title,sub,w,h,p.x,ACCESS_BASE+y,p.z,frame.yaw,options);}
 function collision(frame,w,d,x,z,y0=ACCESS_BASE,y1=2){const p=placement(frame,x,z);colliders.push(orientedCollider(p.x,p.z,w,d,y0,y1,frame.yaw));}

 for(const frame of frames){
  if(clearCore(frame.x,frame.z))continue;
  const i=frame.index,w=frame.spacing-.35,half=w/2,letter='ABCDEFGHJKLMNPRS'[Math.floor(i/4)%16],entry=entries.has(i),kind=services[Math.floor(i/3)%services.length];
  solid(frame,.58,8.3,.72,-half-.18,4.15,0,column);solid(frame,.8,.28,.95,-half-.18,.14,0,edge);
  const columnFoot=placement(frame,-half-.18,0);contactShadow(root,1.8,1.8,columnFoot.x,ACCESS_BASE+.009,columnFoot.z,.24);
  solid(frame,w,.6,.74,0,8.0,0,column);if(!entry)solid(frame,w,.34,.34,0,.17,-.4,edge);
  solid(frame,w-.4,1.5,.3,0,6.75,-.3,pale);
  for(let slot=0;slot<8;slot++)solid(frame,w-.7,.035,.055,0,6.16+slot*.16,-.09,metal);
  solid(frame,w,.08,.26,0,5.78,-.18,edge);
  if(entry){
   const opening=6.4,sideWidth=(w-opening)/2;
   for(const side of[-1,1]){
    solid(frame,sideWidth,5.4,.2,side*(opening/2+sideWidth/2),2.9,-.24,glass);
    solid(frame,.14,5.6,.2,side*opening/2,2.8,-.1,metal);
    solid(frame,.12,3.4,1.8,side*3.1,1.7,-1.12,glass);
    solid(frame,.07,3.4,1.85,side*3.1,1.7,-1.12,metal);
    collision(frame,.16,1.85,side*3.1,-1.12);
   }
   solid(frame,opening,.65,.26,0,5.35,.04,red);
   const name=i===16?'EINGANG SÜD':i===49?'EINGANG NORD':'EINGANG '+letter;
   label(frame,name,'ALLIANZ ARENA  ·  WILLKOMMEN',opening-.2,.62,0,5.35,.2,{bg:'#a81732'});
   label(frame,'↓','OFFENER DURCHGANG',2.3,.78,0,4.45,.12,{bg:'#286d53',accent:'#8ce3ac'});
   for(const side of[-1,1]){solid(frame,.43,1.05,1.25,side*2.15,.525,-.55,metal);solid(frame,.24,.06,.24,side*2.15,1.11,-.3,green);collision(frame,.43,1.25,side*2.15,-.55,ACCESS_BASE,ACCESS_BASE+1.1);}
  }else{
   if(kind==='WC')solid(frame,w-.14,5.6,.18,0,2.8,-1.8,wall);
   solid(frame,w-.3,4.7,.13,0,2.95,-.35,glass);
   for(const x of[-half+.2,-w/4,0,w/4,half-.2])solid(frame,.09,5.4,.16,x,2.7,-.2,metal);
   solid(frame,w-.2,.1,.18,0,5.38,-.18,metal);solid(frame,w-.2,.1,.18,0,.65,-.18,metal);
   label(frame,kind,kind==='WC'?'DAMEN  ·  HERREN  ·  BARRIEREFREI':'SERVICE  ·  ALLIANZ ARENA',w-.6,.68,0,5.45,.02,{bg:kind==='WC'?'#34474f':'#a91b35'});
   const inward=placement(frame,0,-1.95);
   atlas.add(root,kind,kind==='WC'?'DAMEN · HERREN':'SERVICE · ALLIANZ ARENA',w-.6,.68,inward.x,ACCESS_BASE+5.45,inward.z,frame.yaw+Math.PI,{bg:kind==='WC'?'#34474f':'#a91b35'});
   if(kind==='WC'){
    for(const side of[-1,1]){solid(frame,1.7,3.25,.16,side*2.1,1.625,-1.94,edge);solid(frame,.65,.055,.09,side*2.1,1.05,-2.05,metal);const p=placement(frame,side*2.1,-2.04);atlas.add(root,side<0?'WC D':'WC H','TOILETTEN',1.45,.62,p.x,ACCESS_BASE+2.5,p.z,frame.yaw+Math.PI,{bg:'#365164'});collision(frame,1.7,.18,side*2.1,-1.94);}
   }else{
    solid(frame,w-1,1.12,.9,0,.56,-2.45,kind==='FAN SHOP'?red:wood);solid(frame,w-.8,.1,1.1,0,1.17,-2.47,pale);
    solid(frame,1.0,.55,.08,-1.3,1.55,-2.25,dark);solid(frame,.12,.32,.25,-1.3,1.25,-2.25,metal);
    for(let shelf=0;shelf<3;shelf++){solid(frame,w-1,.07,.5,0,.8+shelf*.83,-.8,metal);for(let j=0;j<7;j++)solid(frame,.38,.4,.32,-w/2+1+j*(w-2)/7,1.04+shelf*.83,-.8,j%3===0?red:j%3===1?pale:wood);}
    const menu=placement(frame,0,-.99);atlas.add(root,kind==='GETRÄNKE'?'KAFFEE · BREZN':'SERVUS!','INFORMATION & SERVICE',w*.7,1.0,menu.x,ACCESS_BASE+3.8,menu.z,frame.yaw+Math.PI,{bg:'#e0dfd2',fg:'#31414a',accent:'#a81732'});
    collision(frame,w-.8,1.1,0,-2.47,ACCESS_BASE,ACCESS_BASE+1.25);
    collision(frame,w-.3,.18,0,-.3);
   }
   for(const side of[-1,1]){solid(frame,.08,5.5,.1,side*(half-.13),2.75,-.2,metal);}
  }
  // The route remains between the fixtures, with furniture grouped beside each bay.
  if(i%3===1&&!entry){
   solid(frame,2.5,.12,.64,0,.51,4.7,wood);solid(frame,2.5,.68,.1,0,.9,4.98,wood);
   for(const x of[-.9,.9])solid(frame,.12,.48,.55,x,.24,4.7,metal);
   collision(frame,2.5,.8,0,4.8,ACCESS_BASE,ACCESS_BASE+1.3);
   solid(frame,.55,.94,.55,2.2,.47,4.7,edge);solid(frame,.58,.06,.58,2.2,.97,4.7,metal);collision(frame,.6,.6,2.2,4.7,ACCESS_BASE,ACCESS_BASE+1.0);
   label(frame,'RECYCLE','PAPIER / REST',.42,.42,2.2,.59,5.005,{bg:'#3f5559',accent:'#63a28a'});
  }
  if(i%4===0){
   solid(frame,1.3,2.25,.12,half+.04,2.1,.46,edge);
   label(frame,i%8===0?'ARENA TOUR':'MIA SAN MIA',i%8===0?'TOUR & MUSEUM':'FC BAYERN MÜNCHEN',1.16,2.08,half+.04,2.1,.54,{bg:'#ae1935',accent:'#f0e6d6'});
  }
  if(i%6===0){solid(frame,.75,1.0,.2,-half+.7,1.1,-.03,red);label(frame,'F','FEUERLÖSCHER',.48,.65,-half+.7,1.1,.09,{bg:'#b91d36',accent:'#fff'});}
  const cp=perimeterPoint(92,109,frame.t),normal=frame.normal;
  roofBatch.add(5.8,.22,.42,cp.x,4.85,cp.z,metal,frame.yaw);
  roofBatch.add(3.6,.05,.32,cp.x+normal.x*7.8,5.06,cp.z+normal.z*7.8,glow,frame.yaw);
  roofBatch.add(.22,.04,3.2,cp.x+normal.x*3.1,5.0,cp.z+normal.z*3.1,edge,frame.yaw);
  if(i%4===1){atlas.add(root,letter,'BLOCK '+(101+i)+' →',1.7,1.2,cp.x+normal.x*11.6,3.95,cp.z+normal.z*11.6,frame.yaw,{bg:'#354950'});}
 }

 // Inner service enclosure has joints, actual door leaves and human-scale maps.
 for(const frame of perimeterFrames(86.2,104.2,32)){
  const n=frame.normal,p={x:frame.x+n.x*.16,z:frame.z+n.z*.16};
  if(p.z>95&&Math.abs(p.x-visitorPassage.x)<7)continue;
  batch.add(.1,6.5,.1,p.x,ACCESS_BASE+3.25,p.z,metal,frame.yaw);
  if(frame.index%4===0){
   batch.add(2.05,3.2,.17,p.x+n.x*.12,ACCESS_BASE+1.6,p.z+n.z*.12,edge,frame.yaw);
   atlas.add(root,'设备间','仅工作人员',1.6,.5,p.x+n.x*.23,ACCESS_BASE+2.38,p.z+n.z*.23,frame.yaw,{bg:'#566469'});
  }else if(frame.index%4===2){
   atlas.add(root,'ARENA PLAN','EINGÄNGE  ·  WC  ·  SERVICE',2.2,1.45,p.x+n.x*.18,ACCESS_BASE+2.0,p.z+n.z*.18,frame.yaw,{bg:'#e5e3d9',fg:'#263b46',style:'map'});
   const x=p.x+2.5*n.z+n.x*.55,z=p.z-2.5*n.x+n.z*.55;bNewMachine(x,z,frame);
  }else atlas.add(root,'AUSGANG →','EXIT  ·  ESPLANADE',2.6,.65,p.x+n.x*.18,ACCESS_BASE+3.0,p.z+n.z*.18,frame.yaw,{bg:'#326c55',accent:'#a4d8af'});
  if(frame.index%4===1){
   const x=p.x+n.x*2.3,z=p.z+n.z*2.3;
   batch.add(3,.14,.72,x,ACCESS_BASE+.55,z,wood,frame.yaw);batch.add(3,.6,.12,x-n.x*.3,ACCESS_BASE+.88,z-n.z*.3,wood,frame.yaw);
   for(const side of[-1,1])batch.add(.12,.5,.58,x+side*1.15*n.z,ACCESS_BASE+.25,z-side*1.15*n.x,metal,frame.yaw);
   colliders.push(orientedCollider(x,z,3,.9,ACCESS_BASE,ACCESS_BASE+1.2,frame.yaw));
   const bx=x+2.35*n.z,bz=z-2.35*n.x;batch.add(.65,1,.65,bx,ACCESS_BASE+.5,bz,edge,frame.yaw);
   atlas.add(root,'RECYCLE','PAPIER / REST',.52,.48,bx+n.x*.34,ACCESS_BASE+.65,bz+n.z*.34,frame.yaw,{bg:'#3f6960'});
   colliders.push(orientedCollider(bx,bz,.65,.65,ACCESS_BASE,ACCESS_BASE+1,frame.yaw));
  }
 }

 function bNewMachine(x,z,frame){const n=frame.normal;batch.add(1.15,2.15,.7,x,ACCESS_BASE+1.075,z,edge,frame.yaw);batch.add(.8,.7,.025,x+n.x*.36,ACCESS_BASE+1.5,z+n.z*.36,dark,frame.yaw);atlas.add(root,'TICKETS','KARTEN / INFO',.75,.6,x+n.x*.38,ACCESS_BASE+1.5,z+n.z*.38,frame.yaw,{bg:'#244f6a',accent:'#8dc8d9'});batch.add(.55,.045,.055,x+n.x*.37,ACCESS_BASE+.72,z+n.z*.37,metal,frame.yaw);colliders.push(orientedCollider(x,z,1.15,.7,ACCESS_BASE,ACCESS_BASE+2.15,frame.yaw));}

 for(const stair of accessStairs){
  const width=stair.width,depth=stair.run/stair.steps;
  const world=(x,z)=>({x:stair.x+stair.nz*x+stair.nx*z,z:stair.z-stair.nx*x+stair.nz*z});
  for(let r=0;r<stair.steps;r++){
   const p=world(0,-(r+.5)*depth),h=(r+1)*stair.rise;
   batch.add(width,.24,depth+.012,p.x,ACCESS_BASE+h-.12,p.z,column,stair.yaw);
   batch.add(width-.12,.018,.045,p.x-stair.nx*(depth*.43),ACCESS_BASE+h+.012,p.z-stair.nz*(depth*.43),pale,stair.yaw);
   if(r%6===0)for(const side of[-1,1]){const q=world(side*(width/2-.08),-(r+.5)*depth);batch.add(.055,1.08,.055,q.x,ACCESS_BASE+h+.54,q.z,metal);}
  }
  for(const side of[-1,1]){
   const a=world(side*(width/2-.08),-.1),b=world(side*(width/2-.08),-stair.run);
   beam(root,v(a.x,ACCESS_BASE+1.08,a.z),v(b.x,ACCESS_TOP+1.08,b.z),.045,metal,8);
   for(let r=0;r<stair.steps;r+=4){const p=world(side*(width/2-.08),-(r+2)*depth),h=ACCESS_BASE+r*stair.rise;colliders.push(orientedCollider(p.x,p.z,.12,depth*4,h,h+1.6,stair.yaw));}
  }
  const slab=[];
  function quad(a,b,c,d){for(const p of[a,b,c,a,c,d])slab.push(p.x,p.y,p.z);}
  const corner=(side,a,below)=>{const p=world(side*width/2,-a);return{x:p.x,y:ACCESS_BASE+a/stair.run*(ACCESS_TOP-ACCESS_BASE)-below,z:p.z};};
  const a=corner(-1,0,.23),b=corner(1,0,.23),c=corner(1,stair.run,.23),d=corner(-1,stair.run,.23),aa=corner(-1,0,.55),bb=corner(1,0,.55),cc=corner(1,stair.run,.55),dd=corner(-1,stair.run,.55);
  quad(a,b,c,d);quad(aa,dd,cc,bb);quad(a,d,dd,aa);quad(b,bb,cc,c);quad(d,c,cc,dd);
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(slab,3));sg.computeVertexNormals();stairSlabs.push(sg);
  for(const fraction of[.32,.65,.94]){const p=world(0,-stair.run*fraction),h=(ACCESS_TOP-ACCESS_BASE)*fraction-.56;for(const side of[-1,1]){const q=world(side*(width/2-.35),-stair.run*fraction);batch.add(.42,h,.42,q.x,ACCESS_BASE+h/2,q.z,column);colliders.push(orientedCollider(q.x,q.z,.42,.42,ACCESS_BASE,ACCESS_BASE+h));}batch.add(width,.35,.5,p.x,ACCESS_BASE+h-.15,p.z,column,stair.yaw);}
  const landing=world(0,-stair.run-1.0);batch.add(width,.2,2.4,landing.x,ACCESS_TOP-.1,landing.z,column,stair.yaw);
  const pole=world(-width/2-1.05,.6);batch.add(.28,5.0,.28,pole.x,ACCESS_BASE+2.5,pole.z,metal);
  atlas.add(root,stair.id,'TRIBÜNE ↑',1.55,2.25,pole.x+stair.nx*.18,ACCESS_BASE+3.6,pole.z+stair.nz*.18,stair.yaw,{bg:'#a81732'});
  const approach=world(0,3.5);atlas.add(root,'↑ '+stair.id,'TRIBÜNE',2.1,1.4,approach.x,ACCESS_BASE+.035,approach.z,stair.yaw,{bg:'#666f6c',tilt:-Math.PI/2});
  const entry=world(0,-stair.run*.64),h=ACCESS_BASE+(ACCESS_TOP-ACCESS_BASE)*.64;
  for(const side of[-1,1]){const p=world(side*(width/2+.32),-stair.run*.64);batch.add(.34,4.3,.44,p.x,h+2.15,p.z,metal,stair.yaw);}
  batch.add(width+.95,.42,.48,entry.x,h+4.1,entry.z,metal,stair.yaw);
  atlas.add(root,'ZUGANG '+stair.id,'BLOCK 201–248',width+.4,.65,entry.x+stair.nx*.28,h+3.95,entry.z+stair.nz*.28,stair.yaw,{bg:'#a81732'});
  const light=new THREE.PointLight(0xffe4bb,0,33,1.8);light.position.set(stair.topX+stair.nx*3,3.8,stair.topZ+stair.nz*3);root.add(light);lamps.push(light);
 }
 mesh(mergeGeometry(stairSlabs),mat(0x9b9e99,{roughness:.87,side:THREE.DoubleSide}),root).name='Sloped reinforced concrete stair soffits';

 // Arrival information islands sit on the sides, not in the central entrance lane.
 finishedBox(root,12,2.9,.16,0,ACCESS_BASE+2.55,104.3,pale,.035);batch.add(12.05,.055,.18,0,ACCESS_BASE+1.05,104.3,red);
 addCrest(root,2.25,-4.1,ACCESS_BASE+2.55,104.415);
 atlas.add(root,'ALLIANZ ARENA','WILLKOMMEN · MIA SAN MIA',7.4,1.25,1.4,ACCESS_BASE+2.55,104.415,0,{bg:'#e1e0d5',fg:'#30373a',accent:'#e1e0d5'});
 atlas.add(root,'接待大厅','导览与咨询 · INFORMATION',5,1.8,0,ACCESS_BASE+.035,112,0,{bg:'#626361',tilt:-Math.PI/2});
 for(const x of[-8,8]){

  atlas.add(root,x<0?'参观咨询':'接待中心','公共楼梯 / 草坪参观',4.35,.65,x,ACCESS_BASE+.57,108.08,0,{bg:'#aa1833'});

  colliders.push(orientedCollider(x,107.5,4.8,1.3,ACCESS_BASE,ACCESS_BASE+1.3));
 }
 // A real, lit opening leads under the lower seating tier and onto the pitch.
 const visit=visitorPassage,clear=visit.width,wallDepth=visit.backZ-visit.rampZ;
 batch.add(clear,.16,wallDepth,visit.x,ACCESS_BASE-.08,(visit.backZ+visit.rampZ)/2,floor);
 roofBatch.add(clear+.35,.16,wallDepth,visit.x,visit.head-.08,(visit.backZ+visit.rampZ)/2,pale);
 for(const side of[-1,1]){
  const x=visit.x+side*(clear/2+.1);batch.add(.2,visit.head-ACCESS_BASE,wallDepth,x,(visit.head+ACCESS_BASE)/2,(visit.backZ+visit.rampZ)/2,wall);
  batch.add(.08,.12,wallDepth,x-side*.13,ACCESS_BASE+.28,(visit.backZ+visit.rampZ)/2,red);
  batch.add(.36,4.5,.75,visit.x+side*(clear/2+.12),ACCESS_BASE+2.25,visit.entryZ+.15,red);
  colliders.push(orientedCollider(x,(visit.backZ+visit.rampZ)/2,.24,wallDepth,ACCESS_BASE,visit.head));
  for(let i=0;i<5;i++){const z=99-i*6.7;batch.add(.07,1.9,3.8,x-side*.13,ACCESS_BASE+1.55,z,red);atlas.add(root,i%2?'MIA SAN MIA':'FC BAYERN','球场参观 →',3.4,.75,x-side*.18,ACCESS_BASE+1.6,z,side<0?Math.PI/2:-Math.PI/2,{bg:'#b41b36'});}
 }
 batch.add(clear+.65,.85,.78,visit.x,ACCESS_BASE+4.05,visit.entryZ+.15,red);
 atlas.add(root,'球场参观入口','草坪 · 看台 · 球员通道',clear+.1,.73,visit.x,ACCESS_BASE+4.05,visit.entryZ+.56,0,{bg:'#b41b36'});
 atlas.add(root,'↑ 向前进入球场','VISITOR PASSAGE · PITCH',clear-.6,.62,visit.x,ACCESS_BASE+2.85,98,0,{bg:'#9b6c20'});
 atlas.add(root,'返回接待大厅 ↑','LOBBY · SOUTH ENTRANCE',clear-.4,.62,visit.x,ACCESS_BASE+2.8,102.8,Math.PI,{bg:'#366b58'});
 for(let i=0;i<7;i++){const z=102-i*5.3;roofBatch.add(.16,.035,3.3,visit.x-2.65,visit.head-.19,z,glow);roofBatch.add(.16,.035,3.3,visit.x+2.65,visit.head-.19,z,glow);}
 const passageLights=[];for(const z of[99,85,71]){const light=new THREE.PointLight(0xffe9d2,32,17,1.7);light.position.set(visit.x,visit.head-.35,z);root.add(light);passageLights.push(light);}
 for(let i=0;i<visit.steps;i++){
  const d=(visit.rampZ-visit.exitZ)/visit.steps,y=ACCESS_BASE+(i+1)*(-ACCESS_BASE)/visit.steps,z=visit.rampZ-(i+.5)*d;
  batch.add(clear,.23,d+.015,visit.x,y-.115,z,column);batch.add(clear-.12,.015,.04,visit.x,y+.013,z-d*.43,pale);
  for(const side of[-1,1]){batch.add(.18,1.08,d+.02,visit.x+side*(clear/2+.12),y+.54,z,wall);if(i%4===0)batch.add(.04,.98,.04,visit.x+side*(clear/2-.08),y+.49,z,metal);}
 }
 for(const side of[-1,1]){beam(root,v(visit.x+side*(clear/2-.08),ACCESS_BASE+1.05,visit.rampZ),v(visit.x+side*(clear/2-.08),1.05,visit.exitZ),.035,metal);colliders.push(orientedCollider(visit.x+side*(clear/2+.1),(visit.rampZ+visit.exitZ)/2,.18,visit.rampZ-visit.exitZ,ACCESS_BASE,1.1));}
 atlas.add(root,'草坪与看台 ↑','前方出通道后即可进入球场',clear-.6,.62,visit.x,ACCESS_BASE+2.75,68.4,0,{bg:'#9b6c20'});
 finishReception(root,batch,atlas,{floorY:ACCESS_BASE,pale,red,metal,dark});colliders.push(orientedCollider(4,110,.74,.62,ACCESS_BASE,ACCESS_BASE+1.8));
 atlas.add(root,'↑ 室内公共楼梯','公共大厅 · 商店 · 展厅 · 包厢 · 看台',6.4,.9,95.8,.8,10,0,{bg:'#996e24'});
 batch.flush();roofBatch.flush();atlas.finish(root);compactStaticMeshes(root,[roof]);compactStaticMeshes(roof);

 function decorateConcourse(g){
  const b=new Batches(g);
  for(const [a,bb]of[[85,103],[105,122]])for(const frame of perimeterFrames(a,bb,256)){if(publicWallOpening(frame.x,frame.z))continue;colliders.push(orientedCollider(frame.x,frame.z,frame.spacing+.12,.18,12.2,16.8,frame.yaw));}
  mesh(ringGeometry(85.2,103.2,85.5,103.5,12.24),red,g);
  mesh(ringGeometry(91,109,91.3,109.3,12.235),edge,g);
  for(const frame of perimeterFrames(92,110,48)){
   const n=frame.normal;
   b.add(frame.spacing+.05,.07,.07,frame.x-n.x*5,16.35,frame.z-n.z*5,red,frame.yaw);
   b.add(4.8,.18,.45,frame.x,16.55,frame.z,metal,frame.yaw);
   b.add(.09,.09,6.5,frame.x+n.x*2,16.42,frame.z+n.z*2,metal,frame.yaw);
   if(frame.index%2===0)b.add(.045,.008,14,frame.x,12.215,frame.z,edge,frame.yaw);
  }
  for(let i=0;i<32;i++){
   const t=(i+.5)/32*TAU,p=perimeterPoint(100,116,t),n=perimeterNormal(100,116,t),yaw=Math.atan2(n.x,n.z)+Math.PI,cp=perimeterPoint(89,107,t);
   atlas.add(g,['FAN-SHOP','PAULANER','ARENA BISTRO','BREZN · SNACKS'][i%4],'',5.7,.48,p.x-n.x*1.26,15.3,p.z-n.z*1.26,yaw,{bg:'#af1934'});
   atlas.add(g,'GETRÄNKE · SPEISEN','',3,.6,p.x+n.x*1.14,14.45,p.z+n.z*1.14,yaw,{bg:'#26343e'});
   atlas.add(g,i%3===0?'WC →':i%3===1?'BLOCK '+(201+i)+' →':'AUSGANG ↓','',4.4,.6,cp.x,15.6,cp.z,yaw,{bg:i%3===2?'#286a52':'#414a50'});
  }
  for(const frame of perimeterFrames(85.2,103.2,16)){
   const n=frame.normal,x=frame.x+n.x*.16,z=frame.z+n.z*.16;
   if(roomFootprint(x,z,.45)||(z<-98&&Math.abs(x)<2.5))continue;
   atlas.add(g,'SERVICE','PERSONAL',2.0,.46,x+n.x*.09,14.9,z+n.z*.09,frame.yaw,{bg:'#485e68'});
   const px=x+4.5*n.z,pz=z-4.5*n.x;b.add(2.6,2.1,.08,px,14.1,pz,red,frame.yaw);
   atlas.add(g,frame.index%2?'MIA SAN MIA':'ALLIANZ ARENA',frame.index%2?'FC BAYERN MÜNCHEN':'WILLKOMMEN IM STADION',2.4,1.9,px+n.x*.06,14.1,pz+n.z*.06,frame.yaw,{bg:'#a91c35',accent:'#f1dfbe'});
  }
  for(const stair of accessStairs){const p=perimeterPoint(85.25,103.25,stair.t);atlas.add(g,'← BLOCK 201–248 →','WC · BISTRO · FAN-SHOP',6.4,.9,p.x+stair.nx*.14,15.65,p.z+stair.nz*.14,stair.yaw,{bg:'#a81732'});}
  for(const frame of perimeterFrames(94,111,32)){
   const i=frame.index,n=frame.normal;
   const x=frame.x-n.x*3.3,z=frame.z-n.z*3.3;
   atlas.add(g,i%2?'SPEISEN':'GETRÄNKE',i%2?'BREZN  ·  BRATWURST':'KAFFEE  ·  WASSER',2.1,1.2,x,14.8,z,frame.yaw+Math.PI,{bg:'#e1ddc8',fg:'#273c44'});
   if(i%4===0){b.add(.7,1.05,.7,x,12.725,z,edge);atlas.add(g,'RECYCLING','PAPIER / REST',.55,.45,x-n.x*.37,13.0,z-n.z*.37,frame.yaw+Math.PI,{bg:'#3a6760'});}
   if(i%4===2){const p=perimeterPoint(87,105,frame.t);b.add(2.5,.14,.7,p.x,12.75,p.z,wood,frame.yaw);for(const side of[-1,1])b.add(.1,.5,.58,p.x+side*.9*n.z,12.45,p.z-side*.9*n.x,metal,frame.yaw);}
  }
  for(const stair of accessStairs)atlas.add(g,stair.id+' · AUSGANG','ESPLANADE ↓',4,.7,stair.topX-stair.nx,15.6,stair.topZ-stair.nz,stair.yaw+Math.PI,{bg:'#356b55'});
  b.flush();atlas.finish(g);
 }
 function update(position,privateEnclosed=false){
  const nearby=position.y<9&&((Math.abs(position.x)/122)**2.8+(Math.abs(position.z)/140)**2.8<1.2);
  root.visible=!privateEnclosed;for(const light of lamps)light.visible=lightingNight&&nearby&&light.position.distanceTo(position)<32;
 }
 return{root,roof,colliders,decorateConcourse,update,night(on){lightingNight=on;glow.color.set(on?0xffe0ad:0xfff3dd);lamps.forEach(l=>l.intensity=on?68:28);},setRoof(on){roof.visible=on;},stats:{entranceBays:66,accessStairs:8,sharedSignTextures:1}};
}
