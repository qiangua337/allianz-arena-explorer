// Kane's neutral face follows the Bundesliga portrait and FC Bayern's
// three-quarter interview. Coordinates refer to the shared rig in metres.
function smoothstep(lo,hi,value){
 const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));
 return t*t*(3-2*t);
}

function gaussian(center,radius,value){
 const d=(value-center)/radius;
 return Math.exp(-d*d);
}

export function kaneSculpt(x,y,z,target){
 if(y<=1.60)return target.set(x,y,z);
 const side=Math.abs(x);
 const aboveNeck=smoothstep(1.60,1.652,y);
 const face=smoothstep(.076,.140,z);
 const lowerFace=smoothstep(.084,.154,z);
 const jaw=gaussian(1.653,.025,y);
 const cheek=gaussian(1.715,.025,y)*gaussian(.056,.023,side);
 const chin=gaussian(1.641,.014,y)*gaussian(0,.029,x)*lowerFace;
 const jawCorner=jaw*gaussian(.051,.025,side)*smoothstep(.071,.127,z);

 // Keep the bridge high in profile and let the tip turn down gently.
 const bridge=gaussian(1.727,.022,y)*gaussian(0,.015,x)*smoothstep(.141,.176,z);
 const noseTip=gaussian(1.703,.013,y)*gaussian(0,.018,x)*smoothstep(.151,.183,z);
 const noseWing=gaussian(1.704,.010,y)*gaussian(.015,.010,side)*face;

 const lid=gaussian(1.744,.014,y)*gaussian(.033,.020,side)*face;
 const eyeFold=gaussian(1.747,.006,y)*gaussian(.040,.017,side)*face;
 const brow=gaussian(1.759,.011,y)*gaussian(.036,.023,side)*face;
 const innerBrow=gaussian(1.755,.009,y)*gaussian(.021,.012,side)*face;
 const mouth=gaussian(1.674,.015,y)*gaussian(0,.032,x)*lowerFace;
 const mouthCorner=gaussian(1.675,.009,y)*gaussian(.025,.012,side)*lowerFace;
 const temple=gaussian(1.788,.035,y)*gaussian(.066,.021,side)*face;

 const middleFace=gaussian(1.689,.032,y)*gaussian(0,.049,x)*lowerFace;
 const width=1+.08*jawCorner+.09*cheek*face-.08*temple-.085*noseWing;
 const eyeCenter=1.744+.024*(side-.033);
 return target.set(
  x*(1+aboveNeck*(width-1))-.09*aboveNeck*(side-.033)*Math.sign(x)*lid,
  y+aboveNeck*(-.007*chin+.0018*jawCorner+.004*noseTip-.08*(y-eyeCenter)*lid
   -.0026*brow+.0032*innerBrow+.0014*mouthCorner+.011*middleFace),
  z+aboveNeck*(.006*bridge-.0065*noseTip+.0042*cheek*face+.0033*chin-.0017*mouth
   +.0014*jawCorner-.0014*eyeFold+.0017*brow)
 );
}

export function kaneHairline(x,z){
 const side=Math.abs(x);
 const front=smoothstep(.077,.151,z);
 const back=1-smoothstep(-.013,.041,z);
 const temple=gaussian(.057,.020,side);
 const part=gaussian(-.009,.013,x);
 const aboveEar=gaussian(.051,.022,z)*gaussian(.081,.021,side);
 const sideburn=gaussian(.095,.025,z)*gaussian(.074,.016,side);
 return 1.745+front*(.064+.015*temple-.006*part+.003*Math.sin(x*53))
  -.037*back+.012*aboveEar-.012*sideburn;
}

export function kaneHairOffset(x,y,z,nx,ny,nz,root,front,volume){
 const sweep=smoothstep(1.78,1.845,y)*gaussian(-.019,.047,x);
 const forward=smoothstep(.082,.143,z);
 const clumps=.0013*Math.cos(x*258+z*112)+.0007*Math.sin(x*417-z*87);
 const thickness=.0009+root*(.004+volume*.007+sweep*forward*.006+clumps);
 return [x+nx*thickness-.006*sweep*root,y+ny*thickness,z+nz*thickness-.004*sweep*front];
}

export function paintKaneHair(c){
 const color=c.createLinearGradient(0,0,0,1);
 color.addColorStop(0,'#81715a');
 color.addColorStop(.42,'#6b5b49');
 color.addColorStop(.76,'#5c4e40');
 color.addColorStop(.87,'rgba(101,80,64,.88)');
 color.addColorStop(.95,'rgba(110,91,75,.42)');
 color.addColorStop(1,'rgba(113,96,81,0)');
 c.fillStyle=color;
 c.fillRect(0,0,1,1);
 c.globalCompositeOperation='source-atop';

 // Small, uneven locks bend back away from the part. Shorter marks meet
 // the roots in the lower strip, where the cropped sides catch less light.
 for(let i=0;i<111;i++){
  const x=(i+.43*Math.sin(i*2.61))/104-.039;
  const lean=x<.45?-.09:.095;
  const arc=.023*Math.sin(i*1.59);
  c.lineWidth=.0013+.0018*(.5+.5*Math.cos(i*2.17));
  c.strokeStyle=i%5===0?'rgba(191,172,138,.21)':
   i%3===0?'rgba(166,151,124,.17)':'rgba(43,35,27,.16)';
  c.beginPath();
  c.moveTo(x,.965-.045*Math.sin(i*1.7)**2);
  c.bezierCurveTo(x+arc,.74,x+lean*.6+arc,.33,x+lean,.025+.12*Math.sin(i*2.1)**2);
  c.stroke();
 }
 c.globalCompositeOperation='source-over';
 c.lineWidth=.0028;
 for(let i=0;i<117;i++){
  const x=(i+.48*Math.sin(i*3.4))/117;
  const y=.88+.115*(.5+.5*Math.cos(i*5.71));
  c.strokeStyle=i%4===0?'rgba(143,116,91,.62)':'rgba(86,69,55,.55)';
  c.beginPath();
  c.moveTo(x,y);
  c.quadraticCurveTo(x+.009,y-.011,x+.015,y-.045);
  c.stroke();
 }
}

export function paintKaneEyes(c,[x,y,w,h]){
 c.save();
 c.translate(x,y);
 c.scale(w,h);
 for(const [u,v] of [[.707,.299],[.287,.710]]){
  const iris=c.createRadialGradient(u,v,.025,u,v,.114);
  iris.addColorStop(0,'#564b3e');
  iris.addColorStop(.32,'#66695f');
  iris.addColorStop(.62,'#5f716f');
  iris.addColorStop(.85,'#526261');
  iris.addColorStop(.95,'#354346');
  iris.addColorStop(1,'rgba(69,83,84,0)');
  c.fillStyle=iris;
  c.beginPath();c.arc(u,v,.114,0,Math.PI*2);c.fill();

  c.lineWidth=.003;
  for(let i=0;i<24;i++){
   const angle=i*Math.PI/12+.11*Math.sin(i*2.9);
   const dx=Math.cos(angle),dy=Math.sin(angle);
   c.strokeStyle=i%3===0?'rgba(200,206,187,.24)':'rgba(55,72,76,.30)';
   c.beginPath();c.moveTo(u+dx*.041,v+dy*.041);c.lineTo(u+dx*.098,v+dy*.098);c.stroke();
  }
  c.fillStyle='#19201f';
  c.beginPath();c.arc(u,v,.044,0,Math.PI*2);c.fill();
 }
 c.restore();
}
