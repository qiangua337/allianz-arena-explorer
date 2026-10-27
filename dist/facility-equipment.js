import {THREE,v,mat,mesh,box,beam,cylinder,addCrest} from './kit.js';
import {cushionGeometry,pipingGeometry} from './upholstery.js';
const backMaterials=new WeakMap();let cameraMaterials,backGeometry;

// Human-scale interpretations from venue photos. Not manufacturer CAD.
export function bucketSeatBackGeometry(){
 const sections=[[.12,.24],[.25,.255],[.52,.285],[.68,.27],[.79,.21],[.97,.18],[1.02,.15]],positions=[],indices=[],segments=12;
 for(const[y,half]of sections)for(let j=0;j<=segments;j++){const x=(j/segments*2-1)*half,z=-.22-.09*y+.10*(x/half)**2;positions.push(x,y,z);}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function buildBucketSeat(parent,{x=0,y=0,z=0,yaw=0,red,metal,dark,crest=true}){
 const g=new THREE.Group();g.name='Contoured dugout seat';g.position.set(x,y,z);g.rotation.y=yaw;parent.add(g);
 let leather=backMaterials.get(red);if(!leather){leather=red.clone();leather.side=THREE.DoubleSide;backMaterials.set(red,leather);}backGeometry||=bucketSeatBackGeometry();mesh(backGeometry,leather,g);mesh(new THREE.PlaneGeometry(.22,.12),leather,g,0,.91,-.29);
 const pan=mesh(cushionGeometry(.56,.58,.11),red,g,0,.10,0);pan.rotation.x=-Math.PI/2;mesh(pipingGeometry(.56,.58,.11),dark,pan);
 const insert=mesh(cushionGeometry(.34,.55,.07),red,g,0,.47,-.22);insert.rotation.x=-.1;mesh(pipingGeometry(.34,.55,.07),dark,insert);
 for(const side of[-1,1]){const bolster=mesh(cushionGeometry(.075,.62,.12),red,g,side*.25,.45,-.19);bolster.rotation.z=-side*.16;const arm=mesh(cushionGeometry(.065,.36,.08),dark,g,side*.34,.30,.02);arm.rotation.x=-Math.PI/2;beam(g,v(side*.29,.0,-.17),v(side*.34,.28,-.10),.015,metal,6);}
 box(g,.48,.08,.48,0,-.025,-.01,dark);for(const side of[-1,1])beam(g,v(side*.19,-.28,-.14),v(side*.19,.02,-.14),.023,metal,8);
 if(crest)addCrest(g,.125,0,.84,-.242);return g;
}
export function buildBroadcastCamera(parent,{x=0,y=0,z=0,yaw=0,compact=false}={}){
 const g=new THREE.Group();g.name='Broadcast camera with fluid head and controls';g.position.set(x,y,z);g.rotation.y=yaw;parent.add(g);
 cameraMaterials||={dark:mat(0x20292e),metal:mat(0x9ca8ad,{metalness:.72,roughness:.30}),glass:mat(0x18333e,{metalness:.28,roughness:.12}),red:mat(0xb32639)};const {dark,metal,glass,red}=cameraMaterials,height=compact?.82:1.65;
 for(let i=0;i<3;i++){const t=i/3*Math.PI*2;beam(g,v(Math.sin(t)*.08,height-.30,Math.cos(t)*.08),v(Math.sin(t)*.38,.03,Math.cos(t)*.38),.025,metal,6);beam(g,v(Math.sin(t)*.20,height*.45,Math.cos(t)*.20),v(0,height*.39,0),.01,dark,6);cylinder(g,.04,.02,Math.sin(t)*.38,.02,Math.cos(t)*.38,dark,8);}
 cylinder(g,.09,.10,0,height-.19,0,dark,12);box(g,.35,.24,.46,0,height,0,dark);box(g,.32,.27,.30,0,height,.29,dark);const lens=cylinder(g,.105,.20,0,height,.48,dark,20);lens.rotation.x=Math.PI/2;const front=cylinder(g,.083,.009,0,height,.584,glass,20);front.rotation.x=Math.PI/2;
 for(const dz of[.39,.47,.54])mesh(new THREE.TorusGeometry(.107,.008,4,20),metal,g,0,height,dz);
 box(g,.22,.15,.035,.27,height+.08,-.02,dark);box(g,.192,.12,.008,.27,height+.08,-.043,glass);beam(g,v(-.12,height-.09,-.15),v(-.26,height-.17,-.50),.014,metal,6);beam(g,v(.12,height-.09,-.15),v(.26,height-.17,-.50),.014,metal,6);box(g,.16,.10,.21,0,height+.18,-.02,dark);box(g,.10,.025,.025,0,height+.23,.096,red);
 const cable=new THREE.CatmullRomCurve3([v(.13,height-.10,-.24),v(.23,.6,-.4),v(.38,.04,-.5),v(.56,.025,-.7)]);mesh(new THREE.TubeGeometry(cable,12,.008,4,false),dark,g);return g;
}
export function buildTreatmentTable(parent,{x=0,z=0,metal,dark,pad}){
 const g=new THREE.Group();g.name='Adjustable treatment table';g.position.set(x,0,z);parent.add(g);
 box(g,1.58,.08,.56,0,.12,0,metal);for(const side of[-1,1]){beam(g,v(-.65,.20,side*.25),v(.57,.80,side*.25),.025,metal,8);beam(g,v(.65,.20,side*.25),v(-.57,.80,side*.25),.025,metal,8);const hub=cylinder(g,.045,.065,0,.49,side*.26,dark,12);hub.rotation.x=Math.PI/2;}
 for(const xx of[-.77,.77])for(const zz of[-.25,.25]){const wheel=cylinder(g,.055,.045,xx,.075,zz,dark,10);wheel.rotation.x=Math.PI/2;}
 box(g,1.93,.07,.71,0,.83,0,metal);const body=mesh(cushionGeometry(1.55,.76,.10),pad,g,-.21,.925,0);body.rotation.x=-Math.PI/2;const head=mesh(cushionGeometry(.46,.76,.10),pad,g,.82,.95,0);head.rotation.x=-Math.PI/2;head.rotation.z=-.07;
 const aperture=mesh(new THREE.TorusGeometry(.063,.017,8,24),dark,g,.83,1.012,0);aperture.rotation.x=-Math.PI/2;box(g,.20,.045,.14,.58,.045,.31,dark);return g;
}
