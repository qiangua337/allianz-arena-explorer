import {THREE,mat,mesh,box,cylinder,canvasTexture,fittedSign,compactGroup} from './kit.js';
import {tacticalBoardLayout,tacticalFormations} from './tactical-layout.js';

// A 105:68 field retains its proportions inside the landscape board artwork.
export const tacticalPitchArtwork=Object.freeze({x:38,y:66,width:690,height:690*68/105});
export function drawTacticalArtwork(c,w,h,formation=0,guest=false){
 const f=tacticalFormations[formation],p=tacticalPitchArtwork;
 c.save();c.scale(w/1000,h/560);c.fillStyle='#e9e8dd';c.fillRect(0,0,1000,560);
 c.fillStyle='#293d40';c.font='600 23px Microsoft YaHei,Arial';c.textAlign='left';c.fillText(guest?'客队 · 训练战术板':'主队 · 训练战术板',30,35);
 c.fillStyle='#65736e';c.font='14px Arial';c.fillText('TRAINING ROOM / MAGNETIC TACTICS',484,34);
 c.fillStyle='#244c43';c.fillRect(p.x,p.y,p.width,p.height);
 c.strokeStyle='#d0dfce';c.lineWidth=2;c.strokeRect(p.x,p.y,p.width,p.height);
 const x=m=>p.x+m/105*p.width,y=m=>p.y+m/68*p.height;
 c.beginPath();c.moveTo(x(52.5),y(0));c.lineTo(x(52.5),y(68));c.stroke();
 c.beginPath();c.arc(x(52.5),y(34),p.width*9.15/105,0,Math.PI*2);c.stroke();
 for(const side of[0,1]){
  c.strokeRect(x(side?105-16.5:0),y((68-40.32)/2),p.width*16.5/105,p.height*40.32/68);
  c.strokeRect(x(side?105-5.5:0),y((68-18.32)/2),p.width*5.5/105,p.height*18.32/68);
  c.strokeRect(x(side?105:-1.5),y((68-7.32)/2),p.width*1.5/105,p.height*7.32/68);
  c.beginPath();c.arc(x(side?94:11),y(34),2.2,0,Math.PI*2);c.fillStyle='#d0dfce';c.fill();
  c.beginPath();c.arc(x(side?94:11),y(34),p.width*9.15/105,side?Math.PI-.92:-.92,side?Math.PI+.92:.92);c.stroke();
 }
 for(const[role,rx,ry]of f.roles){
  const px=p.x+rx*p.width,py=p.y+ry*p.height;
  c.fillStyle='#10271e66';c.beginPath();c.arc(px+1.3,py+2.5,17,0,Math.PI*2);c.fill();
  c.fillStyle=role==='GK'?'#e4c781':guest?'#dfbd53':'#ae243a';c.beginPath();c.arc(px,py,17,0,Math.PI*2);c.fill();
  c.strokeStyle='#eee9db';c.lineWidth=1.5;c.stroke();c.textAlign='center';c.font='bold 13px Arial';c.fillStyle=role==='GK'||guest?'#253b3d':'#fff5e7';c.fillText(role,px,py+4.5);
 }
 c.textAlign='left';c.fillStyle='#283f40';c.font='bold 38px Arial';c.fillText(f.name,770,111);
 c.fillStyle='#64716c';c.font='16px Microsoft YaHei,Arial';c.fillText('训练阵型示意',770,147);
 c.strokeStyle='#bdc5b8';c.lineWidth=1;c.beginPath();c.moveTo(770,174);c.lineTo(963,174);c.stroke();
 for(const[i,text]of ['GK  门将','CB / LB / RB  后卫','DM / CM  中场','AM / LW / RW  前场','ST  前锋'].entries()){c.font='15px Microsoft YaHei,Arial';c.fillStyle='#475b55';c.fillText(text,770,211+i*32);}
 c.fillStyle='#7b8478';c.font='13px Microsoft YaHei,Arial';c.fillText('位置标记，非球衣号码',770,412);c.fillText('F  切换阵型',770,466);
 c.fillStyle='#5b6b64';c.font='13px Microsoft YaHei,Arial';c.fillText('进攻方向  →',38,540);c.textAlign='right';c.fillText('示意陈设 · 非官方实时首发',967,540);c.restore();
}
export function buildTacticalBoard(parent,{roomId,spec,metal,dark}){
 const b=tacticalBoardLayout,guest=roomId==='guestRoom',root=new THREE.Group();root.name=roomId+' magnetic tactical board';root.position.set(spec.w/2-b.inset,b.y,b.z);root.rotation.y=-Math.PI/2;parent.add(root);
 const frame=mat(0x9aa8a8,{metalness:.7,roughness:.36}),white=mat(0xe8e7db,{roughness:.8}),red=mat(guest?0xd0ad43:0xa7263c,{roughness:.6});
 box(root,b.width+.13,b.height+.13,.065,0,0,-.047,dark);
 for(const x of[-1,1])box(root,.038,b.height+.105,.046,x*(b.width/2+.028),0,-.002,frame);
 for(const y of[-1,1])box(root,b.width+.11,.038,.046,0,y*(b.height/2+.028),-.002,frame);
 const texture=canvasTexture(b.textureWidth,b.textureHeight,(c,w,h)=>drawTacticalArtwork(c,w,h,0,guest));texture.anisotropy=4;
 const display=mesh(new THREE.PlaneGeometry(b.width,b.height),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),root);display.name=roomId+' tactical diagram';
 const trayY=-b.height/2-.13;
 box(root,2.56,.027,.22,0,trayY,.07,metal);box(root,2.56,.045,.022,0,trayY+.012,.18,frame);
 for(const side of[-1,1])box(root,.045,.16,.10,side*1.11,trayY+.02,-.02,metal);
 // Pens lie in the lip of the real tray, with barrel ends and separate caps.
 for(const[i,color]of [red,dark].entries()){
  const pen=cylinder(root,.015,.23,-.75+i*.31,trayY+.029,.09,white,10);pen.rotation.z=Math.PI/2;
  const cap=cylinder(root,.0165,.052,-.75+i*.31+.09,trayY+.029,.09,color,10);cap.rotation.z=Math.PI/2;
 }
 box(root,.16,.038,.065,.32,trayY+.032,.09,dark);
 box(root,1.30,.18,.02,.50,-b.height/2-.38,-.172,dark);
 fittedSign(root,'对准战术板 · F 切换阵型',1.24,.13,.50,-b.height/2-.38,-.160,{font:93,fg:'#e7e7d9',bg:'#35494a'});
 // Static metal and stationery are merged; only two small canvases are ever
 // redrawn, and only when their own board is operated.
 compactGroup(root,[display]);let current=0;
 return{root,display,get formation(){return current;},setFormation(value){const next=Number(value)===1?1:0;if(next!==current){current=next;drawTacticalArtwork(texture.image.getContext('2d'),b.textureWidth,b.textureHeight,current,guest);texture.needsUpdate=true;}return tacticalFormations[current].name;}};
}
