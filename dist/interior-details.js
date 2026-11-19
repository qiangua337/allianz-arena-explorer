import {THREE,TAU,mat,mesh,superpoint,supernormal,Batches} from './kit.js';
import {publicWallOpening,clearCore,roomFootprint} from './building-layout.js';

let materials;
function palette(){
 if(!materials)materials={
  reveal:mat(0x42494b,{roughness:.88,envMapIntensity:.12}),
  steel:mat(0x87979b,{metalness:.66,roughness:.34}),
  housing:mat(0xd2d5cd,{roughness:.76}),
  glass:mat(0x182b32,{metalness:.12,roughness:.23,envMapIntensity:.5}),
  screen:new THREE.MeshBasicMaterial({color:0x6f939a,toneMapped:false})
 };
 return materials;
}

// The base and ceiling channels follow the same wall segments and door cuts
// as the circulation shell. Their depth stays against the existing wall.
export function buildConcourseDetails(parent){
 const m=palette(),b=new Batches(parent),floor=12.2,ceiling=16.8;
 const positions=[];
 function ribbon(p,q,low,high){
  positions.push(p.x,low,p.z,q.x,low,q.z,p.x,high,p.z,
   q.x,low,q.z,q.x,high,q.z,p.x,high,p.z);
 }
 for(const[a,zRadius,offset]of[[85,103,.065],[105,122,-.065]]){
  for(let i=0;i<256;i++){
   const angle=i/256*TAU,next=(i+1)/256*TAU;
   const original=superpoint(a,zRadius,(angle+next)/2);
   if(publicWallOpening(original.x,original.z))continue;
   const p=superpoint(a+offset,zRadius+offset,angle),q=superpoint(a+offset,zRadius+offset,next);
   ribbon(p,q,floor+.015,floor+.17);
   ribbon(p,q,ceiling-.18,ceiling-.055);
   if(i%4===0){
    const point=superpoint(a+offset,zRadius+offset,angle);
    if(publicWallOpening(point.x,point.z))continue;
    const normal=supernormal(a,zRadius,angle),yaw=Math.atan2(normal.x,normal.z);
    b.add(.018,4.15,.009,point.x,floor+2.25,point.z,m.reveal,yaw);
    b.add(.06,.028,.022,point.x,floor+.185,point.z,m.steel,yaw);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.computeVertexNormals();
 const trim=mesh(geometry,m.reveal,parent);
 trim.name='Concourse wall bases and recessed ceiling edges';
 trim.material.side=THREE.DoubleSide;
 // Recessed diffusers sit flush with the soffit and use the same materials
 // as the wall reveals instead of adding light sources or transparent layers.
 for(let i=0;i<24;i++){
  const angle=(i+.5)/24*TAU,p=superpoint(94,112,angle);
  if(clearCore(p.x,p.z)||roomFootprint(p.x,p.z,1.1))continue;
  const normal=supernormal(94,112,angle),yaw=Math.atan2(normal.x,normal.z);
  b.add(1.25,.045,.62,p.x,ceiling-.052,p.z,m.housing,yaw);
  for(let slit=0;slit<7;slit++){
   const offset=-.24+slit*.08;
   b.add(1.10,.014,.023,p.x+normal.x*offset,ceiling-.082,p.z+normal.z*offset,m.reveal,yaw);
  }
 }
 b.flush();
 return trim;
}

export function buildConcessionEquipment(parent){
 const m=palette(),b=new Batches(parent);
 // Equipment stays on the existing countertop. The metal frame and kick
 // plate make the hatch read as a fitted unit from a walking eye height.
 b.add(5.65,.11,.065,0,.10,1.165,m.reveal);
 for(const side of[-1,1])b.add(.055,1.80,.07,side*2.88,2.04,1.10,m.steel);
 b.add(5.81,.055,.07,0,2.94,1.10,m.steel);
 b.add(.62,.035,.43,1.98,1.195,.85,m.reveal);
 b.add(.055,.24,.06,1.98,1.32,.76,m.steel);
 b.add(.47,.34,.055,1.98,1.54,.76,m.glass);
 b.add(.39,.23,.009,1.98,1.55,.793,m.screen);
 // A drip tray and two taps are attached to the back worktop.
 b.add(5.6,.06,.85,0,1.17,-.80,m.steel);
 b.add(.66,.035,.31,-1.92,1.218,-.56,m.steel);
 for(const x of[-2.08,-1.79]){
  b.add(.04,.49,.045,x,1.46,-.67,m.steel);
  b.add(.04,.045,.20,x,1.70,-.59,m.steel);
  b.add(.055,.12,.045,x,1.79,-.68,m.reveal);
 }
 b.flush();
}
