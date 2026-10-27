import {THREE,mat,box,mesh,cylinder,beam,v,canvasTexture,Batches} from './kit.js';
import {roomSpecs} from './building-layout.js';

export function buildRoomDetail(rooms){
 const dark=mat(0x273137),paper=mat(0xe1ded1,{roughness:.96}),steel=mat(0x99a7aa,{metalness:.7,roughness:.28}),red=mat(0xa5243e),blue=mat(0x477d92),rubber=mat(0x313335),display=new THREE.MeshBasicMaterial({color:0x5d8999});
 const texture=canvasTexture(512,160,()=>{}),clockMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),format=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});let nextCheck=0,last='';
 for(const key of['homeRoom','guestRoom']){
  const g=rooms[key],spec=roomSpecs[key],b=new Batches(g);if(!g)continue;
  box(g,.095,.56,1.9,spec.w/2-.22,3.57,0,dark);const clock=mesh(new THREE.PlaneGeometry(1.8,.5),clockMaterial,g,spec.w/2-.28,3.57,0);clock.rotation.y=-Math.PI/2;
  // Small equipment stays on the already collidable central island/trunk.
  for(const x of[-2.3,2.3]){for(let j=0;j<3;j++)box(g,.42,.026,.34,x,1.104+j*.028,-.45,j===2?red:paper);box(g,.11,.055,.12,x+.27,1.11,-.42,rubber);}
  box(g,.40,.022,.56,.25,1.096,-.25,dark);box(g,.35,.009,.48,.25,1.112,-.25,paper);for(let i=0;i<6;i++)b.add(.24,.003,.006,.25,1.119,-.42+i*.055,blue);b.add(.34,.014,.016,.28,1.13,.08,steel);
  // Medical wraps and a labelled first-aid case on the existing massage bed.
  box(g,.4,.22,.32,4.25,1.11,-6,dark);box(g,.16,.012,.055,4.25,1.226,-6,paper);box(g,.055,.013,.16,4.25,1.227,-6,paper);
  for(let i=0;i<3;i++){const wrap=cylinder(g,.044,.06,4.68+i*.11,1.044,-5.8,paper,12);wrap.rotation.z=Math.PI/2;}
  // Trunk hardware, lock, transport labels and fabric straps.
  for(const x of[3.75,5.85]){b.add(.09,.11,.025,x,.7,5.324,steel);b.add(.09,.035,.03,x,.71,5.34,dark);}b.add(.28,.10,.025,4.8,.7,5.33,paper);b.add(.32,.028,.025,4.8,.70,5.35,red);b.flush();
 }
 const press=rooms.press;if(press){const b=new Batches(press);for(const x of[-4.5,0,4.5]){box(press,.37,.015,.28,x-.37,1.357,-5.45,dark);box(press,.34,.012,.23,x-.37,1.372,-5.45,paper);box(press,.20,.035,.065,x+.27,1.36,-5.55,dark);b.add(.015,.02,.20,x+.34,1.39,-5.52,steel);cylinder(press,.041,.092,x-.82,1.397,-5.3,paper,12);}
  // Venue photographs show a suspended media-light grid above the red seating.
  const lamp=new THREE.MeshBasicMaterial({color:0xdfe8e8,toneMapped:false});for(const z of[-3.4,1.3]){beam(press,v(-9,4.03,z),v(9,4.03,z),.035,steel,8);for(const x of[-7,-3,3,7]){box(press,.34,.28,.25,x,3.87,z,dark);const face=box(press,.26,.018,.20,x,3.72,z,lamp);face.rotation.x=-.20;for(const side of[-1,1]){const flap=box(press,.35,.10,.018,x,3.76,z+side*.15,dark);flap.rotation.x=side*.50;}}}
  for(const x of[-9.7,9.7])b.add(.07,.012,12.5,x,.013,.2,rubber);b.flush();}
 const shop=rooms.store;if(shop){box(shop,.22,.025,.30,3.5,1.198,5,dark);const pos=box(shop,.15,.11,.09,3.5,1.255,4.95,dark);pos.rotation.x=-.2;box(shop,.12,.055,.012,3.5,1.278,4.9,display);for(let i=0;i<4;i++){box(shop,.5,.018,.30,1.3,1.19+i*.022,5.2,i%2?paper:red);}}
 return{update(now=Date.now()){if(now<nextCheck)return;nextCheck=now+1000;const text=format.format(now);if(text===last)return;last=text;const c=texture.image.getContext('2d');c.fillStyle='#0b141b';c.fillRect(0,0,512,160);c.textAlign='center';c.font='600 103px monospace';c.fillStyle='#ef6670';c.fillText(text,256,115);texture.needsUpdate=true;},get clock(){return last;}};
}
