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
 const side=Math.abs(x),sign=Math.sign(x);
 const aboveNeck=smoothstep(1.60,1.652,y);
 const face=smoothstep(.076,.140,z);
 const lowerFace=smoothstep(.084,.154,z);
 const jawAngle=gaussian(1.647,.027,y)*gaussian(.055,.026,side)*smoothstep(.061,.127,z);
 const chin=gaussian(1.638,.017,y)*gaussian(0,.030,x)*lowerFace;
 const lowerCheek=gaussian(1.683,.032,y)*gaussian(.045,.028,side)*face;
 const cheekbone=gaussian(1.718,.024,y)*gaussian(.054,.021,side)*face;
 const temple=gaussian(1.788,.036,y)*gaussian(.062,.022,side)*face;

 const bridge=gaussian(1.727,.022,y)*gaussian(0,.015,x)*smoothstep(.141,.176,z);
 const noseTip=gaussian(1.703,.013,y)*gaussian(0,.018,x)*smoothstep(.151,.183,z);
 const noseWing=gaussian(1.704,.010,y)*gaussian(.015,.010,side)*face;

 // Close the almond-shaped lid opening toward its centre. Fade into the
 // surrounding orbit so the lower lid and eyeball meet from side views.
 const lid=gaussian(1.743,.013,y)*gaussian(.033,.022,side)*face;
 const lidCentre=1.742+.029*(side-.033);
 const upperFold=gaussian(1.748,.006,y)*gaussian(.034,.021,side)*face;
 const browArch=gaussian(1.758,.010,y)*gaussian(.036,.019,side)*face;
 const innerBrow=gaussian(1.755,.009,y)*gaussian(.020,.011,side)*face;

 // The lip seam sits lower at the corners. Flatten the projecting upper
 // lip and shape the cupid's bow independently of the lower lip.
 const mouthSeam=1.670-.09*side;
 const lip=gaussian(1.671,.010,y)*gaussian(0,.032,x)*lowerFace;
 const upperLip=gaussian(1.676,.007,y)*gaussian(0,.023,x)*lowerFace;
 const lowerLip=gaussian(1.663,.006,y)*gaussian(0,.024,x)*lowerFace;
 const mouthCorner=gaussian(1.669,.006,y)*gaussian(.024,.008,side)*lowerFace;
 const philtrum=gaussian(1.685,.010,y)*gaussian(0,.024,x)*lowerFace;
 const midFace=gaussian(1.689,.036,y)*gaussian(0,.050,x)*lowerFace;
 const width=1+.12*jawAngle+.13*chin+.035*cheekbone+.025*lowerCheek-.095*temple-.078*noseWing-.065*lip;

 return target.set(
  x*(1+aboveNeck*(width-1))-.115*aboveNeck*(side-.033)*sign*lid,
  y+aboveNeck*(-.009*chin-.0013*jawAngle+.004*noseTip-.15*(y-lidCentre)*lid
   -.0022*browArch+.0025*innerBrow-.34*(y-mouthSeam)*lip+.0013*mouthCorner+.0073*midFace),
  z+aboveNeck*(.006*bridge-.0065*noseTip+.0025*cheekbone+.0018*lowerCheek+.0055*chin
   +.0013*jawAngle+.0011*upperFold+.0009*browArch-.0045*upperLip-.0018*lowerLip
   +.0013*philtrum-.0009*mouthCorner)
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
