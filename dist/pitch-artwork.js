import {TAU,seeded} from './kit.js';

// All measurements are in metres. Grain is baked once, rather than animated
// with thousands of canvas operations during play.
export function drawPitchArtwork(c,w,h){
 const random=seeded(902),px=x=>w*(x/72+.5),pz=z=>h*(z/111+.5);
 c.fillStyle='#426c39';c.fillRect(0,0,w,h);
 for(let i=0;i<20;i++){
  const y=pz(-52.5+i*5.25),height=h*5.25/111,g=c.createLinearGradient(0,y,0,y+height);
  g.addColorStop(0,i%2?'#48733e':'#426e3a');g.addColorStop(.35,i%2?'#4d793f':'#46713c');g.addColorStop(1,i%2?'#4a743e':'#426b39');c.fillStyle=g;c.fillRect(0,y,w,height+.5);
 }
 // Variation in density and irrigation stays visible across wide shots.
 const edges=c.createLinearGradient(0,0,w,0);
 edges.addColorStop(0,'rgba(25,52,34,.20)');edges.addColorStop(.18,'rgba(25,52,34,0)');
 edges.addColorStop(.83,'rgba(25,52,34,0)');edges.addColorStop(1,'rgba(25,52,34,.16)');
 c.fillStyle=edges;c.fillRect(0,0,w,h);
 for(let i=0;i<116;i++){
  const x=random()*w,y=random()*h,r=34+random()*126,g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,i%3?'rgba(22,48,21,.055)':'rgba(180,164,85,.056)');g.addColorStop(1,'rgba(50,70,30,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
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
