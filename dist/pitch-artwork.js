import {TAU,seeded} from './kit.js';

// All measurements are in metres. Grain is baked once, rather than animated
// with thousands of canvas operations during play.
export function drawPitchArtwork(c,w,h){
 const random=seeded(902),px=x=>w*(x/72+.5),pz=z=>h*(z/111+.5);
 c.fillStyle='#3f7044';c.fillRect(0,0,w,h);
 for(let i=0;i<20;i++){
  const y=pz(-52.5+i*5.25),height=h*5.25/111,g=c.createLinearGradient(0,y,0,y+height);
  g.addColorStop(0,i%2?'#507e46':'#3c6e3f');g.addColorStop(.46,i%2?'#55854b':'#437744');g.addColorStop(1,i%2?'#507f48':'#3d7041');c.fillStyle=g;c.fillRect(0,y,w,height+.5);
 }
 // The turning strip around the pitch is mown along its edges. Keep it
 // inside the existing turf texture so its junction with the touchline is
 // visible even when the near grass mesh is disabled on phones.
 for(const side of[-1,1]){
  const start=side<0?-36:34.15,end=side<0?-34.15:36;
  const border=c.createLinearGradient(px(start),0,px(end),0);
  border.addColorStop(0,side<0?'#355e3a':'#47754a');border.addColorStop(1,side<0?'#47754a':'#355e3a');
  c.fillStyle=border;c.fillRect(px(start),0,px(end)-px(start),h);
  const back=side<0?-55.5:52.65;
  c.fillStyle='#406c42';c.fillRect(px(-34.15),pz(back),w*68.3/72,h*2.85/111);
 }
 // Slight longitudinal variation breaks the perfectly uniform colour on
 // wide match cameras. The actual measured field lines are painted below.
 for(let x=-33;x<34;x+=2.6){
  const edge=px(x),width=w*1.4/72;
  const roller=c.createLinearGradient(edge,0,edge+width,0);
  roller.addColorStop(0,'rgba(193,205,158,0)');
  roller.addColorStop(.55,'rgba(193,205,158,.045)');
  roller.addColorStop(1,'rgba(193,205,158,0)');
  c.fillStyle=roller;c.fillRect(edge,pz(-52.5),width,h*105/111);
 }
 // Variation in density and irrigation stays visible across wide shots.
 const edges=c.createLinearGradient(0,0,w,0);
 edges.addColorStop(0,'rgba(25,52,34,.20)');edges.addColorStop(.18,'rgba(25,52,34,0)');
 edges.addColorStop(.83,'rgba(25,52,34,0)');edges.addColorStop(1,'rgba(25,52,34,.16)');
 c.fillStyle=edges;c.fillRect(0,0,w,h);
 for(let i=0;i<116;i++){
  const x=random()*w,y=random()*h,r=w*(.022+random()*.082),g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,i%3?'rgba(21,52,28,.080)':'rgba(190,179,103,.078)');g.addColorStop(1,'rgba(50,70,30,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }
 // The goal mouths have a little wear, without looking like a bare dirt field.
 for(const sign of[-1,1])for(let i=0;i<230;i++){
  const x=(random()-.5)*11,z=sign*(46+random()*7),r=.025+random()*.14;c.fillStyle=i%3?'#9a88592d':'#304d2c3c';c.beginPath();c.ellipse(px(x),pz(z),r/72*w,r*.45/111*h,random()*TAU,0,TAU);c.fill();
 }
 // Irregular grass density and a few divots remain visible between the fine
 // fibres. These are baked once, with no extra geometry or render passes.
 for(let i=0;i<3500;i++){
  const x=px((random()-.5)*67),z=pz((random()-.5)*104),r=.035+random()*.13;
  c.fillStyle=i%5?'rgba(21,58,25,.063)':'rgba(146,151,78,.08)';c.beginPath();c.ellipse(x,z,w*r/72,h*r*.35/111,random()*TAU,0,TAU);c.fill();
 }
 c.strokeStyle='#e8eddd';c.fillStyle='#edf0e2';c.lineWidth=w/72*.115;c.lineJoin='round';
 const line=(x,z,xx,zz)=>{c.beginPath();c.moveTo(px(x),pz(z));c.lineTo(px(xx),pz(zz));c.stroke();},rect=(x,z,ww,hh)=>c.strokeRect(px(x),pz(z),ww/72*w,hh/111*h),ellipse=(x,z,r,a=0,b=TAU)=>{c.beginPath();c.ellipse(px(x),pz(z),r/72*w,r/111*h,0,a,b);c.stroke();},spot=(x,z)=>{c.beginPath();c.ellipse(px(x),pz(z),.12/72*w,.12/111*h,0,0,TAU);c.fill();};
 rect(-34,-52.5,68,105);line(-34,0,34,0);ellipse(0,0,9.15);spot(0,0);
 for(const s of[-1,1]){rect(-20.16,s<0?-52.5:36,40.32,16.5);rect(-9.16,s<0?-52.5:47,18.32,5.5);spot(0,s*41.5);const a=Math.acos(5.5/9.15);ellipse(0,s*41.5,9.15,s<0?Math.PI/2-a:-Math.PI/2-a,s<0?Math.PI/2+a:-Math.PI/2+a);}
 for(const x of[-34,34])for(const z of[-52.5,52.5]){const a=x>0?(z>0?Math.PI:Math.PI/2):(z>0?-Math.PI/2:0);ellipse(x,z,1,a,a+Math.PI/2);}
 // Paint lies across individual blades. Let the same fine grain show through
 // the chalk and the grass, instead of ending abruptly at a solid white line.
 for(const tint of ['#c4ce9b14','#203c2b1c']){
  c.fillStyle=tint;
  for(let i=0;i<23500;i++)c.fillRect(random()*w,random()*h,random()*.72+.3,random()*2.5+.5);
 }
}

export function drawApronArtwork(c,w,h){
 const random=seeded(718);c.fillStyle='#293d38';c.fillRect(0,0,w,h);
 for(let i=0;i<42000;i++){const tone=random()>.5?'rgba(154,169,153,.09)':'rgba(5,15,17,.12)';c.fillStyle=tone;c.fillRect(random()*w,random()*h,.4+random()*.9,.4+random()*.9);}
}
