import {THREE,v,mat,mesh,box,beam,sign,Batches,compactGroup,floorTexture,repeatTex} from './kit.js';
import {core,coreFlights,coreLevels,platforms,bridges} from './building-layout.js';
import {orientedCollider} from './access-layout.js';
export function buildWalkBuilding(scene){
 const root=new THREE.Group();root.name='Continuous indoor stairs and tier galleries';scene.add(root);const b=new Batches(root),colliders=[];
 const concrete=mat(0xd2d4cd,{map:repeatTex(floorTexture(),3,3),roughness:.91}),red=mat(0xb41b36),metal=mat(0x8fadb7,{metalness:.45,roughness:.45}),pale=mat(0xe6e0ce),glow=new THREE.MeshBasicMaterial({color:0xffd995,toneMapped:false});
 function rail(a,c){beam(root,v(a[0],a[1]+1.05,a[2]),v(c[0],c[1]+1.05,c[2]),.035,metal);const length=Math.hypot(c[0]-a[0],c[2]-a[2]),yaw=-Math.atan2(c[2]-a[2],c[0]-a[0]);for(let i=0;i<Math.ceil(length/1.5);i++){const t=(i+.5)/Math.ceil(length/1.5),x=a[0]+(c[0]-a[0])*t,z=a[2]+(c[2]-a[2])*t,y=a[1]+(c[1]-a[1])*t;b.add(.045,1.05,.045,x,y+.525,z,metal);colliders.push(orientedCollider(x,z,length/Math.ceil(length/1.5)+.01,.04,y-.2,y+1.2,yaw));}}
 for(const f of coreFlights){for(let i=0;i<f.steps;i++){const y=f.base+(i+1)*(f.top-f.base)/f.steps,z=f.z+f.dir*(i+.5)*.34;b.add(f.width,.2,.35,f.x,y-.1,z,concrete);b.add(f.width-.04,.018,.045,f.x,y+.009,z+f.dir*.13,pale);}
  for(const side of[-1,1])rail([f.x+side*(f.width/2-.05),f.base,f.z],[f.x+side*(f.width/2-.05),f.top,f.z+f.dir*f.run]);
 }
 for(const p of platforms){b.add(p.w,.22,p.d,p.x,p.y-.11,p.z,concrete);if(p.id.startsWith('turn')){rail([p.x-p.w/2,p.y,p.z+p.d/2],[p.x+p.w/2,p.y,p.z+p.d/2]);}}
 for(let i=0;i<coreLevels.length;i++){const y=coreLevels[i],text=['入口层 · 接待大厅','公共大厅 · 商店 · 展厅','中层看台 · 贵宾包厢','上层看台'][i];sign(root,text,5.7,.65,101.5,y+2.65,-13.02,{bg:'#a61b35',font:64});const back=sign(root,'下一层 ↓    ↑ 上一层',5.6,.5,101.5,y+2.4,-13.04,{bg:'#304852',font:64});back.rotation.y=Math.PI;b.add(5.6,.04,.14,101.5,y+2.95,-12.4,glow);}
 // Side walls leave the full front landing open at every level.
 function sideWall(x,z,d,y0=-3.2,y1=43.4){if(y1<=y0)return;b.add(.15,y1-y0,d,x,(y0+y1)/2,z,concrete);colliders.push(orientedCollider(x,z,.15,d,y0,y1));}
 sideWall(core.maxX+.12,-1,25);
 const west=core.minX-.12;sideWall(west,-12.725,1.55);sideWall(west,1.225,20.55);
 let previous=-3.2;for(const y of coreLevels){sideWall(west,-10.5,2.9,previous,y);previous=y+3.25;}sideWall(west,-10.5,2.9,previous,43.4);
 // Close the stairwell behind the turning landings and between entry levels.
 // Otherwise an occluded exterior leaves a view into the empty undercroft.
 const stairWidth=core.maxX-core.minX+.4,frontSpan=(y0,y1)=>{if(y1<=y0)return;b.add(stairWidth,y1-y0,.18,101.5,(y0+y1)/2,-13.25,concrete);colliders.push(orientedCollider(101.5,-13.25,stairWidth,.18,y0,y1));};
 b.add(stairWidth,46.6,.18,101.5,20.1,10.1,concrete);colliders.push(orientedCollider(101.5,10.1,stairWidth,.18,-3.2,43.4));b.add(stairWidth,.18,23.6,101.5,43.4,-1.6,concrete);
 previous=-3.2;for(const y of coreLevels){frontSpan(previous,y);previous=y+3.25;}frontSpan(previous,43.4);
 for(const p of platforms.filter(p=>p.id.startsWith('turn'))){const label=sign(root,['公共大厅 · 2F','中层看台 · 3F','上层看台 · 4F'][Number(p.id.slice(4))],4.8,.5,101.5,p.y+1.9,9.98,{bg:'#344b51',font:76});label.rotation.y=Math.PI;b.add(stairWidth-.2,.09,.045,101.5,p.y+.28,9.97,red);b.add(3.1,.045,.22,101.5,p.y+3.2,8.7,glow);const light=new THREE.PointLight(0xffedda,55,17,2);light.position.set(101.5,p.y+2.9,7.7);root.add(light);}
 for(const bridge of bridges){const a=v(...bridge.a),c=v(...bridge.b),delta=c.clone().sub(a),length=delta.length(),yaw=Math.atan2(delta.x,delta.z),floor=box(root,bridge.width,.16,length,(a.x+c.x)/2,(a.y+c.y)/2-.08,(a.z+c.z)/2,concrete);floor.rotation.set(-Math.atan2(delta.y,Math.hypot(delta.x,delta.z)),yaw,0,'YXZ');
  const n=v(delta.z,0,-delta.x).normalize(),startTrim=bridge.id==='loungeBridge'?4:bridge.id==='middleBridge'?1.8:0,endTrim=bridge.id==='middleGallery'||bridge.id==='upperGallery'||bridge.id==='middleBridge'?1.8:0;
  if(length>startTrim+endTrim+.2&&bridge.id!=='upperBridge')for(const side of[-1,1]){const first=a.clone().addScaledVector(delta,startTrim/length),last=c.clone().addScaledVector(delta,-endTrim/length);rail([first.x+n.x*side*(bridge.width/2-.04),first.y,first.z+n.z*side*(bridge.width/2-.04)],[last.x+n.x*side*(bridge.width/2-.04),last.y,last.z+n.z*side*(bridge.width/2-.04)]);}
  if(bridge.id==='lowerPassage'){const roof=floor.clone();roof.position.y+=2.85;root.add(roof);for(const side of[-1,1]){const x=side*1.6;b.add(.16,2.7,20.8,x,12.6,-93.6,concrete);}sign(root,'下层看台 ↑',3,.65,0,14.7,-103.3,{bg:'#b41b36'});}
 }
 b.flush();compactGroup(root);return {root,colliders,update(position,mode){root.visible=mode==='orbit'||position.distanceTo(v(90,15,-5))<180;}};
}
