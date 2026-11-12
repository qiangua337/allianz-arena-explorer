import {THREE,mesh,box,canvasTexture,getCrestImage} from './kit.js';
const screenWidth=1536,screenHeight=864,screenBackground='#101b25';
const clockPanel={x:512,y:68,width:512,height:64,baseline:110};
const scorePanel={x:432,y:246,width:672,height:192,baseline:405};

function paintPanel(texture,panel,text,font,fill){
 const {x,y,width,height,baseline}=panel,c=texture.image.getContext('2d');
 c.fillStyle=screenBackground;c.fillRect(0,0,width,height);c.textAlign='center';
 c.font=font;c.fillStyle=fill;
 c.fillText(text,screenWidth/2-x,baseline-y,width);
 texture.needsUpdate=true;
}

function mountPanel(face,panel,material,name){
 const {width,height}=face.geometry.parameters;
 const w=panel.width/screenWidth,h=panel.height/screenHeight;
 const x=(panel.x/screenWidth+w/2-.5)*width,y=(.5-panel.y/screenHeight-h/2)*height;
 const overlay=mesh(new THREE.PlaneGeometry(width*w,height*h),material,face,x,y,.003);
 overlay.name=name;
 overlay.visible=false;
 return overlay;
}

export function buildArenaScreens(bowl,batch,{dark,steel}){
 const textures=[false,true].map(match=>canvasTexture(1536,864,c=>{
  const gradient=c.createLinearGradient(0,0,1536,864);gradient.addColorStop(0,'#1c2831');gradient.addColorStop(1,'#0d171e');c.fillStyle=gradient;c.fillRect(0,0,1536,864);c.fillStyle='#b01d35';c.fillRect(0,0,1536,16);c.textAlign='center';c.fillStyle='#b5c1c7';c.font='600 28px Arial';c.fillText(match?'PRE-MATCH · EXHIBITION':'MÜNCHEN · HOME OF FC BAYERN',768,96);
  if(match){c.drawImage(getCrestImage('home'),190,200,205,205);c.drawImage(getCrestImage('away'),1140,200,205,205);c.fillStyle='#f3f1e9';c.font='600 62px Arial';c.fillText('FC BAYERN',292,503);c.fillText('DORTMUND',1244,503);c.font='600 190px Arial';c.fillText('0 : 0',768,403);c.font='400 36px Arial';c.fillStyle='#aab9bd';c.fillText('11  vs  11',768,512);c.fillStyle='#b01d35';c.fillRect(190,591,205,7);c.fillStyle='#ddc132';c.fillRect(1140,591,205,7);}
  else{c.drawImage(getCrestImage('home'),632,175,272,272);c.fillStyle='#f1efe6';c.font='600 90px Arial';c.fillText('ALLIANZ ARENA',768,596);}
  c.fillStyle='#b7c4c8';c.font='500 32px Arial';c.fillText(match?'FC BAYERN MÜNCHEN × BORUSSIA DORTMUND':'WILLKOMMEN · MIA SAN MIA',768,756);
 }));
 const material=new THREE.MeshBasicMaterial({map:textures[0],toneMapped:false});
 const live=canvasTexture(screenWidth,screenHeight,()=>{});
 const clockTexture=canvasTexture(clockPanel.width,clockPanel.height,()=>{});
 const scoreTexture=canvasTexture(scorePanel.width,scorePanel.height,()=>{});
 // An opaque inset uses the existing basic shader and depth test. The small
 // depth bias keeps it on the LED surface even at the opposite goal.
 const makePanelMaterial=map=>new THREE.MeshBasicMaterial({map,toneMapped:false,polygonOffset:true,polygonOffsetUnits:-2});
 const clockMaterial=makePanelMaterial(clockTexture),scoreMaterial=makePanelMaterial(scoreTexture),overlays=[];
 for(const z of[-78,78]){
  const group=new THREE.Group();group.name='Arena LED scoreboard';group.position.set(0,42.5,z);if(z>0)group.rotation.y=Math.PI;
  bowl.add(group);box(group,19.4,11.3,.55,0,0,0,dark);
  const front=mesh(new THREE.PlaneGeometry(18.8,10.6),material,group,0,0,.3);
  const rear=mesh(new THREE.PlaneGeometry(8.1,4.55),material,group,0,0,-.3);rear.rotation.y=Math.PI;
  for(const face of[front,rear])overlays.push(mountPanel(face,clockPanel,clockMaterial,'Live LED clock'),mountPanel(face,scorePanel,scoreMaterial,'Live LED score'));
  for(const x of[-7,7])batch.add(.16,6,.16,x,46,z,steel);
 }
 let clubId,lastClock,lastScore;
 function paintClub(club){
  const c=live.image.getContext('2d');
  c.fillStyle=screenBackground;c.fillRect(0,0,screenWidth,screenHeight);
  c.fillStyle='#b01d35';c.fillRect(0,0,screenWidth,18);c.textAlign='center';
  c.drawImage(getCrestImage('home'),190,205,205,205);
  if(club.id==='dortmund')c.drawImage(getCrestImage('away'),1140,205,205,205);else{c.fillStyle=club.kit.shirt;c.beginPath();c.arc(1240,307,105,0,Math.PI*2);c.fill();c.fillStyle=club.kit.ink;c.font='bold 75px Arial';c.fillText(club.code,1240,335);}
  c.fillStyle='#f3f1e9';c.font='600 60px Arial';c.fillText('FC BAYERN',292,510);c.fillText(club.code,1240,510);
  c.font='400 34px Arial';c.fillStyle='#aab9bd';c.fillText('11  vs  11',768,520);c.fillText('FC BAYERN × '+club.english,768,740);
  live.needsUpdate=true;
 }
 return{
  setMatchday(on){material.map=textures[on?1:0];for(const overlay of overlays)overlay.visible=false;},
  setMatchScore(state){
   const club=state.fixture;if(!club)return;
   const seconds=Math.max(0,Math.ceil(state.duration-state.elapsed)),score=state.score.home+' : '+state.score.away;
   if(club.id!==clubId){clubId=club.id;paintClub(club);}
   if(seconds!==lastClock){
    lastClock=seconds;
    const clock=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    paintPanel(clockTexture,clockPanel,'EXHIBITION · '+clock,'500 32px Arial','#b7c4c8');
   }
   if(score!==lastScore){lastScore=score;paintPanel(scoreTexture,scorePanel,score,'600 180px Arial','#f3f1e9');}
   if(material.map!==live){material.map=live;for(const overlay of overlays)overlay.visible=true;}
  }
 };
}
