import {canvasTexture,getCrestImage} from './kit.js';

export function pressBackdropTexture(){
 const width=typeof innerWidth==='number'&&innerWidth<=760?2048:4096;
 return canvasTexture(width,Math.round(width/5),(c,w,h)=>{
  c.scale(w/4096,h/820);c.fillStyle='#122d49';c.fillRect(0,0,4096,820);c.fillStyle='#f1f3ee';c.textAlign='center';c.textBaseline='middle';c.font='600 56px Arial';c.fillText('FC BAYERN MÜNCHEN',2048,61);
  const names=['T','adidas','Allianz','Audi','PAULANER','FC BAYERN'];
  for(let row=0;row<6;row++)for(let col=0;col<9;col++){
   const x=28+col*450,y=125+row*111,name=names[(row+col)%6];c.fillStyle='#f0f2ee';c.fillRect(x,y,436,101);c.strokeStyle='#d4dbd8';c.lineWidth=1;c.strokeRect(x+.5,y+.5,435,100);c.save();c.translate(x+218,y+51);c.fillStyle='#193b55';c.strokeStyle='#193b55';
   if(name==='T'){c.fillStyle='#d91b7b';c.font='bold 78px Arial';c.fillText('T',0,3);for(const xx of[-47,47])c.fillRect(xx-5,13,10,10);}
   else if(name==='Audi'){c.lineWidth=4;for(let k=0;k<4;k++){c.beginPath();c.ellipse(-47+k*31,0,25,24,0,0,Math.PI*2);c.stroke();}}
   else if(name==='adidas'){c.fillStyle='#17212a';c.save();c.translate(-85,19);c.rotate(-Math.PI/6);for(let k=0;k<3;k++)c.fillRect(k*23,-20-k*15,17,20+k*15);c.restore();c.font='bold 54px Arial';c.fillText('adidas',42,5);}
   else if(name==='Allianz'){c.font='600 52px Arial';c.fillText('Allianz',-23,4);c.lineWidth=3.5;c.beginPath();c.arc(102,0,28,0,Math.PI*2);c.stroke();for(let k=0;k<3;k++)c.fillRect(86+k*11,k===1?-17:-8,7,k===1?34:25);}
   else if(name==='FC BAYERN'){c.drawImage(getCrestImage('home'),-134,-35,70,70);c.font='600 42px Arial';c.fillText('FC BAYERN',50,3);}
   else{c.font='600 49px Georgia';c.fillText(name,0,3);}c.restore();
  }
 });
}
