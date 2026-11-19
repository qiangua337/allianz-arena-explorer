import {surfaceMaps} from './visual-assets.js';
import {THREE,canvasTexture,mat,mesh,seeded,superpoint,TAU} from './kit.js';
import {architecturalMaterials} from './surface-finishes.js';

export function landscapeMaterials(){
 const random=seeded(7391),make=(base,grass)=>{const texture=canvasTexture(512,512,c=>{c.fillStyle=base;c.fillRect(0,0,512,512);
  if(grass)for(let i=0;i<95;i++){const x=random()*512,y=random()*512,r=12+random()*62,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'#aeae6720':'#1f382020');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  for(let i=0;i<22000;i++){const x=random()*512,y=random()*512;c.fillStyle=i%2?'#e8e9c71c':'#17221b20';c.fillRect(x,y,grass?.5:1,grass?1+random()*3:1);}
 });texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.channel=1;texture.repeat.setScalar(grass?1/8:1/5);texture.anisotropy=4;return texture;};
 const grass=make('#708052',true),asphalt=make('#4b5050',false);
 return{concrete:architecturalMaterials().stone,grass:mat(0xffffff,{map:grass,bumpMap:grass,bumpScale:.025,roughness:1,...surfaceMaps('grass',{channel:1,repeat:[.22,.22],strength:.22})}),road:mat(0xffffff,{map:asphalt,bumpMap:asphalt,bumpScale:.012,roughness:.96}),path:mat(0xc5bfaf,{map:asphalt,roughness:.93,vertexColors:true})};
}

function addStripIndices(index,row,column,columns){
 if(row&&column){
  const v=row*columns+column;
  index.push(v-columns,v-columns-1,v-1,v-columns,v-1,v);
 }
}

function coloredSurface(position,color,index=null){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
 if(index)geometry.setIndex(index);
 geometry.computeVertexNormals();
 return geometry;
}

export function landscapePathGeometry(points,width,elevation){
 const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));
 const segments=Math.max(8,Math.ceil(curve.getLength()/4)),position=[],color=[],index=[];
 const bands=[[-width/2,1.42],[-width/2+.24,1.17],[width/2-.24,1.17],[width/2,1.42]];
 for(let row=0;row<=segments;row++){
  const fraction=row/segments,point=curve.getPointAt(fraction),tangent=curve.getTangentAt(fraction);
  bands.forEach(([offset,tint],column)=>{
   const x=point.x+tangent.z*offset,z=point.z-tangent.x*offset;
   position.push(x,elevation(z)+.058,z);
   color.push(tint,tint,tint);
   addStripIndices(index,row,column,bands.length);
  });
 }
 return coloredSurface(position,color,index);
}

// Widen the stone surface under the canopy without changing the walkable
// floor. Flush drainage sits below the interactive route line.
export function buildSouthPromenade(root,elevation,stone){
 const surface=stone.clone();
 const random=seeded(531),paving=canvasTexture(512,512,(ctx,w,h)=>{
  ctx.fillStyle='#82837b';
  ctx.fillRect(0,0,w,h);
  const width=256,height=128,colors=['#adb0a8','#b6b8ad','#b2b3aa','#a5a9a2'];
  for(let row=0;row<4;row++)for(let column=-1;column<2;column++){
   const x=column*width+(row%2)*width/2,y=row*height;
   const tint=(row*3+(column+2)%2)%colors.length;
   ctx.fillStyle=colors[tint];
   ctx.fillRect(x+1,y+1,width-2,height-2);
  }
  for(let i=0;i<12000;i++){
   ctx.fillStyle=i%2?'#fffceb15':'#343d3212';
   ctx.fillRect(random()*w,random()*h,.5+random()*1.6,.5+random()*1.6);
  }
 });
 paving.wrapS=paving.wrapT=THREE.RepeatWrapping;
 paving.repeat.setScalar(1/3.6);
 paving.channel=1;
 paving.anisotropy=4;
 surface.map=paving;
 surface.vertexColors=true;
 const position=[],tints=[],index=[];
 const edge=z=>7+2.4*Math.max(0,1-Math.abs(z-181)/24);
 const levels=[165,176,181,188,205,218];
 const bands=[[-1,.64],[-.91,.79],[-.84,1.04],[.84,1.04],[.91,.79],[1,.64]];
 for(const [row,z] of levels.entries()){
  for(const [column,[offset,tint]] of bands.entries()){
   position.push(offset*edge(z),elevation(z)+.066,z);
   tints.push(tint,tint,tint);
   addStripIndices(index,row,column,bands.length);
  }
 }
 mesh(coloredSurface(position,tints,index),surface,root).name='South entrance stone promenade';

 const gratePoints=[];
 for(const z of [172.2,186.7,206]){
  const half=edge(z)*.87;
  for(let slit=0;slit<6;slit++){
   const from=z+slit*.038,to=from+.014;
   const y0=elevation(from)+.075,y1=elevation(to)+.075;
   gratePoints.push(half,y0,from,-half,y0,from,half,y1,to,half,y1,to,-half,y0,from,-half,y1,to);
  }
 }
 const drains=new THREE.BufferGeometry();
 drains.setAttribute('position',new THREE.Float32BufferAttribute(gratePoints,3));
 drains.computeVertexNormals();
 mesh(drains,mat(0x414a4a,{roughness:.88}),root).name='Flush transverse drainage grates';
}

export function buildSouthMarginalPlanting(root,elevation){
 const material=mat(0xe1ebd1,{vertexColors:true,roughness:1,side:THREE.DoubleSide,envMapIntensity:.12});
 const random=seeded(18317),position=[],colors=[];
 const palette=[new THREE.Color(0x617849),new THREE.Color(0x9a995f),new THREE.Color(0x526c48)];
 for(const side of [-1,1])for(let i=0;i<145;i++){
  const z=189+random()*21,x=side*(11.25+random()*8),y=elevation(z)+.015;
  const tint=palette[Math.floor(random()*palette.length)],height=.13+random()*.31;
  for(let blade=0;blade<3;blade++){
   const angle=random()*TAU,sin=Math.sin(angle),cos=Math.cos(angle),width=.025+random()*.038,lean=.14+random()*.10;
   position.push(x-cos*width,y,z-sin*width,x+cos*width,y,z+sin*width,x+sin*lean,y+height*(.75+random()*.25),z-cos*lean);
   colors.push(tint.r*.53,tint.g*.53,tint.b*.53,tint.r*.59,tint.g*.59,tint.b*.59,tint.r,tint.g,tint.b);
  }
 }
 mesh(coloredSurface(position,colors),material,root).name='Low grasses on the south approach margins';
}

// Static spill on the paving uses one instanced draw for every lamp. No
// additional real-time lights or full-screen bloom are needed on mobile.
export function buildNightGroundSpill(root,lampPositions){
 const glow=canvasTexture(128,128,c=>{const g=c.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'#fff4d2b0');g.addColorStop(.4,'#ffe2b14a');g.addColorStop(1,'#ffe2b100');c.fillStyle=g;c.fillRect(0,0,128,128);});
 const material=new THREE.MeshBasicMaterial({map:glow,color:0xffe2b5,transparent:true,opacity:.26,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(9,12),material,lampPositions.length),dummy=new THREE.Object3D();lampPositions.forEach((p,i)=>{dummy.position.copy(p);dummy.position.y+=.085;dummy.rotation.set(-Math.PI/2+(p.z>140&&p.y<-3.01?Math.atan(8.5/543):0),0,0);dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);});pools.computeBoundingSphere();pools.name='Baked esplanade light pools';pools.renderOrder=2;root.add(pools);
 const points=[],colors=[],index=[],rings=[[115,131,0],[122,138,.7],[136,152,.16],[148,165,0]],segments=128;
 rings.forEach(([a,b,alpha],r)=>{for(let i=0;i<=segments;i++){const p=superpoint(a,b,i/segments*TAU,2.8);points.push(p.x,-2.965,p.z);colors.push(1,1,1,alpha);if(r&&i){const k=r*(segments+1)+i,j=k-(segments+1);index.push(j-1,k-1,j,j,k-1,k);}}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(index);g.computeVertexNormals();
 const wash=mesh(g,new THREE.MeshBasicMaterial({color:0xed2446,vertexColors:true,transparent:true,opacity:.25,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),root);wash.name='Red facade spill on the perimeter paving';wash.renderOrder=2;
 return{objects:[pools,wash],setNight(value){pools.visible=wash.visible=value;}};
}
