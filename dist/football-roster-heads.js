import {THREE} from './kit.js';
import {bayernHeadProfiles} from './bayern-head-profiles.js';

export function rosterHeadProfile(definition) {
 if(definition.team!=='home')return null;
 return bayernHeadProfiles[definition.player?.number]??null;
}

function smooth(min,max,value) {
 const t=Math.max(0,Math.min(1,(value-min)/(max-min)));
 return t*t*(3-2*t);
}

function bell(value,center,width) {
 const t=(value-center)/width;
 return Math.exp(-t*t);
}

const capHeight={swept:1.03,curls:1.17,fade:.94,buzz:.74,shaved:.72,braids:1.01};
const headParts=['face','skin','eyes','eyebrows','crop','short02'];

function shape(x,y,z,profile,hair,target) {
 const neck=smooth(1.604,1.651,y);
 if(neck===0)return target.set(x,y,z);
 const jaw=bell(y,1.650,.028),cheek=bell(y,1.709,.037);
 const crown=smooth(1.759,1.826,y),chin=bell(y,1.638,.019)*bell(x,0,.036)*smooth(.10,.149,z);
 const width=1+neck*((profile.jawWidth-1)*jaw+(profile.faceWidth-1)*cheek*(1-jaw)+(profile.skullWidth-1)*crown);
 const depth=1+neck*(profile.skullWidth-1)*(.42*crown+.18*cheek);
 const hairLift=hair?Math.max(0,y-1.762)*((capHeight[profile.style]??1)-1):0;
 return target.set(x*width,y+profile.chin*chin*neck+hairLift,.065+(z-.065)*depth);
}

// Reuse all attributes unaffected by the sculpture, including the original
// skin weights and indices. A new face therefore costs no extra triangles.
export function shapeRosterHead(source,profile) {
 const shaped=new THREE.BufferGeometry();
 for(const [name,attribute] of Object.entries(source.attributes))shaped.setAttribute(name,attribute);
 shaped.setIndex(source.index);
 const position=source.attributes.position.clone(),normal=source.attributes.normal.clone();
 shaped.setAttribute('position',position);shaped.setAttribute('normal',normal);
 const result=new THREE.Vector3(),n=new THREE.Vector3(),tangent=new THREE.Vector3(),bitangent=new THREE.Vector3();
 const right=new THREE.Vector3(),up=new THREE.Vector3(),epsilon=.0002;
 for(const name of headParts){
  const part=source.userData.parts[name];
  if(!part)continue;
  const hair=name==='short02';
  for(let i=part.start;i<part.start+part.count;i++){
   const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
   if(y<=1.604)continue;
   n.fromBufferAttribute(normal,i);
   tangent.set(n.z,0,-n.x);
   if(tangent.lengthSq()<1e-8)tangent.set(1,0,0);
   tangent.normalize().multiplyScalar(epsilon);
   bitangent.crossVectors(n,tangent);
   shape(x,y,z,profile,hair,result);
   shape(x+tangent.x,y+tangent.y,z+tangent.z,profile,hair,right).sub(result);
   shape(x+bitangent.x,y+bitangent.y,z+bitangent.z,profile,hair,up).sub(result);
   n.crossVectors(right,up).normalize();
   position.setXYZ(i,result.x,result.y,result.z);
   normal.setXYZ(i,n.x,n.y,n.z);
  }
 }
 shaped.userData.parts=source.userData.parts;
 shaped.boundingSphere=source.boundingSphere?.clone().expandByPoint(new THREE.Vector3(0,1.97,0))??null;
 return shaped;
}

export function paintRosterBeard(context,[x,y,w,h],profile) {
 if(profile.beard<=0)return;
 context.translate(x,y);context.scale(w,h);
 context.globalCompositeOperation='multiply';
 const alpha=profile.beard;
 const color=profile.complexion>.55?'47,36,33':'85,68,56';
 const beard=context.createRadialGradient(.79,.5,.04,.79,.5,.235);
 beard.addColorStop(0,`rgba(${color},0)`);
 beard.addColorStop(.45,`rgba(${color},${alpha*.26})`);
 beard.addColorStop(.72,`rgba(${color},${alpha*.62})`);
 beard.addColorStop(1,`rgba(${color},0)`);
 context.fillStyle=beard;
 context.fillRect(.56,.235,.44,.53);
 for(let i=0;i<154;i++){
  const a=i*2.399963,rad=.105+.073*((i*73)%151)/150;
  const u=.79+Math.cos(a)*rad,v=.5+Math.sin(a)*rad*1.21;
  if(u<.68&&Math.abs(v-.5)<.10)continue;
  context.fillStyle=`rgba(${color},${alpha*(i%3===0?.40:.22)})`;
  context.fillRect(u,v,.004,.0035);
 }
}

export function paintRosterHair(context,[x,y,w,h],profile) {
 if(profile.style==='shaved')return;
 context.translate(x,y);context.scale(w,h);
 const braided=profile.style==='braids',curled=profile.style==='curls';
 const color=new THREE.Color(profile.hairColor);
 const roots=context.createLinearGradient(0,0,0,1);
 roots.addColorStop(0,color.clone().multiplyScalar(1.22).getStyle());
 roots.addColorStop(.64,color.getStyle());
 roots.addColorStop(1,color.clone().multiplyScalar(.66).getStyle());
 context.fillStyle=roots;context.fillRect(0,0,1,1);
 for(let i=0;i<(braided?18:145);i++){
  const u=(i+.5)/(braided?18:145),v=.12+.78*(.5+.5*Math.sin(i*2.399963));
  context.strokeStyle=i%4===0?'rgba(232,205,180,.23)':'rgba(15,10,9,.21)';
  context.lineWidth=braided?.013:curled?.007:.004;
  context.beginPath();
  if(curled)context.arc(u,v,.017,.08,4.15);
  else if(braided){context.moveTo(u-.04,0);context.bezierCurveTo(u+.065,.28,u-.07,.62,u+.04,1);}
  else{context.moveTo(u,v);context.lineTo(u+.012,v-.059);}
  context.stroke();
 }
 if(profile.hair==='crop'){
  const rootFade=context.createLinearGradient(0,0,0,1);
  rootFade.addColorStop(0,'#fff');
  rootFade.addColorStop(.72,'#fff');
  rootFade.addColorStop(.92,'rgba(255,255,255,.62)');
  rootFade.addColorStop(1,'rgba(255,255,255,0)');
  context.globalCompositeOperation='destination-in';
  context.fillStyle=rootFade;
  context.fillRect(0,0,1,1);
 }
}
