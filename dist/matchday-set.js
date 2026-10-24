import {THREE,mat,mesh,box,cylinder,beam,v,Batches,sign,compactGroup,canvasTexture} from './kit.js';
export function buildMatchdaySet(parent,ball){
 const root=new THREE.Group();root.name='Matchday technical areas';root.visible=false;parent.add(root);const b=new Batches(root),navy=mat(0x26343b),red=mat(0xa62139),pale=mat(0xc8d3d0),steel=mat(0x8a999e,{metalness:.5,roughness:.4}),orange=mat(0xc17b38),rubber=mat(0x1c2729);
 for(const z0 of[-18,18]){
  // Drinks station, paper cups, bottle crates and medical cases.
  b.add(1.35,.07,.9,-35.7,.86,z0+9.6,navy);for(const x of[-36.2,-35.2])for(const z of[z0+9.3,z0+9.9])b.add(.04,.85,.04,x,.425,z,steel);
  for(let i=0;i<8;i++){cylinder(root,.035,.23,-36.15+(i%4)*.23,1.01,z0+9.4+Math.floor(i/4)*.28,pale,6);}b.add(.9,.48,.68,-38.2,.24,z0+9.5,red);b.add(.5,.08,.36,-38.2,.51,z0+9.5,pale);
  for(const z of[z0+7.6,z0+8.7]){b.add(.64,.4,.4,-35.8,.22,z,navy);b.add(.24,.08,.06,-35.8,.46,z,steel);const cross=sign(root,'+',.24,.24,-35.47,.27,z,{font:90,fg:'#d8ddd5'});cross.rotation.y=Math.PI/2;}
  // Folded stretcher sits outside the team circulation lane.
  b.add(.63,.08,1.9,-40.1,.44,z0+9,orange);for(const x of[-40.43,-39.77]){beam(root,v(x,.40,z0+7.9),v(x,.4,z0+10.1),.025,steel);for(const z of[z0+8.4,z0+9.5])b.add(.035,.4,.035,x,.2,z,steel);}
  // A restrained dashed technical-area boundary, outside the field touchline.
  for(let j=0;j<17;j++){b.add(.055,.006,.4,-34.8,.012,z0-9+j*1.1,pale);b.add(.055,.006,.4,-40.6,.012,z0-9+j*1.1,pale);}for(const z of[z0-9,z0+9])for(let x=-40.5;x<-34.9;x+=.8)b.add(.38,.006,.055,x,.012,z,pale);
 }
 // Fourth official's station and inactive substitution display.
 b.add(.85,.05,1.5,-37.4,1.15,3.8,navy);for(const x of[-37.7,-37.1])for(const z of[3.2,4.4])b.add(.04,1.1,.04,x,.58,z,steel);
 const board=box(root,.08,.55,.92,-36.8,1.05,4.0,rubber);const face=sign(root,'00  00',.83,.4,-36.75,1.05,4,{font:90,fg:'#87956a',bg:'#101718'});face.rotation.y=Math.PI/2;for(const z of[-2.6,2.6]){b.add(.4,.1,.4,-37.0,.05,z,rubber);b.add(.07,1.1,.07,-37,.6,z,steel);}
 b.flush();compactGroup(root);let velocity=v(),rolling=false,home=ball?.position.clone();
 return{root,setEnabled(on){root.visible=on;if(!on&&ball&&home){ball.position.copy(home);velocity.set(0,0,0);rolling=false;}},kick(position,yaw){if(!root.visible||!ball||position.y>3.2||Math.hypot(position.x-ball.position.x,position.z-ball.position.z)>2.3)return false;velocity.set(-Math.sin(yaw)*6.2,0,-Math.cos(yaw)*6.2);rolling=true;return true;},nearBall(position){return !!ball&&position.y<3.2&&Math.hypot(position.x-ball.position.x,position.z-ball.position.z)<2.3;},update(dt){if(!rolling||!ball)return;const t=Math.min(dt,.05);ball.position.addScaledVector(velocity,t);ball.rotation.x+=velocity.z*t/.11;ball.rotation.z-=velocity.x*t/.11;velocity.multiplyScalar(Math.exp(-1.15*t));if(Math.abs(ball.position.x)>33.7)velocity.x*=-.72,ball.position.x=THREE.MathUtils.clamp(ball.position.x,-33.7,33.7);if(Math.abs(ball.position.z)>52.2)velocity.z*=-.72,ball.position.z=THREE.MathUtils.clamp(ball.position.z,-52.2,52.2);if(velocity.length()<.03)rolling=false;},isAnimating:()=>rolling};
}
