import {THREE,v,mesh,cylinder,mergeGeometry,mat,canvasTexture} from './kit.js';
import {cushionGeometry,pipingGeometry} from './upholstery.js';

// Public venue photography supplies the shapes, not construction measurements.
// A sampled smooth profile avoids hard horizontal kinks in the outer shell.
export function shellProfileSampler(points){
 const curve=new THREE.CatmullRomCurve3(points.map(([r,y])=>v(r,y,0)),false,'centripetal'),samples=Array.from({length:1025},(_,i)=>curve.getPoint(i/1024)),minR=Math.min(...points.map(p=>p[0])),maxR=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 return w=>{const f=THREE.MathUtils.clamp(w,0,1)*1024,i=Math.min(1023,Math.floor(f)),t=f-i;return{r:THREE.MathUtils.clamp(THREE.MathUtils.lerp(samples[i].x,samples[i+1].x,t),minR,maxR),y:THREE.MathUtils.clamp(THREE.MathUtils.lerp(samples[i].y,samples[i+1].y,t),minY,maxY)};};
}
export function installEtfeSurface(material){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if(!gl_FrontFacing){
 diffuseColor.rgb=vec3(.60,.61,.55);
 #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
  diffuseColor.rgb*=mix(vec3(.8),vColor.rgb,.6);
 #endif
}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(!gl_FrontFacing)totalEmissiveRadiance=vec3(0.);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(!gl_FrontFacing)roughnessFactor=.86;');
 };material.customProgramCacheKey=()=>key+'|etfe-neutral-inner-membrane-v1';return material;
}
export function seatingDetail({distance,high=false,low=false,playing=false,tunnel=false}){
 if(low||!high&&(playing||tunnel))return'far';return high?(distance>90?'coarse':'curved'):distance>100?'far':distance>32?'coarse':'curved';
}
// The publicly visible inner canopy reads as a continuous, finely ribbed
// lining. Exterior inflated diamonds should not become the interior ceiling.
export function buildRoofLining(parent,surface){
 const segments=232,rows=22,positions=[],uv=[],indices=[];
 for(let row=0;row<=rows;row++)for(let j=0;j<=segments;j++){const p=surface(j/segments,.49+.51*row/rows);positions.push(p.x,p.y-.20,p.z);uv.push(j/segments,row/rows);}
 for(let row=0;row<rows;row++)for(let j=0;j<segments;j++){const a=row*(segments+1)+j,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const ribs=canvasTexture(256,512,c=>{c.fillStyle='#cbcbbf';c.fillRect(0,0,256,512);for(let y=0;y<512;y+=64){const g=c.createLinearGradient(0,y,0,y+64);g.addColorStop(0,'rgba(80,85,76,.14)');g.addColorStop(.14,'rgba(255,255,240,.10)');g.addColorStop(1,'rgba(80,85,76,.02)');c.fillStyle=g;c.fillRect(0,y,256,64);}c.fillStyle='rgba(70,80,75,.15)';c.fillRect(0,0,2,512);});ribs.wrapS=ribs.wrapT=THREE.RepeatWrapping;ribs.repeat.set(116,4);ribs.anisotropy=4;
 const lining=mesh(geometry,mat(0xe1e0d6,{map:ribs,roughness:.91,metalness:.01,side:THREE.DoubleSide,envMapIntensity:.16}),parent);lining.name='Continuous ribbed inner roof canopy';lining.castShadow=lining.receiveShadow=true;return lining;
}
let pressSeatGeometry;
export function buildPressSeat(parent,{x=0,y=0,z=0,width=.58,upholstery,metal}){
 if(!pressSeatGeometry){
  const pan=cushionGeometry(.54,.56,.11).clone();pan.rotateX(-Math.PI/2).translate(0,.48,0);const pp=pan.attributes.position,pn=pan.attributes.normal,normal=new THREE.Vector3();
  for(let i=0;i<pp.count;i++){const x=pp.getX(i),factor=.90+.10*(.28-pp.getZ(i))/.56;normal.fromBufferAttribute(pn,i);normal.set(normal.x/factor,normal.y,normal.z+.10/.56*x*normal.x/factor).normalize();pn.setXYZ(i,normal.x,normal.y,normal.z);pp.setX(i,x*factor);}
  const outline=new THREE.Shape();outline.moveTo(-.18,.47);outline.bezierCurveTo(-.23,.50,-.22,.64,-.26,.72);outline.bezierCurveTo(-.31,.79,-.34,.95,-.29,1.00);outline.bezierCurveTo(-.22,1.08,.22,1.08,.29,1.00);outline.bezierCurveTo(.34,.95,.31,.79,.26,.72);outline.bezierCurveTo(.22,.64,.23,.50,.18,.47);outline.quadraticCurveTo(0,.43,-.18,.47);outline.closePath();
  const back=new THREE.ExtrudeGeometry(outline,{depth:.065,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,curveSegments:7}),bp=back.attributes.position,bn=back.attributes.normal;
  // Transform the authored smooth cap normals with the curvature Jacobian.
  // Recomputing flat triangle normals here exposes the extrusion's cap fan.
  for(let i=0;i<bp.count;i++){const x=bp.getX(i),slope=-.26*x/(.34*.34);normal.fromBufferAttribute(bn,i);normal.set(normal.x-slope*normal.z,normal.y-.11/.60*normal.z,normal.z).normalize();bn.setXYZ(i,normal.x,normal.y,normal.z);bp.setZ(i,bp.getZ(i)+.15+.11*(bp.getY(i)-.47)/.60-.13*(x/.34)**2);}
  const arms=[];for(const side of[-1,1]){const curve=new THREE.CatmullRomCurve3([v(side*.24,.45,-.20),v(side*.28,.55,-.16),v(side*.29,.69,.02),v(side*.25,.75,.18)]);arms.push(new THREE.TubeGeometry(curve,9,.055,8,false));}
  const piping=pipingGeometry(.54,.56,.11).clone();piping.rotateX(-Math.PI/2).translate(0,.48,0);pressSeatGeometry={body:mergeGeometry([pan,back,...arms]),seam:piping};
 }
 const root=new THREE.Group();root.name='Sculpted press chair on central pedestal';root.position.set(x,y,z);parent.add(root);root.scale.x=width/.58;
 mesh(pressSeatGeometry.body,upholstery,root);mesh(pressSeatGeometry.seam,upholstery,root);cylinder(root,.048,.36,0,.22,0,metal,10);cylinder(root,.145,.022,0,.013,0,metal,16);cylinder(root,.092,.035,0,.401,0,metal,10);return root;
}
export function buildPressSeatInstances(parent,seats,{upholstery,metal}){
 const prototype=buildPressSeat(new THREE.Group(),{upholstery,metal});prototype.updateMatrixWorld(true);
 pressSeatGeometry.cloth??=mergeGeometry([pressSeatGeometry.body.clone(),pressSeatGeometry.seam.clone()]);
 pressSeatGeometry.pedestal??=mergeGeometry(prototype.children.slice(2).map(o=>o.geometry.clone().applyMatrix4(o.matrix)));
 const dummy=new THREE.Object3D(),instances=[];
 for(const [geometry,material,name]of [[pressSeatGeometry.cloth,upholstery,'Instanced curved press seating'],[pressSeatGeometry.pedestal,metal,'Instanced central press-chair supports']]){
  const inst=new THREE.InstancedMesh(geometry,material,seats.length);inst.name=name;seats.forEach((seat,i)=>{dummy.position.set(seat.x,seat.y,seat.z);dummy.scale.set(seat.width/.58,1,1);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.computeBoundingSphere();parent.add(inst);instances.push(inst);
 }
 for(const o of prototype.children.slice(2))o.geometry.dispose();return instances;
}
export function ribbonPanelGeometry(w,h){
 const p=[],colors=[],palette=[[.76,.075,.13],[.55,.035,.085],[.84,.10,.16],[.66,.045,.10]],rows=3,dy=h/rows,dx=dy*2.4;
 const clip=(poly,axis,limit,keep)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],inside=keep(a[axis]-limit),next=keep(b[axis]-limit);if(inside)out.push(a);if(inside!==next){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};
 for(let row=-1;row<=rows+1;row++)for(let col=-1;col<=Math.ceil(w/dx)+1;col++){
  const x=-w/2+col*dx+(Math.abs(row)%2)*dx/2,y=-h/2+row*dy;let ring=[[x,y+dy],[x+dx/2,y],[x,y-dy],[x-dx/2,y]];
  for(const [axis,limit,keep]of [[0,-w/2,n=>n>=0],[0,w/2,n=>n<=0],[1,-h/2,n=>n>=0],[1,h/2,n=>n<=0]])ring=clip(ring,axis,limit,keep);if(ring.length<3)continue;ring.reverse();
  const cx=ring.reduce((sum,a)=>sum+a[0],0)/ring.length,cy=ring.reduce((sum,a)=>sum+a[1],0)/ring.length,c=palette[((row+col)%4+4)%4];
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];for(const [xx,yy,zz,shade]of [[cx,cy,.008,1.05],[a[0],a[1],0,.82+.12*(a[1]-y)/dy],[b[0],b[1],0,.82+.12*(b[1]-y)/dy]]){p.push(xx,yy,zz);colors.push(...c.map(v=>v*shade));}}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
