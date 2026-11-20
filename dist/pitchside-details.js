import {buildBroadcastCamera} from './facility-equipment.js';
import {THREE,mat,mesh,box,beam,cylinder,sign,v,compactGroup,Batches} from './kit.js';
import {finishedBox,contactShadow} from './finishes.js';

export function buildDugoutShelter(parent,z,{dark,steel,red,glass}){
 const shelter=new THREE.Group();shelter.name='Pitchside dugout shelter';
 shelter.position.set(-38.1,0,z);parent.add(shelter);
 box(shelter,3.2,.04,17,0,.02,0,dark);
 box(shelter,1.6,.45,17,-.8,.265,0,dark);
 box(shelter,.09,.76,17,-1.61,.42,0,dark);
 box(shelter,.11,.065,17,-1.56,.80,0,red);

 // A continuous curved roof wraps behind the seats, with an open front.
 const profile=[[-1.62,.79],[-1.62,1.96],[-1.48,2.41],[-1.13,2.69],[-.59,2.81],[1.56,2.81]];
 const positions=[],uvs=[],indices=[];
 for(const [i,[x,y]] of profile.entries()){
  positions.push(x,y,-8.5,x,y,8.5);
  uvs.push(0,i/(profile.length-1),1,i/(profile.length-1));
  const a=i*2;
  if(i>0)indices.push(a-2,a-1,a,a-1,a+1,a);
 }
 const skin=new THREE.BufferGeometry();
 skin.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 skin.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 skin.setIndex(indices);skin.computeVertexNormals();
 const glazing=mesh(skin,glass,shelter);
 glazing.name='Curved polycarbonate dugout canopy';
 for(let j=0;j<=6;j++){
  const ribZ=17*(j/6-.5);
  for(let i=1;i<profile.length;i++){
   const [x0,y0]=profile[i-1],[x1,y1]=profile[i];
   beam(shelter,v(x0,y0,ribZ),v(x1,y1,ribZ),.044,steel);
  }
 }
 box(shelter,.16,.27,17.12,1.57,2.77,0,dark);
 box(shelter,.17,.038,17.14,1.57,2.65,0,red);
 const label=sign(shelter,z<0?'FC BAYERN MÜNCHEN':'GÄSTE / AWAY',5.6,.22,1.66,2.79,0,{fg:'#f3f1ec',font:85,h:128,weight:700});
 label.rotation.y=Math.PI/2;
 compactGroup(shelter,[glazing]);
 return shelter;
}

// Decorative equipment sits beyond the touchlines and outside the two open
// visitor/player entrances. It does not create new invisible colliders.
export function buildPitchsideDetails(parent){
 const root=new THREE.Group();root.name='Pitchside production and team equipment';parent.add(root);
 const dark=mat(0x202a30,{roughness:.7}),metal=mat(0x8a979c,{metalness:.7,roughness:.3}),rubber=mat(0x10191b),white=mat(0xe6e5de),red=mat(0xa3233d),blue=mat(0x4c8896,{roughness:.35}),orange=mat(0xde6e32),glass=mat(0x1d3848,{metalness:.25,roughness:.2});
 const groups=[];
 // Painted technical areas flank the player entrance. Keep the central eight
 // metres clear, and keep every line outside the 68 m playable width.
 const markings=new THREE.Group();markings.name='Technical area pitchside markings';root.add(markings);const paint=new Batches(markings),chalk=mat(0xdadfd2,{roughness:.95});
 for(const z of[-18,18]){for(const x of[-40.6,-34.9])for(let dz=-8.7;dz<9;dz+=.7)paint.add(.065,.008,.35,x,.016,z+dz,chalk);for(const end of[z-9,z+9])for(let x=-40.4;x<-34.9;x+=.65)paint.add(.34,.008,.065,x,.016,end,chalk);}
 paint.flush();
 for(const side of[-1,1]){
  const g=new THREE.Group();g.name=side<0?'North camera bank':'South camera bank';g.position.z=side*57.8;root.add(g);groups.push(g);
  for(const x of[-28,-19,-9,3,13,31]){
   const camera=buildBroadcastCamera(g,{x,compact:true,yaw:side>0?Math.PI:0});
   box(camera,.35,.07,.31,.55,.31,-.2,red);for(const dx of[-.13,.13])for(const dz of[-.11,.11])beam(camera,v(.55+dx,.28,-.2+dz),v(.55+dx,.02,-.2+dz),.013,metal);
   box(camera,.44,.28,.29,-.65,.15,-.12,rubber);for(const xx of[-.83,-.47])box(camera,.025,.025,.29,xx,.294,-.12,metal);
  }
  compactGroup(g);
 }
 const teams=new THREE.Group();teams.name='Hydration, warm-up and medical kit';root.add(teams);groups.push(teams);
 for(const z of[-27,27]){
  const b=new Batches(teams);finishedBox(teams,.85,.52,1.15,-39.1,.31,z,dark,.035);for(const y of[.08,.56])b.add(.9,.035,1.2,-39.1,y,z,metal);for(const zz of[z-.48,z+.48])for(const x of[-39.42,-38.78])cylinder(teams,.07,.05,x,.07,zz,rubber,8).rotation.z=Math.PI/2;
  contactShadow(teams,1.35,1.6,-39.1,.003,z);
  finishedBox(teams,.58,.36,.39,-39.1,.77,z-.26,white,.03);box(teams,.15,.01,.26,-39.1,.958,z-.26,red);box(teams,.3,.01,.11,-39.1,.959,z-.26,red);
  for(const xx of[-39.32,-38.88]){box(teams,.05,.18,.035,xx,.77,z-.466,metal);box(teams,.05,.18,.035,xx,.77,z-.054,metal);}box(teams,.23,.03,.06,-39.1,.97,z-.26,rubber);
  for(let i=0;i<5;i++){const zz=z-.4+i*.19;cylinder(teams,.036,.23,-38.85,.7,zz,blue,10);cylinder(teams,.038,.045,-38.85,.72,zz,white,10);cylinder(teams,.022,.04,-38.85,.835,zz,red,10);}
  for(let i=0;i<3;i++)finishedBox(teams,.39,.025,.27,-39.1,.595+i*.028,z+.27,white,.008);
  for(let i=0;i<4;i++){const cone=mesh(new THREE.ConeGeometry(.10,.18,10),orange,teams,-39.2,.1,z+1.25+i*.27);box(teams,.24,.018,.24,cone.position.x,.009,cone.position.z,orange);}
  // Folded stretcher secured behind the bench, rather than across an aisle.
  finishedBox(teams,.5,.07,1.75,-39.6,.24,z+2.5,orange,.02);for(const xx of[-39.9,-39.3])beam(teams,v(xx,.26,z+1.43),v(xx,.26,z+3.57),.022,metal);for(const zz of[z+2.05,z+2.95])box(teams,.52,.012,.07,-39.6,.28,zz,dark);contactShadow(teams,.85,2.3,-39.6,.003,z+2.5);b.flush();
 }
 compactGroup(teams);
 // Flush drainage and sprinkler heads; no geometry rises into the field.
 const ground=new THREE.Group();ground.name='Pitch drainage hardware';root.add(ground);const gb=new Batches(ground);
 for(const side of[-1,1])for(let z=-48;z<=48;z+=8){gb.add(.18,.012,1.0,side*37.9,.012,z,dark);for(let j=0;j<8;j++)gb.add(.15,.008,.025,side*37.9,.022,z-.4+j*.11,metal);}
 for(const x of[-35.5,35.5])for(const z of[-53.8,0,53.8])cylinder(ground,.065,.012,x,.012,z,rubber,12);gb.flush();
 return{root,update(position,low=false){for(const g of groups)g.visible=!low&&position.y<39&&Math.hypot(position.x-g.position.x,position.z-g.position.z)<135;ground.visible=!low&&position.y<12;}};
}
