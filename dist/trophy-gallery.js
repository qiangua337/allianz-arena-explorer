import {THREE,v,mat,mesh,box,beam,cylinder,sign,canvasTexture,Batches,getCrestImage} from './kit.js';
import {finishedBox} from './finishes.js';
import {honours} from './honours.js';
import {buildPersonalGallery} from './personal-gallery.js';

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
export function buildTrophyGallery(g,{dark,red,lightMat}){
 const silver=mat(0xdce2e5,{metalness:1,roughness:.19,envMapIntensity:1.1}),gold=mat(0xe7bd61,{metalness:1,roughness:.24,envMapIntensity:1.05}),bronze=mat(0x9c8053,{metalness:.8,roughness:.38}),gem=mat(0x214d3e,{metalness:.3,roughness:.17}),glass=mat(0xc5dfe1,{transparent:true,opacity:.055,roughness:.15,depthWrite:false,envMapIntensity:.55});
 const caseMap=canvasTexture(128,256,c=>{const gradient=c.createLinearGradient(0,0,128,0);gradient.addColorStop(0,'#8196a1');gradient.addColorStop(.38,'#d0e0e8');gradient.addColorStop(.65,'#c2d8e2');gradient.addColorStop(1,'#718e9f');c.fillStyle=gradient;c.fillRect(0,0,128,256);}),caseMaterial=new THREE.MeshBasicMaterial({map:caseMap,color:0xc3d1d6,toneMapped:false}),frame=mat(0x7f8c91,{metalness:.8,roughness:.33});
 const b=new Batches(g);sign(g,'FC BAYERN MUSEUM',9.5,.55,0,3.15,-12.28,{font:95,h:160,fg:'#e9eceb'});sign(g,'VIA TRIUMPHALIS · 荣耀之路',8,.32,0,2.57,-12.26,{font:70,h:128,fg:'#e4e0d4'});sign(g,'8 CLUB EXHIBITS   /   10 INDIVIDUAL COLLECTIONS',8,.20,0,2.13,-12.25,{font:60,h:128,fg:'#a69c87'});
 for(const[hIndex,h]of honours.entries()){
  const{x,z}=h;finishedBox(g,1.7,1.22,1.7,x,.61,z,caseMaterial,.018);b.add(1.74,.035,1.74,x,1.24,z,frame);b.add(1.60,.015,1.60,x,1.26,z,lightMat);b.add(1.74,.07,1.74,x,.035,z,frame);
  // Four separate glass sides, leaving a clear, undoubled view through each case.
  for(const side of[-1,1]){box(g,1.68,1.25,.008,x,1.9,z+side*.849,glass);box(g,.008,1.25,1.68,x+side*.849,1.9,z,glass);}
  const display=new THREE.Group();display.position.set(x,1.295,z);display.rotation.y=x<0?Math.PI/2:-Math.PI/2;g.add(display);
  if(h.kind==='europe'){cup(display,silver);display.scale.setScalar(.628);}else if(h.kind==='shield'){shield(display,silver,dark,gem);display.scale.setScalar(.68);}else{pokal(display,gold,gem);display.scale.setScalar(.50);}
  sign(g,h.year,1.42,.31,x,.57,z+.861,{font:112,w:512,h:160,fg:'#27343a'});sign(g,h.city,1.4,.12,x,.25,z+.862,{font:50,w:512,h:128,fg:'#34474f'});const aisleLabel=sign(g,h.year,1.42,.31,x+(x<0?.861:-.861),.57,z,{font:112,w:512,h:160,fg:'#27343a'});aisleLabel.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  const plaque=sign(g,h.opponent,1.42,.13,x+(x<0?.862:-.862),.27,z,{font:54,w:512,h:128,fg:'#34474f'});plaque.rotation.y=x<0?Math.PI/2:-Math.PI/2;
 }
 const legacy=canvasTexture(2048,640,c=>{
  c.fillStyle='#211b20';c.fillRect(0,0,2048,640);const wash=c.createLinearGradient(0,0,2048,640);wash.addColorStop(0,'#701b2b');wash.addColorStop(1,'#101b23');c.fillStyle=wash;c.fillRect(0,0,2048,640);
  c.strokeStyle='#ffffff09';c.lineWidth=2;for(let x=-600;x<2300;x+=100){c.beginPath();c.moveTo(x,0);c.lineTo(x+600,640);c.stroke();}
  c.fillStyle='#ffffff08';c.font='bold 520px Arial';c.fillText('1900',760,490);const crest=getCrestImage();if(crest)c.drawImage(crest,90,94,172,172);
  c.fillStyle='#d0b982';c.font='27px Arial';c.fillText('MÜNCHEN · SEIT 1900',320,136);c.fillStyle='#f3ede1';c.font='bold 108px Arial';c.fillText('MIA SAN MIA.',313,262);c.fillStyle='#c5bcae';c.font='30px Arial';c.fillText('SIX TIMES EUROPEAN CHAMPIONS',320,332);
  c.strokeStyle='#b5975d';c.lineWidth=2;c.beginPath();c.moveTo(128,463);c.lineTo(1920,463);c.stroke();c.textAlign='center';honours.slice(0,6).forEach((h,i)=>{const x=160+i*345;c.fillStyle='#d2bc88';c.beginPath();c.arc(x,463,7,0,Math.PI*2);c.fill();c.font='bold 43px Arial';c.fillText(h.year,x,534);c.fillStyle='#b4aba0';c.font='20px Arial';c.fillText(h.city,x,579);});
 });
 finishedBox(g,11.7,3.75,.07,0,2.47,12.32,bronze,.025);const mural=mesh(new THREE.PlaneGeometry(11.56,3.6125),new THREE.MeshBasicMaterial({map:legacy}),g,0,2.47,12.27);mural.rotation.y=Math.PI;
 buildPersonalGallery(g,{gold,silver,bronze:frame,dark,glass});
 // A directory beside, rather than in, the entrance keeps the doorway clear.
 const directory=new THREE.Group();directory.position.set(7.32,2.1,2.65);directory.rotation.y=-Math.PI/2;g.add(directory);box(directory,1.65,1.7,.05,0,0,0,dark);sign(directory,'荣誉展厅',1.42,.27,0,.42,.035,{font:100,fg:'#e0ca98'});sign(directory,'个人荣誉 · 球队冠军',1.42,.15,0,.06,.036,{font:60,fg:'#ded9cb'});sign(directory,'F 打开展览目录',1.42,.14,0,-.38,.037,{font:65,fg:'#b7af9f'});
 b.flush();
}
