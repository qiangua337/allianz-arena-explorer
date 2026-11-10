import {THREE,canvasTexture} from './kit.js';
export const faceTextureWindow=[.60,.15,1,.87];
export const athleteAtlasCells={face:[0,0,.34,.5],skin:[.34,0,.16,.5],hands:[.34,0,.16,.5],wrists:[.34,0,.16,.5],keeperWrists:[.34,0,.16,.5],shirt:[.5,0,.5,.5],shorts:[0,.5,.25,.25],socks:[.25,.5,.25,.25],bootL:[.5,.5,.25,.25],bootR:[.5,.5,.25,.25],eyes:[.75,.5,.25,.25],eyebrows:[0,.75,.25,.25],short02:[.25,.75,.5,.25],crop:[.25,.75,.5,.25],gloves:[.75,.75,.25,.25],gloveCuffs:[.75,.75,.25,.25]};
const cells=athleteAtlasCells;
export function atlasGeometry(geometries,hair,{keeper=false}={}){
 const parts=Object.entries(geometries).filter(([name])=>(!['short02','crop'].includes(name)||name===hair)&&(!['gloves','gloveCuffs','keeperWrists'].includes(name)||keeper)&&(!['hands','wrists'].includes(name)||!keeper)),total=parts.reduce((sum,[,g])=>sum+g.attributes.position.count,0),result=new THREE.BufferGeometry(),ranges={};
 for(const[name,size]of Object.entries({position:3,normal:3,uv:2,skinIndex:4,skinWeight:4})){const out=name==='skinIndex'?new Uint16Array(total*size):new Float32Array(total*size);let offset=0;for(const[part,g]of parts){const source=g.attributes[name];for(let i=0;i<source.count;i++)for(let j=0;j<size;j++){let value=source.array[i*size+j];if(name==='uv'){if(part==='socks'||part==='shorts')value=((value%1)+1)%1;if(part==='face')value=(value-faceTextureWindow[j])/(faceTextureWindow[j+2]-faceTextureWindow[j]);const cell=cells[part];value=j===0?cell[0]+.002+value*(cell[2]-.004):1-cell[1]-cell[3]+.002+value*(cell[3]-.004);}out[(offset+i)*size+j]=value;}offset+=source.count;}result.setAttribute(name,new THREE.BufferAttribute(out,size));}
 const indices=[];let offset=0;for(const[part,g]of parts){ranges[part]={start:offset,count:g.attributes.position.count};for(const i of g.index.array)indices.push(i+offset);offset+=g.attributes.position.count;}result.setIndex(indices);result.computeBoundingSphere();result.userData.parts=ranges;return result;
}
function kitColors(d){const official=d.team==='official',staff=['coach','assistant','doctor','physio'].includes(d.role),away=d.team==='away';return{shirt:official?'#77cbd1':staff?'#27343c':d.keeper?(away?'#9584b2':'#176f62'):away?d.kit?.shirt||'#ebcc3d':'#bb1d32',shorts:official||staff?'#222c31':d.keeper?(away?'#6b5f85':'#176f62'):away?d.kit?.shorts||'#222c31':'#ab182c',ink:away&&!d.keeper?d.kit?.ink||'#222c31':'#f4f1e8',socks:official||staff?'#27343c':away&&!d.keeper?d.kit?.socks||'#dfdfd6':'#dfdfd6'};}
export function drawBootTexture(c,w,h){
 c.save();c.scale(w/256,h/256);c.fillStyle='#e6e9e2';c.fillRect(0,0,256,256);
 c.fillStyle='#c4cec9';c.fillRect(0,218,200,38);c.fillStyle='#2b3439';c.fillRect(199,0,57,256);c.fillStyle='#747f80';c.fillRect(224,0,16,256);
 c.strokeStyle='#a8b3ae';c.lineWidth=1.4;for(const x of[7,92,188]){c.beginPath();c.moveTo(x,20);c.bezierCurveTo(x+8,80,x-6,156,x+2,224);c.stroke();}
 for(let y=30;y<92;y+=10)for(let x=23;x<78;x+=9){c.fillStyle='#bdc8c0';c.beginPath();c.arc(x,y,1,0,Math.PI*2);c.fill();}
 c.fillStyle='#bec9c2';c.fillRect(34,99,34,90);c.strokeStyle='#fbfcf6';c.lineWidth=3.5;for(let y=108;y<184;y+=12){c.beginPath();c.moveTo(36,y);c.lineTo(65,y+6);c.stroke();}c.restore();
}
// Original generic keeper equipment: latex palm, contrasting padded backhand
// panels and a broad wrist fastening. It occupies an unused atlas cell.
export function drawGloveTexture(c,w,h){
 c.save();c.scale(w/256,h/256);c.fillStyle='#f2f2e7';c.fillRect(0,0,256,256);
 c.fillStyle='#bbd780';c.beginPath();c.roundRect(37,97,56,73,12);c.fill();c.strokeStyle='#839d60';c.lineWidth=2;c.stroke();
 c.strokeStyle='#8ba466';c.lineWidth=2;for(const x of[48,61,74,85]){c.beginPath();c.moveTo(x,109);c.lineTo(x+2,150);c.stroke();}
 c.strokeStyle='#cad0c7';c.lineWidth=2;for(const x of[150,174,198,222]){c.beginPath();c.moveTo(x,22);c.lineTo(x+4,122);c.stroke();}c.beginPath();c.moveTo(145,163);c.bezierCurveTo(160,147,202,145,237,166);c.stroke();
 c.fillStyle='#c3ccc0';for(let y=137;y<202;y+=8)for(let x=142;x<244;x+=8){c.beginPath();c.arc(x,y,.65,0,Math.PI*2);c.fill();}
 c.fillStyle='#142932';c.fillRect(0,207,256,49);c.fillStyle='#99b66d';c.fillRect(7,219,242,19);c.strokeStyle='#e0e6d6';c.lineWidth=2;c.strokeRect(9,215,238,27);c.restore();
}
export function characterAtlas(d,textures,jerseyTexture,size=1024){
 const colors=kitColors(d),jersey=jerseyTexture(d,d.team==='away'?(d.club&&d.club.id!=='dortmund'?null:textures.awayCrest):textures.crest,colors);
 const texture=canvasTexture(size,size,c=>{c.scale(size,size);for(const[name,cell]of Object.entries(cells)){if(['bootR','crop','short02','hands','wrists','keeperWrists','gloveCuffs'].includes(name))continue;c.save();c.beginPath();c.rect(...cell);c.clip();c.fillStyle=name==='skin'||name==='face'?'#b29275':colors[name]||'#eee';if(name==='eyebrows')c.clearRect(...cell);else c.fillRect(...cell);const image=name==='skin'||name==='face'?(d.dark?textures.dark:textures.light).image:name==='shirt'?jersey.image:name==='eyes'?textures.eyes.image:name==='eyebrows'?textures.brows.image:name==='bootL'?textures.boot.image:null;
   if(image){if(name==='face'){const[u0,v0,u1,v1]=faceTextureWindow;c.drawImage(image,u0*image.width,(1-v1)*image.height,(u1-u0)*image.width,(v1-v0)*image.height,...cell);}else c.drawImage(image,...cell);}
   if(name==='bootL'){c.globalCompositeOperation='multiply';c.fillStyle=new THREE.Color(d.boot||0xcac6bd).getStyle();c.fillRect(...cell);}if(name==='gloves'){c.translate(cell[0],cell[1]);drawGloveTexture(c,cell[2],cell[3]);}c.restore();}
  const cell=cells.short02;c.save();c.beginPath();c.rect(...cell);c.clip();c.clearRect(...cell);if(d.hair==='crop'){c.fillStyle='#27231e';c.fillRect(...cell);}else{c.drawImage(textures.short02.image,...cell);c.globalCompositeOperation='multiply';c.fillStyle=new THREE.Color(d.hairColor||0x9a8476).getStyle();c.fillRect(...cell);c.globalCompositeOperation='destination-in';c.drawImage(textures.short02.image,...cell);}c.restore();
 });jersey.dispose();return texture;
}
export function drawJersey(d,crest,colors){return canvasTexture(1024,1024,c=>{
 c.fillStyle=colors.shirt;c.fillRect(0,0,1024,1024);if(d.kit?.pattern==='stripes'&&!d.keeper&&['player','substitute'].includes(d.role)){c.fillStyle='#a62848';for(let x=0;x<1024;x+=128)c.fillRect(x,0,64,1024);}c.strokeStyle='rgba(20,0,0,.055)';c.lineWidth=2;for(let y=0;y<1024;y+=36){c.beginPath();c.moveTo(0,y);c.lineTo(1024,y);c.stroke();}c.fillStyle='rgba(255,255,255,.03)';for(let y=0;y<1024;y+=5)c.fillRect(0,y,1024,1);
 const player=d.player,club=d.team==='away'?d.club?.english||'BORUSSIA DORTMUND':d.team==='official'?'MATCH OFFICIAL':d.role==='player'||d.role==='substitute'?'FC BAYERN MÜNCHEN':'FC BAYERN · STAFF';c.fillStyle=colors.ink;c.textAlign='center';c.font='bold 43px Arial';c.fillText(club,768,214,292);
 if(player.number){c.font='bold 475px Arial';c.fillText(String(player.number),768,640,player.number<10?120:190);}else{c.font='bold 96px Arial';c.fillText(player.name,768,510,285);}
 c.font='bold 52px Arial';c.fillText(player.name,768,755,290);if(crest&&d.team!=='official')c.drawImage(crest,327,240,53,102);else if(d.club){c.strokeStyle=colors.ink;c.lineWidth=5;c.strokeRect(327,263,53,67);c.font='bold 21px Arial';c.fillText(d.club.code,353,304,46);}
 if(d.team==='official'){c.fillStyle='#18292d';c.fillRect(192,350,128,24);c.fillRect(315,350,92,9);c.font='bold 30px Arial';c.fillText('REFEREE',256,530);}else if(['doctor','physio'].includes(d.role)){c.font='bold 57px Arial';c.fillText('MEDICAL',256,520);}else{c.font='bold 100px Arial';c.fillText(d.team==='away'?d.club?.code||'DORTMUND':'T',256,535,d.team==='away'?230:75);}
 c.strokeStyle='rgba(255,255,245,.5)';c.lineWidth=3;for(const offset of[0,512])for(const x of[49,463]){c.beginPath();c.moveTo(offset+x,190);c.lineTo(offset+x,315);c.stroke();}
 });}
