import {THREE} from './kit.js';

const clamp=value=>Math.max(0,Math.min(1,value));
function smooth(a,b,value){const t=clamp((value-a)/(b-a));return t*t*(3-2*t);}

function garmentPosition(part,x,y,z,out){
 const side=Math.abs(x);
 if(part==='shorts'){
  // Draw in the free outside edge of each leg. Leave the waist and crotch
  // undisturbed so the skinned waist closure keeps its original rim.
  const hem=(1-smooth(.735,.925,y))*smooth(.15,.23,side);
  return out.set(x-Math.sign(x)*.023*hem,y+.007*hem,z);
 }
 // Let the shirt sit away from the abdomen above the tuck, with two shallow
 // diagonal folds on the flanks. The chest, collar and armholes stay fitted.
 const sidePanel=smooth(.07,.15,side)*(1-smooth(.20,.25,side));
 const gather=smooth(1.025,1.085,y)*(1-smooth(1.22,1.32,y));
 const folds=Math.cos((y-1.085)*67+side*15)*.0033;
 const ease=sidePanel*gather;
 return out.set(x+Math.sign(x)*ease*(.009+folds),y,z+(z-.03)*ease*(.07+folds*9));
}

export function fitFootballKit(parts){
 const p=new THREE.Vector3(),q=new THREE.Vector3(),n=new THREE.Vector3();
 const tangent=new THREE.Vector3(),bitangent=new THREE.Vector3(),du=new THREE.Vector3(),dv=new THREE.Vector3();
 const epsilon=.00025;
 for(const part of ['shirt','shorts','socks']){
  const geometry=parts[part],{position,normal,uv}=geometry.attributes;
  for(let i=0;i<position.count;i++){
   p.fromBufferAttribute(position,i);
   if(part==='shorts'||part==='socks'){
    // Project the outer-leg panel across each side, and align the cuff and
    // waistband with actual height instead of the wrapped source texture.
    let outer=(Math.abs(p.x)-.141)/.11;
    if(part==='shorts'){
     const thigh=1-Math.atan2(Math.abs(p.z-.027),Math.abs(p.x)-.108)/Math.PI;
     const hip=smooth(.85,.975,p.y);
     outer=thigh*(1-hip)+Math.abs(p.x)/.225*hip;
    }
    const height=part==='shorts'?(p.y-.715)/.35:(p.y-.075)/.405;
    uv.setXY(i,.01+.98*clamp(outer),.01+.98*clamp(height));
   }
   if(part==='socks')continue;
   garmentPosition(part,p.x,p.y,p.z,q);
   if(p.equals(q))continue;
   n.fromBufferAttribute(normal,i);
   tangent.set(n.z,0,-n.x);
   if(tangent.lengthSq()<1e-8)tangent.set(1,0,0);
   tangent.normalize().multiplyScalar(epsilon);
   bitangent.crossVectors(n,tangent);
   garmentPosition(part,p.x+tangent.x,p.y+tangent.y,p.z+tangent.z,du).sub(q);
   garmentPosition(part,p.x+bitangent.x,p.y+bitangent.y,p.z+bitangent.z,dv).sub(q);
   n.crossVectors(du,dv).normalize();
   position.setXYZ(i,q.x,q.y,q.z);
   normal.setXYZ(i,n.x,n.y,n.z);
  }
 }
}

export function drawKitLegPanel(c,cell,part,colors){
 c.translate(cell[0],cell[1]);c.scale(cell[2],cell[3]);
 if(part==='shorts'){
  const panel=c.createLinearGradient(0,0,1,0);
  panel.addColorStop(0,'rgba(21,20,21,.16)');
  panel.addColorStop(.53,'rgba(255,255,255,.045)');
  panel.addColorStop(.78,'rgba(22,19,20,.03)');
  panel.addColorStop(.87,'rgba(18,15,19,.22)');
  panel.addColorStop(1,'rgba(23,20,21,.32)');
  c.fillStyle=panel;c.fillRect(0,0,1,1);
  c.fillStyle='rgba(16,13,15,.26)';c.fillRect(0,0,1,.115);
  c.fillStyle='rgba(255,255,255,.20)';c.fillRect(0,.115,1,.010);
  c.strokeStyle=colors.ink;c.globalAlpha=.54;c.lineWidth=.024;
  c.beginPath();c.moveTo(.80,.13);c.bezierCurveTo(.91,.38,.92,.55,.96,.97);c.stroke();
  c.globalAlpha=1;c.fillStyle='rgba(23,18,20,.26)';c.fillRect(0,.942,1,.015);
  c.fillStyle='rgba(255,255,255,.21)';c.fillRect(0,.958,1,.009);
 }else{
  const shin=c.createLinearGradient(0,0,1,0);
  shin.addColorStop(0,'rgba(42,40,37,.11)');shin.addColorStop(.52,'rgba(245,243,235,.07)');shin.addColorStop(1,'rgba(38,37,35,.11)');
  c.fillStyle=shin;c.fillRect(0,0,1,1);
  c.fillStyle='rgba(45,39,36,.10)';c.fillRect(0,0,1,.15);
  c.fillStyle=colors.shirt;
  c.fillRect(0,.042,1,.033);c.fillRect(0,.094,1,.018);
  c.fillStyle='rgba(52,47,43,.12)';
  for(let y=.71;y<.90;y+=.046)c.fillRect(0,y,1,.009);
 }
}
