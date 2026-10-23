import {THREE,mat,mesh,canvasTexture} from './kit.js';
import {playerByNumber} from './roster.js';
import {entranceFloor} from './matchday-route.js';
import {sampleQueuePlayer} from './entrance-choreography.js';

const asset=name=>new URL('./assets/players/'+name,import.meta.url).href;
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
// One full left/right gait covers 1.3 m. Stance advances backwards at walking
// speed, so a planted foot stays on the floor as the player's body advances.
export function footballStride(distance,side=0){
 const phase=((distance/1.3+side*.5)%1+1)%1,stance=.58;
 if(phase<stance){const t=phase/stance;return{z:.377-.754*t,lift:0,roll:-.10*(1-t)+.12*t,swing:false};}
 const t=(phase-stance)/(1-stance),s=t*t*(3-2*t);
 return{z:-.377+.754*s,lift:.13*Math.sin(Math.PI*t),roll:-.16*Math.sin(Math.PI*t),swing:true};
}

function jerseyTexture(player,crest,goalkeeper){return canvasTexture(1024,1024,c=>{
 const base=goalkeeper?'#176f62':'#c51d32',dark=goalkeeper?'#135e54':'#b8192c';c.fillStyle=base;c.fillRect(0,0,1024,1024);
 // Tonal knit and repeating diamonds remain quieter than the name/number.
 c.strokeStyle=dark;c.lineWidth=2;for(let y=-70;y<1100;y+=86)for(let x=-40;x<1100;x+=86){c.beginPath();c.moveTo(x,y-42);c.lineTo(x+40,y);c.lineTo(x,y+42);c.lineTo(x-40,y);c.closePath();c.stroke();}
 c.fillStyle='rgba(255,255,255,.026)';for(let y=0;y<1024;y+=5)c.fillRect(0,y,1024,1);
 c.fillStyle='#f3eee5';c.textAlign='center';c.font='bold 50px Arial';c.fillText('FC BAYERN MÜNCHEN',768,214,292);c.font='bold 475px Arial';c.fillText(String(player.number),768,640,player.number<10?120:190);c.font='bold 55px Arial';c.fillText(player.name,768,755,290);c.font='bold 23px Arial';c.fillText('MIA SAN MIA',768,111);
 if(crest)c.drawImage(crest,327,240,53,102);
 c.font='bold 200px Arial';c.fillText('T',254,535,75);c.fillRect(198,487,10,19);c.fillRect(299,487,10,19);
 c.font='bold 19px Arial';c.fillText('MIA SAN MIA',256,718);
 // Stitched sleeve trim and shoulder piping, integrated in the cloth UVs.
 c.strokeStyle='rgba(255,255,245,.65)';c.lineWidth=3;for(const offset of[0,512])for(const x of[49,463]){c.beginPath();c.moveTo(offset+x,190);c.lineTo(offset+x,315);c.stroke();}
 c.strokeStyle='rgba(65,3,13,.28)';c.lineWidth=2;c.beginPath();c.moveTo(0,930);c.lineTo(1024,930);c.stroke();
});}

function knitTexture(){return canvasTexture(128,128,c=>{c.fillStyle='#858585';c.fillRect(0,0,128,128);for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){c.fillStyle=(x+y)%8?'#a2a2a2':'#666';c.fillRect(x,y,1,3);}});}

function makeGeometry(binary,part){
 const a=new Float32Array(binary,part.offset,part.vertices*16),g=new THREE.BufferGeometry(),attributes={position:3,normal:3,uv:2,skinIndex:4,skinWeight:4};let offset=0;
 for(const[name,size]of Object.entries(attributes)){const out=name==='skinIndex'?new Uint16Array(part.vertices*size):new Float32Array(part.vertices*size);for(let i=0;i<part.vertices;i++)for(let j=0;j<size;j++)out[i*size+j]=a[i*16+offset+j];g.setAttribute(name,new THREE.BufferAttribute(out,size));offset+=size;}
 g.setIndex(new THREE.BufferAttribute(new Uint16Array(binary,part.indexOffset,part.indexCount),1));g.computeBoundingSphere();return g;
}

function athlete(data,geometries,textures,definition,knit){
 const group=new THREE.Group();group.name='Football entrance · '+definition.player.name;
 const bones=data.bones.map(b=>{const bone=new THREE.Bone();bone.name=b.name;return bone;}),byName={};
 data.bones.forEach((b,i)=>{byName[b.name]=bones[i];const parent=b.parent>=0?bones[b.parent]:group;parent.add(bones[i]);bones[i].position.fromArray(b.head);if(b.parent>=0)bones[i].position.sub(new THREE.Vector3().fromArray(data.bones[b.parent].head));});
 group.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
 const red=definition.keeper?0x176f62:0xc51d32,skin=new THREE.MeshStandardMaterial({map:definition.dark?textures.dark:textures.light,color:definition.tint||0xffffff,roughness:.69}),shirt=mat(0xffffff,{map:jerseyTexture(definition.player,textures.crest,definition.keeper),roughness:.88,bumpMap:knit,bumpScale:.0008}),shorts=mat(red,{roughness:.9,bumpMap:knit,bumpScale:.0009});
 const sockMap=canvasTexture(128,256,c=>{c.fillStyle='#dfdfd6';c.fillRect(0,0,128,256);c.fillStyle=definition.keeper?'#276f61':'#af1428';c.fillRect(0,138,128,8);c.fillRect(0,153,128,5);c.fillStyle='#bcbeb5';for(let x=0;x<128;x+=5)c.fillRect(x,0,1,256);});sockMap.wrapS=sockMap.wrapT=THREE.RepeatWrapping;
 const sock=mat(0xffffff,{map:sockMap,roughness:.93}),boot=mat(definition.boot||0xe8e7df,{map:textures.boot,roughness:.52}),hair=definition.hair==='crop'?mat(0x25211e,{roughness:.93,bumpMap:knit,bumpScale:.0012}):mat(definition.hairColor||0xffffff,{map:textures[definition.hair],alphaTest:.46,side:THREE.DoubleSide,roughness:.91}),eye=mat(0xffffff,{map:textures.eyes,roughness:.3}),brows=mat(definition.hairColor||0xffffff,{map:textures.brows,transparent:false,alphaTest:.3,side:THREE.DoubleSide});
 const materials={skin,shirt,shorts,socks:sock,bootL:boot,bootR:boot,[definition.hair]:hair,eyes:eye,eyebrows:brows};
 for(const[name,material]of Object.entries(materials)){const m=new THREE.SkinnedMesh(geometries[name],material);m.name=name;m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;group.add(m);m.bind(skeleton,new THREE.Matrix4());}
 // Soft contact, rather than black rectangular plates under the player's feet.
 const shadow=mesh(new THREE.PlaneGeometry(.67,.72),new THREE.MeshBasicMaterial({map:textures.shadow,transparent:true,depthWrite:false,opacity:.43}),group,0,.008,0);shadow.rotation.x=-Math.PI/2;
 const rest=Object.fromEntries(data.bones.map(b=>[b.name,new THREE.Vector3().fromArray(b.head)])),dirs={},inverse=new THREE.Quaternion(),q1=new THREE.Quaternion(),q2=new THREE.Quaternion(),q3=new THREE.Quaternion(),hip=new THREE.Vector3(),ankle=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),knee=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
 for(const side of['L','R']){dirs['thigh'+side]=rest['lowerleg01.'+side].clone().sub(rest['upperleg01.'+side]);dirs['shin'+side]=rest['foot.'+side].clone().sub(rest['lowerleg01.'+side]);dirs['arm'+side]=rest['lowerarm01.'+side].clone().sub(rest['upperarm01.'+side]);dirs['forearm'+side]=rest['wrist.'+side].clone().sub(rest['lowerarm01.'+side]);dirs['hand'+side]=new THREE.Vector3().fromArray(data.bones.find(b=>b.name==='wrist.'+side).tail).sub(rest['wrist.'+side]);}
 let gaitDistance=0,lastX=null,lastZ=null,lastTime=0,blend=0,stairsMix=0;
 function pose(px,pz,heading,time,moving){
  const dt=Math.min(.1,Math.max(0,time-lastTime));lastTime=time;blend=THREE.MathUtils.damp(blend,moving?1:0,9,dt||.016);
  stairsMix=THREE.MathUtils.damp(stairsMix,px>-46.4&&px<-40.2?1:0,8,dt||.016);const strideScale=THREE.MathUtils.lerp(1,.72/1.3,stairsMix);
  if(lastX!==null&&Math.hypot(px-lastX,pz-lastZ)<2)gaitDistance+=Math.hypot(px-lastX,pz-lastZ)/strideScale;lastX=px;lastZ=pz;
  const cycle=gaitDistance/1.3*Math.PI*2+definition.phase,bob=(.006*Math.cos(cycle*2)-.060-stairsMix*.04)*blend;
  byName.root.position.fromArray(data.bones[0].head);byName.root.position.y+=bob;byName.root.position.x+=Math.sin(cycle)*.013*blend;
  byName.spine03.rotation.set(.015+blend*.018,Math.sin(cycle)*.025*blend,Math.sin(cycle)*-.014*blend);
  byName.spine01.rotation.set(.008,Math.sin(cycle)*-.032*blend,0);
  byName.neck01.rotation.set(0,Math.sin(time*.47+definition.phase)*.025,0);
  const bodyFloor=px> -46&&px< -40.4?clamp((px+45.9)/5.4)*2.7-2.7:entranceFloor(px);
  group.position.set(px,bodyFloor,pz);group.rotation.y=heading;group.scale.setScalar(definition.height/1.86);
  for(const side of['L','R']){
   const sign=side==='L'?1:-1,s=footballStride(gaitDistance+definition.phase/Math.PI*.65,side==='R'?1:0);let stanceZ=s.z*blend*strideScale;
   const anchorX=px+stanceZ;if(stairsMix>.3&&!s.swing&&anchorX> -45.9&&anchorX< -40.5){const tread=Math.floor((anchorX+45.9+.05)/.36);stanceZ=(-45.9+(tread+.5)*.36-.05)-px;}
   hip.copy(rest['upperleg01.'+side]);hip.x+=Math.sin(cycle)*.013*blend;hip.y+=bob;ankle.copy(rest['foot.'+side]);ankle.z+=stanceZ;ankle.y+=(s.lift+(s.swing?Math.sin(Math.PI*(s.lift/.13))*.03:0)*stairsMix)*blend;
   ankle.y+=(entranceFloor(px+stanceZ*Math.sin(heading)*definition.height/1.86)-bodyFloor)*1.86/definition.height;
   const l1=dirs['thigh'+side].length(),l2=dirs['shin'+side].length();axis.copy(ankle).sub(hip);const length=clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.002);axis.normalize();const along=(l1*l1-l2*l2+length*length)/(2*length),height=Math.sqrt(Math.max(0,l1*l1-along*along));bend.copy(FORWARD).addScaledVector(axis,-FORWARD.dot(axis)).normalize();knee.copy(hip).addScaledVector(axis,along).addScaledVector(bend,height);
   q1.setFromUnitVectors(v1.copy(dirs['thigh'+side]).normalize(),v2.copy(knee).sub(hip).normalize());byName['upperleg01.'+side].quaternion.copy(q1);
   q2.setFromUnitVectors(v1.copy(dirs['shin'+side]).normalize(),v2.copy(ankle).sub(knee).normalize());byName['lowerleg01.'+side].quaternion.copy(inverse.copy(q1).invert().multiply(q2));byName['foot.'+side].quaternion.copy(inverse.copy(q2).invert());byName['foot.'+side].rotateX(s.roll*blend);
   // Counter-swing with a bent elbow and a relaxed wrist, preserving the
   // continuous shoulder/upper arm/forearm mesh and its blended skin weights.
   const swing=Math.sin(cycle+(side==='L'?0:Math.PI))*.22*blend;
   q1.setFromUnitVectors(v1.copy(dirs['arm'+side]).normalize(),v2.set(sign*.08,-1,swing).normalize());byName['upperarm01.'+side].quaternion.copy(q1);
   q2.setFromUnitVectors(v1.copy(dirs['forearm'+side]).normalize(),v2.set(sign*.04,-1,.28+swing*.75).normalize());byName['lowerarm01.'+side].quaternion.copy(inverse.copy(q1).invert().multiply(q2));
   const hand=q3.setFromUnitVectors(v1.copy(dirs['hand'+side]).normalize(),v2.set(sign*.015,-1,.24+swing*.5).normalize());byName['wrist.'+side].quaternion.copy(inverse.copy(q2).invert().multiply(hand));
  }
 }
 return{group,pose,reset(){gaitDistance=0;lastX=null;lastZ=null;lastTime=0;blend=0;stairsMix=0;}};
}

export function buildEntrancePlayers(scene){
 const root=new THREE.Group();root.name='Skinned football entrance queue';root.visible=false;scene.add(root);let loading,players=[],ready=false;
 async function prepare(){if(loading)return loading;loading=(async()=>{
  const loader=new THREE.TextureLoader(),loadTexture=name=>loader.loadAsync(asset(name)),[data,binary,light,dark,short02,eyes,brows,crest]=await Promise.all([
   fetch(asset('footballer.json')).then(r=>{if(!r.ok)throw Error('Player manifest '+r.status);return r.json();}),fetch(asset('footballer.bin')).then(r=>{if(!r.ok)throw Error('Player mesh '+r.status);return r.arrayBuffer();}),loadTexture('skin-light.webp'),loadTexture('skin-dark.webp'),loadTexture('hair-short02.webp'),loadTexture('eyes.webp'),loadTexture('brows.webp'),new THREE.ImageLoader().loadAsync(new URL('./assets/fc-bayern.svg',import.meta.url).href)
  ]);for(const t of[light,dark,short02,eyes,brows]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  const shadow=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.4,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
  const boot=canvasTexture(256,256,c=>{c.fillStyle='#e7e8e3';c.fillRect(0,0,256,256);c.fillStyle='#555b5e';c.fillRect(130,0,126,256);c.strokeStyle='#666c6c';c.lineWidth=2;c.beginPath();c.moveTo(5,4);c.lineTo(5,252);c.moveTo(124,4);c.lineTo(124,252);c.stroke();c.strokeStyle='#f8f7ef';c.lineWidth=4;for(let y=90;y<177;y+=13){c.beginPath();c.moveTo(43,y);c.lineTo(86,y+6);c.stroke();}c.strokeStyle='#626967';c.lineWidth=3;for(const x of[13,109]){c.beginPath();c.moveTo(x,68);c.lineTo(x+9,119);c.stroke();}});
  const geometries=Object.fromEntries(data.parts.map(p=>[p.name,makeGeometry(binary,p)])),textures={light,dark,short02,eyes,brows,crest,shadow,boot},knit=knitTexture();knit.wrapS=knit.wrapT=THREE.RepeatWrapping;knit.repeat.set(9,12);
  const definitions=[{number:9,height:1.88,hair:'short02',hairColor:0x9a8476,boot:0xd4c8aa},{number:10,height:1.84,hair:'crop',dark:true,boot:0xe2e0cf},{number:6,height:1.77,hair:'short02',hairColor:0x887363,boot:0x7caaa0},{number:17,height:1.84,hair:'crop',dark:true,boot:0xc7a3ad},{number:14,height:1.80,hair:'crop',dark:true,tint:0xf0d5c0,boot:0xd6c188},{number:1,height:1.93,hair:'short02',hairColor:0x95816e,keeper:true,boot:0x31373a}];
  players=definitions.map((d,i)=>{const p=athlete(data,geometries,textures,{...d,player:playerByNumber(d.number),lane:i%2?.72:-.72,phase:i*.43},knit);root.add(p.group);return p;});ready=true;return true;
 })().catch(error=>{loading=null;throw error;});return loading;}
 return{root,prepare,get ready(){return ready;},get positions(){return players.map(p=>[p.group.position.x,p.group.position.z].map(v=>v.toFixed(2)).join(',')).join(';');},reset(){for(const p of players)p.reset();},update(seconds,time){for(let i=0;i<players.length;i++){const p=sampleQueuePlayer(seconds,i);players[i].pose(p.x,p.z,p.yaw,time,p.moving);}}};
}
