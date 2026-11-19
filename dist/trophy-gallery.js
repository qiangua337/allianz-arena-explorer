import {THREE,v,mat,mesh,box,beam,cylinder,fittedSign as sign,canvasTexture,Batches,getCrestImage} from './kit.js';
import {finishedBox} from './finishes.js';
import {honours} from './honours.js';
import {buildPersonalGallery} from './personal-gallery.js';

// Chapters follow the published museum renovation, condensed into one wall.
const museumChapters=[
 ['1900–1932','俱乐部成立 · 首夺德国冠军','#a82641'],
 ['1933–1965','战后重建 · 升入德甲','#b69a72'],
 ['1965–1979','黄金一代 · 欧洲三连冠','#62aaa3'],
 ['1980–1998','Rummenigge · Matthäus','#629ac3'],
 ['1999–2012','2001 欧冠 · 2012 主场决赛','#c77254'],
 ['2013–2020','温布利到里斯本 · 两次三冠王','#bc3654'],
];

function historyWallTexture(){
 return canvasTexture(1536,512,(c,w,h)=>{
  const wash=c.createLinearGradient(0,0,w,h);
  wash.addColorStop(0,'#371523');
  wash.addColorStop(.65,'#201c25');
  wash.addColorStop(1,'#131c24');
  c.fillStyle=wash;
  c.fillRect(0,0,w,h);
  const crest=getCrestImage();
  if(crest)c.drawImage(crest,w-183,50,117,117);
  c.fillStyle='#dbc29c';
  c.font='600 25px Arial';
  c.fillText('FC BAYERN MÜNCHEN  /  SEIT 1900',62,76);
  c.fillStyle='#f6eee5';
  c.font='800 63px Arial, Microsoft YaHei, sans-serif';
  c.fillText('拜仁历史',60,154);
  c.font='500 24px Arial';
  c.fillStyle='#c6bbaf';
  c.fillText('VEREINSGESCHICHTE',361,153);
  for(const [i,[years,label,color]] of museumChapters.entries()){
   const x=62+(i%3)*474,y=205+Math.floor(i/3)*133;
   c.fillStyle='#11131c7a';
   c.fillRect(x,y,452,112);
   c.fillStyle=color;
   c.fillRect(x,y,452,4);
   c.fillStyle='#f7eee6';
   c.font='700 38px Arial';
   c.fillText(years,x+20,y+55);
   c.fillStyle='#e1d5c6';
   c.font='500 23px Arial, Microsoft YaHei, sans-serif';
   c.fillText(label,x+20,y+90,412);
  }
 });
}

const lathe=points=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),64);
export function europeanCupGeometry(){return lathe([[.001,0],[.22,0],[.245,.04],[.24,.10],[.18,.12],[.13,.17],[.11,.24],[.13,.32],[.21,.38],[.31,.55],[.38,.83],[.385,.99],[.36,1.02],[.34,.99],[.345,.85],[.28,.57],[.185,.41],[.105,.35],[.085,.25],[.10,.16],[.001,.13]]);}
export function pokalGeometry(){return lathe([[.001,0],[.28,0],[.31,.045],[.29,.1],[.20,.16],[.16,.30],[.17,.42],[.27,.53],[.34,.65],[.36,.90],[.35,1.02],[.37,1.06],[.34,1.09],[.32,1.04],[.32,.92],[.30,.69],[.24,.57],[.145,.46],[.13,.31],[.001,.22]]);}
function torus(g,r,t,x,y,z,m,vertical=false){const o=mesh(new THREE.TorusGeometry(r,t,8,64),m,g,x,y,z);if(!vertical)o.rotation.x=Math.PI/2;return o;}
function cup(g,m){
 mesh(europeanCupGeometry(),m,g);for(const side of[-1,1]){const curve=new THREE.CatmullRomCurve3([[.35,.94],[.58,1.17],[.67,1.12],[.67,.87],[.53,.55],[.22,.34]].map(([x,y])=>v(side*x,y,0)));mesh(new THREE.TubeGeometry(curve,40,.034,8,false),m,g);}
 torus(g,.372,.012,0,1.006,0,m);for(const y of[.04,.09,.16])torus(g,y===.16?.15:.235,.008,0,y,0,m);
 sign(g,'COUPE DES CLUBS',.37,.065,0,.78,.383,{font:64,w:512,h:128,fg:'#4e5359'});sign(g,'CHAMPIONS EUROPÉENS',.37,.045,0,.713,.368,{font:50,w:512,h:128,fg:'#4e5359'});
}
function shield(g,silver,dark,gem){
 const plate=new THREE.Group();plate.position.y=.69;plate.rotation.x=-.13;g.add(plate);
 const disk=cylinder(plate,.67,.038,0,0,0,silver,64);disk.rotation.x=Math.PI/2;
 for(const[r,t,z]of[[.65,.018,.023],[.59,.012,.03],[.46,.02,.034],[.30,.012,.04],[.16,.023,.055]])torus(plate,r,t,0,0,z,silver,true);
 const center=cylinder(plate,.14,.025,0,0,.046,dark,32);center.rotation.x=Math.PI/2;
 for(let i=0;i<16;i++){const t=i/16*Math.PI*2,x=Math.sin(t),y=Math.cos(t);beam(plate,v(x*.32,y*.32,.027),v(x*.43,y*.43,.027),.007,silver,5);const stone=mesh(new THREE.SphereGeometry(.027,10,6),gem,plate,x*.53,y*.53,.04);stone.scale.z=.55;}
 sign(plate,'DEUTSCHER',.46,.07,0,.23,.06,{fg:'#454d51',font:64,w:512,h:128});sign(plate,'FUSSBALLMEISTER',.53,.058,0,-.23,.06,{fg:'#454d51',font:52,w:512,h:128});
 for(const x of[-.32,.32]){box(g,.06,.2,.18,x,.1,.08,dark);beam(g,v(x,.1,.1),v(x,.62,-.07),.012,silver,8);}
}
function pokal(g,gold,gem){
 mesh(pokalGeometry(),gold,g);for(const y of[.10,.18,.45,.52,.94,1.04])torus(g,y<.2?.27:y<.53?.21:.36,.012,0,y,0,gold);
 for(let i=0;i<12;i++){const t=i/12*Math.PI*2,r=.355;mesh(new THREE.SphereGeometry(.027,10,6),gem,g,Math.sin(t)*r,.81,Math.cos(t)*r);for(const y of[.69,.91]){const stud=mesh(new THREE.SphereGeometry(.014,8,5),gold,g,Math.sin(t)*r,y,Math.cos(t)*r);stud.scale.y=1.5;}}
 sign(g,'DFB',.19,.08,0,.68,.354,{font:90,w:256,h:128,fg:'#65502c'});
}
export function addClubAward(display,kind,{silver,gold,dark,gem}){
 if(kind==='europe'){cup(display,silver);display.scale.setScalar(.628);}else if(kind==='shield'){shield(display,silver,dark,gem);display.scale.setScalar(.68);}else{pokal(display,gold,gem);display.scale.setScalar(.50);}return display;
}
export function buildTrophyGallery(g,{dark}){
 const silver=mat(0xdce2e5,{metalness:.96,roughness:.28,envMapIntensity:.82}),gold=mat(0xe7bd61,{metalness:.96,roughness:.30,envMapIntensity:.85}),bronze=mat(0x9c8053,{metalness:.8,roughness:.38}),gem=mat(0x214d3e,{metalness:.3,roughness:.17}),glass=mat(0xe0e7e4,{transparent:true,opacity:.04,roughness:.17,depthWrite:false,envMapIntensity:.3});
 const caseMap=canvasTexture(128,256,c=>{const gradient=c.createLinearGradient(0,0,128,0);gradient.addColorStop(0,'#a8aeaa');gradient.addColorStop(.38,'#d8dcd4');gradient.addColorStop(.65,'#d0d5cd');gradient.addColorStop(1,'#a2aaa5');c.fillStyle=gradient;c.fillRect(0,0,128,256);}),caseMaterial=mat(0xf0f0e6,{map:caseMap,metalness:.12,roughness:.58,envMapIntensity:.24}),frame=mat(0x87928e,{metalness:.66,roughness:.40});
 const displayTop=mat(0xe6e3d9,{roughness:.62,metalness:.08,envMapIntensity:.2});
 const b=new Batches(g);sign(g,'FC BAYERN MUSEUM',9.5,.55,0,3.15,-12.28,{font:95,h:160,fg:'#e9eceb'});sign(g,'VIA TRIUMPHALIS · 荣耀之路',8,.32,0,2.57,-12.26,{font:70,h:128,fg:'#e4e0d4'});sign(g,'8 CLUB EXHIBITS   /   10 INDIVIDUAL COLLECTIONS',8,.20,0,2.13,-12.25,{font:60,h:128,fg:'#a69c87'});
 for(const[hIndex,h]of honours.entries()){
  const{x,z}=h;finishedBox(g,1.7,1.22,1.7,x,.61,z,caseMaterial,.018);b.add(1.74,.035,1.74,x,1.24,z,frame);b.add(1.60,.015,1.60,x,1.26,z,displayTop);b.add(1.74,.07,1.74,x,.035,z,frame);
  // Four separate glass sides, leaving a clear, undoubled view through each case.
  for(const side of[-1,1]){box(g,1.68,1.25,.008,x,1.9,z+side*.849,glass);box(g,.008,1.25,1.68,x+side*.849,1.9,z,glass);}
  const display=new THREE.Group();display.position.set(x,1.295,z);display.rotation.y=x<0?Math.PI/2:-Math.PI/2;g.add(display);
  addClubAward(display,h.kind,{silver,gold,dark,gem});
  sign(g,h.year,1.42,.31,x,.57,z+.861,{font:112,w:512,h:160,fg:'#27343a'});sign(g,h.city,1.4,.12,x,.25,z+.862,{font:50,w:512,h:128,fg:'#34474f'});const aisleLabel=sign(g,h.year,1.42,.31,x+(x<0?.861:-.861),.57,z,{font:112,w:512,h:160,fg:'#27343a'});aisleLabel.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  const plaque=sign(g,h.opponent,1.42,.13,x+(x<0?.862:-.862),.27,z,{font:74,w:512,h:128,fg:'#34474f'});plaque.rotation.y=x<0?Math.PI/2:-Math.PI/2;const title=sign(g,'球队荣誉 · '+h.year,1.48,.14,x+(x<0?.863:-.863),1.06,z,{font:145,fg:'#27343a'});title.rotation.y=x<0?Math.PI/2:-Math.PI/2;
 }
 const mural=mesh(new THREE.PlaneGeometry(11.28,3.76),new THREE.MeshBasicMaterial({map:historyWallTexture(),toneMapped:false}),g,0,2.34,12.24);
 mural.rotation.y=Math.PI;
 finishedBox(g,11.45,3.92,.10,0,2.34,12.31,bronze,.025);
 // Suspended lighting tracks align with the two rows of club trophy cases.
 const warmStrip=new THREE.MeshBasicMaterial({color:0xf1d6ac,toneMapped:false});
 for(const x of [-3.7,3.7]){
  b.add(.20,.11,19.6,x,4.28,0,dark);
  for(const z of [-8.8,0,8.8])b.add(.06,.15,.06,x,4.40,z,dark);
  for(const z of [-8,-2.7,2.6,7.9]){
   b.add(.56,.14,1.22,x,4.17,z,frame);
   b.add(.38,.025,1.02,x,4.09,z,warmStrip);
  }
 }
 buildPersonalGallery(g,{gold,silver,bronze:frame,dark,glass});
 // A directory beside, rather than in, the entrance keeps the doorway clear.
 const directory=new THREE.Group();directory.position.set(7.32,2.1,2.65);directory.rotation.y=-Math.PI/2;g.add(directory);box(directory,1.65,1.7,.05,0,0,0,dark);sign(directory,'荣誉展厅',1.42,.27,0,.42,.035,{font:100,fg:'#e0ca98'});sign(directory,'个人荣誉 · 球队冠军',1.42,.15,0,.06,.036,{font:60,fg:'#ded9cb'});sign(directory,'F 打开展览目录',1.42,.14,0,-.38,.037,{font:65,fg:'#b7af9f'});
 const exit=sign(g,'AUSGANG  /  公共大厅',2.02,.35,7.33,3.27,0,{sub:'CONCOURSE',bg:'#263c36',fg:'#f4f5e8',h:128,font:56});
 exit.rotation.y=-Math.PI/2;
 b.flush();
}
