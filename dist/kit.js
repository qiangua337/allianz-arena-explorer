import * as THREE from 'three';
export {THREE};
export const TAU=Math.PI*2;
export const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const mats={};
export function mat(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:.8,metalness:0,...options});}
export function mesh(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o;}
export function box(parent,w,h,d,x,y,z,m){return mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);}
export function cylinder(parent,r,h,x,y,z,m,n=12){return mesh(new THREE.CylinderGeometry(r,r,h,n),m,parent,x,y,z);}
export function beam(parent,a,b,r,m,n=6){const delta=b.clone().sub(a);const o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),n),m,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(v(0,1,0),delta.normalize());return o;}
export function canvasTexture(width,height,draw){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
export function textTexture(text,{fg='#ffffff',bg='transparent',w=1024,h=256,font=100,weight=600,sub='',border=false}={}){return canvasTexture(w,h,(ctx)=>{ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);if(border){ctx.strokeStyle=fg;ctx.lineWidth=4;ctx.strokeRect(8,8,w-16,h-16);}ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${weight} ${font}px Arial,Microsoft YaHei,sans-serif`;ctx.fillText(text,w/2,sub?h*.41:h/2,w*.93);if(sub){ctx.font=`${font*.27}px Arial,Microsoft YaHei,sans-serif`;ctx.fillText(sub,w/2,h*.78,w*.9);}});}
// Sign textures share atlas pages, so hundreds of labels merge into a few draws.
const signPages=[],signCells=new Map();
export function sign(parent,text,w,h,x,y,z,options={}){
 if(options.unique){const t=textTexture(text,options);return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,depthWrite:!!options.bg&&options.bg!=='transparent',toneMapped:false}),parent,x,y,z);}
 const key=JSON.stringify([text,options]);let cell=signCells.get(key);
 if(!cell){let page=signPages.at(-1);if(!page||page.count===64){const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;page={canvas,texture,count:0,materials:[]};for(const opaque of[false,true])page.materials.push(new THREE.MeshBasicMaterial({map:texture,transparent:!opaque,side:THREE.DoubleSide,depthWrite:opaque,alphaTest:.01,toneMapped:false}));signPages.push(page);}const index=page.count++,cx=index%4*512,cy=Math.floor(index/4)*128,t=textTexture(text,options);page.canvas.getContext('2d').drawImage(t.image,cx+2,cy+2,508,124);t.dispose();page.texture.needsUpdate=true;cell={page,cx,cy};signCells.set(key,cell);}
 const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(cell.cx+2+uv.getX(i)*508)/2048,1-(cell.cy+2+(1-uv.getY(i))*124)/2048);
 return mesh(g,cell.page.materials[options.bg&&options.bg!=='transparent'?1:0],parent,x,y,z);
}
export function floorTexture(type='concrete'){return canvasTexture(512,512,(ctx,w,h)=>{let seed=144;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};ctx.fillStyle=type==='wood'?'#a47a50':type==='red'?'#8b1b2c':'#a2a39f';ctx.fillRect(0,0,w,h);for(let i=0;i<15000;i++){const a=rand()*.1;ctx.fillStyle=`rgba(${type==='wood'?'30,15,5':'0,0,0'},${a})`;ctx.fillRect(rand()*w,rand()*h,type==='wood'?rand()*85+4:rand()*3+1,type==='wood'?.5:rand()*2+1);}if(type==='wood'){ctx.strokeStyle='#50341e65';for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(0,i*64);ctx.lineTo(512,i*64);ctx.stroke();}}else{ctx.strokeStyle=type==='red'?'#e83a4b30':'#535c6135';ctx.lineWidth=1;for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(i*128,0);ctx.lineTo(i*128,512);ctx.moveTo(0,i*128);ctx.lineTo(512,i*128);ctx.stroke();}}});}
export function repeatTex(t,x,y){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);return t;}
export function superpoint(a,b,t,n=2.8){const c=Math.cos(t),s=Math.sin(t),p=2/n;return v(a*Math.sign(c)*Math.abs(c)**p,0,b*Math.sign(s)*Math.abs(s)**p);}
export function supernormal(a,b,t,n=2.8){const p=superpoint(a,b,t,n),q=superpoint(a,b,t+.0001,n);return v(q.z-p.z,0,p.x-q.x).normalize();}
export function ringGeometry(ax,bz,cx,dz,y=0,n=2.8,segments=192){const pos=[],uv=[];for(let i=0;i<segments;i++){const t=i/segments*TAU,u=(i+1)/segments*TAU;const pts=[superpoint(ax,bz,t,n),superpoint(cx,dz,t,n),superpoint(cx,dz,u,n),superpoint(ax,bz,u,n)];for(const k of[0,2,1,0,3,2]){pos.push(pts[k].x,y,pts[k].z);uv.push(pts[k].x/20,pts[k].z/20);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;}
export function curveLine(parent,points,color=0xffffff,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points);const m=new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity});const l=new THREE.Line(g,m);parent.add(l);return l;}
export function mergeGeometry(gs){const arrays={position:[],normal:[],uv:[]};for(let g of gs){if(g.index)g=g.toNonIndexed();for(const a in arrays)if(g.attributes[a])arrays[a].push(g.attributes[a].array);}const out=new THREE.BufferGeometry();for(const a in arrays){const len=arrays[a].reduce((s,p)=>s+p.length,0);if(!len)continue;const data=new Float32Array(len);let offset=0;for(const p of arrays[a]){data.set(p,offset);offset+=p.length;}out.setAttribute(a,new THREE.BufferAttribute(data,a==='uv'?2:3));}return out;}
export class Batches{constructor(parent){this.parent=parent;this.entries=new Map();}add(w,h,d,x,y,z,m,yaw=0){let arr=this.entries.get(m);if(!arr){arr=[];this.entries.set(m,arr);}arr.push({w,h,d,x,y,z,yaw});}flush(){const dummy=new THREE.Object3D();for(const[m,arr]of this.entries){const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),m,arr.length);arr.forEach((a,i)=>{dummy.position.set(a.x,a.y,a.z);dummy.scale.set(a.w,a.h,a.d);dummy.rotation.set(0,a.yaw,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.receiveShadow=true;inst.castShadow=true;inst.computeBoundingSphere();this.parent.add(inst);}this.entries.clear();}}
let crestTexture;
export async function loadBrandAssets(){
 const image=await new THREE.ImageLoader().loadAsync(new URL('./assets/fc-bayern.svg',import.meta.url).href);
 crestTexture=canvasTexture(1024,1024,ctx=>ctx.drawImage(image,0,0,1024,1024));
 crestTexture.name='Official FC Bayern crest';
}
export function addCrest(parent,size,x,y,z){
 if(!crestTexture)throw new Error('Brand assets must load before building the arena');
 const material=new THREE.MeshBasicMaterial({map:crestTexture,transparent:true,alphaTest:.08,depthWrite:false,side:THREE.FrontSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const crest=mesh(new THREE.PlaneGeometry(size,size),material,parent,x,y,z);crest.name='FC Bayern official crest';crest.renderOrder=3;return crest;
}
export function wallCollider(list,x,z,w,d,y0=-10,y1=10,owner=null){list.push({x0:x-w/2-.24,x1:x+w/2+.24,z0:z-d/2-.24,z1:z+d/2+.24,y0,y1,owner});}
export function seeded(seed=42){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function compactGroup(group,skip=[]){group.updateWorldMatrix(true,true);const inv=group.matrixWorld.clone().invert(),byMaterial=new Map(),remove=[];group.traverse(o=>{if(!o.isMesh||skip.includes(o)||Array.isArray(o.material))return;let list=byMaterial.get(o.material);if(!list){list=[];byMaterial.set(o.material,list);}const transform=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);if(o.isInstancedMesh){const a=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,a);list.push(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform,a)));}}else list.push(o.geometry.clone().applyMatrix4(transform));remove.push(o);});for(const o of remove)o.removeFromParent();for(const [m,gs]of byMaterial){const o=mesh(gs.length===1?gs[0]:mergeGeometry(gs),m,group);o.castShadow=false;}}
