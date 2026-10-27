import {TAU,seeded} from './kit.js';

// All measurements are in metres. Grain is baked once, rather than animated
// with thousands of canvas operations during play.
export function drawPitchArtwork(c,w,h){
 const random=seeded(902),px=x=>w*(x/72+.5),pz=z=>h*(z/111+.5);
 c.fillStyle='#3f6937';c.fillRect(0,0,w,h);
 for(let i=0;i<20;i++){c.fillStyle=i%2?'#49733d':'#416b38';c.fillRect(0,i*h/20,w,h/20);}
 for(let i=0;i<140;i++){
  const x=random()*w,y=random()*h,r=18+random()*95,g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,i%3?'rgba(17,50,19,.045)':'rgba(162,155,77,.04)');g.addColorStop(1,'rgba(50,70,30,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }
 // The goal mouths have a little wear, without looking like a bare dirt field.
 for(const sign of[-1,1])for(let i=0;i<230;i++){
  const x=(random()-.5)*11,z=sign*(46+random()*7),r=.025+random()*.14;c.fillStyle=i%3?'#a08e573b':'#304d2c55';c.beginPath();c.ellipse(px(x),pz(z),r/72*w,r*.45/111*h,random()*TAU,0,TAU);c.fill();
 }
 for(let i=0;i<185000;i++){c.fillStyle=random()>.5?'#b5c98b17':'#173b241c';c.fillRect(random()*w,random()*h,random()*.7+.3,random()*2.2+.5);}
 c.strokeStyle='#e8eddd';c.fillStyle='#edf0e2';c.lineWidth=w/72*.115;c.lineJoin='round';
 const line=(x,z,xx,zz)=>{c.beginPath();c.moveTo(px(x),pz(z));c.lineTo(px(xx),pz(zz));c.stroke();},rect=(x,z,ww,hh)=>c.strokeRect(px(x),pz(z),ww/72*w,hh/111*h),ellipse=(x,z,r,a=0,b=TAU)=>{c.beginPath();c.ellipse(px(x),pz(z),r/72*w,r/111*h,0,a,b);c.stroke();},spot=(x,z)=>{c.beginPath();c.ellipse(px(x),pz(z),.12/72*w,.12/111*h,0,0,TAU);c.fill();};
 rect(-34,-52.5,68,105);line(-34,0,34,0);ellipse(0,0,9.15);spot(0,0);
 for(const s of[-1,1]){rect(-20.16,s<0?-52.5:36,40.32,16.5);rect(-9.16,s<0?-52.5:47,18.32,5.5);spot(0,s*41.5);const a=Math.acos(5.5/9.15);ellipse(0,s*41.5,9.15,s<0?Math.PI/2-a:-Math.PI/2-a,s<0?Math.PI/2+a:-Math.PI/2+a);}
 for(const x of[-34,34])for(const z of[-52.5,52.5]){const a=x>0?(z>0?Math.PI:Math.PI/2):(z>0?-Math.PI/2:0);ellipse(x,z,1,a,a+Math.PI/2);}
}

// A restrained directional sheen reads the mowing direction from the view.
// This preserves the existing PBR maps and never adds a render pass.
export function installMowingSheen(material){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);
  shader.vertexShader='varying vec3 vTurfPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvTurfPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 vTurfPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 turfView=normalize(cameraPosition.xz-vTurfPosition.xz+vec2(.0001));
float turfDirection=sin((vTurfPosition.z+55.5)*3.14159265/5.55);
float turfSheen=.98+.045*turfDirection*turfView.y;
diffuseColor.rgb*=turfSheen;`);
 };material.customProgramCacheKey=()=>key+'|mowing-sheen-v4';
}
