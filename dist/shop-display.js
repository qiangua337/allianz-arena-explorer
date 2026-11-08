import {THREE,v,mesh,box,beam,cylinder} from './kit.js';
import {contactShadow} from './finishes.js';
import {hangingJerseyGeometry,jerseyBumpTexture} from './wardrobe-detail.js';
import {drawJerseyArtwork} from './jersey-artwork.js';
import {playerByNumber,rosterInfo} from './roster.js';
import {shopFeature,shopWorld} from './shop-layout.js';

export function buildShopDisplay(parent,metal){
 const feature=shopFeature,root=new THREE.Group(),p=shopWorld(feature.x,feature.y,feature.z);root.name='Browse Bayern player shirts';root.position.set(p.x,p.y,p.z);parent.add(root);
 const base=cylinder(root,feature.radius,.12,0,-1.2,0,metal,40);base.name='Grounded rotating shirt plinth';box(root,.06,1.2,.06,0,-.6,0,metal);
 const shadow=contactShadow(parent,1.95,1.95,p.x,p.y-feature.y+.014,p.z,.22);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
 const hanger=new THREE.Group();hanger.rotation.y=Math.PI/2;root.add(hanger);
 const shirt=mesh(hangingJerseyGeometry(),new THREE.MeshStandardMaterial({map,bumpMap:jerseyBumpTexture(),bumpScale:.002,roughness:.94,alphaTest:.12,side:THREE.DoubleSide}),hanger,0,0,.066);shirt.scale.set(1.12,1.12,1);shirt.name='Current player shirt';
 for(const side of[-1,1])beam(hanger,v(side*.31,.45,0),v(0,.59,0),.009,metal,6);beam(hanger,v(-.31,.45,0),v(.31,.45,0),.009,metal,6);
 // An identification card stays readable while only the shirt turns.
 const cardCanvas=document.createElement('canvas');cardCanvas.width=640;cardCanvas.height=160;const cardMap=new THREE.CanvasTexture(cardCanvas);cardMap.colorSpace=THREE.SRGBColorSpace;cardMap.anisotropy=4;
 const card=mesh(new THREE.PlaneGeometry(.98,.245),new THREE.MeshBasicMaterial({map:cardMap,toneMapped:false,side:THREE.DoubleSide}),root,.19,-.69,0);card.rotation.y=Math.PI/2;card.name='Player identification card';
 let index=0;
 function paint(){const player=playerByNumber(feature.numbers[index]);drawJerseyArtwork(canvas.getContext('2d'),player.number,player.name,'#b71c37');map.needsUpdate=true;const c=cardCanvas.getContext('2d');c.fillStyle='#242b30';c.fillRect(0,0,640,160);c.fillStyle='#ead9b9';c.textAlign='center';c.font='bold 50px Arial';c.fillText(player.number+' · '+player.name,320,61,610);c.font='23px Arial';c.fillText(rosterInfo.season+'  ·  FC BAYERN',320,103);c.fillStyle='#c2c9c8';c.font='21px Arial';c.fillText('F · 下一件球衣',320,138);cardMap.needsUpdate=true;root.userData.playerNumber=player.number;root.userData.playerName=player.fullName;return player;}
 paint();
 return{root,position:p,get player(){return playerByNumber(feature.numbers[index]);},next(){index=(index+1)%feature.numbers.length;hanger.rotation.y+=Math.PI/4;return paint();},update(position){root.visible=shadow.visible=Math.abs(position.x-p.x)<25&&Math.abs(position.z-p.z)<24&&Math.abs(position.y-p.y)<8;}};
}
