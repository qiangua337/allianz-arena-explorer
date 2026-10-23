import {THREE,mat,mesh,box,cylinder,canvasTexture,seeded} from './kit.js';
import {finishedBox} from './finishes.js';
import {playerByNumber} from './roster.js';
import {entranceFloor} from './matchday-route.js';

function fanAtlas(){return canvasTexture(1024,256,c=>{
 const skin=['#d8aa85','#b9815d','#e1b595','#76513f','#d3a286','#b58460','#e2b995','#926548'],shirts=['#a51b34','#f0e9dc','#ba233b','#363a40','#d02038','#b41e36','#ddd7cc','#8f1a30'];
 for(let i=0;i<8;i++){c.save();c.translate(i*128,0);c.lineCap='round';c.strokeStyle='#24292d';c.lineWidth=14;c.beginPath();c.moveTo(54,168);c.lineTo(52,232);c.moveTo(74,168);c.lineTo(78,232);c.stroke();c.fillStyle='#20252a';c.fillRect(40,232,20,9);c.fillRect(70,232,23,9);
  c.strokeStyle=shirts[i];c.lineWidth=14;c.beginPath();c.moveTo(43,87);c.lineTo(i%3===0?25:32,i%3===0?44:141);c.moveTo(85,87);c.lineTo(i%3===0?104:97,i%3===0?42:137);c.stroke();
  c.fillStyle=shirts[i];c.beginPath();c.moveTo(45,76);c.quadraticCurveTo(64,68,84,76);c.lineTo(87,171);c.quadraticCurveTo(64,182,41,171);c.closePath();c.fill();c.fillStyle=skin[i];c.fillRect(58,57,13,22);c.beginPath();c.ellipse(64,43,15,21,0,0,Math.PI*2);c.fill();c.fillStyle=i%2?'#574133':'#292b2b';c.beginPath();c.ellipse(64,30,15,10,0,Math.PI,Math.PI*2);c.fill();
  for(const[x,y]of i%3===0?[[25,39],[104,37]]:[[32,145],[97,141]]){c.fillStyle=skin[i];c.beginPath();c.ellipse(x,y,6,7,0,0,Math.PI*2);c.fill();}
  if(i%3===0){c.fillStyle='#e8ddd0';c.fillRect(21,26,87,9);c.fillStyle='#ae1d36';for(let x=25;x<107;x+=14)c.fillRect(x,26,7,9);}
  c.strokeStyle=i%2?'#a02034':'#e8d6c6';c.lineWidth=4;c.beginPath();c.moveTo(53,78);c.lineTo(56,127);c.moveTo(77,78);c.lineTo(73,132);c.stroke();c.restore();
 }
});}

export function buildMatchdayCrowd(parent,seats,{mobile=false,reducedMotion=false}={}){
 const root=new THREE.Group();root.name='Matchday supporters, flags and camera glints';root.visible=false;parent.add(root);
 const time={value:0},atlas=fanAtlas(),material=new THREE.MeshBasicMaterial({map:atlas,alphaTest:.45,side:THREE.DoubleSide,toneMapped:true});material.onBeforeCompile=shader=>{shader.uniforms.fanTime=time;shader.vertexShader='attribute float fanTile; uniform float fanTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv.x=(.012+vMapUv.x*.976+fanTile)/8.;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=max(position.y,0.)*.018*sin(fanTime*2.2+instanceMatrix[3].x*.19+instanceMatrix[3].z*.13); transformed.y+=.014*sin(fanTime*3.4+instanceMatrix[3].z*.4);');};material.customProgramCacheKey=()=> 'matchday-supporters-v1';
 const random=seeded(714),dummy=new THREE.Object3D();let count=0;
 for(let sector=0;sector<24;sector++){
  const occupied=seats.filter((s,i)=>s.sector===sector&&(mobile?i%3!==0:i%13!==0));count+=occupied.length;const geo=new THREE.PlaneGeometry(.59,1.38).translate(0,.69,0),tiles=new Float32Array(occupied.length),fans=new THREE.InstancedMesh(geo,material,occupied.length);
  occupied.forEach((s,i)=>{dummy.position.set(s.x,s.y-.19,s.z);dummy.rotation.set(0,s.yaw+Math.PI,0);dummy.scale.set(.9+random()*.16,.91+random()*.17,1);dummy.updateMatrix();fans.setMatrixAt(i,dummy.matrix);tiles[i]=Math.floor(random()*8);});geo.setAttribute('fanTile',new THREE.InstancedBufferAttribute(tiles,1));fans.computeBoundingSphere();root.add(fans);
 }
 const flagMap=canvasTexture(256,128,c=>{c.fillStyle='#b41936';c.fillRect(0,0,256,128);c.fillStyle='#ece5d7';c.fillRect(0,50,256,24);c.font='bold 26px Arial';c.textAlign='center';c.fillText('MIA SAN MIA',128,33);c.font='bold 22px Arial';c.fillText('FC BAYERN',128,108);}),flagMat=new THREE.MeshBasicMaterial({map:flagMap,side:THREE.DoubleSide});flagMat.onBeforeCompile=shader=>{shader.uniforms.fanTime=time;shader.vertexShader='uniform float fanTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(position.x*4.-fanTime*3.)*.12*(position.x+.8);');};flagMat.customProgramCacheKey=()=> 'matchday-flags-v1';
 const poles=mat(0xaab3b5,{metalness:.35}),flagSeats=seats.filter((s,i)=>Math.abs(s.z)>77&&s.y>12&&s.y<23&&i%97===0).slice(0,10);
 for(const s of flagSeats){const g=new THREE.Group();g.position.set(s.x,s.y,s.z);g.rotation.y=s.yaw+Math.PI;root.add(g);cylinder(g,.016,2.1,-.78,1.05,0,poles,5);mesh(new THREE.PlaneGeometry(1.6,.85,10,5),flagMat,g,0,1.66,0);}
 const glintsGeo=new THREE.BufferGeometry(),points=[],phases=[];for(let i=0;i<75;i++){const s=seats[Math.floor(random()*seats.length)];points.push(s.x,s.y+1.1,s.z);phases.push(random()*90);}glintsGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));glintsGeo.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));const glints=new THREE.Points(glintsGeo,new THREE.ShaderMaterial({uniforms:{fanTime:time},transparent:true,depthWrite:false,vertexShader:'uniform float fanTime; attribute float phase; varying float flash; void main(){flash=pow(max(0.,sin(fanTime*.9+phase)),70.);gl_PointSize=2.4;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float flash; void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.9,.95,1.,flash*(1.-smoothstep(.05,.5,d)));}'}));glints.visible=!reducedMotion;root.add(glints);
 return{root,count,setEnabled(on){root.visible=on;},update(seconds){time.value=reducedMotion?0:seconds;}};
}

