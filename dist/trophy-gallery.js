import {THREE,v,mat,mesh,box,beam,cylinder,sign,canvasTexture,Batches,getCrestImage} from './kit.js';
import {finishedBox} from './finishes.js';
import {honours} from './honours.js';

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
function historyPanel(h){return canvasTexture(768,1024,c=>{
 c.fillStyle='#141b20';c.fillRect(0,0,768,1024);c.fillStyle='#b49256';c.fillRect(62,60,64,5);c.font='24px Arial';c.fillText(h.city,62,114);
 c.fillStyle='#ece7db';c.font='bold 142px Arial';c.fillText(h.year,52,288,660);c.fillStyle='#b49256';c.font='26px Arial';c.fillText(h.kind==='europe'?'EUROPEAN CHAMPIONS':h.city,62,352);
 c.fillStyle='#35434a';c.fillRect(62,410,644,1);c.fillStyle='#e2e0d7';c.font='36px Arial';c.fillText(h.opponent,62,492,644);c.font='bold 55px Arial';c.fillText(h.score,62,591,640);
 c.strokeStyle='#6e7d7c';c.lineWidth=2;c.strokeRect(62,690,644,220);c.beginPath();c.moveTo(384,690);c.lineTo(384,910);c.stroke();c.beginPath();c.arc(384,800,45,0,Math.PI*2);c.stroke();
 c.fillStyle='#b49256';c.beginPath();c.arc(384,800,6,0,Math.PI*2);c.fill();c.fillStyle='#86938e';c.font='20px Arial';c.fillText('FC BAYERN MÜNCHEN · HONOURS',62,970);
 });}
export function buildTrophyGallery(g,{dark,red,lightMat}){
 const silver=mat(0xdce2e5,{metalness:1,roughness:.19,envMapIntensity:1.1}),gold=mat(0xe7bd61,{metalness:1,roughness:.24,envMapIntensity:1.05}),bronze=mat(0x9c8053,{metalness:.8,roughness:.38}),gem=mat(0x214d3e,{metalness:.3,roughness:.17}),glass=mat(0xc5dfe1,{transparent:true,opacity:.055,roughness:.15,depthWrite:false,envMapIntensity:.55});
 const b=new Batches(g);sign(g,'THE PURSUIT OF GREATNESS',9.5,.55,0,3.15,-12.28,{font:95,h:160,fg:'#c6ab72'});sign(g,'六次欧洲之巅 · 荣誉之路',8,.32,0,2.57,-12.26,{font:70,h:128,fg:'#e4e0d4'});
 for(const[hIndex,h]of honours.entries()){
  const{x,z}=h;finishedBox(g,1.7,.85,1.7,x,.425,z,dark,.045);b.add(1.74,.035,1.74,x,.865,z,bronze);b.add(1.60,.015,1.60,x,.89,z,lightMat);
  // Four separate glass sides, leaving a clear, undoubled view through each case.
  for(const side of[-1,1]){box(g,1.68,2.04,.008,x,1.93,z+side*.849,glass);box(g,.008,2.04,1.68,x+side*.849,1.93,z,glass);}
  const display=new THREE.Group();display.position.set(x,.935,z);display.rotation.y=x<0?Math.PI/2:-Math.PI/2;g.add(display);
  if(h.kind==='europe')cup(display,silver);else if(h.kind==='shield')shield(display,silver,dark,gem);else pokal(display,gold,gem);
  sign(g,h.year,1.42,.31,x,.57,z+.861,{font:112,w:512,h:160,fg:'#e5d5b1'});sign(g,h.city,1.4,.12,x,.25,z+.862,{font:50,w:512,h:128,fg:'#aaa594'});const aisleLabel=sign(g,h.year,1.42,.31,x+(x<0?.861:-.861),.57,z,{font:112,w:512,h:160,fg:'#e5d5b1'});aisleLabel.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  const side=hIndex%2?1:-1,board=new THREE.Group();board.position.set(side*7.33,2.04,z);board.rotation.y=side<0?Math.PI/2:-Math.PI/2;g.add(board);
  finishedBox(board,1.65,2.2,.05,0,0,0,bronze,.02);mesh(new THREE.PlaneGeometry(1.60,2.14),new THREE.MeshBasicMaterial({map:historyPanel(h)}),board,0,0,.028);
  b.add(.025,2.15,.035,side*7.25,2.04,z-1.15,lightMat);
 }
 const legacy=canvasTexture(2048,640,c=>{
  c.fillStyle='#211b20';c.fillRect(0,0,2048,640);const wash=c.createLinearGradient(0,0,2048,640);wash.addColorStop(0,'#701b2b');wash.addColorStop(1,'#101b23');c.fillStyle=wash;c.fillRect(0,0,2048,640);
  c.strokeStyle='#ffffff09';c.lineWidth=2;for(let x=-600;x<2300;x+=100){c.beginPath();c.moveTo(x,0);c.lineTo(x+600,640);c.stroke();}
  c.fillStyle='#ffffff08';c.font='bold 520px Arial';c.fillText('1900',760,490);const crest=getCrestImage();if(crest)c.drawImage(crest,90,94,172,172);
  c.fillStyle='#d0b982';c.font='27px Arial';c.fillText('MÜNCHEN · SEIT 1900',320,136);c.fillStyle='#f3ede1';c.font='bold 108px Arial';c.fillText('MIA SAN MIA.',313,262);c.fillStyle='#c5bcae';c.font='30px Arial';c.fillText('SIX TIMES EUROPEAN CHAMPIONS',320,332);
  c.strokeStyle='#b5975d';c.lineWidth=2;c.beginPath();c.moveTo(128,463);c.lineTo(1920,463);c.stroke();c.textAlign='center';honours.slice(0,6).forEach((h,i)=>{const x=160+i*345;c.fillStyle='#d2bc88';c.beginPath();c.arc(x,463,7,0,Math.PI*2);c.fill();c.font='bold 43px Arial';c.fillText(h.year,x,534);c.fillStyle='#b4aba0';c.font='20px Arial';c.fillText(h.city,x,579);});
 });
 finishedBox(g,11.7,3.75,.07,0,2.47,12.32,bronze,.025);const mural=mesh(new THREE.PlaneGeometry(11.56,3.6125),new THREE.MeshBasicMaterial({map:legacy}),g,0,2.47,12.27);mural.rotation.y=Math.PI;
 for(const side of[-1,1]){b.add(.04,.035,23,side*6.9,.045,0,lightMat);b.add(.08,.035,22,side*3.7,4.32,0,lightMat);}
 sign(g,'靠近展柜 · F 查看冠军故事',4.6,.26,0,.20,10.4,{font:70,h:128,fg:'#c4b185'}).rotation.x=-Math.PI/2;b.flush();
}
