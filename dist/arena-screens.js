import {THREE,mesh,box,canvasTexture,getCrestImage} from './kit.js';
export function buildArenaScreens(bowl,batch,{dark,steel}){
 const textures=[false,true].map(match=>canvasTexture(1536,864,c=>{
  const gradient=c.createLinearGradient(0,0,1536,864);gradient.addColorStop(0,'#1c2831');gradient.addColorStop(1,'#0d171e');c.fillStyle=gradient;c.fillRect(0,0,1536,864);c.fillStyle='#b01d35';c.fillRect(0,0,1536,16);c.textAlign='center';c.fillStyle='#b5c1c7';c.font='600 28px Arial';c.fillText(match?'PRE-MATCH · EXHIBITION':'MÜNCHEN · HOME OF FC BAYERN',768,96);
  if(match){c.drawImage(getCrestImage('home'),190,200,205,205);c.drawImage(getCrestImage('away'),1140,200,205,205);c.fillStyle='#f3f1e9';c.font='600 62px Arial';c.fillText('FC BAYERN',292,503);c.fillText('DORTMUND',1244,503);c.font='600 190px Arial';c.fillText('0 : 0',768,403);c.font='400 36px Arial';c.fillStyle='#aab9bd';c.fillText('11  vs  11',768,512);c.fillStyle='#b01d35';c.fillRect(190,591,205,7);c.fillStyle='#ddc132';c.fillRect(1140,591,205,7);}
  else{c.drawImage(getCrestImage('home'),632,175,272,272);c.fillStyle='#f1efe6';c.font='600 90px Arial';c.fillText('ALLIANZ ARENA',768,596);}
  c.fillStyle='#b7c4c8';c.font='500 32px Arial';c.fillText(match?'FC BAYERN MÜNCHEN × BORUSSIA DORTMUND':'WILLKOMMEN · MIA SAN MIA',768,756);
 }));
 const material=new THREE.MeshBasicMaterial({map:textures[0],toneMapped:false});for(const z of[-78,78]){const group=new THREE.Group();group.name='Arena LED scoreboard';group.position.set(0,40.8,z);if(z>0)group.rotation.y=Math.PI;bowl.add(group);box(group,19.4,11.3,.55,0,0,0,dark);mesh(new THREE.PlaneGeometry(18.8,10.6),material,group,0,0,.3);for(const x of[-7,7])batch.add(.16,6,.16,x,46,z,steel);}
 return{setMatchday(on){material.map=textures[on?1:0];}};
}
