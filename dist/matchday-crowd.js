import {THREE,mesh,canvasTexture,Batches,mat} from './kit.js';
import {createCrowdLayout,supporterAtlas,crowdDetailBudget} from './crowd-layout.js';
import {supporterGeometry,animateSupporterMaterial} from './supporter-model.js';

function fallbackAtlas(){return canvasTexture(1254,1254,c=>{
 const shirts=['#b8253c','#7e263b','#30343a','#d9d1bf','#aa273d','#25364d','#b7273e','#89908e'];
 supporterAtlas.frames.forEach(([x,y,w,h],i)=>{c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.translate(x+w/2,y);const scale=h/610;c.scale(scale,scale);c.lineCap='round';c.strokeStyle='#293545';c.lineWidth=52;c.beginPath();c.moveTo(-42,370);c.lineTo(-65,430);c.lineTo(-65,565);c.moveTo(42,370);c.lineTo(65,430);c.lineTo(65,565);c.stroke();c.fillStyle='#b9b5a9';for(const k of[-1,1])c.fillRect(k*65-23,560,48,29);c.fillStyle=shirts[i];c.beginPath();c.moveTo(-85,210);c.quadraticCurveTo(0,183,85,210);c.lineTo(77,375);c.lineTo(-77,375);c.closePath();c.fill();c.strokeStyle=shirts[i];c.lineWidth=35;c.beginPath();c.moveTo(-80,215);c.lineTo(-105,300);c.lineTo(-55,345);c.moveTo(80,215);c.lineTo(105,300);c.lineTo(55,345);c.stroke();c.fillStyle=i===4?'#8e5c43':'#c99a77';c.fillRect(-25,175,50,43);c.beginPath();c.ellipse(0,142,42,53,0,0,Math.PI*2);c.fill();c.fillStyle=i===5?'#a2a29d':'#332a26';c.beginPath();c.ellipse(0,106,43,26,0,Math.PI,Math.PI*2);c.fill();c.restore();});
});}

export function buildMatchdayCrowd(parent,seats,{mobile=false,reducedMotion=false}={}){
 const root=new THREE.Group();root.name='Matchday audience: photo sprites and seated near spectators';root.visible=false;parent.add(root);
 const layout=createCrowdLayout(seats),time={value:0},excitement={value:0},awayColor={value:new THREE.Color(0xebcc3d)},fallback=fallbackAtlas(),frames=supporterAtlas.frames.map(([x,y,w,h])=>new THREE.Vector4(x/1254,1-(y+h)/1254,w/1254,h/1254));
 let detailLimit=crowdDetailBudget(mobile),assetState='fallback',loading,lastNear=null,lastNearAt=-Infinity,detail=[],reaction={time:-100,intensity:0};
 const material=new THREE.MeshBasicMaterial({map:fallback,alphaTest:.52,side:THREE.DoubleSide,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.uniforms.fanTime=time;shader.uniforms.fanExcitement=excitement;shader.uniforms.fanFrames={value:frames};shader.uniforms.awayShirt=awayColor;
  shader.vertexShader='attribute float fanTile; attribute float fanDetail; attribute float fanPhase; attribute float fanVisitor; uniform float fanTime; uniform float fanExcitement; uniform vec4 fanFrames[8]; varying float vFanVisitor;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvec4 fanFrame=fanFrames[int(fanTile+.5)];vMapUv=fanFrame.xy+vMapUv*fanFrame.zw;vFanVisitor=fanVisitor;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=max(position.y-.2,0.)*.010*sin(fanTime*1.7+fanPhase);transformed.y+=max(position.y-.4,0.)*.018*fanExcitement*sin(fanTime*2.5+fanPhase);transformed*=1.-step(.5,fanDetail);');
  shader.fragmentShader='uniform vec3 awayShirt; varying float vFanVisitor;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(vFanVisitor>.5&&diffuseColor.r>diffuseColor.g*2.1&&diffuseColor.r>diffuseColor.b*1.8){float shade=clamp(diffuseColor.r*1.3,.18,1.);diffuseColor.rgb=awayShirt*shade;}');
 };
 material.customProgramCacheKey=()=> 'crowd-photo-atlas-v310';
 const dummy=new THREE.Object3D(),shade=new THREE.Color();
 for(let sector=0;sector<24;sector++){
  const records=layout.records.filter(r=>(r.seat.sector??0)===sector);if(!records.length)continue;
  const g=new THREE.PlaneGeometry(1,1).translate(0,.5,0),tiles=new Float32Array(records.length),detailFlags=new Float32Array(records.length),phases=new Float32Array(records.length),visitors=new Float32Array(records.length),fans=new THREE.InstancedMesh(g,material,records.length);
  fans.name='Audience sprites · sector '+sector;fans.receiveShadow=false;
  records.forEach((r,i)=>{const s=r.seat,frame=supporterAtlas.frames[r.frame];dummy.position.set(s.x,s.y-.19,s.z);dummy.rotation.set(0,s.yaw+Math.PI,0);dummy.scale.set(frame[2]/frame[3]*1.50*r.scale,1.50*r.scale,1);dummy.updateMatrix();fans.setMatrixAt(i,dummy.matrix);const brightness=.85+(r.phase/(Math.PI*2))*.15;fans.setColorAt(i,shade.setRGB(brightness,brightness,brightness));tiles[i]=r.frame;phases[i]=r.phase;visitors[i]=r.visitor?1:0;r.mesh=fans;r.slot=i;});
  g.setAttribute('fanTile',new THREE.InstancedBufferAttribute(tiles,1));g.setAttribute('fanDetail',new THREE.InstancedBufferAttribute(detailFlags,1).setUsage(THREE.DynamicDrawUsage));g.setAttribute('fanPhase',new THREE.InstancedBufferAttribute(phases,1));g.setAttribute('fanVisitor',new THREE.InstancedBufferAttribute(visitors,1));fans.computeBoundingSphere();root.add(fans);
 }
 const budget=crowdDetailBudget(mobile),geometry=supporterGeometry(),nearMaterial=new THREE.MeshLambertMaterial({vertexColors:true,emissive:0x111015});animateSupporterMaterial(nearMaterial,time,excitement);
 const attributes={fanShirt:3,fanSkin:3,fanPhase:1,fanGesture:1,fanScarf:1};for(const[name,size]of Object.entries(attributes))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(budget*size),size).setUsage(THREE.DynamicDrawUsage));
 const near=new THREE.InstancedMesh(geometry,nearMaterial,budget);near.name='Seated 3D spectators · bounded near detail';near.count=0;near.frustumCulled=false;near.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(near);
 const shirts=[0xb72c43,0x742639,0x29323c,0xcac4b6,0xa92c41,0x28364b,0xb42b40,0x868b88],skins=[0xcba17e,0xb9896a,0x855d45,0x6f4e3b,0xdab493,0xa47455],skin=new THREE.Color();
 function selectDetail(selected){
  const touched=new Set();for(const r of detail){r.detail=false;r.mesh.geometry.attributes.fanDetail.setX(r.slot,0);touched.add(r.mesh);}
  detail=selected;near.count=selected.length;
  selected.forEach((r,i)=>{const s=r.seat;r.detail=true;r.mesh.geometry.attributes.fanDetail.setX(r.slot,1);touched.add(r.mesh);dummy.position.set(s.x,s.y-.19,s.z);dummy.rotation.set(0,s.yaw+Math.PI,0);dummy.scale.setScalar(r.scale);dummy.updateMatrix();near.setMatrixAt(i,dummy.matrix);
   shade.copy(r.visitor?awayColor.value:new THREE.Color(shirts[r.frame]));skin.set(skins[r.frame===4?2+r.skin%2:r.frame===6?1+r.skin%2:r.skin%2===0?0:4]);geometry.attributes.fanShirt.setXYZ(i,shade.r,shade.g,shade.b);geometry.attributes.fanSkin.setXYZ(i,skin.r,skin.g,skin.b);geometry.attributes.fanPhase.setX(i,r.phase);geometry.attributes.fanGesture.setX(i,r.gesture);geometry.attributes.fanScarf.setX(i,[0,3].includes(r.frame)?1:0);
  });
  for(const mesh of touched)mesh.geometry.attributes.fanDetail.needsUpdate=true;near.instanceMatrix.needsUpdate=true;for(const name of Object.keys(attributes))geometry.attributes[name].needsUpdate=true;
 }
 const flagMap=canvasTexture(384,192,c=>{c.fillStyle='#a6263c';c.fillRect(0,0,384,192);c.fillStyle='#e3ded0';c.fillRect(0,72,384,48);c.font='bold 38px Arial';c.textAlign='center';c.fillText('MIA SAN MIA',192,50);c.font='bold 31px Arial';c.fillText('FC BAYERN',192,163);}),flagMaterial=new THREE.MeshBasicMaterial({map:flagMap,side:THREE.DoubleSide});
 flagMaterial.onBeforeCompile=shader=>{shader.uniforms.fanTime=time;shader.uniforms.fanExcitement=excitement;shader.vertexShader='uniform float fanTime; uniform float fanExcitement;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(position.x*3.5-fanTime*(2.+fanExcitement)+modelMatrix[3].x*.17+modelMatrix[3].z*.11)*.10*(position.x+.9);');};flagMaterial.customProgramCacheKey=()=> 'audience-flags-v310';
 const poles=new Batches(root),steel=mat(0x829095,{metalness:.35});
 if(seats.length)for(const z of[-91,91])for(const x of[-28,-10,10,28]){const s=seats.reduce((best,p)=>(p.x-x)**2+(p.z-z)**2+2*(p.y-18)**2<(best.x-x)**2+(best.z-z)**2+2*(best.y-18)**2?p:best,seats[0]),group=new THREE.Group();group.position.set(s.x,s.y,s.z);group.rotation.y=s.yaw+Math.PI;root.add(group);mesh(new THREE.PlaneGeometry(1.75,1.04,10,5),flagMaterial,group,0,2.2,0);poles.add(.025,2.8,.025,s.x,s.y+1.4,s.z,steel);}
 poles.flush();
 const banner=canvasTexture(768,128,c=>{c.fillStyle='#a42138';c.fillRect(0,0,768,128);c.fillStyle='#e7e1d4';c.fillRect(0,4,768,3);c.fillRect(0,121,768,3);c.font='bold 54px Arial';c.textAlign='center';c.fillText('MIA SAN MIA',384,83);}),bannerMaterial=new THREE.MeshBasicMaterial({map:banner,side:THREE.DoubleSide});
 if(seats.length>100)for(const z of[-61,61])for(const x of[-13,0,13]){const b=mesh(new THREE.PlaneGeometry(10.4,1.1),bannerMaterial,root,x,.35,z);b.rotation.y=z>0?Math.PI:0;b.name='Supporters railing banner';}
 async function prepare(){if(loading)return loading;assetState='loading';loading=new THREE.TextureLoader().loadAsync(new URL('./assets/crowd/supporters-atlas-3100.png',import.meta.url).href).then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=mobile?2:4;texture.name='Generated supporters photo atlas 3.1';material.map=texture;material.needsUpdate=true;fallback.dispose();assetState='ready';return true;}).catch(()=>{assetState='unavailable';loading=null;return false;});return loading;}
 return{root,count:layout.count,visitorCount:layout.visitorCount,nearBudget:budget,get nearCount(){return near.count;},get assetState(){return assetState;},prepare,
  setQuality(mode='standard',scale=1){const next=mode==='low'?0:Math.round(budget*(mode==='high'?1:Math.max(.35,Math.min(1,scale))));if(next!==detailLimit){detailLimit=next;lastNear=null;}},
  night(on){material.color.set(on?0xd4d6dc:0xf4f3ef);flagMaterial.color.set(on?0xd9d6d2:0xffffff);},
  setEnabled(on){root.visible=!!on;if(!on){selectDetail([]);lastNear=null;reaction={time:-100,intensity:0};}},
  setOpponent(club){awayColor.value.set(club?.kit?.shirt||'#ebcc3d');lastNear=null;},
  react(seconds,intensity=1){const remaining=reaction.intensity*Math.max(0,1-(seconds-reaction.time)/6);if(intensity>=remaining)reaction={time:seconds,intensity:Math.max(0,Math.min(1,intensity))};},
  update(seconds,viewer){time.value=reducedMotion?0:seconds;excitement.value=reducedMotion?0:reaction.intensity*Math.max(0,1-(seconds-reaction.time)/6);if(!root.visible||!viewer)return;
   const moved=lastNear?(viewer.x-lastNear.x)**2+(viewer.y-lastNear.y)**2+(viewer.z-lastNear.z)**2:Infinity;if(!lastNear||moved>100||seconds-lastNearAt>.35&&moved>1.44){selectDetail(layout.nearby(viewer,{mobile,budget:detailLimit}));lastNear={x:viewer.x,y:viewer.y,z:viewer.z};lastNearAt=seconds;}
  }
 };
}
