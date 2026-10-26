import {THREE,mergeGeometry} from './kit.js';

// A single shared, unrigged seated spectator. All colour and arm variation is
// instanced; there is no skeleton, texture or draw call per audience member.
export function supporterGeometry(){
 const parts=[];
 function add(geometry,x,y,z,color=0xffffff,part=2,arm=0){const g=geometry.index?geometry.toNonIndexed():geometry;g.translate(x,y,z);const n=g.attributes.position.count,c=new THREE.Color(color),colors=new Float32Array(n*3);for(let i=0;i<n;i++)colors.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('fanKind',new THREE.Float32BufferAttribute(new Float32Array(n).fill(part),1));g.setAttribute('fanArm',new THREE.Float32BufferAttribute(new Float32Array(n).fill(arm),1));parts.push(g);}
 function limb(a,b,r,part,arm=0,color=0xffffff){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p),g=new THREE.CylinderGeometry(r,r*.92,delta.length(),6,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));const middle=p.add(q).multiplyScalar(.5);add(g,middle.x,middle.y,middle.z,color,part,arm);}
 add(new THREE.CylinderGeometry(.215,.155,.44,8,1),0,.83,.015,0xffffff,0);
 add(new THREE.BoxGeometry(.34,.15,.25),0,.54,.045,0x242c37);
 add(new THREE.CylinderGeometry(.046,.055,.11,6,1),0,1.095,.025,0xffffff,1);
 add(new THREE.SphereGeometry(.112,8,6).scale(.91,1.12,.97),0,1.25,.025,0xffffff,1);
 add(new THREE.SphereGeometry(.115,8,3,0,Math.PI*2,0,Math.PI*.49).scale(.94,1.09,1),0,1.262,.016,0x292522);
 for(const side of[-1,1]){
  limb([side*.11,.51,.04],[side*.13,.43,.34],.077,2,0,0x273342);
  limb([side*.13,.43,.34],[side*.13,.085,.37],.05,2,0,0x273342);
  add(new THREE.BoxGeometry(.108,.07,.21),side*.13,.05,.425,side<0?0xc6c4bb:0x737c83);
  limb([side*.225,1.0,0],[side*.275,.86,.12],.056,0,side);
  limb([side*.275,.86,.12],[side*.245,.78,.30],.047,0,side);
  add(new THREE.SphereGeometry(.039,5,4),side*.245,.78,.30,0xffffff,1,side);
  add(new THREE.SphereGeometry(.009,4,3),side*.037,1.27,.128,0x292c2e);
 }
 add(new THREE.ConeGeometry(.018,.034,4).rotateX(Math.PI/2),0,1.243,.13,0xffffff,1);
 for(let i=0;i<6;i++)add(new THREE.BoxGeometry(.105,.075,.018),-.2625+i*.105,.78,.34,i%2?0xe7e2d8:0xb9263c,4,2);
 const result=mergeGeometry(parts);for(const g of parts)g.dispose();result.computeBoundingSphere();result.userData.seatedHeight=1.40;return result;
}

export function animateSupporterMaterial(material,time,excitement){
 material.onBeforeCompile=shader=>{
  shader.uniforms.fanTime=time;shader.uniforms.fanExcitement=excitement;
  shader.vertexShader='attribute float fanKind; attribute float fanArm; attribute vec3 fanShirt; attribute vec3 fanSkin; attribute float fanPhase; attribute float fanGesture; attribute float fanScarf; uniform float fanTime; uniform float fanExcitement;\n'+shader.vertexShader;
  const angle='float fanAngle=.12+fanGesture*1.65+fanExcitement*.55+.10*sin(fanTime*2.3+fanPhase);';
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(abs(fanArm)>.5){'+angle+'float c=cos(fanAngle),s=sin(fanAngle);objectNormal.yz=mat2(c,-s,s,c)*objectNormal.yz;}');
  shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nvColor.rgb=fanKind<.5?fanShirt:fanKind<1.5?fanSkin:color.rgb;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(abs(fanArm)>.5){'+angle+'float c=cos(fanAngle),s=sin(fanAngle);vec2 p=transformed.yz-vec2(1.,0.);transformed.yz=mat2(c,-s,s,c)*p+vec2(1.,0.);if(abs(fanArm)<1.5)transformed.x+=fanArm*.012*sin(fanTime*4.2+fanPhase);}\ntransformed.x+=max(0.,position.y-.45)*.012*sin(fanTime*1.4+fanPhase);if(fanKind>3.5&&fanScarf<.5)transformed=vec3(0.);');
 };
 material.customProgramCacheKey=()=> 'instanced-seated-supporters-v310';
}
