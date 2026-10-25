import {THREE} from './kit.js';
import {clothWeave} from './upholstery.js';
export function hangingJerseyGeometry(){
 const g=new THREE.PlaneGeometry(.8,.9,18,24),p=g.attributes.position;g.setAttribute('uv2',g.attributes.uv.clone());
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),tension=.45+.55*(.45-y)/.9;p.setZ(i,tension*(.018*Math.sin(x*29+y*3)+.008*Math.sin(x*57-y*9))+.012*(x*x/.16));}g.computeVertexNormals();return g;
}
export function jerseyBumpTexture(){const map=clothWeave().clone();map.channel=2;map.repeat.set(4,4);map.colorSpace=THREE.NoColorSpace;return map;}
export function drawJerseySeams(c,guest){
 c.save();c.strokeStyle=guest?'#64364650':'#f1d6d04a';c.lineWidth=1.7;c.setLineDash([3,3]);
 for(const side of[-1,1]){c.beginPath();c.moveTo(256+side*121,125);c.bezierCurveTo(256+side*123,250,256+side*107,440,256+side*124,570);c.stroke();c.beginPath();c.moveTo(256+side*165,86);c.lineTo(256+side*205,173);c.stroke();}
 c.beginPath();c.moveTo(130,581);c.quadraticCurveTo(256,607,382,581);c.stroke();c.restore();
}
