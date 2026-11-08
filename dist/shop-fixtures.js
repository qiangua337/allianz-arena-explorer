import {THREE,v,mesh,beam,sign,Batches} from './kit.js';
import {shopRails,shopWallDisplays,shopCheckout,shopFeature} from './shop-layout.js';
import {playerByNumber,rosterInfo} from './roster.js';
import {finishedBox} from './finishes.js';

export function buildShopFixtures(g,{wood,metal,redTrim,white,dark,red,lightMat,jersey}){
 const b=new Batches(g);
 for(const fixture of shopWallDisplays){
  const{x,z,side,w,d,height}=fixture;
  // Floor-standing retail bays: kickboard, side frames, recessed back and
  // four shallow shelves, rather than floating stacks on metre-deep tables.
  b.add(w,.10,d,x,.05,z,dark);b.add(.055,height,d,x+side*(w/2-.0275),height/2,z,dark);
  for(const end of[-1,1])b.add(w,height,.035,x,height/2,z+end*(d/2-.0175),metal);
  for(const [row,y]of[.48,1.05,1.62,2.19].entries()){
   b.add(w-.06,.035,d-.07,x,y,z,wood);
   for(const dz of[-.31,.31])for(let layer=0;layer<2;layer++){
    const color=(row+layer)%3?redTrim:white;b.add(.60,.07,.43,x-side*.015,y+.055+layer*.073,z+dz,color);
    // Folded collar and subtle cuff separate garments at close range.
    b.add(.16,.009,.065,x-side*.015,y+.095+layer*.073,z+dz-.15,dark);
   }
  }
  b.add(w,.15,d,x,height-.075,z,dark);
  const face=x-side*(w/2+.006),ticket=sign(g,'FCB · FANWEAR',1.13,.12,face,2.55,z,{font:73,fg:'#eed6ab',bg:'#262d31'});ticket.rotation.y=-side*Math.PI/2;
  for(const y of[.42,.99,1.56,2.13]){const strip=sign(g,'S  ·  M  ·  L  ·  XL',1.10,.055,face,y,z,{font:55,fg:'#3d4244',bg:'#e6e1d7'});strip.rotation.y=-side*Math.PI/2;}
 }
 for(const rail of shopRails){
  const{x,z,w}=rail;b.add(w,.055,.055,x,2.2,z,metal);for(const dx of[-2,2])b.add(.055,2.2,.055,x+dx,1.1,z,metal);
  for(const [index,number]of rail.numbers.entries()){
   const player=playerByNumber(number),xx=x-1.6+index*.8;
   // The hook now actually hangs over the 2.2m rail. Every bay is Bayern kit;
   // the former third row accidentally used the away opponent's yellow kit.
   jersey(g,number,player.name,xx,1.62,z);
   sign(g,number+' · '+player.name,.70,.11,xx,1.04,z+.39,{font:58,fg:'#f2e6d1',bg:'#272d31'});
  }
  sign(g,'FC BAYERN · SPIELERDRUCK',2.15,.15,x,2.40,z,{font:65,fg:'#ead8b8',bg:'#33393d'});
 }
 const checkout=shopCheckout;
 finishedBox(g,5.3,1.1,1.5,checkout.x,.55,checkout.z,red,.045);finishedBox(g,checkout.w,.07,checkout.d,checkout.x,1.14,checkout.z,wood,.025);
 b.add(.7,.55,.08,2.5,1.48,4.9,dark);sign(g,'SERVUS!',2.5,.45,2,.65,5.76,{font:120,h:180});
 sign(g,rosterInfo.season+' · FC BAYERN',2.8,.20,2,2.12,6.84,{font:85,fg:'#a62b40',bg:'#eee9df'});
 // Scarves have woven bands, folded ends and tassels instead of blank cards.
 for(let i=0;i<10;i++){
  const x=-11+i*.9;b.add(.25,1.38,.035,x,2.27,-6.70,i%2?white:redTrim);
  for(let stripe=0;stripe<5;stripe++)b.add(.252,.045,.012,x,1.73+stripe*.25,-6.673,i%2?redTrim:white);
  for(const end of[-1,1])for(let j=0;j<6;j++)b.add(.012,.08,.022,x-.103+j*.041,2.27+end*.73,-6.70,white);
 }
 sign(g,'FAN-SCHALS',4.4,.22,-7,3.33,-6.73,{font:83,fg:'#a62b40'});
 // Gruschwitz's published 2019 Arena shop design uses circular lights above
 // feature displays. This interpretation adds no real-time light or shadow.
 for(const [y,tube,material]of[[3.53,.04,metal],[3.50,.023,lightMat]])mesh(new THREE.TorusGeometry(1.05,tube,6,48),material,g,shopFeature.x,y,shopFeature.z).rotation.x=Math.PI/2;
 for(let i=0;i<3;i++){const a=i/3*Math.PI*2,x=shopFeature.x+Math.cos(a)*.82,z=shopFeature.z+Math.sin(a)*.82;beam(g,v(x,3.57,z),v(x,4.38,z),.006,metal,5);}
 b.flush();
}
